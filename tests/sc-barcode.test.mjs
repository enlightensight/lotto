// ============================================================================
// LOTTO TRACK PRO — SOUTH CAROLINA (SCEL) PRINTED TICKET PARSER TESTS
// Phase 1 Foundation: Verifies Isolated SCEL Printed Pack-Ticket Number Parser
// and guarantees 100% protection of the Georgia Lottery system.
// ============================================================================

import { strict as assert } from 'assert';
import {
  SCEL_GAMES,
  findScelGame,
  parseScelPrintedTicketNumber
} from '../src/scel.js';
import {
  SAMPLE_GAMES,
  isKnownGamePrefix,
  findGameByBarcode,
  parseLotteryBarcode
} from '../src/data.js';

let passedCount = 0;
let failedCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`     ${err.message}`);
  }
}

console.log('====================================================');
console.log('   SCEL PHASE 1 FOUNDATION TESTS                   ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// 1. ISOLATED SCEL GAME CATALOG
// ----------------------------------------------------------------------------
console.log('--- Group 1: SCEL Isolated Game Catalog ---');

test('SCEL_GAMES catalog contains Game 1705 (LIGHT UP THE SEASON)', () => {
  const g = findScelGame('1705');
  assert.ok(g, 'Game 1705 must exist in SCEL_GAMES');
  assert.equal(g.gameNumber, '1705');
  assert.equal(g.name, 'LIGHT UP THE SEASON');
  assert.equal(g.price, 2);
  assert.equal(g.packSize, 150);
  assert.equal(g.bookValue, 300);
  assert.equal(g.jurisdiction, 'SCEL');
});

test('SCEL_GAMES is isolated from Georgia SAMPLE_GAMES', () => {
  // Confirm Game 1705 is NOT present in Georgia's SAMPLE_GAMES
  const inGaCatalog = SAMPLE_GAMES.some(g => g.barcodePrefix === '1705' || g.id === 'g1705' || g.id === 'sc1705');
  assert.equal(inGaCatalog, false, 'SCEL Game 1705 must NOT be added to Georgia SAMPLE_GAMES');
});

test('Georgia SAMPLE_GAMES strictly does not contain SCEL Game 1705', () => {
  const inGaCatalog = SAMPLE_GAMES.some(g => g.barcodePrefix === '1705');
  assert.equal(inGaCatalog, false, 'SAMPLE_GAMES must not contain 1705');
});

test('SCEL printed ticket returns SCEL game object via findGameByBarcode', () => {
  const matched = findGameByBarcode('1705-002921-5-069');
  assert.ok(matched, 'findGameByBarcode must find SCEL Game 1705');
  assert.equal(matched.id, 'sc1705');
});

// ----------------------------------------------------------------------------
// 2. EXACT PRINTED NUMBER EXTRACTION
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: SCEL Printed Ticket Number Extraction ---');

test('Parses exact printed ticket number "1705-002921-5-069"', () => {
  const res = parseScelPrintedTicketNumber('1705-002921-5-069');
  assert.ok(res && res.isValid, 'Result must be valid');
  assert.equal(res.jurisdiction, 'SCEL');
  assert.equal(res.gameNumber, '1705', 'Game number must be 1705');
  assert.equal(res.packNumber, '002921', 'Pack number must be exactly 002921');
  assert.equal(res.checkDigit, '5', 'Check digit must be 5');
  assert.equal(res.ticketNumber, '069', 'Ticket number must be 069');
  assert.equal(res.rawSuffix, null, 'Raw suffix should be null when omitted');
  assert.equal(res.packId, 'SC-1705-002921', 'Pack ID must use SCEL namespace');
  assert.equal(res.ticketId, 'SC-1705-002921-069', 'Ticket ID must use SCEL namespace');
  assert.equal(res.displayString, '1705-002921-5-069');
  assert.ok(res.game && res.game.name === 'LIGHT UP THE SEASON');
});

test('Preserves leading zeros on 6-digit pack number (never strips to 2921)', () => {
  const res = parseScelPrintedTicketNumber('1705-002921-5-069');
  assert.equal(res.packNumber.length, 6, 'Pack number string length must be exactly 6');
  assert.equal(res.packNumber, '002921', 'Pack number must strictly retain "002921"');
  assert.notEqual(res.packNumber, '2921', 'Must NOT strip leading zeros');
});

// ----------------------------------------------------------------------------
// 3. OPTIONAL RAW SUFFIX HANDLING
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Optional Raw Suffix Handling (e.g. "(080)") ---');

test('Parses printed ticket with attached raw suffix "1705-002921-5-069(080)"', () => {
  const res = parseScelPrintedTicketNumber('1705-002921-5-069(080)');
  assert.ok(res && res.isValid);
  assert.equal(res.gameNumber, '1705');
  assert.equal(res.packNumber, '002921');
  assert.equal(res.checkDigit, '5');
  assert.equal(res.ticketNumber, '069');
  assert.equal(res.rawSuffix, '(080)', 'Raw suffix must be preserved as "(080)"');
  assert.equal(res.packId, 'SC-1705-002921', 'Pack ID must not include the suffix');
  assert.equal(res.ticketId, 'SC-1705-002921-069', 'Ticket ID must not include the suffix');
  assert.equal(res.displayString, '1705-002921-5-069 (080)');
});

test('Parses printed ticket with spaced raw suffix "1705-002921-5-069 (080)"', () => {
  const res = parseScelPrintedTicketNumber('1705-002921-5-069 (080)');
  assert.ok(res && res.isValid);
  assert.equal(res.gameNumber, '1705');
  assert.equal(res.packNumber, '002921');
  assert.equal(res.checkDigit, '5');
  assert.equal(res.ticketNumber, '069');
  assert.equal(res.rawSuffix, '(080)');
});

test('Parses bracketed raw suffix "1705-002921-5-069[080]"', () => {
  const res = parseScelPrintedTicketNumber('1705-002921-5-069[080]');
  assert.ok(res && res.isValid);
  assert.equal(res.rawSuffix, '[080]');
});

// ----------------------------------------------------------------------------
// 4. REJECTION OF MALFORMED PRINTED NUMBERS
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Strict Rejection of Malformed Printed Numbers ---');

const malformedCases = [
  { input: '1705-002921-5', reason: 'Missing ticket number' },
  { input: '1705-2921-5-069', reason: 'Pack number is 4 digits instead of required 6' },
  { input: '170-002921-5-069', reason: 'Game number is 3 digits instead of required 4' },
  { input: '1705-002921-55-069', reason: 'Check digit has 2 digits instead of 1' },
  { input: '1705-002921-5-69', reason: 'Ticket number has 2 digits instead of 3' },
  { input: '1705-002921-5-069-01', reason: 'Extra segments' },
  { input: 'ABCD-002921-5-069', reason: 'Non-numeric game number' },
  { input: '1705-002921-X-069', reason: 'Non-numeric check digit' },
  { input: '', reason: 'Empty string' },
  { input: null, reason: 'Null input' },
  { input: undefined, reason: 'Undefined input' }
];

for (const c of malformedCases) {
  test(`Rejects malformed input "${c.input}": ${c.reason}`, () => {
    const res = parseScelPrintedTicketNumber(c.input);
    assert.equal(res.isValid, false, `Expected isValid === false for ${c.input}`);
    assert.equal(res.jurisdiction, 'SCEL');
  });
}

// ----------------------------------------------------------------------------
// 5. REJECTION OF UNSUPPORTED / UNVERIFIED BARCODE FORMATS
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Rejection of Unverified / Continuous Barcode Formats ---');

const unverifiedFormats = [
  { input: '17050029215069', reason: 'Continuous 14-digit barcode (unverified scanner format)' },
  { input: '17050029215069080', reason: 'Continuous 17-digit barcode (unverified scanner format)' },
  { input: '833283017051', reason: '12-digit UPC barcode (not a printed pack-ticket number)' },
  { input: '17050029215', reason: 'Continuous 11-digit pack manifest (unverified scanner format)' },
  { input: '123456789012345678', reason: '18-digit shipment barcode' }
];

for (const c of unverifiedFormats) {
  test(`Rejects unverified scanner format "${c.input}": ${c.reason}`, () => {
    const res = parseScelPrintedTicketNumber(c.input);
    assert.equal(res.isValid, false, `Must reject unverified barcode format: ${c.input}`);
  });
}

// ----------------------------------------------------------------------------
// 6. GEORGIA PARSER IS UNTOUCHED AND RETAINS ITS BEHAVIOR
// ----------------------------------------------------------------------------
console.log('\n--- Group 6: Georgia Parser Verification ---');

test('Georgia parseLotteryBarcode continues to parse Georgia ticket 1648-018378-8-000 (029)', () => {
  const gaRes = parseLotteryBarcode('1648-018378-8-000 (029)');
  assert.equal(gaRes.isValid, true, 'Georgia parser must parse GA Game 1648');
  assert.equal(gaRes.gameNumber, '1648');
  assert.equal(gaRes.basePackNumber, '018378');
  assert.equal(gaRes.packNumber, '0183788');
  assert.equal(gaRes.checkCode, '8');
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`   SCEL TEST RESULTS: Passed: ${passedCount}, Failed: ${failedCount}   `);
console.log('====================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL SCEL PHASE 1 FOUNDATION TESTS PASSED PERFECTLY!\n');
}
