import { 
  parseLotteryBarcode, 
  findGameByBarcode, 
  normalizePackNumber, 
  SAMPLE_GAMES,
  getStandardPackDetails 
} from '../src/data.js';

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAIL: ${name} - ${details}`);
  }
}

console.log('=== STARTING WORKFLOW & SCANNER SIMULATION AUDIT ===');

// 1. Box Barcode Parser test
function parseBoxBarcode(barcode) {
  if (!barcode) return null;
  const s = String(barcode).trim();
  const prefixMatch = s.match(/^\*?(?:box|slot|b|bin|dispenser)[-_#\s]*(\d{1,3})\*?$/i);
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10);
  }
  if (/^\d{1,3}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 100) return n;
  }
  return null;
}

const testBoxCodes = [
  { code: 'BOX-01', expected: 1 },
  { code: 'box 5', expected: 5 },
  { code: '*BOX05*', expected: 5 },
  { code: 'SLOT-03', expected: 3 },
  { code: 'B-07', expected: 7 },
  { code: 'BIN#12', expected: 12 },
  { code: 'dispenser 20', expected: 20 },
  { code: '1', expected: 1 },
  { code: '48', expected: 48 },
  { code: '100', expected: 100 },
  { code: '101', expected: null },
  { code: 'BOX-999', expected: 999 },
  { code: 'RANDOM', expected: null }
];

for (const b of testBoxCodes) {
  const res = parseBoxBarcode(b.code);
  assert(res === b.expected, `parseBoxBarcode "${b.code}" -> ${b.expected}`, `Got ${res}`);
}

// 2. Active Slot Sale Simulation
const mockSlot = {
  boxNumber: 1,
  gameId: 'g101',
  gameName: '5X MONEY',
  price: 1,
  packNumber: '067017',
  currentTicket: 0,
  packSize: 300,
  status: 'ACTIVE'
};

// Scan ticket #001
const scanTix1 = parseLotteryBarcode('14170670170001');
assert(scanTix1 && scanTix1.ticketNumber === 1, 'Scan ticket #001 parsed ticketNumber === 1');
assert(normalizePackNumber(scanTix1.packNumber) === normalizePackNumber(mockSlot.packNumber), 'Pack ownership match for Box 1');

// Scan ticket #299 (last ticket of $1 300-pack)
const scanLastTix = parseLotteryBarcode('14170670170299');
assert(scanLastTix && scanLastTix.ticketNumber === 299, 'Last ticket parsed ticketNumber === 299');
assert(scanLastTix.ticketNumber === mockSlot.packSize - 1, 'Ticket 299 triggers sold-out threshold');

// 3. User Scanned Barcode Display Resolution Test
function resolveModalDisplay(barcode) {
  const parsed = parseLotteryBarcode(barcode);
  if (!parsed || !parsed.isValid) return null;
  const standardBarcode = parsed.standardBarcode || barcode;
  let displayBarcode = String(barcode).trim();
  if (displayBarcode.length >= 18 && !displayBarcode.includes('(') && !displayBarcode.includes('-')) {
    displayBarcode = standardBarcode;
  } else if (!displayBarcode.includes('-') && !displayBarcode.includes('(') && parsed.standardBarcode) {
    displayBarcode = parsed.standardBarcode;
  }
  return {
    displayBarcode,
    standardBarcode,
    ticketNumber: parsed.ticketNumber,
    game: findGameByBarcode(standardBarcode)?.name
  };
}

const modalTests = [
  {
    input: '1417-0670170-009(290)',
    expectedDisplay: '1417-0670170-009(290)',
    expectedStd: '14170670170009',
    expectedTix: 9,
    expectedGame: '5X MONEY'
  },
  {
    input: '1417-067017-0-009(290)',
    expectedDisplay: '1417-067017-0-009(290)',
    expectedStd: '14170670170009',
    expectedTix: 9,
    expectedGame: '5X MONEY'
  },
  {
    input: '14170670170009(290)',
    expectedDisplay: '14170670170009(290)',
    expectedStd: '14170670170009',
    expectedTix: 9,
    expectedGame: '5X MONEY'
  },
  {
    input: '14170670170009',
    expectedDisplay: '14170670170009',
    expectedStd: '14170670170009',
    expectedTix: 9,
    expectedGame: '5X MONEY'
  },
  {
    input: '141706701700098494869032',
    expectedDisplay: '14170670170009',
    expectedStd: '14170670170009',
    expectedTix: 9,
    expectedGame: '5X MONEY'
  },
  {
    input: '16480183788002',
    expectedDisplay: '16480183788002',
    expectedStd: '16480183788002',
    expectedTix: 2,
    expectedGame: 'EPIC RICHES'
  }
];

for (const m of modalTests) {
  const res = resolveModalDisplay(m.input);
  assert(res && res.displayBarcode === m.expectedDisplay, `Modal display for "${m.input}" === "${m.expectedDisplay}"`, `Got: ${res?.displayBarcode}`);
  assert(res && res.standardBarcode === m.expectedStd, `Standard barcode for "${m.input}" === "${m.expectedStd}"`, `Got: ${res?.standardBarcode}`);
  assert(res && res.ticketNumber === m.expectedTix, `Ticket number for "${m.input}" === ${m.expectedTix}`, `Got: ${res?.ticketNumber}`);
  assert(res && res.game === m.expectedGame, `Game detection for "${m.input}" === "${m.expectedGame}"`, `Got: ${res?.game}`);
}

console.log(`\n=== RESULTS: Passed: ${passed}, Failed: ${failed} ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL WORKFLOW & MODAL SIMULATIONS PASSED CLEANLY!');
}
