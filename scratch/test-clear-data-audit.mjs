import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Testing Clear Data & Settings Functionality ---');

// Mock localStorage
const localStorageMap = new Map();
global.localStorage = {
  getItem: (k) => localStorageMap.get(k) || null,
  setItem: (k, v) => localStorageMap.set(k, String(v)),
  removeItem: (k) => localStorageMap.delete(k),
  clear: () => localStorageMap.clear()
};

// Mock fetch
global.fetch = async () => ({
  ok: true,
  json: async () => ({ success: true })
});

// Import data.js
const { getInitialState, getCleanEmptyState, resetToCleanState, resetToDefaults, loadState, saveState } = await import('../src/data.js');

// 1. Test getCleanEmptyState()
console.log('Testing getCleanEmptyState...');
const cleanState = getCleanEmptyState();
assert.equal(cleanState.slots.length, 65, 'Total slots should be 65');
assert(cleanState.slots.every(s => s.status === 'EMPTY'), 'All slots should have status EMPTY');
assert(cleanState.slots.every(s => s.packNumber === null), 'All slots should have packNumber null');
assert.equal(cleanState.inventory.length, 0, 'Inventory should be empty (0 packs in safe)');
assert.equal(cleanState.soldOutThisShift.length, 0, 'soldOutThisShift should be empty');
assert.equal(cleanState.shiftHistory.length, 0, 'shiftHistory should be empty');
assert.equal(cleanState.visibleBoxNumbers.length, 0, 'visibleBoxNumbers should be empty');
assert.equal(cleanState.onlineSales, 0, 'onlineSales should be 0');
assert.equal(cleanState.cashes, 0, 'cashes should be 0');
assert.equal(cleanState.dataCleared, true, 'dataCleared should be true');
console.log('✓ PASS: getCleanEmptyState() produces true 100% empty state');

// 2. Test resetToCleanState()
console.log('Testing resetToCleanState...');
// Pre-populate with initial seed state
const seedState = getInitialState();
saveState(seedState);
assert.equal(loadState().slots.filter(s => s.status === 'ACTIVE').length, 20, 'Seed state should have 20 active slots');

// Now invoke resetToCleanState()
const wipedState = resetToCleanState(seedState);
assert.equal(wipedState.slots.filter(s => s.status === 'ACTIVE').length, 0, 'Wiped state should have 0 active slots');
assert.equal(wipedState.inventory.length, 0, 'Wiped state should have 0 inventory packs');

// Verify that loading from localStorage also returns the wiped state
const loadedAfterWipe = loadState();
assert.equal(loadedAfterWipe.slots.filter(s => s.status === 'ACTIVE').length, 0, 'Loaded state after wipe should have 0 active slots');
assert.equal(loadedAfterWipe.inventory.length, 0, 'Loaded state after wipe should have 0 inventory packs');
assert.equal(loadedAfterWipe.dataCleared, true, 'Loaded state after wipe should have dataCleared true');
console.log('✓ PASS: resetToCleanState() persists wiped state to localStorage');

// 3. Test HTML and wiring for Settings Clear Data
console.log('Testing HTML for Clear Data elements...');
const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');
assert(htmlContent.includes('id="inputConfirmClear"'), 'index.html contains inputConfirmClear');
assert(htmlContent.includes('id="btnClearAllData"'), 'index.html contains btnClearAllData');
assert(htmlContent.includes('id="btnSettingsSaveAll"'), 'index.html contains btnSettingsSaveAll');
assert(htmlContent.includes('id="btnSettingsTestPrint"'), 'index.html contains btnSettingsTestPrint');
console.log('✓ PASS: index.html contains all necessary Settings and Clear Data elements');

// 4. Test main.js logic for CLEAR input matching
console.log('Testing main.js Clear Data handler...');
const mainJsContent = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
assert(mainJsContent.includes("val === 'CLEAR'"), 'main.js checks CLEAR for visual ready state');
assert(mainJsContent.includes("resetToCleanState(state)"), 'main.js passes state to resetToCleanState');
assert(mainJsContent.includes("showSellCounterView()"), 'main.js switches to sell counter after wipe');
console.log('✓ PASS: main.js properly handles Clear Data and redirects cleanly');

// 5. Test Settings Steppers and Save All
assert(mainJsContent.includes('btnSettingsSaveAll'), 'main.js wires btnSettingsSaveAll');
assert(mainJsContent.includes('valTotalBoxes'), 'main.js manages valTotalBoxes stepper');
assert(mainJsContent.includes('valWarning1'), 'main.js manages valWarning1 stepper');
assert(mainJsContent.includes('valWarning2'), 'main.js manages valWarning2 stepper');
assert(mainJsContent.includes('valWarningOld'), 'main.js manages valWarningOld stepper');
assert(mainJsContent.includes('btnSettingsTestPrint'), 'main.js wires btnSettingsTestPrint');
console.log('✓ PASS: Settings Save All, Steppers, and Test Print are properly wired in main.js');

console.log('\n--- ALL CLEAR DATA & SETTINGS TESTS PASSED ---');
