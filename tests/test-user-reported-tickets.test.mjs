// ============================================================================
// LOTTO TRACK PRO — USER REPORTED PHYSICAL TICKET VERIFICATION
// Verifies 100% accurate scanning and parsing for the exact physical tickets
// photographed by the user in real-world retail store conditions:
//
// 1. Image 1: SCEL Game #1670 (HIT $100, $2, 150 tickets/pack)
//    - "1670-019869-3-000(149)" -> Game 1670, Pack 019869, Ticket 000, PIN 149
//    - "1670-019869-3-001(148)" -> Game 1670, Pack 019869, Ticket 001, PIN 148
//    - Barcode must NEVER parse Pack as 7 digits "0198690" or Ticket as "017"!
//
// 2. Image 2: SCEL Game #1658 (PLAYERS CLUB, $10, 30 tickets/pack)
//    - "1658-350877-3-029(000)" -> Game 1658, Pack 350877, Ticket 029, PIN 000
//    - "16583508770290" -> Game 1658, Pack 350877, Ticket 029, PIN 000
//
// 3. Image 3: SCEL Game #1648 (EPIC RICHES, $10, 30 tickets/pack)
//    - "1648-018378-8-029(000)" -> Game 1648, Pack 018378, Ticket 029, PIN 000
//    - "16480183780290" -> Game 1648, Pack 018378, Ticket 029, PIN 000 (NEVER #290!)
//
// 4. Image 4: SCEL Game #1692 (ULTIMATE MILLIONS, $20, 30 tickets/pack)
//    - "1692-091905-0-029(000)" -> Game 1692, Pack 091905, Ticket 029, PIN 000
//    - "16920919050292" -> Game 1692, Pack 091905, Ticket 029, PIN 000 (NEVER #292!)
//
// 5. Retail Merchandise Rejection:
//    - "2731-590419" (Scanner box) strictly rejected as retail product
// ============================================================================

import { strict as assert } from 'assert';
import {
  parseLotteryBarcode,
  formatLotteryBarcode,
  normalizePackNumber,
  isPackNumberMatch,
  findGameByBarcode,
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
console.log('  TESTING USER REPORTED PHYSICAL TICKET BARCODES (100% ACCURACY) ');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// 1. SCEL Game 1648 (EPIC RICHES $10) — Image 3
// ----------------------------------------------------------------------------
console.log('--- Ticket 1648: EPIC RICHES ($10, 30 tickets/pack) ---');

it('Physical ticket printed text "1648-018378-8-029(000)" parses ticket #029', () => {
  const p = parseLotteryBarcode('1648-018378-8-029(000)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1648');
  assert.equal(p.packNumber, '018378');
  assert.equal(p.ticketNumber, 29, 'Ticket must be 29, NEVER 290');
  assert.equal(p.ticketString, '029');
  assert.equal(p.checkCode, '8');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1648-018378-8-029 (000)');
});

it('Physical 14-digit scanned barcode "16480183780290" parses ticket #029 (NOT #290)', () => {
  const p = parseLotteryBarcode('16480183780290');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1648');
  assert.equal(p.packNumber, '018378');
  assert.equal(p.ticketNumber, 29, 'Ticket must be 29, NEVER 290');
  assert.equal(p.ticketString, '029');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1648-018378-029 (000)');
});

it('Identifies Game 1648 as EPIC RICHES ($10)', () => {
  const g = findGameByBarcode('16480183780290');
  assert.ok(g);
  assert.equal(g.name, 'EPIC RICHES');
  assert.equal(g.price, 10);
  assert.equal(g.packSize, 30);
});

// ----------------------------------------------------------------------------
// 2. SCEL Game 1692 (ULTIMATE MILLIONS $20) — Image 4
// ----------------------------------------------------------------------------
console.log('\n--- Ticket 1692: ULTIMATE MILLIONS ($20, 30 tickets/pack) ---');

it('Physical ticket printed text "1692-091905-0-029(000)" parses ticket #029', () => {
  const p = parseLotteryBarcode('1692-091905-0-029(000)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1692');
  assert.equal(p.packNumber, '091905');
  assert.equal(p.ticketNumber, 29, 'Ticket must be 29, NEVER 292');
  assert.equal(p.ticketString, '029');
  assert.equal(p.checkCode, '0');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1692-091905-0-029 (000)');
});

it('Physical 14-digit scanned barcode "16920919050292" parses ticket #029 (NOT #292)', () => {
  const p = parseLotteryBarcode('16920919050292');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1692');
  assert.equal(p.packNumber, '091905');
  assert.equal(p.ticketNumber, 29, 'Ticket must be 29, NEVER 292');
  assert.equal(p.ticketString, '029');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1692-091905-029 (000)');
});

it('Identifies Game 1692 as ULTIMATE MILLIONS ($20)', () => {
  const g = findGameByBarcode('16920919050292');
  assert.ok(g);
  assert.equal(g.name, 'ULTIMATE MILLIONS');
  assert.equal(g.price, 20);
  assert.equal(g.packSize, 30);
});

// ----------------------------------------------------------------------------
// 3. SCEL Game 1658 (PLAYERS CLUB $10) — Image 2
// ----------------------------------------------------------------------------
console.log('\n--- Ticket 1658: PLAYERS CLUB ($10, 30 tickets/pack) ---');

it('Physical ticket printed text "1658-350877-3-029(000)" parses ticket #029', () => {
  const p = parseLotteryBarcode('1658-350877-3-029(000)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1658');
  assert.equal(p.packNumber, '350877');
  assert.equal(p.ticketNumber, 29);
  assert.equal(p.ticketString, '029');
  assert.equal(p.checkCode, '3');
  assert.equal(p.securityCode, '000');
});

it('Physical 14-digit scanned barcode "16583508770290" parses ticket #029', () => {
  const p = parseLotteryBarcode('16583508770290');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1658');
  assert.equal(p.packNumber, '350877');
  assert.equal(p.ticketNumber, 29);
  assert.equal(p.ticketString, '029');
  assert.equal(p.securityCode, '000');
  assert.equal(p.displayBarcode, '1658-350877-029 (000)');
});

// ----------------------------------------------------------------------------
// 4. SCEL Game 1670 (HIT $100 $2) — Image 1
// ----------------------------------------------------------------------------
console.log('\n--- Ticket 1670: HIT $100 ($2, 150 tickets/pack) ---');

it('Physical ticket printed text "1670-019869-3-000(149)" parses ticket #000, PIN 149', () => {
  const p = parseLotteryBarcode('1670-019869-3-000(149)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869', 'Pack MUST be clean 6 digits: 019869');
  assert.equal(p.ticketNumber, 0);
  assert.equal(p.ticketString, '000');
  assert.equal(p.checkCode, '3');
  assert.equal(p.securityCode, '149');
  assert.equal(p.displayBarcode, '1670-019869-3-000 (149)');
});

it('Physical ticket printed text "1670-019869-3-001(148)" parses ticket #001, PIN 148', () => {
  const p = parseLotteryBarcode('1670-019869-3-001(148)');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.ticketNumber, 1);
  assert.equal(p.ticketString, '001');
  assert.equal(p.checkCode, '3');
  assert.equal(p.securityCode, '148');
  assert.equal(p.displayBarcode, '1670-019869-3-001 (148)');
});

it('Continuous 14-digit ticket 000 "16700198693000" parses ticket #000, PIN 149', () => {
  const p = parseLotteryBarcode('16700198693000');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.ticketNumber, 0);
  assert.equal(p.ticketString, '000');
  assert.equal(p.securityCode, '149');
});

it('Continuous 14-digit ticket 001 "16700198693001" parses ticket #001, PIN 148', () => {
  const p = parseLotteryBarcode('16700198693001');
  assert.ok(p && p.isValid);
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869');
  assert.equal(p.ticketNumber, 1);
  assert.equal(p.ticketString, '001');
  assert.equal(p.securityCode, '148');
});

it('Physical 14-digit scanned barcode "16700198690017" parses ticket #001 (NOT #017!)', () => {
  const p = parseLotteryBarcode('16700198690017');
  assert.ok(p && p.isValid, 'Must be valid');
  assert.equal(p.gameNumber, '1670');
  assert.equal(p.packNumber, '019869', 'Must be clean 6-digit pack, NEVER 7 digits');
  assert.equal(p.ticketNumber, 1, 'Must parse as Ticket #001 (NOT #017)');
  assert.equal(p.ticketString, '001');
  assert.equal(p.securityCode, '148');
  assert.equal(p.displayBarcode, '1670-019869-001 (148)');
});

// ----------------------------------------------------------------------------
// 5. Retail Merchandise Strict Rejections
// ----------------------------------------------------------------------------
console.log('\n--- Retail Merchandise & Scanner Box Rejection ---');

it('Rejects scanner box barcode "2731-590419" as retail merchandise', () => {
  const p = parseLotteryBarcode('2731-590419');
  assert.ok(p);
  assert.equal(p.isValid, false);
  assert.equal(p.isRetailProduct, true);
});

it('Rejects grocery UPC-A "012345678905"', () => {
  const p = parseLotteryBarcode('012345678905');
  assert.ok(p);
  assert.equal(p.isValid, false);
  assert.equal(p.isRetailProduct, true);
});

console.log('\n================================================================');
console.log(`  ALL USER-REPORTED TICKET TESTS: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

