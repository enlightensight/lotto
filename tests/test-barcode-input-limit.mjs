import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: BARCODE INPUT RANGE LIMIT & SANITIZATION                 ');
console.log('================================================================\n');

// 1. Static HTML Audit
console.log('--- Test 1: Verify maxlength & inputmode attributes on #barcodeInput in index.html ---');
const html = readFileSync('index.html', 'utf8');
if (!html.includes('id="barcodeInput"')) throw new Error('barcodeInput missing from index.html');
if (!html.includes('maxlength="36"')) throw new Error('barcodeInput missing maxlength="36" in index.html');
console.log('  ✓ PASS: index.html defines maxlength="36" on #barcodeInput');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9895;

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
  console.log('\n--- Test 2: Browser CDP Input Sanitization & Range Validation ---');
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-barcode-limit-'));
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

    // Authenticate as approved user 'anish' to open dashboard
    await evaluate(`(() => {
      const userInput = document.getElementById('inputSignInUser');
      const passInput = document.getElementById('inputSignInPass');
      if (userInput) userInput.value = 'anish';
      if (passInput) passInput.value = 'AX123456@';
      document.getElementById('btnSubmitSignIn')?.click();
    })()`);
    await sleep(600);

    // Test DOM attribute default
    const domMaxlength = await evaluate(`document.getElementById('barcodeInput')?.getAttribute('maxlength')`);
    console.log('  DOM maxlength:', domMaxlength);
    assert(domMaxlength === '36', 'DOM element has default maxlength="36"');

    // Test Typing 24-digit barcode (standard Georgia/SCEL/US 2D PDF417 lottery barcode)
    const twentyFourDigitsTest = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = '168877700100108494869032';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { val: input.value, len: input.value.length };
    })()`);
    console.log('  24-digit scratch barcode entered:', twentyFourDigitsTest);
    assert(twentyFourDigitsTest.len === 24, '24-digit barcode preserved completely without truncation');
    assert(twentyFourDigitsTest.val === '168877700100108494869032', '24-digit barcode value matches exactly');

    // Test Typing pure digits past 30 digits
    const pureDigitsTest = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = '123456789012345678901234567890999999999';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { val: input.value, len: input.value.length };
    })()`);
    console.log('  Pure digits entered (>30 digits):', pureDigitsTest);
    assert(pureDigitsTest.len === 30, 'Pure numbers strictly capped at 30 digits');

    // Test Typing non-barcode characters (should be sanitized)
    const sanitizeTest = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = 'Hello@#$%^1910-0016624-007(142)';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input.value;
    })()`);
    console.log('  Sanitized value:', sanitizeTest);
    assert(sanitizeTest === '1910-0016624-007(142)', 'Invalid characters stripped cleanly');

    // Test Entering formatted string longer than 36 characters (should be truncated to 36)
    const truncateTest = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = '1910-0016624-007 (142) EXTRA CHARACTERS 999999999';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { val: input.value, len: input.value.length };
    })()`);
    console.log('  Truncated formatted value:', truncateTest);
    assert(truncateTest.len <= 36, 'Formatted input length capped at 36');

    // Test Box typing caps at 10 characters
    const boxTest = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = 'BOX-05-EXTRA';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { val: input.value, len: input.value.length };
    })()`);
    console.log('  Box input test:', boxTest);
    assert(boxTest.len <= 10, 'Box format input length capped at 10');

    // Test Range Validation on submission: 5 digits (not a box # and not a valid ticket barcode)
    const fiveDigitsResult = await evaluate(`(() => {
      window.processScannedBarcode('12345');
      const toast = document.querySelector('.toast-message')?.textContent || '';
      const alertTitle = document.getElementById('scanActionTitle')?.textContent || '';
      return { toast, alertTitle };
    })()`);
    console.log('  5-digit rejection:', fiveDigitsResult);
    assert(fiveDigitsResult.alertTitle.includes('INVALID BARCODE RANGE'), 'Alert banner shows INVALID BARCODE RANGE');

    // Test Range Validation on submission: Ticket # exceeds 300
    const outOfRollResult = await evaluate(`(() => {
      window.processScannedBarcode('1910-0016624-450 (142)');
      const toast = document.querySelector('.toast-message')?.textContent || '';
      const alertTitle = document.getElementById('scanActionTitle')?.textContent || '';
      return { toast, alertTitle };
    })()`);
    console.log('  Ticket #450 rejection:', outOfRollResult);
    assert(outOfRollResult.alertTitle.includes('TICKET OUT OF RANGE'), 'Alert banner shows TICKET OUT OF RANGE');

    // Test Range Validation on submission: Length > 36
    const exceedsLimitResult = await evaluate(`(() => {
      window.processScannedBarcode('1234567890123456789012345678901234567890');
      const alertTitle = document.getElementById('scanActionTitle')?.textContent || '';
      return { alertTitle };
    })()`);
    console.log('  40-char rejection:', exceedsLimitResult);
    assert(exceedsLimitResult.alertTitle.includes('BARCODE EXCEEDS LIMIT'), 'Alert banner shows BARCODE EXCEEDS LIMIT');

    // Test Valid formatted barcode works normally
    const validBarcodeResult = await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      input.value = '1910-0016624-007 (142)';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input.value;
    })()`);
    assert(validBarcodeResult === '1910-0016624-007 (142)', 'Valid barcode preserved completely');

    ws.close();
    console.log('\n================================================================');
    console.log(` ALL BARCODE INPUT RANGE LIMIT TESTS PASSED (${passed}/${total})!`);
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
