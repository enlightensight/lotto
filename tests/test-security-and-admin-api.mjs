// ============================================================================
// Comprehensive Security & Admin API Verification Test Suite
// ============================================================================

import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function it(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n====================================================');
console.log('   JACKPOTLO SECURITY & ADMIN API VERIFICATION      ');
console.log('====================================================\n');

// Reset admin password to known secure test password using CLI script
import { execSync } from 'child_process';
execSync('node scripts/manage-admin.cjs reset admin TestAdminPass123!');

let validAdminToken = null;

// ----------------------------------------------------------------------------
// Test Group 1: Admin Authentication & Credential Security
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: Admin Authentication & Credential Security ---');

await it('Rejects old/default "1234" password after reset', async () => {
  const res = await request('POST', '/api/auth/login', { username: 'admin', password: '1234' });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

await it('Logs in successfully with valid new password and returns cryptographically secure token', async () => {
  const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'TestAdminPass123!' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.isAdmin, true);
  assert.ok(res.body.token);
  assert.ok(res.body.token.startsWith('adm_'));
  assert.ok(res.body.token.length >= 64, 'Token must be cryptographically long (>= 64 chars)');
  validAdminToken = res.body.token;
});

// ----------------------------------------------------------------------------
// Test Group 2: requireAdminRole Cryptographic Verification (No Fake Prefix Allowed)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: requireAdminRole Cryptographic Verification ---');

await it('Rejects forged token with "adm_token_" prefix (returns 403 Forbidden)', async () => {
  const forgedTokens = [
    'adm_token_fake_12345',
    'adm_token_SUPER_ADMIN',
    'adm_token_1234',
    'adm_00000000000000000000000000000000'
  ];
  for (const fake of forgedTokens) {
    const res = await request('GET', '/api/admin/overview', null, { 'x-admin-token': fake });
    assert.strictEqual(res.status, 403, `Fake token "${fake}" must be rejected with 403`);
    assert.strictEqual(res.body.success, false);
  }
});

await it('Rejects request with empty or missing token (returns 403 Forbidden)', async () => {
  const res = await request('GET', '/api/admin/overview');
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

await it('Accepts legitimately issued server-side session token (returns 200 OK)', async () => {
  const res = await request('GET', '/api/admin/overview', null, { 'x-admin-token': validAdminToken });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok('stats' in res.body);
  assert.ok(typeof res.body.stats.totalStores === 'number');
});

// ----------------------------------------------------------------------------
// Test Group 3: Ordinary Store User Receives 403 on ALL Admin Endpoints
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Ordinary Store User / Unauthorized 403 Forbidden on ALL Admin APIs ---');

const ordinaryUserHeaders = {
  // Store user has NO admin token, or passes a store session identifier
  'x-store-id': 'store_amigo',
  'x-user-role': 'CASHIER'
};

const adminEndpoints = [
  { method: 'GET', path: '/api/admin/overview' },
  { method: 'GET', path: '/api/admin/stores' },
  { method: 'POST', path: '/api/admin/stores/store_amigo/status', body: { authorizationStatus: 'SUSPENDED' } },
  { method: 'GET', path: '/api/admin/applications' },
  { method: 'POST', path: '/api/admin/applications/1/review', body: { decision: 'APPROVE' } },
  { method: 'GET', path: '/api/admin/catalog' },
  { method: 'POST', path: '/api/admin/catalog', body: { gameId: '9999', gameName: 'Hack' } },
  { method: 'GET', path: '/api/admin/ticket-requests' },
  { method: 'POST', path: '/api/admin/ticket-requests/1/review', body: { decision: 'APPROVE' } },
  { method: 'GET', path: '/api/admin/allocations' },
  { method: 'POST', path: '/api/admin/allocations', body: { storeId: 'store_amigo', gameId: '1650', packNumber: '111' } },
  { method: 'GET', path: '/api/admin/reports' },
  { method: 'GET', path: '/api/admin/audit-logs' },
  { method: 'POST', path: '/api/admin/change-password', body: { currentPassword: 'x', newPassword: 'y' } }
];

for (const ep of adminEndpoints) {
  await it(`Ordinary user receives 403 on ${ep.method} ${ep.path}`, async () => {
    const res = await request(ep.method, ep.path, ep.body || null, ordinaryUserHeaders);
    assert.strictEqual(res.status, 403, `Endpoint ${ep.path} must return 403`);
    assert.strictEqual(res.body.success, false);
  });
}

// ----------------------------------------------------------------------------
// Test Group 4: Session Lifecycle (Logout & Token Revocation)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Session Lifecycle, Logout & Token Revocation ---');

await it('Admin can successfully log out and revoke server session token', async () => {
  // First verify token works
  let check = await request('GET', '/api/admin/overview', null, { 'x-admin-token': validAdminToken });
  assert.strictEqual(check.status, 200);

  // Call logout endpoint
  const logoutRes = await request('POST', '/api/admin/logout', null, { 'x-admin-token': validAdminToken });
  assert.strictEqual(logoutRes.status, 200);
  assert.strictEqual(logoutRes.body.success, true);

  // Subsequent request with the same token must now return 403 Forbidden!
  check = await request('GET', '/api/admin/overview', null, { 'x-admin-token': validAdminToken });
  assert.strictEqual(check.status, 403, 'Revoked token must return 403 Forbidden');
});

// Re-login to get fresh token for remaining tests
const reLoginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'TestAdminPass123!' });
assert.strictEqual(reLoginRes.status, 200);
validAdminToken = reLoginRes.body.token;

// ----------------------------------------------------------------------------
// Test Group 5: Ticket Approval vs Physical Allocation Separation
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Ticket Approval vs Physical Stock Allocation Separation ---');

const testGameId = '1720'; // Hit 1000 ($20)
const testPackNum = `9988${Math.floor(100 + Math.random() * 900)}`;

await it('Store requests ticket type', async () => {
  const reqRes = await request('POST', '/api/store/requests', {
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    gameId: testGameId,
    requestedBy: 'amigo'
  });
  assert.ok(reqRes.status === 200 || reqRes.status === 400); // 400 if already pending
});

await it('Admin reviews and approves ticket request with decision reason', async () => {
  // Fetch pending requests
  const listRes = await request('GET', '/api/admin/ticket-requests', null, { 'x-admin-token': validAdminToken });
  assert.strictEqual(listRes.status, 200);
  const pendingReq = (listRes.body.requests || []).find(r => r.storeId === 'store_amigo' && r.gameId === testGameId);
  assert.ok(pendingReq, 'Ticket request must exist in ticket requests list');

  const reviewRes = await request('POST', `/api/admin/ticket-requests/${pendingReq.id}/review`, {
    decision: 'APPROVE',
    adminUsername: 'admin',
    reason: 'Approved for premium counter counter sales'
  }, { 'x-admin-token': validAdminToken });

  assert.strictEqual(reviewRes.status, 200);
  assert.strictEqual(reviewRes.body.request.status, 'APPROVED');
  assert.strictEqual(reviewRes.body.request.adminDecisionReason, 'Approved for premium counter counter sales');
});

await it('Approving ticket does NOT add physical stock to store inventory', async () => {
  // Check store approved tickets: game IS approved
  const approvedRes = await request('GET', `/api/store/approved-tickets?storeId=store_amigo`);
  assert.strictEqual(approvedRes.status, 200);
  const isApproved = (approvedRes.body.approved || []).some(g => String(g.gameId) === testGameId);
  assert.ok(isApproved, 'Game must be in approved tickets list');

  // Check physical allocations: pack is NOT yet allocated
  const allocsRes = await request('GET', `/api/store/allocations?storeId=store_amigo`);
  assert.strictEqual(allocsRes.status, 200);
  const hasPhysicalPack = (allocsRes.body.allocations || []).some(a => a.packNumber === testPackNum);
  assert.strictEqual(hasPhysicalPack, false, 'No physical pack must exist before stock allocation');
});

await it('Admin creates physical stock allocation in a separate step', async () => {
  const allocRes = await request('POST', '/api/admin/allocations', {
    allocationReference: `ALC-SEP-${Date.now().toString().slice(-4)}`,
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    gameId: testGameId,
    gameName: 'Hit 1000',
    packNumber: testPackNum,
    packSize: 30,
    ticketPrice: 20,
    adminUsername: 'admin'
  }, { 'x-admin-token': validAdminToken });

  assert.strictEqual(allocRes.status, 200);
  assert.strictEqual(allocRes.body.success, true);
  assert.strictEqual(allocRes.body.allocation.packNumber, testPackNum);
  assert.strictEqual(allocRes.body.allocation.status, 'ALLOCATED');
});

await it('Store can now receive the allocated pack into inventory', async () => {
  const storeAllocs = await request('GET', `/api/store/allocations?storeId=store_amigo`);
  const alloc = (storeAllocs.body.allocations || []).find(a => a.packNumber === testPackNum);
  assert.ok(alloc);

  const receiveRes = await request('POST', '/api/store/receive-allocation', {
    allocationId: alloc.id,
    storeId: 'store_amigo',
    receivedBy: 'amigo'
  });
  assert.strictEqual(receiveRes.status, 200);
  assert.strictEqual(receiveRes.body.success, true);
  assert.strictEqual(receiveRes.body.allocation.status, 'RECEIVED');
});

// ----------------------------------------------------------------------------
// Test Group 6: Password Change & Insecure Password Rejection
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: Password Change & Insecure Password Rejection ---');

await it('Rejects short or insecure new passwords (min 8 characters, no "1234")', async () => {
  const res1 = await request('POST', '/api/admin/change-password', {
    currentPassword: 'TestAdminPass123!',
    newPassword: 'short'
  }, { 'x-admin-token': validAdminToken });
  assert.strictEqual(res1.status, 400);

  const res2 = await request('POST', '/api/admin/change-password', {
    currentPassword: 'TestAdminPass123!',
    newPassword: '1234'
  }, { 'x-admin-token': validAdminToken });
  assert.strictEqual(res2.status, 400);
});

await it('Admin can securely change password with PBKDF2-HMAC-SHA256 (600,000 iterations)', async () => {
  const res = await request('POST', '/api/admin/change-password', {
    currentPassword: 'TestAdminPass123!',
    newPassword: 'FinalSecurePass@2027!'
  }, { 'x-admin-token': validAdminToken });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  // Verify hash in admin_state.json uses 600,000 iterations of SHA-256
  const stData = JSON.parse(readFileSync('server_data/admin_state.json', 'utf8'));
  const adminRec = stData.admins.find(a => a.username === 'admin');
  assert.ok(adminRec.password_hash.startsWith('pbkdf2$sha256$600000$'), 'Password hash must use PBKDF2-HMAC-SHA256 with 600,000 rounds');

  // Test that new password logs in
  const newLogin = await request('POST', '/api/auth/login', { username: 'admin', password: 'FinalSecurePass@2027!' });
  assert.strictEqual(newLogin.status, 200);
  assert.strictEqual(newLogin.body.isAdmin, true);
});

// ----------------------------------------------------------------------------
console.log('\n--- Test Group 7: Hash Backward Compatibility & Auto-Upgrade ---');

await it('Supports legacy 10,000-round sha512 hash and auto-upgrades to 600,000-round sha256 on login', async () => {
  // 1. Seed a legacy admin with 10,000 iterations sha512
  const legacySalt = 'abcdef1234567890abcdef1234567890';
  const legacyHex = crypto.pbkdf2Sync('LegacyPassword123!', legacySalt, 10000, 64, 'sha512').toString('hex');
  const legacyHash = `pbkdf2$10000$${legacySalt}$${legacyHex}`;

  const st = JSON.parse(readFileSync('server_data/admin_state.json', 'utf8'));
  st.admins = st.admins.filter(a => a.username !== 'legacy_adm');
  st.admins.push({
    id: 'adm_legacy_test',
    username: 'legacy_adm',
    password_hash: legacyHash,
    full_name: 'Legacy Admin Test',
    email: 'legacy@jackpotlo.com',
    role: 'SUPER_ADMIN',
    is_active: 1
  });
  writeFileSync('server_data/admin_state.json', JSON.stringify(st, null, 2), 'utf8');

  // 2. Log in with legacy credential
  const legLogin = await request('POST', '/api/auth/login', { username: 'legacy_adm', password: 'LegacyPassword123!' });
  assert.strictEqual(legLogin.status, 200, 'Legacy credentials must be accepted');
  assert.strictEqual(legLogin.body.isAdmin, true);

  // 3. Verify that the server automatically upgraded the stored hash to 600,000 rounds sha256
  const updatedSt = JSON.parse(readFileSync('server_data/admin_state.json', 'utf8'));
  const updatedAdmin = updatedSt.admins.find(a => a.username === 'legacy_adm');
  assert.ok(updatedAdmin, 'Legacy admin record must exist');
  assert.ok(updatedAdmin.password_hash.startsWith('pbkdf2$sha256$600000$'), 'Legacy hash must be automatically upgraded to 600,000 rounds sha256');

  // 4. Verify login still works with upgraded hash
  const upgradedLogin = await request('POST', '/api/auth/login', { username: 'legacy_adm', password: 'LegacyPassword123!' });
  assert.strictEqual(upgradedLogin.status, 200, 'Login with upgraded hash must succeed');

  // Clean up test admin
  updatedSt.admins = updatedSt.admins.filter(a => a.username !== 'legacy_adm');
  writeFileSync('server_data/admin_state.json', JSON.stringify(updatedSt, null, 2), 'utf8');
});

await it('CLI management tool creates admin with 600,000-round hash and resets securely', async () => {
  // 1. Create admin via CLI
  execSync('node scripts/manage-admin.cjs create clitest SecCliPass889! "CLI Officer" "cliofficer@jackpotlo.com"');
  let st = JSON.parse(readFileSync('server_data/admin_state.json', 'utf8'));
  let cliAdm = st.admins.find(a => a.username === 'clitest');
  assert.ok(cliAdm, 'Created admin must exist');
  assert.ok(cliAdm.password_hash.startsWith('pbkdf2$sha256$600000$'), 'Created admin hash must be 600,000-round sha256');

  // 2. Log in as created admin
  const res1 = await request('POST', '/api/auth/login', { username: 'clitest', password: 'SecCliPass889!' });
  assert.strictEqual(res1.status, 200);

  // 3. Reset password via CLI
  execSync('node scripts/manage-admin.cjs reset clitest NewCliPass999!');
  st = JSON.parse(readFileSync('server_data/admin_state.json', 'utf8'));
  cliAdm = st.admins.find(a => a.username === 'clitest');
  assert.ok(cliAdm.password_hash.startsWith('pbkdf2$sha256$600000$'), 'Reset hash must be 600,000-round sha256');

  // 4. Old password fails, new password succeeds
  const oldRes = await request('POST', '/api/auth/login', { username: 'clitest', password: 'SecCliPass889!' });
  assert.strictEqual(oldRes.status, 401);

  const newRes = await request('POST', '/api/auth/login', { username: 'clitest', password: 'NewCliPass999!' });
  assert.strictEqual(newRes.status, 200);

  // Clean up
  st.admins = st.admins.filter(a => a.username !== 'clitest');
  writeFileSync('server_data/admin_state.json', JSON.stringify(st, null, 2), 'utf8');
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SECURITY & ADMIN API TESTS PASSED PERFECTLY!\n');
}

