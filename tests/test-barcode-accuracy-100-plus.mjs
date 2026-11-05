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
  SAMPLE_GAMES
} from '../src/data.js';

// Extract live parseBoxBarcode from src/main.js
const mainJsContent = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
const boxParserMatch = mainJsContent.match(/function parseBoxBarcode\(barcode\)\s*\{[\s\S]*?\n\}/);
assert(boxParserMatch, 'parseBoxBarcode must exist in src/main.js');
const parseBoxBarcode = new Function('barcode', `${boxParserMatch[0]}; return parseBoxBarcode(barcode);`);

let totalTests = 0;
let passedTests = 0;
const failures = [];

function check(title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (err) {
    failures.push({ title, error: err.message });
    console.error(`❌ FAIL: ${title} -> ${err.message}`);
  }
}

console.log('================================================================');
console.log('   ULTIMATE 100+ ACCURACY & ZERO-MISTAKE BARCODE TEST SUITE     ');
console.log('================================================================\n');

// ============================================================================
// CATEGORY 1: DISPENSER BOX SCANNER TRAINING (25 Tests)
// ============================================================================
console.log('--- Category 1: Dispenser Rack Box Barcodes (25 Tests) ---');

const boxTestCases = [
  { in: 'BOX-01', exp: 1 },
  { in: 'BOX-65', exp: 65 },
  { in: 'BOX01', exp: 1 },
  { in: 'BOX65', exp: 65 },
  { in: 'BOX 1', exp: 1 },
  { in: 'BOX 24', exp: 24 },
  { in: 'BOX#1', exp: 1 },
  { in: 'BOX#65', exp: 65 },
  { in: 'BOX_05', exp: 5 },
  { in: 'BOX/12', exp: 12 },
  { in: 'B-01', exp: 1 },
  { in: 'B01', exp: 1 },
  { in: 'B1', exp: 1 },
  { in: 'B#15', exp: 15 },
  { in: 'SLOT-01', exp: 1 },
  { in: 'SLOT 65', exp: 65 },
  { in: 'SLOT#33', exp: 33 },
  { in: 'BIN-01', exp: 1 },
  { in: 'BIN 10', exp: 10 },
  { in: 'DISPENSER-01', exp: 1 },
  { in: 'DISPENSER 45', exp: 45 },
  { in: '#05', exp: 5 },
  { in: '#65', exp: 65 },
  { in: ']C1BOX-05', exp: 5 },
  { in: '\x02BOX-08\x03', exp: 8 },
  { in: '*BOX-14*', exp: 14 }
];

boxTestCases.forEach((tc, idx) => {
  check(`Box Scan #${idx + 1}: "${tc.in}" -> Box ${tc.exp}`, () => {
    const res = parseBoxBarcode(tc.in);
    assert.strictEqual(res, tc.exp, `Expected box ${tc.exp}, got ${res}`);
  });
});

// ============================================================================
// CATEGORY 2: DELIMITER VARIATIONS (Hyphen, Slash, Dot, Colon, Space) (20 Tests)
// ============================================================================
console.log('\n--- Category 2: Delimiter Variations Across Ticket Text (20 Tests) ---');

const delimiterCases = [
  // 4-part: Game-Pack-Check-Ticket(PIN)
  { in: '1670-019869-3-000(149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670/019869/3/000(149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670.019869.3.000(149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670:019869:3:000(149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670 019869 3 000 (149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670_019869_3_000(149)', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670-019869-3-000[149]', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  { in: '1670-019869-3-000{149}', g: '1670', p: '019869', t: 0, c: '3', sec: '149' },
  // 3-part: Game-Pack-Ticket
  { in: '1648-018378-029', g: '1648', p: '018378', t: 29 },
  { in: '1648/018378/029', g: '1648', p: '018378', t: 29 },
  { in: '1648.018378.029', g: '1648', p: '018378', t: 29 },
  { in: '1648:018378:029', g: '1648', p: '018378', t: 29 },
  { in: '1648 018378 029', g: '1648', p: '018378', t: 29 },
  { in: '1648-018378-029(000)', g: '1648', p: '018378', t: 29, sec: '000' },
  { in: '1417-067017-009(290)', g: '1417', p: '067017', t: 9, sec: '290' },
  { in: '1417/067017/009[290]', g: '1417', p: '067017', t: 9, sec: '290' },
  // Delimited Game-Pack
  { in: '1670-019869', g: '1670', p: '019869', isPack: true },
  { in: '1670/019869', g: '1670', p: '019869', isPack: true },
  { in: '1670.019869', g: '1670', p: '019869', isPack: true },
  { in: '1670:019869', g: '1670', p: '019869', isPack: true }
];

delimiterCases.forEach((tc, idx) => {
  check(`Delimiter Case #${idx + 1}: "${tc.in}"`, () => {
    const res = parseLotteryBarcode(tc.in);
    assert(res && res.isValid, `Should be valid barcode: ${tc.in}`);
    assert.strictEqual(res.gameNumber, tc.g, `Game number match`);
    assert.strictEqual(res.packNumber, tc.p, `Pack number match`);
    if (tc.t !== undefined) assert.strictEqual(res.ticketNumber, tc.t, `Ticket number match`);
    if (tc.c !== undefined) assert.strictEqual(res.checkCode, tc.c, `Check code match`);
    if (tc.sec !== undefined) assert.strictEqual(res.securityCode, tc.sec, `Security PIN match`);
  });
});

// ============================================================================
// CATEGORY 3: HARDWARE SCANNER ARTIFACTS & CONTROL BYTES (15 Tests)
// ============================================================================
console.log('\n--- Category 3: Hardware Scanner Symbology & Control Codes (15 Tests) ---');

const hardwareCases = [
  { in: ']C116700198693000', desc: 'Code 128 AIM prefix ]C1', g: '1670', p: '019869', t: 0 },
  { in: ']C016700198693000', desc: 'Code 128 AIM prefix ]C0', g: '1670', p: '019869', t: 0 },
  { in: ']I016700198693000', desc: 'ITF AIM prefix ]I0', g: '1670', p: '019869', t: 0 },
  { in: ']I116700198693000', desc: 'ITF AIM prefix ]I1', g: '1670', p: '019869', t: 0 },
  { in: ']d116700198693000', desc: 'DataMatrix AIM prefix ]d1', g: '1670', p: '019869', t: 0 },
  { in: ']Q116700198693000', desc: 'QR Code AIM prefix ]Q1', g: '1670', p: '019869', t: 0 },
  { in: ']L016700198693000', desc: 'PDF417 AIM prefix ]L0', g: '1670', p: '019869', t: 0 },
  { in: '*16700198693000*', desc: 'Code 39 start/stop asterisks', g: '1670', p: '019869', t: 0 },
  { in: '\x0216700198693000\x03', desc: 'STX/ETX hardware wrapper', g: '1670', p: '019869', t: 0 },
  { in: '16700198693000\r\n', desc: 'Trailing CRLF carriage return', g: '1670', p: '019869', t: 0 },
  { in: '16700198693000\t', desc: 'Trailing TAB key', g: '1670', p: '019869', t: 0 },
  { in: '16700198693000;', desc: 'Trailing terminal semicolon', g: '1670', p: '019869', t: 0 },
  { in: '16700198693000.', desc: 'Trailing terminal period', g: '1670', p: '019869', t: 0 },
  { in: '016700198693000', desc: 'Scanner 15-digit leading zero padding', g: '1670', p: '019869', t: 0 },
  { in: '0016700198693000', desc: 'Scanner 16-digit double leading zero', g: '1670', p: '019869', t: 0 },
  { in: '00016700198693000', desc: 'Scanner 17-digit triple leading zero', g: '1670', p: '019869', t: 0 }
];

hardwareCases.forEach((tc, idx) => {
  check(`Hardware Case #${idx + 1}: ${tc.desc}`, () => {
    const res = parseLotteryBarcode(tc.in);
    assert(res && res.isValid, `Failed to parse ${tc.desc}`);
    assert.strictEqual(res.gameNumber, tc.g, `Game number`);
    assert.strictEqual(res.packNumber, tc.p, `Pack number`);
    assert.strictEqual(res.ticketNumber, tc.t, `Ticket number`);
  });
});

// ============================================================================
// CATEGORY 4: MULTI-STATE GAMES & TICKET RANGE ACCURACY (25 Tests)
// ============================================================================
console.log('\n--- Category 4: Multi-State Games & Price Points (25 Tests) ---');

const stateGames = [
  // $1 Games (300 tickets, PIN counts down from 299 to 000)
  { raw: '14170670170000', g: '1417', p: '067017', t: 0, expSec: '299', price: 1 },
  { raw: '14170670170150', g: '1417', p: '067017', t: 150, expSec: '149', price: 1 },
  { raw: '14170670170299', g: '1417', p: '067017', t: 299, expSec: '000', price: 1 },

  // $2 Games (150 tickets, PIN counts down from 149 to 000)
  { raw: '16700198693000', g: '1670', p: '019869', t: 0, expSec: '149', price: 2 },
  { raw: '16700198693075', g: '1670', p: '019869', t: 75, expSec: '074', price: 2 },
  { raw: '16700198693149', g: '1670', p: '019869', t: 149, expSec: '000', price: 2 },
  { raw: '14180996564000', g: '1418', p: '099656', t: 0, expSec: '149', price: 2 },
  { raw: '14180996564081', g: '1418', p: '099656', t: 81, expSec: '068', price: 2 },
  { raw: '14180996564149', g: '1418', p: '099656', t: 149, expSec: '000', price: 2 },

  // $3 Games (100 tickets, PIN counts down from 099 to 000)
  { raw: '16720072523000', g: '1672', p: '007252', t: 0, expSec: '099', price: 3 },
  { raw: '16720072523050', g: '1672', p: '007252', t: 50, expSec: '049', price: 3 },
  { raw: '16720072523099', g: '1672', p: '007252', t: 99, expSec: '000', price: 3 },

  // $5 Games (60 tickets, PIN counts down from 059 to 000)
  { raw: '18990145228000', g: '1899', p: '014522', t: 0, expSec: '059', price: 5 },
  { raw: '18990145228030', g: '1899', p: '014522', t: 30, expSec: '029', price: 5 },
  { raw: '18990145228059', g: '1899', p: '014522', t: 59, expSec: '000', price: 5 },

  // $10 Games (30 tickets, PIN counts down from 029 to 000)
  { raw: '16480183788000', g: '1648', p: '018378', t: 0, expSec: '029', price: 10 },
  { raw: '16480183788015', g: '1648', p: '018378', t: 15, expSec: '014', price: 10 },
  { raw: '16480183788029', g: '1648', p: '018378', t: 29, expSec: '000', price: 10 },

  // $20 Games (15 tickets, PIN counts down from 014 to 000)
  { raw: '14230234115000', g: '1423', p: '023411', t: 0, expSec: '014', price: 20 },
  { raw: '14230234115007', g: '1423', p: '023411', t: 7, expSec: '007', price: 20 },
  { raw: '14230234115014', g: '1423', p: '023411', t: 14, expSec: '000', price: 20 },

  // $50 Games (18 tickets, PIN counts down from 017 to 000)
  { raw: '17700543219000', g: '1770', p: '054321', t: 0, expSec: '017', price: 50 },
  { raw: '17700543219009', g: '1770', p: '054321', t: 9, expSec: '008', price: 50 },
  { raw: '17700543219017', g: '1770', p: '054321', t: 17, expSec: '000', price: 50 }
];

stateGames.forEach((tc, idx) => {
  check(`Game Ticket Scan #${idx + 1}: Game ${tc.g} Tix #${tc.t} ($${tc.price})`, () => {
    const res = parseLotteryBarcode(tc.raw);
    assert(res && res.isValid, `Should parse valid ticket`);
    assert.strictEqual(res.gameNumber, tc.g);
    assert.strictEqual(res.packNumber, tc.p);
    assert.strictEqual(res.ticketNumber, tc.t);
    assert.strictEqual(res.securityCode, tc.expSec, `Calculated PIN must equal countdown: ${tc.expSec}`);
  });
});

// ============================================================================
// CATEGORY 5: 17-DIGIT & 2D/PDF417 HIGH-DENSITY SCANNER BARCODES (15 Tests)
// ============================================================================
console.log('\n--- Category 5: 17-Digit & 2D Validation Barcodes (15 Tests) ---');

const highDensityCases = [
  { raw: '16700198693000149', g: '1670', p: '019869', t: 0, pin: '149' },
  { raw: '16700198693001148', g: '1670', p: '019869', t: 1, pin: '148' },
  { raw: '16700198693017132', g: '1670', p: '019869', t: 17, pin: '132' },
  { raw: '16480183788000029', g: '1648', p: '018378', t: 0, pin: '029' },
  { raw: '16480183788029000', g: '1648', p: '018378', t: 29, pin: '000' },
  { raw: '14180996564081068', g: '1418', p: '099656', t: 81, pin: '068' },
  { raw: '16720072523000099', g: '1672', p: '007252', t: 0, pin: '099' },
  { raw: '16720072523099000', g: '1672', p: '007252', t: 99, pin: '000' },
  // 2D Barcode Payloads (18-24 digits)
  { raw: '182800385621002774086718', g: '1828', p: '003856', t: 100 },
  { raw: '167001986930001499824', g: '1670', p: '019869', t: 0 },
  { raw: '164801837880290008819', g: '1648', p: '018378', t: 29 },
  { raw: '1418099656408106822154', g: '1418', p: '099656', t: 81 },
  // URL encoded 2D payload from QR on ticket back
  { raw: 'https://scel.net/check?t=16700198693000', g: '1670', p: '019869', t: 0 },
  { raw: 'https://galottery.com/entry?ticket=16480183788029', g: '1648', p: '018378', t: 29 }
];

highDensityCases.forEach((tc, idx) => {
  check(`High-Density Scan #${idx + 1}: ${tc.raw}`, () => {
    const res = parseLotteryBarcode(tc.raw);
    assert(res && res.isValid, `Must be valid ticket`);
    assert.strictEqual(res.gameNumber, tc.g);
    assert.strictEqual(res.packNumber, tc.p);
    assert.strictEqual(res.ticketNumber, tc.t);
    if (tc.pin) assert.strictEqual(res.securityCode, tc.pin);
  });
});

// ============================================================================
// CATEGORY 6: PACK MANIFESTS & BOOK LEVEL BARCODES (15 Tests)
// ============================================================================
console.log('\n--- Category 6: Pack Manifests & Intake Scanning (15 Tests) ---');

const packCases = [
  // 11-digit manifest (Game 4 + Pack 6 + Check 1)
  { raw: '16700198693', g: '1670', p: '019869', c: '3' },
  { raw: '16480183788', g: '1648', p: '018378', c: '8' },
  { raw: '14180996564', g: '1418', p: '099656', c: '4' },
  { raw: '16720072523', g: '1672', p: '007252', c: '3' },
  // 10-digit manifest (Game 4 + Pack 6)
  { raw: '1670019869', g: '1670', p: '019869' },
  { raw: '1648018378', g: '1648', p: '018378' },
  { raw: '1418099656', g: '1418', p: '099656' },
  // 7-digit pack number (Pack 6 + Check 1)
  { raw: '0198693', p: '019869', c: '3' },
  { raw: '0183788', p: '018378', c: '8' },
  // 6-digit plain pack number
  { raw: '019869', p: '019869' },
  { raw: '018378', p: '018378' },
  { raw: '184022', p: '184022' }
];

packCases.forEach((tc, idx) => {
  check(`Pack Intake #${idx + 1}: ${tc.raw}`, () => {
    const res = parseLotteryBarcode(tc.raw);
    assert(res && res.isValid, `Should parse pack manifest`);
    assert(res.isPackBarcode, `Should be flagged as isPackBarcode`);
    assert.strictEqual(res.packNumber, tc.p);
    if (tc.g) assert.strictEqual(res.gameNumber, tc.g);
    if (tc.c) assert.strictEqual(res.checkCode, tc.c);
  });
});

// ============================================================================
// CATEGORY 7: ZERO-MISTAKE REJECTIONS & NON-LOTTERY BARCODES (15 Tests)
// ============================================================================
console.log('\n--- Category 7: Strict Rejections (Zero-Mistake Guarantee) (15 Tests) ---');

const rejectionCases = [
  { raw: '2731-590419', desc: 'Scanner hardware box product barcode' },
  { raw: '049000028904', desc: 'Coca-Cola 12-digit Retail UPC-A' },
  { raw: '028400043809', desc: 'Doritos 12-digit Retail UPC-A' },
  { raw: '011110038492', desc: 'Kroger Milk 12-digit Retail UPC-A' },
  { raw: '070847811169', desc: 'Monster Energy 12-digit Retail UPC-A' },
  { raw: '12345678', desc: '8-digit Retail EAN-8' },
  { raw: 'SN-X98412-US', desc: 'Hardware Serial Number with letters' },
  { raw: 'DELL-INSPIRON-15', desc: 'Laptop Model barcode' },
  { raw: 'INV-AUDIT-2026', desc: 'Text asset tag' },
  { raw: '1670-019869-3-9999', desc: 'Out-of-range ticket number 9999' },
  { raw: '00000000000000', desc: 'All zeros 14-digit non-lottery barcode' },
  { raw: '', desc: 'Empty string' },
  { raw: '   ', desc: 'Whitespace string' },
  { raw: null, desc: 'Null input' },
  { raw: undefined, desc: 'Undefined input' }
];

rejectionCases.forEach((tc, idx) => {
  check(`Zero-Mistake #${idx + 1}: ${tc.desc}`, () => {
    const res = parseLotteryBarcode(tc.raw);
    assert(!res || !res.isValid || res.isRetailProduct || res.isNonLotteryBarcode, `Must be safely rejected`);
  });
});

// ============================================================================
// SUMMARY & ACCURACY SCORE
// ============================================================================
console.log('\n================================================================');
console.log(`   BARCODE TRAINING COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
const accuracyPercent = ((passedTests / totalTests) * 100).toFixed(1);
console.log(`   ACCURACY RATING: ${accuracyPercent}% (Target: 100%)`);
console.log('================================================================\n');

assert.strictEqual(passedTests, totalTests, `All ${totalTests} tests must pass with 100% accuracy!`);
console.log('🌟 100% FLAWLESS BARCODE SCANNER CERTIFICATION ACHIEVED! 🌟');
