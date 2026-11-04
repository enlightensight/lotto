// ============================================================================
// Multi-Tenant User Authentication & Store Isolation Verification Suite
// ============================================================================

import { strict as assert } from 'assert';
import fs from 'fs';
import {
  registerNewUser,
  authenticateOrRegisterUser,
  getRegisteredUsers,
  saveRegisteredUsers,
  findUserByCredentials,
  lookupUserAssignedStore
} from '../src/clerksData.js';
import {
  getStoreStorageKey,
  getStoresList,
  saveStoresList,
  getCleanEmptyState
} from '../src/data.js';

// Setup mock localStorage and sessionStorage for Node.js
const mockLocalStorageData = {};
const mockSessionStorageData = {};

global.localStorage = {
  getItem: (key) => mockLocalStorageData[key] || null,
  setItem: (key, val) => { mockLocalStorageData[key] = String(val); },
  removeItem: (key) => { delete mockLocalStorageData[key]; },
  clear: () => { for (const k of Object.keys(mockLocalStorageData)) delete mockLocalStorageData[k]; }
};

global.sessionStorage = {
  getItem: (key) => mockSessionStorageData[key] || null,
  setItem: (key, val) => { mockSessionStorageData[key] = String(val); },
  removeItem: (key) => { delete mockSessionStorageData[key]; },
  clear: () => { for (const k of Object.keys(mockSessionStorageData)) delete mockSessionStorageData[k]; }
};

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('  RUNNING USER AUTH & MULTI-TENANT DATABASE TESTS  ');
console.log('====================================================\n');

console.log('--- Test Group 1: Strict Admin-Approved Authentication (No Auto-Registration) ---');

runTest('Rejects unknown random user credentials', () => {
  const res = authenticateOrRegisterUser('random_user_999', 'wrong_pass');
  assert.equal(res.success, false, 'Unknown user rejected');
  assert.equal(res.reason, 'USER_NOT_FOUND', 'Reason is USER_NOT_FOUND');
});

runTest('Approved user "amigo" can authenticate with correct password', () => {
  // Pre-register approved user "amigo"
  registerNewUser('amigo', 'ax123', 'store_amigo', 'Amigo Food Mart', 'admin', 'APPROVED');
  const res = authenticateOrRegisterUser('amigo', 'ax123');
  assert.equal(res.success, true, 'Authentication succeeded');
  assert.equal(res.user.signInName, 'amigo', 'Correct sign-in name');
  assert.equal(res.user.storeId, 'store_amigo', 'Assigned store_amigo');
});

runTest('Rejects "amigo" with wrong password', () => {
  const res = authenticateOrRegisterUser('amigo', 'wrong_pass');
  assert.equal(res.success, false, 'Authentication failed on wrong password');
  assert.equal(res.reason, 'INVALID_PASSWORD', 'Reason is INVALID_PASSWORD');
});

console.log('\n--- Test Group 2: Second Approved User & Multi-Tenant Data Isolation ---');

runTest('Second approved tenant "anish" with password "AX123456@"', () => {
  registerNewUser('anish', 'AX123456@', 'store_anish', 'Anish Store', 'owner', 'APPROVED');
  const res = authenticateOrRegisterUser('anish', 'AX123456@');
  assert.equal(res.success, true);
  assert.equal(res.user.signInName, 'anish');
  assert.equal(res.user.storeId, 'store_anish');

  const registered = getRegisteredUsers();
  assert(registered.some(u => u.signInName === 'amigo'));
  assert(registered.some(u => u.signInName === 'anish'));
});

runTest('Stores list includes both stores with isolation', () => {
  saveStoresList([
    { id: 'store_amigo', name: 'Amigo Food Mart' },
    { id: 'store_anish', name: 'Anish Store' }
  ]);
  const stores = getStoresList();
  assert(stores.some(s => s.id === 'store_amigo'), 'Contains store_amigo');
  assert(stores.some(s => s.id === 'store_anish'), 'Contains store_anish');
});

runTest('Storage keys are strictly isolated per tenant', () => {
  const amigoKey = getStoreStorageKey('store_amigo');
  const anishKey = getStoreStorageKey('store_anish');
  assert.notEqual(amigoKey, anishKey, 'Keys must be different');
  assert.equal(amigoKey, 'lotto_track_pos_data_v3');
  assert.equal(anishKey, 'lotto_track_pos_data_v3_store_anish');
});

console.log('\n--- Test Group 3: UI & Settings Cleanliness (Removed Marked Store Select) ---');

runTest('Settings pane in index.html does NOT contain current store select or + Add Store button', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert(!html.includes('id="settingsStoreSelect"'), 'Removed settingsStoreSelect');
  assert(!html.includes('id="btnAddStore"'), 'Removed btnAddStore');
  assert(!html.includes('Switch between stores or create a new store'), 'Removed store switch caption');
  assert(html.includes('id="setStoreName"'), 'Store name input is preserved');
  assert(html.includes('id="setTimeZone"'), 'Time zone select is preserved');
});

runTest('Sign-in form placeholder and hints are updated', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert(!html.includes('value="rosa"'), 'Removed default value="rosa"');
  assert(html.includes('id="inputSignInUser"'), 'Contains inputSignInUser');
  assert(html.includes('placeholder="e.g. amigo, admin, or name@example.com"'), 'Contains accurate placeholder');
});

console.log('\n--- Test Group 4: Case Insensitive Username Login ---');

runTest('User "AMIGO" with password "ax123" resolves to "amigo"', () => {
  const res = authenticateOrRegisterUser('AMIGO', 'ax123');
  assert.equal(res.success, true);
  assert.equal(res.user.signInName, 'amigo');
  assert.equal(res.user.storeId, 'store_amigo');
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL USER AUTH & MULTI-TENANT TESTS PASSED PERFECTLY!');
}
