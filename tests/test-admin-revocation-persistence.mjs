// ============================================================================
// LOTTO TRACK PRO — ADMIN LOGOUT REVOCATION PERSISTENCE TESTS
// SCEL Phase 3.3: Durable Admin Logout Revocation Verification
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';

// Prevent server.js from binding to HTTP port during test imports
process.env.NO_SERVER_LISTEN = 'true';

import {
  generateJWT,
  verifyJWT,
  getActiveAdminSessionAsync,
  revokeAdminTokenAsync,
  isTokenRevokedAsync,
  revokedAdminTokens,
  activeAdminSessions
} from '../server.js';

let passed = 0;
let failed = 0;

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

// ----------------------------------------------------------------------------
// Mock Isolated Database Store (Zero mutation to live Aiven database)
// ----------------------------------------------------------------------------
class MockRevocationDb {
  constructor() {
    this.table = new Map(); // jti -> { jti, token_hash, expires_at, revoked_at }
    this.queryLog = [];
  }

  async query(sql, params = []) {
    this.queryLog.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    // SELECT 1 FROM revoked_admin_tokens WHERE jti = ? OR token_hash = ? LIMIT 1
    if (normalized.includes('SELECT 1 FROM revoked_admin_tokens')) {
      const [jti, tokenHash] = params;
      for (const record of this.table.values()) {
        if ((jti && record.jti === jti) || (tokenHash && record.token_hash === tokenHash)) {
          return [[{ 1: 1 }]];
        }
      }
      return [[]];
    }

    // INSERT INTO revoked_admin_tokens ...
    if (normalized.includes('INSERT INTO revoked_admin_tokens')) {
      const [jti, tokenHash, expSeconds] = params;
      const expiresAt = new Date(expSeconds * 1000);
      this.table.set(jti, {
        jti,
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked_at: new Date()
      });
      return [{ affectedRows: 1 }];
    }

    // DELETE FROM revoked_admin_tokens WHERE expires_at < (NOW() - INTERVAL 1 HOUR)
    if (normalized.includes('DELETE FROM revoked_admin_tokens')) {
      const isOneHourBuffered = normalized.includes('INTERVAL 1 HOUR');
      const cutoff = isOneHourBuffered ? new Date(Date.now() - 3600 * 1000) : new Date();
      let deleted = 0;
      for (const [key, record] of this.table.entries()) {
        if (record.expires_at < cutoff) {
          this.table.delete(key);
          deleted++;
        }
      }
      return [{ affectedRows: deleted }];
    }

    return [[]];
  }
}

console.log('\n====================================================');
console.log('   SCEL PHASE 3.3: DURABLE ADMIN REVOCATION TESTS   ');
console.log('====================================================\n');

const mockDb = new MockRevocationDb();

// ----------------------------------------------------------------------------
// Test 1: A valid admin token works before logout
// ----------------------------------------------------------------------------
console.log('--- Test 1: Valid Admin Token Verification ---');
let adminToken = null;
let adminJti = null;

await it('1. Valid admin token works before logout and contains valid jti session identifier', async () => {
  adminToken = generateJWT({
    username: 'superadmin',
    role: 'SUPER_ADMIN',
    isAdmin: true,
    fullName: 'Platform Super Administrator',
    email: 'admin@jackpotlo.com'
  }, 3600);

  const payload = verifyJWT(adminToken);
  assert.ok(payload, 'JWT must cryptographically verify');
  assert.ok(payload.jti, 'JWT must contain a valid session identifier (jti)');
  assert.strictEqual(payload.role, 'SUPER_ADMIN');
  adminJti = payload.jti;

  const session = await getActiveAdminSessionAsync(adminToken, mockDb);
  assert.ok(session, 'Valid token must be accepted as active admin session');
  assert.strictEqual(session.username, 'superadmin');
  assert.strictEqual(session.role, 'SUPER_ADMIN');
  assert.strictEqual(session.jti, adminJti);
});

// ----------------------------------------------------------------------------
// Test 2: Logout revokes the token and persists to database
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Logout Revocation Persistence ---');

await it('2. Logout revokes the token and durably persists jti, token_hash, and expires_at to database', async () => {
  const tokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');

  await revokeAdminTokenAsync(adminToken, mockDb);

  // Verify memory L1 cache updated
  assert.ok(revokedAdminTokens.has(adminToken), 'Token must be added to memory revoked set');
  assert.ok(revokedAdminTokens.has(adminJti), 'jti must be added to memory revoked set');
  assert.strictEqual(activeAdminSessions.has(adminToken), false, 'Token must be removed from active session map');

  // Verify database L2 storage updated
  assert.strictEqual(mockDb.table.size, 1, 'Database table must contain exactly 1 revocation record');
  const dbRecord = mockDb.table.get(adminJti);
  assert.ok(dbRecord, 'Database record must be keyed by jti');
  assert.strictEqual(dbRecord.token_hash, tokenHash, 'Database record must store exact token SHA-256 hash');
  assert.ok(dbRecord.expires_at instanceof Date, 'Database record must store expiration date');
});

// ----------------------------------------------------------------------------
// Test 3: The same token is rejected after logout
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: Rejection After Logout ---');

await it('3. The same token is rejected after logout', async () => {
  const sessionAfterLogout = await getActiveAdminSessionAsync(adminToken, mockDb);
  assert.strictEqual(sessionAfterLogout, null, 'Revoked admin token must return null (denied)');

  const isRevoked = await isTokenRevokedAsync(adminToken, mockDb);
  assert.strictEqual(isRevoked, true, 'isTokenRevokedAsync must return true for revoked token');
});

// ----------------------------------------------------------------------------
// Test 4: Simulated server restart does not restore the logged-out token
// ----------------------------------------------------------------------------
console.log('\n--- Test 4: Server Restart Survival ---');

await it('4. A simulated server restart (cold reboot) does not restore the logged-out token', async () => {
  // Wipe all in-memory caches to simulate server restart / container reboot
  revokedAdminTokens.clear();
  activeAdminSessions.clear();

  assert.strictEqual(revokedAdminTokens.size, 0, 'In-memory revoked set must be empty after restart');
  assert.strictEqual(activeAdminSessions.size, 0, 'In-memory active session map must be empty after restart');

  // Request admin session using the previously logged-out token
  const sessionAfterRestart = await getActiveAdminSessionAsync(adminToken, mockDb);
  assert.strictEqual(sessionAfterRestart, null, 'Logged-out token must STILL be rejected after simulated server restart');

  const isRevoked = await isTokenRevokedAsync(adminToken, mockDb);
  assert.strictEqual(isRevoked, true, 'isTokenRevokedAsync must query database and confirm token is revoked');

  // Verify L1 cache was automatically repopulated from DB
  assert.ok(revokedAdminTokens.has(adminToken), 'L1 cache must be repopulated after DB hit');
});

// ----------------------------------------------------------------------------
// Test 5: A newly authenticated admin token works
// ----------------------------------------------------------------------------
console.log('\n--- Test 5: Fresh Login Token Works ---');

await it('5. A newly authenticated admin token works while the previous token remains revoked', async () => {
  const freshAdminToken = generateJWT({
    username: 'superadmin',
    role: 'SUPER_ADMIN',
    isAdmin: true,
    fullName: 'Platform Super Administrator'
  }, 3600);

  const freshPayload = verifyJWT(freshAdminToken);
  assert.notStrictEqual(freshPayload.jti, adminJti, 'Fresh token must have unique jti session identifier');

  // Fresh token must be accepted
  const freshSession = await getActiveAdminSessionAsync(freshAdminToken, mockDb);
  assert.ok(freshSession, 'Fresh admin token must be accepted');
  assert.strictEqual(freshSession.username, 'superadmin');
  assert.strictEqual(freshSession.jti, freshPayload.jti);

  // Old logged-out token must still be rejected
  const oldSession = await getActiveAdminSessionAsync(adminToken, mockDb);
  assert.strictEqual(oldSession, null, 'Original logged-out token must still be rejected');
});

// ----------------------------------------------------------------------------
// Test 6: Forged tokens remain rejected
// ----------------------------------------------------------------------------
console.log('\n--- Test 6: Forged Tokens Rejected ---');

await it('6.1: Forged token with tampered signature is rejected', async () => {
  const tamperedToken = adminToken.slice(0, -6) + 'abcdef';
  const session = await getActiveAdminSessionAsync(tamperedToken, mockDb);
  assert.strictEqual(session, null, 'Tampered token must be rejected');
});

await it('6.2: Forged token missing jti is rejected', async () => {
  // Construct a token signed with the key but without jti
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    username: 'hacker',
    role: 'SUPER_ADMIN',
    isAdmin: true,
    exp: Math.floor(Date.now() / 1000) + 3600
    // Notice: NO jti!
  })).toString('base64url');
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'lotto_pos_secure_jwt_secret_key_2026')
    .update(data).digest('base64url');
  const tokenNoJti = `${data}.${sig}`;

  const session = await getActiveAdminSessionAsync(tokenNoJti, mockDb);
  assert.strictEqual(session, null, 'Admin token without jti must be rejected');
});

await it('6.3: Arbitrary string token is rejected', async () => {
  const session = await getActiveAdminSessionAsync('adm_random_fake_token_123', mockDb);
  assert.strictEqual(session, null, 'Arbitrary fake token must be rejected');
});

// ----------------------------------------------------------------------------
// Test 7: Ordinary store users remain denied
// ----------------------------------------------------------------------------
console.log('\n--- Test 7: Ordinary Store Users Denied Admin Access ---');

await it('7. Ordinary store users with valid tokens are denied admin session privileges', async () => {
  const storeUserToken = generateJWT({
    username: 'store_clerk_1',
    role: 'STORE_USER',
    isAdmin: false,
    storeId: 'store_amigo'
  }, 3600);

  const session = await getActiveAdminSessionAsync(storeUserToken, mockDb);
  assert.strictEqual(session, null, 'Store user token must return null for admin role check');
});

// ----------------------------------------------------------------------------
// Test 8: Fail-closed behavior on database error
// ----------------------------------------------------------------------------
console.log('\n--- Test 8: Fail-Closed Protection ---');

await it('8. Database failure fails closed and denies access rather than accepting unverified token', async () => {
  const failingDb = {
    async query() {
      throw new Error('ECONNREFUSED: Database connection dropped during audit check');
    }
  };

  const testToken = generateJWT({ username: 'superadmin', role: 'SUPER_ADMIN', isAdmin: true }, 3600);

  // Clear memory cache so it must query DB
  revokedAdminTokens.clear();
  activeAdminSessions.clear();

  const isRevoked = await isTokenRevokedAsync(testToken, failingDb);
  assert.strictEqual(isRevoked, true, 'Must treat token as revoked when revocation DB check fails (fail closed)');

  const session = await getActiveAdminSessionAsync(testToken, failingDb);
  assert.strictEqual(session, null, 'Must deny access when database fails (fail closed)');
});

// ----------------------------------------------------------------------------
// Test 9: Expired revocation records cleanup
// ----------------------------------------------------------------------------
console.log('\n--- Test 9: Expired Records Cleanup ---');

await it('9. Expired revocation records are cleaned up so table does not grow indefinitely', async () => {
  // Insert an expired record from 2 hours ago
  const pastTime = new Date(Date.now() - 7200 * 1000);
  mockDb.table.set('expired_jti_123', {
    jti: 'expired_jti_123',
    token_hash: 'hash123',
    expires_at: pastTime,
    revoked_at: new Date(Date.now() - 86400 * 1000)
  });

  assert.ok(mockDb.table.has('expired_jti_123'), 'Expired record should be in mock DB initially');

  // Revoking a token triggers cleanup query: DELETE FROM revoked_admin_tokens WHERE expires_at < NOW()
  const tempToken = generateJWT({ username: 'superadmin', role: 'SUPER_ADMIN', isAdmin: true }, 3600);
  await revokeAdminTokenAsync(tempToken, mockDb);

  assert.strictEqual(mockDb.table.has('expired_jti_123'), false, 'Expired record must be automatically cleaned up');
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PERSISTENT REVOCATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
