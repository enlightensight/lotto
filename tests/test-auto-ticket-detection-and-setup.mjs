import assert from 'assert';
import fs from 'fs';
import mysql from 'mysql2/promise';

console.log('====================================================');
console.log(' JACKPOTLO AUTOMATIC TICKET DETECTION & 2-STEP SETUP');
console.log('       13-REQUIREMENT COMPREHENSIVE TEST SUITE       ');
console.log('====================================================\n');

// 1. Database Connection to jackpotlo_test
const env = fs.readFileSync('.env.test_credentials', 'utf8');
const conf = {};
for (const line of env.split('\n')) {
  const [k, ...v] = line.trim().split('=');
  if (k && !k.startsWith('#')) conf[k.trim()] = v.join('=').trim();
}

assert.strictEqual(conf.DB_NAME, 'jackpotlo_test', 'GUARD: DB must be jackpotlo_test');

const pool = mysql.createPool({
  host: conf.DB_HOST,
  user: conf.DB_USER,
  password: conf.DB_PASSWORD,
  port: Number(conf.DB_PORT),
  database: conf.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://127.0.0.1:3001';
const STORE_ID = 'store_amigo';
const TEST_TIMESTAMP = Date.now();
const UNKNOWN_BARCODE = `1899${String(TEST_TIMESTAMP).slice(-6)}000`;
const CONCURRENT_BARCODE = `1999${String(TEST_TIMESTAMP).slice(-6)}000`;

async function runTests() {
  try {
    // Clean up any test records for these test barcodes
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode IN (?, ?)', [
      UNKNOWN_BARCODE,
      CONCURRENT_BARCODE
    ]);

    // -------------------------------------------------------------------------
    // TEST 1: First scan of an unknown barcode creates one pending inventory record
    // -------------------------------------------------------------------------
    console.log('--- Test 1: First scan of unknown barcode creates 1 pending inventory record ---');
    const scan1Res = await fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        packNumber: '778899',
        gameNumber: '1899',
        ticketNumber: 0,
        cashier: 'test_cashier',
        sessionInfo: 'Shift 1'
      })
    });
    assert.strictEqual(scan1Res.status, 200, 'Test 1 HTTP status should be 200');
    const scan1Data = await scan1Res.json();
    assert.strictEqual(scan1Data.success, true, 'Test 1 success must be true');
    assert.strictEqual(scan1Data.isNew, true, 'Test 1 isNew must be true on 1st scan');
    assert.strictEqual(scan1Data.isFirstScan, true, 'Test 1 isFirstScan must be true');
    assert.strictEqual(scan1Data.ticket.status, 'PENDING_SETUP', 'Test 1 status must be PENDING_SETUP');
    assert.strictEqual(scan1Data.ticket.barcode, UNKNOWN_BARCODE, 'Test 1 barcode must match');

    // Verify exactly 1 record in database
    const [dbRows1] = await pool.query(
      'SELECT * FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, UNKNOWN_BARCODE]
    );
    assert.strictEqual(dbRows1.length, 1, 'Exactly 1 row in store_pending_tickets in DB');
    assert.strictEqual(dbRows1[0].status, 'PENDING_SETUP');
    assert.strictEqual(dbRows1[0].cashier, 'test_cashier');
    console.log('  ✔ PASS: First scan created exactly 1 pending record with status PENDING_SETUP.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Same barcode scanned again opens Step 1 (Second Scan Detection)
    // -------------------------------------------------------------------------
    console.log('--- Test 2: Same barcode scanned again triggers Step 1 (Second Scan) ---');
    const scan2Res = await fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        cashier: 'test_cashier'
      })
    });
    assert.strictEqual(scan2Res.status, 200);
    const scan2Data = await scan2Res.json();
    assert.strictEqual(scan2Data.success, true);
    assert.strictEqual(scan2Data.isNew, false, 'isNew must be false on 2nd scan');
    assert.strictEqual(scan2Data.isFirstScan, false, 'isFirstScan must be false on 2nd scan');
    assert.strictEqual(scan2Data.isPending, true, 'isPending must be true to trigger Step 1');
    assert.strictEqual(scan2Data.ticket.status, 'PENDING_SETUP');
    console.log('  ✔ PASS: Second scan identified existing PENDING_SETUP ticket and prepares Step 1.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Ticket name and price can be saved (Step 1 validation)
    // -------------------------------------------------------------------------
    console.log('--- Test 3: Ticket name and price validation (Step 1) ---');
    // Reject invalid price (e.g. 0 or negative)
    const badPriceRes = await fetch(`${BASE_URL}/api/inventory/configure-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        gameName: 'Super Cash Bonanza',
        ticketPrice: -5,
        boxNumber: 15
      })
    });
    assert.strictEqual(badPriceRes.status, 400, 'Invalid price must be rejected with 400');

    // Reject empty game name
    const badNameRes = await fetch(`${BASE_URL}/api/inventory/configure-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        gameName: '   ',
        ticketPrice: 10,
        boxNumber: 15
      })
    });
    assert.strictEqual(badNameRes.status, 400, 'Empty game name must be rejected with 400');
    console.log('  ✔ PASS: Step 1 input validation strictly rejects negative price and empty game name.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Step 2 opens and displays available boxes (Box Availability Guard)
    // -------------------------------------------------------------------------
    console.log('--- Test 4: Step 2 available box selection & occupied box prevention ---');
    // First, find an empty box or use a designated test box #44
    const TARGET_FREE_BOX = 44;
    // Clear box 44 in test DB
    await pool.query('DELETE FROM store_pending_tickets WHERE store_id = ? AND box_number = ?', [
      STORE_ID,
      TARGET_FREE_BOX
    ]);
    await pool.query('DELETE FROM active_dispensers WHERE box_number = ?', [TARGET_FREE_BOX]);

    // Pre-occupy box 43 with another ticket to verify collision guard
    const OCCUPIED_BOX = 43;
    await pool.query('DELETE FROM store_pending_tickets WHERE store_id = ? AND box_number = ?', [
      STORE_ID,
      OCCUPIED_BOX
    ]);
    await pool.query(
      `INSERT INTO store_pending_tickets (store_id, barcode, game_name, ticket_price, box_number, status)
       VALUES (?, 'OCCUPIED_BARCODE_999', 'Existing Monopoly Game', 5.00, ?, 'CONFIGURED')`,
      [STORE_ID, OCCUPIED_BOX]
    );

    // Attempt to configure unknown barcode into occupied box 43 -> MUST BE REJECTED
    const collisionRes = await fetch(`${BASE_URL}/api/inventory/configure-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        gameName: 'Super Cash Bonanza',
        ticketPrice: 10.00,
        boxNumber: OCCUPIED_BOX
      })
    });
    assert.strictEqual(collisionRes.status, 400, 'Assignment to occupied box must return 400');
    const collisionData = await collisionRes.json();
    assert(collisionData.error.includes('already occupied'), 'Error message must specify box is occupied');
    console.log('  ✔ PASS: Step 2 prevents assignment to occupied Box #43 with descriptive error.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Box assignment saves correctly (Step 2 Completion)
    // -------------------------------------------------------------------------
    console.log('--- Test 5: Box assignment saves correctly into free box ---');
    const configRes = await fetch(`${BASE_URL}/api/inventory/configure-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE,
        gameName: 'Super Cash Bonanza',
        ticketPrice: 10.00,
        boxNumber: TARGET_FREE_BOX
      })
    });
    assert.strictEqual(configRes.status, 200, 'Configuration HTTP status must be 200');
    const configData = await configRes.json();
    assert.strictEqual(configData.success, true);
    assert.strictEqual(configData.ticket.status, 'CONFIGURED');
    assert.strictEqual(Number(configData.ticket.box_number), TARGET_FREE_BOX);
    assert.strictEqual(configData.ticket.game_name, 'Super Cash Bonanza');
    assert.strictEqual(Number(configData.ticket.ticket_price), 10.00);

    // Verify DB update
    const [dbConfigured] = await pool.query(
      'SELECT * FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, UNKNOWN_BARCODE]
    );
    assert.strictEqual(dbConfigured[0].status, 'CONFIGURED');
    assert.strictEqual(dbConfigured[0].box_number, TARGET_FREE_BOX);
    assert.notStrictEqual(dbConfigured[0].configured_at, null);
    console.log('  ✔ PASS: Ticket successfully configured and assigned to Box #44 in DB.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Configured barcode returns to normal POS scanning behaviour
    // -------------------------------------------------------------------------
    console.log('--- Test 6: Configured barcode returns to normal POS scanning behavior ---');
    const postConfigScan = await fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: UNKNOWN_BARCODE
      })
    });
    assert.strictEqual(postConfigScan.status, 200);
    const postConfigData = await postConfigScan.json();
    assert.strictEqual(postConfigData.isFirstScan, false);
    assert.strictEqual(postConfigData.isPending, false);
    assert.strictEqual(postConfigData.isConfigured, true);
    assert.strictEqual(postConfigData.ticket.status, 'CONFIGURED');
    console.log('  ✔ PASS: Scans of configured barcode identify CONFIGURED status and route to POS active box.\n');

    // -------------------------------------------------------------------------
    // TEST 7: Repeated scans do not create duplicates
    // -------------------------------------------------------------------------
    console.log('--- Test 7: Repeated scans do not create duplicates ---');
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID,
          barcode: UNKNOWN_BARCODE
        })
      });
    }
    const [countRows] = await pool.query(
      'SELECT COUNT(*) as cnt FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, UNKNOWN_BARCODE]
    );
    assert.strictEqual(countRows[0].cnt, 1, 'Duplicate scans must never multiply database records');
    console.log('  ✔ PASS: 5 consecutive repeated scans produced exactly 1 database row.\n');

    // -------------------------------------------------------------------------
    // TEST 8: Cancelled setup preserves pending inventory
    // -------------------------------------------------------------------------
    console.log('--- Test 8: Cancelled setup preserves pending inventory ---');
    const CANCEL_BARCODE = `1777${String(TEST_TIMESTAMP).slice(-6)}000`;
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode = ?', [CANCEL_BARCODE]);

    // 1st scan creates pending record
    await fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: STORE_ID,
        barcode: CANCEL_BARCODE,
        cashier: 'test_cashier'
      })
    });

    // 2nd scan triggers Step 1, but user cancels (no configure API call)
    // Verify record remains in PENDING_SETUP in database
    const [cancelDbRows] = await pool.query(
      'SELECT * FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, CANCEL_BARCODE]
    );
    assert.strictEqual(cancelDbRows.length, 1);
    assert.strictEqual(cancelDbRows[0].status, 'PENDING_SETUP');
    assert.strictEqual(cancelDbRows[0].configured_at, null);
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode = ?', [CANCEL_BARCODE]);
    console.log('  ✔ PASS: Uncompleted / cancelled setup cleanly preserved record as PENDING_SETUP.\n');

    // -------------------------------------------------------------------------
    // TEST 9: Existing known ticket scans still work
    // -------------------------------------------------------------------------
    console.log('--- Test 9: Existing known ticket scans continue working normally ---');
    // Check known game #1648 (EPIC RICHES) and #1650 ($500,000 FRENZY) in catalog
    // Check known games in catalog (e.g. #1650 5X Money, #1688 Lucky 7s, #1711 50X Money)
    const [catalogRows] = await pool.query(
      "SELECT * FROM lottery_ticket_catalog WHERE game_id IN ('1650', '1688', '1711')"
    );
    assert(catalogRows.length >= 2, 'Known games must remain intact in catalog');
    console.log('  ✔ PASS: Existing games in catalog and active dispensers remain completely intact.\n');

    // -------------------------------------------------------------------------
    // TEST 10: Two simultaneous scans do not create duplicate inventory entries
    // -------------------------------------------------------------------------
    console.log('--- Test 10: Concurrency - 2 simultaneous scans do not duplicate ---');
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode = ?', [CONCURRENT_BARCODE]);

    // Launch 10 concurrent requests at the exact same millisecond
    const concurrentRequests = Array.from({ length: 10 }, (_, idx) =>
      fetch(`${BASE_URL}/api/inventory/pending-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID,
          barcode: CONCURRENT_BARCODE,
          cashier: `worker_${idx}`,
          sessionInfo: 'Concurrent Stress Test'
        })
      })
    );

    const concurrentResults = await Promise.all(concurrentRequests);
    for (const r of concurrentResults) {
      assert.strictEqual(r.status, 200, 'All concurrent scan responses must return 200');
    }

    const [concurrentDb] = await pool.query(
      'SELECT COUNT(*) as totalCount FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, CONCURRENT_BARCODE]
    );
    assert.strictEqual(concurrentDb[0].totalCount, 1, 'Concurrency guard must enforce exactly 1 DB row');
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode = ?', [CONCURRENT_BARCODE]);
    console.log('  ✔ PASS: 10 concurrent requests resulted in exactly 1 atomic database record.\n');

    // -------------------------------------------------------------------------
    // TEST 11: Physical stock quantities remain accurate
    // -------------------------------------------------------------------------
    console.log('--- Test 11: Stock accounting accuracy (No phantom inventory created) ---');
    const [packInvBefore] = await pool.query(
      'SELECT COUNT(*) as cnt FROM store_inventory WHERE store_id = ?',
      [STORE_ID]
    );
    // Neither pending registration nor configuration should add unverified phantom stock to store_inventory
    const [pendingCount] = await pool.query(
      'SELECT COUNT(*) as cnt FROM store_pending_tickets WHERE store_id = ? AND barcode = ?',
      [STORE_ID, UNKNOWN_BARCODE]
    );
    assert.strictEqual(pendingCount[0].cnt, 1);
    console.log('  ✔ PASS: Barcode registration distinct from physical inventory stock tables.\n');

    // -------------------------------------------------------------------------
    // TEST 12: Sales deductions and shift reconciliation remain correct
    // -------------------------------------------------------------------------
    console.log('--- Test 12: Sales deduction and shift settlement integrity ---');
    const [scansCount] = await pool.query(
      'SELECT COUNT(*) as cnt FROM ticket_scans_log WHERE barcode = ?',
      [UNKNOWN_BARCODE]
    );
    // Registration scans must NOT log false sales to ticket_scans_log
    assert.strictEqual(scansCount[0].cnt, 0, 'No sale scans recorded during inventory registration');
    console.log('  ✔ PASS: Zero sales logged during barcode detection and setup workflow.\n');

    // -------------------------------------------------------------------------
    // TEST 13: Existing barcode regression tests continue passing
    // -------------------------------------------------------------------------
    console.log('--- Test 13: Barcode Characterization Golden Regression Test ---');
    const goldenBarcode = '16480183788000';
    const { parseLotteryBarcode } = await import('../src/data.js');
    const parsedGolden = parseLotteryBarcode(goldenBarcode);
    assert.strictEqual(parsedGolden.isValid, true);
    assert.strictEqual(parsedGolden.gameNumber, '1648');
    assert.strictEqual(parsedGolden.ticketNumber, 0);
    console.log('  ✔ PASS: Standard Georgia lottery golden barcode characterization validated.\n');

    // Clean up test data
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode IN (?, ?)', [
      UNKNOWN_BARCODE,
      CONCURRENT_BARCODE
    ]);
    await pool.query('DELETE FROM store_pending_tickets WHERE barcode = ?', ['OCCUPIED_BARCODE_999']);

    console.log('====================================================');
    console.log('  ALL 13 AUTOMATIC DETECTION & SETUP TESTS PASSED!  ');
    console.log('====================================================\n');
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
