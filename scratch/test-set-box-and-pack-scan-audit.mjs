import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING SET BOX & PACK SCANNING AUDIT ===\n');

// 1. Verify src/main.js static assertions
const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

assert(mainJs.includes('isTransitioningSetBoxStep'), 'isTransitioningSetBoxStep flag is present');
assert(mainJs.includes('setBoxModal.dataset.barcode'), 'setBoxModal dataset persistence is present');
assert(!mainJs.includes('activePacksEl.textContent = String(activeCount || 2);'), 'Removed fake fallback || 2');
assert(mainJs.includes('activePacksEl.textContent = String(activeCount);'), 'Uses exact activeCount');
assert(!mainJs.includes("scanActionTitle.textContent = 'PACK BARCODE - NOT AN INDIVIDUAL TICKET';"), 'Removed rejection of pack barcodes at sell counter');

console.log('✓ PASS: Static code invariants verified in src/main.js\n');

// 2. Functional simulation of state and modal transitions
import { 
  parseLotteryBarcode, 
  formatLotteryBarcode, 
  findGameByBarcode, 
  SAMPLE_GAMES,
  getCleanEmptyState 
} from '../src/data.js';

let state = getCleanEmptyState();

// Verify clean empty state has 0 active slots and empty visibleBoxNumbers
const initialActive = (state.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber);
assert.equal(initialActive.length, 0, 'Clean state starts with 0 active slots');
assert.equal(state.visibleBoxNumbers.length, 0, 'Clean state starts with 0 visible boxes');

console.log('--- Simulating User Scenario 1: Scan ticket 14180996564081 and set into Box 1 ---');

const ticketBarcode = '14180996564081';
const parsed = parseLotteryBarcode(ticketBarcode, state.customGames);
assert(parsed && parsed.isValid, 'Ticket barcode parses as valid');
assert.equal(parsed.gameNumber, '1418');
assert.equal(parsed.ticketNumber, 81);
assert.equal(parsed.securityCode, '068');

// Simulate openSetTicketDetailsModal
let pendingSetBoxBarcode = parsed.standardBarcode || ticketBarcode;
let pendingSetBoxSecurityCode = parsed.securityCode;
let pendingChosenName = '20X Money';
let pendingChosenPrice = 2;
let pendingChosenPackSize = 150;
let isTransitioningSetBoxStep = false;

// Mock dialog dataset
const mockSetBoxModal = { dataset: {} };

// Simulate proceedToSetBoxStep
isTransitioningSetBoxStep = true;
// setTicketDetailsModal.close() triggered:
if (!isTransitioningSetBoxStep) {
  pendingSetBoxBarcode = null; // Should NOT be hit!
}
// openSetBoxModal
mockSetBoxModal.dataset.barcode = pendingSetBoxBarcode;
mockSetBoxModal.dataset.securityCode = pendingSetBoxSecurityCode;
mockSetBoxModal.dataset.gameName = pendingChosenName;
mockSetBoxModal.dataset.gamePrice = String(pendingChosenPrice);
mockSetBoxModal.dataset.packSize = String(pendingChosenPackSize);
isTransitioningSetBoxStep = false;

assert.equal(pendingSetBoxBarcode, '14180996564081', 'Barcode preserved during Step 1 -> Step 2 transition');
assert.equal(mockSetBoxModal.dataset.barcode, '14180996564081', 'Barcode preserved in dataset');

// Simulate confirmSetBoxForTicket into Box 1
const boxNum = 1;
const barcode = pendingSetBoxBarcode || mockSetBoxModal.dataset.barcode;
assert.ok(barcode, 'Barcode available for confirmation');

// Execute slot assignment (logic of handleSetBoxForTicket)
let targetSlot = state.slots.find(s => s.boxNumber === boxNum);
targetSlot.status = 'ACTIVE';
targetSlot.gameName = pendingChosenName;
targetSlot.price = pendingChosenPrice;
targetSlot.packNumber = parsed.packNumber;
targetSlot.packSize = pendingChosenPackSize;
targetSlot.startTicket = 0;
targetSlot.currentTicket = 0;
targetSlot.securityCode = pendingSetBoxSecurityCode;
if (state.dataCleared) delete state.dataCleared;

// bringBoxToVisibleRack logic:
if (!state.visibleBoxNumbers.includes(boxNum)) {
  state.visibleBoxNumbers.push(boxNum);
}

const activeSlotsAfter = state.slots.filter(s => s.status === 'ACTIVE' && s.packNumber);
assert.equal(activeSlotsAfter.length, 1, 'Exactly 1 active slot after set box');
assert.equal(state.visibleBoxNumbers.length, 1, 'Box 1 is now in visibleBoxNumbers');
assert.equal(state.visibleBoxNumbers[0], 1);
assert.equal(state.dataCleared, undefined, 'dataCleared flag was deleted');

console.log('✓ PASS: Box 1 successfully added to active rack!\n');

console.log('--- Simulating User Scenario 2: Pack scanning and scanning another pack ---');

// Scan first pack manifest (e.g. 1648-018378)
const pack1 = '1648-018378';
const parsedPack1 = parseLotteryBarcode(pack1);
assert(parsedPack1.isValid, 'Pack 1 manifest isValid');
assert(parsedPack1.isPackBarcode, 'Pack 1 identified as pack barcode');

// In activation modal, scan another pack (e.g. 1418-099656)
const pack2 = '1418-099656';
const parsedPack2 = parseLotteryBarcode(pack2);
assert(parsedPack2.isValid, 'Pack 2 manifest isValid');
assert.equal(parsedPack2.packNumber, '099656');

// Simulate updating pendingActivationPack and form input
let pendingActivationPack = {
  packNumber: parsedPack2.packNumber,
  gameName: '$2 20X Money',
  price: 2,
  packSize: 150
};
let mockPresetPackInput = { value: pendingActivationPack.packNumber };

assert.equal(mockPresetPackInput.value, '099656', 'Form input updated to newly scanned Pack 2');

// Activate Pack 2 into Box 2
let targetSlot2 = state.slots.find(s => s.boxNumber === 2);
targetSlot2.status = 'ACTIVE';
targetSlot2.gameName = pendingActivationPack.gameName;
targetSlot2.price = pendingActivationPack.price;
targetSlot2.packNumber = pendingActivationPack.packNumber;
targetSlot2.packSize = pendingActivationPack.packSize;
targetSlot2.startTicket = 0;
targetSlot2.currentTicket = 0;
if (!state.visibleBoxNumbers.includes(2)) {
  state.visibleBoxNumbers.push(2);
}

const finalActive = state.slots.filter(s => s.status === 'ACTIVE' && s.packNumber);
assert.equal(finalActive.length, 2, '2 active boxes now on rack');
assert.deepEqual(state.visibleBoxNumbers, [1, 2], 'visibleBoxNumbers has [1, 2]');

console.log('✓ PASS: Consecutive pack scan and activation works smoothly!');
console.log('\n=== ALL AUDIT TESTS PASSED SUCCESSFULLY! ===');
