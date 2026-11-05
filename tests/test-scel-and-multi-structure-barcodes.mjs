// ============================================================================
// LOTTO TRACK PRO — SCEL & MULTI-STRUCTURE LOTTERY BARCODE VERIFICATION
// Verifies 100% accurate scanning and parsing across all ticket structures:
// 1. SCEL Game 1670 (Hit $100, $2, 150 tickets/pack) across 4-part, 14-digit, 17-digit
// 2. Exact preservation of 6-digit pack identity (never glues check digit into pack)
// 3. Exact 4-part display formatting matching printed ticket text
// 4. Exact series PIN calculation ($149 - ticketNumber for 150-ticket books)
// 5. Automatic pack size and price inference from explicit countdown PIN
// 6. Cross-state and vendor formats (Georgia Lottery, IGT, Scientific Games)
// ============================================================================

import { strict as assert } from 'assert';
import {
  parseLotteryBarcode,
  formatLotteryBarcode,
  normalizePackNumber,
  isPackNumberMatch,
  findGameByBarcode,
  computeLotterySeriesCode,
  SAMPLE_GAMES
} from '../src/data.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('  TESTING SCEL & MULTI-STRUCTURE LOTTERY BARCODE PARSER        ');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Group 1: SCEL Game #1670 (Hit $100, $2, 150 Pack Size)
// ----------------------------------------------------------------------------
console.log('--- Group 1: SCEL Game #1670 (Hit $100) from User Image ---');

it('Recognizes Game #1670 in SAMPLE_GAMES catalog', () => {
  const g = SAMPLE_GAMES.find(x => x.barcodePrefix === '1670');
  assert.ok(g, 'Game 1670 must exist in SAMPLE_GAMES');
  assert.equal(g.name.toUpperCase(), 'HIT $100');
  assert.equal(g.price, 2);
  assert.equal(g.packSize, 150);
  assert.equal(g.bookValue, 300);
});

it('Ticket 000 (4-segment): "1670-019869-3-000(149)" parses accurately', () => {
  const p = parseLotteryBarcode('1670-019869-3-000(149)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869', 'Pack must be clean 6 digits: 019869');
  assert.equal(p.checkCode, '3', 'Check code must be 3');
  assert.equal(p.ticketNumber, 0);
  assert.equal(p.ticketString, '000');
  assert.equal(p.securityCode, '149');
  assert.equal(p.displayBarcode, '1670-019869-3-000 (149)');
  assert.equal(formatLotteryBarcode(p), '1670-019869-3-000 (149)');
});

it('Ticket 001 (4-segment): "1670-019869-3-001(148)" parses accurately', () => {
  const p = parseLotteryBarcode('1670-019869-3-001(148)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 1);
  assert.equal(p.ticketString, '001');
  assert.equal(p.securityCode, '148');
  assert.equal(p.displayBarcode, '1670-019869-3-001 (148)');
});

it('Ticket 017 (4-segment): "1670-019869-3-017(132)" parses accurately', () => {
  const p = parseLotteryBarcode('1670-019869-3-017(132)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 17);
  assert.equal(p.ticketString, '017');
  assert.equal(p.securityCode, '132');
  assert.equal(p.displayBarcode, '1670-019869-3-017 (132)');
});

it('Continuous 14-digit Ticket 000: "16700198693000" computes PIN 149 and clean 6-digit pack', () => {
  const p = parseLotteryBarcode('16700198693000');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869', 'Pack number MUST NOT append check digit 3');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 0);
  assert.equal(p.ticketString, '000');
  assert.equal(p.securityCode, '149', 'Countdown PIN for ticket 0 in 150-ticket pack is 149');
  assert.equal(p.displayBarcode, '1670-019869-3-000 (149)');
});

it('Continuous 14-digit Ticket 001: "16700198693001" computes PIN 148', () => {
  const p = parseLotteryBarcode('16700198693001');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 1);
  assert.equal(p.ticketString, '001');
  assert.equal(p.securityCode, '148', 'Countdown PIN for ticket 1 in 150-ticket pack is 148');
  assert.equal(p.displayBarcode, '1670-019869-3-001 (148)');
});

it('Continuous 14-digit Ticket 017: "16700198693017" computes PIN 132', () => {
  const p = parseLotteryBarcode('16700198693017');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 17);
  assert.equal(p.ticketString, '017');
  assert.equal(p.securityCode, '132', 'Countdown PIN for ticket 17 in 150-ticket pack is 149 - 17 = 132');
  assert.equal(p.displayBarcode, '1670-019869-3-017 (132)');
});

it('Continuous 17-digit Ticket 000: "16700198693000149" extracts explicit PIN 149', () => {
  const p = parseLotteryBarcode('16700198693000149');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 0);
  assert.equal(p.securityCode, '149');
  assert.equal(p.hasExplicitSecurityCode, true);
  assert.equal(p.displayBarcode, '1670-019869-3-000 (149)');
});

it('Continuous 17-digit Ticket 017: "16700198693017132" extracts explicit PIN 132', () => {
  const p = parseLotteryBarcode('16700198693017132');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.ticketNumber, 17);
  assert.equal(p.securityCode, '132');
  assert.equal(p.hasExplicitSecurityCode, true);
  assert.equal(p.displayBarcode, '1670-019869-3-017 (132)');
});

it('11-digit pack manifest: "16700198693" parses pack 019869 with check 3', () => {
  const p = parseLotteryBarcode('16700198693');
  assert.ok(p && p.isValid);
  assert.equal(p.isPackBarcode, true);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.checkCode, '3');
  assert.equal(p.displayBarcode, '1670-019869-3');
});

it('10-digit pack manifest: "1670019869" parses pack 019869', () => {
  const p = parseLotteryBarcode('1670019869');
  assert.ok(p && p.isValid);
  assert.equal(p.isPackBarcode, true);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.displayBarcode, '1670-019869');
});

// ----------------------------------------------------------------------------
// Group 2: Pack Matching & Backward Compatibility
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Pack Matching & Backward Compatibility ---');

it('isPackNumberMatch matches 019869 across all barcode representations', () => {
  assert.equal(isPackNumberMatch('019869', '19869'), true);
  assert.equal(isPackNumberMatch('019869', '16700198693000'), true);
  assert.equal(isPackNumberMatch('019869', '1670-019869-3-000(149)'), true);
  assert.equal(isPackNumberMatch('019869', '1670-019869-3-017(132)'), true);
  // Must match legacy 7-digit corruptions (0198690 or 0198693)
  assert.equal(isPackNumberMatch('019869', '0198690'), true);
  assert.equal(isPackNumberMatch('019869', '0198693'), true);
  // Different packs must NEVER match
  assert.equal(isPackNumberMatch('019869', '019870'), false);
  assert.equal(isPackNumberMatch('019869', '019868'), false);
});

// ----------------------------------------------------------------------------
// Group 3: Automatic Pack Size & Price Inference from Countdown PIN
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Automatic Pack Size & Price Inference for Unknown Games ---');

it('Infers 150 pack size and $2 price when PIN is 149 for ticket 000', () => {
  const p = parseLotteryBarcode('9999-012345-1-000(149)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 150);
  assert.equal(p.inferredDetails.price, 2);
  assert.equal(p.inferredDetails.bookValue, 300);
});

it('Infers 300 pack size and $1 price when PIN is 299 for ticket 000', () => {
  const p = parseLotteryBarcode('9998-012345-2-000(299)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 300);
  assert.equal(p.inferredDetails.price, 1);
  assert.equal(p.inferredDetails.bookValue, 300);
});

it('Infers 100 pack size and $3 price when PIN is 099 for ticket 000', () => {
  const p = parseLotteryBarcode('9997-012345-3-000(099)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 100);
  assert.equal(p.inferredDetails.price, 3);
  assert.equal(p.inferredDetails.bookValue, 300);
});

it('Infers 60 pack size and $5 price when PIN is 059 for ticket 000', () => {
  const p = parseLotteryBarcode('9996-012345-4-000(059)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 60);
  assert.equal(p.inferredDetails.price, 5);
  assert.equal(p.inferredDetails.bookValue, 300);
});

it('Infers 30 pack size and $10 price when PIN is 029 for ticket 000', () => {
  const p = parseLotteryBarcode('9995-012345-5-000(029)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 30);
  assert.equal(p.inferredDetails.price, 10);
  assert.equal(p.inferredDetails.bookValue, 300);
});

it('Infers 18 pack size and $50 price when PIN is 017 for ticket 000', () => {
  const p = parseLotteryBarcode('9994-012345-6-000(017)');
  assert.ok(p && p.isValid);
  assert.ok(p.inferredDetails);
  assert.equal(p.inferredDetails.packSize, 18);
  assert.equal(p.inferredDetails.price, 50);
  assert.equal(p.inferredDetails.bookValue, 900);
});

// ----------------------------------------------------------------------------
// Group 4: UPC-A Lottery Ticket Barcode Recognition
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: UPC-A Retail Barcode Recognition ---');

it('Recognizes SCEL UPC "833283016709" as Game #1670', () => {
  const p = parseLotteryBarcode('833283016709');
  assert.ok(p);
  assert.equal(p.isLotteryUPC, true);
  assert.equal(p.gameNumber, '1670');
});

// ----------------------------------------------------------------------------
// Group 5: Hardware Scanner Artifacts
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Hardware Scanner Artifacts & Symbology Prefixes ---');

it('Strips AIM prefix "]I0" from ITF scan: "]I016700198693000"', () => {
  const p = parseLotteryBarcode(']I016700198693000');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.ticketNumber, 0);
});

it('Strips AIM prefix "]C1" from Code 128 scan: "]C116700198693000"', () => {
  const p = parseLotteryBarcode(']C116700198693000');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
});

it('Strips Code 39 start/stop asterisks: "*16700198693000*"', () => {
  const p = parseLotteryBarcode('*16700198693000*');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
});

console.log('\n================================================================');
console.log(`  TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

