import fs from 'fs';
import mysql from 'mysql2/promise';
import { execSync } from 'child_process';

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
const INITIAL_ADMIN_PASSWORD = creds.ADMIN_TEST_PASS;
const NEW_ADMIN_PASSWORD = 'AdminPass_Unified2026_SuperSecure#99';

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
  console.log('==================================================================');
  console.log('   JACKPOTLO UNIFIED EMAIL LOGIN & IDENTITY DETECTION TEST SUITE  ');
  console.log('==================================================================\n');

  // 1. Database Connection and Sanity Check
  console.log('--- Step 1: Database Pre-conditions Verification ---');
  const conn = await mysql.createConnection({
    host: creds.DB_HOST,
    port: parseInt(creds.DB_PORT, 10),
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    database: 'jackpotlo_test',
    ssl: { ca: caCert, rejectUnauthorized: true }
  });

  const [dbRows] = await conn.query('SELECT DATABASE() as db');
  assert(dbRows[0].db === 'jackpotlo_test', 'Strictly isolated target database: jackpotlo_test');

  // Ensure store_amigo is APPROVED and ACTIVE at start
  await conn.query("UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'APPROVED', is_active = 1 WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE admin_users SET is_active = 1 WHERE id = 'adm_001'");
  console.log('  ✓ Test database records initialized to clean approved state.\n');

  // ---------------------------------------------------------------------------
  // STEP 2: Administrator Password Reset Testing
  // ---------------------------------------------------------------------------
  console.log('--- Step 2: Testing Administrator Password Reset Procedure ---');

  // 2a. Reject resetting admin password to be identical to store password
  let conflictRejected = false;
  try {
    execSync(`node scripts/reset-admin-password.mjs`, {
      env: {
        ...process.env,
        DB_HOST: creds.DB_HOST,
        DB_PORT: creds.DB_PORT,
        DB_USER: creds.DB_USER,
        DB_PASSWORD: creds.DB_PASSWORD,
        DB_NAME: 'jackpotlo_test',
        IS_TEST_BACKEND: 'true',
        RESET_ADMIN_TEST_PASS: STORE_PASSWORD
      },
      stdio: 'pipe'
    });
  } catch (err) {
    conflictRejected = true;
  }
  assert(conflictRejected, 'Admin reset procedure rejected password identical to store password');

  // 2b. Successfully reset to a brand new secure administrator password
  execSync(`node scripts/reset-admin-password.mjs`, {
    env: {
      ...process.env,
      DB_HOST: creds.DB_HOST,
      DB_PORT: creds.DB_PORT,
      DB_USER: creds.DB_USER,
      DB_PASSWORD: creds.DB_PASSWORD,
      DB_NAME: 'jackpotlo_test',
      IS_TEST_BACKEND: 'true',
      RESET_ADMIN_TEST_PASS: NEW_ADMIN_PASSWORD
    },
    stdio: 'inherit'
  });

  // Verify in database that adm_001 has updated hash and store_users is untouched
  const [adminCheck] = await conn.query("SELECT id, email, role, is_active FROM admin_users WHERE id = 'adm_001'");
  assert(adminCheck[0].email === SHARED_EMAIL, 'adm_001 registered email preserved: amigofoodmart2300@gmail.com');
  assert(adminCheck[0].role === 'SUPER_ADMIN', 'adm_001 SUPER_ADMIN role preserved');

  console.log('  ✓ Admin password reset completed and verified in database.\n');

  // ---------------------------------------------------------------------------
  // STEP 3: Unified Login Verification (Email + Password ONLY)
  // ---------------------------------------------------------------------------
  console.log('--- Step 3: Unified Automatic Password-Based Identity Resolution ---');

  // 3a. Store Login: Same email + Store password -> Store POS
  const storeLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: STORE_PASSWORD
    })
  });
  assert(storeLogin.status === 200, 'Store login HTTP 200 OK');
  assert(storeLogin.data.success === true, 'Store login success = true');
  assert(storeLogin.data.mode === 'STORE', 'Store identity automatically resolved (mode = STORE)');
  assert(storeLogin.data.isAdmin === false, 'Store user has isAdmin = false');
  assert(storeLogin.data.redirect === '/', 'Store POS redirect target is "/"');
  assert(storeLogin.data.storeId === 'store_amigo', 'Store ID is store_amigo');
  assert(storeLogin.data.token && storeLogin.data.token.startsWith('str_'), 'Store session token issued with prefix "str_"');
  const storeToken = storeLogin.data.token;

  // 3b. Admin Login: Same email + New Admin password -> Admin Dashboard
  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: NEW_ADMIN_PASSWORD
    })
  });
  assert(adminLogin.status === 200, 'Admin login HTTP 200 OK');
  assert(adminLogin.data.success === true, 'Admin login success = true');
  assert(adminLogin.data.mode === 'ADMIN', 'Admin identity automatically resolved (mode = ADMIN)');
  assert(adminLogin.data.isAdmin === true, 'Admin user has isAdmin = true');
  assert(adminLogin.data.role === 'SUPER_ADMIN', 'Admin role is SUPER_ADMIN');
  assert(adminLogin.data.redirect === '/admin', 'Admin Dashboard redirect target is "/admin"');
  assert(adminLogin.data.token && adminLogin.data.token.startsWith('adm_'), 'Admin session token issued with prefix "adm_"');
  const adminToken = adminLogin.data.token;

  // ---------------------------------------------------------------------------
  // STEP 4: Credential Rejection Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 4: Credential & Legacy Login Rejection Tests ---');

  // 4a. Wrong password with registered email
  const wrongPass = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: 'TotallyWrongPassword!123'
    })
  });
  assert(wrongPass.status === 401, 'Wrong password rejected with HTTP 401');
  assert(wrongPass.data.success === false, 'Wrong password success = false');

  // 4b. Old administrator password rejected
  const oldAdminPass = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: INITIAL_ADMIN_PASSWORD
    })
  });
  assert(oldAdminPass.status === 401, 'Old admin password rejected after reset (HTTP 401)');

  // 4c. Username-only login ("admin") without email rejected
  const usernameAdmin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: NEW_ADMIN_PASSWORD
    })
  });
  assert(usernameAdmin.status === 400, 'Username-only "admin" rejected with HTTP 400');
  assert(usernameAdmin.data.code === 'EMAIL_REQUIRED', 'EMAIL_REQUIRED code returned');

  // 4d. Username-only login ("amigo") without email rejected
  const usernameAmigo = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'amigo',
      password: STORE_PASSWORD
    })
  });
  assert(usernameAmigo.status === 400, 'Username-only "amigo" rejected with HTTP 400');
  assert(usernameAmigo.data.code === 'EMAIL_REQUIRED', 'EMAIL_REQUIRED code returned');

  // ---------------------------------------------------------------------------
  // STEP 5: Security & Lifecycle State Enforcements
  // ---------------------------------------------------------------------------
  console.log('\n--- Step 5: Store Suspension & Account Approval Enforcements ---');

  // 5a. Pending Store Account status rejection
  await conn.query("UPDATE store_users SET account_status = 'PENDING' WHERE store_id = 'store_amigo'");
  const pendingLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: STORE_PASSWORD
    })
  });
  assert(pendingLogin.status === 403, 'Pending store account login rejected with HTTP 403');
  assert(pendingLogin.data.code === 'STORE_USER_PENDING', 'STORE_USER_PENDING code returned');

  // Restore store user to APPROVED
  await conn.query("UPDATE store_users SET account_status = 'APPROVED' WHERE store_id = 'store_amigo'");

  // 5b. Store Suspension Rejection: Suspend store_amigo via admin API
  const suspendResp = await api('/api/admin/stores/store_amigo/status', {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify({
      status: 'SUSPENDED',
      operationalStatus: 'INACTIVE',
      reason: 'Automated unified login security compliance test'
    })
  });
  assert(suspendResp.status === 200, 'Store suspended successfully via admin API');

  // Attempt store login while store is suspended
  const suspendedStoreLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: STORE_PASSWORD
    })
  });
  assert(suspendedStoreLogin.status === 403, 'Store login during suspension rejected with HTTP 403');
  assert(suspendedStoreLogin.data.code === 'STORE_SUSPENDED' || suspendedStoreLogin.data.code === 'STORE_USER_SUSPENDED', 'Store suspension rejection code returned');

  // 5c. CRITICAL: Platform Admin access REMAINS AVAILABLE during store suspension!
  const adminLoginDuringSuspension = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: NEW_ADMIN_PASSWORD
    })
  });
  assert(adminLoginDuringSuspension.status === 200, 'Admin login SUCCEEDS during store suspension (HTTP 200)');
  assert(adminLoginDuringSuspension.data.mode === 'ADMIN', 'Admin mode granted during store suspension');
  assert(adminLoginDuringSuspension.data.isAdmin === true, 'Admin access intact');

  // 5d. Existing Store Session Token Revocation
  const revokedSessionCall = await api('/api/sync-pos-state', {
    method: 'POST',
    headers: {
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({ storeId: 'store_amigo', state: {} })
  });
  assert(revokedSessionCall.status === 403, 'Existing store session revoked upon suspension (HTTP 403)');

  // Reactivate store_amigo
  const reactivateResp = await api('/api/admin/stores/store_amigo/status', {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: JSON.stringify({
      status: 'APPROVED',
      operationalStatus: 'ACTIVE',
      reason: 'Reactivated after test'
    })
  });
  assert(reactivateResp.status === 200, 'Store reactivated to APPROVED');
  await conn.query("UPDATE store_users SET account_status = 'APPROVED' WHERE store_id = 'store_amigo'");

  // Fresh store login succeeds after reactivation
  const postReactivateStoreLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: SHARED_EMAIL,
      password: STORE_PASSWORD
    })
  });
  assert(postReactivateStoreLogin.status === 200, 'Store login succeeds after reactivation');
  assert(postReactivateStoreLogin.data.mode === 'STORE', 'Store POS opened successfully');

  await conn.end();

  console.log(`\n======================================================`);
  console.log(` AUDIT COMPLETE: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log(`======================================================\n`);
}

runTests().catch(err => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});

