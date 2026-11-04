import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CDP_PORT = 9248;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log(' TEST: ADMIN, AMIGO & AMIGO EMAIL LOGIN (REAL BROWSER E2E)      ');
  console.log('================================================================');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-role-logins-'));
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

    const pageTarget = targets?.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('Could not find Chrome page target');
    console.log('\n  ✓ PASS: Chrome CDP page target connected');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

    await new Promise((r) => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res?.result?.value;
    }

    await sleep(1000);

    // --- TEST 1: Login as ADMIN with AX123456@ ---
    console.log('\n--- Test 1: Sign in with ID "admin" and password "AX123456@" ---');
    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'admin';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    const adminCheck = await evaluate(`
      (function() {
        const adminDash = document.getElementById('viewAdminDashboard');
        const adminTitle = document.querySelector('.admin-topbar-title')?.textContent?.trim() || '';
        return {
          adminDashDisplay: adminDash ? adminDash.style.display : '',
          adminTitle
        };
      })()
    `);

    console.log('  Admin Login readout:', adminCheck);
    assert(adminCheck.adminDashDisplay !== 'none', 'Admin Dashboard is visible and active on screen');

    // --- TEST 2: Login as AMIGO with AX123456@ ---
    console.log('\n--- Test 2: Sign in with ID "amigo" and password "AX123456@" ---');
    await evaluate(`
      (function() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      })()
    `);
    await sleep(1500);

    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'amigo';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    const amigoCheck = await evaluate(`
      (function() {
        const sidebarStore = document.getElementById('sidebarStoreName')?.textContent?.trim() || '';
        return {
          currentSid: getCurrentStoreId(),
          sidebarStore
        };
      })()
    `);

    console.log('  Amigo Store Login readout:', amigoCheck);
    assert(amigoCheck.currentSid === 'store_amigo', 'Store ID resolved to store_amigo');
    assert(amigoCheck.sidebarStore.toUpperCase().includes('AMIGO'), 'Sidebar displays AMIGO FOOD MART');

    // --- TEST 3: Login with Email "amigofoodmart2300@gmail.com" and password "AX123456@" ---
    console.log('\n--- Test 3: Sign in with Email "amigofoodmart2300@gmail.com" and password "AX123456@" ---');
    await evaluate(`
      (function() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      })()
    `);
    await sleep(1500);

    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'amigofoodmart2300@gmail.com';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    const emailCheck = await evaluate(`
      (function() {
        const sidebarStore = document.getElementById('sidebarStoreName')?.textContent?.trim() || '';
        return {
          currentSid: getCurrentStoreId(),
          sidebarStore
        };
      })()
    `);

    console.log('  Amigo Email Login readout:', emailCheck);
    assert(emailCheck.currentSid === 'store_amigo', 'Email amigofoodmart2300@gmail.com resolved to store_amigo');
    assert(emailCheck.sidebarStore.toUpperCase().includes('AMIGO'), 'Sidebar displays AMIGO FOOD MART');

    // --- TEST 4: Login as ANISH with AX123456@ ---
    console.log('\n--- Test 4: Sign in with ID "anish" and password "AX123456@" ---');
    await evaluate(`
      (function() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      })()
    `);
    await sleep(1500);

    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'anish';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    const anishCheck = await evaluate(`
      (function() {
        const sidebarStore = document.getElementById('sidebarStoreName')?.textContent?.trim() || '';
        return {
          currentSid: getCurrentStoreId(),
          sidebarStore
        };
      })()
    `);

    console.log('  Anish Login readout:', anishCheck);
    assert(anishCheck.currentSid === 'store_anish', 'Store ID resolved to store_anish');
    assert(anishCheck.sidebarStore.toUpperCase().includes('ANISH'), 'Sidebar displays ANISH STORE');

    console.log('\n================================================================');
    console.log(' ALL ROLE-BASED & EMAIL SIGN-IN TESTS PASSED PERFECTLY (4/4)!   ');
    console.log('================================================================');
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

