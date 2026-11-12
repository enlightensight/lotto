import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BASE_API = 'http://127.0.0.1:3001';
const FRONTEND_URL = 'http://127.0.0.1:5173/';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544';
const CDP_PORT = 9884;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (!cond) {
    console.error(`  ✗ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`  ✓ PASS: ${msg}`);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE_API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runApiMatrix() {
  console.log('\n--- Part 1: API Auth Matrix & Cross-Store Token Isolation ---');

  const rAdmOk = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'aj123456@' }) });
  assert(rAdmOk.status === 200 && rAdmOk.data?.isAdmin === true && rAdmOk.data?.storeId === 'store_admin', 'admin + aj123456@ logs into ADMIN (store_admin)');

  const rAdmId = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'adm_001', password: 'aj123456@' }) });
  assert(rAdmId.status === 200 && rAdmId.data?.isAdmin === true, 'adm_001 + aj123456@ logs into ADMIN');

  const rAdmBad1 = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: '1234' }) });
  assert(rAdmBad1.status === 401 && rAdmBad1.data?.success === false, 'admin + wrong password "1234" rejected with 401');

  const rAdmBad2 = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'AX123456@' }) });
  assert(rAdmBad2.status === 401 && rAdmBad2.data?.success === false, 'admin + anish password "AX123456@" rejected with 401');

  const rAmigo = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'amigo', password: '0000' }) });
  assert(rAmigo.status === 200 && rAmigo.data?.isAdmin === false && rAmigo.data?.storeId === 'store_amigo', 'amigo + 0000 logs into store_amigo');

  const rAmigoById = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'store_amigo', password: '0000' }) });
  assert(rAmigoById.status === 200 && rAmigoById.data?.storeId === 'store_amigo', 'store_amigo ID + 0000 logs into store_amigo');

  const rSharedStore = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'amigofoodmart2300@gmail.com', password: '0000' }) });
  assert(rSharedStore.status === 200 && rSharedStore.data?.isAdmin === false && rSharedStore.data?.storeId === 'store_amigo', 'shared email + 0000 resolves to store_amigo');

  const rSharedAdm = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'amigofoodmart2300@gmail.com', password: 'aj123456@' }) });
  assert(rSharedAdm.status === 200 && rSharedAdm.data?.isAdmin === true && rSharedAdm.data?.storeId === 'store_admin', 'shared email + aj123456@ resolves to ADMIN');

  const rAnish = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'anish', password: 'AX123456@' }) });
  assert(rAnish.status === 200 && rAnish.data?.isAdmin === false && rAnish.data?.storeId === 'store_anish', 'anish + AX123456@ logs into store_anish');

  const rAnishById = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'store_anish', password: 'AX123456@' }) });
  assert(rAnishById.status === 200 && rAnishById.data?.storeId === 'store_anish', 'store_anish ID + AX123456@ logs into store_anish');

  const rAnishBad = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'anish', password: '0000' }) });
  assert(rAnishBad.status === 401, 'anish + amigo password "0000" rejected with 401');

  const amigoToken = rAmigo.data.token;
  const anishToken = rAnish.data.token;
  const adminToken = rAdmOk.data.token;

  // Cross-store token enforcement
  const crossLoadAdmin = await api('/api/load-pos-state?storeId=store_admin', { headers: { 'x-store-token': amigoToken, Authorization: `Bearer ${amigoToken}` } });
  assert(crossLoadAdmin.status === 403 && crossLoadAdmin.data?.code === 'STORE_ACCESS_DENIED', 'amigo token blocked (403) from loading store_admin');

  const crossLoadAnish = await api('/api/load-pos-state?storeId=store_anish', { headers: { 'x-store-token': amigoToken, Authorization: `Bearer ${amigoToken}` } });
  assert(crossLoadAnish.status === 403 && crossLoadAnish.data?.code === 'STORE_ACCESS_DENIED', 'amigo token blocked (403) from loading store_anish');

  const crossSyncAdmin = await api('/api/sync-pos-state?storeId=store_admin', {
    method: 'POST',
    headers: { 'x-store-token': anishToken, Authorization: `Bearer ${anishToken}` },
    body: JSON.stringify({ storeId: 'store_admin', state: { storeId: 'store_admin', storeName: 'ANISH HIJACK' } })
  });
  assert(crossSyncAdmin.status === 403 && crossSyncAdmin.data?.code === 'STORE_ACCESS_DENIED', 'anish token blocked (403) from overwriting store_admin');

  const ownAmigo = await api('/api/load-pos-state?storeId=store_amigo', { headers: { 'x-store-token': amigoToken, 'x-store-id': 'store_amigo' } });
  assert(ownAmigo.status === 200 && ownAmigo.data?.state?.storeName === 'AMIGO FOOD MART', 'amigo token reads AMIGO FOOD MART state');

  const ownAnish = await api('/api/load-pos-state?storeId=store_anish', { headers: { 'x-store-token': anishToken, 'x-store-id': 'store_anish' } });
  assert(ownAnish.status === 200 && ownAnish.data?.state?.storeName === 'ANISH STORE', 'anish token reads ANISH STORE state');

  const admRead = await api('/api/load-pos-state?storeId=store_admin', { headers: { 'x-admin-token': adminToken, 'x-store-id': 'store_admin' } });
  assert(admRead.status === 200 && admRead.data?.state?.storeName === 'ADMIN STORE', 'admin token reads ADMIN STORE state');

  // Revocation on logout
  const rOut = await api('/api/auth/logout', { method: 'POST', headers: { 'x-store-token': anishToken, Authorization: `Bearer ${anishToken}` } });
  assert(rOut.status === 200 && rOut.data?.success === true, 'logout endpoint revokes store token');
  const afterOut = await api('/api/load-pos-state?storeId=store_anish', { headers: { 'x-store-token': anishToken } });
  assert(afterOut.status === 403 && afterOut.data?.code === 'SESSION_REVOKED', 'revoked store token rejected with 403 SESSION_REVOKED');
}

async function runBrowserSequence() {
  console.log('\n--- Part 2: Single-Profile Real Browser Cross-Role & Admin->POS Isolation E2E ---');
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-isolation-e2e-'));
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    FRONTEND_URL
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
        targets = await res.json();
        if (Array.isArray(targets) && targets.some(t => t.type === 'page')) break;
      } catch (_) { }
      await sleep(200);
    }
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };
    const send = (method, params = {}) => new Promise(resolve => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
    await new Promise(r => { ws.onopen = r; });
    await send('Runtime.enable');
    await send('Page.enable');

    const evalJS = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return r?.result?.value;
    };
    const shot = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(ARTIFACT_DIR, name), Buffer.from(data, 'base64'));
      console.log(`  📸 Screenshot saved: ${name}`);
    };
    const signIn = async (u, p) => {
      await evalJS(`(() => {
        const ui = document.getElementById('inputSignInUser');
        const pi = document.getElementById('inputSignInPass');
        ui.value = ${JSON.stringify(u)};
        ui.dispatchEvent(new Event('input', { bubbles: true }));
        pi.value = ${JSON.stringify(p)};
        pi.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()`);
      await sleep(1400);
    };

    await sleep(1200);
    // Ensure we start signed out on signIn screen even in headless Chrome
    await evalJS(`window.signOutUser?.()`);
    await sleep(400);

    // Step 1: Login amigo (0000) -> verify AMIGO FOOD MART -> Sign out
    await signIn('amigo', '0000');
    const amigoState = await evalJS(`({
      sid: window.getCurrentStoreId?.(),
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim(),
      admTok: localStorage.getItem('lotto_admin_token'),
      strTok: !!localStorage.getItem('lotto_store_token')
    })`);
    assert(amigoState.sid === 'store_amigo' && amigoState.brand === 'AMIGO FOOD MART' && !amigoState.admTok && amigoState.strTok, 'Browser: amigo -> AMIGO FOOD MART (store_amigo, no admin token)');

    await evalJS(`document.getElementById('menuSignOutBtn')?.click()`);
    await sleep(500);

    // Step 2: Login anish (AX123456@) -> verify ANISH STORE -> reload -> Sign out
    await signIn('anish', 'AX123456@');
    let anishState = await evalJS(`({
      sid: window.getCurrentStoreId?.(),
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim(),
      sub: document.getElementById('dashboardSubtitle')?.textContent?.trim(),
      stateName: window.state?.storeName
    })`);
    assert(anishState.sid === 'store_anish' && anishState.brand === 'ANISH STORE' && anishState.stateName === 'ANISH STORE', `Browser: anish -> ANISH STORE (got "${anishState.brand}")`);

    await send('Page.reload', {});
    await sleep(1500);
    anishState = await evalJS(`({
      sid: window.getCurrentStoreId?.(),
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim()
    })`);
    assert(anishState.sid === 'store_anish' && anishState.brand === 'ANISH STORE', 'Browser: reload preserves ANISH STORE');

    await evalJS(`document.getElementById('menuSignOutBtn')?.click()`);
    await sleep(500);

    // Step 3: Wrong admin password ("1234") MUST fail visibly
    await signIn('admin', '1234');
    const badAdmErr = await evalJS(`({
      errVisible: document.getElementById('signInErrorAlert')?.style.display,
      errText: document.getElementById('signInErrorAlert')?.textContent?.trim(),
      signInVisible: document.getElementById('viewSignIn')?.style.display
    })`);
    assert(badAdmErr.errVisible === 'block' && badAdmErr.signInVisible === 'flex', `Browser: wrong admin password blocked on sign-in ("${badAdmErr.errText}")`);

    // Step 4: Right admin password -> Admin Dashboard -> click Switch to Store POS -> verify ADMIN STORE!
    await signIn('admin', 'aj123456@');
    const admDashState = await evalJS(`({
      hash: window.location.hash,
      dashDisplay: document.getElementById('viewAdminDashboard')?.style.display,
      strTok: localStorage.getItem('lotto_store_token'),
      admTok: !!localStorage.getItem('lotto_admin_token'),
      sid: window.getCurrentStoreId?.(),
      diskName: window.state?.storeName
    })`);
    assert(admDashState.hash === '#admin' && admDashState.dashDisplay === 'flex' && !admDashState.strTok && admDashState.admTok && admDashState.sid === 'store_admin', 'Browser: admin opens #admin with clean store_admin & no store token');

    await evalJS(`document.getElementById('btnAdminTopSwitchPos')?.click()`);
    await sleep(1200);
    let switchedState = await evalJS(`({
      hash: window.location.hash,
      dashDisplay: document.getElementById('viewAdminDashboard')?.style.display,
      posDisplay: document.querySelector('.pos-app-layout')?.style.display,
      sid: window.getCurrentStoreId?.(),
      stateSid: window.state?.storeId,
      stateName: window.state?.storeName,
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim(),
      sub: document.getElementById('dashboardSubtitle')?.textContent?.trim()
    })`);
    assert(
      switchedState.dashDisplay === 'none' &&
      switchedState.posDisplay === 'flex' &&
      switchedState.sid === 'store_admin' &&
      switchedState.stateSid === 'store_admin' &&
      switchedState.brand === 'ADMIN STORE' &&
      switchedState.sub?.includes('ADMIN STORE'),
      `Browser: Switch to Store POS opens ADMIN STORE (got sid=${switchedState.sid}, brand=${switchedState.brand}, sub=${switchedState.sub})`
    );
    await shot('verified-admin-switch-pos-store.png');

    // Step 5: Reload page while in Admin Store POS -> MUST stay in ADMIN STORE (not Amigo, not Anish, not bounced away)
    await send('Page.reload', {});
    await sleep(1500);
    switchedState = await evalJS(`({
      dashDisplay: document.getElementById('viewAdminDashboard')?.style.display,
      posDisplay: document.querySelector('.pos-app-layout')?.style.display,
      sid: window.getCurrentStoreId?.(),
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim()
    })`);
    assert(
      switchedState.dashDisplay === 'none' &&
      switchedState.posDisplay === 'flex' &&
      switchedState.sid === 'store_admin' &&
      switchedState.brand === 'ADMIN STORE',
      `Browser: reload while in Admin Store POS stays ADMIN STORE (got sid=${switchedState.sid}, brand=${switchedState.brand})`
    );

    // Step 6: Sign out from Admin POS & login with shared email + 0000 -> verify AMIGO FOOD MART
    await evalJS(`document.getElementById('menuSignOutBtn')?.click()`);
    await sleep(500);
    await signIn('amigofoodmart2300@gmail.com', '0000');
    const sharedAmigo = await evalJS(`({
      sid: window.getCurrentStoreId?.(),
      brand: document.getElementById('sidebarStoreName')?.textContent?.trim(),
      dashDisplay: document.getElementById('viewAdminDashboard')?.style.display
    })`);
    assert(sharedAmigo.sid === 'store_amigo' && sharedAmigo.brand === 'AMIGO FOOD MART' && sharedAmigo.dashDisplay !== 'flex', 'Browser: shared email + 0000 opens AMIGO FOOD MART cleanly');
    await shot('verified-amigo-clean-isolation.png');

    // Step 7: Confirm server_data/pos_state_store_admin.json remains uncorrupted
    const diskAdmin = JSON.parse(readFileSync('server_data/pos_state_store_admin.json', 'utf8'));
    assert(diskAdmin.storeId === 'store_admin' && diskAdmin.storeName === 'ADMIN STORE', 'Disk: pos_state_store_admin.json remained cleanly ADMIN STORE');

    ws.close();
  } finally {
    chrome.kill();
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) { }
  }
}

(async () => {
  await runApiMatrix();
  await runBrowserSequence();
  console.log(`\n================================================================`);
  console.log(` E2E COMPLETE: ${passed}/${total} ASSERTIONS PASSED!`);
  console.log(`================================================================\n`);
})().catch(err => {
  console.error('\n❌ E2E FAILED:', err);
  process.exit(1);
});

