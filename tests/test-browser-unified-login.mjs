import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import mysql from 'mysql2/promise';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9877;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

const credLines = readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

const caCert = readFileSync('ca.pem', 'utf8');
const SHARED_EMAIL = creds.SHARED_TEST_EMAIL || 'amigofoodmart2300@gmail.com';
const STORE_PASSWORD = creds.STORE_TEST_PASS;
const NEW_ADMIN_PASSWORD = 'AdminPass_Unified2026_SuperSecure#99';

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
  console.log(' JACKPOTLO REAL-BROWSER TEST: UNIFIED EMAIL LOGIN VERIFICATION  ');
  console.log('================================================================\n');

  // 1. Verify DB isolation boundary
  const conn = await mysql.createConnection({
    host: creds.DB_HOST,
    port: parseInt(creds.DB_PORT, 10),
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    database: 'jackpotlo_test',
    ssl: { ca: caCert, rejectUnauthorized: true }
  });
  const [dbRows] = await conn.query('SELECT DATABASE() as db');
  assert(dbRows[0].db === 'jackpotlo_test', 'Connected strictly to test database jackpotlo_test');

  // Ensure store_amigo is APPROVED and ACTIVE
  await conn.query("UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'APPROVED', is_active = 1 WHERE store_id = 'store_amigo'");

  // 2. Launch real Google Chrome instance with remote debugging
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-unified-login-'));
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
    const consoleErrors = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        if (data.params.type === 'error') {
          consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
        }
      }
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((resolve) => (ws.onopen = resolve));
    await send('Runtime.enable');
    await send('Page.enable');

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.result.exceptionDetails) {
        throw new Error(res.result.exceptionDetails.exception.description);
      }
      return res.result.result.value;
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.result.data, 'base64');
      const filepath = join(ARTIFACT_DIR, filename);
      writeFileSync(filepath, buffer);
      console.log(`  📸 Screenshot saved: ${filename}`);
      return filepath;
    }

    await sleep(2500);

    // =========================================================================
    // TEST 1: Unified Login Screen Verification (No Mode Selector)
    // =========================================================================
    console.log('\n--- Test 1: Verify Mode Selector Completely Removed ---');
    await evalCode(`
      sessionStorage.clear();
      localStorage.removeItem('lotto_session_user');
      sessionStorage.setItem('lotto_signed_out', 'true');
      if (typeof showSignInScreen === 'function') {
        showSignInScreen();
      }
    `);
    await sleep(500);

    const isSignInVisible = await evalCode(`document.getElementById('viewSignIn')?.style.display !== 'none'`);
    assert(isSignInVisible, 'Sign-in screen (#viewSignIn) is visible');

    const hasModeSelector = await evalCode(`Boolean(document.getElementById('signInModeSelector'))`);
    assert(!hasModeSelector, 'Mode selector (#signInModeSelector) is completely removed from DOM');

    const hasBtnModeStore = await evalCode(`Boolean(document.getElementById('btnModeStore'))`);
    assert(!hasBtnModeStore, 'Store POS button (#btnModeStore) is completely removed');

    const hasBtnModeAdmin = await evalCode(`Boolean(document.getElementById('btnModeAdmin'))`);
    assert(!hasBtnModeAdmin, 'Platform Admin button (#btnModeAdmin) is completely removed');

    const emailFieldType = await evalCode(`document.getElementById('inputSignInUser')?.getAttribute('type')`);
    assert(emailFieldType === 'email', 'Login input has type="email"');

    const hasForgotPassword = await evalCode(`Boolean(document.getElementById('linkForgotPassword'))`);
    assert(hasForgotPassword, 'Forgot password link (#linkForgotPassword) is present');

    const hasSubmitBtn = await evalCode(`Boolean(document.getElementById('btnSubmitSignIn'))`);
    assert(hasSubmitBtn, 'Login submit button (#btnSubmitSignIn) is present');

    await captureScreenshot('screenshot-unified-login-screen.png');

    // =========================================================================
    // TEST 2: Store POS Login via Unified Screen
    // =========================================================================
    console.log('\n--- Test 2: Store Login (Email + Store Password) ---');
    await evalCode(`
      document.getElementById('inputSignInUser').value = '${SHARED_EMAIL}';
      document.getElementById('inputSignInPass').value = '${STORE_PASSWORD}';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    const isPosLayoutVisible = await evalCode(`
      const layout = document.querySelector('.pos-app-layout');
      Boolean(layout && layout.style.display !== 'none')
    `);
    assert(isPosLayoutVisible, 'Store POS layout (.pos-app-layout) opened after store login');

    const isSignInHiddenAfterStore = await evalCode(`document.getElementById('viewSignIn')?.style.display === 'none'`);
    assert(isSignInHiddenAfterStore, 'Sign-in view is hidden');

    const storeUserInSession = await evalCode(`(() => {
      const u = JSON.parse(sessionStorage.getItem('lotto_session_user') || '{}');
      return u.isAdmin === false && u.storeId === 'store_amigo';
    })()`);
    assert(storeUserInSession, 'Store session user verified (isAdmin = false, storeId = store_amigo)');

    await captureScreenshot('screenshot-unified-store-pos.png');

    // =========================================================================
    // TEST 3: Sign Out & Platform Admin Login via Unified Screen
    // =========================================================================
    console.log('\n--- Test 3: Platform Admin Login (Same Email + Admin Password) ---');
    await evalCode(`
      sessionStorage.clear();
      localStorage.removeItem('lotto_session_user');
      sessionStorage.setItem('lotto_signed_out', 'true');
      showSignInScreen();
    `);
    await sleep(600);

    // Enter SAME email with NEW Administrator password
    await evalCode(`
      document.getElementById('inputSignInUser').value = '${SHARED_EMAIL}';
      document.getElementById('inputSignInPass').value = '${NEW_ADMIN_PASSWORD}';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    const isAdminDashboardVisible = await evalCode(`
      const d = document.getElementById('viewAdminDashboard');
      Boolean(d && d.style.display !== 'none')
    `);
    assert(isAdminDashboardVisible, 'Platform Admin Dashboard (#viewAdminDashboard) opened after admin login');

    const adminUserInSession = await evalCode(`(() => {
      const u = JSON.parse(sessionStorage.getItem('lotto_session_user') || '{}');
      return u.isAdmin === true && u.role === 'SUPER_ADMIN';
    })()`);
    assert(adminUserInSession, 'Admin session user verified (isAdmin = true, role = SUPER_ADMIN)');

    await captureScreenshot('screenshot-unified-admin-dashboard.png');

    // =========================================================================
    // TEST 4: Forgot Password Link Test
    // =========================================================================
    console.log('\n--- Test 4: Forgot Password Link ---');
    await evalCode(`
      showSignInScreen();
      document.getElementById('linkForgotPassword')?.click();
    `);
    await sleep(400);

    const alertMessage = await evalCode(`document.getElementById('signInErrorAlert')?.textContent`);
    assert(alertMessage && alertMessage.includes('support@jackpotlo.com'), 'Forgot password link displays support guidance');

    await conn.end();

    console.log(`\n======================================================`);
    console.log(` REAL-BROWSER AUDIT: ${passed}/${total} CHECKS PASSED (100%)`);
    console.log(`======================================================\n`);

  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('\nBrowser test execution failed:', err);
  process.exit(1);
});
