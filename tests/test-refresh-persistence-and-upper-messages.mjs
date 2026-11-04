import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: REFRESH PERSISTENCE & UPPER-RIGHT MESSAGE PASS-THROUGH    ');
console.log('================================================================\n');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9897;

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
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-refresh-test-'));
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
    await send('Page.enable');

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

    console.log('\n--- Step 1: Sign in as Anish ---');
    await evaluate(`(() => {
      const userInput = document.getElementById('inputSignInUser');
      const passInput = document.getElementById('inputSignInPass');
      if (userInput) userInput.value = 'anish';
      if (passInput) passInput.value = 'AX123456@';
      document.getElementById('btnSubmitSignIn')?.click();
    })()`);
    await sleep(800);

    const loginReadout = await evaluate(`(() => {
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const visibleToastCount = Array.from(document.querySelectorAll('#toastContainer .toast, .toast')).filter(t => {
        const s = window.getComputedStyle(t);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
      }).length;
      const storeName = document.querySelector('.current-store-name')?.textContent || '';
      return { title, display, badge, visibleToastCount, storeName };
    })()`);

    console.log('  Login upper-right readout:', loginReadout);
    assert(loginReadout.title.includes('Welcome back, Anish'), 'scanActionTitle shows Welcome back, Anish!');
    assert(loginReadout.display.includes('ANISH STORE'), 'lastScanDisplay shows Opened ANISH STORE');
    assert(loginReadout.badge === '✓', 'largeStatReadout shows green checkmark badge');
    assert(loginReadout.visibleToastCount === 0, 'Zero visible toast popups at bottom of screen');

    // Screenshot of Welcome message in upper right box
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('screenshot-welcome-in-upper-right-box.png', Buffer.from(shot1.data, 'base64'));
    console.log('  📸 Captured screenshot-welcome-in-upper-right-box.png');

    console.log('\n--- Step 2: Trigger Browser Page Refresh (F5 / Reload) ---');
    await send('Page.reload');
    await sleep(1500);

    const postReloadState = await evaluate(`(() => {
      const signInDisplay = document.getElementById('viewSignIn')?.style.display;
      const posDisplay = document.querySelector('.pos-app-layout')?.style.display;
      const storeName = document.querySelector('.current-store-name')?.textContent || '';
      const sessUser = JSON.parse(sessionStorage.getItem('lotto_session_user') || '{}');
      const localUser = JSON.parse(localStorage.getItem('lotto_session_user') || '{}');
      return {
        signInDisplay,
        posDisplay,
        storeName,
        sessName: sessUser.name,
        localName: localUser.name
      };
    })()`);

    console.log('  Post-Reload State:', postReloadState);
    assert(postReloadState.signInDisplay === 'none', 'viewSignIn overlay remains hidden after page refresh');
    assert(postReloadState.posDisplay === 'flex', 'POS dashboard layout remains visible after page refresh');
    assert(postReloadState.sessName === 'Anish', 'sessionStorage maintains Anish user session');
    assert(postReloadState.localName === 'Anish', 'localStorage maintains Anish user session');

    console.log('\n--- Step 3: Test Dashboard "Refresh" Button ---');
    await evaluate(`(() => {
      document.getElementById('systemRefreshBtn')?.click();
    })()`);
    await sleep(600);

    const refreshBtnReadout = await evaluate(`(() => {
      const title = document.getElementById('scanActionTitle')?.textContent || '';
      const display = document.getElementById('lastScanDisplay')?.textContent || '';
      const badge = document.getElementById('largeStatReadout')?.textContent || '';
      const visibleToastCount = Array.from(document.querySelectorAll('#toastContainer .toast, .toast')).filter(t => {
        const s = window.getComputedStyle(t);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
      }).length;
      return { title, display, badge, visibleToastCount };
    })()`);

    console.log('  Refresh Button readout:', refreshBtnReadout);
    assert(refreshBtnReadout.title.includes('Refreshed & Synced'), 'scanActionTitle shows Refreshed & Synced message');
    assert(refreshBtnReadout.badge === '✓', 'largeStatReadout shows checkmark badge');
    assert(refreshBtnReadout.visibleToastCount === 0, 'Zero visible toast popups at bottom when clicking Refresh button');

    ws.close();
    console.log('\n================================================================');
    console.log(` ALL REFRESH & UPPER-RIGHT MESSAGE TESTS PASSED (${passed}/${total})!`);
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

