import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9798;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('================================================================');
  console.log('   IMAGE 3 KEYPAD, NOT IN BOX & INACTIVE INVENTORY TEST         ');
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

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-img3-test-'));

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

    console.log('--- Test 1: Inactive Metrics and List Quick View ---');
    const inactiveCheck = await evalCode(`
      (() => {
        // Add an in-stock pack not in any box
        window.state.inStockInventory = [
          { gameId: '1465', gameName: 'Cash Vault', packNumber: '778899', price: 20, currentTicket: 0, boxNumber: null }
        ];
        // Re-render header metrics
        if (typeof window.renderHeaderAndMetrics === 'function') {
          window.renderHeaderAndMetrics();
        }
        const metricInactive = document.getElementById('metricInactive')?.textContent;

        // Click Inactive quick view tab
        document.getElementById('tabInactive')?.click();
        const modal = document.getElementById('listQuickViewModal');
        const isOpen = modal && modal.open;
        const count = document.getElementById('plCountBadge')?.textContent;
        const rows = Array.from(document.querySelectorAll('#plTableBody tr')).map(r => r.innerText);
        modal?.close();
        return { metricInactive, isOpen, count, rowCount: rows.length };
      })()
    `);

    assert(Number(inactiveCheck?.metricInactive) > 0, `Inactive metric is > 0 (found ${inactiveCheck?.metricInactive})`);
    assert(inactiveCheck?.isOpen, 'Inactive books modal opened successfully');
    assert(Number(inactiveCheck?.count) > 0, `Inactive badge count is > 0 (found ${inactiveCheck?.count})`);
    assert(inactiveCheck?.rowCount > 0, `Inactive list rendered ${inactiveCheck?.rowCount} rows`);

    console.log('\n--- Test 2: Image 3 Put Ticket into Box Keypad & Steppers ---');
    const keypadCheck = await evalCode(`
      (() => {
        const setBoxModal = document.getElementById('setBoxModal');
        const boxInput = document.getElementById('setBoxNumberInput');
        const notInBoxBtn = document.getElementById('btnSetBoxNotInBox');
        const addBtn = document.getElementById('btnSetBoxConfirm');
        const keypad = document.querySelector('.setbox-keypad-card');

        if (!setBoxModal || !boxInput || !notInBoxBtn || !addBtn || !keypad) {
          return { error: 'DOM elements missing' };
        }

        setBoxModal.showModal();
        boxInput.value = '1';
        boxInput.dataset.fresh = 'true';

        // 1. Press keypad '2'
        const k2 = keypad.querySelector('.setbox-key[data-key="2"]');
        k2?.click();
        const v1 = boxInput.value;

        // 2. Press keypad '5'
        const k5 = keypad.querySelector('.setbox-key[data-key="5"]');
        k5?.click();
        const v2 = boxInput.value;

        // 3. Press backspace
        const bk = keypad.querySelector('.setbox-key[data-key="backspace"]');
        bk?.click();
        const v3 = boxInput.value;

        // 4. Stepper Up
        const stepUp = document.getElementById('setBoxStepUp');
        stepUp?.click();
        const v4 = boxInput.value;

        // 5. Clear
        const clr = keypad.querySelector('.setbox-key[data-key="clear"]');
        clr?.click();
        const v5 = boxInput.value;

        // 6. Enter '1' then '2'
        const k1 = keypad.querySelector('.setbox-key[data-key="1"]');
        k1?.click();
        k2?.click();
        const v6 = boxInput.value;

        setBoxModal.close();
        return { v1, v2, v3, v4, v5, v6 };
      })()
    `);

    assert(keypadCheck.v1 === '2', `Keypad '2' replaced fresh input with '2' (got '${keypadCheck.v1}')`);
    assert(keypadCheck.v2 === '25', `Keypad '5' appended to make '25' (got '${keypadCheck.v2}')`);
    assert(keypadCheck.v3 === '2', `Backspace reduced '25' to '2' (got '${keypadCheck.v3}')`);
    assert(keypadCheck.v4 === '3', `Stepper up incremented '2' to '3' (got '${keypadCheck.v4}')`);
    assert(keypadCheck.v5 === '', `Clear cleared input (got '${keypadCheck.v5}')`);
    assert(keypadCheck.v6 === '12', `Typing 1 then 2 produced '12' (got '${keypadCheck.v6}')`);

    console.log('\n--- Test 3: Not In Box Action (Saves to Stock / Safe) ---');
    const notInBoxCheck = await evalCode(`
      (() => {
        window.state.tempPendingScan = {
          barcode: '14650554433000',
          gameId: '1465',
          gameName: 'Super Cash 1465',
          packNumber: '055443',
          price: 10,
          currentTicket: 0,
          totalTickets: 60
        };

        const beforeCount = (window.state.inStockInventory || []).length;
        document.getElementById('btnSetBoxNotInBox')?.click();
        const afterCount = (window.state.inStockInventory || []).length;
        const savedPack = (window.state.inStockInventory || []).find(p => p.packNumber && p.packNumber.includes('055443'));

        return {
          beforeCount,
          afterCount,
          savedPack: savedPack ? savedPack.packNumber : null,
          saved: afterCount > beforeCount && Boolean(savedPack),
          boxNumber: savedPack ? savedPack.boxNumber : null
        };
      })()
    `);

    assert(notInBoxCheck.saved, 'Clicking "Not In Box" saved pack to in-stock inventory');
    assert(!notInBoxCheck.boxNumber, 'Saved pack has no boxNumber (unassigned safe stock)');

    ws.close();
  } finally {
    p.kill('SIGTERM');
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
