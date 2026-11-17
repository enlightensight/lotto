// ============================================================================
// LOTTO TRACK PRO — JURISDICTION SQL PERSISTENCE MOCK TESTS
// SCEL Phase 3.3: SQL Persistence Verification via Mocked Database Layer
// ============================================================================

import assert from 'assert';

// Prevent server.js from binding to HTTP port during test imports
process.env.NO_SERVER_LISTEN = 'true';

import { persistStoreComplianceToMySQL } from '../server.js';

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
// Mock Database Layer (Captures SQL queries and parameters without live database)
// ----------------------------------------------------------------------------
class MockSqlDb {
  constructor() {
    this.calls = [];
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    return [{ affectedRows: 1 }];
  }

  get lastCall() {
    return this.calls[this.calls.length - 1];
  }

  reset() {
    this.calls = [];
  }
}

console.log('\n====================================================');
console.log('   SCEL PHASE 3.3: JURISDICTION SQL MOCK TESTS      ');
console.log('====================================================\n');

const mockDb = new MockSqlDb();

// ----------------------------------------------------------------------------
// Test Group 1: SQL Structure and Parameter Count Matching
// ----------------------------------------------------------------------------
console.log('--- Test Group 1: SQL Placeholder & Parameter Counts ---');

await it('1.1: Placeholder count (?) in SQL query matches exact parameter count (34 = 34)', async () => {
  mockDb.reset();
  const sampleStore = {
    storeId: 'store_test_01',
    storeName: 'Test Store',
    lotteryJurisdiction: 'GA'
  };

  await persistStoreComplianceToMySQL(sampleStore, mockDb);
  assert.strictEqual(mockDb.calls.length, 1, 'Must execute exactly 1 SQL query');

  const { sql, params } = mockDb.lastCall;

  // Count total question mark placeholders in SQL query
  const totalPlaceholders = (sql.match(/\?/g) || []).length;
  assert.strictEqual(params.length, 34, `Expected 34 parameters in array, got ${params.length}`);
  assert.strictEqual(totalPlaceholders, 34, `Expected 34 placeholders in SQL, got ${totalPlaceholders}`);
  assert.strictEqual(totalPlaceholders, params.length, 'Total placeholders must exactly match parameter array length');
});

await it('1.2: SQL uses COALESCE(?, lottery_jurisdiction) to preserve existing jurisdiction on DUPLICATE KEY UPDATE', async () => {
  mockDb.reset();
  const sampleStore = {
    storeId: 'store_test_02',
    storeName: 'Test Store'
  };

  await persistStoreComplianceToMySQL(sampleStore, mockDb);
  const { sql } = mockDb.lastCall;

  assert.ok(
    sql.includes('lottery_jurisdiction = COALESCE(?, lottery_jurisdiction)'),
    'SQL must contain "lottery_jurisdiction = COALESCE(?, lottery_jurisdiction)"'
  );
});

// ----------------------------------------------------------------------------
// Test Group 2: New Store with Omitted Jurisdiction
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 2: New Store Default GA Behavior ---');

await it('2.1: Actual INSERT parameter contains "GA" for a new store with omitted jurisdiction', async () => {
  mockDb.reset();
  const newStore = {
    storeId: 'store_new_99',
    storeName: 'Fresh Georgia Store'
    // lotteryJurisdiction omitted
  };

  await persistStoreComplianceToMySQL(newStore, mockDb);
  const { params } = mockDb.lastCall;

  // Index 32 is insertJurisdiction (the 33rd parameter in VALUES)
  const insertParam = params[32];
  assert.strictEqual(insertParam, 'GA', 'INSERT parameter must default to GA when omitted');
});

await it('2.2: Duplicate-update parameter is NULL when jurisdiction is omitted (prevents overwrite)', async () => {
  mockDb.reset();
  const storeWithOmitted = {
    storeId: 'store_sc_existing',
    storeName: 'Existing South Carolina Mart'
    // lotteryJurisdiction is undefined / omitted
  };

  await persistStoreComplianceToMySQL(storeWithOmitted, mockDb);
  const { params } = mockDb.lastCall;

  // Index 33 is updateJurisdiction (the 34th parameter in ON DUPLICATE KEY UPDATE COALESCE(?, lottery_jurisdiction))
  const updateParam = params[33];
  assert.strictEqual(updateParam, null, 'UPDATE parameter must be NULL when omitted so COALESCE preserves DB value');
});

// ----------------------------------------------------------------------------
// Test Group 3: Explicit SC and GA Updates Passed Correctly
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 3: Explicit SC and GA Handling ---');

await it('3.1: Explicit SC jurisdiction passes "SC" for both INSERT and UPDATE parameters', async () => {
  mockDb.reset();
  const scStore = {
    storeId: 'store_sc_101',
    storeName: 'Carolina Lottery Mart',
    lotteryJurisdiction: 'SC'
  };

  await persistStoreComplianceToMySQL(scStore, mockDb);
  const { params } = mockDb.lastCall;

  assert.strictEqual(params[32], 'SC', 'INSERT parameter must be SC');
  assert.strictEqual(params[33], 'SC', 'UPDATE parameter must be SC');
});

await it('3.2: Explicit GA jurisdiction passes "GA" for both INSERT and UPDATE parameters', async () => {
  mockDb.reset();
  const gaStore = {
    storeId: 'store_ga_102',
    storeName: 'Georgia Lottery Mart',
    lotteryJurisdiction: 'GA'
  };

  await persistStoreComplianceToMySQL(gaStore, mockDb);
  const { params } = mockDb.lastCall;

  assert.strictEqual(params[32], 'GA', 'INSERT parameter must be GA');
  assert.strictEqual(params[33], 'GA', 'UPDATE parameter must be GA');
});

await it('3.3: Case-insensitive "sc", "ga", and "SCEL" alias resolve to canonical values in SQL parameters', async () => {
  mockDb.reset();
  await persistStoreComplianceToMySQL({ storeId: 's1', storeName: 'S1', lotteryJurisdiction: 'sc' }, mockDb);
  assert.strictEqual(mockDb.lastCall.params[33], 'SC', '"sc" must resolve to SC in UPDATE param');

  mockDb.reset();
  await persistStoreComplianceToMySQL({ storeId: 's2', storeName: 'S2', lotteryJurisdiction: 'ga' }, mockDb);
  assert.strictEqual(mockDb.lastCall.params[33], 'GA', '"ga" must resolve to GA in UPDATE param');

  mockDb.reset();
  await persistStoreComplianceToMySQL({ storeId: 's3', storeName: 'S3', lotteryJurisdiction: 'SCEL' }, mockDb);
  assert.strictEqual(mockDb.lastCall.params[33], 'SC', '"SCEL" must resolve to SC in UPDATE param');
});

// ----------------------------------------------------------------------------
// Test Group 4: Invalid Input Safety (Cannot Overwrite Existing Valid Jurisdiction)
// ----------------------------------------------------------------------------
console.log('\n--- Test Group 4: Invalid Input Protection ---');

const invalidCases = [
  { desc: 'Unsupported state code "TX"', val: 'TX' },
  { desc: 'Unsupported state code "FL"', val: 'FL' },
  { desc: 'Unsupported state code "NC"', val: 'NC' },
  { desc: 'Empty string ""', val: '' },
  { desc: 'Whitespace string "   "', val: '   ' },
  { desc: 'Null value', val: null },
  { desc: 'Numeric value 123', val: 123 },
  { desc: 'Object { state: "SC" }', val: { state: 'SC' } },
  { desc: 'Array ["GA"]', val: ['GA'] },
  { desc: 'Boolean true', val: true }
];

for (const tc of invalidCases) {
  await it(`4.${invalidCases.indexOf(tc) + 1}: Invalid input [${tc.desc}] sets update parameter to NULL (protects SC)`, async () => {
    mockDb.reset();
    const badStore = {
      storeId: 'store_edge_case',
      storeName: 'Edge Case Store',
      lotteryJurisdiction: tc.val
    };

    await persistStoreComplianceToMySQL(badStore, mockDb);
    const { params } = mockDb.lastCall;

    assert.strictEqual(
      params[33],
      null,
      `Invalid input ${tc.desc} must set UPDATE parameter to null, never GA`
    );
  });
}

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL JURISDICTION SQL MOCK TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
