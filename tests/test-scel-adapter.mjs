// ============================================================================
// SCEL PHASE 5.1: ISOLATED JURISDICTION-AWARE PARSER ADAPTER TESTS
// ============================================================================
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseLotteryBarcode, findGameByBarcode, formatTicketDisplayBarcode, isPackNumberMatch } from '../src/data.js';
import { adaptScelToLotteryBarcode, parseScelPrintedTicketNumber, SCEL_GAMES } from '../src/scel.js';

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

console.log('\n====================================================');
console.log('   SCEL PHASE 5.1: PARSER ADAPTER TESTS             ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// Test Group 1: Known Printed Format Parsing
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: Known Printed Format Parsing ---');

it('1.1: Parses standard printed SCEL ticket 1705-002921-5-069 in SC jurisdiction', () => {
  const res = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.ok(res, 'Result must not be null');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1705');
  assert.strictEqual(res.gameName, 'LIGHT UP THE SEASON');
  assert.strictEqual(res.checkCode, '5');
  assert.strictEqual(res.isPackBarcode, false);
});

it('1.2: adaptScelToLotteryBarcode directly returns valid contract object', () => {
  const res = adaptScelToLotteryBarcode('1705-002921-5-069');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1705');
  assert.strictEqual(res.price, 2);
  assert.strictEqual(res.packSize, 150);
});

// ----------------------------------------------------------------------------
// Test Group 2: Exact Pack Preservation (002921)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Exact Pack Preservation (002921) ---');

it('2.1: Strictly preserves leading zeros in packNumber, basePackNumber, packClean, packCombined', () => {
  const res = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(res.packNumber, '002921', 'packNumber must be "002921" (not "2921")');
  assert.strictEqual(res.basePackNumber, '002921', 'basePackNumber must be "002921"');
  assert.strictEqual(res.packClean, '002921', 'packClean must be "002921"');
  assert.strictEqual(res.packCombined, '002921-5', 'packCombined must be "002921-5"');
  assert.ok(res.canonicalId.includes('002921'), 'canonicalId must contain "002921"');
});

it('2.2: Pack matching matches slot with exact leading zeros', () => {
  const res = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.ok(isPackNumberMatch('002921', res.packNumber));
  assert.ok(isPackNumberMatch('002921-5', res.packCombined));
});

// ----------------------------------------------------------------------------
// Test Group 3: Ticket Number 69 and Display String 069
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Ticket Number 69 and Display String 069 ---');

it('3.1: ticketNumber is integer 69, ticketString is zero-padded string "069"', () => {
  const res = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(typeof res.ticketNumber, 'number');
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(typeof res.ticketString, 'string');
  assert.strictEqual(res.ticketString, '069');
});

// ----------------------------------------------------------------------------
// Test Group 4: Optional Raw Suffix Preservation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Optional Raw Suffix Preservation ---');

it('4.1: Spaced suffix (080) is preserved as rawSuffix and securityCode', () => {
  const res = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.ticketString, '069');
  assert.strictEqual(res.rawSuffix, '(080)');
  assert.strictEqual(res.securityCode, '080');
  assert.strictEqual(res.hasExplicitSecurityCode, true);
  assert.strictEqual(res.canonicalId, '1705-002921-5-069');
  assert.strictEqual(res.fullId, '1705-002921-5-069(080)');
  assert.strictEqual(res.displayBarcode, '1705-002921-5-069 (080)');
});

it('4.2: Attached suffix (080) without space parses identically', () => {
  const res = parseLotteryBarcode('1705-002921-5-069(080)', [], 'SC');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.rawSuffix, '(080)');
  assert.strictEqual(res.securityCode, '080');
  assert.strictEqual(res.canonicalId, '1705-002921-5-069');
});

it('4.3: Bracketed suffix [080] is preserved as rawSuffix', () => {
  const res = parseLotteryBarcode('1705-002921-5-069[080]', [], 'SC');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.rawSuffix, '[080]');
  assert.strictEqual(res.securityCode, '080');
});

// ----------------------------------------------------------------------------
// Test Group 5: Unknown SCEL Game Rejection
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Unknown SCEL Game Rejection ---');

it('5.1: Rejects uncataloged game 9999-002921-5-069 in SC jurisdiction', () => {
  const res = parseLotteryBarcode('9999-002921-5-069', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.isNonLotteryBarcode, true);
  assert.ok(res.error.includes('Unknown SCEL game'));
});

it('5.2: Rejects Georgia game (1648) in SC jurisdiction without falling back to GA', () => {
  const res = parseLotteryBarcode('1648-018378-8-000', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.isNonLotteryBarcode, true);
});

// ----------------------------------------------------------------------------
// Test Group 6: Malformed Format Rejection
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: Malformed Format Rejection ---');

it('6.1: Rejects missing ticket number segment (1705-002921-5)', () => {
  const res = parseLotteryBarcode('1705-002921-5', [], 'SC');
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
});

it('6.2: Rejects 4-digit pack number (1705-2921-5-069)', () => {
  const res = parseLotteryBarcode('1705-2921-5-069', [], 'SC');
  assert.strictEqual(res.isValid, false);
});

it('6.3: Rejects 3-digit game number (170-002921-5-069)', () => {
  const res = parseLotteryBarcode('170-002921-5-069', [], 'SC');
  assert.strictEqual(res.isValid, false);
});

it('6.4: Rejects 2-digit ticket number (1705-002921-5-69)', () => {
  const res = parseLotteryBarcode('1705-002921-5-69', [], 'SC');
  assert.strictEqual(res.isValid, false);
});

it('6.5: Rejects alphabetic characters in check or ticket (1705-002921-X-069)', () => {
  const res = parseLotteryBarcode('1705-002921-X-069', [], 'SC');
  assert.strictEqual(res.isValid, false);
});

// ----------------------------------------------------------------------------
// Test Group 7: Unsupported Continuous Formats Rejected
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 7: Unsupported Continuous Formats Rejected ---');

it('7.1: Continuous 14-digit barcode 17050029215069 parses with SC logic in SC jurisdiction', () => {
  const res = parseLotteryBarcode('17050029215069', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1705');
  assert.strictEqual(res.packNumber, '002921');
  assert.strictEqual(res.checkCode, '5');
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.ticketString, '069');
  assert.strictEqual(res.displayBarcode, '1705-002921-5-069 (080)');
});

it('7.2: Continuous 17-digit barcode parses accurately with preserved suffix and check digit', () => {
  const res = parseLotteryBarcode('17050029215069080', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.checkDigit, '5');
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.displayBarcode, '1705-002921-5-069 (080)');
});

it('7.3: Continuous 11-digit pack manifest is rejected in SC jurisdiction', () => {
  const res = parseLotteryBarcode('17050029215', [], 'SC');
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
});

it('7.4: 12-digit retail UPC is rejected in SC jurisdiction', () => {
  const res = parseLotteryBarcode('833283017051', [], 'SC');
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
});

// ----------------------------------------------------------------------------
// Test Group 8: GA Jurisdiction Still Uses Existing Parser
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 8: GA Jurisdiction Still Uses Existing Parser ---');

it('8.1: GA store parsing 1648-018378-8-029(000) parses with GA logic', () => {
  const res = parseLotteryBarcode('1648-018378-8-029(000)', [], 'GA');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.gameNumber, '1648');
  assert.strictEqual(res.packNumber, '0183788');
  assert.strictEqual(res.ticketNumber, 29);
});

it('8.2: GA store parsing continuous 14-digit 16480183788000 parses with GA logic', () => {
  const res = parseLotteryBarcode('16480183788000', [], 'GA');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.gameNumber, '1648');
  assert.strictEqual(res.ticketNumber, 0);
});

// ----------------------------------------------------------------------------
// Test Group 9: SC Jurisdiction Never Falls Back to GA Parser
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 9: SC Jurisdiction Never Falls Back to GA Parser ---');

it('9.1: SC store with continuous barcode 17050029215069 parses via SC parser (not GA parser)', () => {
  const res = parseLotteryBarcode('17050029215069', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameName, 'LIGHT UP THE SEASON');
});

it('9.2: SC store scanning GA game NEVER falls back to GA parser', () => {
  const res = parseLotteryBarcode('16480183788000', [], 'SC');
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.jurisdiction, 'SC');
});

// ----------------------------------------------------------------------------
// Test Group 10: Missing Jurisdiction Preserves Legacy GA Behavior
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 10: Missing Jurisdiction Preserves Legacy GA Behavior ---');

it('10.1: parseLotteryBarcode(raw) without jurisdiction defaults to GA', () => {
  const res = parseLotteryBarcode('16480183788000');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.gameNumber, '1648');
});

it('10.2: parseLotteryBarcode(raw, customGames) without jurisdiction defaults to GA', () => {
  const res = parseLotteryBarcode('16480183788000', []);
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.gameNumber, '1648');
});

it('10.3: parseLotteryBarcode(raw, customGames, undefined) defaults to GA', () => {
  const res = parseLotteryBarcode('16480183788000', [], undefined);
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
});

// ----------------------------------------------------------------------------
// Test Group 11: Workflow Call Sites Pass Jurisdiction
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 11: Workflow Call Sites Verification ---');

it('11.1: Every parseLotteryBarcode call in src/main.js explicitly passes state.lotteryJurisdiction', () => {
  const mainJsPath = path.resolve('src/main.js');
  const content = fs.readFileSync(mainJsPath, 'utf8');
  const lines = content.split('\n');
  const unadorned = [];

  lines.forEach((line, idx) => {
    // Look for parseLotteryBarcode( call sites in main.js
    if (line.includes('parseLotteryBarcode(') && !line.includes('import ') && !line.includes('export ')) {
      // Must include state.lotteryJurisdiction
      if (!line.includes('state.lotteryJurisdiction')) {
        unadorned.push(`Line ${idx + 1}: ${line.trim()}`);
      }
    }
  });

  assert.strictEqual(unadorned.length, 0, `Found ${unadorned.length} calls missing state.lotteryJurisdiction:\n${unadorned.join('\n')}`);
});

it('11.2: Every findGameByBarcode call in src/main.js explicitly passes state.lotteryJurisdiction', () => {
  const mainJsPath = path.resolve('src/main.js');
  const content = fs.readFileSync(mainJsPath, 'utf8');
  const lines = content.split('\n');
  const unadorned = [];

  lines.forEach((line, idx) => {
    if (line.includes('findGameByBarcode(') && !line.includes('import ') && !line.includes('export ')) {
      if (!line.includes('state.lotteryJurisdiction')) {
        unadorned.push(`Line ${idx + 1}: ${line.trim()}`);
      }
    }
  });

  assert.strictEqual(unadorned.length, 0, `Found ${unadorned.length} calls missing state.lotteryJurisdiction:\n${unadorned.join('\n')}`);
});

// ----------------------------------------------------------------------------
// Test Group 12: Duplicate Identity Consistency
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 12: Duplicate Identity Consistency ---');

it('12.1: Repeated scans of standard printed number produce identical identifiers', () => {
  const scan1 = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  const scan2 = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(scan1.canonicalId, scan2.canonicalId);
  assert.strictEqual(scan1.standardBarcode, scan2.standardBarcode);
  assert.strictEqual(scan1.packNumber, scan2.packNumber);
  assert.strictEqual(scan1.ticketNumber, scan2.ticketNumber);
});

it('12.2: Scan with suffix produces matching canonicalId for duplicate detection', () => {
  const plain = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  const withSuffix = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.strictEqual(plain.canonicalId, withSuffix.canonicalId);
  assert.strictEqual(plain.standardBarcode, withSuffix.standardBarcode);
  assert.strictEqual(plain.packNumber, withSuffix.packNumber);
  assert.strictEqual(plain.ticketNumber, withSuffix.ticketNumber);
});

it('12.3: formatTicketDisplayBarcode returns exact SCEL display string without computing GA series code', () => {
  const formatted = formatTicketDisplayBarcode('1705-002921-5-069 (080)', [], null, 'SC');
  assert.strictEqual(formatted, '1705-002921-5-069 (080)');
});

// ----------------------------------------------------------------------------
// Test Group 13: Physical Barcodes & Cross-Jurisdiction Characterization
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 13: Physical Barcodes & Cross-Jurisdiction Characterization ---');

it('13.1: Parses physical SC Game 1714 printed ticket 1714-045114-6-002 (027)', () => {
  const res = parseLotteryBarcode('1714-045114-6-002 (027)', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1714');
  assert.strictEqual(res.packNumber, '045114');
  assert.strictEqual(res.checkCode, '6');
  assert.strictEqual(res.ticketNumber, 2);
  assert.strictEqual(res.ticketString, '002');
  assert.strictEqual(res.price, 20);
  assert.strictEqual(res.packSize, 30);
  assert.strictEqual(res.displayBarcode, '1714-045114-6-002 (027)');
  assert.strictEqual(formatTicketDisplayBarcode(res, [], null, 'SC'), '1714-045114-6-002 (027)');
});

it('13.2: Parses physical SC Game 1714 continuous 14-digit barcode 17140451146002 with calculated (027)', () => {
  const res = parseLotteryBarcode('17140451146002', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1714');
  assert.strictEqual(res.packNumber, '045114');
  assert.strictEqual(res.checkCode, '6');
  assert.strictEqual(res.ticketNumber, 2);
  assert.strictEqual(res.ticketString, '002');
  assert.strictEqual(res.price, 20);
  assert.strictEqual(res.packSize, 30);
  assert.strictEqual(res.displayBarcode, '1714-045114-6-002 (027)');
  assert.strictEqual(formatTicketDisplayBarcode(res, [], null, 'SC'), '1714-045114-6-002 (027)');
});

it('13.3: Parses physical SC Game 1684 printed ticket 1684-345553-4-004 (025)', () => {
  const res = parseLotteryBarcode('1684-345553-4-004 (025)', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1684');
  assert.strictEqual(res.packNumber, '345553');
  assert.strictEqual(res.checkCode, '4');
  assert.strictEqual(res.ticketNumber, 4);
  assert.strictEqual(res.ticketString, '004');
  assert.strictEqual(res.price, 10);
  assert.strictEqual(res.packSize, 30);
  assert.strictEqual(res.displayBarcode, '1684-345553-4-004 (025)');
});

it('13.4: Parses physical SC Game 1684 continuous 14-digit barcode 16843455534004 with calculated (025)', () => {
  const res = parseLotteryBarcode('16843455534004', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1684');
  assert.strictEqual(res.packNumber, '345553');
  assert.strictEqual(res.checkCode, '4');
  assert.strictEqual(res.ticketNumber, 4);
  assert.strictEqual(res.ticketString, '004');
  assert.strictEqual(res.packSize, 30);
  assert.strictEqual(res.displayBarcode, '1684-345553-4-004 (025)');
});

it('13.5: Parses physical SC Game 1705 printed ticket 1705-002921-5-069 (080)', () => {
  const res = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.ok(res);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.jurisdiction, 'SC');
  assert.strictEqual(res.gameNumber, '1705');
  assert.strictEqual(res.packNumber, '002921');
  assert.strictEqual(res.checkCode, '5');
  assert.strictEqual(res.ticketNumber, 69);
  assert.strictEqual(res.ticketString, '069');
  assert.strictEqual(res.packSize, 150);
  assert.strictEqual(res.displayBarcode, '1705-002921-5-069 (080)');
});

it('13.6: Resolves Game 1714: Always preserves SC display with suffix (027) and pack size 30 regardless of store jurisdiction', () => {
  const resSC = parseLotteryBarcode('17140451146002', [], 'SC');
  const resGA = parseLotteryBarcode('17140451146002', [], 'GA');
  assert.strictEqual(resSC.displayBarcode, '1714-045114-6-002 (027)');
  assert.strictEqual(resGA.displayBarcode, '1714-045114-6-002 (027)');
  assert.strictEqual(resSC.packSize, 30);
  assert.strictEqual(resGA.packSize, 30);
  assert.strictEqual(resGA.checkDigit, '6');
});

it('13.7: Preserves Georgia printed ticket 1421-2045261-036 (023) 7-digit pack in display', () => {
  const resGA = parseLotteryBarcode('1421-2045261-036 (023)', [], 'GA');
  assert.ok(resGA);
  assert.strictEqual(resGA.isValid, true);
  assert.strictEqual(resGA.gameNumber, '1421');
  assert.strictEqual(resGA.packNumber, '2045261');
  assert.strictEqual(resGA.basePackNumber, '204526');
  assert.strictEqual(resGA.checkCode, '1');
  assert.strictEqual(resGA.rawPackNumber, '2045261');
  assert.strictEqual(resGA.displayBarcode, '1421-2045261-036 (023)');
  assert.strictEqual(formatTicketDisplayBarcode(resGA, [], null, 'GA'), '1421-2045261-036 (023)');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SCEL PARSER ADAPTER TESTS PASSED PERFECTLY!\n');
}
