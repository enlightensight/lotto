// ============================================================================
// E2E Browser Test: Landing Page Subscription -> Store Account -> POS Launch
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9824;
const E2E_PORT = 3017;
const API_URL = `http://127.0.0.1:${E2E_PORT}`;
const LANDING_URL = `${API_URL}/landing/`;
const WEBHOOK_SECRET = 'whsec_landing_e2e_secret';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function signStripeWebhook(payloadStr, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payloadStr}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}

async function run() {
  console.log('\n====================================================================');
  console.log('   JACKPOTLO LANDING PAGE SUBSCRIPTION -> POS BROWSER E2E TEST      ');
  console.log('====================================================================\n');

  const tmpDataDir = mkdtempSync(join(tmpdir(), 'lotto-landing-e2e-'));
  const chromeUserDir = mkdtempSync(join(tmpdir(), 'lotto-landing-cdp-'));
  let passed = 0;
  let failed = 0;

  function check(cond, msg) {
    if (cond) {
      passed++;
      console.log(`  PASS: ${msg}`);
    } else {
      failed++;
      console.error(`  FAIL: ${msg}`);
    }
  }

  const srvProc = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(E2E_PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      ALLOW_LOCAL_TEST_PAYMENT: 'true',
      TEST_PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
      DATA_DIR: tmpDataDir,
      DB_HOST: '',
      MYSQLHOST: '',
      DATABASE_URL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let chromeProc = null;
  let ws = null;

  try {
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      try {
        const h = await fetch(`${API_URL}/api/health`);
        if (h.ok) {
          healthy = true;
          break;
        }
      } catch (_) {}
    }
    assert(healthy, 'Isolated test server failed to start');

    // 1. Server-side enforcement: unsubscribed registration must be rejected
    const unsubscribedRes = await fetch(`${API_URL}/api/subscriptions/checkout-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'pro',
        billingCycle: 'monthly',
        storeName: 'Bypass Store',
        applicantName: 'No Pay',
        applicantEmail: 'nopay@example.com',
        applicantPhone: '555-0100',
        address: '100 Main St',
        password: 'password123',
        paymentSessionId: 'cs_fake_unpaid'
      })
    });
    const unsubscribedData = await unsubscribedRes.json();
    check(!unsubscribedRes.ok && !unsubscribedData?.success, 'Server blocks account creation without verified subscription payment');

    assert(existsSync(CHROME), `Chrome not found at ${CHROME}`);
    chromeProc = spawn(CHROME, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${chromeUserDir}`,
      LANDING_URL
    ], { stdio: 'ignore' });

    let pageTarget = null;
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      try {
        const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
        pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('/landing'));
        if (pageTarget?.webSocketDebuggerUrl) break;
      } catch (_) {}
    }
    assert(pageTarget?.webSocketDebuggerUrl, 'Chrome CDP failed to connect to /landing/');

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    let msgId = 1;
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      const onMsg = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.id === id) {
          ws.removeEventListener('message', onMsg);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalCode = async (expression) => {
      const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      }
      return r.result?.value;
    };

    await cdp('Runtime.enable');
    await sleep(800);

    // 2. Verify landing page renders Plans, Sign In, and Subscribe Modal
    const uiCheck = await evalCode(`(() => ({
      signInBtns: document.querySelectorAll('.js-open-pos-signin').length,
      planCards: document.querySelectorAll('#landing-plans-grid .plan-card').length,
      modalExists: Boolean(document.getElementById('subscribe-modal')),
      signInHref: document.querySelector('.js-open-pos-signin')?.getAttribute('href') || ''
    }))()`);
    check(uiCheck.signInBtns >= 2 && uiCheck.signInHref.startsWith('/pos'), `Landing page has POS Sign In links (${uiCheck.signInHref})`);
    check(uiCheck.planCards === 3, `Landing page renders 3 subscription plan cards (got ${uiCheck.planCards})`);
    check(uiCheck.modalExists, 'Landing page contains #subscribe-modal signup dialog');

    // 3. Submit with PENDING unconfirmed checkout session fails closed cleanly
    await evalCode(`document.querySelector('.js-select-plan-btn[data-plan-id="pro"]').click()`);
    await sleep(250);
    const modalOpened = await evalCode(`Boolean(document.getElementById('subscribe-modal')?.open)`);
    check(modalOpened, 'Clicking Pro plan button opens #subscribe-modal');

    // 3b. Empty fields submit must show per-field red validation errors & sticky footer alert
    await cdp('Page.enable');
    await evalCode(`document.getElementById('subscribe-account-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))`);
    await sleep(300);
    const emptyValidation = await evalCode(`(() => ({
      errorGroups: document.querySelectorAll('#subscribe-account-form .form-group.has-error').length,
      footerError: document.getElementById('sub-form-feedback')?.textContent || '',
      footerVisible: document.getElementById('sub-form-feedback')?.classList.contains('is-error') || false
    }))()`);
    check(emptyValidation.errorGroups >= 7 && emptyValidation.footerVisible && emptyValidation.footerError.includes('Store / Business Name'),
      `Empty submit highlights ${emptyValidation.errorGroups} invalid fields and shows sticky footer error`);

    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('fs');
    writeFileSync('C:/Users/Admin/.gemini/antigravity/brain/e5d66af5-2b32-406b-b7b2-c5318eae9544/scratch/landing-modal-validation.png', Buffer.from(shot.data, 'base64'));

    const uniqueSuffix = Date.now();
    const storeName = `Landing Mart #${uniqueSuffix}`;
    const ownerUsername = `landingowner_${uniqueSuffix}`;
    const ownerEmail = `${ownerUsername}@example.com`;
    await evalCode(`(() => {
      document.getElementById('sub-store-name').value = ${JSON.stringify(storeName)};
      document.getElementById('sub-owner-name').value = 'Jordan Lee';
      document.getElementById('sub-email').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('sub-phone').value = '404-555-0192';
      document.getElementById('sub-address').value = '500 Peachtree St, Atlanta, GA 30308';
      document.getElementById('sub-username').value = ${JSON.stringify(ownerUsername)};
      document.getElementById('sub-password').value = 'SecretPass99!';
      document.getElementById('sub-retailer-id').value = ${JSON.stringify('GA-' + String(uniqueSuffix).slice(-6))};
      document.getElementById('subscribe-account-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(1000);

    const pendingResult = await evalCode(`({
      feedback: document.getElementById('sub-form-feedback')?.textContent || '',
      hasToken: Boolean(localStorage.getItem('lotto_store_token'))
    })`);
    check(pendingResult.feedback.includes('PENDING') && !pendingResult.hasToken, `Unconfirmed PENDING checkout cannot activate account ("${pendingResult.feedback}")`);

    // 4. Verified payment flow: create session + deliver signed webhook -> Stripe return URL opens modal & completes activation
    const csRes = await (await fetch(`${API_URL}/api/payments/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly', returnPath: '/landing/' })
    })).json();
    assert(csRes?.success && csRes?.sessionId, 'Created test checkout session');

    const paidPayload = JSON.stringify({
      id: `evt_landing_${uniqueSuffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: csRes.sessionId,
          amount_total: csRes.amountCents,
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
    check(whRes.status === 200, 'Signed payment webhook confirmed subscription payment server-side');

    // Save non-sensitive draft before navigating back with ?checkout_session_id= (simulating Stripe return)
    await evalCode(`(() => {
      localStorage.setItem('jackpotlo_landing_checkout_draft', JSON.stringify({
        planId: 'pro',
        billingCycle: 'monthly',
        storeName: ${JSON.stringify(storeName)},
        applicantName: 'Jordan Lee',
        applicantEmail: ${JSON.stringify(ownerEmail)},
        applicantPhone: '404-555-0192',
        address: '500 Peachtree St, Atlanta, GA 30308',
        username: ${JSON.stringify(ownerUsername)},
        lotteryRetailerId: ${JSON.stringify('GA-' + String(uniqueSuffix).slice(-6))}
      }));
      window.location.href = ${JSON.stringify(`${LANDING_URL}?checkout_session_id=${csRes.sessionId}`)};
    })()`);
    await sleep(1200);

    const returnModalState = await evalCode(`({
      modalOpen: Boolean(document.getElementById('subscribe-modal')?.open),
      restoredStore: document.getElementById('sub-store-name')?.value || '',
      feedback: document.getElementById('sub-form-feedback')?.textContent || ''
    })`);
    check(returnModalState.modalOpen && returnModalState.restoredStore === storeName, `Stripe return auto-opened modal & restored draft store "${returnModalState.restoredStore}"`);

    await evalCode(`(() => {
      document.getElementById('sub-password').value = 'SecretPass99!';
      document.getElementById('subscribe-account-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(1400);

    const regResult = await evalCode(`(() => {
      const panel = document.getElementById('sub-success-panel');
      const token = localStorage.getItem('lotto_store_token') || '';
      const sess = JSON.parse(localStorage.getItem('lotto_session_user') || '{}');
      return {
        successVisible: Boolean(panel && !panel.hidden),
        subStatus: document.getElementById('sub-status-sub')?.textContent,
        accessStatus: document.getElementById('sub-status-access')?.textContent,
        docsStatus: document.getElementById('sub-status-docs')?.textContent,
        retailerStatus: document.getElementById('sub-status-retailer')?.textContent,
        tokenParts: token.split('.').length,
        storeId: sess.storeId || '',
        username: sess.username || ''
      };
    })()`);
    check(regResult.successVisible, 'Verified subscription completed and revealed confirmation panel');
    check(regResult.subStatus === 'ACTIVE' && regResult.accessStatus === 'ACTIVE', 'Statuses show Subscription=ACTIVE and Software Access=ACTIVE');
    check(regResult.docsStatus === 'PENDING_REVIEW' && regResult.retailerStatus === 'PENDING_VERIFICATION', 'Statuses keep Documents=PENDING_REVIEW and Retailer Auth=PENDING_VERIFICATION');
    check(regResult.tokenParts === 3 && Boolean(regResult.storeId) && regResult.username === ownerUsername, 'Store JWT and session payload stored for immediate POS entry');

    // 5. Launch POS directly from confirmation CTA
    await evalCode(`document.getElementById('sub-launch-pos-btn').click()`);
    await sleep(1800);

    const posState = await evalCode(`(() => ({
      url: window.location.pathname,
      signInHidden: document.getElementById('viewSignIn')?.style.display === 'none' || getComputedStyle(document.getElementById('viewSignIn')).display === 'none',
      posVisible: document.querySelector('.pos-app-layout')?.style.display === 'flex'
    }))()`);
    check(posState.url === '/pos', `Launched POS route (/pos), got ${posState.url}`);
    check(posState.signInHidden && posState.posVisible, 'Subscribed user entered live POS counter immediately without blocked login');

    // 6. Test navbar "Sign In" redirects directly to POS Sign-In screen (#viewSignIn) even when session exists
    await evalCode(`window.location.href = ${JSON.stringify(LANDING_URL)}`);
    await sleep(900);

    await evalCode(`document.querySelector('.nav-actions .js-open-pos-signin').click()`);
    await sleep(1600);
    const redirectedSignIn = await evalCode(`(() => ({
      url: window.location.pathname + window.location.search,
      signInVisible: Boolean(document.getElementById('viewSignIn')) && getComputedStyle(document.getElementById('viewSignIn')).display !== 'none',
      posHidden: document.querySelector('.pos-app-layout')?.style.display !== 'flex'
    }))()`);
    check(redirectedSignIn.url === '/pos?signin=1' && redirectedSignIn.signInVisible, `Navbar "Sign In" redirects directly to POS login screen (${redirectedSignIn.url})`);

    // Sign in through #signInMainForm on POS screen and enter POS
    await evalCode(`(() => {
      document.getElementById('inputSignInUser').value = ${JSON.stringify(ownerUsername)};
      document.getElementById('inputSignInPass').value = 'SecretPass99!';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(1800);
    const signedInPos = await evalCode(`(() => ({
      tokenPresent: (localStorage.getItem('lotto_store_token') || '').split('.').length === 3,
      signInHidden: getComputedStyle(document.getElementById('viewSignIn')).display === 'none',
      posVisible: document.querySelector('.pos-app-layout')?.style.display === 'flex'
    }))()`);
    check(signedInPos.tokenPresent && signedInPos.signInHidden && signedInPos.posVisible, 'POS Sign-In screen authenticates newly created account and opens live POS');
  } finally {
    try { ws?.close(); } catch (_) {}
    try { chromeProc?.kill('SIGKILL'); } catch (_) {}
    try { srvProc?.kill('SIGKILL'); } catch (_) {}
    await sleep(300);
    try { rmSync(chromeUserDir, { recursive: true, force: true }); } catch (_) {}
    try { rmSync(tmpDataDir, { recursive: true, force: true }); } catch (_) {}
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
