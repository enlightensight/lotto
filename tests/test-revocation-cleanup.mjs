// ============================================================================
// LOTTO TRACK PRO — REVOCATION RECORD CLEANUP TESTS
// SCEL Phase 3.5: Safe Revocation Record Cleanup with Clock-Skew Buffer
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';

process.env.NO_SERVER_LISTEN = 'true';

import {
  generateJWT,
  verifyJWT,
  getActiveAdminSessionAsync,
  revokeAdminTokenAsync,
  isTokenRevokedAsync,
  cleanExpiredRevokedTokensAsync,
  migrateCleanData,
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
// Mock Isolated Database Store with Clock-Skew Aware Query Simulation
// ----------------------------------------------------------------------------
class MockRevocationDb {
  constructor() {
    this.table = new Map(); // jti -> { jti, token_hash, expires_at, revoked_at }
    this.queries = [];
    this.failDelete = false;
    this.failInsert = false;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (this.failDelete && normalized.includes('DELETE FROM revoked_admin_tokens')) {
      throw new Error('Lock wait timeout exceeded on cleanup query');
    }

    if (this.failInsert && normalized.includes('INSERT INTO revoked_admin_tokens')) {
      throw new Error('Connection lost during INSERT');
    }

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
      // If 1-hour buffer is used, cutoff is 1 hour in the past (3600s ago)
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

  reset() {
    this.table.clear();
    this.queries = [];
    this.failDelete = false;
    this.failInsert = false;
  }
}

console.log('\n====================================================');
console.log('   SCEL PHASE 3.5: REVOCATION CLEANUP TESTS        ');
console.log('====================================================\n');

const mockDb = new MockRevocationDb();

// ----------------------------------------------------------------------------
// Test 1: Records expired more than one hour ago are eligible for deletion
// ----------------------------------------------------------------------------
console.log('--- Test 1: Deletion of Stale Records (> 1 Hour Expired) ---');

await it('1. Records expired more than one hour ago are deleted during cleanup', async () => {
  mockDb.reset();

  // Expired 90 minutes ago (more than 1 hour)
  const staleExpiry = new Date(Date.now() - 90 * 60 * 1000);
  mockDb.table.set('stale_jti_01', {
    jti: 'stale_jti_01',
    token_hash: 'hash_stale_01',
    expires_at: staleExpiry,
    revoked_at: new Date(Date.now() - 100 * 60 * 1000)
  });

  assert.ok(mockDb.table.has('stale_jti_01'), 'Stale record must exist before cleanup');

  await cleanExpiredRevokedTokensAsync(mockDb);

  assert.strictEqual(mockDb.table.has('stale_jti_01'), false, 'Stale record expired > 1 hour ago must be deleted');

  // Verify query string contains (NOW() - INTERVAL 1 HOUR)
  const lastDelete = mockDb.queries.find(q => q.sql.includes('DELETE FROM revoked_admin_tokens'));
  assert.ok(lastDelete, 'A DELETE query must have been issued');
  assert.ok(
    lastDelete.sql.includes('expires_at < (NOW() - INTERVAL 1 HOUR)'),
    'Cleanup query must use "expires_at < (NOW() - INTERVAL 1 HOUR)"'
  );
});

// ----------------------------------------------------------------------------
// Test 2: Records expired less than one hour ago are retained (clock-skew safety)
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Retention of Recently Expired Records (< 1 Hour) ---');

await it('2. Records expired less than one hour ago are retained to protect against clock skew', async () => {
  mockDb.reset();

  // Expired 15 minutes ago (less than 1 hour ago)
  const recentExpiry = new Date(Date.now() - 15 * 60 * 1000);
  mockDb.table.set('recent_jti_02', {
    jti: 'recent_jti_02',
    token_hash: 'hash_recent_02',
    expires_at: recentExpiry,
    revoked_at: new Date(Date.now() - 30 * 60 * 1000)
  });

  // Future token (expires in 2 hours)
  const futureExpiry = new Date(Date.now() + 2 * 3600 * 1000);
  mockDb.table.set('future_jti_03', {
    jti: 'future_jti_03',
    token_hash: 'hash_future_03',
    expires_at: futureExpiry,
    revoked_at: new Date()
  });

  assert.strictEqual(mockDb.table.size, 2, 'Should have 2 records in mock DB initially');

  // Trigger cleanup
  await cleanExpiredRevokedTokensAsync(mockDb);

  // Both must be safely retained!
  assert.ok(
    mockDb.table.has('recent_jti_02'),
    'Record expired only 15 minutes ago must be RETAINED to protect against clock skew'
  );
  assert.ok(
    mockDb.table.has('future_jti_03'),
    'Active revoked record must be RETAINED'
  );
  assert.strictEqual(mockDb.table.size, 2, 'No records should have been deleted');
});

// ----------------------------------------------------------------------------
// Test 3: Startup cleanup occurs only after the revocation table exists
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: Startup Cleanup Ordering ---');

await it('3. Startup cleanup occurs strictly after revoked_admin_tokens table exists', async () => {
  const startupQueries = [];
  const mockStartupDb = {
    async query(sql) {
      startupQueries.push(sql);
      return [[]];
    }
  };

  // Run startup migration runner
  await migrateCleanData(mockStartupDb);

  const tableCreateIdx = startupQueries.findIndex(sql =>
    sql.includes('CREATE TABLE IF NOT EXISTS `revoked_admin_tokens`')
  );
  const cleanupIdx = startupQueries.findIndex(sql =>
    sql.includes('DELETE FROM revoked_admin_tokens WHERE expires_at < (NOW() - INTERVAL 1 HOUR)')
  );

  assert.ok(tableCreateIdx >= 0, 'Must create revoked_admin_tokens table on startup');
  assert.ok(cleanupIdx >= 0, 'Must execute 1-hour buffered cleanup query on startup');
  assert.ok(
    tableCreateIdx < cleanupIdx,
    `Table creation (index ${tableCreateIdx}) must precede cleanup (index ${cleanupIdx})`
  );
});

// ----------------------------------------------------------------------------
// Test 4: Cleanup failure does not disable token-revocation verification
// ----------------------------------------------------------------------------
console.log('\n--- Test 4: Resilience to Cleanup Failures ---');

await it('4. Cleanup failure does not disable token-revocation verification', async () => {
  mockDb.reset();
  mockDb.failDelete = true; // Simulate DB transient failure on DELETE query

  const adminToken = generateJWT({
    username: 'admin',
    role: 'SUPER_ADMIN',
    isAdmin: true
  }, 3600);
  const payload = verifyJWT(adminToken);

  // Revoking the token triggers cleanup; cleanup will throw internally but revokeAdminTokenAsync catches it
  await revokeAdminTokenAsync(adminToken, mockDb);

  // Verification must still query DB and report revoked!
  revokedAdminTokens.clear();
  activeAdminSessions.clear();

  const isRevoked = await isTokenRevokedAsync(adminToken, mockDb);
  assert.strictEqual(isRevoked, true, 'Token must still be recognized as revoked even when cleanup query failed');

  const session = await getActiveAdminSessionAsync(adminToken, mockDb);
  assert.strictEqual(session, null, 'Revoked token must still be denied even when cleanup query failed');
});

// ----------------------------------------------------------------------------
// Test 5: Successful logout still persists revocation before returning success
// ----------------------------------------------------------------------------
console.log('\n--- Test 5: Logout Persistence Guarantee ---');

await it('5.1: Successful logout persists revocation record to DB before completing', async () => {
  mockDb.reset();

  const adminToken = generateJWT({
    username: 'admin_audit',
    role: 'SUPER_ADMIN',
    isAdmin: true
  }, 3600);
  const payload = verifyJWT(adminToken);
  const tokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');

  await revokeAdminTokenAsync(adminToken, mockDb);

  // Ensure record is present in DB
  const dbRecord = mockDb.table.get(payload.jti);
  assert.ok(dbRecord, 'Revocation record must exist in DB');
  assert.strictEqual(dbRecord.token_hash, tokenHash);
});

await it('5.2: If database INSERT fails during logout, revocation throws so endpoint fails closed', async () => {
  mockDb.reset();
  mockDb.failInsert = true; // Simulate DB failure on INSERT

  const adminToken = generateJWT({
    username: 'admin_fail',
    role: 'SUPER_ADMIN',
    isAdmin: true
  }, 3600);

  let threw = false;
  try {
    await revokeAdminTokenAsync(adminToken, mockDb);
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('Connection lost during INSERT'));
  }

  assert.strictEqual(threw, true, 'revokeAdminTokenAsync must throw if DB INSERT fails, allowing endpoint to return HTTP 500');
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL REVOCATION CLEANUP TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
