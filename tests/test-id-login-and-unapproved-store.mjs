import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

console.log('================================================================');
console.log(' TEST: ID / USERNAME LOGIN & UNAPPROVED (PENDING) STORE ALLOWED  ');
console.log('================================================================\n');

const credLines = fs.readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

const caCert = fs.readFileSync('ca.pem', 'utf8');
const SHARED_EMAIL = creds.SHARED_TEST_EMAIL || 'amigofoodmart2300@gmail.com';
const STORE_PASSWORD = creds.STORE_TEST_PASS;
const ADMIN_PASSWORD = creds.ADMIN_TEST_PASS || 'AdminPass_Unified2026_SuperSecure#99';

async function run() {
  const conn = await mysql.createConnection({
    host: creds.DB_HOST,
    port: parseInt(creds.DB_PORT, 10),
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    database: 'jackpotlo_test',
    ssl: { ca: caCert, rejectUnauthorized: true }
  });

  const [db] = await conn.query('SELECT DATABASE() as db');
  assert.strictEqual(db[0].db, 'jackpotlo_test', 'Must connect only to jackpotlo_test');

  // 1. Test Login via ID "amigo" with store password
  const resAmigo = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amigo', password: STORE_PASSWORD })
  });
  const dataAmigo = await resAmigo.json();
  assert.strictEqual(resAmigo.status, 200, `Login with ID "amigo" must succeed (got ${resAmigo.status}): ${JSON.stringify(dataAmigo)}`);
  assert.strictEqual(dataAmigo.success, true, 'data.success must be true');
  assert.strictEqual(dataAmigo.mode, 'STORE', 'data.mode must be STORE');
  console.log('✓ PASS: Login with Store ID "amigo" succeeded -> Mode: STORE');

  // 2. Test Login via ID "admin" with admin password
  const resAdmin = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: ADMIN_PASSWORD })
  });
  const dataAdmin = await resAdmin.json();
  assert.strictEqual(resAdmin.status, 200, `Login with ID "admin" must succeed (got ${resAdmin.status}): ${JSON.stringify(dataAdmin)}`);
  assert.strictEqual(dataAdmin.success, true, 'data.success must be true');
  assert.strictEqual(dataAdmin.mode, 'ADMIN', 'data.mode must be ADMIN');
  console.log('✓ PASS: Login with Admin ID "admin" succeeded -> Mode: ADMIN');

  // 3. Test Login via ID "adm_001" with admin password
  const resAdm001 = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adm_001', password: ADMIN_PASSWORD })
  });
  const dataAdm001 = await resAdm001.json();
  assert.strictEqual(resAdm001.status, 200, `Login with ID "adm_001" must succeed`);
  assert.strictEqual(dataAdm001.mode, 'ADMIN', 'data.mode must be ADMIN');
  console.log('✓ PASS: Login with Admin ID "adm_001" succeeded -> Mode: ADMIN');

  // 4. Test Login via Email with store password
  const resEmailStore = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SHARED_EMAIL, password: STORE_PASSWORD })
  });
  const dataEmailStore = await resEmailStore.json();
  assert.strictEqual(resEmailStore.status, 200, 'Login with email + store password must succeed');
  assert.strictEqual(dataEmailStore.mode, 'STORE', 'Must resolve to STORE');
  console.log('✓ PASS: Login with Email + Store Password succeeded -> Mode: STORE');

  // 5. Test Login via Email with admin password
  const resEmailAdmin = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SHARED_EMAIL, password: ADMIN_PASSWORD })
  });
  const dataEmailAdmin = await resEmailAdmin.json();
  assert.strictEqual(resEmailAdmin.status, 200, 'Login with email + admin password must succeed');
  assert.strictEqual(dataEmailAdmin.mode, 'ADMIN', 'Must resolve to ADMIN');
  console.log('✓ PASS: Login with Email + Admin Password succeeded -> Mode: ADMIN');

  // 6. Test that PENDING normal stores can sell and activate tickets without admin approval
  // Temporarily set store_amigo to PENDING
  await conn.query("UPDATE stores SET authorization_status = 'PENDING' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'PENDING' WHERE store_id = 'store_amigo'");

  // Store login with PENDING store
  const resPendingLogin = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amigo', password: STORE_PASSWORD })
  });
  const dataPendingLogin = await resPendingLogin.json();
  assert.strictEqual(resPendingLogin.status, 200, `PENDING store must be able to log in (got ${resPendingLogin.status}): ${JSON.stringify(dataPendingLogin)}`);
  console.log('✓ PASS: PENDING normal store successfully logged in without admin approval requirement');

  const storeToken = dataPendingLogin.token;

  // Store activate ticket endpoint (/api/inventory/activate) with PENDING store
  const resActivate = await fetch('http://localhost:3001/api/inventory/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({
      boxNumber: 5,
      packNumber: '998877',
      gameName: 'Super Cash',
      gameId: '109',
      price: 5
    })
  });
  assert.notStrictEqual(resActivate.status, 403, 'Activate ticket must not be rejected with 403 for PENDING store');
  console.log(`✓ PASS: Activate ticket endpoint accepted for PENDING normal store (status ${resActivate.status})`);

  // Store sale endpoint (/api/inventory/sale) with PENDING store
  const resSale = await fetch('http://localhost:3001/api/inventory/sale', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-store-token': storeToken,
      'x-store-id': 'store_amigo'
    },
    body: JSON.stringify({
      boxNumber: 5,
      ticketNumber: 1,
      barcode: '109998877001'
    })
  });
  assert.notStrictEqual(resSale.status, 403, 'Sale ticket must not be rejected with 403 for PENDING store');
  console.log(`✓ PASS: Ticket sale endpoint accepted for PENDING normal store (status ${resSale.status})`);

  // Restore store_amigo to APPROVED & ACTIVE
  await conn.query("UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'");
  await conn.query("UPDATE store_users SET account_status = 'APPROVED', is_active = 1 WHERE store_id = 'store_amigo'");

  await conn.end();
  console.log('\n================================================================');
  console.log(' ALL TESTS PASSED: ID LOGIN & NO ADMIN APPROVAL REQUIRED        ');
  console.log('================================================================');
}

run().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

