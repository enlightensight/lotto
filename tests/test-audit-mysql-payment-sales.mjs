import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const WORKSPACE = process.cwd();
const testEnv = dotenv.parse(fs.readFileSync(path.join(WORKSPACE, '.env.test_credentials'), 'utf8'));

const TEST_PORT_A = 3011;
const TEST_PORT_B = 3012;
const TEST_PORT_NO_GW = 3013;
const ADMIN_KEY = process.env.ADMIN_PROVISION_KEY || 'lotto_admin_secret_key';
const WEBHOOK_SECRET = 'whsec_audit_test_secret_12345';

const tempDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'jackpotlo_audit_a_'));
const tempDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'jackpotlo_audit_b_'));
const tempDirNoGw = fs.mkdtempSync(path.join(os.tmpdir(), 'jackpotlo_audit_nogw_'));

function startServer(port, dataDir, extraEnv = {}) {
  const proc = spawn('node', ['server.js'], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      DB_HOST: testEnv.DB_HOST,
      DB_PORT: testEnv.DB_PORT,
      DB_USER: testEnv.DB_USER,
      DB_PASSWORD: testEnv.DB_PASSWORD,
      DB_NAME: testEnv.DB_NAME,
      IS_TEST_BACKEND: 'true',
      REQUIRE_TEST_DB: 'true',
      DB_SSL_CA_PATH: path.join(WORKSPACE, 'ca.pem'),
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  proc.stdout.on('data', d => { logs += d.toString(); });
  proc.stderr.on('data', d => { logs += d.toString(); });
  return { proc, getLogs: () => logs };
}

async function waitForServer(port, procObj, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://localhost:${port}/api/db-status`);
      if (r.ok) {
        const d = await r.json();
        if (d.connected && d.database === 'jackpotlo_test') return d;
      }
    } catch (_) { }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Test server on port ${port} failed to connect to jackpotlo_test:\n${procObj.getLogs()}`);
}

function signStripeWebhook(payloadStr, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payloadStr}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}

async function apiJson(port, urlPath, { method = 'GET', body = null, headers = {} } = {}) {
  const res = await fetch(`http://localhost:${port}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function cleanupTestDb(createdStoreIds, paymentRefs) {
  const conn = await mysql.createConnection({
    host: testEnv.DB_HOST,
    port: Number(testEnv.DB_PORT),
    user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD,
    database: testEnv.DB_NAME,
    ssl: { ca: fs.readFileSync(path.join(WORKSPACE, 'ca.pem'), 'utf8'), rejectUnauthorized: true }
  });
  try {
    for (const sid of createdStoreIds) {
      await conn.query('DELETE FROM store_users WHERE store_id = ?', [sid]).catch(() => { });
      await conn.query('DELETE FROM store_applications WHERE store_id = ?', [sid]).catch(() => { });
      await conn.query('DELETE FROM store_pos_state WHERE store_id = ?', [sid]).catch(() => { });
      await conn.query('DELETE FROM admin_audit_logs WHERE store_id = ?', [sid]).catch(() => { });
      await conn.query('DELETE FROM stores WHERE store_id = ?', [sid]).catch(() => { });
    }
    for (const ref of paymentRefs) {
      await conn.query('DELETE FROM payment_transactions WHERE payment_ref = ?', [ref]).catch(() => { });
    }
  } finally {
    await conn.end();
  }
}

async function run() {
  const createdStoreIds = [];
  const createdPaymentRefs = [];
  let srvNoGw = null;
  let srvA = null;
  let srvB = null;

  try {
    console.log('1) Verifying fail-closed behavior when NO payment gateway keys are configured...');
    srvNoGw = startServer(TEST_PORT_NO_GW, tempDirNoGw, { ALLOW_LOCAL_TEST_PAYMENT: 'false' });
    await waitForServer(TEST_PORT_NO_GW, srvNoGw);

    const cfgNoGw = await apiJson(TEST_PORT_NO_GW, '/api/payments/config');
    assert.equal(cfgNoGw.data.configured, false);
    assert.equal(cfgNoGw.data.gateway, 'none');

    const csNoGw = await apiJson(TEST_PORT_NO_GW, '/api/payments/create-checkout-session', {
      method: 'POST',
      body: { planId: 'pro', billingCycle: 'monthly' }
    });
    assert.equal(csNoGw.status, 503);
    assert.equal(csNoGw.data.code, 'PAYMENT_GATEWAY_NOT_CONFIGURED');

    const spoofCheckout = await apiJson(TEST_PORT_NO_GW, '/api/subscriptions/checkout-and-register', {
      method: 'POST',
      body: {
        planId: 'pro', billingCycle: 'monthly', paymentConfirmed: true, paymentRef: 'FAKE-CLIENT-REF',
        storeName: 'Spoof Mart', applicantName: 'Spoof User', applicantEmail: 'spoof@test.local',
        applicantPhone: '555-0100', address: '123 Fake St', password: testEnv.STORE_TEST_PASS
      }
    });
    assert.equal(spoofCheckout.status, 503);
    assert.equal(spoofCheckout.data.code, 'PAYMENT_GATEWAY_NOT_CONFIGURED');
    srvNoGw.proc.kill();
    srvNoGw = null;
    console.log('   PASS: Fail-closed payment verification confirmed.');

    console.log('2) Verifying server-side payment webhook, amount check, failed rejection, deduplication & MySQL persistence...');
    srvA = startServer(TEST_PORT_A, tempDirA, {
      ALLOW_LOCAL_TEST_PAYMENT: 'true',
      TEST_PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET
    });
    await waitForServer(TEST_PORT_A, srvA);

    // 2a. Failed payment cannot activate subscription
    const csFailed = await apiJson(TEST_PORT_A, '/api/payments/create-checkout-session', {
      method: 'POST',
      body: { planId: 'pro', billingCycle: 'monthly' }
    });
    assert.equal(csFailed.status, 200);
    createdPaymentRefs.push(csFailed.data.sessionId);

    // Bad webhook signature rejected
    const badSigRes = await apiJson(TEST_PORT_A, '/api/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=deadbeef' },
      body: { id: 'evt_bad', type: 'checkout.session.completed', data: { object: { id: csFailed.data.sessionId, payment_status: 'paid' } } }
    });
    assert.equal(badSigRes.status, 400);
    assert.equal(badSigRes.data.code, 'INVALID_WEBHOOK_SIGNATURE');

    const failEvt = JSON.stringify({
      id: `evt_fail_${Date.now()}`,
      type: 'payment_intent.payment_failed',
      data: { object: { id: csFailed.data.sessionId, amount_total: 9900, currency: 'usd', payment_status: 'unpaid', metadata: { planId: 'pro', billingCycle: 'monthly' } } }
    });
    const failWh = await fetch(`http://localhost:${TEST_PORT_A}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(failEvt, WEBHOOK_SECRET) },
      body: failEvt
    });
    assert.equal(failWh.status, 200);

    const activateFailed = await apiJson(TEST_PORT_A, '/api/subscriptions/checkout-and-register', {
      method: 'POST',
      body: {
        planId: 'pro', billingCycle: 'monthly', paymentSessionId: csFailed.data.sessionId,
        storeName: 'Failed Pay Store', applicantName: 'Fail User', applicantEmail: `fail_${Date.now()}@test.local`,
        applicantPhone: '555-0101', address: '1 Fail Way', password: testEnv.STORE_TEST_PASS
      }
    });
    assert.equal(activateFailed.status, 402);
    assert.equal(activateFailed.data.code, 'PAYMENT_NOT_COMPLETED');

    // 2b. Amount mismatch rejected
    const csMismatch = await apiJson(TEST_PORT_A, '/api/payments/create-checkout-session', {
      method: 'POST',
      body: { planId: 'starter', billingCycle: 'monthly' }
    });
    assert.equal(csMismatch.status, 200);
    createdPaymentRefs.push(csMismatch.data.sessionId);
    const mismatchEvt = JSON.stringify({
      id: `evt_mis_${Date.now()}`,
      type: 'checkout.session.completed',
      data: { object: { id: csMismatch.data.sessionId, amount_total: 4900, currency: 'usd', payment_status: 'paid', metadata: { planId: 'starter', billingCycle: 'monthly' } } }
    });
    await fetch(`http://localhost:${TEST_PORT_A}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(mismatchEvt, WEBHOOK_SECRET) },
      body: mismatchEvt
    });
    const upgradeSpoof = await apiJson(TEST_PORT_A, '/api/subscriptions/checkout-and-register', {
      method: 'POST',
      body: {
        planId: 'pro', billingCycle: 'monthly', paymentSessionId: csMismatch.data.sessionId,
        storeName: 'Underpaid Pro', applicantName: 'Under Pay', applicantEmail: `under_${Date.now()}@test.local`,
        applicantPhone: '555-0102', address: '2 Mismatch Ave', password: testEnv.STORE_TEST_PASS
      }
    });
    assert.equal(upgradeSpoof.status, 400);
    assert.equal(upgradeSpoof.data.code, 'PAYMENT_AMOUNT_MISMATCH');

    // 2c. Genuine webhook-verified $99 Growth Pro payment & immediate store registration
    const csValid = await apiJson(TEST_PORT_A, '/api/payments/create-checkout-session', {
      method: 'POST',
      body: { planId: 'pro', billingCycle: 'monthly' }
    });
    assert.equal(csValid.status, 200);
    createdPaymentRefs.push(csValid.data.sessionId);

    const paidEvtId = `evt_paid_${Date.now()}`;
    const paidEvt = JSON.stringify({
      id: paidEvtId,
      type: 'checkout.session.completed',
      data: { object: { id: csValid.data.sessionId, amount_total: 9900, currency: 'usd', payment_status: 'paid', metadata: { planId: 'pro', billingCycle: 'monthly' } } }
    });
    const paidWh1 = await fetch(`http://localhost:${TEST_PORT_A}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(paidEvt, WEBHOOK_SECRET) },
      body: paidEvt
    });
    assert.equal(paidWh1.status, 200);

    // Duplicate webhook delivery must be flagged idempotently
    const paidWhDup = await fetch(`http://localhost:${TEST_PORT_A}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(paidEvt, WEBHOOK_SECRET) },
      body: paidEvt
    });
    const paidWhDupJson = await paidWhDup.json();
    assert.equal(paidWhDupJson.duplicate, true);

    const uniqueSuffix = Date.now();
    const storeEmail = `audit_${uniqueSuffix}@jackpotlo.test`;
    const regRes = await apiJson(TEST_PORT_A, '/api/subscriptions/checkout-and-register', {
      method: 'POST',
      body: {
        planId: 'pro',
        billingCycle: 'monthly',
        paymentSessionId: csValid.data.sessionId,
        storeName: `Audit Peach Mart ${uniqueSuffix}`,
        applicantName: 'Audit Owner',
        applicantEmail: storeEmail,
        applicantPhone: '478-555-0199',
        businessTaxId: '58-9991111',
        lotteryRetailerId: `GA-${String(uniqueSuffix).slice(-5)}`,
        licenseExpiry: '2028-12-31',
        address: '900 Audit Way, Warner Robins, GA 31088',
        username: `auditowner_${uniqueSuffix}`,
        password: testEnv.STORE_TEST_PASS,
        licenseFiles: [{
          name: 'license.png',
          mimeType: 'image/png',
          size: 68,
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        }]
      }
    });
    assert.equal(regRes.status, 201);
    const storeId = regRes.data.storeId;
    createdStoreIds.push(storeId);
    const tokenDevice1 = regRes.data.token;
    assert.equal(regRes.data.statuses.subscriptionStatus, 'ACTIVE');
    assert.equal(regRes.data.statuses.documentStatus, 'PENDING_REVIEW');
    assert.equal(regRes.data.statuses.retailerAuthStatus, 'PENDING_VERIFICATION');
    assert.equal(regRes.data.statuses.softwareAccessStatus, 'ACTIVE');

    // Duplicate registration attempt reusing same paymentSessionId must return 409
    const dupReg = await apiJson(TEST_PORT_A, '/api/subscriptions/checkout-and-register', {
      method: 'POST',
      body: {
        planId: 'pro', billingCycle: 'monthly', paymentSessionId: csValid.data.sessionId,
        storeName: 'Dup Mart', applicantName: 'Dup', applicantEmail: `dup_${uniqueSuffix}@test.local`,
        applicantPhone: '478-555-0199', address: '123 Dup St', password: testEnv.STORE_TEST_PASS
      }
    });
    assert.equal(dupReg.status, 409);
    assert.equal(dupReg.data.code, 'DUPLICATE_PAYMENT');
    console.log('   PASS: Server-verified payment, failed/amount rejection & duplicate protection confirmed.');

    console.log('3) Verifying ALL selling/sync routes enforce retailerAuthStatus === VALID while non-selling setup works...');
    const headersD1 = { 'x-store-token': tokenDevice1, 'x-store-id': storeId };

    // Non-selling empty/setup POS sync allowed
    const setupSync = await apiJson(TEST_PORT_A, '/api/sync-pos-state', {
      method: 'POST',
      headers: headersD1,
      body: { storeId, state: { storeId, storeName: `Audit Peach Mart ${uniqueSuffix}`, slots: [{ boxNumber: 1, packNumber: '123', startTicket: 1, currentTicket: 1, ticketsSold: 0, status: 'ACTIVE' }], inStockInventory: [{ packNumber: '999', gameName: 'Test Game' }] } }
    });
    assert.equal(setupSync.status, 200);

    // Selling/sync routes blocked with 403 RETAILER_AUTH_REQUIRED
    for (const [label, url, body] of [
      ['POST /api/inventory/sale', '/api/inventory/sale', { storeId, packNumber: '123', quantity: 1 }],
      ['POST /api/log-scan (SOLD)', '/api/log-scan', { storeId, packNumber: '123', barcode: '1650123001', action: 'SOLD' }],
      ['POST /api/save-day-report (with sales)', '/api/save-day-report', { storeId, totalScratcherSales: 25, boxes: [{ box: 1, name: '5X Money', pack: '123', price: 1, open: 0, close: 25, total: 25 }] }],
      ['POST /api/save-shift-report (with sales)', '/api/save-shift-report', { storeId, shiftNumber: 1, totalTicketsSold: 5, totalSalesRevenue: 25 }],
      ['POST /api/inventory/reconcile-shift (with sales)', '/api/inventory/reconcile-shift', { storeId, shiftId: 's1', posLoggedSalesByPack: { '123': 4 } }],
      ['POST /api/sync-pos-state (offline soldBarcodes/tickets)', '/api/sync-pos-state', { storeId, state: { storeId, soldBarcodes: ['16501230001'], slots: [{ boxNumber: 1, packNumber: '123', startTicket: 1, currentTicket: 3, ticketsSold: 2, status: 'ACTIVE' }] } }]
    ]) {
      const r = await apiJson(TEST_PORT_A, url, { method: 'POST', headers: headersD1, body });
      assert.equal(r.status, 403, `${label} should return 403, got ${r.status}`);
      assert.equal(r.data.code, 'RETAILER_AUTH_REQUIRED', `${label} code mismatch: ${JSON.stringify(r.data)}`);
    }
    console.log('   PASS: All 6 ticket sale & offline sync routes enforced official retailer authorization.');

    console.log('4) Verifying Device B login + Admin suspension + MySQL persistence across server restart...');
    const loginD2 = await apiJson(TEST_PORT_A, '/api/auth/login', {
      method: 'POST',
      body: { identifier: storeEmail, password: testEnv.STORE_TEST_PASS }
    });
    assert.equal(loginD2.status, 200);
    const tokenDevice2 = loginD2.data.token;

    // Admin suspends store on Server A
    const suspendRes = await apiJson(TEST_PORT_A, `/api/admin/stores/${storeId}/suspend`, {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_KEY },
      body: { reason: 'Tax ID document illegible', documentStatus: 'ACTION_REQUIRED' }
    });
    assert.equal(suspendRes.status, 200);

    // Boot fresh Server B with EMPTY local DATA_DIR pointing ONLY to jackpotlo_test MySQL DB!
    srvB = startServer(TEST_PORT_B, tempDirB);
    await waitForServer(TEST_PORT_B, srvB);

    // Server B (never saw Server A in memory) MUST immediately reject BOTH Device 1 & Device 2 tokens AND new login!
    for (const [lbl, tok] of [['Device 1', tokenDevice1], ['Device 2', tokenDevice2]]) {
      const chk = await apiJson(TEST_PORT_B, `/api/load-pos-state?storeId=${storeId}`, {
        headers: { 'x-store-token': tok, 'x-store-id': storeId }
      });
      assert.equal(chk.status, 403, `${lbl} must be blocked on restarted/second server`);
      assert.ok(['STORE_SUSPENDED', 'SESSION_REVOKED'].includes(chk.data.code));
    }

    const blockedLoginB = await apiJson(TEST_PORT_B, '/api/auth/login', {
      method: 'POST',
      body: { identifier: storeEmail, password: testEnv.STORE_TEST_PASS }
    });
    assert.equal(blockedLoginB.status, 403);
    assert.equal(blockedLoginB.data.code, 'STORE_SUSPENDED');
    assert.match(blockedLoginB.data.suspensionReason, /Tax ID document illegible/);

    // Customer submits corrected docs -> MUST succeed without unlocking POS access!
    const resubRes = await apiJson(TEST_PORT_B, '/api/store/resubmit-documents', {
      method: 'POST',
      body: {
        identifier: storeEmail,
        password: testEnv.STORE_TEST_PASS,
        notes: 'Uploaded crisp Tax ID scan',
        licenseFiles: [{
          name: 'tax_id_fixed.png',
          mimeType: 'image/png',
          size: 68,
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        }]
      }
    });
    assert.equal(resubRes.status, 200);
    assert.equal(resubRes.data.documentStatus, 'PENDING_REVIEW');
    assert.equal(resubRes.data.softwareAccessStatus, 'SUSPENDED');

    const stillBlockedLogin = await apiJson(TEST_PORT_B, '/api/auth/login', {
      method: 'POST',
      body: { identifier: storeEmail, password: testEnv.STORE_TEST_PASS }
    });
    assert.equal(stillBlockedLogin.status, 403);

    // Admin cannot reapprove without VALID retailer authorization
    const badReapprove = await apiJson(TEST_PORT_B, `/api/admin/stores/${storeId}/reapprove`, {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_KEY },
      body: { markDocumentsApproved: true }
    });
    assert.equal(badReapprove.status, 400);
    assert.equal(badReapprove.data.code, 'RETAILER_AUTH_INVALID');

    // Admin verifies docs + official retailer authorization, then reapproves on Server B
    const verRes = await apiJson(TEST_PORT_B, `/api/admin/stores/${storeId}/verify-documents`, {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_KEY },
      body: { documentStatus: 'APPROVED', retailerAuthStatus: 'VALID', adminNotes: 'Verified against Georgia Lottery' }
    });
    assert.equal(verRes.status, 200);

    const reapRes = await apiJson(TEST_PORT_B, `/api/admin/stores/${storeId}/reapprove`, {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_KEY },
      body: { notes: 'Compliance restored' }
    });
    assert.equal(reapRes.status, 200);
    assert.equal(reapRes.data.store.softwareAccessStatus, 'ACTIVE');

    // Restart Server B completely (kill + start fresh Server B2 on TEST_PORT_B) -> reapproval & inventory preserved from MySQL!
    srvB.proc.kill();
    srvB = null;
    const tempDirB2 = fs.mkdtempSync(path.join(os.tmpdir(), 'jackpotlo_audit_b2_'));
    srvB = startServer(TEST_PORT_B, tempDirB2);
    await waitForServer(TEST_PORT_B, srvB);

    const restoredLogin = await apiJson(TEST_PORT_B, '/api/auth/login', {
      method: 'POST',
      body: { identifier: storeEmail, password: testEnv.STORE_TEST_PASS }
    });
    assert.equal(restoredLogin.status, 200);
    const restoredToken = restoredLogin.data.token;

    // Preserved POS inventory check
    const loadedState = await apiJson(TEST_PORT_B, `/api/load-pos-state?storeId=${storeId}`, {
      headers: { 'x-store-token': restoredToken, 'x-store-id': storeId }
    });
    assert.equal(loadedState.status, 200);
    assert.equal(loadedState.data.state.inStockInventory[0].packNumber, '999');

    // Offline/retry sales sync now passes retailerAuthStatus === VALID check!
    const validSync = await apiJson(TEST_PORT_B, '/api/sync-pos-state', {
      method: 'POST',
      headers: { 'x-store-token': restoredToken, 'x-store-id': storeId },
      body: { storeId, state: { storeId, soldBarcodes: ['16501230001'], slots: [{ boxNumber: 1, packNumber: '123', startTicket: 1, currentTicket: 3, ticketsSold: 2, status: 'ACTIVE' }] } }
    });
    assert.equal(validSync.status, 200);

    // Double-check MySQL tables directly
    const conn = await mysql.createConnection({
      host: testEnv.DB_HOST, port: Number(testEnv.DB_PORT), user: testEnv.DB_USER, password: testEnv.DB_PASSWORD, database: testEnv.DB_NAME,
      ssl: { ca: fs.readFileSync(path.join(WORKSPACE, 'ca.pem'), 'utf8'), rejectUnauthorized: true }
    });
    const [storeDbRows] = await conn.query('SELECT * FROM stores WHERE store_id = ?', [storeId]);
    assert.equal(storeDbRows.length, 1);
    assert.equal(storeDbRows[0].subscription_status, 'ACTIVE');
    assert.equal(storeDbRows[0].document_status, 'APPROVED');
    assert.equal(storeDbRows[0].retailer_auth_status, 'VALID');
    assert.equal(storeDbRows[0].software_access_status, 'ACTIVE');
    assert.ok(storeDbRows[0].token_version >= 2);
    const [payRows] = await conn.query('SELECT * FROM payment_transactions WHERE payment_ref = ?', [csValid.data.sessionId]);
    assert.equal(payRows.length, 1);
    assert.equal(payRows[0].consumed, 1);
    const [audRows] = await conn.query('SELECT * FROM admin_audit_logs WHERE store_id = ?', [storeId]);
    assert.ok(audRows.length >= 4);
    await conn.end();
    try { fs.rmSync(tempDirB2, { recursive: true, force: true }); } catch (_) { }

    console.log('\nALL AUDIT ITEM 2, 3, 4, 5 TESTS PASSED AGAINST ISOLATED MYSQL (jackpotlo_test)!');
  } catch (err) {
    console.error('\n--- Server A Logs ---\n' + (srvA?.getLogs() || 'none'));
    console.error('\n--- Server B Logs ---\n' + (srvB?.getLogs() || 'none'));
    throw err;
  } finally {
    if (srvNoGw?.proc) srvNoGw.proc.kill();
    if (srvA?.proc) srvA.proc.kill();
    if (srvB?.proc) srvB.proc.kill();
    await cleanupTestDb(createdStoreIds, createdPaymentRefs).catch(e => console.warn('Cleanup note:', e.message));
    try { fs.rmSync(tempDirA, { recursive: true, force: true }); } catch (_) { }
    try { fs.rmSync(tempDirB, { recursive: true, force: true }); } catch (_) { }
    try { fs.rmSync(tempDirNoGw, { recursive: true, force: true }); } catch (_) { }
  }
}

run().catch(err => {
  console.error('AUDIT TEST FAILED:', err);
  process.exit(1);
});