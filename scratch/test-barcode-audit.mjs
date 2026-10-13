import { parseLotteryBarcode, findGameByBarcode, normalizePackNumber, SAMPLE_GAMES } from '../src/data.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ testName, details });
    console.error(`❌ FAIL: ${testName} - ${details}`);
  }
}

console.log('=== STARTING EXHAUSTIVE BARCODE AUDIT ===');

// 1. Audit all 27 SAMPLE_GAMES with continuous 14-digit tickets
for (const game of SAMPLE_GAMES) {
  const prefix = game.barcodePrefix;
  const barcode14 = `${prefix}0670170009`;
  const parsed = parseLotteryBarcode(barcode14);
  assert(parsed && parsed.isValid, `Game ${game.name} (${prefix}) 14-digit isValid`);
  assert(parsed && parsed.gameNumber === prefix, `Game ${game.name} (${prefix}) gameNumber match`);
  assert(parsed && parsed.ticketNumber === 9, `Game ${game.name} (${prefix}) ticketNumber === 9`);
  assert(parsed && parsed.ticketString === '009', `Game ${game.name} (${prefix}) ticketString === '009'`);
  assert(parsed && parsed.standardBarcode === barcode14, `Game ${game.name} (${prefix}) standardBarcode`);

  const matched = findGameByBarcode(barcode14);
  assert(matched && matched.id === game.id, `Game ${game.name} findGameByBarcode match`);
}

// 2. Audit Texas/US User formats for 5X MONEY (1417)
const formats5X = [
  {
    code: '1417-0670170-009(290)',
    desc: '3-Part 7-digit pack with PIN',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: '0',
    expectedPin: '290',
    expectedStd: '14170670170009'
  },
  {
    code: '1417-067017-0-009(290)',
    desc: '4-Part with PIN',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: '0',
    expectedPin: '290',
    expectedStd: '14170670170009'
  },
  {
    code: '14170670170009(290)',
    desc: '14-Digit with parenthesized PIN',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: '0',
    expectedPin: '290',
    expectedStd: '14170670170009'
  },
  {
    code: '14170670170009',
    desc: 'Pure 14-Digit standard ticket',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: '0',
    expectedPin: null,
    expectedStd: '14170670170009'
  },
  {
    code: '141706701700098494869032',
    desc: '24-Digit 2D Scanner payload',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: '0',
    expectedPin: null,
    expectedStd: '14170670170009'
  },
  {
    code: '1417-067017-009',
    desc: '3-Part 6-digit pack without PIN',
    expectedTix: 9,
    expectedPack: '067017',
    expectedCheck: null,
    expectedPin: null,
    expectedStd: '14170670170009'
  }
];

for (const t of formats5X) {
  const p = parseLotteryBarcode(t.code);
  assert(p && p.isValid, `${t.desc}: isValid`, JSON.stringify(p));
  assert(p && p.ticketNumber === t.expectedTix, `${t.desc}: ticketNumber === ${t.expectedTix}`);
  assert(p && p.packNumber === t.expectedPack, `${t.desc}: packNumber === ${t.expectedPack}`);
  if (t.expectedCheck !== null) {
    assert(p && p.checkCode === t.expectedCheck, `${t.desc}: checkCode === ${t.expectedCheck}`);
  }
  if (t.expectedPin !== null) {
    assert(p && p.securityCode === t.expectedPin, `${t.desc}: securityCode === ${t.expectedPin}`);
  }
  assert(p && p.standardBarcode === t.expectedStd, `${t.desc}: standardBarcode === ${t.expectedStd}`);
  
  const gm = findGameByBarcode(t.code);
  assert(gm && gm.name === '5X MONEY', `${t.desc}: matched 5X MONEY`);
}

// 3. Audit EPIC RICHES (1648)
const formats1648 = [
  '16480183788000', // Ticket #000
  '16480183780001', // Ticket #001
  '16480183788002', // Ticket #002
  '16480183788029', // Ticket #029 (last ticket)
  '1648-018378-8-029(000)', // Printed 4-part
  '16480183788029000', // 17-digit
  '1648-018378' // Pack manifest
];

for (const c of formats1648) {
  const p = parseLotteryBarcode(c);
  assert(p && p.isValid, `1648 (${c}) isValid`);
  assert(p && p.gameNumber === '1648', `1648 (${c}) gameNumber === 1648`);
  const gm = findGameByBarcode(c);
  assert(gm && gm.name === 'EPIC RICHES', `1648 (${c}) matched EPIC RICHES`);
}

// 4. Audit Ticket Limits & Edge Cases (Valid: 000-299; Invalid: >= 300)
assert(parseLotteryBarcode('14170670170000')?.ticketNumber === 0, 'Ticket #000 is valid');
assert(parseLotteryBarcode('14170670170299')?.ticketNumber === 299, 'Ticket #299 is valid');
const invalid300 = parseLotteryBarcode('14170670170300');
assert(!invalid300 || !invalid300.isValid, 'Ticket #300 is rejected (>299)');

// 5. Retail Store Merchandise (Non-Lottery items must be rejected!)
const retailCodes = [
  '012345678905', // 12-digit UPC-A
  '712345678901', // 12-digit UPC-A
  '12345670',     // 8-digit EAN-8
  '4006381333931', // 13-digit non-lottery EAN-13
  'SN123456789AB', // Alphanumeric serial
  'DELL-XPS-15'    // Laptop asset tag
];

for (const r of retailCodes) {
  const p = parseLotteryBarcode(r);
  assert(!p || !p.isValid, `Retail code ${r} should not be valid lottery`);
  assert(p && (p.isRetailProduct || p.isNonLotteryBarcode), `Retail code ${r} flagged as retail/non-lottery`);
}

// 6. Check normalizer consistency
assert(normalizePackNumber('067017') === '67017', 'normalizePackNumber 067017');
assert(normalizePackNumber('14170670170009') === '67017', 'normalizePackNumber from 14-digit');
assert(normalizePackNumber('1417-067017-0-009(290)') === '67017', 'normalizePackNumber from 4-part');

console.log(`\n=== RESULTS: Passed: ${passed}, Failed: ${failed} ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL AUDIT TESTS PASSED CLEANLY!');
}
