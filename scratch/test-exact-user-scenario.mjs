import { strict as assert } from 'assert';

// Mock localStorage
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

global.fetch = async () => ({ ok: true, json: async () => ({ success: true }) });

const { loadState, saveState, resetToCleanState, getCleanEmptyState } = await import('../src/data.js');

// 1. Simulate user's exact state with Box 1 and Box 2 and $127 sales:
const userState = {
  slots: [
    { boxNumber: 1, status: 'ACTIVE', gameName: 'Scratch-Off Game', price: 1, packNumber: '128842', currentTicket: 7, startTicket: 0, packSize: 300 },
    { boxNumber: 2, status: 'ACTIVE', gameName: 'EPIC RICHES', price: 10, packNumber: '500022', currentTicket: 12, startTicket: 0, packSize: 30 },
  ],
  totalSlots: 65,
  visibleBoxNumbers: [1, 2],
  soldOutThisShift: [],
  inventory: [],
  shiftHistory: [],
  storeName: 'AMIGO FOOD MART'
};

// Fill rest of slots up to 65
for (let i = 3; i <= 65; i++) {
  userState.slots.push({ boxNumber: i, status: 'EMPTY', gameName: null, price: null, packNumber: null, currentTicket: 0, startTicket: 0 });
}

// Save to localStorage
saveState(userState);

console.log('--- Step 1: Pre-clear state verification ---');
let loaded = loadState();
let activeSlots = loaded.slots.filter(s => s.status === 'ACTIVE');
console.log('Active slots before clear:', activeSlots.length);
console.log('Box 1:', activeSlots[0]?.gameName, 'Ticket:', activeSlots[0]?.currentTicket);
console.log('Box 2:', activeSlots[1]?.gameName, 'Ticket:', activeSlots[1]?.currentTicket);
assert.equal(activeSlots.length, 2);

console.log('\n--- Step 2: Running resetToCleanState(userState) ---');
let newState = resetToCleanState(userState);
saveState(newState);

console.log('\n--- Step 3: Loading state after clear ---');
let reloaded = loadState();
let reloadedActive = reloaded.slots.filter(s => s.status === 'ACTIVE');
console.log('Active slots after clear:', reloadedActive.length);
console.log('Visible boxes after clear:', reloaded.visibleBoxNumbers);
console.log('dataCleared flag:', reloaded.dataCleared);

assert.equal(reloadedActive.length, 0, 'Should have ZERO active slots');
assert.equal(reloaded.visibleBoxNumbers.length, 0, 'Visible boxes should be empty');
assert.equal(reloaded.dataCleared, true, 'dataCleared should be true');

console.log('\n✓ PASS: resetToCleanState properly wipes Box 1 and Box 2!');
