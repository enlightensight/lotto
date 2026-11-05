import assert from 'node:assert';
import fs from 'node:fs';

console.log('================================================================');
console.log('   TEST: ADMIN STORE SEPARATION & POS SWITCHING ISOLATION     ');
console.log('================================================================\n');

// 1. Verify src/data.js DEFAULT_STORES includes store_admin
const dataJs = fs.readFileSync('src/data.js', 'utf8');
assert(dataJs.includes("id: 'store_admin'"), 'src/data.js DEFAULT_STORES includes store_admin');
assert(dataJs.includes("name: 'ADMIN STORE'"), 'src/data.js DEFAULT_STORES includes ADMIN STORE name');
console.log('✓ PASS: src/data.js registers dedicated store_admin');

// 2. Verify src/adminUiHandlers.js handleSwitchToPos targets store_admin
const adminUi = fs.readFileSync('src/adminUiHandlers.js', 'utf8');
assert(adminUi.includes("const targetStoreId = 'store_admin';"), 'handleSwitchToPos switches exclusively to store_admin');
assert(!adminUi.includes("getCurrentStoreId() : 'store_amigo') || 'store_amigo'"), 'handleSwitchToPos no longer leaks previous store');
console.log('✓ PASS: src/adminUiHandlers.js "Switch to Store POS" locks strictly to store_admin');

// 3. Verify src/main.js admin routing locks to store_admin
const mainJs = fs.readFileSync('src/main.js', 'utf8');
assert(mainJs.includes("setCurrentStoreId('store_admin')"), 'src/main.js sets current store to store_admin on admin login');
assert(mainJs.includes("window.switchStore('store_admin')"), 'src/main.js calls switchStore(store_admin) on admin login');
console.log('✓ PASS: src/main.js admin login strictly sets store_admin');

// 4. Verify live login endpoint returns store_admin for admin
const res = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin', password: '1234' })
});
const data = await res.json();
assert(res.ok && data.success, 'Admin login succeeded');
assert.strictEqual(data.mode, 'ADMIN', 'Mode is ADMIN');
assert.strictEqual(data.storeId, 'store_admin', 'storeId is store_admin');
assert.strictEqual(data.storeName, 'ADMIN STORE', 'storeName is ADMIN STORE');
console.log('✓ PASS: /api/auth/login returns storeId: store_admin for admin');

// 5. Verify live login endpoint returns store_anish for anish
const resAnish = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'anish', password: 'AX123456@' })
});
const dataAnish = await resAnish.json();
assert(resAnish.ok && dataAnish.success, 'Anish login succeeded');
assert.strictEqual(dataAnish.mode, 'STORE', 'Mode is STORE');
assert.strictEqual(dataAnish.storeId, 'store_anish', 'storeId is store_anish');
console.log('✓ PASS: /api/auth/login returns storeId: store_anish for anish');

// 6. Verify live login endpoint returns store_amigo for amigo
const resAmigo = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'amigo', password: '0000' })
});
const dataAmigo = await resAmigo.json();
assert(resAmigo.ok && dataAmigo.success, 'Amigo login succeeded');
assert.strictEqual(dataAmigo.mode, 'STORE', 'Mode is STORE');
assert.strictEqual(dataAmigo.storeId, 'store_amigo', 'storeId is store_amigo');
console.log('✓ PASS: /api/auth/login returns storeId: store_amigo for amigo');

console.log('\n================================================================');
console.log(' ALL ADMIN STORE SEPARATION TESTS PASSED PERFECTLY! (6/6)');
console.log('================================================================');

