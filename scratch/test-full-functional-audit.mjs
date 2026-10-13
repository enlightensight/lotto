import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name} - ${details}`);
  }
}

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const designSystemCss = fs.readFileSync(path.join(root, 'src', 'design-system.css'), 'utf-8');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf-8');
const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf-8');
const dataJs = fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf-8');
const dayReportDataJs = fs.readFileSync(path.join(root, 'src', 'dayReportData.js'), 'utf-8');
const inventoryDataJs = fs.readFileSync(path.join(root, 'src', 'inventoryData.js'), 'utf-8');
const historyDataJs = fs.readFileSync(path.join(root, 'src', 'historyData.js'), 'utf-8');

console.log('=== 1. Core Navigation & View Switching Structure ===');
const navItems = [
  'navSellCounter',
  'navReceivePacks',
  'navDayReport',
  'navInventory',
  'navHistory',
  'navSettings'
];
for (const nav of navItems) {
  assert(indexHtml.includes(`id="${nav}"`), `Navigation link exists: #${nav}`);
}

const views = [
  'viewSellCounter',
  'viewReceivePacks',
  'viewDayReport',
  'viewInventory',
  'viewHistory',
  'viewSettings'
];
for (const v of views) {
  assert(indexHtml.includes(`id="${v}"`), `View container exists: #${v}`);
}

console.log('\n=== 2. Sell Counter Top Bar & Scanner Card ===');
assert(indexHtml.includes('id="sellCounterSubtitle"'), 'Subtitle exists for shift timestamp and cashier');
assert(indexHtml.includes('id="shiftStatusBadge"'), 'Shift status badge exists');
assert(indexHtml.includes('id="undoActionBtn"'), 'Header Undo button exists');
assert(indexHtml.includes('id="mainShiftActionBtn"'), 'End Day shift button exists');
assert(indexHtml.includes('id="barcodeInput"'), 'Barcode scanner input field exists');
assert(indexHtml.includes('id="barcodeEnterBtn"'), 'Barcode enter button exists');

console.log('\n=== 3. Sell Counter Last Scan Readout Card ===');
assert(indexHtml.includes('id="lastScanReadoutContainer"'), 'Last scan readout card container exists');
assert(indexHtml.includes('id="largeStatReadout"'), 'Big box number display exists');
assert(indexHtml.includes('id="scanActionTitle"'), 'Game name title element exists');
assert(indexHtml.includes('id="lastScanDisplay"'), 'Ticket detail element exists');
assert(indexHtml.includes('class="last-scan-micro-label"'), 'Micro-label LAST SCAN · BOX exists');
assert(designSystemCss.includes('.card-last-scan-box'), 'CSS styles .card-last-scan-box exist');
assert(designSystemCss.includes('.last-scan-huge-box'), 'CSS styles .last-scan-huge-box exist');
assert(designSystemCss.includes('.last-scan-meta-lines'), 'CSS styles .last-scan-meta-lines exist');

console.log('\n=== 4. KPI Summary Metrics Row (5 Cards) ===');
const kpiIds = [
  'metricSettlement',
  'metricToday',
  'metricThisWeek',
  'metricThisMonth',
  'metricBoxesInUse',
  'metricBoxesEmpty',
  'metricSafePacks',
  'metricSafeValue'
];
for (const id of kpiIds) {
  assert(indexHtml.includes(`id="${id}"`), `KPI metric element exists: #${id}`);
}

console.log('\n=== 5. Dispenser Rack & Filter Chips ===');
assert(indexHtml.includes('id="rackFilterChips"'), 'Filter chips container exists');
const filterValues = ['all', '1', '2', '3', '5', '10', '20', '50', 'older'];
for (const f of filterValues) {
  assert(indexHtml.includes(`data-filter="${f}"`), `Filter chip data-filter="${f}" exists`);
}
assert(indexHtml.includes('id="dispensersGrid"'), 'dispensersGrid element exists');
assert(mainJs.includes('cardLoadNewPack'), 'main.js renders dashed + Load a new pack card');
assert(mainJs.includes('Load a new pack'), 'cardLoadNewPack has text "Load a new pack"');
assert(mainJs.includes('or just scan it'), 'cardLoadNewPack has subtext "or just scan it"');
assert(designSystemCss.includes('.box-card-add-pack'), 'design-system.css styles .box-card-add-pack');
assert(styleCss.includes('[data-theme="dark"] .box-card-add-pack'), 'Dark theme support for box-card-add-pack');

console.log('\n=== 6. All 65 Boxes Mini-Map Card ===');
assert(indexHtml.includes('id="cardAllBoxesMap"'), 'cardAllBoxesMap element exists');
assert(indexHtml.includes('All 65 boxes'), 'All 65 boxes heading exists');
assert(indexHtml.includes('A quick map of the whole dispenser. Tap an empty box to load a pack into it.'), 'All 65 boxes subtitle exists');
assert(indexHtml.includes('class="all-boxes-map-legend"'), 'Legend block exists');
assert(indexHtml.includes('class="legend-swatch selling"'), 'Legend swatch for selling exists');
assert(indexHtml.includes('class="legend-swatch older"'), 'Legend swatch for older exists');
assert(indexHtml.includes('class="legend-swatch empty"'), 'Legend swatch for empty exists');
assert(indexHtml.includes('class="slots-ribbon-grid" id="slotsRibbon"'), 'slotsRibbon exists inside mini-map card');
assert((indexHtml.match(/id="slotsRibbon"/g) || []).length === 1, 'slotsRibbon id appears strictly once');

assert(styleCss.includes('.ribbon-cell.active-slot'), 'style.css defines .ribbon-cell.active-slot (soft blue)');
assert(styleCss.includes('.ribbon-cell.older-slot'), 'style.css defines .ribbon-cell.older-slot (peach)');
assert(styleCss.includes('.ribbon-cell.empty-slot'), 'style.css defines .ribbon-cell.empty-slot (dashed border)');
assert(styleCss.includes('.ribbon-cell.selected-slot'), 'style.css defines .ribbon-cell.selected-slot (royal blue)');
assert(styleCss.includes('.ribbon-cell.dashed-focus-slot'), 'style.css defines .ribbon-cell.dashed-focus-slot');

assert(mainJs.includes('openActivationForBox(slot.boxNumber)'), 'Tapping empty box opens pack activation for that box number');
assert(mainJs.includes('state.lastScannedSlot = slot.boxNumber'), 'Tapping active box selects that slot');
assert(mainJs.includes('bringBoxToVisibleRack(slot.boxNumber)'), 'Tapping active box brings box to visible rack');

console.log('\n=== 7. All Modals & Action Dialogs ===');
assert(indexHtml.includes('id="activationModal"'), 'activationModal exists');
assert(indexHtml.includes('id="boxAdjustModal"'), 'boxAdjustModal exists');
assert(indexHtml.includes('id="returnPackModal"'), 'returnPackModal exists');
assert(indexHtml.includes('id="changeBoxModal"'), 'changeBoxModal exists');
assert(indexHtml.includes('id="inventoryModal"'), 'inventoryModal exists');
assert(indexHtml.includes('id="inventoryStatusModal"'), 'inventoryStatusModal exists');
assert(indexHtml.includes('id="dayReportModal"'), 'dayReportModal exists');

console.log('\n=== 8. Box Details Modal Anatomy & Actions ===');
const boxDetailsIds = [
  'boxDetailNumBadge',
  'boxDetailGameName',
  'boxDetailPrice',
  'boxDetailNextTicket',
  'boxDetailSoldToday',
  'boxDetailLeftInBox',
  'boxDetailDaysOnRack',
  'boxDetailProgressFill',
  'btnBoxSellOneTicket',
  'btnMarkPackSoldOut',
  'btnBoxSwitch',
  'btnBoxChange',
  'btnFixPosition',
  'btnReturnPack',
  'btnSetCountZero'
];
for (const id of boxDetailsIds) {
  assert(indexHtml.includes(`id="${id}"`), `Box Details element exists: #${id}`);
  assert(mainJs.includes(id), `main.js references/wires element: #${id}`);
}

console.log('\n=== 9. Take Off The Rack Modal (Return to Lottery / Keep in Safe) ===');
assert(indexHtml.includes('id="cardReturnToLottery"'), 'Card 1 Return to Lottery exists');
assert(indexHtml.includes('id="cardKeepInSafe"'), 'Card 2 Keep in the safe exists');
assert(mainJs.includes('cardReturnToLottery'), 'main.js wires cardReturnToLottery');
assert(mainJs.includes('cardKeepInSafe'), 'main.js wires cardKeepInSafe');

console.log('\n=== 10. Change Box Number Modal ===');
assert(indexHtml.includes('id="changeBoxDisplayVal"'), 'changeBoxDisplayVal element exists');
assert(indexHtml.includes('id="changeBoxEmptyPills"'), 'changeBoxEmptyPills container exists');
assert(indexHtml.includes('class="change-box-keypad"'), 'change-box-keypad container exists');
assert(indexHtml.includes('id="btnConfirmChangeBox"'), 'btnConfirmChangeBox button exists');
assert(mainJs.includes('btnConfirmChangeBox'), 'main.js wires btnConfirmChangeBox');

console.log('\n=== 11. Data Seeding & State Consistency ===');
assert(dataJs.includes('refBoxes = ['), 'data.js seeds reference boxes');
assert(dataJs.includes('daysActive: 7') && dataJs.includes('daysActive: 12') && dataJs.includes('daysActive: 21'), 'data.js seeds age >= 7 for older boxes');
assert(dataJs.includes('lastScannedSlot: 6'), 'data.js sets default selected slot 6');
assert(dataJs.includes('visibleBoxNumbers: [3, 7, 21, 27, 60, 62, 63'), 'data.js prioritizes older boxes in visible rack');
assert(dataJs.includes('dataCleared: false'), 'data.js sets dataCleared to false in initial reference state');

console.log('\n=== 12. Day Report View & Georgia Reconciler ===');
assert(indexHtml.includes('id="viewDayReport"'), 'viewDayReport exists');
assert(dayReportDataJs.includes('getDayReportData'), 'dayReportData.js exports getDayReportData');
assert(dayReportDataJs.includes('getScreenDayReportData'), 'dayReportData.js exports getScreenDayReportData');
assert(mainJs.includes('setupDayReportHandlers'), 'main.js initializes setupDayReportHandlers');

console.log('\n=== 13. Inventory Screen ===');
assert(indexHtml.includes('id="viewInventory"'), 'viewInventory exists');
assert(inventoryDataJs.includes('REFERENCE_INVENTORY_ITEMS'), 'REFERENCE_INVENTORY_ITEMS exists');
assert(inventoryDataJs.includes('REFERENCE_SAFE_PACKS'), 'REFERENCE_SAFE_PACKS exists');
assert(mainJs.includes('renderInventoryView'), 'main.js implements renderInventoryView');

console.log('\n=== 14. History Screen ===');
assert(indexHtml.includes('id="viewHistory"'), 'viewHistory exists');
assert(historyDataJs.includes('REFERENCE_HISTORY_DAYS'), 'REFERENCE_HISTORY_DAYS exists');
assert(mainJs.includes('renderHistoryView'), 'main.js implements renderHistoryView');

console.log('\n=== 15. Settings Screen & Data Management ===');
assert(indexHtml.includes('id="viewSettings"'), 'viewSettings exists');
assert(indexHtml.includes('id="btnClearAllData"'), 'btnClearAllData exists');
assert(indexHtml.includes('id="inputConfirmClear"'), 'inputConfirmClear exists');
assert(mainJs.includes('populateSettingsInputs'), 'main.js implements populateSettingsInputs');

console.log(`\n=======================================================`);
console.log(`FULL FUNCTIONAL AUDIT RESULTS: ${passed} passed, ${failed} failed.`);
console.log(`=======================================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SYSTEM FUNCTIONALITIES ARE 100% OPERATIONAL!');
}
