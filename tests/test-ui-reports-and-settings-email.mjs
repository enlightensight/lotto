import assert from 'node:assert';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9798;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n================================================================');
  console.log(' TEST: REAL BROWSER UI VERIFICATION (ZERO FAKE REPORTS & EMAIL) ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-ui-test-'));

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
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        targets = await res.json();
        if (targets && targets.length > 0) break;
      } catch (e) {
        await sleep(250);
      }
    }

    assert(targets && targets.length > 0, 'Chrome CDP targets available');
    const page = targets.find(t => t.type === 'page');
    assert(page, 'Found page target');

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

    await new Promise(r => ws.onopen = r);

    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = msgId++;
      pending.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) {
        throw new Error(JSON.stringify(r.result.exceptionDetails));
      }
      return r.result?.result?.value;
    };

    // Wait for page to initialize
    await sleep(1500);

    // 1. Switch to store_anish and check Reports screen
    console.log('--- 1. Checking Reports Screen for Anish Store ---');
    const reportsResult = await evaluate(`
      (function() {
        if (typeof window.switchStore === 'function') {
          window.switchStore('store_anish');
        }
        
        // Navigate to reports screen
        const navItem = document.querySelector('[data-view="viewHistory"]') || document.querySelector('.pos-nav-item:nth-child(4)');
        if (navItem) navItem.click();
        if (typeof window.renderHistoryView === 'function') window.renderHistoryView();

        const tbody = document.getElementById('historyShiftsTableBody') || document.querySelector('#historyShiftTable tbody');
        const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
        const textContent = tbody ? tbody.innerText : '';
        const hasRosa = textContent.includes('Rosa');
        const hasDaniel = textContent.includes('Daniel');
        const hasShift13 = textContent.includes('#13');

        return {
          currentStore: window.getCurrentStoreId ? window.getCurrentStoreId() : '',
          rowCount,
          textContent,
          hasRosa,
          hasDaniel,
          hasShift13
        };
      })()
    `);

    console.log('Reports screen check:', reportsResult);
    assert.strictEqual(reportsResult.hasRosa, false, 'Anish Store Reports screen must NOT contain Rosa');
    assert.strictEqual(reportsResult.hasDaniel, false, 'Anish Store Reports screen must NOT contain Daniel');
    assert.strictEqual(reportsResult.hasShift13, false, 'Anish Store Reports screen must NOT contain Shift #13');
    console.log('  ✓ PASS: Zero fake reports in Anish Store UI');

    // 2. Open Settings screen and verify Store & email tab
    console.log('\n--- 2. Checking Settings Email Recipients List ---');
    const settingsResult = await evaluate(`
      (function() {
        const settingsNav = document.querySelector('[data-view="viewSettings"]') || document.querySelector('.pos-nav-item:nth-child(5)');
        if (settingsNav) settingsNav.click();
        if (typeof window.populateSettingsInputs === 'function') window.populateSettingsInputs();

        const emailListEl = document.getElementById('settingsEmailRecipientsList');
        const initialText = emailListEl ? emailListEl.innerText.trim() : '';
        const initialHasAmigo = initialText.includes('amigofoodmart2300@gmail.com');
        const debugStoreId = window.state ? window.state.storeId : 'NO_STATE';
        const debugEmails = window.state ? window.state.settingsReportEmails : 'NO_EMAILS';

        // Add a test email
        const input = document.getElementById('inputNewReportEmail');
        const addBtn = document.getElementById('btnAddReportEmail');
        if (input && addBtn) {
          input.value = 'anish_manager@example.com';
          addBtn.click();
        }

        const afterAddText = emailListEl ? emailListEl.innerText.trim() : '';
        const afterAddHasEmail = afterAddText.includes('anish_manager@example.com');

        // Remove the email
        const removeBtn = emailListEl ? emailListEl.querySelector('.btn-remove-email-recipient') : null;
        let afterRemoveText = '';
        let afterRemoveHasAmigo = false;
        if (removeBtn) {
          removeBtn.click();
          afterRemoveText = emailListEl ? emailListEl.innerText.trim() : '';
          afterRemoveHasAmigo = afterRemoveText.includes('amigofoodmart2300@gmail.com');
        }

        return {
          debugStoreId,
          debugEmails,
          initialText,
          initialHasAmigo,
          afterAddHasEmail,
          afterRemoveText,
          afterRemoveHasAmigo,
          settingsReportEmails: window.state?.settingsReportEmails || []
        };
      })()
    `);

    console.log('Settings email check:', settingsResult);
    assert.strictEqual(settingsResult.initialHasAmigo, false, 'Anish Store settings must NOT show amigo email initially');
    assert.strictEqual(settingsResult.afterAddHasEmail, true, 'Added email must be present in settings list');
    assert.strictEqual(settingsResult.afterRemoveHasAmigo, false, 'Removing email must NOT restore amigo email');
    assert.strictEqual(settingsResult.settingsReportEmails.length, 0, 'settingsReportEmails array must be empty after remove');
    console.log('  ✓ PASS: Settings Email Add and Remove works perfectly in browser UI');

    ws.close();
  } finally {
    p.kill();
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log('\n================================================================');
  console.log(' ALL REAL-BROWSER UI CHECKS PASSED PERFECTLY!                   ');
  console.log('================================================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
