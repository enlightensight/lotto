import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: HONEYWELL HARDWARE SCANNER INPUT-CAPTURE COMPATIBILITY   ');
console.log('================================================================\n');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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

async function runTests() {
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-honeywell-test-'));
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

    const page = targets?.find(t => t.type === 'page');
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

    // Dispatch a realistic HID keystroke via CDP or DOM KeyboardEvent (when special non-char terminator needed)
    async function dispatchRealChar(ch) {
      const code = ch.charCodeAt(0);
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: ch,
        text: ch,
        unmodifiedText: ch,
        windowsVirtualKeyCode: code >= 97 && code <= 122 ? code - 32 : code
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: ch,
        windowsVirtualKeyCode: code >= 97 && code <= 122 ? code - 32 : code
      });
    }

    async function dispatchSpecialKey(key, code, vk, modifiers = 0) {
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key,
        code,
        modifiers,
        windowsVirtualKeyCode: vk
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code,
        modifiers,
        windowsVirtualKeyCode: vk
      });
    }

    async function scanString(str, { delayMs = 8, jitterAt = -1, jitterMs = 260 } = {}) {
      for (let i = 0; i < str.length; i++) {
        await dispatchRealChar(str[i]);
        if (i === jitterAt) {
          await sleep(jitterMs);
        } else if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }

    await sleep(900);

    // 1. Auth screen isolation: fast typing on Sign-In screen must NOT trigger barcode processing
    console.log('\n--- Test 1: Sign-In screen rapid keystrokes not hijacked ---');
    await evaluate(`(() => {
      window.__capturedScans = [];
      const userInput = document.getElementById('inputSignInUser');
      userInput?.focus();
    })()`);
    await scanString('anish', { delayMs: 10 });
    const signInVal = await evaluate(`document.getElementById('inputSignInUser')?.value || ''`);
    assert(signInVal === 'anish', `Sign-in username preserved verbatim ('${signInVal}')`);

    // Log in cleanly and wait for server state hydration to settle
    await evaluate(`(() => {
      document.getElementById('inputSignInPass').value = 'AX123456@';
      document.getElementById('btnSubmitSignIn')?.click();
    })()`);
    for (let i = 0; i < 30; i++) {
      const signedIn = await evaluate(`document.getElementById('viewSignIn')?.style.display === 'none'`);
      if (signedIn) break;
      await sleep(100);
    }
    await sleep(600);

    // Install lightweight page spy to observe Ctrl+J defaultPrevented and check exact DOM/state behavior
    await evaluate(`(() => {
      window.__ctrlJEvents = [];
      const orig = window.processScannedBarcode;
      window.__lastDispatchedRaw = null;
      window.processScannedBarcode = (raw) => {
        window.__lastDispatchedRaw = raw;
        return orig(raw);
      };
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'j') {
          window.__ctrlJEvents.push({ prevented: e.defaultPrevented });
        }
      });
    })()`);

    // Helper: reset barcodeInput focus & return lastScannedBarcode + alert title
    async function prepBarcodeFocus() {
      await evaluate(`(() => {
        const inp = document.getElementById('barcodeInput');
        if (inp) { inp.value = ''; inp.focus(); }
      })()`);
    }

    // Wait > 550ms between independent scans so each test starts a fresh sequence
    // Test 2: Standard 17-digit barcode + Enter (preserves leading zeroes)
    console.log('\n--- Test 2: Standard 17-digit USB HID + Enter ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16700198693000149', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t2 = await evaluate(`({ last: window.state?.lastScannedBarcode, inp: document.getElementById('barcodeInput')?.value })`);
    assert(t2.last === '16700198693000', `17-digit scan parsed to standardBarcode 16700198693000 (got '${t2.last}')`);
    assert(t2.inp === '', 'barcodeInput cleared after dispatch');

    // Test 3: CR+LF suffix (Enter followed immediately by Ctrl+J) does not double-scan or leave 'j'
    console.log('\n--- Test 3: Honeywell CR+LF suffix (Enter + Ctrl+J) ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16480183788029000', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(12);
    // Simulate Chrome Ctrl+J (modifiers: 2 = Ctrl)
    await dispatchSpecialKey('j', 'KeyJ', 74, 2);
    await sleep(80);
    const t3CtrlJ = await evaluate(`(() => ({
      prevented: window.__ctrlJDefaultPrevented,
      last: window.state?.lastScannedBarcode
    }))()`);
    assert(t3CtrlJ.last === '16480183788029', `CR+LF 17-digit scan parsed cleanly (got '${t3CtrlJ.last}')`);
    // Immediately follow with another scan to prove 'j' didn't linger in scanBuffer
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16920919050292', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t3Next = await evaluate(`window.state?.lastScannedBarcode`);
    assert(t3Next === '16920919050292', `Next scan after Ctrl+J not polluted with 'j' (got '${t3Next}')`);

    // Test 4: LF-only suffix (Ctrl+J) and CR-control suffix (Ctrl+M)
    console.log('\n--- Test 4: Honeywell LF-only (Ctrl+J) and Ctrl+M suffixes ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16583508770290', { delayMs: 8 });
    await dispatchSpecialKey('j', 'KeyJ', 74, 2);
    await sleep(80);
    const t4a = await evaluate(`window.state?.lastScannedBarcode`);
    assert(t4a === '16583508770290', `LF-only (Ctrl+J) dispatched 16583508770290 (got '${t4a}')`);

    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16700198690017', { delayMs: 8 });
    await dispatchSpecialKey('m', 'KeyM', 77, 2);
    await sleep(80);
    const t4b = await evaluate(`window.state?.lastScannedBarcode`);
    assert(t4b === '16700198690017', `Ctrl+M dispatched 16700198690017 (got '${t4b}')`);

    // Test 5: Honeywell AIM Symbology ID prefix ]C1 (while #barcodeInput is focused & strips 'C') + embedded GS (Ctrl+])
    console.log('\n--- Test 5: Honeywell AIM ]C1 prefix & embedded GS (Ctrl+]) ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString(']C11670019869', { delayMs: 8 });
    // Send embedded GS control char Ctrl+]
    await dispatchSpecialKey(']', 'BracketRight', 221, 2);
    await scanString('3000149', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t5 = await evaluate(`({ last: window.state?.lastScannedBarcode, title: document.getElementById('scanActionTitle')?.textContent })`);
    assert(t5.last === '16700198693000', `AIM ]C1 + GS scan parsed cleanly despite input filter (got '${t5.last}', title='${t5.title}')`);

    // Test 6: Slow / Jittery USB/Bluetooth HID packet gap (260ms pause mid-scan!)
    console.log('\n--- Test 6: Jittery HID packet pause (260ms gap mid-barcode) ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16480183780290', { delayMs: 10, jitterAt: 6, jitterMs: 260 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t6 = await evaluate(`window.state?.lastScannedBarcode`);
    assert(t6 === '16480183780290', `260ms mid-scan jitter preserved all digits & leading zeroes (got '${t6}')`);

    // Test 7: Tab suffix on short Box barcode ('BOX-99' + Tab)
    console.log('\n--- Test 7: Tab-terminated short BOX barcode ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('BOX-99', { delayMs: 12 });
    await dispatchSpecialKey('Tab', 'Tab', 9);
    await sleep(80);
    const t7 = await evaluate(`({ last: window.state?.lastScannedBarcode, activeId: document.activeElement?.id })`);
    assert(t7.last === 'BOX-99' || (typeof t7.last === 'string' && t7.last.includes('Box #99')), `Tab suffix dispatched short BOX-99 barcode (got '${t7.last}')`);
    assert(t7.activeId === 'barcodeInput', `Tab suffix did not tab focus away (activeId='${t7.activeId}')`);

    // Test 8: Scanning barcode with Space while focus is on #refreshBtn (must NOT trigger refresh click)
    console.log('\n--- Test 8: Formatted barcode with Space when focus is on Refresh button ---');
    await sleep(550);
    await evaluate(`(() => {
      window.__refreshClickedDuringScan = false;
      const btn = document.getElementById('btnRefreshRack');
      if (btn) {
        btn.addEventListener('click', () => { window.__refreshClickedDuringScan = true; }, { once: true });
        btn.focus();
      }
    })()`);
    await scanString('1910-0016624-007 (142)', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t8 = await evaluate(`({ last: window.state?.lastScannedBarcode, clicked: window.__refreshClickedDuringScan })`);
    assert(t8.clicked === false, 'Focused button NOT clicked by Space inside formatted barcode');
    assert(t8.last === '19100016624007', `Formatted barcode captured cleanly off-input (got '${t8.last}')`);

    // Test 9: Non-terminator burst (no Enter/Tab) dispatches via 500ms idle fallback
    console.log('\n--- Test 9: Terminator-less Honeywell fast burst (idle fallback) ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('16700198693000', { delayMs: 8 });
    await sleep(650);
    const t9 = await evaluate(`({ last: window.state?.lastScannedBarcode, inp: document.getElementById('barcodeInput')?.value })`);
    assert(t9.last === '16700198693000', `Terminator-less scan dispatched after 500ms idle (got '${t9.last}')`);
    assert(t9.inp === '', 'barcodeInput cleared after idle dispatch');

    // Test 10: Ctrl+A / Ctrl+V manual paste into #barcodeInput + Enter does not leak 'a'/'v' into scanBuffer
    console.log('\n--- Test 10: Ctrl+A + pasted value + Enter ---');
    await sleep(550);
    await prepBarcodeFocus();
    await dispatchSpecialKey('a', 'KeyA', 65, 2);
    await dispatchSpecialKey('v', 'KeyV', 86, 2);
    await evaluate(`(() => {
      const inp = document.getElementById('barcodeInput');
      if (inp) {
        inp.value = '16920919050292';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t10 = await evaluate(`window.state?.lastScannedBarcode`);
    assert(t10 === '16920919050292', `Pasted value submitted without Ctrl+A/V leak (got '${t10}')`);

    // Test 11: Existing validation preserved — invalid short barcode via keyboard wedge STILL rejected cleanly
    console.log('\n--- Test 11: Invalid short barcode still rejected via scanner ---');
    await sleep(550);
    await prepBarcodeFocus();
    await scanString('12345', { delayMs: 8 });
    await dispatchSpecialKey('Enter', 'Enter', 13);
    await sleep(80);
    const t11 = await evaluate(`document.getElementById('scanActionTitle')?.textContent || ''`);
    assert(t11.includes('INVALID BARCODE RANGE'), `Invalid 5-digit scan still rejected ('${t11}')`);

    ws.close();
    console.log('\n================================================================');
    console.log(` ALL HONEYWELL SCANNER COMPATIBILITY TESTS PASSED (${passed}/${total})!`);
    console.log('================================================================\n');
  } finally {
    try { chromeProcess.kill('SIGKILL'); } catch (_) {}
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
