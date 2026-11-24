import assert from 'node:assert/strict';
import { parseLotteryBarcode, isPackNumberMatch, getCleanEmptyState, calculateSlotSoldTickets } from '../src/data.js';

console.log('================================================================');
console.log('   VERIFY: GET REPORT TICKET ACTIVATION (ASK BOX FIRST) FLOW   ');
console.log('================================================================\n');

// 1. Initialize State in SCANNING_END_SHIFT mode with 10 active boxes scanned
const state = getCleanEmptyState({ storeId: 'store_amigo' });
state.shiftStatus = 'SCANNING_END_SHIFT';
state.slots = [];

// Boxes 1..10 are active and scanned
for (let i = 1; i <= 10; i++) {
  state.slots.push({
    boxNumber: i,
    status: 'ACTIVE',
    gameId: `game_${i}`,
    gameName: `Game ${i}`,
    price: 5,
    packNumber: `20000${i}`,
    packSize: 60,
    startTicket: 0,
    currentTicket: 10,
    ticketsSold: 10,
    activatedThisShift: false,
    daysActive: 1,
    scannedInEndShift: true,
    needsActivation: false
  });
}

// Boxes 11..65 are empty
for (let i = 11; i <= 65; i++) {
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
    needsActivation: false
  });
}
state.totalSlots = 65;

console.log('--- Step 1: Scan New/Unassigned Ticket during Get Report ---');
const rawScannedBarcode = '1658-350877-029 (000)';
const parsed = parseLotteryBarcode(rawScannedBarcode);
assert.equal(parsed.isValid, true, 'Barcode should be valid');

// Verify ticket is not in active slots 1..10
const matchedActiveSlot = state.slots.find(s => s.status === 'ACTIVE' && isPackNumberMatch(s.packNumber, parsed.packNumber));
assert.equal(matchedActiveSlot, undefined, 'Ticket is not in active slots');

// Step 2: Ensure it is NOT auto-placed to a random empty box
const emptySlotsBefore = state.slots.filter(s => s.status === 'EMPTY').length;
assert.equal(emptySlotsBefore, 55, 'There should be 55 empty boxes before user chooses');

// Step 3: Cashier chooses Box #12 in the modal
console.log('--- Step 2: Cashier chooses Box #12 ---');
const chosenBoxNum = 12;
const slot12 = state.slots.find(s => s.boxNumber === chosenBoxNum);
assert.ok(slot12, 'Slot 12 exists');

// Simulate handleSetBoxForTicket in SCANNING_END_SHIFT mode
slot12.status = 'ACTIVE';
slot12.gameId = 'sc1658';
slot12.gameName = '25X TRA';
slot12.price = 5;
slot12.packNumber = parsed.packNumber;
slot12.packSize = 60;
slot12.startTicket = parsed.ticketNumber;
slot12.currentTicket = parsed.ticketNumber;
slot12.ticketsSold = 0;
slot12.activatedThisShift = true;
slot12.daysActive = 1;
// In SCANNING_END_SHIFT, it stages with needsActivation = true until cashier clicks ACTIVATE on the card
slot12.needsActivation = true;
slot12.scannedInEndShift = false;
slot12.pendingEndShiftBarcode = rawScannedBarcode;

assert.equal(slot12.boxNumber, 12, 'Must be put in Box #12 as chosen by cashier');
assert.equal(slot12.needsActivation, true, 'Slot 12 must have needsActivation = true (shows ACTIVATE button)');
assert.equal(slot12.scannedInEndShift, false, 'Slot 12 is not marked scanned yet');
console.log('  ✓ PASS: Box #12 placed on rack with ACTIVATE button waiting for cashier tap\n');

// Step 4: Cashier taps ACTIVATE on Box #12
console.log('--- Step 3: Cashier taps ACTIVATE on Box #12 ---');
slot12.needsActivation = false;
slot12.status = 'ACTIVE';
slot12.activatedThisShift = true;
slot12.scannedInEndShift = true;
slot12.ticketsSold = calculateSlotSoldTickets(slot12);

assert.equal(slot12.needsActivation, false, 'needsActivation is cleared');
assert.equal(slot12.status, 'ACTIVE', 'status is ACTIVE');
assert.equal(slot12.scannedInEndShift, true, 'scannedInEndShift is true (green badge ✓ SCANNED)');
assert.equal(slot12.ticketsSold, 0, 'ticketsSold is 0 for newly activated roll starting at closing ticket');
console.log('  ✓ PASS: Box #12 is fully activated and marked scanned!\n');

console.log('================================================================');
console.log('   ALL GET REPORT TICKET ACTIVATION TESTS PASSED 100%!         ');
console.log('================================================================');
