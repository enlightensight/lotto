// Automated Verification Suite for LottoTrack History Screen
import { getHistoryScreenData, REFERENCE_HISTORY_DAYS } from '../src/historyData.js';
import fs from 'fs';
import path from 'path';

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

console.log('--- 1. Testing History Screen Data Model & Reconciler ---');
const data = getHistoryScreenData({});

assert(data.kpis.daysCount === 14, `Days count is 14 (got ${data.kpis.daysCount})`);
assert(data.kpis.totalSales === 20166, `Total sales is exactly $20,166 (got $${data.kpis.totalSales})`);
assert(data.kpis.ticketsSold === 4691, `Tickets sold is exactly 4,691 (got ${data.kpis.ticketsSold})`);
assert(data.kpis.dailyAverage === 1440, `Daily average is exactly $1,440 (got $${data.kpis.dailyAverage})`);
assert(data.kpis.bestDayAmount === 2011, `Best day amount is exactly $2,011 (got $${data.kpis.bestDayAmount})`);
assert(data.kpis.bestDayDate === 'Sun, Sep 27', `Best day date is Sun, Sep 27 (got ${data.kpis.bestDayDate})`);

assert(data.chart.days.length === 14, `Chart has 14 days`);
assert(data.chart.days[data.chart.days.length - 1].isToday === true, `Chart ends with today`);
assert(data.chart.days[data.chart.days.length - 1].dateShort === 'Today', `Chart today label is 'Today'`);
assert(data.chart.days[0].dateShort === 'Sep 25', `Chart starts with 'Sep 25'`);
assert(data.chart.maxSales === 2011, `Chart max sales is 2011`);

console.log('--- 2. Testing index.html History View DOM Elements ---');
const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

assert(htmlContent.includes('id="viewHistory"'), 'index.html contains #viewHistory container');
assert(htmlContent.includes('id="histKpiTotalSales"'), 'index.html contains #histKpiTotalSales');
assert(htmlContent.includes('id="histKpiTicketsSold"'), 'index.html contains #histKpiTicketsSold');
assert(htmlContent.includes('id="histKpiDailyAverage"'), 'index.html contains #histKpiDailyAverage');
assert(htmlContent.includes('id="histKpiBestDaySales"'), 'index.html contains #histKpiBestDaySales');
assert(htmlContent.includes('id="histChartBody"'), 'index.html contains #histChartBody');
assert(htmlContent.includes('id="histSelectedStrip"'), 'index.html contains #histSelectedStrip');
assert(htmlContent.includes('id="histStripViewBtn"'), 'index.html contains #histStripViewBtn');
assert(htmlContent.includes('id="histTableBody"'), 'index.html contains #histTableBody');
assert(htmlContent.includes('navHistory'), 'index.html contains #navHistory');

console.log('--- 3. Testing src/style.css History Styles ---');
const cssContent = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');

assert(cssContent.includes('.history-view'), 'style.css has .history-view layout');
assert(cssContent.includes('.hist-kpi-highlight'), 'style.css has .hist-kpi-highlight mint green styling');
assert(cssContent.includes('.hist-chart-card'), 'style.css has .hist-chart-card');
assert(cssContent.includes('.hist-bar-fill'), 'style.css has .hist-bar-fill');
assert(cssContent.includes('.hist-selected-strip'), 'style.css has .hist-selected-strip');
assert(cssContent.includes('.hist-table'), 'style.css has .hist-table');
assert(cssContent.includes('[data-theme="dark"] .hist-kpi-card'), 'style.css has dark theme support for History');

console.log('--- 4. Testing src/main.js History Logic & Routing ---');
const mainContent = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

assert(mainContent.includes('getHistoryScreenData'), 'main.js imports getHistoryScreenData');
assert(mainContent.includes('function showHistoryView()'), 'main.js declares showHistoryView');
assert(mainContent.includes('function renderHistoryView()'), 'main.js declares renderHistoryView');
assert(mainContent.includes('navHistory?.addEventListener'), 'main.js wires navHistory click');
assert(mainContent.includes("window.location.hash === '#history'"), 'main.js supports #history hash navigation');
assert(mainContent.includes('histChartBody'), 'main.js wires chart bar clicks');
assert(mainContent.includes('histStripViewBtn'), 'main.js wires strip view report button');
assert(mainContent.includes('histTableBody'), 'main.js wires table row actions');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
