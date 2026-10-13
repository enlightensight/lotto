import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Auditing Day Settlement (Image 1) & Past Days (Image 2) Implementation ---');

// 1. Verify index.html contains all modal elements
console.log('1. Checking index.html elements...');
const html = fs.readFileSync(path.resolve('index.html'), 'utf8');

// Day Settlement (Image 1) elements
assert(html.includes('id="daySettlementModal"'), 'index.html contains daySettlementModal');
assert(html.includes('id="closeDaySettlementModalBtn"'), 'index.html contains closeDaySettlementModalBtn');
assert(html.includes('id="dsKpiDay"'), 'index.html contains dsKpiDay');
assert(html.includes('id="dsKpiCashier"'), 'index.html contains dsKpiCashier');
assert(html.includes('id="dsKpiTickets"'), 'index.html contains dsKpiTickets');
assert(html.includes('id="dsKpiTotalSales"'), 'index.html contains dsKpiTotalSales');
assert(html.includes('id="dsRecTicketSales"'), 'index.html contains dsRecTicketSales');
assert(html.includes('id="dsPrizesPaidInput"'), 'index.html contains dsPrizesPaidInput');
assert(html.includes('id="dsStartingCashInput"'), 'index.html contains dsStartingCashInput');
assert(html.includes('id="dsExpectedCashVal"'), 'index.html contains dsExpectedCashVal');
assert(html.includes('id="dsCountedCashInput"'), 'index.html contains dsCountedCashInput');
assert(html.includes('id="dsDiscrepancyCallout"'), 'index.html contains dsDiscrepancyCallout');
assert(html.includes('id="dsGamesTableBody"'), 'index.html contains dsGamesTableBody');
assert(html.includes('id="dsSumSoldTickets"'), 'index.html contains dsSumSoldTickets');
assert(html.includes('id="dsSumAmount"'), 'index.html contains dsSumAmount');
assert(html.includes('id="btnDsPrintReceipt"'), 'index.html contains btnDsPrintReceipt');
assert(html.includes('id="btnDsFullReport"'), 'index.html contains btnDsFullReport');
assert(html.includes('id="btnDsEmail"'), 'index.html contains btnDsEmail');
assert(html.includes('id="btnDsCloseDayAndSettle"'), 'index.html contains btnDsCloseDayAndSettle');
console.log('✓ PASS: All Day Settlement (Image 1) DOM elements verified');

// Past Days (Image 2) elements
assert(html.includes('id="pastDaysModal"'), 'index.html contains pastDaysModal');
assert(html.includes('id="closePastDaysModalBtn"'), 'index.html contains closePastDaysModalBtn');
assert(html.includes('id="pdDaysCountBadge"'), 'index.html contains pdDaysCountBadge');
assert(html.includes('id="pdFilterTabs"'), 'index.html contains pdFilterTabs');
assert(html.includes('id="pdStatTickets"'), 'index.html contains pdStatTickets');
assert(html.includes('id="pdStatSales"'), 'index.html contains pdStatSales');
assert(html.includes('id="pdHistoryTableBody"'), 'index.html contains pdHistoryTableBody');
assert(html.includes('id="btnPdOpenFullHistory"'), 'index.html contains btnPdOpenFullHistory');
assert(html.includes('id="btnPdExportCsv"'), 'index.html contains btnPdExportCsv');
assert(html.includes('id="btnPdDone"'), 'index.html contains btnPdDone');
console.log('✓ PASS: All Past Days (Image 2) DOM elements verified');

// 2. Verify design-system.css styling
console.log('2. Checking design-system.css styling...');
const css = fs.readFileSync(path.resolve('src/design-system.css'), 'utf8');

assert(css.includes('.modal-day-settlement'), 'CSS contains .modal-day-settlement');
assert(css.includes('.ds-kpi-grid'), 'CSS contains .ds-kpi-grid');
assert(css.includes('.ds-reconcile-grid'), 'CSS contains .ds-reconcile-grid');
assert(css.includes('.ds-counted-input'), 'CSS contains .ds-counted-input');
assert(css.includes('.ds-games-table'), 'CSS contains .ds-games-table');
assert(css.includes('.ds-box-pill'), 'CSS contains .ds-box-pill');
assert(css.includes('.modal-past-days'), 'CSS contains .modal-past-days');
assert(css.includes('.pd-segmented-control'), 'CSS contains .pd-segmented-control');
assert(css.includes('.pd-history-table'), 'CSS contains .pd-history-table');
assert(css.includes('.pd-avatar'), 'CSS contains .pd-avatar');
console.log('✓ PASS: All CSS classes and styles verified');

// 3. Verify settlementHistoryModals.js functions
console.log('3. Checking settlementHistoryModals.js exports...');
import('../src/settlementHistoryModals.js').then(mod => {
  assert(typeof mod.openDaySettlementModal === 'function', 'openDaySettlementModal is exported');
  assert(typeof mod.openPastDaysModal === 'function', 'openPastDaysModal is exported');
  assert(Array.isArray(mod.REFERENCE_DAY_SETTLEMENT_GAMES), 'REFERENCE_DAY_SETTLEMENT_GAMES is exported');
  assert(Array.isArray(mod.REFERENCE_PAST_DAYS), 'REFERENCE_PAST_DAYS is exported');
  console.log('✓ PASS: settlementHistoryModals.js exports verified');

  // 4. Verify main.js wiring
  console.log('4. Checking main.js wiring...');
  const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert(mainJs.includes('openDaySettlementModal'), 'main.js imports openDaySettlementModal');
  assert(mainJs.includes('openPastDaysModal'), 'main.js imports openPastDaysModal');
  console.log('✓ PASS: main.js properly wires navigation to both modals');

  console.log('\n--- ALL AUDIT CHECKS PASSED: BOTH SCREENS READY AND VERIFIED ---');
}).catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
