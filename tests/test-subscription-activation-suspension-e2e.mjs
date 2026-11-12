// ============================================================================
// Comprehensive E2E Test: Immediate Subscription Activation, POS Preservation,
// 4-Status Separation, Official Retailer Auth Safeguard, Suspension, Resubmission & Reapproval
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9822;
const E2E_PORT = 3015;
const FRONT_PORT = 4175;
const LIVE_PORT = 3001;
const BASE_URL = `http://127.0.0.1:${FRONT_PORT}/`;
const API_URL = `http://127.0.0.1:${E2E_PORT}`;
const WEBHOOK_SECRET = 'whsec_e2e_test_secret_987';

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

    async function api(base, path, options = {}) {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

function signStripeWebhook(payloadStr, secret) {
      const ts = Math.floor(Date.now() / 1000);
      const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payloadStr}`).digest('hex');
      return `t=${ts},v1=${sig}`;
    }

function startStaticAndApiProxyServer() {
      const distDir = join(process.cwd(), 'dist');
      const srv = http.createServer((req, res) => {
        if (req.url.startsWith('/api/')) {
          const pReq = http.request({
            hostname: '127.0.0.1',
            port: E2E_PORT,
            path: req.url,
            method: req.method,
            headers: req.headers
          }, (pRes) => {
            res.writeHead(pRes.statusCode || 500, pRes.headers);
            pRes.pipe(res);
          });
          pReq.on('error', (err) => {
            res.writeHead(502);
            res.end(err.message);
          });
          req.pipe(pReq);
          return;
        }
        const cleanUrl = (req.url || '/').split('?')[0];
        let filePath = join(distDir, cleanUrl === '/' ? 'index.html' : cleanUrl);
        if (!existsSync(filePath) || cleanUrl === '/admin') {
          filePath = join(distDir, 'index.html');
        }
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_MAP[ext] || 'application/octet-stream' });
        res.end(readFileSync(filePath));
      });
      return new Promise((resolve) => srv.listen(FRONT_PORT, '127.0.0.1', () => resolve(srv)));
    }

async function run() {
      console.log('\n====================================================================');
      console.log('   JACKPOTLO SUBSCRIPTION & SUSPENSION BROWSER E2E (POST-AUDIT)     ');
      console.log('====================================================================\n');

      let passed = 0;
      let failed = 0;
      function check(cond, msg) {
        if (cond) {
          console.log(`  PASS: ${msg}`);
          passed++;
        } else {
          console.error(`  FAIL: ${msg}`);
          failed++;
        }
      }

      const tmpDataDir = mkdtempSync(join(tmpdir(), 'lotto-sub-e2e-data-'));
      const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-sub-e2e-'));

      const testServer = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(E2E_PORT),
          DATA_DIR: tmpDataDir,
          DB_HOST: '127.0.0.1',
          DB_PORT: '3399',
          ALLOW_LOCAL_TEST_PAYMENT: 'true',
          TEST_PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let up = false;
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`${API_URL}/api/subscription/plans`);
          if (r.ok) { up = true; break; }
        } catch (_) { }
        await sleep(250);
      }
      assert(up, 'Isolated E2E server booted');
      const proxySrv = await startStaticAndApiProxyServer();

      const chrome = spawn(CHROME, [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${tmpProfile}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1440,920',
        BASE_URL
      ]);

      let ws;
      try {
        let targets = null;
        for (let i = 0; i < 30; i++) {
          try {
            const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
            targets = await res.json();
            if (targets?.some(t => t.type === 'page')) break;
          } catch (_) { }
          await sleep(250);
        }
        const page = targets?.find(t => t.type === 'page');
        assert(page, 'Chrome CDP target found');
        ws = new WebSocket(page.webSocketDebuggerUrl);

        let msgId = 1;
        const pending = new Map();
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
          }
        };
        const send = (method, params = {}) => new Promise((resolve) => {
          const id = msgId++;
          pending.set(id, resolve);
          ws.send(JSON.stringify({ id, method, params }));
        });
        await new Promise(r => (ws.onopen = r));
        await send('Runtime.enable');
        await send('Page.enable');

        const evalCode = async (expression) => {
          const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
          if (res.result?.exceptionDetails) {
            throw new Error(res.result.exceptionDetails.exception?.description || 'Eval error');
          }
          return res.result?.result?.value;
        };

        for (let i = 0; i < 30; i++) {
          const ready = await evalCode(`Boolean(document.getElementById('btnOpenStoreAppModal'))`).catch(() => false);
          if (ready) break;
          await sleep(250);
        }

        // 0. Check default live server (port 3001) fails closed when Stripe is unconfigured
        const liveCfg = await api(`http://127.0.0.1:${LIVE_PORT}`, '/api/payments/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' })
        }).catch(() => ({ status: 0, data: null }));
        check(
          liveCfg.status === 503 && liveCfg.data?.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED',
          'Default live server (port 3001) fails closed with 503 PAYMENT_GATEWAY_NOT_CONFIGURED when Stripe keys are absent'
        );

        // 1. Server-Verified Payment, Immediate Registration & Unmodified POS Layout
        console.log('--- Step 1: Server-Verified Checkout, Registration & Unmodified POS Layout ---');
        const plansRes = await api(API_URL, '/api/subscription/plans');
        check(plansRes.status === 200 && Array.isArray(plansRes.data?.plans) && plansRes.data.plans.length === 3, 'Subscription plans endpoint lists 3 plans');

        const csRes = await api(API_URL, '/api/payments/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' })
        });
        assert(csRes.status === 200 && csRes.data?.sessionId, 'Checkout session created');
        const paidPayload = JSON.stringify({
          id: `evt_e2e_${Date.now()}`,
          type: 'checkout.session.completed',
          data: {
            object: {
              id: csRes.data.sessionId,
              amount_total: 9900,
              currency: 'usd',
              payment_status: 'paid',
              metadata: { planId: 'pro', billingCycle: 'monthly' }
            }
          }
        });
        const whRes = await fetch(`${API_URL}/api/payments/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(paidPayload, WEBHOOK_SECRET) },
          body: paidPayload
        });
        check(whRes.status === 200, 'Signed payment webhook confirmed payment server-side');

        await evalCode(`
      sessionStorage.clear();
      localStorage.setItem('lotto_signed_out', 'true');
      localStorage.removeItem('lotto_session_user');
      localStorage.removeItem('lotto_admin_token');
      localStorage.removeItem('lotto_store_token');
      window.__verifiedCheckoutSessionId = ${JSON.stringify(csRes.data.sessionId)};
      if (typeof showSignInScreen === 'function') showSignInScreen();
      document.getElementById('btnOpenStoreAppModal').click();
    `);
        await sleep(400);

        const ts = Date.now();
        const storeName = `Peachtree Lotto #${ts}`;
        const ownerUsername = `peachtree_${ts}`;
        const ownerEmail = `owner.${ts}@peachtree.example`;
        const ownerPass = 'Peachtree2026!';
        const retailerId = `GA-PT-${String(ts).slice(-5)}`;

        await evalCode(`(async () => {
      document.getElementById('planPro').checked = true;
      document.getElementById('appBillingCycle').value = 'monthly';
      document.getElementById('appInputPaymentCardLast4').value = 'Visa ending 4242';
      document.getElementById('appInputPaymentConfirm').checked = true;
      document.getElementById('appInputStoreName').value = ${JSON.stringify(storeName)};
      document.getElementById('appInputOwnerName').value = 'Maya Lin';
      document.getElementById('appInputRetailerId').value = ${JSON.stringify(retailerId)};
      document.getElementById('appInputTaxId').value = 'FEIN-84-992104';
      document.getElementById('appInputLicenseExpiry').value = '2028-06-30';
      document.getElementById('appInputEmail').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('appInputPhone').value = '(404) 555-0148';
      document.getElementById('appInputAddress').value = '120 Peachtree St, Atlanta, GA 30303';
      document.getElementById('appInputUsername').value = ${JSON.stringify(ownerUsername)};
      document.getElementById('appInputPassword').value = ${JSON.stringify(ownerPass)};
      document.getElementById('appInputNotes').value = 'Subscribed online and uploaded state retailer certificate.';

      const licFile = new File(['Georgia State Lottery Retailer Certificate - Pending Review'], 'ga_retailer_cert.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(licFile);
      const fileInp = document.getElementById('appInputLicenseFiles');
      fileInp.files = dt.files;
      fileInp.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 350));

      document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
        await sleep(1600);

        const immediateSession = await evalCode(`(() => {
      const s = JSON.parse(sessionStorage.getItem('lotto_session_user') || '{}');
      const token = sessionStorage.getItem('lotto_store_token') || '';
      return {
        tokenPresent: token.split('.').length === 3,
        token,
        storeId: s.storeId,
        isAdmin: s.isAdmin,
        subscriptionStatus: s.subscriptionStatus,
        documentStatus: s.documentStatus,
        retailerAuthStatus: s.retailerAuthStatus,
        softwareAccessStatus: s.softwareAccessStatus,
        posVisible: document.querySelector('.pos-app-layout')?.style.display === 'flex',
        complianceBarElement: document.getElementById('storeComplianceNoticeBar')
      };
    })()`);

        check(immediateSession.tokenPresent && immediateSession.isAdmin === false && Boolean(immediateSession.storeId), 'Customer received immediate Store JWT session');
        check(immediateSession.posVisible, 'Customer entered isolated Store POS software immediately after checkout');
        check(immediateSession.complianceBarElement === null, 'POS layout preserved: #storeComplianceNoticeBar is completely removed from POS DOM');
        check(
          immediateSession.subscriptionStatus === 'ACTIVE' &&
          immediateSession.documentStatus === 'PENDING_REVIEW' &&
          immediateSession.retailerAuthStatus === 'PENDING_VERIFICATION' &&
          immediateSession.softwareAccessStatus === 'ACTIVE',
      '4 separated account statuses preserved accurately'
        );

        const storeId = immediateSession.storeId;
        const storeToken1 = immediateSession.token;

          // 2. Official Lottery Retailer Authorization Safeguard (Direct + Offline Sync)
          console.log('\n--- Step 2: Enforce Official Retailer Auth on Selling & Offline Sync Routes ---');
          const blockedSaleServer = await api(API_URL, '/api/inventory/sale', {
            method: 'POST',
            headers: { 'x-store-token': storeToken1, 'x-store-id': storeId },
            body: JSON.stringify({ storeId, packNumber: '999001', quantity: 1 })
          });
        check(blockedSaleServer.status === 403 && blockedSaleServer.data?.code === 'RETAILER_AUTH_REQUIRED', 'Server blocks /api/inventory/sale while retailerAuthStatus=PENDING_VERIFICATION');

        const blockedOfflineSalesSync = await api(API_URL, '/api/sync-pos-state', {
          method: 'POST',
          headers: { 'x-store-token': storeToken1, 'x-store-id': storeId },
          body: JSON.stringify({
            storeId,
            state: {
              storeId,
              soldBarcodes: ['1650554433001'],
              slots: [{ boxNumber: 1, gameName: '5X Money', price: 1, packNumber: '554433', packSize: 300, startTicket: 0, currentTicket: 3, ticketsSold: 3, status: 'ACTIVE' }]
            }
          })
        });
        check(blockedOfflineSalesSync.status === 403 && blockedOfflineSalesSync.data?.code === 'RETAILER_AUTH_REQUIRED', 'Server blocks offline /api/sync-pos-state with ticket sales until retailerAuthStatus=VALID');

          const syncSave = await api(API_URL, '/api/sync-pos-state', {
            method: 'POST',
            headers: { 'x-store-token': storeToken1, 'x-store-id': storeId },
            body: JSON.stringify({
              storeId,
              state: {
                storeId,
                storeName,
                shiftNumber: 4,
                shiftStatus: 'SHIFT_IN_PROGRESS',
          slots: [{ boxNumber: 1, gameName: '5X Money', price: 1, packNumber: '554433', packSize: 300, startTicket: 0, currentTicket: 0, ticketsSold: 0, status: 'ACTIVE' }],
                inStockInventory: [{ packNumber: '887766', gameName: 'Hit 100', price: 2 }]
              }
            })
          });
        check(syncSave.status === 200 && syncSave.data?.success, 'Non-selling POS configuration sync succeeds while softwareAccessStatus=ACTIVE');

          const adminPass = '1234';
          const adminLogin = await api(API_URL, '/api/auth/login', {
            method: 'POST',
      body: JSON.stringify({ username: 'admin', password: adminPass, mode: 'ADMIN' })
          });
          assert(adminLogin.status === 200 && adminLogin.data?.token, 'Admin login succeeded');
        const adminToken = adminLogin.data.token;

          const verifyRetailerRes = await api(API_URL, `/api/admin/stores/${encodeURIComponent(storeId)}/verify-documents`, {
            method: 'POST',
            headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ documentStatus: 'APPROVED', retailerAuthStatus: 'VALID', adminNotes: 'Verified' })
          });
        check(verifyRetailerRes.status === 200 && verifyRetailerRes.data?.store?.canSellLottery === true, 'Admin confirming official retailerAuthStatus=VALID unlocks sales');

        // 3. Admin Suspension, Immediate Revocation & Sign-In Flow Resubmission
        console.log('\n--- Step 3: Suspension, Browser Sign-Out & Sign-In Resubmission Flow ---');
        const suspReason = 'Incomplete state lottery retailer certificate — missing official seal.';
          const suspendRes = await api(API_URL, `/api/admin/stores/${encodeURIComponent(storeId)}/suspend`, {
            method: 'POST',
            headers: { 'x-admin-token': adminToken },
            body: JSON.stringify({ reason: suspReason, documentStatus: 'ACTION_REQUIRED' })
          });
        check(suspendRes.status === 200 && suspendRes.data?.store?.softwareAccessStatus === 'SUSPENDED', 'Admin suspension sets softwareAccessStatus=SUSPENDED');

        await evalCode(`(async () => { if (typeof window.refreshStoreComplianceStatus === 'function') await window.refreshStoreComplianceStatus(); })()`);
        await sleep(500);
        const uiSuspendedState = await evalCode(`(() => ({
      signInVisible: document.getElementById('viewSignIn')?.style.display !== 'none',
      tokenGone: !sessionStorage.getItem('lotto_store_token'),
      suspDetailText: document.getElementById('signInSuspendedReasonDetail')?.textContent || '',
      resubBtnVisible: document.getElementById('btnOpenResubmitDocsModal')?.offsetWidth > 0
    }))()`);
        check(
      uiSuspendedState.signInVisible && uiSuspendedState.tokenGone && uiSuspendedState.suspDetailText.includes('missing official seal') && uiSuspendedState.resubBtnVisible,
          'Suspended store signed out to Sign-In with suspension reason & corrected-doc submission accessible'
        );

        const storePosFile = join(tmpDataDir, `pos_state_${storeId}.json`);
        const preservedPos = JSON.parse(readFileSync(storePosFile, 'utf8'));
        check(preservedPos.shiftNumber === 4 && preservedPos.slots?.[0]?.packNumber === '554433', 'Existing inventory and shift state preserved intact on disk');

        await evalCode(`
      document.getElementById('btnOpenResubmitDocsModal')?.click();
      document.getElementById('resubInputIdentifier').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('resubInputPassword').value = ${JSON.stringify(ownerPass)};
      document.getElementById('resubInputRetailerId').value = ${JSON.stringify(retailerId)};
      document.getElementById('resubInputNotes').value = 'Uploaded official stamped certificate PDF.';
      const fixedFile = new File(['Official Sealed Georgia Lottery Retailer Permit'], 'official_stamped_permit.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(fixedFile);
      const inp = document.getElementById('resubInputFiles');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    `);
        await sleep(300);
        await evalCode(`document.getElementById('formResubmitDocuments').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));`);
        await sleep(900);

          const afterResubDetails = await api(API_URL, `/api/admin/stores/${encodeURIComponent(storeId)}/details`, {
            headers: { 'x-admin-token': adminToken }
          });
          check(
      afterResubDetails.data?.store?.documentStatus === 'PENDING_REVIEW' && afterResubDetails.data?.store?.softwareAccessStatus === 'SUSPENDED',
          'Corrected documents queued without self-reactivating POS access'
    );
        await evalCode(`document.getElementById('closeResubDocsModalBtn')?.click()`);

        // 4. Admin UI Reapproval & Restored POS Login
        await evalCode(`
      document.getElementById('inputSignInUser').value = 'admin';
      document.getElementById('inputSignInPass').value = '1234';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
        await sleep(1600);
        await evalCode(`document.querySelector('#adminDashboardSubnav [data-admin-tab="stores"]')?.click();`);
        await sleep(900);
        await evalCode(`document.querySelector('.btn-inspect-store[data-store-id="' + ${JSON.stringify(storeId)} + '"]')?.click();`);
        await sleep(900);
        await evalCode(`
      document.getElementById('adminReapproveNotesInput').value = 'Verified stamped retailer certificate.';
      document.getElementById('adminReapproveConfirmDocs').checked = true;
      document.getElementById('btnAdminConfirmReapprove').click();
    `);
        await sleep(1100);
        await evalCode(`document.getElementById('closeAdminStoreCtrlModalBtn')?.click();`);

        await evalCode(`if (typeof signOutUser === 'function') signOutUser();`);
        await sleep(600);
        await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(ownerPass)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
        await sleep(1600);

        const restoredSession = await evalCode(`(() => ({
      posVisible: document.querySelector('.pos-app-layout')?.style.display === 'flex',
      shiftNumber: state?.shiftNumber,
      packInBox1: state?.slots?.[0]?.packNumber,
      inStockCount: state?.inStockInventory?.length || 0,
      noComplianceBar: document.getElementById('storeComplianceNoticeBar') === null
    }))()`);
        check(
      restoredSession.posVisible && restoredSession.shiftNumber === 4 && restoredSession.packInBox1 === '554433' && restoredSession.inStockCount === 1 && restoredSession.noComplianceBar,
          'Reapproved customer signs back in with preserved inventory and unmodified POS layout'
        );

        console.log('\n====================================================================');
        console.log(`   SUBSCRIPTION & SUSPENSION E2E RESULTS: Passed: ${passed}, Failed: ${failed}`);
        console.log('====================================================================\n');
      } finally {
        try { ws?.close(); } catch (_) { }
        try { chrome.kill(); } catch (_) { }
        try { proxySrv.close(); } catch (_) { }
        try { testServer.kill(); } catch (_) { }
        try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) { }
        try { rmSync(tmpDataDir, { recursive: true, force: true }); } catch (_) { }
      }

      if (failed > 0) process.exit(1);
    }

run().catch((err) => {
      console.error('Subscription & Suspension E2E fatal error:', err);
      process.exit(1);
    });
