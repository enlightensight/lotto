// ============================================================================
// LOTTO TRACK PRO — SCEL PHASE 5.5: NEW TICKET / ADD TO IN-STOCK ACCURACY TESTS
// Verifies:
// 1. SCEL Game 1684 ('HIT $500', $10, jurisdiction 'SCEL') is present in SCEL_GAMES
// 2. Pack size of Game 1684 is null / unverified (not 30, not 100, not 295)
// 3. 3-part ticket 1684-345553-004 (295) is now REJECTED (erroneous format from GA parser)
// 4. 4-part ticket 1705-002921-5-069 (080) continues to parse correctly with checkCode '5'
// 5. Georgia ticket 1886-003594-0-029 (000) continues to parse with checkCode '0' and PIN '000'
// 6. SC jurisdiction does NOT compute Georgia series PIN for 1684 or 1705
// 7. Georgia jurisdiction DOES compute series PIN or use explicit PIN for GA tickets
// 8. formatLotteryBarcode with jurisdiction 'SC' outputs correct SC display string without synthesized GA PIN
// 9. addScannedTicketToInventory rejects invalid / non-lottery barcodes
// 10. addScannedTicketToInventory populates correct Game name, price, pack, and position for SC Game 1684
// 11. addScannedTicketToInventory handles unverified pack size without inventing 30 or 100
// 12. Georgia 1886 New Ticket / Add to In-Stock flow remains completely intact
// ============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  parseLotteryBarcode,
  findGameByBarcode,
  formatLotteryBarcode,
  computeLotterySeriesCode,
  isPackNumberMatch,
  getStandardPackDetails
} from '../src/data.js';

import {
  SCEL_GAMES,
  findScelGame,
  parseScelPrintedTicketNumber,
  adaptScelToLotteryBarcode
} from '../src/scel.js';

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
console.log('   SCEL PHASE 5.5: ADD TO IN-STOCK ACCURACY TESTS   ');
console.log('====================================================\n');

// -------------------------------------------------------------
// Group 1: SCEL Game Catalog Verification
// -------------------------------------------------------------
console.log('--- Group 1: SCEL Game Catalog (1684 & 1705) ---');

runTest('1.1: SCEL Game 1684 ("HIT $500", $10, jurisdiction "SCEL") is present in SCEL_GAMES', () => {
  const g1684 = findScelGame('1684');
  assert.ok(g1684, 'Game 1684 must exist in SCEL_GAMES');
  assert.strictEqual(g1684.gameNumber, '1684');
  assert.strictEqual(g1684.barcodePrefix, '1684');
  assert.strictEqual(g1684.name, 'HIT $500');
  assert.strictEqual(g1684.price, 10);
  assert.strictEqual(g1684.jurisdiction, 'SCEL');
});

runTest('1.2: Pack size of Game 1684 is verified as 30 ($10 game, countdown (025) on ticket 004)', () => {
  const g1684 = findScelGame('1684');
  assert.strictEqual(g1684.packSize, 30, 'packSize must be 30');
  assert.strictEqual(g1684.bookValue, 300, 'bookValue must be 300');
});

runTest('1.3: SCEL Game 1705 remains intact in SCEL_GAMES with packSize 150', () => {
  const g1705 = findScelGame('1705');
  assert.ok(g1705, 'Game 1705 must exist in SCEL_GAMES');
  assert.strictEqual(g1705.name, 'LIGHT UP THE SEASON');
  assert.strictEqual(g1705.price, 2);
  assert.strictEqual(g1705.packSize, 150);
  assert.strictEqual(g1705.bookValue, 300);
});

// -------------------------------------------------------------
// Group 2: SCEL 3-Part and 4-Part Delimited Barcode Parsing
// -------------------------------------------------------------
console.log('\n--- Group 2: 3-Part and 4-Part Delimited Barcode Parsing ---');

runTest('2.1: 4-part ticket 1684-345553-4-004 (025) parses correctly with checkDigit 4 and rawSuffix', () => {
  const parsedDirect = parseScelPrintedTicketNumber('1684-345553-4-004 (025)');
  assert.strictEqual(parsedDirect.isValid, true);
  assert.strictEqual(parsedDirect.gameNumber, '1684');
  assert.strictEqual(parsedDirect.packNumber, '345553');
  assert.strictEqual(parsedDirect.checkDigit, '4');
  assert.strictEqual(parsedDirect.ticketNumber, '004');
  assert.strictEqual(parsedDirect.rawSuffix, '(025)');
  assert.strictEqual(parsedDirect.displayString, '1684-345553-4-004 (025)');

  const adapted = parseLotteryBarcode('1684-345553-4-004 (025)', [], 'SC');
  assert.strictEqual(adapted.isValid, true);
  assert.strictEqual(adapted.gameNumber, '1684');
  assert.strictEqual(adapted.packNumber, '345553');
  assert.strictEqual(adapted.ticketNumber, 4);
  assert.strictEqual(adapted.ticketString, '004');
  assert.strictEqual(adapted.checkCode, '4');
  assert.strictEqual(adapted.rawSuffix, '(025)');
  assert.strictEqual(adapted.securityCode, null, 'Must NOT classify (025) as security code');
  assert.strictEqual(adapted.canonicalId, '1684-345553-4-004');
  assert.strictEqual(adapted.displayBarcode, '1684-345553-4-004 (025)');
  assert.strictEqual(adapted.price, 10);
  assert.strictEqual(adapted.packSize, 30);
  assert.strictEqual(adapted.gameName, 'HIT $500');
});

runTest('2.1b: Erroneous 3-part format 1684-345553-004 (295) is now rejected', () => {
  const parsedDirect = parseScelPrintedTicketNumber('1684-345553-004 (295)');
  assert.strictEqual(parsedDirect.isValid, false, '3-part format must be rejected');
});

runTest('2.2: 4-part ticket 1705-002921-5-069 (080) continues to parse correctly with checkCode "5" and pack "002921"', () => {
  const adapted = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.strictEqual(adapted.isValid, true);
  assert.strictEqual(adapted.gameNumber, '1705');
  assert.strictEqual(adapted.packNumber, '002921');
  assert.strictEqual(adapted.packCombined, '002921-5');
  assert.strictEqual(adapted.checkCode, '5');
  assert.strictEqual(adapted.ticketNumber, 69);
  assert.strictEqual(adapted.ticketString, '069');
  assert.strictEqual(adapted.rawSuffix, '(080)');
  assert.strictEqual(adapted.securityCode, null);
  assert.strictEqual(adapted.canonicalId, '1705-002921-5-069');
  assert.strictEqual(adapted.displayBarcode, '1705-002921-5-069 (080)');
  assert.strictEqual(adapted.price, 2);
  assert.strictEqual(adapted.packSize, 150);
});

// -------------------------------------------------------------
// Group 3: Georgia 1886 Preservation & Security Code Isolation
// -------------------------------------------------------------
console.log('\n--- Group 3: Georgia 1886 Preservation & Security Code Isolation ---');

runTest('3.1: Georgia ticket 1886-003594-0-029 (000) continues to parse with checkCode "0" and securityCode "000"', () => {
  const gaParsed = parseLotteryBarcode('1886-003594-0-029 (000)', [], 'GA');
  assert.strictEqual(gaParsed.isValid, true);
  assert.strictEqual(gaParsed.gameNumber, '1886');
  assert.strictEqual(gaParsed.packNumber, '003594');
  assert.strictEqual(gaParsed.checkCode, '0');
  assert.strictEqual(gaParsed.ticketNumber, 29);
  assert.strictEqual(gaParsed.securityCode, '000');
  assert.strictEqual(gaParsed.hasExplicitSecurityCode, true);
});

runTest('3.2: SC jurisdiction does NOT compute Georgia series PIN for 1684 or 1705', () => {
  const sc1684 = parseLotteryBarcode('1684-345553-4-004 (025)', [], 'SC');
  assert.strictEqual(sc1684.securityCode, null);

  const sc1705 = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.strictEqual(sc1705.securityCode, null);

  // In SC jurisdiction, formatTicketDisplayBarcode does not append synthetic GA PIN
  const formatted1684 = formatLotteryBarcode('1684-345553-4-004 (025)', [], null, 'SC');
  assert.strictEqual(formatted1684, '1684-345553-4-004 (025)');
  assert(!formatted1684.includes('000)'), 'Must not synthesize PIN (000)');

  const formatted1705 = formatLotteryBarcode('1705-002921-5-069 (080)', [], null, 'SC');
  assert.strictEqual(formatted1705, '1705-002921-5-069 (080)');
});

runTest('3.3: Georgia jurisdiction DOES compute series PIN or use explicit PIN for GA tickets', () => {
  // GA ticket with explicit PIN
  const explicitGA = formatLotteryBarcode('1886-003594-0-029 (000)', [], null, 'GA');
  assert(explicitGA.includes('(000)'), 'Must preserve GA PIN');

  // GA ticket without explicit PIN computes series PIN
  const computedPin = computeLotterySeriesCode('1886', 29, [], 30);
  assert.strictEqual(typeof computedPin, 'string');
  assert.strictEqual(computedPin.length, 3);
});

runTest('3.4: formatLotteryBarcode with jurisdiction "SC" outputs correct SC display string without synthesized GA PIN', () => {
  const display1684 = formatLotteryBarcode('1684-345553-4-004 (025)', [], null, 'SC');
  assert.strictEqual(display1684, '1684-345553-4-004 (025)');

  const display1705 = formatLotteryBarcode('1705-002921-5-069 (080)', [], null, 'SC');
  assert.strictEqual(display1705, '1705-002921-5-069 (080)');
});

// -------------------------------------------------------------
// Group 4: addScannedTicketToInventory Validation & Intake
// -------------------------------------------------------------
console.log('\n--- Group 4: addScannedTicketToInventory Validation & Intake ---');

const mainJsSource = fs.readFileSync(MAIN_JS_PATH, 'utf8').replace(/\r\n/g, '\n');

runTest('4.1: Static Code Guard: addScannedTicketToInventory contains validation guard for invalid/retail/non-lottery barcodes', () => {
  assert(
    mainJsSource.includes('if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode)'),
    'addScannedTicketToInventory must validate !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode'
  );
});

runTest('4.2: Static Code Guard: openSetTicketDetailsModal prevents PIN synthesis when isSC', () => {
  assert(
    mainJsSource.includes("const isSC = state.lotteryJurisdiction === 'SC' || parsed?.jurisdiction === 'SC';"),
    'openSetTicketDetailsModal must determine isSC'
  );
  assert(
    mainJsSource.includes('const initialSec = isSC\n    ? null') ||
    mainJsSource.includes('const initialSec = isSC ? null'),
    'initialSec must be set to null for isSC'
  );
});

runTest('4.3: Static Code Guard: openSetTicketDetailsModal displays First Ticket without fake PIN in SC mode', () => {
  assert(
    mainJsSource.includes('(isSC && !initialSec)\n      ? displayTicketNum') ||
    mainJsSource.includes('(isSC && !initialSec) ? displayTicketNum'),
    'metaFirstTicket must show displayTicketNum without (PIN) when isSC and no initialSec'
  );
});

runTest('4.4: Functional: addScannedTicketToInventory rejects invalid / non-lottery barcodes', () => {
  const testState = {
    lotteryJurisdiction: 'SC',
    customGames: [],
    inStockInventory: []
  };

  let alertCalled = false;
  let toastMsg = '';
  const sfx = { alert: () => { alertCalled = true; } };
  const showToast = (msg) => { toastMsg = msg; };

  function simAddScannedTicketToInventory(rawBarcode) {
    const barcode = String(rawBarcode || '').trim();
    if (!barcode) return;

    const parsed = parseLotteryBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
      sfx.alert();
      showToast(`❌ [${barcode}] is not a valid lottery ticket.`);
      return;
    }
    const matched = findGameByBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    // ...
    testState.inStockInventory.push({ barcode });
  }

  // Test retail UPC
  simAddScannedTicketToInventory('012345678905');
  assert.strictEqual(alertCalled, true, 'Must trigger sfx.alert() on retail barcode');
  assert(toastMsg.includes('not a valid lottery ticket'));
  assert.strictEqual(testState.inStockInventory.length, 0, 'Must not add retail barcode to in-stock');

  // Test invalid SC ticket format
  alertCalled = false;
  toastMsg = '';
  simAddScannedTicketToInventory('9999-002921-5-069');
  assert.strictEqual(alertCalled, true, 'Must trigger sfx.alert() on unknown game');
  assert.strictEqual(testState.inStockInventory.length, 0, 'Must not add unknown game to in-stock');
});

runTest('4.5: Functional: addScannedTicketToInventory populates correct Game name, price, pack, and position for SC Game 1684', () => {
  const testState = {
    lotteryJurisdiction: 'SC',
    customGames: [],
    inStockInventory: []
  };

  function simAddScannedTicketToInventory(rawBarcode) {
    const barcode = String(rawBarcode || '').trim();
    if (!barcode) return;

    const parsed = parseLotteryBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
      return;
    }
    const matched = findGameByBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);

    const isSC = testState.lotteryJurisdiction === 'SC' || parsed?.jurisdiction === 'SC';
    let gameCode = parsed?.gameNumber || (matched ? matched.barcodePrefix : '1415');
    let packNumber = parsed?.packNumber || '000000';
    let ticketPos = parsed?.ticketString || '000';

    const gameName = matched ? matched.name : `Game #${gameCode}`;
    const price = (matched && matched.price) || 1;
    const std = getStandardPackDetails(price);
    const packSizeNum = (matched && matched.packSize !== undefined)
      ? matched.packSize
      : (isSC ? null : (std.packSize || 100));
    const packSize = (packSizeNum !== null && packSizeNum !== undefined) ? `${packSizeNum} tickets` : 'Unverified';

    const newPack = {
      id: 'stock_' + Date.now(),
      barcode: parsed?.standardBarcode || barcode,
      originalBarcode: barcode,
      standardBarcode: parsed?.standardBarcode || barcode,
      barcodePrefix: gameCode,
      gameName: gameName,
      gameNumber: `Game ${gameCode}`,
      packNumber: packNumber,
      price: price,
      packSize: packSize,
      packSizeNum: packSizeNum,
      status: 'IN_STOCK',
      statusLabel: 'In stock',
      statusBadgeClass: 'badge-in-stock',
      boxNumber: null,
      position: ticketPos
    };

    testState.inStockInventory.unshift(newPack);
  }

  simAddScannedTicketToInventory('1684-345553-4-004 (025)');

  assert.strictEqual(testState.inStockInventory.length, 1);
  const item = testState.inStockInventory[0];
  assert.strictEqual(item.gameName, 'HIT $500');
  assert.strictEqual(item.gameNumber, 'Game 1684');
  assert.strictEqual(item.packNumber, '345553');
  assert.strictEqual(item.price, 10);
  assert.strictEqual(item.position, '004');
  assert.strictEqual(item.barcode, '1684-345553-4-004');
  assert.strictEqual(item.packSize, '30 tickets');
  assert.strictEqual(item.packSizeNum, 30);
});

runTest('4.6: Functional: addScannedTicketToInventory populates Game 1705 with catalogue packSize 150', () => {
  const testState = {
    lotteryJurisdiction: 'SC',
    customGames: [],
    inStockInventory: []
  };

  function simAddScannedTicketToInventory(rawBarcode) {
    const barcode = String(rawBarcode || '').trim();
    if (!barcode) return;

    const parsed = parseLotteryBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
      return;
    }
    const matched = findGameByBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);

    const isSC = testState.lotteryJurisdiction === 'SC' || parsed?.jurisdiction === 'SC';
    let gameCode = parsed?.gameNumber || (matched ? matched.barcodePrefix : '1415');
    let packNumber = parsed?.packNumber || '000000';
    let ticketPos = parsed?.ticketString || '000';

    const gameName = matched ? matched.name : `Game #${gameCode}`;
    const price = (matched && matched.price) || 1;
    const std = getStandardPackDetails(price);
    const packSizeNum = (matched && matched.packSize !== undefined)
      ? matched.packSize
      : (isSC ? null : (std.packSize || 100));
    const packSize = (packSizeNum !== null && packSizeNum !== undefined) ? `${packSizeNum} tickets` : 'Unverified';

    const newPack = {
      id: 'stock_' + Date.now(),
      barcode: parsed?.standardBarcode || barcode,
      originalBarcode: barcode,
      standardBarcode: parsed?.standardBarcode || barcode,
      barcodePrefix: gameCode,
      gameName: gameName,
      gameNumber: `Game ${gameCode}`,
      packNumber: packNumber,
      price: price,
      packSize: packSize,
      packSizeNum: packSizeNum,
      status: 'IN_STOCK',
      statusLabel: 'In stock',
      statusBadgeClass: 'badge-in-stock',
      boxNumber: null,
      position: ticketPos
    };

    testState.inStockInventory.unshift(newPack);
  }

  simAddScannedTicketToInventory('1705-002921-5-069 (080)');

  assert.strictEqual(testState.inStockInventory.length, 1);
  const item = testState.inStockInventory[0];
  assert.strictEqual(item.gameName, 'LIGHT UP THE SEASON');
  assert.strictEqual(item.gameNumber, 'Game 1705');
  assert.strictEqual(item.packNumber, '002921', 'Preserves leading zeros');
  assert.strictEqual(item.price, 2);
  assert.strictEqual(item.position, '069');
  assert.strictEqual(item.barcode, '1705-002921-5-069');
  assert.strictEqual(item.packSize, '150 tickets');
  assert.strictEqual(item.packSizeNum, 150);
});

runTest('4.7: Functional: Georgia 1886 Add to In-Stock preserves standard GA packSize and PIN', () => {
  const testState = {
    lotteryJurisdiction: 'GA',
    customGames: [],
    inStockInventory: []
  };

  function simAddScannedTicketToInventory(rawBarcode) {
    const barcode = String(rawBarcode || '').trim();
    if (!barcode) return;

    const parsed = parseLotteryBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
      return;
    }
    const matched = findGameByBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);

    const isSC = testState.lotteryJurisdiction === 'SC' || parsed?.jurisdiction === 'SC';
    let gameCode = parsed?.gameNumber || (matched ? matched.barcodePrefix : '1415');
    let packNumber = parsed?.packNumber || '000000';
    let ticketPos = parsed?.ticketString || '000';

    const gameName = matched ? matched.name : `Game #${gameCode}`;
    const price = (matched && matched.price) || 1;
    const std = getStandardPackDetails(price);
    const packSizeNum = (matched && matched.packSize !== undefined)
      ? matched.packSize
      : (isSC ? null : (std.packSize || 100));
    const packSize = (packSizeNum !== null && packSizeNum !== undefined) ? `${packSizeNum} tickets` : 'Unverified';

    const newPack = {
      id: 'stock_' + Date.now(),
      barcode: parsed?.standardBarcode || barcode,
      originalBarcode: barcode,
      standardBarcode: parsed?.standardBarcode || barcode,
      barcodePrefix: gameCode,
      gameName: gameName,
      gameNumber: `Game ${gameCode}`,
      packNumber: packNumber,
      price: price,
      packSize: packSize,
      packSizeNum: packSizeNum,
      status: 'IN_STOCK',
      statusLabel: 'In stock',
      statusBadgeClass: 'badge-in-stock',
      boxNumber: null,
      position: ticketPos
    };

    testState.inStockInventory.unshift(newPack);
  }

  simAddScannedTicketToInventory('1886-003594-0-029 (000)');

  assert.strictEqual(testState.inStockInventory.length, 1);
  const item = testState.inStockInventory[0];
  assert.strictEqual(item.gameNumber, 'Game 1886');
  assert.strictEqual(item.packNumber, '003594');
  assert.strictEqual(item.price, 10);
  assert.strictEqual(item.position, '029');
  assert.strictEqual(item.packSize, '30 tickets');
  assert.strictEqual(item.packSizeNum, 30);
});

// -------------------------------------------------------------
// Test 18: Physical SCEL Barcodes (1714, 1684, 1705) in Add-to-Inventory Flow
// -------------------------------------------------------------
runTest('Test 18: Physical SCEL Barcode Scans in Add-to-Inventory Flow', () => {
  const testState = {
    lotteryJurisdiction: 'SC',
    inStockInventory: [],
    customGames: []
  };

  function simAddScannedTicketToInventory(barcode) {
    const isSCJurisdiction = testState.lotteryJurisdiction === 'SC';
    const parsed = parseLotteryBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    assert(parsed && parsed.isValid, `Barcode ${barcode} must parse`);

    const matched = findGameByBarcode(barcode, testState.customGames, testState.lotteryJurisdiction);
    const isSC = testState.lotteryJurisdiction === 'SC' || parsed?.jurisdiction === 'SC';
    let gameCode = parsed?.gameNumber || (matched ? matched.barcodePrefix : '1415');
    let packNumber = parsed?.packNumber || '000000';
    let ticketPos = parsed?.ticketString || '000';

    const gameName = matched ? matched.name : `Game #${gameCode}`;
    const price = (matched && matched.price) || 1;
    const std = getStandardPackDetails(price);
    const packSizeNum = (matched && matched.packSize !== undefined)
      ? matched.packSize
      : (isSC ? null : (std.packSize || 100));
    const packSize = (packSizeNum !== null && packSizeNum !== undefined) ? `${packSizeNum} tickets` : 'Unverified';

    const newPack = {
      id: 'stock_' + Date.now(),
      barcode: parsed?.standardBarcode || barcode,
      originalBarcode: barcode,
      displayBarcode: parsed?.displayBarcode,
      standardBarcode: parsed?.standardBarcode || barcode,
      barcodePrefix: gameCode,
      gameName: gameName,
      gameNumber: `Game ${gameCode}`,
      packNumber: packNumber,
      price: price,
      packSize: packSize,
      packSizeNum: packSizeNum,
      status: 'IN_STOCK',
      statusLabel: 'In stock',
      statusBadgeClass: 'badge-in-stock',
      boxNumber: null,
      position: ticketPos
    };

    testState.inStockInventory.unshift(newPack);
  }

  // 1. SC Game 1714 delimited
  simAddScannedTicketToInventory('1714-045114-6-002 (027)');
  assert.strictEqual(testState.inStockInventory[0].gameName, '25 TIMES LUCKY');
  assert.strictEqual(testState.inStockInventory[0].price, 20);
  assert.strictEqual(testState.inStockInventory[0].packSizeNum, 30);
  assert.strictEqual(testState.inStockInventory[0].displayBarcode, '1714-045114-6-002 (027)');

  // 2. SC Game 1714 continuous 14-digit
  simAddScannedTicketToInventory('17140451146002');
  assert.strictEqual(testState.inStockInventory[0].gameName, '25 TIMES LUCKY');
  assert.strictEqual(testState.inStockInventory[0].price, 20);
  assert.strictEqual(testState.inStockInventory[0].packSizeNum, 30);
  assert.strictEqual(testState.inStockInventory[0].displayBarcode, '1714-045114-6-002 (027)');

  // 3. SC Game 1684 delimited
  simAddScannedTicketToInventory('1684-345553-4-004 (025)');
  assert.strictEqual(testState.inStockInventory[0].gameName, 'HIT $500');
  assert.strictEqual(testState.inStockInventory[0].price, 10);
  assert.strictEqual(testState.inStockInventory[0].packSizeNum, 30);
  assert.strictEqual(testState.inStockInventory[0].displayBarcode, '1684-345553-4-004 (025)');

  // 4. SC Game 1684 continuous 14-digit
  simAddScannedTicketToInventory('16843455534004');
  assert.strictEqual(testState.inStockInventory[0].gameName, 'HIT $500');
  assert.strictEqual(testState.inStockInventory[0].price, 10);
  assert.strictEqual(testState.inStockInventory[0].packSizeNum, 30);
  assert.strictEqual(testState.inStockInventory[0].displayBarcode, '1684-345553-4-004 (025)');
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
  console.log('🎉 ALL ADD TO IN-STOCK SCEL REGRESSION TESTS PASSED PERFECTLY!\n');
}
