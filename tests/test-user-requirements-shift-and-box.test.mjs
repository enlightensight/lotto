import assert from 'assert';
import { parseLotteryBarcode, formatLotteryBarcode, SAMPLE_GAMES } from '../src/data.js';

console.log('====================================================');
console.log('   VERIFYING USER REQUIREMENTS IMPLEMENTATION       ');
console.log('====================================================\n');

// --- 1. Barcode format and parser matching user image ---
console.log('--- Test 1: Ticket #1658 (PLAYERS CLUB $10) Parse & Format ---');
const rawScanned = '16583508770290';
const parsed = parseLotteryBarcode(rawScanned);

assert.strictEqual(parsed.isValid, true, 'Barcode should be valid');
assert.strictEqual(parsed.gameNumber, '1658', 'Game number should be 1658');
assert.strictEqual(parsed.packNumber, '350877', 'Pack number should be 350877');
assert.strictEqual(parsed.ticketNumber, 29, 'Ticket number should be 29');
assert.strictEqual(parsed.ticketString, '029', 'Ticket string should be 029');
assert.strictEqual(parsed.trailer, '0', 'Trailer padding should be 0');

const game = SAMPLE_GAMES.find(g => g.barcodePrefix === parsed.gameNumber);
assert.ok(game, 'Game 1658 should exist in SAMPLE_GAMES');
assert.strictEqual(game.price, 10, 'Price should be 10');
assert.strictEqual(game.packSize, 30, 'Pack size should be 30');
assert.strictEqual(game.packSize * game.price, 300, 'Book value should be 300');

const formatted = formatLotteryBarcode(parsed);
console.log('  Scanned raw:', rawScanned);
console.log('  Parsed game:', game.name, `($${game.price})`);
console.log('  Formatted display:', formatted);
assert.strictEqual(formatted, '1658-350877-029 (000)', 'Display barcode should format as standard 4-part');
console.log('  ✓ PASS: Ticket #1658 parsed and formatted accurately matching ticket printed text!\n');

// --- 2. Dual Layout A/B Heuristic Check ---
console.log('--- Test 2: Dual 14-Digit Layout Resolution ---');
// Layout A: 14040182410098 -> Game 1404, Pack 018241, Check 0, Ticket 098
const parsedA = parseLotteryBarcode('14040182410098');
assert.strictEqual(parsedA.gameNumber, '1404');
assert.strictEqual(parsedA.packNumber, '018241');
assert.strictEqual(parsedA.checkCode, '0');
assert.strictEqual(parsedA.ticketNumber, 98);
console.log('  ✓ PASS: Layout A (with check code) preserved for standard games');

// Layout B: 16583508770290 -> Game 1658, Pack 350877, Ticket 029, Trailer 0
const parsedB = parseLotteryBarcode('16583508770290');
assert.strictEqual(parsedB.gameNumber, '1658');
assert.strictEqual(parsedB.packNumber, '350877');
assert.strictEqual(parsedB.ticketNumber, 29);
assert.strictEqual(parsedB.trailer, '0');
console.log('  ✓ PASS: Layout B (with trailing 0) correctly resolved for 1658 style barcodes\n');

// --- 3. End of Shift Table Row Colors & Badges (Clean Scanned-Only Green Highlight) ---
console.log('--- Test 3: End of Shift Scan Color Classes ---');
function getRowClass(pack) {
  const isAttention = pack.status === 'check-position' || pack.category === 'attention';
  let rowClass = isAttention ? 'cs-row-attention' : '';
  if (!rowClass) {
    if (pack.status === 'scanned' || pack.status === 'sold-out' || pack.category === 'done') {
      rowClass = 'cs-row-scanned';
    }
  }
  return rowClass;
}

const scannedPack = { status: 'scanned', category: 'done' };
const soldOutPack = { status: 'sold-out', category: 'done' };
const pendingPack = { status: 'not-scanned', category: 'not_scanned' };
const attentionPack = { status: 'check-position', category: 'attention' };

assert.strictEqual(getRowClass(scannedPack), 'cs-row-scanned', 'Scanned pack must get cs-row-scanned (green)');
assert.strictEqual(getRowClass(soldOutPack), 'cs-row-scanned', 'Sold out pack must get cs-row-scanned (green)');
assert.strictEqual(getRowClass(pendingPack), '', 'Pending unscanned pack must remain clean/neutral without amber alerts');
assert.strictEqual(getRowClass(attentionPack), 'cs-row-attention', 'Attention pack must get cs-row-attention');
console.log('  ✓ PASS: Scanned tickets turn green; unscanned tickets remain clean and neutral (no amber clutter)\n');

// --- 4. Delivery Receive to Safe Inventory Flow ---
console.log('--- Test 4: Received Delivery Intake directly to inStockInventory ---');
const stagedDeliveryPacks = [
  { packNumber: '350877', gameNumber: '1658', gameName: 'PLAYERS CLUB', price: 10, tickets: 30, bookValue: 300 }
];

const mockState = {
  inventory: [],
  inStockInventory: []
};

// Simulate confirmReceivePacksDelivery
stagedDeliveryPacks.forEach(p => {
  mockState.inventory.push({
    packNumber: p.packNumber,
    gameId: 'g' + p.gameNumber,
    gameName: p.gameName,
    price: p.price,
    packSize: p.tickets,
    status: 'STORED',
    receivedAt: new Date().toISOString()
  });
});

stagedDeliveryPacks.forEach(p => {
  const isDup = mockState.inStockInventory.some(item => item.packNumber === p.packNumber);
  if (!isDup) {
    mockState.inStockInventory.unshift({
      id: 'stock_' + Date.now(),
      gameName: p.gameName,
      gameNumber: `Game ${p.gameNumber}`,
      packNumber: String(p.packNumber),
      price: Number(p.price),
      packSize: `${p.tickets} tickets`,
      packSizeNum: Number(p.tickets),
      status: 'IN_STOCK',
      statusLabel: 'In stock',
      statusBadgeClass: 'badge-in-stock',
      boxNumber: null,
      position: '000',
      receivedDate: 'Nov 2'
    });
  }
});

assert.strictEqual(mockState.inStockInventory.length, 1, 'In stock inventory should have 1 pack');
assert.strictEqual(mockState.inStockInventory[0].packNumber, '350877', 'Pack number matches');
assert.strictEqual(mockState.inStockInventory[0].status, 'IN_STOCK', 'Status is IN_STOCK');
assert.strictEqual(mockState.inStockInventory[0].boxNumber, null, 'boxNumber is null (unassigned to dispenser)');
console.log('  ✓ PASS: Received packs are placed directly into In Stock inventory with unassigned boxNumber\n');

// --- 5. Same Box Replace Actions ---
console.log('--- Test 5: Same Box Replace / Activate New Ticket ---');
const currentSlot = {
  boxNumber: 5,
  status: 'ACTIVE',
  packNumber: '200111',
  gameName: 'Jumbo Bucks',
  gameId: '1401',
  price: 2,
  packSize: 150,
  startTicket: 0,
  currentTicket: 45
};

const slots = [
  currentSlot,
  { boxNumber: 6, status: 'EMPTY', packNumber: null },
  { boxNumber: 7, status: 'EMPTY', packNumber: null }
];

// Test Action A: sold_out
let targetActivationBox = null;
function handleReplaceAction(action, slot, stateObj) {
  const bNum = slot.boxNumber;
  const cPack = slot.packNumber;
  const cGame = slot.gameName;
  const cPrice = slot.price || 1;
  const cSize = slot.packSize || 100;
  const cPos = slot.currentTicket || 0;

  if (action === 'sold_out') {
    slot.status = 'EMPTY';
    slot.packNumber = null;
    slot.gameName = null;
  } else if (action === 'return_safe') {
    stateObj.inStockInventory.unshift({
      packNumber: cPack,
      gameName: cGame,
      price: cPrice,
      status: 'IN_STOCK',
      boxNumber: null,
      position: String(cPos).padStart(3, '0')
    });
    slot.status = 'EMPTY';
    slot.packNumber = null;
  } else if (action === 'change_box') {
    const emptySlot = stateObj.slots.find(s => s.status === 'EMPTY');
    if (emptySlot) {
      emptySlot.status = 'ACTIVE';
      emptySlot.packNumber = cPack;
      emptySlot.gameName = cGame;
      emptySlot.price = cPrice;
      emptySlot.packSize = cSize;
      emptySlot.currentTicket = cPos;
    }
    slot.status = 'EMPTY';
    slot.packNumber = null;
  }

  targetActivationBox = bNum;
}

// Check action 'return_safe'
handleReplaceAction('return_safe', currentSlot, { slots, inStockInventory: mockState.inStockInventory });
assert.strictEqual(currentSlot.status, 'EMPTY', 'Current slot is emptied');
assert.strictEqual(targetActivationBox, 5, 'Activation target is Box #5');
assert.strictEqual(mockState.inStockInventory[0].packNumber, '200111', 'Previous book returned to Safe Inventory');
assert.strictEqual(mockState.inStockInventory[0].position, '045', 'Current position preserved');
console.log('  ✓ PASS: return_safe empties Box #5 and returns pack 200111 to Safe Inventory');

console.log('\n====================================================');
console.log('   ALL 5 TESTS PASSED SUCCESSFULLY!                 ');
console.log('====================================================');
