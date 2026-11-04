import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9795;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('   BOX 2 COUNTING & AUDIT SCAN MESSAGE VERIFICATION ');
  console.log('====================================================\n');

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

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-box2-test-'));

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

    // Setup initial state: 65 boxes, Box 1 active (215->217, 2 sold), Box 2 active (start 82, current 82, 0 sold)
    await evalCode(`
      localStorage.clear();
      if (window.state) {
        window.state.shiftStatus = 'IN_PROGRESS';
        window.state.shiftNumber = 1;
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
        window.state.slots[0] = {
          boxNumber: 1,
          gameName: '5X Money',
          price: 1,
          packNumber: '0618145',
          packSize: 300,
          startTicket: 215,
          currentTicket: 217,
          ticketsSold: 2,
          status: 'ACTIVE',
          activatedThisShift: true
        };
        window.state.slots[1] = {
          boxNumber: 2,
          gameName: '10X Money',
          price: 2,
          packNumber: '0996564',
          packSize: 150,
          startTicket: 82,
          currentTicket: 82,
          ticketsSold: 0,
          status: 'ACTIVE',
          activatedThisShift: true
        };
        window.saveState(window.state);
        window.renderDispenserRack();
        window.renderHeaderAndMetrics();
      }
    `);

    console.log('--- Test Group 1: Scanning Active Ticket During Shift ---');
    const scanResult = await evalCode(`
      (() => {
        window.processScannedBarcode('14180996564081068');
        
        const toastEl = document.querySelector('.toast, #toastContainer .toast-item, .scan-toast');
        const toastText = toastEl ? toastEl.textContent : '';
        const b2 = window.state.slots.find(s => s.boxNumber === 2);
        const card2 = document.querySelector('.box-card[data-box="2"]');
        const cardBottomNum = card2 ? card2.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        const todayKpi = document.querySelector('#metricSalesToday, [data-metric="today"]')?.textContent?.trim() || '';
        return {
          toastText,
          startTicket: b2.startTicket,
          currentTicket: b2.currentTicket,
          ticketsSold: b2.ticketsSold,
          soldCount: window.calculateSlotSoldTickets(b2),
          cardBottomNum,
          todayKpi,
          action: window.state.lastScanData?.action
        };
      })()
    `);

    assert(scanResult.currentTicket === 82, `Box 2 currentTicket remained at 82 and did NOT change during shift (got ${scanResult.currentTicket})`);
    assert(scanResult.ticketsSold === 0, `Box 2 ticketsSold is 0 during shift (got ${scanResult.ticketsSold})`);
    assert(scanResult.soldCount === 0, `calculateSlotSoldTickets returns 0 during shift (got ${scanResult.soldCount})`);
    assert(scanResult.cardBottomNum === '0', `Box 2 card bottom displays 0 during shift (got "${scanResult.cardBottomNum}")`);
    assert(!scanResult.toastText.includes('Sold 1x'), `Toast does NOT say "Sold 1x" (toast: "${scanResult.toastText}")`);
    assert(scanResult.toastText.includes('already activated') || scanResult.toastText.includes('Box #2'), `Toast confirms ticket was already activated in Box #2 (toast: "${scanResult.toastText}")`);
    assert(scanResult.action === 'ACTIVE_BOX', `Scan action is ACTIVE_BOX info (got ${scanResult.action})`);

    console.log('\n--- Test Group 2: End Shift Scanning for Box 2 ---');
    await evalCode(`
      const endBtn = document.getElementById('mainShiftActionBtn');
      if (endBtn) endBtn.click();
    `);
    await sleep(500);

    const endShiftStatus = await evalCode(`window.state.shiftStatus`);
    assert(endShiftStatus === 'SCANNING_END_SHIFT', `Shift status transitioned to SCANNING_END_SHIFT (got ${endShiftStatus})`);

    // Reset Box 2 closing ticket to test scanning in SCANNING_END_SHIFT mode
    await evalCode(`
      const b2 = window.state.slots.find(s => s.boxNumber === 2);
      b2.scannedInEndShift = false;
      b2.currentTicket = 82;
      b2.ticketsSold = 0;
      window.renderDispenserRack();
    `);

    // Cashier scans closing ticket 081 (series PIN 068) for Box 2
    const endScanResult = await evalCode(`
      (() => {
        window.processScannedBarcode('14180996564081068');

        const b2 = window.state.slots.find(s => s.boxNumber === 2);
        const card2 = document.querySelector('.box-card[data-box="2"]');
        const cardText = card2 ? card2.textContent : '';
        return {
          scannedInEndShift: b2.scannedInEndShift,
          currentTicket: b2.currentTicket,
          ticketsSold: b2.ticketsSold,
          calculatedSold: window.calculateSlotSoldTickets(b2),
          cardText
        };
      })()
    `);

    assert(endScanResult.scannedInEndShift === true, `Box 2 marked as verified in End Shift`);
    assert(endScanResult.currentTicket === 81, `Box 2 closing ticket is 81 (got ${endScanResult.currentTicket})`);
    assert(endScanResult.ticketsSold === 1, `Box 2 ticketsSold is 1 (got ${endScanResult.ticketsSold})`);
    assert(endScanResult.calculatedSold === 1, `calculateSlotSoldTickets returns 1 for Box 2`);
    assert(endScanResult.cardText.includes('1'), `Dispenser card displays 1 sold`);

    console.log('\n--- Test Group 3: Ascending & Descending Counting Invariance ---');
    const countingCases = await evalCode(`
      (() => {
        const results = [];
        // Case 1: Start 0, Current 10
        const s1 = { startTicket: 0, currentTicket: 10, packSize: 100, price: 2 };
        results.push({ name: '0 -> 10', sold: window.calculateSlotSoldTickets(s1), expected: 10 });

        // Case 2: Start 100, Current 95
        const s2 = { startTicket: 100, currentTicket: 95, packSize: 100, price: 2 };
        results.push({ name: '100 -> 95', sold: window.calculateSlotSoldTickets(s2), expected: 5 });

        // Case 3: Start 67, Current 68
        const s3 = { startTicket: 67, currentTicket: 68, packSize: 150, price: 2 };
        results.push({ name: '67 -> 68', sold: window.calculateSlotSoldTickets(s3), expected: 1 });

        // Case 4: Start 82, Current 81
        const s4 = { startTicket: 82, currentTicket: 81, packSize: 150, price: 2 };
        results.push({ name: '82 -> 81', sold: window.calculateSlotSoldTickets(s4), expected: 1 });

        // Case 5: Start 150, Current 149
        const s5 = { startTicket: 150, currentTicket: 149, packSize: 150, price: 2 };
        results.push({ name: '150 -> 149', sold: window.calculateSlotSoldTickets(s5), expected: 1 });

        return results;
      })()
    `);

    countingCases.forEach(c => {
      assert(c.sold === c.expected, `Slot counting ${c.name} produces ${c.expected} sold (got ${c.sold})`);
    });

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    p.kill('SIGTERM');
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
