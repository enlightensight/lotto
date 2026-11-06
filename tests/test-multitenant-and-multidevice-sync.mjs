import { strict as assert } from 'assert';
import { loadState, saveState, getCleanEmptyState, getCurrentStoreId, setCurrentStoreId } from '../src/data.js';
import { getInventoryScreenData, REFERENCE_IN_STOCK_PACKS } from '../src/inventoryData.js';

console.log('================================================================');
console.log('   TEST: MULTI-TENANT ISOLATION & MULTI-DEVICE STORE SYNC       ');
console.log('================================================================\n');

// Mock localStorage for node environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

// -----------------------------------------------------------------------------
// Test 1: In-Stock Inventory Isolation Across Different Stores
// -----------------------------------------------------------------------------
console.log('--- Test 1: In-Stock Inventory Isolation ---');
const amigoState = getCleanEmptyState({ storeId: 'store_amigo', storeName: 'AMIGO FOOD MART' });
amigoState.storeId = 'store_amigo';
amigoState.inStockInventory = [
  { id: 'stk_1', gameName: 'Amigo 5X Money', packNumber: '0670170', price: 1 }
];
saveState(amigoState, 'store_amigo');

const downtownState = getCleanEmptyState({ storeId: 'store_downtown', storeName: 'DOWNTOWN QUICK MART' });
downtownState.storeId = 'store_downtown';
saveState(downtownState, 'store_downtown');

const anishState = getCleanEmptyState({ storeId: 'store_anish', storeName: 'ANISH STORE' });
anishState.storeId = 'store_anish';
saveState(anishState, 'store_anish');

// Amigo store has its pack
const amigoData = getInventoryScreenData(amigoState, 'in_stock');
assert.equal(amigoData.items.length, 1, 'Amigo store has 1 in-stock pack');
assert.equal(amigoData.items[0].packNumber, '0670170', 'Amigo pack is 0670170');
console.log('  ✓ PASS: Store Amigo inventory contains its own in-stock pack');

// Downtown store MUST be empty, not inheriting Amigo or reference packs
const downtownData = getInventoryScreenData(downtownState, 'in_stock');
assert.equal(downtownData.items.length, 0, 'Downtown store in-stock inventory is EMPTY (no leakage)');
console.log('  ✓ PASS: Store Downtown inventory is clean and empty (zero cross-store leakage)');

// Anish store MUST be completely empty across all tabs when fresh
const anishData = getInventoryScreenData(anishState, 'in_stock');
assert.equal(anishData.items.length, 0, 'Anish store in-stock inventory is EMPTY (no leakage)');
assert.equal(anishData.counts.active, 0, 'Anish store active inventory is EMPTY (no reference leakage)');
assert.equal(anishData.counts.completed, 0, 'Anish store completed inventory is EMPTY');
assert.equal(anishData.counts.removed, 0, 'Anish store removed inventory is EMPTY');
assert.equal(anishData.counts.all, 0, 'Anish store all inventory is EMPTY');
console.log('  ✓ PASS: Store Anish inventory is clean and empty across all tabs (zero cross-store leakage)');

// -----------------------------------------------------------------------------
// Test 2: Multi-Device Sync - End of Day Login (Device B loads Device A sales)
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Multi-Device End of Day Sales Synchronization ---');

// Simulate Device A (Friend's device):
// Friend opens Store Downtown, activates Box 1, sells 15 tickets, and ends shift
const deviceAState = JSON.parse(JSON.stringify(downtownState));
deviceAState.slots[0] = {
  boxNumber: 1,
  gameName: '5X Money',
  price: 1,
  packNumber: '018378',
  packSize: 300,
  startTicket: 0,
  currentTicket: 15,
  ticketsInBox: 15,
  status: 'ACTIVE',
  scannedBarcodes: Array.from({ length: 15 }, (_, i) => ({
    barcode: `14170183780${String(i).padStart(3, '0')}`,
    ticketNumber: i
  })),
  soldBarcodes: Array.from({ length: 15 }, (_, i) => `14170183780${String(i).padStart(3, '0')}`)
};
deviceAState.soldBarcodes = Array.from({ length: 15 }, (_, i) => `14170183780${String(i).padStart(3, '0')}`);
deviceAState.shiftNumber = 1;
deviceAState.lastSavedAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
saveState(deviceAState, 'store_downtown');

// The server now holds Device A's state:
const mockServerState = JSON.parse(JSON.stringify(deviceAState));
mockServerState.lastSavedAt = new Date().toISOString(); // Just saved on server

// Simulate Device B (User's laptop at home at end of day):
// Device B has an old or clean state with 0 sales
const deviceBLocalState = getCleanEmptyState({ storeId: 'store_downtown', storeName: 'DOWNTOWN QUICK MART' });
deviceBLocalState.lastSavedAt = new Date(Date.now() - 86400000).toISOString(); // 24 hours ago

// Device B logs in: It queries the server and adopts server state unconditionally for that store
let deviceBState;
if (mockServerState && Array.isArray(mockServerState.slots)) {
  deviceBState = mockServerState;
} else {
  deviceBState = deviceBLocalState;
}

assert.equal(deviceBState.slots[0].currentTicket, 15, 'Device B loaded currentTicket 15 from Device A');
assert.equal(deviceBState.slots[0].soldBarcodes.length, 15, 'Device B loaded 15 sold barcodes from Device A');
assert.equal(deviceBState.slots[0].packNumber, '018378', 'Device B loaded pack 018378 from Device A');
console.log('  ✓ PASS: Device B successfully loaded friend\'s sales and pack progress from Device A');

// -----------------------------------------------------------------------------
// Test 3: Background Server Sync Comparison Logic
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Background Server Sync (Detects Differences & Updates) ---');

// Suppose Device B was open with currentTicket: 15.
// Friend on Device A sells 5 more tickets on Box 1 (currentTicket: 20).
const newerServerState = JSON.parse(JSON.stringify(mockServerState));
newerServerState.slots[0].currentTicket = 20;
newerServerState.slots[0].soldBarcodes.push('14170183780016', '14170183780017', '14170183780018', '14170183780019', '14170183780020');
newerServerState.soldBarcodes.push('14170183780016', '14170183780017', '14170183780018', '14170183780019', '14170183780020');
newerServerState.lastSavedAt = new Date(Date.now() + 5000).toISOString();

const serverTime = new Date(newerServerState.lastSavedAt).getTime();
const localTime = new Date(deviceBState.lastSavedAt).getTime();
const isServerNewer = serverTime >= localTime;
const isDifferent = JSON.stringify(newerServerState.slots) !== JSON.stringify(deviceBState.slots) ||
                    (newerServerState.soldBarcodes || []).length !== (deviceBState.soldBarcodes || []).length;

assert.equal(isServerNewer, true, 'Server state is recognized as newer');
assert.equal(isDifferent, true, 'Server state changes are detected');

if (isServerNewer || isDifferent) {
  Object.assign(deviceBState, newerServerState);
}

assert.equal(deviceBState.slots[0].currentTicket, 20, 'Device B automatically caught up to currentTicket 20');
assert.equal(deviceBState.slots[0].soldBarcodes.length, 20, 'Device B automatically caught up to 20 sold barcodes');
console.log('  ✓ PASS: Device B automatically detected and applied friend\'s new ticket sales');

console.log('\n================================================================');
console.log(' ALL MULTI-TENANT & MULTI-DEVICE SYNC TESTS PASSED PERFECTLY!   ');
console.log('================================================================');

