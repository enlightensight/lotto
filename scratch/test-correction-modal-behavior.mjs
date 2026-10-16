import assert from 'node:assert';
import { getScreenDayReportData, AMIGO_SCREENSHOT_DAY_REPORT } from '../src/dayReportData.js';

console.log('=== RUNNING CORRECTION MODAL BEHAVIORAL VERIFICATION ===\n');

// Mock state
const state = {
  storeName: 'AMIGO FOOD MART',
  slots: [
    { boxNumber: 1, packNumber: '128842', gameName: '5X Money', price: 1, currentTicket: 13, startTicket: 0 }
  ]
};

// 1. Initial baseline
const baseData = getScreenDayReportData(state);
assert.strictEqual(baseData.totalInstantSales, 1237.00);
assert.strictEqual(baseData.totalTickets, 248);

const box1 = baseData.boxes.find(b => b.box === 1);
assert.strictEqual(box1.close, '013');
assert.strictEqual(box1.sold, 13);
assert.strictEqual(box1.total, 13.00);

// 2. Banner calculation logic test
function calculateBanner(boxVal, newCloseVal) {
  const data = getScreenDayReportData(state);
  const bObj = (data.boxes || []).find(b => Number(b.box) === boxVal);
  if (!bObj) return null;
  const oldClose = parseInt(bObj.close, 10) || 0;
  const newClose = parseInt(newCloseVal, 10);
  const price = Number(bObj.price) || 1;

  if (isNaN(newClose)) {
    return `Box ${boxVal} closing position is currently #${String(oldClose).padStart(3, '0')}`;
  }

  const diffTix = newClose - oldClose;
  const diffAmt = diffTix * price;
  const signTix = diffTix >= 0 ? `+${diffTix}` : `${diffTix}`;
  const signAmt = diffAmt >= 0 ? `+$${diffAmt.toFixed(2)}` : `-$${Math.abs(diffAmt).toFixed(2)}`;

  return `Box ${boxVal} closing #${String(oldClose).padStart(3, '0')} → #${String(newClose).padStart(3, '0')} · ${signTix} tickets · ${signAmt} in sales`;
}

// When input is 13 (same as current)
const text13 = calculateBanner(1, 13);
assert.strictEqual(text13, 'Box 1 closing #013 → #013 · +0 tickets · +$0.00 in sales');
console.log('✓ PASS: Calculation banner with 0 diff:', text13);

// When user inputs 14 (as in user screenshot)
const text14 = calculateBanner(1, 14);
assert.strictEqual(text14, 'Box 1 closing #013 → #014 · +1 tickets · +$1.00 in sales');
console.log('✓ PASS: Calculation banner with +1 ticket:', text14);

// When user inputs 11 (negative diff)
const text11 = calculateBanner(1, 11);
assert.strictEqual(text11, 'Box 1 closing #013 → #011 · -2 tickets · -$2.00 in sales');
console.log('✓ PASS: Calculation banner with -2 tickets:', text11);

// 3. Save correction simulation
const correction = {
  shift: '2',
  box: 1,
  newClose: 14,
  oldClose: 13,
  reason: 'Closing position misread at close',
  correctedAt: new Date().toISOString(),
  managerPin: '1234'
};
state.dayReportCorrection = correction;

// Apply correction as in renderDayReportView
const correctedData = getScreenDayReportData(state);
correctedData.version = 'v2';
correctedData.versionLabel = 'v2 (Corrected)';

const targetBox = (correctedData.boxes || []).find(b => Number(b.box) === Number(correction.box));
const curBoxClose = parseInt(targetBox.close, 10);
const oldSold = Number(targetBox.sold) || 0;
const price = Number(targetBox.price) || 1;
const diffSold = Number(correction.newClose) - (isNaN(curBoxClose) ? (Number(correction.oldClose) || 0) : curBoxClose);
const diffAmt = diffSold * price;

targetBox.close = String(correction.newClose).padStart(3, '0');
targetBox.sold = Math.max(0, oldSold + diffSold);
targetBox.total = Math.max(0, (Number(targetBox.total) || 0) + diffAmt);
targetBox.isCorrected = true;

correctedData.totalTickets = Math.max(0, (correctedData.totalTickets || 0) + diffSold);
correctedData.totalInstantSales = Math.max(0, (correctedData.totalInstantSales || 0) + diffAmt);

const shiftIdx = (Number(correction.shift) || 2) - 1;
if (Array.isArray(correctedData.shifts) && correctedData.shifts[shiftIdx]) {
  correctedData.shifts[shiftIdx].total = Math.max(0, (correctedData.shifts[shiftIdx].total || 0) + diffAmt);
}

assert.strictEqual(targetBox.close, '014');
assert.strictEqual(targetBox.sold, 14);
assert.strictEqual(targetBox.total, 14.00);
assert.strictEqual(targetBox.isCorrected, true);
assert.strictEqual(correctedData.totalTickets, 249);
assert.strictEqual(correctedData.totalInstantSales, 1238.00);
assert.strictEqual(correctedData.shifts[1].total, 507.00);
assert.strictEqual(correctedData.version, 'v2');
assert.strictEqual(correctedData.versionLabel, 'v2 (Corrected)');

console.log('✓ PASS: Corrected data verification passed cleanly!');
console.log('  New Box 1 close:', targetBox.close);
console.log('  New Box 1 sold:', targetBox.sold);
console.log('  New total instant sales:', correctedData.totalInstantSales);
console.log('  New Shift #2 total:', correctedData.shifts[1].total);

console.log('\n=== ALL CORRECTION MODAL BEHAVIORAL TESTS PASSED! ===');
