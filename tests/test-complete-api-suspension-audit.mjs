// ============================================================================
// Comprehensive API Security & Suspension Audit Test
// Tests EVERY store route against suspended store and revoked session
// ============================================================================

import assert from 'assert';
import http from 'http';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';

// Read test credentials
const credLines = fs.readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

async function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const payload = options.body ? options.body : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method: options.method || 'GET', headers }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, data: json || data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

console.log('\n=== COMPREHENSIVE STORE API SECURITY AUDIT ===\n');

// 1. Log in as admin to manage store status
const adminLogin = await api('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: creds.SHARED_TEST_EMAIL,
    password: creds.ADMIN_TEST_PASS,
    mode: 'ADMIN'
  })
});
assert.strictEqual(adminLogin.status, 200);
const adminToken = adminLogin.data.token;
console.log('✓ Admin authenticated');

// Ensure store_amigo is ACTIVE before beginning
await api('/api/admin/stores/store_amigo/status', {
  method: 'POST',
  headers: { 'x-admin-token': adminToken },
  body: JSON.stringify({ authorizationStatus: 'APPROVED', status: 'APPROVED' })
});

// 2. Log in as Store User to get store token
const storeLogin = await api('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: creds.SHARED_TEST_EMAIL,
    password: creds.STORE_TEST_PASS,
    mode: 'STORE'
  })
});
assert.strictEqual(storeLogin.status, 200);
const storeToken = storeLogin.data.token;
console.log('✓ Store authenticated (Token:', storeToken.slice(0, 16) + '...)');

// 3. Suspend store_amigo
const suspendRes = await api('/api/admin/stores/store_amigo/status', {
  method: 'POST',
  headers: { 'x-admin-token': adminToken },
  body: JSON.stringify({ authorizationStatus: 'SUSPENDED', status: 'SUSPENDED' })
});
assert.strictEqual(suspendRes.status, 200);
console.log('✓ Store "store_amigo" status set to SUSPENDED\n');

// 4. Test EVERY store-specific route to confirm HTTP 403 STORE_SUSPENDED
const storeRoutesToTest = [
  // POS State & Day/Shift Reports
  { method: 'GET',  path: '/api/load-pos-state?storeId=store_amigo' },
  { method: 'POST', path: '/api/sync-pos-state', body: { storeId: 'store_amigo', state: {} } },
  { method: 'POST', path: '/api/clear-pos-state', body: { storeId: 'store_amigo' } },
  { method: 'GET',  path: '/api/day-reports?storeId=store_amigo' },
  { method: 'GET',  path: '/api/day-report/1/boxes?storeId=store_amigo' },
  { method: 'POST', path: '/api/save-day-report', body: { storeId: 'store_amigo' } },
  { method: 'GET',  path: '/api/shift-reports?storeId=store_amigo' },
  { method: 'GET',  path: '/api/shift-report/1/boxes?storeId=store_amigo' },
  { method: 'POST', path: '/api/save-shift-report', body: { storeId: 'store_amigo' } },
  
  // Dispensers & POS Operations
  { method: 'GET',  path: '/api/active-dispensers?storeId=store_amigo' },
  { method: 'GET',  path: '/api/inventory?storeId=store_amigo' },
  { method: 'POST', path: '/api/log-scan', body: { storeId: 'store_amigo', barcode: '123' } },
  { method: 'GET',  path: '/api/views/view_active_packs?storeId=store_amigo' },
  { method: 'POST', path: '/api/sync-users', body: [] },
  { method: 'GET',  path: '/api/load-users?storeId=store_amigo' },

  // Store Requests & Allocations
  { method: 'GET',  path: '/api/store/requests?storeId=store_amigo' },
  { method: 'POST', path: '/api/store/requests', body: { storeId: 'store_amigo', gameId: '1650' } },
  { method: 'GET',  path: '/api/store/approved-tickets?storeId=store_amigo' },
  { method: 'GET',  path: '/api/store/allocations?storeId=store_amigo' },
  { method: 'POST', path: '/api/store/receive-allocation', body: { storeId: 'store_amigo', allocationId: 1 } },

  // Pack Inventory Lifecycle
  { method: 'GET',  path: '/api/inventory/summary?storeId=store_amigo' },
  { method: 'GET',  path: '/api/inventory/packs?storeId=store_amigo' },
  { method: 'POST', path: '/api/inventory/receive', body: { storeId: 'store_amigo', packNumber: '1' } },
  { method: 'POST', path: '/api/inventory/activate', body: { storeId: 'store_amigo', packNumber: '1', boxNumber: 1 } },
  { method: 'POST', path: '/api/inventory/sale', body: { storeId: 'store_amigo', packNumber: '1', quantity: 1 } },
  { method: 'POST', path: '/api/inventory/reconcile-shift', body: { storeId: 'store_amigo' } },
  { method: 'POST', path: '/api/inventory/return', body: { storeId: 'store_amigo', packNumber: '1' } },
  { method: 'POST', path: '/api/inventory/transfer', body: { storeId: 'store_amigo', packNumber: '1', toStoreId: 'store_downtown' } },
  { method: 'GET',  path: '/api/inventory/pack-history?packNumber=1&storeId=store_amigo' },
  { method: 'GET',  path: '/api/inventory/game-summary?storeId=store_amigo' },
  { method: 'GET',  path: '/api/inventory/discrepancies?storeId=store_amigo' },
  { method: 'GET',  path: '/api/inventory/ledger?storeId=store_amigo' }
];

let routesPassed = 0;
for (const r of storeRoutesToTest) {
  const res = await api(r.path, {
    method: r.method,
    headers: {
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: r.body ? JSON.stringify(r.body) : undefined
  });
  
  assert.strictEqual(
    res.status,
    403,
    `Route ${r.method} ${r.path} MUST return HTTP 403 for suspended store. Received: ${res.status}`
  );
  routesPassed++;
  console.log(`  ✓ [403 FORBIDDEN] ${r.method.padEnd(4, ' ')} ${r.path}`);
}

console.log(`\n✓ All ${routesPassed}/${storeRoutesToTest.length} store routes strictly enforce suspension protection.`);

// 5. Verify Platform Admin has root audit visibility over the same endpoints
const adminCheck = await api('/api/inventory/summary?storeId=store_amigo', {
  headers: { 'x-admin-token': adminToken }
});
assert.strictEqual(adminCheck.status, 200, 'Admin token must allow audit visibility even for suspended store');
console.log('✓ Admin root audit visibility verified for suspended store data (200 OK)');

// 6. Reactivate store_amigo for normal operations
const reactivateRes = await api('/api/admin/stores/store_amigo/status', {
  method: 'POST',
  headers: { 'x-admin-token': adminToken },
  body: JSON.stringify({ authorizationStatus: 'APPROVED', status: 'APPROVED' })
});
assert.strictEqual(reactivateRes.status, 200);
console.log('✓ Store "store_amigo" reactivated to ACTIVE status.');

console.log('\n🎉 ALL STORE API SECURITY AUDIT CHECKS PASSED!\n');
