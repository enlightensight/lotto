import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9899;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

const credLines = readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

const STORE_PASSWORD = creds.STORE_TEST_PASS;
const ADMIN_PASSWORD = creds.ADMIN_TEST_PASS || 'AdminPass_Unified2026_SuperSecure#99';

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

async function main() {
  console.log('================================================================');
  console.log(' JACKPOTLO REAL-BROWSER TEST: USERNAME / ID LOGIN VERIFICATION  ');
  console.log('================================================================\n');

  // Start Vite dev server if not running
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-id-login-'));
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
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((r) => { ws.onopen = r; });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result?.value;
    }

    async function captureScreenshot(filename) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = join(ARTIFACT_DIR, filename);
      writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`  📸 Screenshot saved: ${filename}`);
      return outPath;
    }

    await sleep(2000);

    // 1. Verify Login Screen displays "Email or Username / ID" and type="text"
    const inputType = await evaluate(`document.getElementById('inputSignInUser')?.getAttribute('type')`);
    assert(inputType === 'text', 'Login input has type="text" (allows ID, username, or email)');

    const placeholder = await evaluate(`document.getElementById('inputSignInUser')?.getAttribute('placeholder')`);
    assert(placeholder.includes('amigo') || placeholder.includes('admin'), 'Login placeholder shows example IDs');

    // 2. Test Store Login with ID "amigo"
    await evaluate(`
      (function() {
        const userInput = document.getElementById('inputSignInUser');
        const passInput = document.getElementById('inputSignInPass');
        const form = document.getElementById('signInMainForm');
        userInput.value = 'amigo';
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.value = '${STORE_PASSWORD}';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()
    `);

    await sleep(2500);

    const isStoreOpen = await evaluate(`
      document.querySelector('.pos-app-layout') !== null &&
      document.getElementById('viewSignIn').style.display === 'none'
    `);
    assert(isStoreOpen === true, 'Successfully logged into Store POS using ID "amigo"');
    await captureScreenshot('screenshot-login-by-id-amigo.png');

    // 3. Sign out and test Admin Login with ID "admin"
    await evaluate(`
      (function() {
        if (typeof window.handleSignOut === 'function') {
          window.handleSignOut();
        } else {
          sessionStorage.clear();
          localStorage.removeItem('lotto_session_user');
          location.reload();
        }
      })()
    `);

    await sleep(2000);

    // Enter ID "admin" with admin password
    await evaluate(`
      (function() {
        const userInput = document.getElementById('inputSignInUser');
        const passInput = document.getElementById('inputSignInPass');
        const form = document.getElementById('signInMainForm');
        userInput.value = 'admin';
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.value = '${ADMIN_PASSWORD}';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()
    `);

    await sleep(2500);

    const isAdminOpen = await evaluate(`
      document.getElementById('viewAdminDashboard') !== null &&
      document.getElementById('viewSignIn').style.display === 'none'
    `);
    assert(isAdminOpen === true, 'Successfully logged into Platform Admin using ID "admin"');
    await captureScreenshot('screenshot-login-by-id-admin.png');

    console.log(`\n================================================================`);
    console.log(` REAL-BROWSER TEST COMPLETE: ${passed}/${total} ASSERTIONS PASSED!`);
    console.log(`================================================================\n`);

    ws.close();
  } finally {
    chromeProcess.kill();
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('\n❌ Browser test failed:', err);
  process.exit(1);
});

