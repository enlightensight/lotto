import fs from 'fs';
import mysql from 'mysql2/promise';

const credLines = fs.readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

const caCert = fs.readFileSync('ca.pem', 'utf8');
const BASE_URL = 'http://127.0.0.1:3001';

const SHARED_EMAIL = creds.SHARED_TEST_EMAIL || 'amigofoodmart2300@gmail.com';
const STORE_PASSWORD = creds.STORE_TEST_PASS;
const ADMIN_PASSWORD = creds.ADMIN_TEST_PASS;

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== JACKPOTLO DUAL-IDENTITY LOGIN & SUSPENSION ENFORCEMENT AUDIT ===\n');

  // Verify connection to jackpotlo_test
  const conn = await mysql.createConnection({
    host: creds.DB_HOST,
    port: parseInt(creds.DB_PORT, 10),
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    database: 'jackpotlo_test',
    ssl: { ca: caCert, rejectUnauthorized: true }
  });
  const [dbRows] = await conn.query('SELECT DATABASE() as db');
  assert(dbRows[0].db === 'jackpotlo_test', 'Connected strictly to test database jackpotlo_test');

  // Ensure store_amigo is APPROVED at start
  await conn.query("UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'APPROVED', is_active = 1 WHERE store_id = 'store_amigo'");

  console.log('\n[Test 1] Store password opens only Amigo Food Mart POS (Store Mode)');
  const r1 = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: STORE_PASSWORD,
      mode: 'STORE'
    })
  });
  assert(r1.status === 200 && r1.data.success === true, 'Store login HTTP 200 with success = true');
  assert(r1.data.mode === 'STORE', 'Response mode is STORE');
  assert(r1.data.role === 'STORE_USER', 'User role is STORE_USER');
  assert(r1.data.isAdmin === false, 'isAdmin is false for store user');
  assert(r1.data.redirect === '/', 'Redirect destination is Store POS root ("/")');
  assert(r1.data.storeId === 'store_amigo', 'Authenticated storeId is store_amigo');
  assert(typeof r1.data.token === 'string' && r1.data.token.startsWith('str_'), 'Store session token starts with str_');
  const storeToken = r1.data.token;

  console.log('\n[Test 2] Admin password opens only Admin Dashboard (Admin Mode)');
  const r2 = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: ADMIN_PASSWORD,
      mode: 'ADMIN'
    })
  });
  assert(r2.status === 200 && r2.data.success === true, 'Admin login HTTP 200 with success = true');
  assert(r2.data.mode === 'ADMIN', 'Response mode is ADMIN');
  assert(r2.data.role === 'SUPER_ADMIN', 'User role is SUPER_ADMIN');
  assert(r2.data.isAdmin === true, 'isAdmin is true for administrator');
  assert(r2.data.redirect === '/admin', 'Redirect destination is Admin Dashboard ("/admin")');
  assert(typeof r2.data.token === 'string' && r2.data.token.startsWith('adm_'), 'Admin session token starts with adm_');
  const adminToken = r2.data.token;

  console.log('\n[Test 3] Same email works in both separate login modes');
  assert(r1.data.user.email === SHARED_EMAIL && r2.data.user.email === SHARED_EMAIL, `Both identities share email: ${SHARED_EMAIL}`);

  console.log('\n[Test 4] Cross-Password Failure Enforcement');
  // Attempt Store password in Admin mode
  const r4a = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: STORE_PASSWORD,
      mode: 'ADMIN'
    })
  });
  assert(r4a.status === 401 && r4a.data.success === false, 'Store password strictly rejected in Admin mode (HTTP 401)');

  // Attempt Admin password in Store mode
  const r4b = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: ADMIN_PASSWORD,
      mode: 'STORE'
    })
  });
  assert(r4b.status === 401 && r4b.data.success === false, 'Admin password strictly rejected in Store mode (HTTP 401)');

  console.log('\n[Test 5] Completely wrong password is rejected in both modes');
  const r5a = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: SHARED_EMAIL, password: 'WrongPassword!99', mode: 'STORE' })
  });
  assert(r5a.status === 401 && r5a.data.success === false, 'Wrong password rejected in Store mode (HTTP 401)');

  const r5b = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: SHARED_EMAIL, password: 'WrongPassword!99', mode: 'ADMIN' })
  });
  assert(r5b.status === 401 && r5b.data.success === false, 'Wrong password rejected in Admin mode (HTTP 401)');

  console.log('\n[Test 6] Pending application account is blocked');
  const r6 = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'sarah@metromart.com',
      password: 'AnyPassword123',
      mode: 'STORE'
    })
  });
  assert(r6.status === 403, 'Pending store applicant cannot log in (HTTP 403)');
  assert(r6.data.code === 'STORE_APPLICATION_PENDING', 'Returns code STORE_APPLICATION_PENDING');

  console.log('\n[Test 7] Unregistered / unapproved store cannot log in (No auto-approval)');
  const r7 = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'nonexistent_store_user_99@gmail.com',
      password: 'SomePassword123!',
      mode: 'STORE'
    })
  });
  assert(r7.status === 401 && r7.data.success === false, 'Unregistered user rejected without auto-approval (HTTP 401)');

  console.log('\n[Test 8] Store suspension enforcement (Admin suspends store_amigo)');
  const r8_suspend = await api('/api/admin/stores/store_amigo/status', {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify({
      authorizationStatus: 'SUSPENDED',
      operationalStatus: 'INACTIVE',
      reason: 'Audit compliance suspension test',
      adminUsername: 'admin'
    })
  });
  assert(r8_suspend.status === 200 && r8_suspend.data.store.authorizationStatus === 'SUSPENDED', 'Admin successfully suspended store_amigo');

  // Verify suspended store cannot log in
  const r8_login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: STORE_PASSWORD,
      mode: 'STORE'
    })
  });
  assert(r8_login.status === 403, 'Suspended store login blocked with HTTP 403');
  assert(r8_login.data.code === 'STORE_SUSPENDED' || r8_login.data.code === 'STORE_USER_SUSPENDED', 'Error code specifies store suspension');

  console.log('\n[Test 9] Existing store sessions rejected after suspension');
  const r9_sync = await api('/api/sync-pos-state', {
    method: 'POST',
    headers: {
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({
      storeId: 'store_amigo',
      state: { cashierName: 'Amigo Cashier' }
    })
  });
  assert(r9_sync.status === 403, 'Existing session rejected on store API call (HTTP 403)');

  console.log('\n[Test 10] Another active store remains fully operational');
  const r10 = await api('/api/sync-pos-state', {
    method: 'POST',
    headers: { 'x-store-id': 'store_downtown' },
    body: JSON.stringify({
      storeId: 'store_downtown',
      state: { cashierName: 'Downtown Cashier', totalSlots: 60 }
    })
  });
  assert(r10.status === 200 && r10.data.success === true, 'Downtown Quick Mart remains active and unaffected');

  console.log('\n[Test 11] Platform Admin login remains functional while store is suspended');
  const r11 = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: ADMIN_PASSWORD,
      mode: 'ADMIN'
    })
  });
  assert(r11.status === 200 && r11.data.success === true, 'Admin login succeeded while store is suspended');

  console.log('\n[Test 12] Reactivated store requires fresh login');
  // Reactivate store_amigo
  const r12_reactivate = await api('/api/admin/stores/store_amigo/status', {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify({
      authorizationStatus: 'APPROVED',
      operationalStatus: 'ACTIVE',
      reason: 'Reactivated after compliance audit',
      adminUsername: 'admin'
    })
  });
  assert(r12_reactivate.status === 200 && r12_reactivate.data.store.authorizationStatus === 'APPROVED', 'Store reactivated to APPROVED');

  // Old token MUST still be revoked
  const r12_old_token = await api('/api/sync-pos-state', {
    method: 'POST',
    headers: {
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({ storeId: 'store_amigo', state: {} })
  });
  assert(r12_old_token.status === 403, 'Old session token remains revoked after reactivation (HTTP 403)');

  // Fresh login succeeds
  const r12_fresh_login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: SHARED_EMAIL,
      password: STORE_PASSWORD,
      mode: 'STORE'
    })
  });
  assert(r12_fresh_login.status === 200 && r12_fresh_login.data.success === true, 'Fresh login after reactivation succeeds');
  const newStoreToken = r12_fresh_login.data.token;

  // New token works
  const r12_new_token = await api('/api/sync-pos-state', {
    method: 'POST',
    headers: {
      'x-store-token': newStoreToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({ storeId: 'store_amigo', state: { cashierName: 'Maulik' } })
  });
  assert(r12_new_token.status === 200 && r12_new_token.data.success === true, 'New session token works for store operations');

  await conn.end();

  console.log(`\n======================================================`);
  console.log(` AUDIT COMPLETE: ${passed}/${total} CHECKS PASSED`);
  console.log(`======================================================`);
}

runTests().catch(err => {
  console.error('\nAudit run failed:', err);
  process.exit(1);
});
