// ============================================================================
// Real Browser Test: Store Application Modal & Admin Application Review
// ============================================================================

import { spawn, execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9797;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n====================================================');
  console.log('   REAL-BROWSER TEST: STORE APPLICATION MODAL       ');
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

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-app-modal-'));

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
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
    for (let i = 0; i < 25; i++) {
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

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
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

    await sleep(2000);

    // 1. Show Sign In Screen
    console.log('--- Step 1: Navigating to Sign-In Screen ---');
    await evalCode(`
      if (typeof showSignInScreen === 'function') {
        showSignInScreen();
      }
    `);
    await sleep(500);

    const hasApplyBtn = await evalCode(`document.getElementById('btnOpenStoreAppModal') !== null`);
    assert(hasApplyBtn, 'Sign In screen displays "Apply for a new store account" button');

    // 2. Click Apply button to open modal
    console.log('\n--- Step 2: Opening Store Application Modal ---');
    await evalCode(`document.getElementById('btnOpenStoreAppModal')?.click()`);
    await sleep(500);

    const isModalOpen = await evalCode(`
      const m = document.getElementById('modalStoreApplication');
      Boolean(m && (m.open || m.getAttribute('open') !== null));
    `);
    assert(isModalOpen, 'Store application dialog opened successfully');

    // 3. Fill and submit application
    console.log('\n--- Step 3: Submitting Store Application via Real UI Form ---');
    const uniqueStore = `Augusta Food Express #${Date.now()}`;
    await evalCode(`
      document.getElementById('appInputStoreName').value = ${JSON.stringify(uniqueStore)};
      document.getElementById('appInputOwnerName').value = 'Marcus Vance';
      document.getElementById('appInputRetailerId').value = 'GA-AUG-9941';
      document.getElementById('appInputEmail').value = 'marcus@augustafood.com';
      document.getElementById('appInputPhone').value = '(706) 555-0188';
      document.getElementById('appInputAddress').value = '1940 Broad St, Augusta, GA 30904';
      document.getElementById('appInputNotes').value = 'Commercial business license attached.';
      document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1500);

    // 4. Verify application recorded in admin backend
    console.log('\n--- Step 4: Admin Views New Application in Admin Queue ---');
    const resetOut = execSync('node scripts/manage-admin.cjs reset admin ModalReviewPass123!').toString();
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'ModalReviewPass123!' })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.token;

    const appsRes = await fetch('http://localhost:3001/api/admin/applications', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const appsData = await appsRes.json();
    const submittedApp = (appsData.applications || []).find(a => a.storeName === uniqueStore);
    assert(!!submittedApp, `Application for "${uniqueStore}" was successfully stored in database queue`);
    assert(submittedApp && submittedApp.status === 'PENDING', 'Submitted application status is PENDING');

    // 5. Navigate to Admin Panel and check Store Applications table
    console.log('\n--- Step 5: Switch Browser to Admin Applications View ---');
    await evalCode(`
      sessionStorage.setItem('lotto_admin_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('lotto_session_user', JSON.stringify({
        name: 'Platform Administrator',
        signInName: 'admin',
        isAdmin: true,
        role: 'SUPER_ADMIN',
        adminToken: ${JSON.stringify(adminToken)}
      }));
      window.location.hash = '#admin/applications';
      if (typeof showAdminDashboardView === 'function') {
        showAdminDashboardView('applications');
      }
    `);
    await sleep(1500);

    const hasNewStoreInTable = await evalCode(`
      const tbody = document.getElementById('adminApplicationsTableBody');
      tbody ? tbody.textContent.includes(${JSON.stringify(uniqueStore)}) : false;
    `);
    assert(hasNewStoreInTable, 'New store application appears in the rendered Admin Applications table');

    console.log('\n====================================================');
    console.log(`   MODAL BROWSER RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('====================================================\n');

  } finally {
    try { p.kill(); } catch (_) {}
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal modal browser test error:', err);
  process.exit(1);
});

