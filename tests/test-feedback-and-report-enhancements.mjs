import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

console.log('================================================================');
console.log(' TEST: FEEDBACK MODAL, EMPTY SLOTS PRESERVED & NO AUTO-END SHIFT');
console.log('================================================================\n');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9899;


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-feedback-report-fix-'));
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

    const page = targets.find((t) => t.type === 'page');
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

    await new Promise((r) => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result ? res.result.value : undefined;
    }

    async function takeScreenshot(name) {
      const data = await send('Page.captureScreenshot', { format: 'png' });
      if (data?.data) {
        const outPath = `C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544\\${name}.png`;
        writeFileSync(outPath, Buffer.from(data.data, 'base64'));
        console.log(`    📷 Screenshot saved: ${name}.png`);
      }
    }

    await sleep(2000);

    // 1. Log in as Anish to ANISH STORE
    console.log('\n--- Step 1: Sign in as Anish ---');
    await evaluate(`(() => {
      const userInput = document.getElementById('inputSignInUser');
      const passInput = document.getElementById('inputSignInPass');
      if (userInput) userInput.value = 'anish';
      if (passInput) passInput.value = 'AX123456@';
      document.getElementById('btnSubmitSignIn')?.click();
    })()`);
    await sleep(1500);

    const storeTitle = await evaluate(`document.getElementById('sidebarStoreName')?.textContent`);
    console.log(`  Current store in sidebar: "${storeTitle}"`);
    assert(storeTitle.includes('ANISH'), 'Active store is ANISH STORE');

    // 2. Test Feedback Modal Opening & Auto-Attachment
    console.log('\n--- Step 2: Open Feedback Modal from Sidebar ---');
    const openFbRes = await evaluate(`
      (function() {
        const btn = document.getElementById('navFeedback');
        if (!btn) return { error: 'navFeedback not found' };
        btn.click();
        const dlg = document.getElementById('modalStoreFeedback');
        return {
          isOpen: dlg ? dlg.open : false,
          store: document.getElementById('fbStoreLabel')?.textContent,
          cashier: document.getElementById('fbCashierLabel')?.textContent,
          shift: document.getElementById('fbShiftLabel')?.textContent
        };
      })()
    `);
    assert(openFbRes.isOpen, 'Feedback dialog opened when #navFeedback clicked');
    assert(openFbRes.store.includes('ANISH'), `Feedback auto-attached Store: "${openFbRes.store}"`);
    assert(openFbRes.cashier.toLowerCase().includes('anish'), `Feedback auto-attached Cashier: "${openFbRes.cashier}"`);

    // 3. Submit Feedback Form
    console.log('\n--- Step 3: Submit Feedback and Verify Upper-Right Message ---');
    const submitFbRes = await evaluate(`
      (async function() {
        const dlg = document.getElementById('modalStoreFeedback');
        const form = document.getElementById('formStoreFeedback');
        const subj = document.getElementById('fbSubject');
        const msg = document.getElementById('fbMessage');
        const cat = document.getElementById('fbCategory');
        if (!dlg || !form || !subj || !msg) return { error: 'Elements missing' };

        cat.value = 'SCANNER';
        subj.value = 'Automated Scanner Feedback Test';
        msg.value = 'Scanner test message submitted from Anish Store verified via CDP.';

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 600));

        const lastScanBox = document.getElementById('lastScanReadoutContainer');
        return {
          dlgClosed: !dlg.open,
          upperRightText: lastScanBox?.innerText || ''
        };
      })()
    `);
    assert(submitFbRes.dlgClosed, 'Feedback modal closed upon submission');
    assert(submitFbRes.upperRightText.includes('Feedback'), 'Upper-right box notified of successful feedback submission');

    // 4. Test Bug Fix: Ticket activation must NOT auto-end shift or skip to start shift phase!
    console.log('\n--- Step 4: Verify Activating Box 1 Does NOT Auto-End Shift ---');
    const activationCheck = await evaluate(`
      (function() {
        // Activate Box 1 while in clean state
        state.slots[0].status = 'ACTIVE';
        state.slots[0].packNumber = '5678901';
        state.slots[0].gameName = 'Scratch-Off Game';
        state.slots[0].price = 1;
        state.slots[0].startTicket = 234;
        state.slots[0].currentTicket = 234;
        state.slots[0].needsActivation = false;

        activateSlotPack(state.slots[0]);

        const secShiftReport = document.getElementById('shiftClosedReportSection');
        const dispenserCont = document.getElementById('dispenserRackContainer');
        const mainShiftBtnLabel = document.getElementById('mainShiftBtnLabel')?.textContent || '';

        return {
          shiftStatus: state.shiftStatus,
          viewingReport: Boolean(state.__viewingShiftReport),
          reportSectionDisplay: secShiftReport ? secShiftReport.style.display : '',
          dispenserRackDisplay: dispenserCont ? dispenserCont.style.display : '',
          mainShiftBtnLabel: mainShiftBtnLabel
        };
      })()
    `);

    console.log('  Activation state after activating Box 1:', activationCheck);
    assert(activationCheck.shiftStatus === 'IN_PROGRESS', 'Shift status automatically set to IN_PROGRESS upon box activation');
    assert(!activationCheck.viewingReport, 'state.__viewingShiftReport is FALSE (not forced into closed shift report)');
    assert(activationCheck.reportSectionDisplay !== 'block', 'Shift report section remains HIDDEN (not auto-ending shift)');
    assert(activationCheck.dispenserRackDisplay !== 'none', 'Dispenser rack remains VISIBLE and active on dashboard');
    assert(activationCheck.mainShiftBtnLabel.includes('End Shift'), 'Main action button displays "End Shift" (NOT "Start Shift")');

    // 5. Explicitly End Shift and Verify Shift Report with Empty Slots Preserved
    console.log('\n--- Step 5: Explicitly End Shift and Inspect Shift Report Table ---');
    await evaluate(`
      (function() {
        confirmEndShift();
      })()
    `);
    await sleep(600);

    const reportInspection = await evaluate(`
      (function() {
        const sec = document.getElementById('shiftClosedReportSection');
        const storeNameEl = sec?.querySelector('.rep-doc-store-name');
        const storeAddrEl = sec?.querySelector('.rep-doc-store-addr');
        const rows = Array.from(document.querySelectorAll('#repDocTableBody tr'));
        const titleEl = document.getElementById('shiftRepToolbarTitle');

        const rowTexts = rows.map(r => r.innerText.replace(/\\s+/g, ' ').trim());
        const emptySlotRows = rowTexts.filter(t => t.includes('EMPTY SLOT'));
        const activeRows = rowTexts.filter(t => !t.includes('EMPTY SLOT'));

        return {
          storeName: storeNameEl?.textContent || '',
          storeAddr: storeAddrEl?.textContent || '',
          totalRows: rows.length,
          emptySlotCount: emptySlotRows.length,
          activeRowCount: activeRows.length,
          toolbarTitle: titleEl?.innerText || '',
          box1Text: rowTexts[0] || ''
        };
      })()
    `);

    console.log(`  Report Store Name: "${reportInspection.storeName}"`);
    console.log(`  Report Store Address: "${reportInspection.storeAddr}"`);
    console.log(`  Total Rows Rendered: ${reportInspection.totalRows}`);
    console.log(`  Empty Slot Rows: ${reportInspection.emptySlotCount}`);
    console.log(`  Active Box Rows: ${reportInspection.activeRowCount}`);
    console.log(`  Report Toolbar Title: "${reportInspection.toolbarTitle}"`);
    console.log(`  Box 1 Row Content: "${reportInspection.box1Text}"`);

    assert(reportInspection.storeName === 'ANISH STORE', 'Dynamic store name preserved: ANISH STORE');
    assert(reportInspection.totalRows === 65, 'All 65 dispenser boxes rendered in table (empty slots preserved as requested!)');
    assert(reportInspection.emptySlotCount === 64, 'Exactly 64 empty slots rendered (slots 2 through 65 are EMPTY SLOT)');
    assert(reportInspection.activeRowCount === 1, 'Box 1 active row rendered correctly with Pack Number 5678901');
    assert(reportInspection.toolbarTitle.includes('2 pages'), 'Toolbar title displays 2 pages for full 65-box document');

    await takeScreenshot('screenshot-shift-report-empty-slots-preserved');

    // 6. Test Clicking "Done" on Shift Report returns cleanly to active POS dashboard
    console.log('\n--- Step 6: Click "Done" on Shift Report Toolbar ---');
    const doneResult = await evaluate(`
      (function() {
        document.getElementById('btnShiftRepDone')?.click();
        const secShiftReport = document.getElementById('shiftClosedReportSection');
        const dispenserCont = document.getElementById('dispenserRackContainer');
        return {
          shiftStatus: state.shiftStatus,
          reportDisplay: secShiftReport ? secShiftReport.style.display : '',
          dispenserDisplay: dispenserCont ? dispenserCont.style.display : ''
        };
      })()
    `);
    console.log('  State after clicking Done:', doneResult);
    assert(doneResult.shiftStatus === 'IN_PROGRESS', 'New shift started cleanly in IN_PROGRESS state');
    assert(doneResult.reportDisplay !== 'block', 'Shift closed report section closed and hidden');
    assert(doneResult.dispenserDisplay !== 'none', 'Dispenser rack returned to active display on dashboard');

    console.log(`\n================================================================`);
    console.log(` ALL CHECKS PASSED: ${passed}/${total}`);
    console.log(`================================================================\n`);
  } finally {
    try {
      chromeProcess.kill();
    } catch (_) {}
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('BROWSER FEEDBACK & REPORT TEST FAILED:', err);
  process.exit(1);
});
