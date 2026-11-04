import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9797;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('================================================================');
  console.log('   SHIFT #2 DISPLAY COUNT & END SHIFT REJECTION VERIFICATION     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-shift2-test-'));

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/?bypass_login=1'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        targets = await res.json();
        break;
      } catch (e) {
        await sleep(250);
      }
    }

    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      if (pending.has(data.id)) {
        pending.get(data.id)(data.result);
        pending.delete(data.id);
      }
    };

    await new Promise(r => ws.onopen = r);

    async function send(method, params = {}) {
      const id = msgId++;
      return new Promise(resolve => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res?.exceptionDetails) {
        console.error('EVAL ERROR:', res.exceptionDetails.exception?.description || res.exceptionDetails);
      }
      return res?.result?.value;
    }

    await sleep(2500);
    for (let i = 0; i < 20; i++) {
      const ready = await evalCode(`typeof window.processScannedBarcode === 'function'`);
      if (ready) break;
      await sleep(300);
    }

    console.log('--- Test Group 1: Shift #2 In-Progress Card Display ---');
    // Set up state where Shift #1 closed with sold counts (Box 10: 135 sold, Box 3: 81 sold)
    // Then Shift #2 started.
    await evalCode(`
      localStorage.clear();
      if (window.state) {
        window.state.shiftStatus = 'IN_PROGRESS';
        window.state.shiftNumber = 2;
        window.state.slots = [];
        for (let i = 1; i <= 65; i++) {
          window.state.slots.push({
            boxNumber: i,
            gameName: '',
            price: null,
            packNumber: '',
            packSize: 100,
            startTicket: 0,
            currentTicket: 0,
            ticketsSold: 0,
            status: 'EMPTY',
            activatedThisShift: false
          });
        }
        // Box 10: $30 game, previousShiftSold = 135, startTicket = 135, currentTicket = 135, ticketsSold = 0
        window.state.slots[9] = {
          boxNumber: 10,
          gameName: '1M CASH VAULT.',
          price: 30,
          packNumber: '0093468',
          barcodePrefix: '1465',
          packSize: 150,
          startTicket: 135,
          currentTicket: 135,
          ticketsSold: 0,
          previousShiftSold: 135,
          status: 'ACTIVE',
          activatedThisShift: false
        };
        // Box 3: $50 game, previousShiftSold = 81, startTicket = 81, currentTicket = 81, ticketsSold = 0
        window.state.slots[2] = {
          boxNumber: 3,
          gameName: '$50 Millionaire',
          price: 50,
          packNumber: '0996564',
          packSize: 20,
          startTicket: 81,
          currentTicket: 81,
          ticketsSold: 0,
          previousShiftSold: 81,
          status: 'ACTIVE',
          activatedThisShift: false
        };
        window.state.visibleBoxNumbers = [10, 3];
        window.saveState(window.state);
        window.renderDispenserRack();
        window.renderHeaderAndMetrics();
      }
    `);

    const shift2Display = await evalCode(`
      (() => {
        const card10 = document.querySelector('.box-card[data-box="10"]');
        const count10 = card10 ? card10.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        const card3 = document.querySelector('.box-card[data-box="3"]');
        const count3 = card3 ? card3.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        const totals = window.getShiftSalesTotals();
        return {
          count10,
          count3,
          totalSold: totals.totalSold,
          totalRevenue: totals.totalRevenue
        };
      })()
    `);

    assert(shift2Display.count10 === '0', `Box 10 card bottom displays 0 in Shift #2 (NOT 135) (got "${shift2Display.count10}")`);
    assert(shift2Display.count3 === '0', `Box 3 card bottom displays 0 in Shift #2 (NOT 81) (got "${shift2Display.count3}")`);
    assert(shift2Display.totalSold === 0, `getShiftSalesTotals totalSold is 0 in newly started Shift #2 (got ${shift2Display.totalSold})`);
    assert(shift2Display.totalRevenue === 0, `getShiftSalesTotals totalRevenue is 0 in newly started Shift #2 (got ${shift2Display.totalRevenue})`);

    console.log('\n--- Test Group 2: End Shift Scanning Rejects Different Pack ---');
    // Transition to SCANNING_END_SHIFT
    await evalCode(`
      const endBtn = document.getElementById('mainShiftActionBtn');
      if (endBtn) endBtn.click();
    `);
    await sleep(400);

    const shiftStatus = await evalCode(`window.state.shiftStatus`);
    assert(shiftStatus === 'SCANNING_END_SHIFT', `Shift status transitioned to SCANNING_END_SHIFT (got "${shiftStatus}")`);

    // Scan a ticket that has the same Georgia game (1465) but a DIFFERENT pack number (e.g. 0099999 vs 0093468)
    const rejectResult = await evalCode(`
      (() => {
        // Continuous 14-digit Georgia barcode: Game 1465, Pack 0099999 (different pack), Ticket 010
        window.processScannedBarcode('14650099999010');
        
        const toastEl = document.querySelector('.toast, #toastContainer .toast-item, .scan-toast');
        const toastText = toastEl ? toastEl.textContent : '';
        const b10 = window.state.slots.find(s => s.boxNumber === 10);
        const card10 = document.querySelector('.box-card[data-box="10"]');
        const card10Scanned = card10 ? card10.classList.contains('scanned-done') : false;
        const totals = window.getShiftSalesTotals();

        return {
          toastText,
          b10Scanned: b10.scannedInEndShift,
          card10Scanned,
          b10Sold: b10.ticketsSold,
          totalSold: totals.totalSold
        };
      })()
    `);

    assert(rejectResult.b10Scanned === false, `Box 10 is NOT marked scanned after scanning different pack (got false)`);
    assert(rejectResult.card10Scanned === false, `Box 10 card does NOT have scanned-done class after scanning different pack`);
    assert(rejectResult.b10Sold === 0, `Box 10 ticketsSold remains 0 after scanning different pack (got ${rejectResult.b10Sold})`);
    assert(rejectResult.totalSold === 0, `totalSold remains 0 after rejected scan (got ${rejectResult.totalSold})`);

    console.log('\n--- Test Group 3: End Shift Scanning Accepts Exact Pack ---');
    // Now scan closing ticket for Box 10: Game 1465, Pack 0093468, Ticket 130 (5 tickets sold from 135)
    const acceptResult = await evalCode(`
      (() => {
        window.processScannedBarcode('14650093468130');

        const b10 = window.state.slots.find(s => s.boxNumber === 10);
        const card10 = document.querySelector('.box-card[data-box="10"]');
        const card10Count = card10 ? card10.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        const totals = window.getShiftSalesTotals();

        return {
          b10Scanned: b10.scannedInEndShift,
          b10CurrentTicket: b10.currentTicket,
          b10Sold: b10.ticketsSold,
          card10Count,
          totalSold: totals.totalSold,
          totalRevenue: totals.totalRevenue
        };
      })()
    `);

    assert(acceptResult.b10Scanned === true, `Box 10 marked scanned when exact pack matches (got true)`);
    assert(acceptResult.b10CurrentTicket === 130, `Box 10 currentTicket updated to 130 (got ${acceptResult.b10CurrentTicket})`);
    assert(acceptResult.b10Sold === 5, `Box 10 ticketsSold is 5 (got ${acceptResult.b10Sold})`);
    assert(acceptResult.card10Count === '5', `Box 10 card displays 5 sold (got "${acceptResult.card10Count}")`);
    assert(acceptResult.totalSold === 5, `totalSold correctly reflects 5 sold (got ${acceptResult.totalSold})`);
    assert(acceptResult.totalRevenue === 150, `totalRevenue correctly reflects 5 * $30 = $150 (got $${acceptResult.totalRevenue})`);

    console.log('\n--- Test Group 4: Start Shift Clears Last Scan Banner ---');
    await evalCode(`
      // Confirm end shift
      window.state.shiftStatus = 'SHIFT_ENDED';
      window.executeStartNewShift('New Cashier', 100);
    `);
    await sleep(300);

    const shift3State = await evalCode(`
      (() => {
        const lastScanEl = document.querySelector('.dashboard-last-scan-card');
        const lastScanText = lastScanEl ? lastScanEl.textContent : '';
        const b10 = window.state.slots.find(s => s.boxNumber === 10);
        const card10 = document.querySelector('.box-card[data-box="10"]');
        const card10Count = card10 ? card10.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        return {
          shiftStatus: window.state.shiftStatus,
          shiftNumber: window.state.shiftNumber,
          lastScanData: window.state.lastScanData,
          b10StartTicket: b10.startTicket,
          b10CurrentTicket: b10.currentTicket,
          b10Sold: b10.ticketsSold,
          card10Count
        };
      })()
    `);

    assert(shift3State.shiftStatus === 'IN_PROGRESS', `Shift #3 started with status IN_PROGRESS (got "${shift3State.shiftStatus}")`);
    assert(shift3State.lastScanData === null, `Shift #3 cleared state.lastScanData (got null)`);
    assert(shift3State.b10StartTicket === 130, `Box 10 opening ticket carried over to 130 (got ${shift3State.b10StartTicket})`);
    assert(shift3State.b10Sold === 0, `Box 10 ticketsSold reset to 0 in Shift #3 (got ${shift3State.b10Sold})`);
    assert(shift3State.card10Count === '0', `Box 10 card displays 0 in Shift #3 (got "${shift3State.card10Count}")`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    p.kill('SIGTERM');
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
