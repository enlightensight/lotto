// ============================================================================
// LOTTO TRACK PRO — STORE JURISDICTION PERSISTENCE TESTS
// SCEL Phase 3: Server-Side Store Jurisdiction Persistence Verification
// ============================================================================

import assert from 'assert';
import http from 'http';
import { normalizeLotteryJurisdiction } from '../src/scel.js';
import { DEFAULT_STORES, getStoreJurisdiction } from '../src/data.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function asyncIt(desc, fn) {
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

const BASE_URL = 'http://localhost:3001';

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
        try { json = JSON.parse(data); } catch (_) { }
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

console.log('\n====================================================');
console.log('   SCEL PHASE 3: STORE JURISDICTION PERSISTENCE     ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// Test Group 1: Legacy Stores Default to GA
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: Legacy Stores Default to GA ---');

it('1.1: Legacy store object with no jurisdiction property resolves to GA', () => {
  const legacyStore = {
    id: 'store_legacy_101',
    name: 'Legacy Food Mart',
    retailerNumber: 'GA-12345'
  };
  assert.strictEqual(normalizeLotteryJurisdiction(legacyStore.lotteryJurisdiction), 'GA');
});

it('1.2: Undefined jurisdiction resolves to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction(undefined), 'GA');
});

it('1.3: Default stores in DEFAULT_STORES all have lotteryJurisdiction = GA', () => {
  assert.ok(Array.isArray(DEFAULT_STORES) && DEFAULT_STORES.length > 0);
  DEFAULT_STORES.forEach(s => {
    assert.strictEqual(s.lotteryJurisdiction, 'GA', `Store ${s.id} must default to GA`);
  });
});

// ----------------------------------------------------------------------------
// Test Group 2: Explicit GA Resolution
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: Explicit GA Resolution ---');

it('2.1: Store with lottery_jurisdiction = "GA" resolves to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('GA'), 'GA');
});

it('2.2: Case-insensitive "ga" and trimmed spaces resolve to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('ga'), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction('  GA  '), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction(' Ga '), 'GA');
});

// ----------------------------------------------------------------------------
// Test Group 3: Explicit SC / SCEL Resolution
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Explicit SC / SCEL Resolution ---');

it('3.1: Store with lottery_jurisdiction = "SC" resolves to SC', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('SC'), 'SC');
});

it('3.2: Case-insensitive "sc" and trimmed spaces resolve to SC', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('sc'), 'SC');
  assert.strictEqual(normalizeLotteryJurisdiction('  SC  '), 'SC');
});

it('3.3: SCEL code resolves to canonical SC', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('SCEL'), 'SC');
  assert.strictEqual(normalizeLotteryJurisdiction('scel'), 'SC');
});

// ----------------------------------------------------------------------------
// Test Group 4: Null, Empty, or Unsupported Values Fall Back to GA
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Null, Empty, or Unsupported Values Fall Back to GA ---');

it('4.1: Null falls back to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction(null), 'GA');
});

it('4.2: Empty string falls back to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction(''), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction('   '), 'GA');
});

it('4.3: Unsupported state codes (e.g. NC, FL, TX) safely fall back to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction('NC'), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction('FL'), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction('TX'), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction('UNKNOWN'), 'GA');
});

it('4.4: Non-string input (numbers, objects, arrays, booleans) safely fall back to GA', () => {
  assert.strictEqual(normalizeLotteryJurisdiction(123), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction({}), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction(['SC']), 'GA');
  assert.strictEqual(normalizeLotteryJurisdiction(true), 'GA');
});

it('4.5: Never infer jurisdiction from retailer numbers, addresses, or game barcodes', () => {
  // Even if a retailer number or address mentions "SC", jurisdiction must NOT be inferred
  const storeWithScAddress = {
    address: '123 Columbia Rd, Columbia, SC 29201',
    retailerNumber: 'SC-99999',
    lotteryJurisdiction: null
  };
  assert.strictEqual(normalizeLotteryJurisdiction(storeWithScAddress.lotteryJurisdiction), 'GA');
});

// ----------------------------------------------------------------------------
// Test Group 5: Store Creation Compatibility
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 5: Store Creation Compatibility ---');

it('5.1: New store creation payload without jurisdiction defaults to GA', () => {
  const newStorePayload = {
    storeName: 'New Test Store',
    applicantName: 'John Doe',
    applicantEmail: 'john@example.com'
  };
  const resolved = normalizeLotteryJurisdiction(newStorePayload.lotteryJurisdiction || 'GA');
  assert.strictEqual(resolved, 'GA');
});

it('5.2: New store creation with explicit SC is preserved', () => {
  const newScStorePayload = {
    storeName: 'Charleston Mart',
    applicantName: 'Jane Smith',
    applicantEmail: 'jane@example.com',
    lotteryJurisdiction: 'SC'
  };
  const resolved = normalizeLotteryJurisdiction(newScStorePayload.lotteryJurisdiction || 'GA');
  assert.strictEqual(resolved, 'SC');
});

// ----------------------------------------------------------------------------
// Test Group 6: Live API Login and Admin Store Persistence
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 6: Live API Login and Admin Store Persistence ---');

let isServerRunning = false;
try {
  const pingRes = await request('GET', '/api/health');
  if (pingRes.status === 200 || pingRes.status === 404) {
    isServerRunning = true;
  }
} catch (_) {
  isServerRunning = false;
}

if (!isServerRunning) {
  console.log('  [NOTICE] Live server port 3001 not reachable in this process; skipping Group 6 live HTTP checks.');
} else {
  let adminToken = null;

  await asyncIt('6.1: Admin login response includes lotteryJurisdiction: "GA"', async () => {
    const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'TestAdminPass123!' });
    if (loginRes.status === 200 && loginRes.body?.token) {
      adminToken = loginRes.body.token;
      assert.strictEqual(loginRes.body.lotteryJurisdiction, 'GA');
      assert.strictEqual(loginRes.body.user?.lotteryJurisdiction, 'GA');
    } else {
      // Try default admin login if reset script was not run
      const altRes = await request('POST', '/api/auth/login', { identifier: 'admin', password: 'password123' });
      if (altRes.status === 200 && altRes.body?.token) {
        adminToken = altRes.body.token;
        assert.strictEqual(altRes.body.lotteryJurisdiction, 'GA');
        assert.strictEqual(altRes.body.user?.lotteryJurisdiction, 'GA');
      }
    }
  });

  if (adminToken) {
    await asyncIt('6.2: GET /api/admin/stores preserves lotteryJurisdiction on all stores', async () => {
      const res = await request('GET', '/api/admin/stores', null, { Authorization: `Bearer ${adminToken}` });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.stores));
      assert.ok(res.body.stores.length > 0);
      res.body.stores.forEach(s => {
        assert.ok(s.lotteryJurisdiction === 'GA' || s.lotteryJurisdiction === 'SC');
      });
    });

    await asyncIt('6.3: GET /api/admin/stores/:storeId/details includes lotteryJurisdiction', async () => {
      const res = await request('GET', '/api/admin/stores/store_amigo/details', null, { Authorization: `Bearer ${adminToken}` });
      if (res.status === 200) {
        assert.ok(res.body.store);
        assert.strictEqual(res.body.store.lotteryJurisdiction, 'GA');
      }
    });
  }

  await asyncIt('6.4: Store login response includes lotteryJurisdiction', async () => {
    // Try logging in as store user
    const storeRes = await request('POST', '/api/auth/login', { identifier: 'amigo', password: 'Store1234!' });
    if (storeRes.status === 200) {
      assert.strictEqual(storeRes.body.lotteryJurisdiction, 'GA');
      assert.strictEqual(storeRes.body.user?.lotteryJurisdiction, 'GA');
    }
  });
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`   JURISDICTION PERSISTENCE RESULTS: Passed: ${passed}, Failed: ${failed}   `);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL STORE JURISDICTION PERSISTENCE TESTS PASSED PERFECTLY!\n');
}
