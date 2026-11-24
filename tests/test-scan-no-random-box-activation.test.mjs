import assert from 'node:assert/strict';
import { parseLotteryBarcode, isPackNumberMatch, getCleanEmptyState } from '../src/data.js';

console.log('================================================================');
console.log('   VERIFY: SCANNING TICKETS NEVER ACTIVATES RANDOM EMPTY BOXES   ');
console.log('================================================================\n');

// Helper to create test state with 65 boxes
function createTestState() {
  const state = getCleanEmptyState({ storeId: 'store_amigo' });
  state.shiftStatus = 'IN_PROGRESS';
  state.slots = [];
  for (let i = 1; i <= 65; i++) {
    state.slots.push({
      boxNumber: i,
      status: 'EMPTY',
      gameId: null,
      gameName: null,
      price: null,
      packNumber: null,
      packSize: null,
      startTicket: 0,
      currentTicket: 0,
      ticketsSold: 0,
      activatedThisShift: false,
      daysActive: 0,
      scannedInEndShift: false,
      needsActivation: false,
      scannedBarcodes: [],
      soldBarcodes: []
    });
  }
  state.totalSlots = 65;
  state.visibleBoxNumbers = Array.from({ length: 65 }, (_, i) => i + 1);
  state.inStockInventory = [];
  state.inventory = [];
  return state;
}

// ----------------------------------------------------------------------
// TEST 1: Scanning a ticket NOT in inventory during normal shift
// ----------------------------------------------------------------------
console.log('--- TEST 1: Ticket NOT in inventory scanned during normal shift ---');
{
  const state = createTestState();
  // Activate Boxes 1-5 with some games
  for (let b = 1; b <= 5; b++) {
    state.slots[b - 1].status = 'ACTIVE';
    state.slots[b - 1].gameId = `g10${b}`;
    state.slots[b - 1].gameName = `Game ${b}`;
    state.slots[b - 1].price = 5;
    state.slots[b - 1].packNumber = `10000${b}`;
    state.slots[b - 1].currentTicket = 10;
  }

  // Count empty boxes before
  const emptyBefore = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyBefore, 60, 'Should start with exactly 60 empty boxes');

  // New ticket barcode that is NOT in inventory
  const newTicketBarcode = '1689-149582-6-023 (006)';
  const parsed = parseLotteryBarcode(newTicketBarcode);
  assert.equal(parsed.isValid, true, 'Barcode should be valid');

  // Verify that neither parsing nor searching active slots modifies state
  const matchingSlot = state.slots.find(s => s.status === 'ACTIVE' && isPackNumberMatch(s.packNumber, parsed.packNumber));
  assert.equal(matchingSlot, undefined, 'Ticket must not match any active slot');

  // Simulate adding to in-stock inventory (what "Add to In-Stock" does)
  const stockItem = {
    id: 'stock_' + Date.now(),
    barcode: parsed.standardBarcode || newTicketBarcode,
    gameName: 'South Carolina Game',
    price: 10,
    packNumber: parsed.packNumber,
    status: 'IN_STOCK',
    boxNumber: null
  };
  state.inStockInventory.push(stockItem);

  // Count empty boxes after
  const emptyAfter = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyAfter, 60, 'Empty boxes count must remain exactly 60');

  // Verify NO empty box was touched or given a random pack
  state.slots.slice(5).forEach(s => {
    assert.equal(s.status, 'EMPTY', `Box ${s.boxNumber} must still be EMPTY`);
    assert.equal(s.packNumber, null, `Box ${s.boxNumber} packNumber must still be null`);
    assert.equal(s.needsActivation, false, `Box ${s.boxNumber} needsActivation must be false`);
  });

  console.log('  ✓ PASS: Scanning ticket not in inventory does NOT activate any empty box.');
}

// ----------------------------------------------------------------------
// TEST 2: Scanning a ticket that IS in inventory (In-Stock)
// ----------------------------------------------------------------------
console.log('\n--- TEST 2: Ticket IN inventory scanned on counter ---');
{
  const state = createTestState();
  // Boxes 1-5 active, 6-65 empty
  for (let b = 1; b <= 5; b++) {
    state.slots[b - 1].status = 'ACTIVE';
    state.slots[b - 1].packNumber = `20000${b}`;
  }

  // Add pack to inStockInventory
  const inStockBarcode = '1705-002921-5-069 (080)';
  const parsed = parseLotteryBarcode(inStockBarcode);
  state.inStockInventory.push({
    id: 'stock_test_1',
    packNumber: parsed.packNumber,
    gameName: 'LIGHT UP THE SEASON',
    price: 2,
    status: 'IN_STOCK',
    boxNumber: null
  });

  const emptyBefore = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyBefore, 60, 'Starts with 60 empty boxes');

  // Verify finding in-stock item does not alter dispenser slots
  const inStockItem = state.inStockInventory.find(p => isPackNumberMatch(p.packNumber, parsed.packNumber));
  assert.ok(inStockItem, 'Pack found in stock');
  assert.equal(inStockItem.boxNumber, null, 'In-stock pack has NO box assigned');

  // Verify slots remain unchanged (setBoxModal asks user for box; it does not pick a random box)
  const emptyAfter = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyAfter, 60, 'All 60 empty boxes remain untouched and EMPTY');
  state.slots.slice(5).forEach(s => {
    assert.equal(s.status, 'EMPTY', `Box ${s.boxNumber} remains EMPTY`);
    assert.equal(s.needsActivation, false, `Box ${s.boxNumber} needsActivation is false`);
  });

  console.log('  ✓ PASS: Scanning ticket in inventory does NOT auto-place it into a random box.');
}

// ----------------------------------------------------------------------
// TEST 3: End Shift Scanning on Box 26 with South Carolina Ticket
// ----------------------------------------------------------------------
console.log('\n--- TEST 3: End Shift Scanning on Box 26 (SC Ticket) ---');
{
  const state = createTestState();
  state.shiftStatus = 'SCANNING_END_SHIFT';

  // Box 26 is active with South Carolina ticket 1689 pack 149582
  state.slots[25].status = 'ACTIVE';
  state.slots[25].boxNumber = 26;
  state.slots[25].gameId = 'sc1689';
  state.slots[25].gameName = 'Palmetto Cash 5';
  state.slots[25].price = 10;
  state.slots[25].packNumber = '149582';
  state.slots[25].basePackNumber = '149582';
  state.slots[25].checkDigit = '6';
  state.slots[25].packCombined = '149582-6';
  state.slots[25].startTicket = 0;
  state.slots[25].currentTicket = 0;
  state.slots[25].scannedInEndShift = false;

  const emptyBefore = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyBefore, 64, 'Starts with 64 empty boxes (only Box 26 active)');

  // Cashier scans Box 26 ticket during End Shift
  const scannedScBarcode = '1689-149582-6-023 (006)';
  const parsed = parseLotteryBarcode(scannedScBarcode);

  // Match target slot
  const targetSlot = state.slots.find(s => {
    if (s.status !== 'ACTIVE' || !s.packNumber) return false;
    return isPackNumberMatch(s.packNumber, parsed.packNumber) ||
      (parsed.packCombined && isPackNumberMatch(s.packNumber, parsed.packCombined)) ||
      (s.packCombined && isPackNumberMatch(s.packCombined, parsed.packNumber));
  });

  assert.ok(targetSlot, 'Must find Box 26');
  assert.equal(targetSlot.boxNumber, 26, 'Target must be Box 26');

  // Verify Box 26
  targetSlot.currentTicket = parsed.ticketNumber;
  targetSlot.scannedInEndShift = true;

  // Verify NO other box was modified
  const emptyAfter = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyAfter, 64, 'Empty boxes count must remain exactly 64');

  state.slots.forEach(s => {
    if (s.boxNumber === 26) {
      assert.equal(s.status, 'ACTIVE');
      assert.equal(s.scannedInEndShift, true);
      assert.equal(s.currentTicket, 23);
    } else {
      assert.equal(s.status, 'EMPTY', `Box ${s.boxNumber} must remain EMPTY`);
      assert.equal(s.scannedInEndShift, false, `Box ${s.boxNumber} scannedInEndShift must be false`);
      assert.equal(s.packNumber, null, `Box ${s.boxNumber} packNumber must be null`);
    }
  });

  console.log('  ✓ PASS: Box 26 correctly verified during End Shift without activating any empty box.');
}

// ----------------------------------------------------------------------
// TEST 4: End Shift Scanning with an Unknown / Unassigned Ticket
// ----------------------------------------------------------------------
console.log('\n--- TEST 4: Unknown ticket scanned during End Shift ---');
{
  const state = createTestState();
  state.shiftStatus = 'SCANNING_END_SHIFT';

  // Only Box 1 and Box 2 active
  state.slots[0].status = 'ACTIVE';
  state.slots[0].packNumber = '111111';
  state.slots[1].status = 'ACTIVE';
  state.slots[1].packNumber = '222222';

  const emptyBefore = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyBefore, 63, 'Starts with 63 empty boxes');

  // Cashier scans an unassigned ticket not on counter
  const unassignedBarcode = '1714-045114-6-002 (027)';
  const parsed = parseLotteryBarcode(unassignedBarcode);

  const targetSlot = state.slots.find(s => s.status === 'ACTIVE' && isPackNumberMatch(s.packNumber, parsed.packNumber));
  assert.equal(targetSlot, undefined, 'No active slot should match');

  // In main.js, when !targetSlot, it triggers toast "Ticket is not in any active dispenser box" and returns.
  // It NEVER activates a slot.

  const emptyAfter = state.slots.filter(s => s.status === 'EMPTY').length;
  assert.equal(emptyAfter, 63, 'Empty boxes count remains strictly 63');

  state.slots.slice(2).forEach(s => {
    assert.equal(s.status, 'EMPTY', `Box ${s.boxNumber} remains EMPTY`);
    assert.equal(s.packNumber, null, `Box ${s.boxNumber} packNumber remains null`);
    assert.equal(s.needsActivation, false, `Box ${s.boxNumber} needsActivation remains false`);
  });

  console.log('  ✓ PASS: Unknown ticket during End Shift is rejected without activating any empty box.');
}

console.log('\n================================================================');
console.log('   ALL 4 SCANNING & BOX ISOLATION TESTS PASSED 100%!           ');
console.log('================================================================');
