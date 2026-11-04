import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: UPPER-RIGHT LAST SCAN BOX MESSAGES & ZERO BOTTOM TOASTS  ');
console.log('================================================================\n');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9896;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

async function runBrowserTests() {
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-lastscan-msg-'));
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

    const page = targets.find(t => t.type === 'page');
    assert(Boolean(page), 'Chrome CDP page target found');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
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

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      }
      return res.result?.value;
    }

    await sleep(800);

    // Sign in as anish
    await evaluate(`(() => {
      const userInput = document.getElementById('inputSignInUser');
      const passInput = document.getElementById('inputSignInPass');
      if (userInput) userInput.value = 'anish';
      if (passInput) passInput.value = 'AX123456@';
      document.getElementById('btnSubmitSignIn')?.click();
    })()`);
    await sleep(600);
    await evaluate(`(() => {
      const tc = document.getElementById('toastContainer');
      if (tc) tc.innerHTML = '';
    })()`);

    console.log('\n--- Test 1: Barcode Exceeds Limit (>36 chars) ---');
    const exceedsResult = await evaluate(`(() => {
      window.processScannedBarcode('1234567890123456789012345678901234567890');
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const hasAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const toastCount = document.querySelectorAll('#toastContainer .toast').length;
      const toastText = document.querySelector('#toastContainer .toast')?.textContent || '';
      return { title, display, hasAlertYellow, badge, toastCount, toastText };
    })()`);
    console.log('  Exceeds Limit readout:', exceedsResult);
    assert(exceedsResult.title === 'BARCODE EXCEEDS LIMIT', 'scanActionTitle shows BARCODE EXCEEDS LIMIT');
    assert(exceedsResult.display.includes('Input exceeds maximum 36 characters'), 'lastScanDisplay shows character length details');
    assert(exceedsResult.hasAlertYellow === true, 'Upper right box has alert-yellow class');
    assert(exceedsResult.badge === '!', 'Large stat badge displays "!" warning indicator');
    assert(exceedsResult.toastCount === 0, 'Zero bottom toast popups generated for barcode exceeds limit');

    // Take screenshot showing upper right box message with zero bottom toast
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('fs');
    writeFileSync('screenshot-upper-right-last-scan-box.png', Buffer.from(screenshot.data, 'base64'));
    console.log('  📸 Saved screenshot to screenshot-upper-right-last-scan-box.png');

    console.log('\n--- Test 2: Invalid Barcode Range (< 10 digits) ---');
    const rangeResult = await evaluate(`(() => {
      window.processScannedBarcode('12345');
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const hasAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const toastCount = document.querySelectorAll('#toastContainer .toast').length;
      return { title, display, hasAlertYellow, badge, toastCount };
    })()`);
    console.log('  Invalid Range readout:', rangeResult);
    assert(rangeResult.title === 'INVALID BARCODE RANGE', 'scanActionTitle shows INVALID BARCODE RANGE');
    assert(rangeResult.display.includes('outside valid barcode range'), 'lastScanDisplay shows range explanation');
    assert(rangeResult.hasAlertYellow === true, 'Upper right box has alert-yellow class');
    assert(rangeResult.badge === '!', 'Large stat badge displays "!" warning indicator');
    assert(rangeResult.toastCount === 0, 'Zero bottom toast popups generated for invalid barcode range');

    console.log('\n--- Test 3: Ticket Out of Range (Ticket # > 300) ---');
    const rollResult = await evaluate(`(() => {
      window.processScannedBarcode('1910-0016624-450 (142)');
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const hasAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const toastCount = document.querySelectorAll('#toastContainer .toast').length;
      return { title, display, hasAlertYellow, badge, toastCount };
    })()`);
    console.log('  Ticket Out of Range readout:', rollResult);
    assert(rollResult.title === 'TICKET OUT OF RANGE', 'scanActionTitle shows TICKET OUT OF RANGE');
    assert(rollResult.display.includes('exceeds maximum roll count'), 'lastScanDisplay shows roll limit explanation');
    assert(rollResult.hasAlertYellow === true, 'Upper right box has alert-yellow class');
    assert(rollResult.badge === '!', 'Large stat badge displays "!" warning indicator');
    assert(rollResult.toastCount === 0, 'Zero bottom toast popups generated for ticket out of range');

    console.log('\n--- Test 4: Retail Merchandise / Non-Lottery Code ---');
    const retailResult = await evaluate(`(() => {
      window.state.shiftStatus = 'ACTIVE_SHIFT';
      window.processScannedBarcode('012345678905');
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const hasAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const toastCount = document.querySelectorAll('#toastContainer .toast').length;
      return { title, display, hasAlertYellow, badge, toastCount };
    })()`);
    console.log('  Retail code readout:', retailResult);
    assert(retailResult.title.includes('RETAIL MERCHANDISE') || retailResult.title.includes('NON-LOTTERY'), 'scanActionTitle shows retail merchandise alert');
    assert(retailResult.hasAlertYellow === true, 'Upper right box has alert-yellow class');
    assert(retailResult.badge === '!', 'Large stat badge displays "!" warning indicator');
    assert(retailResult.toastCount === 0, 'Zero bottom toast popups generated for retail code');

    console.log('\n--- Test 5: End Shift - Wrong Box/Ticket Not in Active Rack ---');
    const endShiftWrongResult = await evaluate(`(() => {
      window.state.shiftStatus = 'SCANNING_END_SHIFT';
      window.state.slots = [{ boxNumber: 1, status: 'ACTIVE', packNumber: '1111111', gameId: 'g1' }];
      window.processScannedBarcode('BOX-99');
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const hasAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const toastCount = document.querySelectorAll('#toastContainer .toast').length;
      return { title, display, hasAlertYellow, badge, toastCount };
    })()`);
    console.log('  End Shift wrong ticket readout:', endShiftWrongResult);
    assert(endShiftWrongResult.title === 'WRONG TICKET - NOT IN ACTIVE BOX', 'scanActionTitle shows WRONG TICKET - NOT IN ACTIVE BOX');
    assert(endShiftWrongResult.display.includes('NOT in any active dispenser box'), 'lastScanDisplay shows active dispenser box explanation');
    assert(endShiftWrongResult.hasAlertYellow === true, 'Upper right box has alert-yellow class');
    assert(endShiftWrongResult.badge === '!', 'Large stat badge displays "!" warning indicator');
    assert(endShiftWrongResult.toastCount === 0, 'Zero bottom toast popups generated in End Shift for wrong ticket');

    ws.close();
    console.log('\n================================================================');
    console.log(` ALL LAST SCAN BOX & ZERO-TOAST TESTS PASSED (${passed}/${total})!`);
    console.log('================================================================\n');
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
}

runBrowserTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
