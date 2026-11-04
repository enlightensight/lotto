// tests/test-sold-out-recovery-flow.mjs
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: PREVIOUSLY SOLD-OUT TICKET RECOVERY (15/15 REQUIREMENTS)');
console.log('================================================================\n');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9911;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-recovery-test-'));
  const chromeProcess = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'http://127.0.0.1:5173/'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
        targets = await res.json();
        break;
      } catch (_) {
        await sleep(200);
      }
    }

    const page = targets.find((t) => t.type === 'page');
    assert(Boolean(page), 'Chrome CDP page target found');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value || a.description || '').join(' ');
        if (data.params.type === 'error') {
          console.error('[BROWSER CONSOLE ERROR]:', text);
        } else {
          console.log('[BROWSER CONSOLE]:', text);
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]:', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
      }
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.result);
        callbacks.delete(data.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((r) => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Browser JS Exception:', res.exceptionDetails.text, res.exceptionDetails.exception?.description);
        throw new Error(`Browser JS Error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
      }
      return res.result ? res.result.value : undefined;
    }

    await sleep(1500);

    // Setup initial state:
    // Shift 1 sold 10 tickets of Pack 777001 ($5 Lucky 7s, packSize 60).
    // Pack 777001 was marked SOLD_OUT in Shift 1.
    // Shift 1 ended. Now currently in Shift 2, where Box 1 is EMPTY.
    console.log('\n--- Setting up Shift 1 with Sold-Out Pack 777001 ---');
    await evaluate(`
      (() => {
        const now = new Date();
        const shift1Start = new Date(now.getTime() - 7200000).toISOString();
        const shift1End = new Date(now.getTime() - 3600000).toISOString();

        state.shiftNumber = 2;
        state.shiftStatus = 'IN_PROGRESS';
        state.shiftStartedAt = new Date(now.getTime() - 3000000).toISOString();
        state.soldOutThisShift = [];

        // Box 1 is empty in current shift
        state.slots = state.slots || [];
        let slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        if (!slot1) {
          slot1 = { boxNumber: 1, status: 'EMPTY' };
          state.slots.push(slot1);
        } else {
          slot1.status = 'EMPTY';
          slot1.packNumber = null;
          slot1.gameName = null;
          slot1.ticketsSold = 0;
          slot1.startTicket = 0;
          slot1.currentTicket = 0;
        }

        // Shift 1 history has Pack 777001 as SOLD_OUT
        state.shiftHistory = [
          {
            shiftNumber: 1,
            startedAt: shift1Start,
            endedAt: shift1End,
            totalTicketsSold: 10,
            totalSalesRevenue: 50,
            soldOutSnapshot: [
              {
                boxNumber: 1,
                packNumber: '777001',
                gameName: 'Lucky 7s',
                price: 5,
                packSize: 60,
                startTicket: 0,
                closeTicket: 10,
                packStartTicket: 0,
                packCumulativeSold: 10,
                ticketsSold: 10,
                salesAmount: 50
              }
            ],
            slotsSnapshot: []
          }
        ];

        saveState(state);
        renderHeaderAndMetrics();
        renderDispenserRack();
      })()
    `);

    // =========================================================================
    // TEST 1: Previously sold-out pack scanned in a new shift -> Confirmation modal appears
    // =========================================================================
    console.log('\n--- Test 1: Scan previously sold-out pack in new shift ---');
    const t1Result = await evaluate(`
      (() => {
        // Barcode for Lucky 7s (game 1688), pack 777001, ticket 010
        const testBarcode = '1688777001010';
        processScannedBarcode(testBarcode);

        const modal = document.getElementById('updateSoldOutTicketModal');
        const header = document.getElementById('soldOutGameHeader')?.textContent || '';
        const notice = document.getElementById('soldOutModalNotice')?.textContent || '';
        const question = document.getElementById('soldOutModalQuestion')?.textContent || '';
        return {
          isOpen: Boolean(modal && modal.open),
          header,
          notice,
          question
        };
      })()
    `);

    assert(t1Result.isOpen, 'Test 1: Confirmation modal updateSoldOutTicketModal opened');
    assert(t1Result.notice.includes('sold out in previous shift'), `Test 1: Notice displays "sold out in previous shift" (got "${t1Result.notice}")`);
    assert(t1Result.question.includes('Do you want to add this Ticket back into New Shift?'), `Test 1: Question matches requirement (got "${t1Result.question}")`);

    // =========================================================================
    // TEST 2: User chooses No — no changes
    // =========================================================================
    console.log('\n--- Test 2: User chooses No — no changes ---');
    const t2Result = await evaluate(`
      (() => {
        const noBtn = document.getElementById('btnSoldOutNo');
        noBtn?.click();

        const modal = document.getElementById('updateSoldOutTicketModal');
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        const shift1 = state.shiftHistory[0];

        return {
          isOpen: Boolean(modal && modal.open),
          slot1Status: slot1?.status,
          slot1Pack: slot1?.packNumber,
          shift1Sold: shift1?.soldOutSnapshot?.[0]?.ticketsSold
        };
      })()
    `);

    assert(!t2Result.isOpen, 'Test 2: Confirmation dialog closed on No');
    assert(t2Result.slot1Status === 'EMPTY', 'Test 2: Slot 1 remains EMPTY (no changes)');
    assert(!t2Result.slot1Pack, 'Test 2: Slot 1 has no pack assigned');
    assert(t2Result.shift1Sold === 10, 'Test 2: Historical sold-out record preserved');

    // =========================================================================
    // TEST 3: User chooses Yes — correction dialog appears
    // =========================================================================
    console.log('\n--- Test 3: User chooses Yes — correction dialog appears ---');
    const t3Result = await evaluate(`
      (() => {
        // Scan again
        processScannedBarcode('1688777001010');

        // Click Yes / Fix on Phase 1
        const yesBtn = document.getElementById('btnSoldOutYes') || document.getElementById('btnSoldOutFix');
        yesBtn?.click();

        const fixModal = document.getElementById('fixTicketPositionModal');
        const fixName = document.getElementById('fixPosGameName')?.textContent || '';
        const fixScanned = document.getElementById('fixPosScannedPos')?.textContent || '';
        const inputVal = document.getElementById('inputFixTicketPosition')?.value;

        return {
          isFixModalOpen: Boolean(fixModal && fixModal.open),
          fixName,
          fixScanned,
          inputVal
        };
      })()
    `);

    assert(t3Result.isFixModalOpen, 'Test 3: Missed-ticket correction dialog fixTicketPositionModal opened');
    assert(t3Result.fixName.includes('Lucky 7s'), `Test 3: Correction dialog displays game name (got "${t3Result.fixName}")`);
    assert(t3Result.fixScanned.includes('010'), `Test 3: Correction dialog displays scanned position 010 (got "${t3Result.fixScanned}")`);

    // =========================================================================
    // TEST 4: User cancels correction — no changes
    // =========================================================================
    console.log('\n--- Test 4: User cancels correction — no changes ---');
    const t4Result = await evaluate(`
      (() => {
        const cancelBtn = document.getElementById('btnCancelFixTicketPos');
        cancelBtn?.click();

        const fixModal = document.getElementById('fixTicketPositionModal');
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);

        return {
          isOpen: Boolean(fixModal && fixModal.open),
          slot1Status: slot1?.status
        };
      })()
    `);

    assert(!t4Result.isOpen, 'Test 4: Correction dialog closed on Cancel');
    assert(t4Result.slot1Status === 'EMPTY', 'Test 4: Slot 1 remains EMPTY (no changes upon cancel)');

    // =========================================================================
    // TEST 5 & 6: User corrects position and presses Fix -> Existing box-assignment screen appears
    // =========================================================================
    console.log('\n--- Test 5 & 6: User corrects position, presses Fix -> Box assignment screen appears ---');
    const t5Result = await evaluate(`
      (() => {
        // Scan again, click Yes to open Phase 2
        processScannedBarcode('1688777001010');
        const yesBtn = document.getElementById('btnSoldOutYes') || document.getElementById('btnSoldOutFix');
        yesBtn?.click();

        // Enter corrected position: 10
        const input = document.getElementById('inputFixTicketPosition');
        input.value = '10';

        // Press Fix
        const fixBtn = document.getElementById('btnConfirmFixTicketPos');
        fixBtn?.click();

        const setBoxModal = document.getElementById('setBoxModal');
        const fixModal = document.getElementById('fixTicketPositionModal');

        return {
          isFixModalOpen: Boolean(fixModal && fixModal.open),
          isSetBoxOpen: Boolean(setBoxModal && setBoxModal.open),
          auditRecorded: (state.auditTrail || []).some(a => a.action === 'SOLD_OUT_RECOVERY_CORRECTION')
        };
      })()
    `);

    assert(!t5Result.isFixModalOpen, 'Test 5: Fix modal closed after confirming position');
    assert(t5Result.auditRecorded, 'Test 5: Position correction recorded in audit trail');
    assert(t5Result.isSetBoxOpen, 'Test 6: Existing Assign Ticket to Box modal (setBoxModal) opened');

    // =========================================================================
    // TEST 7 & 8: User assigns item to Box 1 -> Recovered pack appears in Box 1
    // =========================================================================
    console.log('\n--- Test 7 & 8: User assigns item to Box 1 ---');
    const t7Result = await evaluate(`
      (() => {
        const boxInput = document.getElementById('setBoxNumberInput');
        if (boxInput) boxInput.value = '1';

        const confirmBtn = document.getElementById('btnSetBoxConfirm') || document.querySelector('.setbox-key-enter');
        if (confirmBtn) {
          confirmBtn.click();
        } else {
          confirmSetBoxForTicket(false);
        }

        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        const setBoxModal = document.getElementById('setBoxModal');

        return {
          isSetBoxOpen: Boolean(setBoxModal && setBoxModal.open),
          slot1Status: slot1?.status,
          slot1Pack: slot1?.packNumber,
          slot1Start: slot1?.startTicket,
          slot1Current: slot1?.currentTicket
        };
      })()
    `);

    assert(t7Result.slot1Status === 'ACTIVE', 'Test 7: Box 1 status is ACTIVE');
    assert(t7Result.slot1Pack === '777001', 'Test 8: Recovered pack 777001 appears in Box 1');
    assert(t7Result.slot1Start === 10, 'Test 8: Box 1 opening position is 10');
    assert(t7Result.slot1Current === 10, 'Test 8: Box 1 current position is 10');

    // =========================================================================
    // TEST 9 & 10: Previous cumulative sales preserved & current shift sales start at zero
    // =========================================================================
    console.log('\n--- Test 9 & 10: Cumulative sales preserved & shift sales at 0 ---');
    const t9Result = await evaluate(`
      (() => {
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        const shiftSold = calculateSlotSoldTickets(slot1);
        const packCumulative = calculatePackCumulativeSold(slot1);

        return {
          shiftSold,
          slotRecordedSold: slot1?.ticketsSold,
          packCumulative,
          packCumulativeBase: slot1?.packCumulativeSoldBase
        };
      })()
    `);

    assert(t9Result.packCumulative === 10, `Test 9: Previous cumulative sales strictly preserved as 10 (got ${t9Result.packCumulative})`);
    assert(t9Result.shiftSold === 0, `Test 10: Current shift sales strictly start at 0 (got ${t9Result.shiftSold})`);
    assert(t9Result.slotRecordedSold === 0, `Test 10: Slot recorded ticketsSold is 0 (got ${t9Result.slotRecordedSold})`);

    // =========================================================================
    // TEST 11: New sales increase cumulative, shift, and daily counts correctly
    // =========================================================================
    console.log('\n--- Test 11: New sales increase counts correctly ---');
    const t11Result = await evaluate(`
      (() => {
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        // Simulate selling 5 tickets in Shift 2 (closing ticket advanced from 10 to 15)
        slot1.currentTicket = 15;
        slot1.ticketsSold = calculateSlotSoldTickets(slot1);

        const newShiftSold = calculateSlotSoldTickets(slot1);
        const newCumulative = calculatePackCumulativeSold(slot1);

        // Calculate today's sold across Shift 1 (10) + Shift 2 (5)
        const todaySold = (state.shiftHistory[0].totalTicketsSold || 0) + newShiftSold;

        return {
          newShiftSold,
          newCumulative,
          todaySold
        };
      })()
    `);

    assert(t11Result.newShiftSold === 5, `Test 11: Current shift sold is 5 (got ${t11Result.newShiftSold})`);
    assert(t11Result.newCumulative === 15, `Test 11: Pack cumulative sold advanced from 10 to 15 (got ${t11Result.newCumulative})`);
    assert(t11Result.todaySold === 15, `Test 11: Daily total includes completed Shift 1 (10) + current Shift 2 (5) = 15 (got ${t11Result.todaySold})`);

    // =========================================================================
    // TEST 12: Historical reports remain unchanged
    // =========================================================================
    console.log('\n--- Test 12: Historical reports remain unchanged ---');
    const t12Result = await evaluate(`
      (() => {
        const shift1 = state.shiftHistory[0];
        return {
          shift1Tickets: shift1.totalTicketsSold,
          shift1Revenue: shift1.totalSalesRevenue,
          shift1SnapshotSold: shift1.soldOutSnapshot[0].ticketsSold,
          shift1SnapshotClose: shift1.soldOutSnapshot[0].closeTicket
        };
      })()
    `);

    assert(t12Result.shift1Tickets === 10, `Test 12: Historical Shift 1 total tickets remains unchanged at 10 (got ${t12Result.shift1Tickets})`);
    assert(t12Result.shift1Revenue === 50, `Test 12: Historical Shift 1 revenue remains unchanged at $50 (got ${t12Result.shift1Revenue})`);
    assert(t12Result.shift1SnapshotSold === 10, 'Test 12: Historical soldOutSnapshot ticketsSold remains 10');
    assert(t12Result.shift1SnapshotClose === 10, 'Test 12: Historical soldOutSnapshot closeTicket remains 10');

    // =========================================================================
    // TEST 13: Duplicate active assignment is prevented
    // =========================================================================
    console.log('\n--- Test 13: Duplicate active assignment prevented ---');
    const t13Result = await evaluate(`
      (() => {
        // Attempt to assign the same pack 777001 to Box 2
        const result = handleSetBoxForTicket(2, '1688777001015', null, null, 'Lucky 7s', 5, 60, null);
        const slot2 = state.slots.find(s => Number(s.boxNumber) === 2);

        return {
          assignmentResult: result,
          slot2Status: slot2?.status,
          slot2Pack: slot2?.packNumber
        };
      })()
    `);

    assert(t13Result.assignmentResult === false, 'Test 13: Duplicate active assignment rejected with false');
    assert(t13Result.slot2Pack !== '777001', 'Test 13: Box 2 does not have duplicate pack 777001');

    // =========================================================================
    // TEST 14: Individual previously sold ticket cannot be sold twice
    // =========================================================================
    console.log('\n--- Test 14: Individual previously sold ticket cannot be sold twice ---');
    const t14Result = await evaluate(`
      (() => {
        // Ticket #005 was sold in Shift 1 (opening of Shift 2 is 10)
        // Scan ticket #005
        processScannedBarcode('1688777001005');

        const title = document.getElementById('scanActionTitle')?.textContent || '';
        const display = document.getElementById('lastScanDisplay')?.textContent || '';
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);

        return {
          title,
          display,
          slot1Sold: calculateSlotSoldTickets(slot1)
        };
      })()
    `);

    assert(t14Result.title.toLowerCase().includes('already sold'), `Test 14: Rejected with message that ticket was already sold (got "${t14Result.title}")`);
    assert(t14Result.display.includes('Cannot be sold again') || t14Result.display.includes('already sold'), `Test 14: Display explains ticket cannot be sold again (got "${t14Result.display}")`);
    assert(t14Result.slot1Sold === 5, 'Test 14: Sold count was not incremented by the duplicate ticket scan');

    // =========================================================================
    // TEST 15: Application restart preserves recovery and corrected position
    // =========================================================================
    console.log('\n--- Test 15: Application restart preserves recovery ---');
    // Save state to localStorage and immediate sync to DB before reloading
    await evaluate(`
      (async () => {
        saveState(state);
        if (window.syncPOSStateToDB) {
          await window.syncPOSStateToDB(state, true);
        }
      })()
    `);
    await sleep(800);

    // Reload page
    await send('Page.reload');
    await sleep(2000);

    const t15Result = await evaluate(`
      (() => {
        const slot1 = state.slots.find(s => Number(s.boxNumber) === 1);
        const cumulative = calculatePackCumulativeSold(slot1);
        return {
          status: slot1?.status,
          packNumber: slot1?.packNumber,
          startTicket: slot1?.startTicket,
          cumulativeBase: slot1?.packCumulativeSoldBase,
          cumulative
        };
      })()
    `);

    console.log('Restarted Slot 1 State:', t15Result);
    assert(t15Result.status === 'ACTIVE', 'Test 15: Box 1 remains ACTIVE after restart');
    assert(t15Result.packNumber === '777001', `Test 15: Pack 777001 preserved in Box 1 after restart (got ${t15Result.packNumber})`);
    assert(t15Result.startTicket === 10, `Test 15: Opening position preserved after restart (got ${t15Result.startTicket})`);
    assert(t15Result.cumulativeBase === 10, `Test 15: packCumulativeSoldBase preserved as 10 (got ${t15Result.cumulativeBase})`);

    console.log('\n================================================================');
    console.log(` ALL 15 RECOVERY TESTS PASSED: ${passed} / ${total}`);
    console.log('================================================================\n');

  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
