import { spawn } from 'child_process';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9781;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('   CLEAR DATA & SHIFT TOGGLE VERIFICATION TEST      ');
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

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1920,1080',
    'http://localhost:5173'
  ]);

  try {
    await sleep(2500);
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;
    const cbs = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id && cbs.has(d.id)) {
        cbs.get(d.id)(d);
        cbs.delete(d.id);
      }
    };
    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      return new Promise(res => {
        const reqId = id++;
        cbs.set(reqId, res);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    async function evalInPage(expression) {
      const res = await call('Runtime.evaluate', {
        returnByValue: true,
        expression
      });
      return res.result?.result?.value;
    }

    await call('Page.enable');
    await call('DOM.enable');
    await sleep(1500);

    // 1. Settings Clear Data Tab Navigation & Elements
    console.log('--- Test Group 1: Clear Data Tab in Settings ---');
    const tabCheck = await evalInPage(`(() => {
      // Navigate to Settings
      const navBtn = document.getElementById('navSettings');
      if (navBtn) navBtn.click();
      
      const clearTabBtn = document.querySelector('.btn-settings-top-tab[data-tab="cleardata"]');
      const hasClearTab = Boolean(clearTabBtn);

      // Click clear data tab
      if (clearTabBtn) clearTabBtn.click();

      const pane = document.getElementById('paneSettingsClearData');
      const paneVisible = pane ? (pane.style.display !== 'none' && window.getComputedStyle(pane).display !== 'none') : false;
      const input = document.getElementById('inputConfirmClear');
      const btn = document.getElementById('btnClearAllData');

      return {
        hasClearTab,
        paneVisible,
        hasInput: Boolean(input),
        btnDisabledInitial: btn ? btn.disabled : false,
        btnText: btn ? btn.textContent.trim() : ''
      };
    })()`);

    assert(tabCheck?.hasClearTab, 'Clear data top tab exists in Settings header');
    assert(tabCheck?.paneVisible, 'Clicking Clear data tab reveals paneSettingsClearData');
    assert(tabCheck?.hasInput, 'Confirm input #inputConfirmClear is present');
    assert(tabCheck?.btnDisabledInitial, 'Clear all data button is initially disabled');
    assert(tabCheck?.btnText === 'Clear all data', 'Button text is "Clear all data"');

    // 2. Typing CLEAR activates the button
    console.log('\n--- Test Group 2: Type CLEAR Activation ---');
    const activateCheck = await evalInPage(`(() => {
      const input = document.getElementById('inputConfirmClear');
      const btn = document.getElementById('btnClearAllData');
      if (input) {
        input.value = 'CLEAR';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return {
        btnEnabled: btn ? !btn.disabled : false,
        hasReadyClass: btn ? btn.classList.contains('ready') : false
      };
    })()`);

    assert(activateCheck?.btnEnabled, 'Typing CLEAR enables the Clear all data button');
    assert(activateCheck?.hasReadyClass, 'Button receives .ready class for red active styling');

    // 3. Executing Clear all data resets system
    console.log('\n--- Test Group 3: Factory Reset Execution ---');
    const resetResult = await evalInPage(`(() => {
      const btn = document.getElementById('btnClearAllData');
      if (btn) btn.click();

      // Access state
      return {
        shiftStatus: state?.shiftStatus,
        shiftHistoryLength: (state?.shiftHistory || []).length,
        inventoryLength: (state?.inventory || []).length,
        salesRevenue: state?.totalSalesRevenue || 0,
        activeBoxesCount: (state?.slots || []).filter(s => s && s.status === 'ACTIVE' && s.packNumber).length,
        dataClearedFlag: Boolean(state?.dataCleared)
      };
    })()`);

    assert(resetResult?.shiftStatus === 'SHIFT_ENDED', 'State shiftStatus is SHIFT_ENDED after clear');
    assert(resetResult?.shiftHistoryLength === 0, 'Shift history is completely empty (0 records)');
    assert(resetResult?.inventoryLength === 0, 'Inventory is completely empty (0 items)');
    assert(resetResult?.activeBoxesCount === 0, 'All dispenser boxes are reset to empty');
    assert(resetResult?.dataClearedFlag, 'State dataCleared flag is true');

    // Wait for the clean page reload to complete
    await sleep(1500);

    // 4. Sell Counter Dashboard shows "Start Shift"
    console.log('\n--- Test Group 4: Sell Counter "Start Shift" Display ---');
    const btnLabelCheck = await evalInPage(`(() => {
      const sellNav = document.getElementById('navSellCounter');
      if (sellNav) sellNav.click();

      const shiftBtn = document.getElementById('mainShiftActionBtn');
      const label = document.getElementById('mainShiftBtnLabel')?.textContent.trim();
      const hasStartClass = shiftBtn ? shiftBtn.classList.contains('btn-ctrl-start-shift') : false;
      const statusText = document.getElementById('shiftStatusText')?.textContent.trim();

      return {
        label,
        hasStartClass,
        statusText,
        metricMonth: document.getElementById('metricThisMonth')?.textContent.trim(),
        metricWeek: document.getElementById('metricThisWeek')?.textContent.trim(),
        metricToday: document.getElementById('metricToday')?.textContent.trim(),
        metricInactive: document.getElementById('metricInactive')?.textContent.trim(),
        largeStat: document.getElementById('largeStatReadout')?.textContent.trim(),
        scanTitle: document.getElementById('scanActionTitle')?.textContent.trim(),
        shiftPill: document.getElementById('shiftPillTitle')?.textContent.trim()
      };
    })()`);

    assert(btnLabelCheck?.label === 'Start Shift', `Dashboard action button displays "Start Shift" (got "${btnLabelCheck?.label}")`);
    assert(btnLabelCheck?.hasStartClass, 'Action button has .btn-ctrl-start-shift class');
    assert(btnLabelCheck?.metricMonth === '0', `This Month metric card is 0 (got "${btnLabelCheck?.metricMonth}")`);
    assert(btnLabelCheck?.metricWeek === '0', `This Week metric card is 0 (got "${btnLabelCheck?.metricWeek}")`);
    assert(btnLabelCheck?.metricToday === '0', `Today metric card is 0 (got "${btnLabelCheck?.metricToday}")`);
    assert(btnLabelCheck?.metricInactive === '0', `Inactive metric card is 0 (got "${btnLabelCheck?.metricInactive}")`);
    assert(btnLabelCheck?.largeStat === '–', `Last scan number readout is "–" (got "${btnLabelCheck?.largeStat}")`);
    assert(btnLabelCheck?.scanTitle === 'Ready to scan', `Scan action title is "Ready to scan" (got "${btnLabelCheck?.scanTitle}")`);
    assert(btnLabelCheck?.shiftPill === 'Shift closed', `Shift pill badge is "Shift closed" (got "${btnLabelCheck?.shiftPill}")`);

    // 5. History Screen shows Zero History
    console.log('\n--- Test Group 5: History Screen Zero State ---');
    const historyCheck = await evalInPage(`(() => {
      const histNav = document.getElementById('navHistory');
      if (histNav) histNav.click();

      const tableBody = document.getElementById('histTableBody');
      const kpiTotalSales = document.getElementById('histKpiTotalSales')?.textContent.trim();
      const kpiTotalDays = document.getElementById('histKpiTotalDays')?.textContent.trim();
      const kpiTickets = document.getElementById('histKpiTicketsSold')?.textContent.trim();

      return {
        tableHtml: tableBody ? tableBody.innerHTML : '',
        kpiTotalSales,
        kpiTotalDays,
        kpiTickets
      };
    })()`);

    assert(historyCheck?.tableHtml.includes('No saved shift reports found'), 'History table shows "No saved shift reports found"');
    assert(historyCheck?.kpiTotalSales === '$0.00', 'History KPI Total Sales is $0.00');
    assert(historyCheck?.kpiTickets === '0', 'History KPI Tickets Sold is 0');

    // 5b. Inventory Screen shows Zero Ticket Books
    console.log('\n--- Test Group 5b: Inventory Screen Zero State (No Received Ticket Books) ---');
    const invCheck = await evalInPage(`(() => {
      const invNav = document.getElementById('navInventory');
      if (invNav) invNav.click();

      const badgeInStock = document.getElementById('invBadgeInStock')?.textContent.trim();
      const countActive = (document.getElementById('invSegCountActive') || document.getElementById('invCountActive'))?.textContent.trim();
      const countCompleted = (document.getElementById('invSegCountCompleted') || document.getElementById('invCountCompleted'))?.textContent.trim();
      const countRemoved = (document.getElementById('invSegCountRemoved') || document.getElementById('invCountRemoved'))?.textContent.trim();
      const countAll = (document.getElementById('invSegCountAll') || document.getElementById('invCountAll'))?.textContent.trim();
      const tbody = document.getElementById('invTableBody');

      return {
        badgeInStock,
        countActive,
        countCompleted,
        countRemoved,
        countAll,
        hasNo0670170: tbody ? !tbody.innerHTML.includes('0670170') : true,
        hasNoTreasureHunt: tbody ? !tbody.innerHTML.includes('Treasure Hunt') : true
      };
    })()`);

    assert(invCheck?.badgeInStock === '0', `In stock count badge is 0 (got "${invCheck?.badgeInStock}")`);
    assert(invCheck?.countActive === '0', `Active count badge is 0 (got "${invCheck?.countActive}")`);
    assert(invCheck?.countCompleted === '0', `Completed count badge is 0 (got "${invCheck?.countCompleted}")`);
    assert(invCheck?.countRemoved === '0', `Removed count badge is 0 (got "${invCheck?.countRemoved}")`);
    assert(invCheck?.countAll === '0', `All count badge is 0 (got "${invCheck?.countAll}")`);
    assert(invCheck?.hasNo0670170, 'Mock pack 0670170 is NOT shown in inventory table');
    assert(invCheck?.hasNoTreasureHunt, 'Mock book Treasure Hunt is NOT shown in inventory table');

    // 6. Starting Shift Transforms Button to "End Shift"
    console.log('\n--- Test Group 6: Start Shift to End Shift Lifecycle ---');
    const startShiftResult = await evalInPage(`(() => {
      // Go back to sell counter
      const sellNav = document.getElementById('navSellCounter');
      if (sellNav) sellNav.click();

      const shiftBtn = document.getElementById('mainShiftActionBtn');
      if (shiftBtn) shiftBtn.click(); // Click "Start Shift"

      const newLabel = document.getElementById('mainShiftBtnLabel')?.textContent.trim();
      const hasEndClass = shiftBtn ? shiftBtn.classList.contains('btn-ctrl-end-shift') && !shiftBtn.classList.contains('btn-ctrl-start-shift') : false;

      return {
        newStatus: state?.shiftStatus,
        newLabel,
        hasEndClass,
        shiftHistoryLength: (state?.shiftHistory || []).length
      };
    })()`);

    assert(startShiftResult?.newStatus === 'IN_PROGRESS', 'Clicking Start Shift transitions shiftStatus to IN_PROGRESS');
    assert(startShiftResult?.newLabel === 'End Shift', `Button transforms into "End Shift" (got "${startShiftResult?.newLabel}")`);
    assert(startShiftResult?.hasEndClass, 'Button has .btn-ctrl-end-shift class (black button)');
    assert(startShiftResult?.shiftHistoryLength === 0, 'Starting a shift does NOT pollute shift history (0 records)');

  } finally {
    p.kill();
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
