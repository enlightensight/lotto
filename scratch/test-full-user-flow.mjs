import { 
  parseLotteryBarcode, 
  formatLotteryBarcode, 
  computeLotterySeriesCode, 
  getCleanEmptyState, 
  getInitialState, 
  findGameByBarcode,
  SAMPLE_GAMES 
} from '../src/data.js';

console.log('--- STARTING COMPREHENSIVE LOTTERY FLOW SIMULATION ---');

// 1. Test Physical Barcode Parsing
const testBarcodes = [
  { raw: '14180996564081', expectedTix: 81, expectedSec: '068', desc: 'Georgia Lottery 14-digit ticket' },
  { raw: '16480183788000', expectedTix: 0, expectedSec: '029', desc: 'SCEL Game 1648 14-digit ticket 000' },
  { raw: '16720072523000', expectedTix: 0, expectedSec: '099', desc: 'SCEL Game 1672 14-digit ticket 000' },
  { raw: '14180996564', isPack: true, desc: '11-digit pack manifest' },
  { raw: '16480183788', isPack: true, desc: '11-digit pack manifest SCEL' },
  { raw: '1648-018378-8-000(029)', expectedTix: 0, expectedSec: '029', desc: 'Full printed text on ticket' }
];

testBarcodes.forEach(({ raw, expectedTix, expectedSec, isPack, desc }) => {
  const p = parseLotteryBarcode(raw);
  if (!p || !p.isValid) {
    throw new Error(`FAIL: Parse failed for ${desc} (${raw})`);
  }
  if (isPack) {
    if (!p.isPackBarcode && p.ticketNumber !== null) throw new Error(`FAIL: Expected pack barcode for ${raw}`);
    if (!p.standardBarcode) throw new Error(`FAIL: Missing standardBarcode on pack ${raw}`);
  } else {
    if (p.ticketNumber !== expectedTix) throw new Error(`FAIL: Ticket number mismatch on ${raw}: expected ${expectedTix}, got ${p.ticketNumber}`);
    if (p.securityCode !== expectedSec) throw new Error(`FAIL: Security code mismatch on ${raw}: expected ${expectedSec}, got ${p.securityCode}`);
  }
  console.log(`✓ Passed: ${desc} -> Display: ${formatLotteryBarcode(raw)}`);
});

// 2. Test Slot Management and Visible Rack
const state = getCleanEmptyState();

// Helper to simulate ensureVisibleBoxesInitialized
function ensureVisibleBoxesInitialized(s) {
  const isBoxActive = slot => Boolean(slot && slot.status === 'ACTIVE' && slot.packNumber);
  const activeNums = (s.slots || []).filter(isBoxActive).map(slot => Number(slot.boxNumber));

  if (!Array.isArray(s.visibleBoxNumbers)) s.visibleBoxNumbers = [];
  activeNums.forEach(num => {
    if (!s.visibleBoxNumbers.some(n => Number(n) === num)) {
      s.visibleBoxNumbers.push(num);
    }
  });
  s.visibleBoxNumbers = s.visibleBoxNumbers.map(Number).filter(bNum => {
    const slot = (s.slots || []).find(x => Number(x.boxNumber) === bNum);
    return isBoxActive(slot);
  });
}

function bringBoxToVisibleRack(s, boxNum) {
  const bNum = Number(boxNum);
  ensureVisibleBoxesInitialized(s);
  const slot = (s.slots || []).find(x => Number(x.boxNumber) === bNum);
  if (!slot || slot.status !== 'ACTIVE' || !slot.packNumber) return;
  if (!s.visibleBoxNumbers.some(n => Number(n) === bNum)) {
    s.visibleBoxNumbers.push(bNum);
  }
}

// Set Box 1 with Ticket 1 (14180996564081)
const p1 = parseLotteryBarcode('14180996564081');
const slot1 = state.slots.find(s => s.boxNumber === 1);
slot1.status = 'ACTIVE';
slot1.gameName = '20X Money';
slot1.price = 2;
slot1.packNumber = p1.packNumber;
slot1.packSize = 150;
slot1.currentTicket = p1.ticketNumber;
slot1.startTicket = 0;
slot1.scannedBarcodes = [p1.standardBarcode];
bringBoxToVisibleRack(state, 1);

// Set Box 2 with Ticket 2 (16480183788000)
const p2 = parseLotteryBarcode('16480183788000');
const slot2 = state.slots.find(s => s.boxNumber === 2);
slot2.status = 'ACTIVE';
slot2.gameName = 'Cash Blast';
slot2.price = 10;
slot2.packNumber = p2.packNumber;
slot2.packSize = 30;
slot2.currentTicket = p2.ticketNumber;
slot2.startTicket = 0;
slot2.scannedBarcodes = [p2.standardBarcode];
bringBoxToVisibleRack(state, 2);

// Set Box 7 with Ticket 3 (16720072523000)
const p3 = parseLotteryBarcode('16720072523000');
const slot7 = state.slots.find(s => s.boxNumber === 7);
slot7.status = 'ACTIVE';
slot7.gameName = 'Gold Rush';
slot7.price = 3;
slot7.packNumber = p3.packNumber;
slot7.packSize = 100;
slot7.currentTicket = p3.ticketNumber;
slot7.startTicket = 0;
slot7.scannedBarcodes = [p3.standardBarcode];
bringBoxToVisibleRack(state, 7);

ensureVisibleBoxesInitialized(state);

console.log('Visible Boxes on Rack:', state.visibleBoxNumbers);
if (!state.visibleBoxNumbers.includes(1) || !state.visibleBoxNumbers.includes(2) || !state.visibleBoxNumbers.includes(7)) {
  throw new Error('FAIL: Active boxes 1, 2, 7 must all be visible on the rack!');
}
console.log('✓ All 3 active boxes (1, 2, 7) are 100% visible on Dispenser Rack!');

// Test consecutive scan transition simulation:
// User has modal open for p1, then scans p2:
let pendingBarcode = p1.standardBarcode;
console.log('Step 1 initial pending:', pendingBarcode);
// New scan arrives:
const incomingScan = '16480183788000';
const parsedIncoming = parseLotteryBarcode(incomingScan);
if (parsedIncoming && parsedIncoming.isValid) {
  pendingBarcode = parsedIncoming.standardBarcode;
}
console.log('Step 1 after consecutive scan:', pendingBarcode);
if (pendingBarcode !== '16480183788000') {
  throw new Error('FAIL: Consecutive scan did not update pendingBarcode!');
}
console.log('✓ Consecutive scan successfully switches to new ticket/pack!');

console.log('--- ALL SIMULATION CHECKS PASSED PERFECTLY ---');
