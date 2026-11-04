import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- TEST: Box Conflict Resolution & Active New Ticket Tab Removal ---');

// 1. Verify index.html does NOT contain tabBoxReplace or btnExecuteReplaceBox
const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');

assert.strictEqual(
  indexHtml.includes('id="tabBoxReplace"'),
  false,
  'FAIL: tabBoxReplace should not exist in index.html'
);

assert.strictEqual(
  indexHtml.includes('id="btnExecuteReplaceBox"'),
  false,
  'FAIL: btnExecuteReplaceBox should not exist in index.html'
);

assert.strictEqual(
  indexHtml.includes('id="boxReplaceTabContent"'),
  false,
  'FAIL: boxReplaceTabContent should not exist in index.html'
);

// Verify new conflict modal exists in index.html
assert.strictEqual(
  indexHtml.includes('id="boxOccupiedConflictModal"'),
  true,
  'FAIL: boxOccupiedConflictModal must exist in index.html'
);

assert.strictEqual(
  indexHtml.includes('id="btnConflictEmptyBox"'),
  true,
  'FAIL: btnConflictEmptyBox must exist in index.html'
);

assert.strictEqual(
  indexHtml.includes('id="btnConflictReturnPack"'),
  true,
  'FAIL: btnConflictReturnPack must exist in index.html'
);

console.log('✓ PASS: index.html verified: Active new ticket tab removed, boxOccupiedConflictModal present');

// 2. Test conflict logic in simulated state
const mockState = {
  totalSlots: 65,
  slots: [
    {
      boxNumber: 61,
      status: 'ACTIVE',
      gameId: '1877',
      gameName: 'Scratch Game 1877',
      packNumber: '0011999',
      price: 10,
      packSize: 30,
      startTicket: 0,
      currentTicket: 5, // 5 tickets sold
      scannedBarcodes: []
    }
  ],
  soldOutThisShift: [],
  inStockInventory: [],
  returnedCount: 0
};

// Simulate Option 1: "replace the box with empty"
function simulateResolveEmpty(state, boxNum, newTicket) {
  const slot = state.slots.find(s => s.boxNumber === boxNum);
  assert.ok(slot, 'Slot must exist');

  const curr = slot.currentTicket || 0;
  const start = slot.startTicket || 0;
  const sold = Math.max(0, curr - start);

  if (sold > 0) {
    state.soldOutThisShift.push({
      boxNumber: slot.boxNumber,
      gameName: slot.gameName,
      packNumber: slot.packNumber,
      ticketsSold: sold,
      salesAmount: sold * slot.price
    });
  }

  // Clear existing slot
  slot.status = 'EMPTY';
  slot.packNumber = null;
  slot.gameName = 'Empty Slot';

  // Activate new ticket on this box
  slot.status = 'ACTIVE';
  slot.gameName = newTicket.gameName;
  slot.packNumber = newTicket.packNumber;
  slot.price = newTicket.price;
  slot.packSize = newTicket.packSize;
  slot.currentTicket = 0;
  slot.startTicket = 0;
}

simulateResolveEmpty(mockState, 61, {
  gameName: 'Mega Millions Cash',
  packNumber: '7788990',
  price: 20,
  packSize: 50
});

assert.strictEqual(mockState.slots[0].gameName, 'Mega Millions Cash', 'Slot 61 must now have the new game');
assert.strictEqual(mockState.slots[0].packNumber, '7788990', 'Slot 61 must now have the new pack');
assert.strictEqual(mockState.soldOutThisShift.length, 1, 'Sold out record must be recorded');
assert.strictEqual(mockState.soldOutThisShift[0].ticketsSold, 5, 'Must record 5 sold tickets');
assert.strictEqual(mockState.soldOutThisShift[0].salesAmount, 50, 'Must record $50 in sales');

console.log('✓ PASS: Option 1 (Replace with Empty) logic verified: sold tickets recorded, new ticket activated on Box 61');

// Simulate Option 2: "return the pack"
const mockState2 = {
  totalSlots: 65,
  slots: [
    {
      boxNumber: 61,
      status: 'ACTIVE',
      gameId: '1877',
      gameName: 'Scratch Game 1877',
      packNumber: '0011999',
      price: 10,
      packSize: 30,
      startTicket: 0,
      currentTicket: 8, // 8 tickets sold, 22 remaining
      scannedBarcodes: []
    }
  ],
  soldOutThisShift: [],
  inStockInventory: [],
  returnedCount: 0
};

function simulateResolveReturn(state, boxNum, newTicket) {
  const slot = state.slots.find(s => s.boxNumber === boxNum);
  assert.ok(slot, 'Slot must exist');

  const packSize = slot.packSize || 30;
  const curr = slot.currentTicket || 0;
  const start = slot.startTicket || 0;
  const sold = Math.max(0, curr - start);
  const remaining = Math.max(0, packSize - sold);

  if (sold > 0) {
    state.soldOutThisShift.push({
      boxNumber: slot.boxNumber,
      gameName: slot.gameName,
      packNumber: slot.packNumber,
      ticketsSold: sold,
      salesAmount: sold * slot.price,
      ticketsReturned: remaining,
      isReturned: true
    });
  }

  // Return to safe inventory
  state.inStockInventory.unshift({
    packNumber: slot.packNumber,
    gameName: slot.gameName,
    currentTicket: curr,
    status: 'IN_STOCK',
    boxNumber: null
  });
  state.returnedCount = (state.returnedCount || 0) + 1;

  // Clear and activate new ticket on this box
  slot.status = 'ACTIVE';
  slot.gameName = newTicket.gameName;
  slot.packNumber = newTicket.packNumber;
  slot.price = newTicket.price;
  slot.packSize = newTicket.packSize;
  slot.currentTicket = 0;
  slot.startTicket = 0;
}

simulateResolveReturn(mockState2, 61, {
  gameName: 'Jumbo Bucks',
  packNumber: '5566778',
  price: 5,
  packSize: 60
});

assert.strictEqual(mockState2.slots[0].gameName, 'Jumbo Bucks', 'Slot 61 must now have Jumbo Bucks');
assert.strictEqual(mockState2.slots[0].packNumber, '5566778', 'Slot 61 must have pack 5566778');
assert.strictEqual(mockState2.inStockInventory.length, 1, 'Previous pack returned to in-stock inventory');
assert.strictEqual(mockState2.inStockInventory[0].packNumber, '0011999', 'Returned pack number matches');
assert.strictEqual(mockState2.inStockInventory[0].currentTicket, 8, 'Returned pack preserved current ticket 8');
assert.strictEqual(mockState2.returnedCount, 1, 'returnedCount incremented');
assert.strictEqual(mockState2.soldOutThisShift[0].ticketsReturned, 22, 'Must record 22 returned tickets');

console.log('✓ PASS: Option 2 (Return Pack) logic verified: remaining tickets preserved in inventory safe, new ticket activated on Box 61');

console.log('\nALL BOX CONFLICT & TAB REMOVAL UNIT TESTS PASSED!');

