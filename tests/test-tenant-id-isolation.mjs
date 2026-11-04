import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

// LocalStorage mock for Node environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.sessionStorage = new LocalStorageMock();
global.window = {
  location: { hash: '' },
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage
};

import { 
  getInitialState, 
  getCleanEmptyState, 
  loadState, 
  saveState, 
  resetToCleanState, 
  getCurrentStoreId, 
  setCurrentStoreId, 
  getStoreStorageKey 
} from '../src/data.js';

import { 
  getRegisteredUsers, 
  saveRegisteredUsers, 
  registerNewUser, 
  findUserByCredentials, 
  lookupUserAssignedStore 
} from '../src/clerksData.js';

describe('Multi-Tenant Account & ID Data Isolation', () => {

  it('1. Amigo primary user is registered with store_amigo', () => {
    const authRes = findUserByCredentials('amigo', '1234');
    assert.strictEqual(authRes.success, true);
    assert.strictEqual(authRes.user.storeId, 'store_amigo');

    const users = getRegisteredUsers();
    const amigoUser = users.find(u => u.signInName === 'amigo');
    assert.ok(amigoUser, 'amigo user must exist in registered users');
    assert.strictEqual(amigoUser.storeId, 'store_amigo', 'amigo user storeId must be store_amigo');
    assert.strictEqual(amigoUser.storeName, 'Amigo Food Mart', 'amigo storeName must be Amigo Food Mart');
  });

  it('2. Amigo store initializes clean and saves to lotto_track_pos_data_v3_store_amigo', () => {
    setCurrentStoreId('store_amigo');
    const amigoState = loadState('store_amigo');
    assert.strictEqual(amigoState.storeName, 'AMIGO FOOD MART');
    // Initializes with clean rack
    const initialActive = (amigoState.slots || []).filter(s => s.status === 'ACTIVE');
    assert.strictEqual(initialActive.length, 0, 'Amigo starts with clean empty dispenser, no mock boxes');

    // Configure 3 active boxes in Amigo
    amigoState.slots[0].status = 'ACTIVE';
    amigoState.slots[0].gameName = '5X Money';
    amigoState.slots[0].packNumber = '128842';
    amigoState.slots[0].ticketsSold = 5;

    amigoState.slots[1].status = 'ACTIVE';
    amigoState.slots[1].gameName = 'Jr Jumbo';
    amigoState.slots[1].packNumber = '745508';

    amigoState.slots[2].status = 'ACTIVE';
    amigoState.slots[2].gameName = 'Loteria';
    amigoState.slots[2].packNumber = '933093';

    saveState(amigoState, 'store_amigo');

    // Storage key check: dedicated key
    const rawAmigo = localStorage.getItem('lotto_track_pos_data_v3_store_amigo');
    assert.ok(rawAmigo, 'lotto_track_pos_data_v3_store_amigo must exist');
    const parsedAmigo = JSON.parse(rawAmigo);
    assert.strictEqual(parsedAmigo.slots[0].ticketsSold, 5);
    const active = parsedAmigo.slots.filter(s => s.status === 'ACTIVE');
    assert.strictEqual(active.length, 3, 'Amigo has 3 configured boxes');
  });

  it('3. Registering a different ID creates a distinct store and does NOT show Amigo data', () => {
    // New user "alex" registers
    registerNewUser('alex', 'alexPass123');
    const alexAuth = findUserByCredentials('alex', 'alexPass123');
    assert.strictEqual(alexAuth.success, true);
    assert.strictEqual(alexAuth.user.signInName, 'alex');
    assert.strictEqual(alexAuth.user.storeId, 'store_alex', 'New user must get store_alex');
    assert.strictEqual(alexAuth.user.storeName, 'Alex Store');

    // Lookup store for alex
    const alexAssigned = lookupUserAssignedStore('alex');
    assert.strictEqual(alexAssigned.storeId, 'store_alex');
    assert.strictEqual(alexAssigned.storeName, 'Alex Store');

    // Load state for store_alex
    setCurrentStoreId('store_alex');
    const alexState = loadState('store_alex');
    assert.strictEqual(alexState.storeId, 'store_alex');

    // Verify Alex sees 0 active boxes (clean dispenser), NOT Amigo's boxes!
    const alexActiveBoxes = (alexState.slots || []).filter(s => s.status === 'ACTIVE');
    assert.strictEqual(alexActiveBoxes.length, 0, 'Alex must see 0 active boxes, NOT Amigo boxes!');
    assert.notStrictEqual(alexState.storeName, 'AMIGO FOOD MART');

    // Verify Amigo's data was NOT changed or overwritten
    const rawAmigo = localStorage.getItem('lotto_track_pos_data_v3_store_amigo');
    const parsedAmigo = JSON.parse(rawAmigo);
    assert.strictEqual(parsedAmigo.slots[0].ticketsSold, 5, 'Amigo data must remain untouched!');
  });

  it('4. Clearing data in a different ID does NOT delete or wipe Amigo data', () => {
    setCurrentStoreId('store_alex');
    const alexState = loadState('store_alex');
    
    // Alex clears their data
    resetToCleanState(alexState);

    // Verify Alex's store is cleared
    const alexRaw = localStorage.getItem('lotto_track_pos_data_v3_store_alex');
    assert.ok(alexRaw, 'Alex store file must exist');

    // CRITICAL: Amigo's lotto_track_pos_data_v3_store_amigo must NOT be deleted or wiped!
    const rawAmigo = localStorage.getItem('lotto_track_pos_data_v3_store_amigo');
    assert.ok(rawAmigo, 'Amigo data must still exist');
    const parsedAmigo = JSON.parse(rawAmigo);
    assert.strictEqual(parsedAmigo.slots[0].ticketsSold, 5, 'Amigo data was not deleted!');
    const amigoActive = parsedAmigo.slots.filter(s => s.status === 'ACTIVE');
    assert.strictEqual(amigoActive.length, 3, 'Amigo still has all 3 active boxes!');
  });

  it('5. Logging back into Amigo loads all original data with 0 changes or deletions', () => {
    // Authenticate as amigo
    const authRes = findUserByCredentials('amigo', '1234');
    assert.strictEqual(authRes.success, true);
    assert.strictEqual(authRes.user.storeId, 'store_amigo');

    // Switch store back to store_amigo
    setCurrentStoreId('store_amigo');
    const restoredAmigoState = loadState('store_amigo');
    assert.strictEqual(restoredAmigoState.storeName, 'AMIGO FOOD MART');
    assert.strictEqual(restoredAmigoState.slots[0].ticketsSold, 5);
    const active = restoredAmigoState.slots.filter(s => s.status === 'ACTIVE');
    assert.strictEqual(active.length, 3, 'All 3 active boxes restored intact!');
  });

  it('6. Registering multiple different IDs keeps every store completely isolated', () => {
    const userIds = ['mart_one', 'david', 'express_lotto', 'station99'];
    for (const uid of userIds) {
      registerNewUser(uid, 'pass_' + uid);
      const auth = findUserByCredentials(uid, 'pass_' + uid);
      assert.strictEqual(auth.success, true);
      assert.strictEqual(auth.user.storeId, `store_${uid}`);
      
      const st = loadState(`store_${uid}`);
      const active = (st.slots || []).filter(s => s.status === 'ACTIVE');
      assert.strictEqual(active.length, 0, `Store ${uid} must not have Amigo boxes`);
    }

    // Amigo still has 3 boxes
    const amigoState = loadState('store_amigo');
    const active = amigoState.slots.filter(s => s.status === 'ACTIVE');
    assert.strictEqual(active.length, 3, 'Amigo boxes still 100% intact');
  });
});
