import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import mysql from 'mysql2/promise';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9876;
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
const ADMIN_PASSWORD = creds.ADMIN_TEST_PASS;

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

async function api(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:3001${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('================================================================');
  console.log(' JACKPOTLO REAL-BROWSER TEST: DUAL LOGIN & SUSPENSION AUDIT     ');
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

  // Reset store_amigo to APPROVED and ACTIVE
  await conn.query("UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'APPROVED', is_active = 1 WHERE store_id = 'store_amigo'");

  // 2. Launch real Google Chrome instance with remote debugging
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-dual-login-'));
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
    // TEST 1: Login Interface Verification
    // =========================================================================
    console.log('\n--- Test 1: Login Interface & Mode Selector ---');
    // Ensure clean logged-out state so viewSignIn is visible
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
    assert(isSignInVisible, 'Sign-in screen (#viewSignIn) is visible in real browser');

    const hasModeSelector = await evalCode(`Boolean(document.getElementById('signInModeSelector'))`);
    assert(hasModeSelector, 'Mode selector (#signInModeSelector) is rendered in DOM');

    const storeBtnActive = await evalCode(`document.getElementById('btnModeStore')?.classList.contains('active')`);
    assert(storeBtnActive, 'Store POS button defaults to active state');

    // Screenshot in Store POS mode
    await captureScreenshot('screenshot-login-store-mode.png');

    // Switch to Platform Admin mode
    await evalCode(`document.getElementById('btnModeAdmin')?.click();`);
    await sleep(300);

    const adminBtnActive = await evalCode(`document.getElementById('btnModeAdmin')?.classList.contains('active')`);
    assert(adminBtnActive, 'Platform Admin button is active after click');

    const adminSubtitle = await evalCode(`document.getElementById('signInStoreSubtitle')?.textContent`);
    assert(adminSubtitle.includes('Platform Administration'), `Subtitle updated to admin portal: "${adminSubtitle}"`);

    const adminModeVal = await evalCode(`document.getElementById('inputSignInMode')?.value`);
    assert(adminModeVal === 'ADMIN', 'Hidden mode input value updated to ADMIN');

    // Screenshot in Platform Admin mode
    await captureScreenshot('screenshot-login-admin-mode.png');

    // =========================================================================
    // TEST 2: Store Login Verification
    // =========================================================================
    console.log('\n--- Test 2: Store POS Login ---');
    // Switch back to Store POS mode
    await evalCode(`document.getElementById('btnModeStore')?.click();`);
    await sleep(200);

    // Type credentials and submit
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(STORE_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1500);

    const isPosVisible = await evalCode(`document.getElementById('viewSellCounter')?.style.display !== 'none'`);
    assert(isPosVisible, 'Successful store login opens the main Store POS counter (#viewSellCounter)');

    const storeBrand = await evalCode(`document.getElementById('sidebarStoreName')?.textContent || document.getElementById('cashierBrandSub')?.textContent || ''`);
    assert(storeBrand.toUpperCase().includes('AMIGO'), `Store brand shows Amigo: "${storeBrand}"`);

    await captureScreenshot('screenshot-store-login-success.png');

    // =========================================================================
    // TEST 3: Administrator Login Verification
    // =========================================================================
    console.log('\n--- Test 3: Platform Administrator Login ---');
    // Sign out to return to login screen
    await evalCode(`
      sessionStorage.clear();
      sessionStorage.setItem('lotto_signed_out', 'true');
      if (typeof showSignInScreen === 'function') {
        showSignInScreen();
      }
    `);
    await sleep(500);

    // Select Platform Admin mode
    await evalCode(`document.getElementById('btnModeAdmin')?.click();`);
    await sleep(200);

    // Type same email with Admin password
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(ADMIN_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1500);

    const isAdminDashboardVisible = await evalCode(`document.getElementById('viewAdminDashboard')?.style.display !== 'none'`);
    assert(isAdminDashboardVisible, 'Successful admin login opens Admin Dashboard (#viewAdminDashboard)');

    const urlHash = await evalCode(`window.location.hash`);
    assert(urlHash.startsWith('#admin'), `Browser URL navigated to admin: "${urlHash}"`);

    await captureScreenshot('screenshot-admin-login-success.png');

    // =========================================================================
    // TEST 4: Cross-Authentication Rejections
    // =========================================================================
    console.log('\n--- Test 4: Cross-Authentication Rejection ---');
    // Return to sign-in screen
    await evalCode(`
      sessionStorage.clear();
      sessionStorage.setItem('lotto_signed_out', 'true');
      if (typeof showSignInScreen === 'function') {
        showSignInScreen();
      }
    `);
    await sleep(500);

    // 4a. Attempt Store Password in Admin Mode
    await evalCode(`document.getElementById('btnModeAdmin')?.click();`);
    await sleep(200);
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(STORE_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1000);

    const errorAlertAdmin = await evalCode(`document.getElementById('signInErrorAlert')?.textContent || ''`);
    const errorDisplayAdmin = await evalCode(`document.getElementById('signInErrorAlert')?.style.display`);
    assert(errorDisplayAdmin !== 'none' && errorAlertAdmin.length > 0, `Store password in Admin mode rejected with alert: "${errorAlertAdmin}"`);

    // 4b. Attempt Admin Password in Store Mode
    await evalCode(`document.getElementById('btnModeStore')?.click();`);
    await sleep(200);
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(ADMIN_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1000);

    const errorAlertStore = await evalCode(`document.getElementById('signInErrorAlert')?.textContent || ''`);
    const errorDisplayStore = await evalCode(`document.getElementById('signInErrorAlert')?.style.display`);
    assert(errorDisplayStore !== 'none' && errorAlertStore.length > 0, `Admin password in Store mode rejected with alert: "${errorAlertStore}"`);

    // 4c. Completely incorrect password
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = 'CompletelyWrongPass99!';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1000);
    const errorAlertWrong = await evalCode(`document.getElementById('signInErrorAlert')?.textContent || ''`);
    assert(errorAlertWrong.length > 0, `Wrong password rejected with alert: "${errorAlertWrong}"`);

    // =========================================================================
    // TEST 5: Approval and Suspension Messages
    // =========================================================================
    console.log('\n--- Test 5: Approval & Suspension UI Messages ---');
    // 5a. Pending Application message
    await evalCode(`
      document.getElementById('inputSignInUser').value = 'sarah@metromart.com';
      document.getElementById('inputSignInPass').value = 'SomePass123';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1000);
    const pendingMsg = await evalCode(`document.getElementById('signInErrorAlert')?.textContent || ''`);
    assert(pendingMsg.includes('pending administrator review'), `Pending application displays pending review notice: "${pendingMsg}"`);

    // 5b. Suspend store_amigo via API
    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: SHARED_EMAIL, password: ADMIN_PASSWORD, mode: 'ADMIN' })
    });
    const adminToken = adminLoginRes.data.token;

    await api('/api/admin/stores/store_amigo/status', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({
        authorizationStatus: 'SUSPENDED',
        operationalStatus: 'INACTIVE',
        reason: 'UI suspension test',
        adminUsername: 'admin'
      })
    });

    // Attempt Store login while suspended
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(STORE_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1000);
    const suspendedMsg = await evalCode(`document.getElementById('signInErrorAlert')?.textContent || ''`);
    assert(suspendedMsg.includes('suspended by lottery administration'), `Suspended store displays suspension denial notice: "${suspendedMsg}"`);

    await captureScreenshot('screenshot-blocked-suspended-store.png');

    // 5c. Reactivate store_amigo
    await api('/api/admin/stores/store_amigo/status', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({
        authorizationStatus: 'APPROVED',
        operationalStatus: 'ACTIVE',
        reason: 'Reactivation test',
        adminUsername: 'admin'
      })
    });

    // Fresh login succeeds
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(STORE_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1500);
    const posReopened = await evalCode(`document.getElementById('viewSellCounter')?.style.display !== 'none'`);
    assert(posReopened, 'Fresh login after reactivation successfully re-opens Store POS counter');

    // =========================================================================
    // TEST 6: Full API Suspension Audit
    // =========================================================================
    console.log('\n--- Test 6: Full API Suspension Audit ---');
    // Obtain valid store session token first
    const storeLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: SHARED_EMAIL, password: STORE_PASSWORD, mode: 'STORE' })
    });
    const validStoreToken = storeLoginRes.data.token;

    // Suspend store_amigo
    await api('/api/admin/stores/store_amigo/status', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({
        authorizationStatus: 'SUSPENDED',
        operationalStatus: 'INACTIVE',
        reason: 'API route audit',
        adminUsername: 'admin'
      })
    });

    // Test protected store routes
    const routes = [
      { name: 'POS State Sync', method: 'POST', path: '/api/sync-pos-state', body: { storeId: 'store_amigo', state: {} } },
      { name: 'Daily Settlement Report', method: 'POST', path: '/api/save-day-report', body: { storeId: 'store_amigo', storeName: 'AMIGO FOOD MART' } },
      { name: 'Shift Settlement Report', method: 'POST', path: '/api/save-shift-report', body: { storeId: 'store_amigo', totalSalesRevenue: 100 } },
      { name: 'Inventory Ticket Sale', method: 'POST', path: '/api/inventory/sale', body: { storeId: 'store_amigo', packNumber: '128842', quantity: 1 } },
      { name: 'Shift Reconciliation', method: 'POST', path: '/api/inventory/reconcile-shift', body: { storeId: 'store_amigo', shiftId: 'shift_1' } },
      { name: 'Allocation Receipt', method: 'POST', path: '/api/store/receive-allocation', body: { storeId: 'store_amigo', allocationId: 1 } }
    ];

    for (const route of routes) {
      const res = await api(route.path, {
        method: route.method,
        headers: {
          'x-store-token': validStoreToken,
          'x-store-id': 'store_amigo'
        },
        body: JSON.stringify(route.body)
      });
      assert(res.status === 403, `Route "${route.name}" (${route.path}) strictly rejected with HTTP 403`);
    }

    // Reactivate store
    await api('/api/admin/stores/store_amigo/status', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({
        authorizationStatus: 'APPROVED',
        operationalStatus: 'ACTIVE',
        reason: 'Post-audit reactivation',
        adminUsername: 'admin'
      })
    });

    // Verify revoked token remains unusable even after store reactivation
    const revokedCheck = await api('/api/sync-pos-state', {
      method: 'POST',
      headers: { 'x-store-token': validStoreToken, 'x-store-id': 'store_amigo' },
      body: JSON.stringify({ storeId: 'store_amigo', state: {} })
    });
    assert(revokedCheck.status === 403, 'Revoked store token cannot be used after store reactivation (HTTP 403)');

    // =========================================================================
    // TEST 7: POS Preservation Verification
    // =========================================================================
    console.log('\n--- Test 7: POS Preservation Verification ---');
    // Fresh login to view live POS counter
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(SHARED_EMAIL)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(STORE_PASSWORD)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1500);

    const hasRack = await evalCode(`Boolean(document.getElementById('dispensersGrid') || document.getElementById('dispenserRackContainer'))`);
    assert(hasRack, 'Dispenser rack (#dispensersGrid) is preserved and intact');

    const hasBarcodeBox = await evalCode(`Boolean(document.getElementById('barcodeInput'))`);
    assert(hasBarcodeBox, 'Barcode scanning input (#barcodeInput) is preserved and intact');

    const hasDayReportBtn = await evalCode(`Boolean(document.getElementById('tabSettlement') || document.getElementById('btnDsCloseDayAndSettle'))`);
    assert(hasDayReportBtn, 'Day settlement / Shift report controls (#tabSettlement) preserved and intact');

    await captureScreenshot('screenshot-store-pos-preserved.png');

    // =========================================================================
    // TEST 8: Console Errors & Final Audit
    // =========================================================================
    console.log('\n--- Test 8: Browser Console Errors & Final Health ---');
    const filteredErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('sw.js'));
    console.log(`  Browser console errors captured: ${filteredErrors.length}`);
    if (filteredErrors.length > 0) {
      console.log('  Details:', filteredErrors);
    }
    assert(filteredErrors.length === 0, 'Zero uncaught JavaScript runtime errors in browser console');

    await conn.end();

    console.log(`\n======================================================`);
    console.log(` REAL-BROWSER AUDIT COMPLETE: ${passed}/${total} CHECKS PASSED `);
    console.log(`======================================================\n`);
  } finally {
    try {
      chromeProcess.kill();
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