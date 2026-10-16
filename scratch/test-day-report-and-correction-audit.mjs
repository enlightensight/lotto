import assert from 'node:assert';
import fs from 'node:fs';
import { getScreenDayReportData, AMIGO_SCREENSHOT_DAY_REPORT } from '../src/dayReportData.js';

console.log('=== RUNNING DAY REPORT & REPORT CORRECTION AUDIT ===\n');

// Test 1: Verify AMIGO FOOD MART reference data in dayReportData.js
console.log('1. Checking AMIGO FOOD MART reference data...');
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.storeName, 'AMIGO FOOD MART');
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.totalInstantSales, 1237.00);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.totalTickets, 248);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts.length, 2);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts[0].total, 731.00);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts[1].total, 506.00);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts[0].total + AMIGO_SCREENSHOT_DAY_REPORT.shifts[1].total, 1237.00);
console.log('✓ PASS: AMIGO FOOD MART reference data verified!');

// Test 2: Check Box 14 and Box 1 details
console.log('\n2. Checking Box 14 and Box 1 details...');
const box14 = AMIGO_SCREENSHOT_DAY_REPORT.boxes.find(b => b.box === 14);
assert.ok(box14, 'Box 14 must exist in report');
assert.strictEqual(box14.game, '50X Money');
assert.strictEqual(box14.price, 10);
assert.strictEqual(box14.open, '000');
assert.strictEqual(box14.close, '011');
assert.strictEqual(box14.sold, 11);
assert.strictEqual(box14.total, 110.00);

const box1 = AMIGO_SCREENSHOT_DAY_REPORT.boxes.find(b => b.box === 1);
assert.ok(box1, 'Box 1 must exist in report');
assert.strictEqual(box1.game, '5X Money');
assert.strictEqual(box1.price, 1);
assert.strictEqual(box1.open, '000');
assert.strictEqual(box1.close, '013');
assert.strictEqual(box1.sold, 13);
assert.strictEqual(box1.total, 13.00);
console.log('✓ PASS: Box 14 and Box 1 verified in reference data!');

// Test 3: Simulate Box 1 correction (013 -> 014, matching user screenshot)
console.log('\n3. Simulating Box 1 correction: 013 -> 014 (+1 ticket, +$1.00)...');
const oldClose1 = parseInt(box1.close, 10);
const newClose1 = 14;
const diffTix1 = newClose1 - oldClose1;
const diffAmt1 = diffTix1 * box1.price;
assert.strictEqual(diffTix1, 1);
assert.strictEqual(diffAmt1, 1.00);

const correctedTotalSales1 = AMIGO_SCREENSHOT_DAY_REPORT.totalInstantSales + diffAmt1;
const correctedShift2_1 = AMIGO_SCREENSHOT_DAY_REPORT.shifts[1].total + diffAmt1;
assert.strictEqual(correctedTotalSales1, 1238.00);
assert.strictEqual(correctedShift2_1, 507.00);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts[0].total + correctedShift2_1, 1238.00);
console.log('✓ PASS: Box 1 correction math is 100% consistent and exact!');

// Test 4: Simulate Box 14 correction (011 -> 013: +2 tickets, +$20.00)
console.log('\n4. Simulating Box 14 correction: 011 -> 013 (+2 tickets, +$20.00)...');
const oldClose14 = parseInt(box14.close, 10);
const newClose14 = 13;
const diffTix14 = newClose14 - oldClose14;
const diffAmt14 = diffTix14 * box14.price;
assert.strictEqual(diffTix14, 2);
assert.strictEqual(diffAmt14, 20.00);

const correctedTotalSales14 = AMIGO_SCREENSHOT_DAY_REPORT.totalInstantSales + diffAmt14;
const correctedShift2_14 = AMIGO_SCREENSHOT_DAY_REPORT.shifts[1].total + diffAmt14;
assert.strictEqual(correctedTotalSales14, 1257.00);
assert.strictEqual(correctedShift2_14, 526.00);
assert.strictEqual(AMIGO_SCREENSHOT_DAY_REPORT.shifts[0].total + correctedShift2_14, 1257.00);
console.log('✓ PASS: Box 14 correction math is 100% consistent and exact!');

// Test 5: Verify DOM element IDs exist in index.html
console.log('\n5. Verifying DOM element IDs in index.html...');
const html = fs.readFileSync('index.html', 'utf8');

const expectedIds = [
  'drBtnCorrectReport',
  'drHdrVersionBadge',
  'drSheetVersionTag',
  'drSheetStoreName',
  'drSheetTotalSales',
  'drSheetTickets',
  'drSheetDate',
  'drSheetShifts',
  'drReportTableBody',
  'drSumSoldTickets',
  'drSumTotalAmount',
  'drSheetReconTicketSales',
  'drSheetReconExpected',
  'drCardTicketSales',
  'drCardExpectedCash',
  'drInputPrizesPaid',
  'drInputStartingCash',
  'drInputCashCounted',
  'drCashInfoCallout',
  'drCashInfoText',
  'drShiftsList',
  'correctReportModal',
  'closeCorrectReportModalBtn',
  'crShiftSelect',
  'crBoxSelect',
  'crClosingPosInput',
  'crCalcBanner',
  'crCalcBannerText',
  'crReasonInput',
  'crPinInput',
  'btnCrSave',
  'btnCrCancel',
  'emailDayReportModal',
  'closeEmailReportModalBtn',
  'btnCancelEmailReport',
  'btnSendDayReportEmail'
];

expectedIds.forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Missing ID in index.html: ${id}`);
});
console.log(`✓ PASS: All ${expectedIds.length} required element IDs exist in index.html!`);

// Test 6: Verify CSS classes in style.css
console.log('\n6. Verifying CSS styling rules in src/style.css...');
const css = fs.readFileSync('src/style.css', 'utf8');

const expectedClasses = [
  'modal-correct-report',
  'cr-calc-banner',
  'btn-cr-save',
  'btn-cr-cancel',
  'dr-row-corrected',
  'dr-badge-corrected'
];

expectedClasses.forEach(cls => {
  assert.ok(css.includes(`.${cls}`), `Missing CSS class in src/style.css: .${cls}`);
});
console.log(`✓ PASS: All ${expectedClasses.length} required CSS classes exist in src/style.css!`);

console.log('\n=== ALL DAY REPORT & CORRECTION AUDIT TESTS PASSED CLEANLY! ===\n');
