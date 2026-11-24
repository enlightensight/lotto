import assert from 'node:assert/strict';
import { parseLotteryBarcode, isPackNumberMatch, getSavedPackJurisdiction, getCleanEmptyState } from '../src/data.js';

console.log('====================================================');
console.log('   VERIFY: SC BARCODE ACCURACY, 65 BOXES, NO GHOST  ');
console.log('====================================================\n');

// 1. SC Barcode Exact Character Preservation (All 12 SC Formats)
console.log('--- 1. SC Barcode 12-Format Verification ---');
const testCases = [
  { raw: '1714-045114-6-002 (027)', game: '1714', pack: '045114', check: '6', tix: 2, display: '1714-045114-6-002 (027)', packSize: 30 },
  { raw: '1714-045114-6-002', game: '1714', pack: '045114', check: '6', tix: 2, display: '1714-045114-6-002 (027)', packSize: 30 },
  { raw: '17140451146002', game: '1714', pack: '045114', check: '6', tix: 2, display: '1714-045114-6-002 (027)', packSize: 30 },
  { raw: '17140451146002027', game: '1714', pack: '045114', check: '6', tix: 2, display: '1714-045114-6-002 (027)', packSize: 30 },
  { raw: '1705-002921-5-069 (080)', game: '1705', pack: '002921', check: '5', tix: 69, display: '1705-002921-5-069 (080)', packSize: 150 },
  { raw: '1705-002921-5-069', game: '1705', pack: '002921', check: '5', tix: 69, display: '1705-002921-5-069 (080)', packSize: 150 },
  { raw: '17050029215069', game: '1705', pack: '002921', check: '5', tix: 69, display: '1705-002921-5-069 (080)', packSize: 150 },
  { raw: '17050029215069080', game: '1705', pack: '002921', check: '5', tix: 69, display: '1705-002921-5-069 (080)', packSize: 150 },
  { raw: '1684-034555-3-004 (026)', game: '1684', pack: '034555', check: '3', tix: 4, display: '1684-034555-3-004 (026)', packSize: 30 },
  { raw: '1684-034555-3-004', game: '1684', pack: '034555', check: '3', tix: 4, display: '1684-034555-3-004 (025)', packSize: 30 },
  { raw: '16840345553004', game: '1684', pack: '034555', check: '3', tix: 4, display: '1684-034555-3-004 (025)', packSize: 30 },
  { raw: '16840345553004026', game: '1684', pack: '034555', check: '3', tix: 4, display: '1684-034555-3-004 (026)', packSize: 30 },
  { raw: '16891495820231', game: '1689', pack: '149582', check: '6', tix: 23, display: '1689-149582-6-023 (006)', packSize: 30 },
  { raw: '1689-149582-6-023(006)', game: '1689', pack: '149582', check: '6', tix: 23, display: '1689-149582-6-023 (006)', packSize: 30 },
  { raw: '1689-149582-6-023 (006)', game: '1689', pack: '149582', check: '6', tix: 23, display: '1689-149582-6-023 (006)', packSize: 30 },
  { raw: '1689-149582-6-023', game: '1689', pack: '149582', check: '6', tix: 23, display: '1689-149582-6-023 (006)', packSize: 30 },
  { raw: '16891495820021', game: '1689', pack: '149582', check: '6', tix: 2, display: '1689-149582-6-002 (027)', packSize: 30 },
  { raw: '1689-149582-6-002 (027)', game: '1689', pack: '149582', check: '6', tix: 2, display: '1689-149582-6-002 (027)', packSize: 30 },
  { raw: '16891495820001', game: '1689', pack: '149582', check: '6', tix: 0, display: '1689-149582-6-000 (029)', packSize: 30 }
];

testCases.forEach(({ raw, game, pack, check, tix, display, packSize }) => {
  const p = parseLotteryBarcode(raw);
  assert.equal(p.isValid, true, `${raw} must be valid`);
  assert.equal(p.gameNumber, game, `${raw} game must be ${game}`);
  assert.equal(p.packNumber, pack, `${raw} pack must be ${pack}`);
  assert.equal(p.checkDigit, check, `${raw} check digit must be ${check}`);
  assert.equal(p.ticketNumber, tix, `${raw} ticket must be ${tix}`);
  assert.equal(p.jurisdiction, 'SC', `${raw} jurisdiction must be SC`);
  assert.equal(p.packSize, packSize, `${raw} packSize must be ${packSize}`);
  assert.equal(p.displayBarcode, display, `${raw} displayBarcode must be ${display}`);
  console.log(`  ✓ PASS: ${raw} -> ${display} [packSize: ${packSize}]`);
});

// 2. Georgia Regression Check
console.log('\n--- 2. Georgia Regression Check ---');
const gaCases = [
  '1648-018378-8-000 (029)',
  '16480183788000029',
  '16480183788000',
  '14170012345001'
];
gaCases.forEach(raw => {
  const p = parseLotteryBarcode(raw, [], 'GA');
  assert.equal(p.isValid, true, `${raw} GA must be valid`);
  assert.notEqual(p.jurisdiction, 'SC', `${raw} must not be SC`);
  console.log(`  ✓ PASS GA: ${raw} -> ${p.displayBarcode}`);
});

// 3. Box 26 Matching During End Shift
console.log('\n--- 3. Box 26 Matching During End Shift ---');
const mockState = {
  slots: [
    { boxNumber: 26, status: 'ACTIVE', packNumber: '045114', gameId: 'sc1714', checkDigit: '6', jurisdiction: 'SC', basePackNumber: '045114', packCombined: '045114-6' }
  ],
  inStockInventory: [],
  inventory: []
};
global.window = { state: mockState };

const savedJur = getSavedPackJurisdiction('045114', '1714');
assert.equal(savedJur, 'SC', 'Must find saved jurisdiction SC');

const pSc = parseLotteryBarcode('1714-045114-6-002 (027)');
const slot26 = mockState.slots[0];
const matches = isPackNumberMatch(slot26.packNumber, pSc.packNumber) ||
  (pSc.packCombined && isPackNumberMatch(slot26.packNumber, pSc.packCombined)) ||
  (slot26.packCombined && isPackNumberMatch(slot26.packCombined, pSc.packNumber));
assert.equal(matches, true, 'Box 26 pack must match scanned ticket');
console.log('  ✓ PASS: Scanned SC ticket matches Box 26 packNumber');

// 4. Clean Empty State has at least 65 boxes
console.log('\n--- 4. Clean State 65 Boxes Guarantee ---');
const clean = getCleanEmptyState({ storeId: 'store_amigo' });
assert.equal(clean.totalSlots >= 65, true, 'Clean state totalSlots must be >= 65');
assert.equal(clean.slots.length >= 65, true, 'Clean state slots.length must be >= 65');
console.log(`  ✓ PASS: getCleanEmptyState initializes ${clean.slots.length} boxes (>= 65)`);

console.log('\n====================================================');
console.log('   ALL SPECIFIC VERIFICATION CHECKS PASSED!        ');
console.log('====================================================');
