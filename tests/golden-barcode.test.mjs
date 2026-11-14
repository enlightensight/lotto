// ============================================================================
// LOTTO TRACK PRO — BARCODE GOLDEN CHARACTERIZATION TESTS
// Phase 0 Safety Net: Captures inputs and outputs of every parser and scan validation path.
// This test suite MUST pass unchanged at the end of every later phase.
// ============================================================================

import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

import {
  parseLotteryBarcode,
  formatLotteryBarcode,
  normalizePackNumber,
  isPackNumberMatch,
  findGameByBarcode,
  getStandardPackDetails,
  SAMPLE_GAMES,
  getCleanEmptyState
} from '../src/data.js';

let passedCount = 0;
let failedCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.message}`);
  }
}

console.log('====================================================');
console.log('   RUNNING BARCODE GOLDEN TESTS (PHASE 0 SAFETY)   ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// 1. EXTRACT AND TEST parseBoxBarcode FROM src/main.js
// ----------------------------------------------------------------------------
const mainJsContent = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
const boxParserMatch = mainJsContent.match(/function parseBoxBarcode\(barcode\) \{[\s\S]*?\n  \}/);
assert(boxParserMatch, 'parseBoxBarcode must exist in src/main.js');

// Dynamically evaluate the exact live parseBoxBarcode function
const parseBoxBarcode = new Function('barcode', `${boxParserMatch[0]}; return parseBoxBarcode(barcode);`);

console.log('--- Group 1: Dispenser Box Barcode Parser ---');

const validBoxCases = [
  { input: 'BOX-01', expected: 1 },
  { input: 'BOX-1', expected: 1 },
  { input: 'BOX-65', expected: 65 },
  { input: 'BOX05', expected: 5 },
  { input: 'BOX 5', expected: 5 },
  { input: 'BOX#5', expected: 5 },
  { input: '*BOX05*', expected: 5 },
  { input: 'B-05', expected: 5 },
  { input: 'B05', expected: 5 },
  { input: 'b5', expected: 5 },
  { input: 'B65', expected: 65 },
  { input: 'SLOT-05', expected: 5 },
  { input: 'SLOT 5', expected: 5 },
  { input: 'slot-12', expected: 12 },
  { input: 'bin-3', expected: 3 },
  { input: 'dispenser10', expected: 10 },
  { input: '1', expected: 1 },
  { input: '9', expected: 9 },
  { input: '15', expected: 15 },
  { input: '65', expected: 65 },
  { input: '99', expected: 99 }
];

for (const c of validBoxCases) {
  test(`parseBoxBarcode("${c.input}") === ${c.expected}`, () => {
    const res = parseBoxBarcode(c.input);
    assert.equal(res, c.expected, `Expected ${c.expected} for "${c.input}", got ${res}`);
  });
}

const invalidBoxCases = ['BOX-', 'XYZ', '', null, undefined, '101', '150', 'BOX-ABC', '16480183788000'];
for (const input of invalidBoxCases) {
  test(`parseBoxBarcode("${input}") === null (reject non-box)`, () => {
    const res = parseBoxBarcode(input);
    assert.equal(res, null, `Expected null for non-box "${input}", got ${res}`);
  });
}

// ----------------------------------------------------------------------------
// 2. GOLDEN TEST: ALL 27 SAMPLE_GAMES INVENTORY WITH 14-DIGIT TICKETS
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: All 27 Georgia Lottery Active Games (14-digit) ---');

assert.ok(SAMPLE_GAMES.length >= 27, 'Codebase must define at least 27 SAMPLE_GAMES');

for (const game of SAMPLE_GAMES) {
  test(`SAMPLE_GAME: ${game.name} (${game.barcodePrefix}) parses correctly`, () => {
    const prefix = game.barcodePrefix;
    const standardBarcode = `${prefix}0670170009`;
    const parsed = parseLotteryBarcode(standardBarcode);

    assert(parsed, 'Parsed object should not be null');
    assert.equal(parsed.isValid, true, 'Barcode should be valid');
    assert.equal(parsed.gameNumber, prefix, 'gameNumber matches game prefix');
    assert.equal(parsed.packNumber, '067017', 'packNumber is 067017');
    assert.equal(parsed.packClean, '67017', 'packClean strips leading zero');
    assert.equal(parsed.ticketNumber, 9, 'ticketNumber is 9');
    assert.equal(parsed.ticketString, '009', 'ticketString is 009');
    assert.equal(parsed.standardBarcode, standardBarcode, 'standardBarcode preserved');

    const matchedGame = findGameByBarcode(standardBarcode);
    assert(matchedGame, 'findGameByBarcode must find the game');
    assert.equal(matchedGame.id, game.id, 'Found game id must match');
    assert.equal(matchedGame.name, game.name, 'Found game name must match');
  });
}

// ----------------------------------------------------------------------------
// 3. GOLDEN TEST: PHYSICAL SCRATCH-OFF BARCODE FORMATS (EPIC RICHES #1648)
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Physical Ticket Formats for Game #1648 (EPIC RICHES) ---');

const goldenFormats1648 = [
  {
    desc: '14-digit continuous barcode (start ticket 000)',
    input: '16480183788000',
    expected: {
      isValid: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      ticketNumber: 0,
      ticketString: '000',
      standardBarcode: '16480183788000'
    }
  },
  {
    desc: '14-digit continuous barcode with 0 check digit (ticket 001)',
    input: '16480183780001',
    expected: {
      isValid: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      ticketNumber: 1,
      ticketString: '001',
      standardBarcode: '16480183780001'
    }
  },
  {
    desc: '14-digit continuous barcode (ticket 002)',
    input: '16480183788002',
    expected: {
      isValid: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      ticketNumber: 2,
      ticketString: '002',
      standardBarcode: '16480183788002'
    }
  },
  {
    desc: '4-segment printed text with parentheses PIN: 1648-018378-8-029(000)',
    input: '1648-018378-8-029(000)',
    expected: {
      isValid: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      ticketNumber: 29,
      ticketString: '029',
      standardBarcode: '16480183788029'
    }
  },
  {
    desc: '17-digit barcode (4 game + 6 pack + 1 check + 3 ticket + 3 PIN)',
    input: '16480183788029000',
    expected: {
      isValid: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      ticketNumber: 29,
      ticketString: '029',
      standardBarcode: '16480183788029'
    }
  },
  {
    desc: '11-digit pack manifest barcode (game + pack + check)',
    input: '16480183788',
    expected: {
      isValid: true,
      isPackBarcode: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      standardBarcode: '16480183788'
    }
  },
  {
    desc: '10-digit pack manifest barcode (game + pack)',
    input: '1648018378',
    expected: {
      isValid: true,
      isPackBarcode: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      standardBarcode: '1648018378'
    }
  },
  {
    desc: 'Delimited pack manifest: 1648-018378',
    input: '1648-018378',
    expected: {
      isValid: true,
      isPackBarcode: true,
      gameNumber: '1648',
      packNumber: '018378',
      packClean: '18378',
      standardBarcode: '1648018378'
    }
  }
];

for (const g of goldenFormats1648) {
  test(`Golden 1648: ${g.desc}`, () => {
    const p = parseLotteryBarcode(g.input);
    assert(p, `parseLotteryBarcode returned null for "${g.input}"`);
    assert.equal(p.isValid, g.expected.isValid);
    assert.equal(p.gameNumber, g.expected.gameNumber);
    assert.equal(p.packNumber, g.expected.packNumber);
    assert.equal(p.packClean, g.expected.packClean);
    if (g.expected.ticketNumber !== undefined) {
      assert.equal(p.ticketNumber, g.expected.ticketNumber);
      assert.equal(p.ticketString, g.expected.ticketString);
    }
    if (g.expected.isPackBarcode) {
      assert.equal(p.isPackBarcode, true);
    }
  });
}

// ----------------------------------------------------------------------------
// 4. GOLDEN TEST: SCANNER HARDWARE PREFIXES, URLS & 2D PAYLOADS
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Scanner Hardware Prefixes, URLs & 2D Payloads ---');

test('Scanner AIM 3-char symbology prefix stripped cleanly: ]C0116480183788000', () => {
  const p = parseLotteryBarcode(']C0116480183788000');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '16480183788000');
});

test('Code 39 start/stop asterisks stripped: *16480183788000*', () => {
  const p = parseLotteryBarcode('*16480183788000*');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '16480183788000');
});

test('Scanner 15-digit leading zero stripped: 016480183788000', () => {
  const p = parseLotteryBarcode('016480183788000');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '16480183788000');
});

test('Scanner 16-digit double leading zero stripped: 0016480183788000', () => {
  const p = parseLotteryBarcode('0016480183788000');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '16480183788000');
});

test('Georgia Lottery URL scan: https://www.galottery.com/entry?ticket=16480183788000', () => {
  const p = parseLotteryBarcode('https://www.galottery.com/entry?ticket=16480183788000');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '16480183788000');
});

test('SCEL URL scan: http://scel.net/b=14170670170009', () => {
  const p = parseLotteryBarcode('http://scel.net/b=14170670170009');
  assert.equal(p?.isValid, true);
  assert.equal(p?.standardBarcode, '14170670170009');
});

test('Physical Ticket 1828 (XTREME BUCKS $2) 24-digit barcode: 182800385621002774086718', () => {
  const p = parseLotteryBarcode('182800385621002774086718');
  assert(p, 'Must not be null');
  assert.equal(p.isValid, true, 'Must be valid lottery ticket');
  assert.equal(p.gameNumber, '1828');
  assert.equal(p.packNumber, '003856');
  assert.equal(p.packClean, '3856');
  assert.equal(p.ticketNumber, 100);
  assert.equal(p.ticketString, '100');
  assert.equal(p.checkCode, '2');
  assert.equal(p.securityCode, '049');
  assert.equal(p.standardBarcode, '18280038562100');
  assert.equal(p.canonicalId, '1828-003856-2-100');
  assert.equal(p.displayBarcode, '1828-003856-2-100 (049)');
});

// ----------------------------------------------------------------------------
// 5. GOLDEN TEST: REJECTION OF NON-LOTTERY, STORE MERCHANDISE & CORRUPT DATA
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Strict Rejections (Retail, Alpha, Out-of-Range) ---');

const rejectionCases = [
  { code: '2731-590419', reason: 'Scanner hardware box product barcode' },
  { code: '012345678905', reason: '12-digit UPC-A grocery product' },
  { code: '712345678901', reason: '12-digit UPC-A merchandise' },
  { code: '12345670', reason: '8-digit EAN-8 retail merchandise' },
  { code: 'SN123456789AB', reason: 'Alphanumeric serial number' },
  { code: 'DELL-XPS-15', reason: 'Laptop asset tag' },
  { code: '', reason: 'Empty string' },
  { code: '    ', reason: 'Whitespace string' }
];

for (const r of rejectionCases) {
  test(`Rejection: "${r.code}" (${r.reason})`, () => {
    const p = parseLotteryBarcode(r.code);
    const isInvalid = !p || !p.isValid;
    assert(isInvalid, `Code "${r.code}" must be rejected as invalid lottery`);
  });
}

// ----------------------------------------------------------------------------
// 6. GOLDEN TEST: PACK NORMALIZATION & HIGH-PRECISION MATCHING
// ----------------------------------------------------------------------------
console.log('\n--- Group 6: Pack Normalization and Matching ---');

test('normalizePackNumber extracts canonical digits across formats', () => {
  assert.equal(normalizePackNumber('018378'), '18378');
  assert.equal(normalizePackNumber('067017'), '67017');
  assert.equal(normalizePackNumber('000123'), '123');
  assert.equal(normalizePackNumber('1648-018378'), '18378');
  assert.equal(normalizePackNumber('16480183788000'), '18378');
  assert.equal(normalizePackNumber('16480183788'), '18378');
});

test('isPackNumberMatch matches exact, cross-format and legacy 7-digit corruptions', () => {
  assert.equal(isPackNumberMatch('018378', '18378'), true);
  assert.equal(isPackNumberMatch('018378', '16480183788000'), true);
  assert.equal(isPackNumberMatch('018378', '1648-018378'), true);
  assert.equal(isPackNumberMatch('16480183788', '16480183788000'), true);
  // Different packs must NEVER match
  assert.equal(isPackNumberMatch('018378', '018379'), false);
  assert.equal(isPackNumberMatch('14170670170009', '14180996564081'), false);
});

// ----------------------------------------------------------------------------
// 7. GOLDEN TEST: DISPLAY BARCODE FORMATTING
// ----------------------------------------------------------------------------
console.log('\n--- Group 7: Ticket Display Formatting ---');

test('formatLotteryBarcode matches authentic Georgia Lottery scratch ticket format', () => {
  const f1 = formatLotteryBarcode('16480183788000');
  assert(f1.includes('1648') && f1.includes('18378'));

  const f4 = formatLotteryBarcode('16480183788');
  assert(f4.includes('1648') && f4.includes('18378'));
});

// ----------------------------------------------------------------------------
// 8. GOLDEN TEST: STANDARD PACK DETAILS & SIZES
// ----------------------------------------------------------------------------
console.log('\n--- Group 8: Standard Pack Sizes & Pack Values ---');

const standardPrices = [
  { price: 1, expectedSize: 300, expectedBookValue: 300 },
  { price: 2, expectedSize: 150, expectedBookValue: 300 },
  { price: 3, expectedSize: 100, expectedBookValue: 300 },
  { price: 5, expectedSize: 60, expectedBookValue: 300 },
  { price: 10, expectedSize: 30, expectedBookValue: 300 },
  { price: 20, expectedSize: 15, expectedBookValue: 300 },
  { price: 25, expectedSize: 12, expectedBookValue: 300 },
  { price: 30, expectedSize: 10, expectedBookValue: 300 },
  { price: 50, expectedSize: 18, expectedBookValue: 900 }
];

for (const p of standardPrices) {
  test(`Standard pack details for $${p.price} ticket`, () => {
    const std = getStandardPackDetails(p.price);
    assert.equal(std.packSize, p.expectedSize, `Expected size ${p.expectedSize} for $${p.price}`);
    assert.equal(std.bookValue, p.expectedBookValue, `Expected bookValue ${p.expectedBookValue} for $${p.price}`);
  });
}

// ----------------------------------------------------------------------------
// 9. GOLDEN TEST: PHYSICAL TICKET #1658 (PLAYERS CLUB $10 - SCEL DUAL LAYOUT)
// ----------------------------------------------------------------------------
console.log('\n--- Group 9: Physical Ticket #1658 (PLAYERS CLUB $10) ---');

test('Physical Ticket 1658 printed text: 1658-350877-3-029(000)', () => {
  const p = parseLotteryBarcode('1658-350877-3-029(000)');
  assert(p && p.isValid, 'Barcode must be valid');
  assert.equal(p.gameNumber, '1658');
  assert.equal(p.packNumber, '350877');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 29);
  assert.equal(p.ticketString, '029');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1658-350877-3-029 (000)');

  const formatted = formatLotteryBarcode('1658-350877-3-029(000)');
  assert.equal(formatted, '1658-350877-3-029 (000)');

  const game = findGameByBarcode('1658-350877-3-029(000)');
  assert(game, 'Game must be identified');
  assert.equal(game.name, 'PLAYERS CLUB');
  assert.equal(game.price, 10);
});

test('Physical Ticket 1658 scanned raw 14-digit barcode: 16583508770290', () => {
  const p = parseLotteryBarcode('16583508770290');
  assert(p && p.isValid, 'Barcode must be valid');
  assert.equal(p.gameNumber, '1658');
  assert.equal(p.packNumber, '350877');
  assert.equal(p.ticketNumber, 29, 'Ticket number must be 29 (ticket 029), NOT 290!');
  assert.equal(p.ticketString, '029');
  assert.equal(p.securityCode, '000', 'Security PIN for ticket 29 in 30-pack is (30-1)-29 = 000');
  assert.equal(p.displayBarcode, '1658-350877-029 (000)');

  const formatted = formatLotteryBarcode('16583508770290');
  assert.equal(formatted, '1658-350877-029 (000)', 'Formatted barcode must match our barcode style');

  const game = findGameByBarcode('16583508770290');
  assert(game, 'Game must be identified');
  assert.equal(game.name, 'PLAYERS CLUB');
  assert.equal(game.price, 10);
});

test('Cross-matching 1658 printed text with scanned barcode pack', () => {
  assert.equal(isPackNumberMatch('350877', '16583508770290'), true);
  assert.equal(isPackNumberMatch('350877', '1658-350877-3-029(000)'), true);
  assert.equal(normalizePackNumber('16583508770290'), '350877');
  assert.equal(normalizePackNumber('1658-350877-3-029(000)'), '350877');
});

// ----------------------------------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`   GOLDEN TEST RESULTS: Passed: ${passedCount}, Failed: ${failedCount}   `);
console.log('====================================================');

if (failedCount > 0) {
  console.error(`\n❌ TEST SUITE FAILED with ${failedCount} errors.`);
  process.exit(1);
} else {
  console.log('\n✅ ALL GOLDEN BARCODE CHARACTERIZATION TESTS PASSED PERFECTLY!');
  process.exit(0);
}
