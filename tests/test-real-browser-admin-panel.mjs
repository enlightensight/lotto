// ============================================================================
// Real-Browser End-to-End Test: Jackpotlo Enterprise Admin Panel & Report Email
// ============================================================================

import { spawn, execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9796;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n====================================================');
  console.log('   REAL-BROWSER VERIFICATION: ENTERPRISE ADMIN PANEL & EMAIL  ');
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

  // Ensure admin credentials are known
  execSync('node scripts/manage-admin.cjs reset admin BrowserTestPass123!');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-admin-real-'));

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'http://127.0.0.1:5173/?bypass_login=1'
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

    // Wait for DOM to load
    await sleep(2000);

    // ------------------------------------------------------------------------
    // Step 0: Set active admin session in browser
    // ------------------------------------------------------------------------
    console.log('--- Step 0: Authenticating & Loading Admin View ---');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'BrowserTestPass123!' })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.token;

    await evalCode(`
      sessionStorage.setItem('lotto_admin_token', ${JSON.stringify(adminToken)});
      localStorage.setItem('lotto_admin_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('lotto_session_user', JSON.stringify({
        name: 'Platform Administrator',
        signInName: 'admin',
        isAdmin: true,
        role: 'SUPER_ADMIN',
        adminToken: ${JSON.stringify(adminToken)}
      }));
      window.location.hash = '#admin';
      if (typeof showAdminDashboardView === 'function') {
        showAdminDashboardView();
      }
    `);

    await sleep(1500);

    // ------------------------------------------------------------------------
    // Section 1: Dashboard Overview
    // ------------------------------------------------------------------------
    console.log('\n--- Section 1: Dashboard KPIs & Overview ---');
    const isDashboardVisible = await evalCode(`document.getElementById('viewAdminDashboard')?.style.display !== 'none'`);
    assert(isDashboardVisible, 'viewAdminDashboard is visible in real browser');

    const totalStoresKpi = await evalCode(`document.getElementById('adminKpiTotalStores')?.textContent`);
    const pendingAppsKpi = await evalCode(`document.getElementById('adminKpiPendingApps')?.textContent`);
    const approvedStoresKpi = await evalCode(`document.getElementById('adminKpiApprovedStores')?.textContent`);
    const suspendedStoresKpi = await evalCode(`document.getElementById('adminKpiSuspendedStores')?.textContent`);

    assert(Number(totalStoresKpi) >= 2, `Total Stores KPI shows database stores (got ${totalStoresKpi})`);
    assert(Number(pendingAppsKpi) >= 0, `Pending Apps KPI shows count (got ${pendingAppsKpi})`);
    assert(Number(approvedStoresKpi) >= 1, `Approved Stores KPI shows count (got ${approvedStoresKpi})`);
    assert(Number(suspendedStoresKpi) >= 0, `Suspended Stores KPI shows count (got ${suspendedStoresKpi})`);

    // Capture screenshot of updated Admin Dashboard
    try {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const imgData = shot?.result?.data || shot?.data;
      if (imgData) {
        const outPath = 'C:/Users/Admin/.gemini/antigravity/brain/e5d66af5-2b32-406b-b7b2-c5318eae9544/screenshot-admin-panel-updated-ui.png';
        writeFileSync(outPath, Buffer.from(imgData, 'base64'));
        console.log(`  ✓ Screenshot saved: ${outPath}`);
      }

      // Test Dark Mode toggle & screenshot
      await evalCode(`document.getElementById('adminThemeToggleBtn')?.click()`);
      await sleep(400);
      const darkShot = await send('Page.captureScreenshot', { format: 'png' });
      const darkData = darkShot?.result?.data || darkShot?.data;
      if (darkData) {
        const darkPath = 'C:/Users/Admin/.gemini/antigravity/brain/e5d66af5-2b32-406b-b7b2-c5318eae9544/screenshot-admin-panel-dark-mode.png';
        writeFileSync(darkPath, Buffer.from(darkData, 'base64'));
        console.log(`  ✓ Dark mode screenshot saved: ${darkPath}`);
      }
      // Toggle back to light mode
      await evalCode(`document.getElementById('adminThemeToggleBtn')?.click()`);
      await sleep(200);
    } catch (err) {
      console.warn('Screenshot capture warning:', err.message);
    }

    // ------------------------------------------------------------------------
    // Section 2: Store Applications
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Store Applications ---');
    await evalCode(`document.querySelector('[data-admin-tab="applications"]')?.click()`);
    await sleep(800);

    const appsRowCount = await evalCode(`document.getElementById('adminApplicationsTableBody')?.children.length`);
    assert(appsRowCount >= 1, `Store applications table rendered database records (rows: ${appsRowCount})`);

    const hasReviewBtn = await evalCode(`document.querySelector('.btn-review-app') !== null`);
    assert(hasReviewBtn, 'Review button exists on application row');

    // ------------------------------------------------------------------------
    // Section 3: Store Management
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: Store Management ---');
    await evalCode(`document.querySelector('[data-admin-tab="stores"]')?.click()`);
    await sleep(800);

    const storesRowCount = await evalCode(`document.getElementById('adminStoresTableBody')?.children.length`);
    assert(storesRowCount >= 2, `Store management table rendered stores (rows: ${storesRowCount})`);

    const hasSuspendOrReactivate = await evalCode(`
      document.querySelector('.btn-suspend-store, .btn-reactivate-store') !== null
    `);
    assert(hasSuspendOrReactivate, 'Suspend/Reactivate action buttons exist in store management');

    // ------------------------------------------------------------------------
    // Section 4: Store User Feedback & Issue Reports
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Store Feedback & Issues ---');
    await evalCode(`document.querySelector('[data-admin-tab="feedback"]')?.click()`);
    await sleep(800);

    const feedbackRowCount = await evalCode(`document.getElementById('adminFeedbackTableBody')?.children.length`);
    assert(feedbackRowCount >= 1, `Store feedback table rendered records (rows: ${feedbackRowCount})`);

    // ------------------------------------------------------------------------
    // Section 5: Multi-Store Reports
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Multi-Store Reports ---');
    await evalCode(`document.querySelector('[data-admin-tab="reports"]')?.click()`);
    await sleep(800);

    const salesRowCount = await evalCode(`document.getElementById('adminReportSalesTableBody')?.children.length`);
    assert(salesRowCount >= 1, `Store sales report rendered data (rows: ${salesRowCount})`);

    // Click inventory tab
    await evalCode(`document.querySelector('[data-report-tab="inventory"]')?.click()`);
    await sleep(400);
    const invDisplay = await evalCode(`document.getElementById('adminReportSectionInventory')?.style.display !== 'none'`);
    assert(invDisplay, 'Ticket inventory sub-report section toggled visible');

    // Click shifts tab
    await evalCode(`document.querySelector('[data-report-tab="shifts"]')?.click()`);
    await sleep(400);
    const shiftsDisplay = await evalCode(`document.getElementById('adminReportSectionShifts')?.style.display !== 'none'`);
    assert(shiftsDisplay, 'Shift reports sub-report section toggled visible');

    // Click discrepancies tab
    await evalCode(`document.querySelector('[data-report-tab="discrepancies"]')?.click()`);
    await sleep(400);
    const discDisplay = await evalCode(`document.getElementById('adminReportSectionDiscrepancies')?.style.display !== 'none'`);
    assert(discDisplay, 'Stock discrepancies sub-report section toggled visible');

    // ------------------------------------------------------------------------
    // Section 6: Audit Trail
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: System Audit Trail ---');
    await evalCode(`document.querySelector('[data-admin-tab="audit"]')?.click()`);
    await sleep(800);

    const auditCount = await evalCode(`document.getElementById('adminFullAuditTrailList')?.children.length`);
    assert(auditCount >= 1, `Audit trail rendered action log entries (entries: ${auditCount})`);

    // ------------------------------------------------------------------------
    // Section 7: Store POS Switch & Email Target Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Store POS Switch & Email Target Verification ---');
    await evalCode(`document.getElementById('btnAdminTopSwitchPos')?.click()`);
    await sleep(800);

    const isCounterVisible = await evalCode(`document.getElementById('viewSellCounter')?.style.display !== 'none'`);
    assert(isCounterVisible, 'Successfully switched to Store POS counter view');

    // Verify email recipient is amigofoodmart2300@gmail.com
    const emailInputVal = await evalCode(`document.getElementById('setReportEmail')?.value`);
    assert(emailInputVal === 'amigofoodmart2300@gmail.com', `Settings report email defaults to amigofoodmart2300@gmail.com (got: ${emailInputVal})`);

    const printEmailVal = await evalCode(`document.getElementById('setPrintingEmail')?.value`);
    assert(printEmailVal === 'amigofoodmart2300@gmail.com', `Printing report email defaults to amigofoodmart2300@gmail.com (got: ${printEmailVal})`);

    // Test API send-email endpoint directly
    const emailApiRes = await fetch('http://localhost:3001/api/reports/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        storeId: 'store_amigo',
        storeName: 'AMIGO FOOD MART',
        reportType: 'DAILY_REPORT',
        reportDate: new Date().toISOString()
      })
    });
    const emailApiData = await emailApiRes.json();
    assert(emailApiData.success === true, 'Report email endpoint successfully dispatched report');
    assert(emailApiData.recipient === 'amigofoodmart2300@gmail.com', `Report email target confirmed: ${emailApiData.recipient}`);

    console.log('\n====================================================');
    console.log(`   REAL-BROWSER RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('====================================================\n');

    if (failed > 0) {
      throw new Error(`${failed} assertion(s) failed.`);
    }

  } finally {
    try { p.kill(); } catch (_) {}
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
