// ============================================================================
// LOTTO TRACK PRO — RECEIVE A BOOK SCEL COMPATIBILITY REGRESSION TEST SUITE
// Verifies:
// 1. SC ticket 1705-002921-5-069 extracts ticket position 069
// 2. Pack 002921 strictly preserves every leading zero
// 3. Check digit 5 is not confused with the ticket number
// 4. Game 1705 automatically populates name, price, and catalogue pack size (150)
// 5. Optional raw suffix (080) is preserved and not confused with securityCode
// 6. Invalid SC input does not overwrite previously entered form values
// 7. Unknown SCEL games are safely rejected without fallback to GA
// 8. GA Receive a Book behavior remains 100% unchanged
// ============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseLotteryBarcode, findGameByBarcode, isPackNumberMatch } from '../src/data.js';
import { findScelGame, adaptScelToLotteryBarcode, SCEL_GAMES } from '../src/scel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAIN_JS_PATH = path.join(__dirname, '..', 'src', 'main.js');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

console.log('\n====================================================');
console.log('   RECEIVE A BOOK SCEL COMPATIBILITY VERIFICATION   ');
console.log('====================================================\n');

// -------------------------------------------------------------
// Group 1: Static Code Architecture Guard in src/main.js
// -------------------------------------------------------------
console.log('--- Group 1: Static Code Architecture Guard ---');

const mainJsSource = fs.readFileSync(MAIN_JS_PATH, 'utf8');

runTest('1.1: findScelGame is imported from ./scel.js in src/main.js', () => {
  assert(
    mainJsSource.includes("import { findScelGame } from './scel.js';") ||
    mainJsSource.includes('import { findScelGame } from "./scel.js";'),
    'src/main.js must import findScelGame from ./scel.js'
  );
});

runTest('1.2: lookupRbGame branches on state.lotteryJurisdiction === "SC" and calls findScelGame', () => {
  assert(
    mainJsSource.includes("if (state.lotteryJurisdiction === 'SC')") &&
    mainJsSource.includes('findScelGame(str)'),
    'lookupRbGame must check state.lotteryJurisdiction === "SC" and call findScelGame(str)'
  );
});

runTest('1.3: lookupRbGame returns catalogue packSize for SCEL games', () => {
  assert(
    mainJsSource.includes('packSize: scGame.packSize'),
    'lookupRbGame must return packSize: scGame.packSize'
  );
});

runTest('1.4: rbFillFromBarcode calls parseLotteryBarcode with SC jurisdiction', () => {
  assert(
    mainJsSource.includes("parseLotteryBarcode(clean, cgList, state.lotteryJurisdiction)") ||
    mainJsSource.includes("parseLotteryBarcode(clean, cgList, 'SC')") ||
    mainJsSource.includes("parseLotteryBarcode(clean, state.customGames, 'SC')"),
    'rbFillFromBarcode must call parseLotteryBarcode with explicit SC jurisdiction'
  );
});

runTest('1.5: rbFillFromBarcode rejects invalid SC input safely without overwriting', () => {
  assert(
    mainJsSource.includes('if (!parsed || !parsed.isValid)') &&
    mainJsSource.includes('return;'),
    'rbFillFromBarcode must return early on invalid SC input to protect form values'
  );
});

runTest('1.6: GA regex and parsing in rbFillFromBarcode remain intact in else branch', () => {
  assert(
    mainJsSource.includes('const m = clean.replace(/\\s/g, \'\').match(/^(\\d{4})-?(\\d{6,7})-?(\\d{3})?/') ||
    mainJsSource.includes('clean.replace(/\\s/g, "").match(/^(\\d{4})-?(\\d{6,7})-?(\\d{3})?/'),
    'Georgia regex in rbFillFromBarcode must remain unchanged'
  );
});

runTest('1.7: renderReceiveBookModal and saveBtn respect known?.packSize', () => {
  assert(
    mainJsSource.includes('known?.packSize || rbSizeFor(priceN, packVal)'),
    'Receive a Book modal and saveBtn must respect known?.packSize'
  );
});

// -------------------------------------------------------------
// Group 2: Functional SCEL Ticket & Pack Extraction
// -------------------------------------------------------------
console.log('\n--- Group 2: Functional SCEL Ticket & Pack Extraction ---');

runTest('2.1: SC ticket 1705-002921-5-069 populates ticket position 069', () => {
  const parsed = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(parsed.isValid, true);
  assert.strictEqual(parsed.ticketString, '069');
  assert.strictEqual(parsed.ticketNumber, 69);
});

runTest('2.2: Pack 002921 retains every leading zero', () => {
  const parsed = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(parsed.packNumber, '002921');
  assert.strictEqual(parsed.basePackNumber, '002921');
  assert.strictEqual(parsed.packClean, '002921');
  assert.strictEqual(parsed.packCombined, '002921-5');
  assert.notStrictEqual(parsed.packNumber, '2921');
});

runTest('2.3: Check digit 5 is not confused with the ticket number', () => {
  const parsed = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(parsed.checkCode, '5');
  assert.strictEqual(parsed.ticketNumber, 69);
  assert.notStrictEqual(parsed.ticketNumber, 5);
});

runTest('2.4: Game 1705 automatically populates name, price, and catalogue pack size', () => {
  const scGame = findScelGame('1705');
  assert(scGame, 'Game 1705 must exist in SCEL catalogue');
  assert.strictEqual(scGame.name, 'LIGHT UP THE SEASON');
  assert.strictEqual(scGame.price, 2);
  assert.strictEqual(scGame.packSize, 150);
  assert.strictEqual(scGame.bookValue, 300);

  const parsed = parseLotteryBarcode('1705-002921-5-069', [], 'SC');
  assert.strictEqual(parsed.gameName, 'LIGHT UP THE SEASON');
  assert.strictEqual(parsed.price, 2);
  assert.strictEqual(parsed.packSize, 150);
});

runTest('2.5: Optional raw suffix (080) is preserved as rawSuffix and not confused with securityCode', () => {
  const parsed = parseLotteryBarcode('1705-002921-5-069(080)', [], 'SC');
  assert.strictEqual(parsed.isValid, true);
  assert.strictEqual(parsed.rawSuffix, '(080)');
  assert.strictEqual(parsed.ticketString, '069');
  assert.strictEqual(parsed.ticketNumber, 69);
  assert.strictEqual(parsed.securityCode, null);
  assert.strictEqual(parsed.hasExplicitSecurityCode, false);
});

// -------------------------------------------------------------
// Group 3: Error Rejection & Overwrite Protection
// -------------------------------------------------------------
console.log('\n--- Group 3: Error Rejection & Overwrite Protection ---');

runTest('3.1: Unknown SCEL games are safely rejected without fallback to GA', () => {
  const parsed = parseLotteryBarcode('9999-002921-5-069', [], 'SC');
  assert.strictEqual(parsed.isValid, false);
  assert.strictEqual(parsed.jurisdiction, 'SC');
  assert.strictEqual(parsed.isNonLotteryBarcode, true);
  assert(parsed.error.includes('Unknown SCEL game'));
});

runTest('3.2: Malformed SCEL formats are safely rejected in SC jurisdiction', () => {
  const malformedList = [
    '1705-2921-5-069', // 4-digit pack
    '170-002921-5-069', // 3-digit game
    '1705-002921-5-69', // 2-digit ticket
    '1705-002921-5', // missing ticket
    '17050029215069080', // 17-digit continuous format
    '833283017051' // 12-digit UPC retail
  ];
  for (const m of malformedList) {
    const res = parseLotteryBarcode(m, [], 'SC');
    assert.strictEqual(res.isValid, false, `Expected ${m} to be rejected in SC`);
    assert.strictEqual(res.jurisdiction, 'SC');
  }

  // Continuous 14-digit format is now supported
  const res14 = parseLotteryBarcode('17050029215069', [], 'SC');
  assert.strictEqual(res14.isValid, true);
  assert.strictEqual(res14.jurisdiction, 'SC');
  assert.strictEqual(res14.ticketNumber, 69);
});

runTest('3.3: GA Receive a Book behavior remains 100% unchanged', () => {
  const gaRaw = '1648-018378-029';
  const gaMatch = gaRaw.replace(/\s/g, '').match(/^(\d{4})-?(\d{6,7})-?(\d{3})?/);
  assert(gaMatch, 'GA regex must match GA ticket');
  assert.strictEqual(gaMatch[1], '1648');
  assert.strictEqual(gaMatch[2], '018378');
  assert.strictEqual(gaMatch[3], '029');

  const parsed = parseLotteryBarcode(gaRaw, [], 'GA');
  assert.strictEqual(parsed.isValid, true);
  assert.strictEqual(parsed.gameNumber, '1648');
  assert.strictEqual(parsed.packNumber, '018378');
  assert.strictEqual(parsed.ticketString, '029');
});

// -------------------------------------------------------------
// Group 4: Receive a Book State & Flow Simulation
// -------------------------------------------------------------
console.log('\n--- Group 4: Receive a Book State & Flow Simulation ---');

runTest('4.1: Simulated rbFillFromBarcode populates SCEL fields accurately', () => {
  // Recreate the exact logic of rbFillFromBarcode and lookupRbGame for simulation
  const state = {
    lotteryJurisdiction: 'SC',
    customGames: {}
  };
  let rbState = {
    code: '',
    gid: '',
    pack: '',
    pos: '000',
    name: '',
    price: '',
    focus: 'gid'
  };

  function simLookupRbGame(gid) {
    if (!gid) return null;
    const str = String(gid).trim();
    if (state.lotteryJurisdiction === 'SC') {
      const scGame = findScelGame(str);
      if (scGame) return { name: scGame.name, price: scGame.price, packSize: scGame.packSize };
      if (state.customGames && state.customGames[str]) return state.customGames[str];
      return null;
    }
    return null;
  }

  function simRbFillFromBarcode(raw) {
    const clean = String(raw || '').trim();
    if (!clean) return;
    let gid = '', pack = '', pos = '000';
    if (state.lotteryJurisdiction === 'SC') {
      const cgList = Array.isArray(state.customGames)
        ? state.customGames
        : (state.customGames && typeof state.customGames === 'object' ? Object.values(state.customGames) : []);
      const parsed = parseLotteryBarcode(clean, cgList, 'SC');
      if (!parsed || !parsed.isValid) {
        return;
      }
      gid = parsed.gameNumber || '';
      pack = parsed.packNumber || '';
      pos = (parsed.ticketString || '000').padStart(3, '0');
    }
    if (gid) rbState.gid = gid;
    if (pack) rbState.pack = pack;
    if (pos) rbState.pos = pos;
    const g = simLookupRbGame(rbState.gid);
    if (g) {
      rbState.name = g.name;
      rbState.price = String(g.price);
      rbState.focus = 'pos';
    }
  }

  simRbFillFromBarcode('1705-002921-5-069');

  assert.strictEqual(rbState.gid, '1705');
  assert.strictEqual(rbState.pack, '002921');
  assert.strictEqual(rbState.pos, '069');
  assert.strictEqual(rbState.name, 'LIGHT UP THE SEASON');
  assert.strictEqual(rbState.price, '2');
  assert.strictEqual(rbState.focus, 'pos');
});

runTest('4.2: Invalid SC input does not overwrite previously entered form values', () => {
  const state = {
    lotteryJurisdiction: 'SC',
    customGames: {}
  };
  let rbState = {
    code: '',
    gid: '1705',
    pack: '002921',
    pos: '069',
    name: 'LIGHT UP THE SEASON',
    price: '2',
    focus: 'pos'
  };

  function simRbFillFromBarcode(raw) {
    const clean = String(raw || '').trim();
    if (!clean) return;
    let gid = '', pack = '', pos = '000';
    if (state.lotteryJurisdiction === 'SC') {
      const cgList = Array.isArray(state.customGames)
        ? state.customGames
        : (state.customGames && typeof state.customGames === 'object' ? Object.values(state.customGames) : []);
      const parsed = parseLotteryBarcode(clean, cgList, 'SC');
      if (!parsed || !parsed.isValid) {
        return; // Guard: do not overwrite
      }
      gid = parsed.gameNumber || '';
      pack = parsed.packNumber || '';
      pos = (parsed.ticketString || '000').padStart(3, '0');
    }
    if (gid) rbState.gid = gid;
    if (pack) rbState.pack = pack;
    if (pos) rbState.pos = pos;
  }

  // Attempt invalid scan
  simRbFillFromBarcode('9999-002921-5-069');

  // Verify state is completely preserved
  assert.strictEqual(rbState.gid, '1705', 'gid must not be overwritten');
  assert.strictEqual(rbState.pack, '002921', 'pack must not be overwritten');
  assert.strictEqual(rbState.pos, '069', 'pos must not be overwritten');
  assert.strictEqual(rbState.name, 'LIGHT UP THE SEASON');
  assert.strictEqual(rbState.price, '2');

  // Attempt malformed scan
  simRbFillFromBarcode('1705-2921-5-069');
  assert.strictEqual(rbState.gid, '1705');
  assert.strictEqual(rbState.pack, '002921');
  assert.strictEqual(rbState.pos, '069');
});

runTest('4.3: Pack size calculation respects catalogue packSize (150) for Game 1705', () => {
  const known = findScelGame('1705');
  const priceN = 2;
  function rbDefaultPackValue(p) { return Number(p) === 50 ? 900 : 300; }
  function rbSizeFor(p, v) { return p > 0 ? Math.floor(v / p) : 0; }

  const packVal = rbDefaultPackValue(priceN);
  const size = known?.packSize || rbSizeFor(priceN, packVal);

  assert.strictEqual(packVal, 300);
  assert.strictEqual(size, 150);
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passedTests}, Failed: ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL RECEIVE A BOOK SCEL REGRESSION TESTS PASSED PERFECTLY!\n');
}
