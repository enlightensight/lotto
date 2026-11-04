// Automated Verification Suite for Store Feedback & Issue Reporting System
import assert from 'assert';

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('=== STORE FEEDBACK & ISSUE REPORTING VERIFICATION ===\n');

  // Step 1: Admin Login to get token
  console.log('[1] Logging in as Platform Administrator...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'TestAdminPass123!' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, 'Admin login must succeed');
  const adminToken = loginData.token;
  console.log('✓ Admin authenticated with secure token.');

  // Step 2: Store submits feedback (e.g. scanner issue on game #1658)
  console.log('\n[2] Store user submits feedback / bug report...');
  const submitRes = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: 'store_amigo',
      storeName: 'AMIGO FOOD MART',
      userId: 'maulik',
      cashierName: 'Maulik',
      category: 'SCANNER',
      severity: 'HIGH',
      subject: 'Barcode scanner intermittent delay on ticket #1658',
      message: 'When scanning Game #1658 14-digit barcode ending in 0290, scanner beeps but dispenser box takes 2 seconds to register.',
      systemContext: {
        registerName: 'Register 1',
        shiftNumber: 13,
        shiftStatus: 'IN_PROGRESS'
      }
    })
  });

  const submitData = await submitRes.json();
  assert.strictEqual(submitData.success, true, 'Feedback submission must succeed');
  assert.ok(submitData.feedback?.id, 'Feedback item must receive a unique ID');
  assert.strictEqual(submitData.feedback.status, 'PENDING', 'New feedback must start in PENDING status');
  assert.strictEqual(submitData.feedback.category, 'SCANNER');
  assert.strictEqual(submitData.feedback.severity, 'HIGH');
  const feedbackId = submitData.feedback.id;
  console.log(`✓ Feedback submitted successfully with ID: ${feedbackId}`);

  // Step 3: Rejection on missing message
  console.log('\n[3] Testing validation: rejection on empty message...');
  const emptyRes = await fetch(`${BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: 'store_amigo', message: '' })
  });
  assert.strictEqual(emptyRes.status, 400, 'Empty message must return 400 Bad Request');
  console.log('✓ Empty feedback properly rejected with 400 Bad Request.');

  // Step 4: Unauthorized access to admin feedback endpoint rejected with 403
  console.log('\n[4] Testing authorization: non-admin access to admin feedback...');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/feedback`);
  assert.strictEqual(unauthRes.status, 403, 'Unauthorized access without token must return 403');
  console.log('✓ Non-admin access securely blocked with 403 Forbidden.');

  // Step 5: Admin retrieves feedback list
  console.log('\n[5] Platform Administrator retrieves feedback list...');
  const listRes = await fetch(`${BASE_URL}/api/admin/feedback`, {
    headers: { 'x-admin-token': adminToken }
  });
  assert.strictEqual(listRes.status, 200, 'Admin request must return 200 OK');
  const listData = await listRes.json();
  assert.strictEqual(listData.success, true);
  assert.ok(Array.isArray(listData.feedback), 'Feedback must be returned as an array');
  const createdItem = listData.feedback.find(f => f.id === feedbackId);
  assert.ok(createdItem, 'Submitted feedback must appear in admin list');
  assert.strictEqual(createdItem.storeName, 'AMIGO FOOD MART');
  console.log(`✓ Feedback found in admin list. Total items: ${listData.feedback.length}, Pending: ${listData.pendingCount}`);

  // Step 6: Admin reviews and updates feedback status
  console.log('\n[6] Administrator reviews feedback and marks as IN_PROGRESS...');
  const reviewRes1 = await fetch(`${BASE_URL}/api/admin/feedback/${feedbackId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      adminNotes: 'Investigating barcode parser timing on 14-digit layout B.'
    })
  });
  const reviewData1 = await reviewRes1.json();
  assert.strictEqual(reviewData1.success, true);
  assert.strictEqual(reviewData1.feedback.status, 'IN_PROGRESS');
  assert.strictEqual(reviewData1.feedback.adminNotes, 'Investigating barcode parser timing on 14-digit layout B.');
  console.log('✓ Feedback status successfully updated to IN_PROGRESS.');

  // Step 7: Admin resolves feedback
  console.log('\n[7] Administrator marks feedback as RESOLVED with resolution notes...');
  const reviewRes2 = await fetch(`${BASE_URL}/api/admin/feedback/${feedbackId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify({
      status: 'RESOLVED',
      adminNotes: 'Resolved: Barcode parser optimized with 0-delay instant pattern matcher.'
    })
  });
  const reviewData2 = await reviewRes2.json();
  assert.strictEqual(reviewData2.success, true);
  assert.strictEqual(reviewData2.feedback.status, 'RESOLVED');
  console.log('✓ Feedback status successfully updated to RESOLVED.');

  // Step 8: Verify Admin Overview includes feedback stats
  console.log('\n[8] Checking Admin Overview metrics...');
  const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { 'x-admin-token': adminToken }
  });
  const overviewData = await overviewRes.json();
  assert.strictEqual(overviewData.success, true);
  assert.ok(overviewData.stats.pendingFeedback !== undefined, 'Overview stats must include pendingFeedback');
  assert.ok(Array.isArray(overviewData.recentFeedback), 'Overview must include recentFeedback list');
  console.log(`✓ Overview stats verified: pendingFeedback=${overviewData.stats.pendingFeedback}, recentFeedbackCount=${overviewData.recentFeedback.length}`);

  console.log('\n====================================================');
  console.log('ALL STORE FEEDBACK SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('FEEDBACK TEST SUITE FAILED:', err);
  process.exit(1);
});
