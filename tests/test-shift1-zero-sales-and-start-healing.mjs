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
  console.log('====================================================');
  console.log('   SHIFT #1 ZERO SALES & START HEALING VERIFICATION  ');
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

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-shift1-test-'));

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    'http://127.0.0.1:5173/?bypass_login=1'
  ], { stdio: 'ignore' });

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
      const ready = await evalCode(`typeof window.calculateSlotSoldTickets === 'function'`);
      if (ready) break;
      await sleep(300);
    }

    // Reset fresh state
    await evalCode(`
      localStorage.clear();
      window.location.href = 'http://127.0.0.1:5173/?bypass_login=1';
    `);
    await sleep(2500);

    for (let i = 0; i < 20; i++) {
      const ready = await evalCode(`typeof window.calculateSlotSoldTickets === 'function'`);
      if (ready) break;
      await sleep(300);
    }

    console.log('--- Test Group 1: calculateSlotSoldTickets Logic ---');
    // Box 3: start 199, current 199 -> 0
    const b3Exact = await evalCode(`window.calculateSlotSoldTickets({ boxNumber: 3, price: 1, packSize: 200, startTicket: 199, currentTicket: 199 })`);
    assert(b3Exact === 0, `Box 3 with start 199 and current 199 produces 0 sold (got ${b3Exact})`);

    // Box 3: start 0, current 199 on 200-pack -> healed to 0
    const b3Healed = await evalCode(`window.calculateSlotSoldTickets({ boxNumber: 3, price: 1, packSize: 200, startTicket: 0, currentTicket: 199 })`);
    assert(b3Healed === 0, `Box 3 with start 0 and current 199 on 200-pack heals to 0 sold (got ${b3Healed})`);

    // 300-pack start 0, current 299 -> 0
    const b1Healed = await evalCode(`window.calculateSlotSoldTickets({ boxNumber: 1, price: 1, packSize: 300, startTicket: 0, currentTicket: 299 })`);
    assert(b1Healed === 0, `300-pack with start 0 and current 299 produces 0 sold (got ${b1Healed})`);

    // 150-pack start 0, current 149 -> 0
    const b6Healed = await evalCode(`window.calculateSlotSoldTickets({ boxNumber: 6, price: 2, packSize: 150, startTicket: 0, currentTicket: 149 })`);
    assert(b6Healed === 0, `150-pack with start 0 and current 149 produces 0 sold (got ${b6Healed})`);

    // Screenshot 7 boxes when no sales took place
    const all7Zero = await evalCode(`
      (() => {
        const boxes = [
          { boxNumber: 1, price: 1, packSize: 300, startTicket: 13, currentTicket: 13 },
          { boxNumber: 2, price: 1, packSize: 300, startTicket: 9, currentTicket: 9 },
          { boxNumber: 3, price: 1, packSize: 200, startTicket: 199, currentTicket: 199 },
          { boxNumber: 4, price: 5, packSize: 60, startTicket: 11, currentTicket: 11 },
          { boxNumber: 5, price: 1, packSize: 300, startTicket: 0, currentTicket: 0 },
          { boxNumber: 6, price: 2, packSize: 150, startTicket: 4, currentTicket: 4 },
          { boxNumber: 7, price: 1, packSize: 300, startTicket: 4, currentTicket: 4 },
        ];
        return boxes.every(b => window.calculateSlotSoldTickets(b) === 0);
      })()
    `);
    assert(all7Zero === true, `All 7 dispenser boxes from screenshot calculate 0 sold when start === current`);

    console.log('\n--- Test Group 2: Default Starting Tickets on Reference Boxes ---');
    const refCheck = await evalCode(`
      (() => {
        const activeBoxes = window.state.slots.filter(s => s.status === 'ACTIVE' && s.packNumber);
        const mismatches = activeBoxes.filter(s => s.startTicket !== s.currentTicket);
        return {
          allEqual: mismatches.length === 0,
          mismatchCount: mismatches.length,
          activeCount: activeBoxes.length
        };
      })()
    `);
    assert(refCheck.allEqual === true, `All ${refCheck.activeCount} active boxes have startTicket strictly equal currentTicket at shift start`);

    console.log('\n--- Test Group 3: End Shift Scanning Workflow & UI Display ---');
    // Set Shift #1 to End Shift
    await evalCode(`
      window.state.shiftStatus = 'SCANNING_END_SHIFT';
      window.state.shiftNumber = 1;

      // Box 2 is active: game 1410 (Jr Jumbo), pack 074550, startTicket 9, currentTicket 9
      const s2 = window.state.slots.find(s => s.boxNumber === 2);
      if (s2) {
        s2.status = 'ACTIVE';
        s2.gameId = '1410';
        s2.packNumber = '074550';
        s2.barcodePrefix = '1410'; // Jr Jumbo
        s2.startTicket = 9;
        s2.currentTicket = 9;
        s2.ticketsSold = 0;
        s2.scannedInEndShift = false;
      }
      window.saveState(window.state);
      window.renderDispenserRack();
      window.renderHeaderAndMetrics();
    `);

    // Scan closing ticket 9 for Box 2 (1410 074550 009 012)
    const scanRes = await evalCode(`
      (() => {
        window.processScannedBarcode('1410074550009012');
        const s2 = window.state.slots.find(s => s.boxNumber === 2);
        const card2 = document.querySelector('.box-card[data-box="2"]');
        const countText = card2 ? card2.querySelector('.ticket-sold-count')?.textContent?.trim() : '';
        return {
          sold: s2.ticketsSold,
          currentTicket: s2.currentTicket,
          scannedInEndShift: s2.scannedInEndShift,
          countText
        };
      })()
    `);

    assert(scanRes.sold === 0, `Box 2 reports 0 sold in End Shift scan when closing ticket 9 is scanned (got ${scanRes.sold})`);
    assert(scanRes.currentTicket === 9, `Box 2 currentTicket is 9 (got ${scanRes.currentTicket})`);
    assert(scanRes.scannedInEndShift === true, `Box 2 is marked verified (scannedInEndShift = ${scanRes.scannedInEndShift})`);
    assert(scanRes.countText === '0', `Box 2 card shows 0 sold on UI (got "${scanRes.countText}")`);

    ws.close();
  } finally {
    p.kill();
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
