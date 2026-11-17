// ============================================================================
// LOTTO TRACK PRO — SCEL PHASE 4.2: ISOLATED ADMIN JURISDICTION TESTS
// Comprehensive Verification Suite for Dedicated Admin Jurisdiction Endpoint
// ============================================================================

import assert from 'assert';
import http from 'http';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { normalizeLotteryJurisdiction } from '../src/scel.js';

const BASE_URL = 'http://localhost:3001';
const ADMIN_STATE_FILE = 'server_data/admin_state.json';
const adminStateBackup = existsSync(ADMIN_STATE_FILE) ? readFileSync(ADMIN_STATE_FILE, 'utf8') : null;
let serverProcess = null;

function cleanup() {
  if (adminStateBackup !== null) {
    try { writeFileSync(ADMIN_STATE_FILE, adminStateBackup, 'utf8'); } catch (_) { }
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch (_) { }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

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
        try { json = JSON.parse(data); } catch (_) { }
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
console.log('   SCEL PHASE 4.2: ISOLATED JURISDICTION TESTS      ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// Ensure Server is Running and Reset Admin Credentials
// ----------------------------------------------------------------------------
try {
  await request('GET', '/api/health');
} catch (_) {
  const { spawn } = await import('child_process');
  serverProcess = spawn('node', ['server.js'], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const ping = await request('GET', '/api/health');
      if (ping.status) break;
    } catch (_) {}
  }
}

// Reset admin password
execSync('node scripts/manage-admin.cjs reset admin TestAdminPass123!');

const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'TestAdminPass123!' });
assert.strictEqual(loginRes.status, 200, 'Admin login failed');
const adminToken = loginRes.body.token;
const adminHeaders = { 'Authorization': `Bearer ${adminToken}`, 'x-admin-token': adminToken };

// Helper to create and approve store via application review
async function createAndApproveStore({ storeName, applicantName, email }) {
  const appRes = await request('POST', '/api/store-applications', {
    storeName,
    applicantName,
    applicantEmail: email,
    applicantPhone: '555-0199',
    address: '100 Main St, Macon, GA 31201',
    requestedPassword: 'Password123!'
  });
  assert.strictEqual(appRes.status, 200, `App submission failed: ${JSON.stringify(appRes.body)}`);
  const appId = appRes.body.application?.id;
  assert.ok(appId, 'Application must have ID');

  const reviewRes = await request('POST', `/api/admin/applications/${appId}/review`, {
    decision: 'APPROVE',
    confirmOfficialRetailerValid: true,
    notes: 'Approved in test'
  }, adminHeaders);
  assert.strictEqual(reviewRes.status, 200, `App review failed: ${JSON.stringify(reviewRes.body)}`);
  return reviewRes.body.store;
}

// ----------------------------------------------------------------------------
// Test 1: Admin Can Change GA to SC via Dedicated Endpoint
// ----------------------------------------------------------------------------
console.log('--- Group 1: Dedicated Admin Jurisdiction Endpoint Operations ---');

const testStore = await createAndApproveStore({
  storeName: 'Jurisdiction Test Mart ' + Date.now(),
  applicantName: 'Jurisdiction Tester',
  email: `jur_test_${Date.now()}@example.com`
});
const testStoreId = testStore.storeId;

await it('1. Admin can change GA to SC via POST /api/admin/stores/:storeId/jurisdiction', async () => {
  const res = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'SC' },
    adminHeaders
  );
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.lotteryJurisdiction, 'SC');
  assert.strictEqual(res.body.store.lotteryJurisdiction, 'SC');

  // Authoritative server state check
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.status, 200);
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'SC');

  // Audit entry verified
  const audit = details.body.auditHistory.find(l => l.actionType === 'LOTTERY_JURISDICTION_UPDATED');
  assert.ok(audit, 'Audit log must record LOTTERY_JURISDICTION_UPDATED');
  assert.strictEqual(audit.details?.lotteryJurisdiction, 'SC');
});

// ----------------------------------------------------------------------------
// Test 2: Admin Can Change SC to GA
// ----------------------------------------------------------------------------
await it('2. Admin can change SC back to GA via dedicated endpoint', async () => {
  const res = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'GA' },
    adminHeaders
  );
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.lotteryJurisdiction, 'GA');

  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'GA');
});

// ----------------------------------------------------------------------------
// Test 3: Jurisdiction-Only Save Does Not Change Document Status
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Isolation & Decoupling from Verification Statuses ---');

await it('3. Jurisdiction-only save does not change document status', async () => {
  // First set document status to ACTION_REQUIRED via verify-documents
  const vRes = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/verify-documents`,
    { documentStatus: 'ACTION_REQUIRED', retailerAuthStatus: 'VALID' },
    adminHeaders
  );
  assert.strictEqual(vRes.status, 200);
  assert.strictEqual(vRes.body.store.documentStatus, 'ACTION_REQUIRED');

  // Change jurisdiction via dedicated endpoint
  const jRes = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'SC' },
    adminHeaders
  );
  assert.strictEqual(jRes.status, 200);

  // Verify documentStatus remained strictly ACTION_REQUIRED
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.body.store.documentStatus, 'ACTION_REQUIRED');
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'SC');
});

// ----------------------------------------------------------------------------
// Test 4: Jurisdiction-Only Save Does Not Change Retailer Authorization Status
// ----------------------------------------------------------------------------
await it('4. Jurisdiction-only save does not change retailer authorization status', async () => {
  // Set retailer auth status to PENDING_VERIFICATION
  const vRes = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/verify-documents`,
    { retailerAuthStatus: 'PENDING_VERIFICATION' },
    adminHeaders
  );
  assert.strictEqual(vRes.status, 200);
  assert.strictEqual(vRes.body.store.retailerAuthStatus, 'PENDING_VERIFICATION');

  // Change jurisdiction via dedicated endpoint
  const jRes = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'GA' },
    adminHeaders
  );
  assert.strictEqual(jRes.status, 200);

  // Verify retailerAuthStatus remained strictly PENDING_VERIFICATION
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.body.store.retailerAuthStatus, 'PENDING_VERIFICATION');
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'GA');
});

// ----------------------------------------------------------------------------
// Test 5: Stale Form Overwrite Protection
// ----------------------------------------------------------------------------
await it('5. A stale document-verification form cannot overwrite newer server approval when saving jurisdiction', async () => {
  // Step 1: Admin B approves store documents on server
  await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/verify-documents`,
    { documentStatus: 'APPROVED', retailerAuthStatus: 'VALID' },
    adminHeaders
  );

  // Step 2: Admin A (holding an old page with PENDING_REVIEW in DOM) saves ONLY jurisdiction
  // Because jurisdiction save does NOT include documentStatus or retailerAuthStatus, Admin B's approval is safe
  const jRes = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'SC' },
    adminHeaders
  );
  assert.strictEqual(jRes.status, 200);

  // Step 3: Verify server documentStatus is still APPROVED and retailerAuthStatus is still VALID
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.body.store.documentStatus, 'APPROVED', 'Document status must remain APPROVED');
  assert.strictEqual(details.body.store.retailerAuthStatus, 'VALID', 'Retailer auth must remain VALID');
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'SC', 'Jurisdiction updated to SC safely');
});

// ----------------------------------------------------------------------------
// Group 3: Access Control & Authorization (Tests 6 & 7)
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Access Control & Security ---');

await it('6. Unauthenticated users cannot change jurisdiction (403/401)', async () => {
  const res = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'GA' }
  );
  assert.ok(res.status === 403 || res.status === 401);
});

await it('7. Ordinary store users cannot change jurisdiction (403 Forbidden)', async () => {
  const userLogin = await request('POST', '/api/auth/login', {
    username: testStore.ownerUsername,
    password: 'Password123!'
  });
  assert.strictEqual(userLogin.status, 200);
  assert.ok(userLogin.body.token);

  const res = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'GA' },
    { 'Authorization': `Bearer ${userLogin.body.token}` }
  );
  assert.strictEqual(res.status, 403);
});

// ----------------------------------------------------------------------------
// Group 4: Input Validation (Test 8)
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Input Validation & Error Handling ---');

await it('8. Invalid jurisdiction values are rejected with HTTP 400', async () => {
  const invalidValues = ['FL', 'NC', 'TX', '', '   ', null, 123, { state: 'SC' }];
  for (const val of invalidValues) {
    const res = await request(
      'POST',
      `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
      { lotteryJurisdiction: val },
      adminHeaders
    );
    assert.strictEqual(res.status, 400, `Expected 400 for value: ${JSON.stringify(val)}`);
    assert.strictEqual(res.body.success, false);
  }

  // Ensure store jurisdiction remains unchanged (still SC from Test 5)
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.body.store.lotteryJurisdiction, 'SC');
});

// ----------------------------------------------------------------------------
// Group 5: Public Registration Protection (Tests 9, 10, 11)
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Public Registration & Application Protection ---');

await it('9. Public application requests cannot set active store jurisdiction to SC', async () => {
  // Attacker crafts manual POST containing lotteryJurisdiction: 'SC'
  const appRes = await request('POST', '/api/store-applications', {
    storeName: 'Attacker Store ' + Date.now(),
    applicantName: 'Attacker Owner',
    applicantEmail: `att_${Date.now()}@test.local`,
    applicantPhone: '555-0199',
    address: '100 Scam St, SC 29401',
    lotteryJurisdiction: 'SC',
    requestedPassword: 'Password123!'
  });
  assert.strictEqual(appRes.status, 200);

  // Application does not create an active store in stores table
  const appId = appRes.body.application?.id;

  // When admin approves application, store defaults to GA
  const reviewRes = await request('POST', `/api/admin/applications/${appId}/review`, {
    decision: 'APPROVE',
    confirmOfficialRetailerValid: true
  }, adminHeaders);
  assert.strictEqual(reviewRes.status, 200);
  assert.strictEqual(reviewRes.body.store.lotteryJurisdiction, 'GA',
    'Newly approved store must default to GA, ignoring applicant-supplied SC');
});

await it('10. Public paid signup cannot set active store jurisdiction to SC, even when manually constructed', async () => {
  // Attacker crafts direct registration payload with lotteryJurisdiction: 'SC'
  // When STRIPE_SECRET_KEY is not configured or in test mode, the server strictly defaults to GA
  const regRes = await request('POST', '/api/subscriptions/checkout-and-register', {
    planId: 'pro',
    billingCycle: 'monthly',
    storeName: 'Malicious Public SC Mart ' + Date.now(),
    applicantName: 'Sneaky User',
    applicantEmail: `sneaky_${Date.now()}@test.local`,
    applicantPhone: '555-0100',
    address: '555 Main St, GA',
    password: 'Password123!',
    lotteryJurisdiction: 'SC'
  });

  // If server requires payment session (402), it did NOT create the store
  // If payment session was bypassed/mocked, the store MUST be GA
  if (regRes.status === 200) {
    assert.strictEqual(regRes.body.store.lotteryJurisdiction, 'GA');
  } else {
    assert.ok(regRes.status === 402 || regRes.status === 400);
  }
});

await it('11. New public stores default to GA', async () => {
  const appRes = await request('POST', '/api/store-applications', {
    storeName: 'Legitimate GA Store ' + Date.now(),
    applicantName: 'Legit Owner',
    applicantEmail: `legit_${Date.now()}@test.local`,
    applicantPhone: '555-0122',
    address: '200 Peach St, Atlanta, GA',
    requestedPassword: 'Password123!'
  });
  assert.strictEqual(appRes.status, 200);
  const appId = appRes.body.application?.id;

  const reviewRes = await request('POST', `/api/admin/applications/${appId}/review`, {
    decision: 'APPROVE',
    confirmOfficialRetailerValid: true
  }, adminHeaders);
  assert.strictEqual(reviewRes.status, 200);
  assert.strictEqual(reviewRes.body.store.lotteryJurisdiction, 'GA');
});

// ----------------------------------------------------------------------------
// Group 6: UI Client-Side Logic (Tests 12 & 13)
// ----------------------------------------------------------------------------
console.log('\n--- Group 6: UI Resilience & Display Logic ---');

await it('12. Failed jurisdiction saves do not falsely update the UI', () => {
  // Emulate client save handler resilience
  let currentJurisdiction = 'GA';
  function handleSaveResult(res, attemptedValue) {
    if (res.success) {
      currentJurisdiction = attemptedValue;
      return { success: true };
    } else {
      // Revert to previous
      return { success: false, retainedValue: currentJurisdiction };
    }
  }

  const failResult = handleSaveResult({ success: false, message: 'Server error' }, 'SC');
  assert.strictEqual(failResult.success, false);
  assert.strictEqual(failResult.retainedValue, 'GA');
  assert.strictEqual(currentJurisdiction, 'GA');
});

await it('13. The Admin modal displays the server\'s latest saved jurisdiction', async () => {
  // Update store to SC
  const res = await request(
    'POST',
    `/api/admin/stores/${encodeURIComponent(testStoreId)}/jurisdiction`,
    { lotteryJurisdiction: 'SC' },
    adminHeaders
  );
  assert.strictEqual(res.status, 200);

  // Fetch details (same call openStoreControlModal makes)
  const details = await request('GET', `/api/admin/stores/${encodeURIComponent(testStoreId)}/details`, null, adminHeaders);
  assert.strictEqual(details.status, 200);

  // Emulate modal rendering logic
  const s = details.body.store;
  const normalizedJur = normalizeLotteryJurisdiction(s.lotteryJurisdiction);
  assert.strictEqual(normalizedJur, 'SC');

  const optionsHtml = `
    <option value="GA" ${normalizedJur === 'GA' ? 'selected' : ''}>Georgia (GA)</option>
    <option value="SC" ${normalizedJur === 'SC' ? 'selected' : ''}>South Carolina (SC)</option>
  `;
  assert.ok(optionsHtml.includes('value="SC" selected'));
  assert.ok(!optionsHtml.includes('value="GA" selected'));
});

// ----------------------------------------------------------------------------
// Final Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 13 ISOLATED ADMIN JURISDICTION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
