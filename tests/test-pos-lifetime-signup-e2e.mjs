// ============================================================================
// E2E Browser Test: POS #viewSignIn "Sign Up" ($179 Lifetime) -> Immediate POS
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9825;
const E2E_PORT = 3018;
const API_URL = `http://127.0.0.1:${E2E_PORT}`;
const POS_SIGNIN_URL = `${API_URL}/pos?signin=1`;
const WEBHOOK_SECRET = 'whsec_pos_lifetime_e2e_secret';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function signStripeWebhook(payloadStr, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${payloadStr}`).digest('hex');
  return `t=${ts},v1=${sig}`;
}

async function run() {
  console.log('\n====================================================================');
  console.log('   POS SIGN UP ($179 LIFETIME + STORE NAME + MOBILE + OPT EMAIL) E2E ');
  console.log('====================================================================\n');

  const tmpDataDir = mkdtempSync(join(tmpdir(), 'lotto-pos-signup-e2e-'));
  const chromeUserDir = mkdtempSync(join(tmpdir(), 'lotto-pos-signup-cdp-'));
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
      } catch (_) { }
    }
    assert(healthy, 'Isolated E2E server failed to start');

    // 1. Server-side checks for $179 lifetime plan
    const plansRes = await (await fetch(`${API_URL}/api/subscription/plans`)).json();
    check(plansRes?.success && Array.isArray(plansRes.plans) && plansRes.plans.length === 3,
      `Public /api/subscription/plans unchanged (${plansRes?.plans?.length} plans)`);

    const unpaidRes = await fetch(`${API_URL}/api/subscriptions/checkout-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'lifetime',
        billingCycle: 'lifetime',
        storeName: 'Unpaid Mart',
        applicantPhone: '4785550101'
      })
    });
    check(unpaidRes.status === 402, `Unpaid lifetime registration rejected with 402 (got ${unpaidRes.status})`);

    const csApi = await (await fetch(`${API_URL}/api/payments/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'lifetime', billingCycle: 'lifetime' })
    })).json();
    check(csApi?.success && csApi.amountCents === 17900,
      `create-checkout-session('lifetime') charges $179.00 (${csApi?.amountCents} cents)`);

    // 2. Open POS Sign-In screen in headless Chrome CDP
    chromeProc = spawn(CHROME, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1366,900',
      `--user-data-dir=${chromeUserDir}`,
      POS_SIGNIN_URL
    ], { stdio: 'ignore' });

    let pageWsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      try {
        const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
        const page = targets.find((t) => t.type === 'page' && t.url.includes(`127.0.0.1:${E2E_PORT}`));
        if (page) {
          pageWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (_) { }
    }
    assert(pageWsUrl, 'Chrome CDP page target not ready');

    ws = new WebSocket(pageWsUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    let msgId = 0;
    function cdp(method, params = {}) {
      const id = ++msgId;
      return new Promise((resolve, reject) => {
        function onMsg(ev) {
          const d = JSON.parse(ev.data);
          if (d.id === id) {
            ws.removeEventListener('message', onMsg);
            if (d.error) reject(new Error(d.error.message));
            else resolve(d.result);
          }
        }
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evalCode(expression) {
      const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'Eval error');
      return r.result?.value;
    }

    await cdp('Runtime.enable');
    await cdp('Page.enable');
    await sleep(900);

    // 3. Verify Sign In button rename + open Sign Up modal
    const signInBtnInfo = await evalCode(`(() => {
      const signInView = document.getElementById('viewSignIn');
      const btn = document.getElementById('btnOpenStoreAppModal');
      return {
        signInActive: Boolean(signInView && getComputedStyle(signInView).display !== 'none'),
        btnText: btn?.textContent?.trim() || ''
      };
    })()`);
    check(signInBtnInfo.signInActive, '#viewSignIn is visible on /pos?signin=1');
    check(signInBtnInfo.btnText === 'Sign Up', `Button renamed strictly to "Sign Up" (got "${signInBtnInfo.btnText}")`);

    await evalCode(`document.getElementById('btnOpenStoreAppModal').click()`);
    await sleep(400);

    const modalAudit = await evalCode(`(() => {
      const modal = document.getElementById('modalStoreApplication');
      const form = document.getElementById('formSubmitStoreApp');
      const visibleInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .map(el => ({ id: el.id, type: el.type, required: el.required }));
      return {
        open: Boolean(modal?.open),
        planRadios: form.querySelectorAll('input[name="appSubscriptionPlan"]').length,
        hasOwnerName: Boolean(document.getElementById('appInputOwnerName')),
        hasPassword: Boolean(document.getElementById('appInputPassword')),
        hasAddress: Boolean(document.getElementById('appInputAddress')),
        hasDropzone: Boolean(document.getElementById('appLicenseDropzone')),
        hiddenPlanId: document.getElementById('appPlanId')?.value || '',
        hiddenBillingCycle: document.getElementById('appBillingCycle')?.value || '',
        submitText: document.getElementById('btnSubmitStoreApp')?.textContent?.trim() || '',
        modalText: modal?.textContent || '',
        visibleInputs
      };
    })()`);

    check(modalAudit.open, 'Clicking "Sign Up" opens #modalStoreApplication');
    check(modalAudit.modalText.includes('$179') && modalAudit.modalText.includes('Lifetime'),
      'Modal displays $179 Lifetime subscription');
    check(modalAudit.hiddenPlanId === 'lifetime' && modalAudit.hiddenBillingCycle === 'lifetime',
      'Hidden plan/billing set to lifetime');
    check(
      modalAudit.visibleInputs.length === 3 &&
      modalAudit.visibleInputs[0].id === 'appInputStoreName' && modalAudit.visibleInputs[0].required === true &&
      modalAudit.visibleInputs[1].id === 'appInputPhone' && modalAudit.visibleInputs[1].required === true &&
      modalAudit.visibleInputs[2].id === 'appInputEmail' && modalAudit.visibleInputs[2].required === false,
      `Modal has ONLY 3 inputs: Store Name (*), Store Mobile Number (*), Email (optional) -> ${JSON.stringify(modalAudit.visibleInputs)}`
    );
    check(!modalAudit.hasOwnerName && !modalAudit.hasPassword && !modalAudit.hasAddress && !modalAudit.hasDropzone && modalAudit.planRadios === 0,
      'Old extra plans, owner name, password, address, and document upload fields removed');

    const modalShot = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync('C:/Users/Admin/.gemini/antigravity/brain/e5d66af5-2b32-406b-b7b2-c5318eae9544/verified-pos-lifetime-signup-modal.png', Buffer.from(modalShot.data, 'base64'));

    // 4. Client validation checks (empty fields + short mobile + bad optional email)
    await evalCode(`document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))`);
    await sleep(200);
    const err1 = await evalCode(`document.getElementById('storeAppFeedbackAlert')?.textContent || ''`);
    check(err1.includes('Store Name'), `Empty Store Name blocked with error: "${err1}"`);

    await evalCode(`(() => {
      document.getElementById('appInputStoreName').value = 'Lucky Star Mart';
      document.getElementById('appInputPhone').value = '123';
      document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(200);
    const err2 = await evalCode(`document.getElementById('storeAppFeedbackAlert')?.textContent || ''`);
    check(err2.includes('Store Mobile Number'), `Invalid/short Store Mobile Number blocked with error: "${err2}"`);

    await evalCode(`(() => {
      document.getElementById('appInputPhone').value = '(478) 555-0199';
      document.getElementById('appInputEmail').value = 'not-an-email';
      document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);
    await sleep(200);
    const err3 = await evalCode(`document.getElementById('storeAppFeedbackAlert')?.textContent || ''`);
    check(err3.includes('Email'), `Invalid optional Email blocked with error: "${err3}"`);

    // 5. Verified $179 Lifetime payment with Email left BLANK -> immediate POS entry
    const paidWebhookPayload = JSON.stringify({
      id: `evt_pos_life_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: csApi.sessionId,
          amount_total: csApi.amountCents,
          currency: 'usd',
          payment_status: 'paid',
          metadata: { planId: 'lifetime', billingCycle: 'lifetime' }
        }
      }
    });
    const whRes = await fetch(`${API_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(paidWebhookPayload, WEBHOOK_SECRET) },
      body: paidWebhookPayload
    });
    check(whRes.status === 200, 'Signed webhook marked $179 lifetime session PAID');

    await evalCode(`(() => {
      window.__verifiedCheckoutSessionId = ${JSON.stringify(csApi.sessionId)};
      document.getElementById('appInputStoreName').value = 'Lucky Star Mart';
      document.getElementById('appInputPhone').value = '(478) 555-0199';
      document.getElementById('appInputEmail').value = '';
      document.getElementById('btnSubmitStoreApp').click();
    })()`);
    await sleep(1400);

    const posEntered = await evalCode(`(() => {
      const signInView = document.getElementById('viewSignIn');
      return {
        modalOpen: Boolean(document.getElementById('modalStoreApplication')?.open),
        hasToken: Boolean(localStorage.getItem('lotto_store_token')),
        signInActive: Boolean(signInView && getComputedStyle(signInView).display !== 'none')
      };
    })()`);
    check(posEntered.hasToken && !posEntered.modalOpen && !posEntered.signInActive,
      'Paid $179 Lifetime signup (without optional Email) entered live POS immediately');

    // 6. Second store without email can ALSO sign up cleanly (no empty-email conflict!)
    const csApi2 = await (await fetch(`${API_URL}/api/payments/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'lifetime', billingCycle: 'lifetime' })
    })).json();
    const whPayload2 = JSON.stringify({
      id: `evt_pos_life2_${Date.now()}`,
      type: 'checkout.session.completed',
      data: { object: { id: csApi2.sessionId, amount_total: csApi2.amountCents, currency: 'usd', payment_status: 'paid' } }
    });
    await fetch(`${API_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': signStripeWebhook(whPayload2, WEBHOOK_SECRET) },
      body: whPayload2
    });
    const reg2 = await fetch(`${API_URL}/api/subscriptions/checkout-and-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: 'lifetime',
        billingCycle: 'lifetime',
        paymentSessionId: csApi2.sessionId,
        storeName: 'Lucky Star Mart',
        applicantPhone: '4785550188',
        applicantEmail: ''
      })
    });
    const reg2Data = await reg2.json();
    check(reg2.status === 201 && reg2Data.success && reg2Data.subscription?.amountPaid === 179 && reg2Data.subscription?.planId === 'lifetime',
      `Second store without email activates $179 Lifetime plan cleanly (username: ${reg2Data?.user?.username})`);

    console.log(`\nSummary: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    try { ws?.close(); } catch (_) { }
    try { chromeProc?.kill(); } catch (_) { }
    try { srvProc.kill(); } catch (_) { }
    await sleep(300);
    rmSync(tmpDataDir, { recursive: true, force: true });
    rmSync(chromeUserDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
