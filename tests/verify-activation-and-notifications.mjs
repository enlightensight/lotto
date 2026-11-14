import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9879;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log(' VERIFY: ACTIVATION STATE, TOP-RIGHT TOASTS & BLUR REMOVAL     ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-verify-act-'));
  const chromeProcess = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'http://127.0.0.1:5173/app/?bypass_login=1'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
        targets = await res.json();
        break;
      } catch (_) {
        await sleep(200);
      }
    }

    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((r) => { ws.onopen = r; });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('EVAL EXCEPTION:', res.exceptionDetails);
      }
      return res.result?.value;
    }

    // Wait for POS app to initialize
    for (let i = 0; i < 30; i++) {
      const ready = await evaluate(`typeof window.handleSetBoxForTicket === 'function' && Boolean(window.state)`);
      if (ready) break;
      await sleep(200);
    }

    console.log('Step 1: POS Application Loaded and Initialized');

    // -------------------------------------------------------------
    // CHECK 1: Backdrop Blur Removal
    // -------------------------------------------------------------
    console.log('\n--- CHECK 1: BACKDROP BLUR REMOVAL ---');
    const backdropInfo = await evaluate(`(() => {
      const dlg = document.getElementById('setBoxModal');
      dlg.showModal();
      const cs = window.getComputedStyle(dlg, '::backdrop');
      const blur = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
      const bg = cs.backgroundColor || '';
      dlg.close();
      return { blur, bg };
    })()`);

    console.log('Backdrop Info:', backdropInfo);
    assert(backdropInfo.blur === 'none' || !backdropInfo.blur.includes('blur'), 'Modal ::backdrop has NO blur effect (backdrop-filter: none)');

    // -------------------------------------------------------------
    // CHECK 2: Top-Right Toast Notifications
    // -------------------------------------------------------------
    console.log('\n--- CHECK 2: NOTIFICATION POSITION (TOP-RIGHT) ---');

    // Toast while modal is open
    const modalToast = await evaluate(`(() => {
      const dlg = document.getElementById('setBoxModal');
      dlg.showModal();
      window.showToast('Test Warning: Duplicate active assignment prevented.', 'error');
      const toast = dlg.querySelector('.toast-error') || document.querySelector('.toast-error') || document.querySelector('.toast');
      if (!toast) return { found: false };
      const rect = toast.getBoundingClientRect();
      const container = toast.parentElement;
      const contRect = container.getBoundingClientRect();
      const cs = window.getComputedStyle(toast);
      dlg.close();
      return {
        found: true,
        top: rect.top,
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom,
        bg: cs.backgroundColor,
        color: cs.color,
        contClass: container.className,
        contTop: contRect.top,
        contRight: window.innerWidth - contRect.right
      };
    })()`);

    console.log('Modal Toast Rect:', modalToast);
    assert(modalToast.found, 'Toast is rendered while modal is open');
    assert(modalToast.bottom > 200, `Toast is NOT at the bottom of the screen (bottom: ${modalToast.bottom}px)`);

    // Toast without modal open: User requested NO floating popup toast message box on Dashboard!
    // Messages route into #lastScanReadoutContainer and zero floating popups appear.
    const dashboardCheck = await evaluate(`(() => {
      window.showToast('✓ Box #6 activated with Jumbo Brew Bucks!', 'success');
      const cardTitle = document.getElementById('scanActionTitle')?.textContent?.trim();
      const cardDisplay = document.getElementById('lastScanDisplay')?.textContent?.trim();
      const cardBadge = document.getElementById('largeStatReadout')?.textContent?.trim();
      const tc = document.getElementById('toastContainer');
      const isTcHidden = !tc || getComputedStyle(tc).display === 'none';

      return {
        cardTitle,
        cardDisplay,
        cardBadge,
        isTcHidden
      };
    })()`);

    console.log('Dashboard Message Result (No Floating Popup):', dashboardCheck);
    assert(dashboardCheck.cardTitle.includes('Box #6 activated') || dashboardCheck.cardDisplay.includes('Jumbo Brew Bucks'), 'Card displays activation message');
    assert(dashboardCheck.isTcHidden, 'Floating popup toast container is completely hidden on Dashboard');

    // -------------------------------------------------------------
    // CHECK 3: False Duplicate Pack Activation
    // -------------------------------------------------------------
    console.log('\n--- CHECK 3: FALSE DUPLICATE PACK ACTIVATION CHECKS ---');

    // Case B: Staged / Inactive assignment in Box 4 (needsActivation: true)
    // Attempting to activate Game 1910, Pack 001662-4 into Box 6 MUST SUCCEED!
    const caseBResult = await evaluate(`(() => {
      const s = window.state;
      s.slots.forEach(sl => {
        if (Number(sl.boxNumber) !== 4 && sl.packNumber && (sl.packNumber.includes('001662') || sl.packNumber === '0016624')) {
          sl.status = 'EMPTY';
          sl.packNumber = null;
          sl.gameName = null;
        }
      });
      const b4 = s.slots.find(sl => Number(sl.boxNumber) === 4);
      const b6 = s.slots.find(sl => Number(sl.boxNumber) === 6);

      b4.status = 'ACTIVE';
      b4.needsActivation = true;
      b4.gameId = '1910';
      b4.barcodePrefix = '1910';
      b4.gameName = 'Jumbo Brew Bucks';
      b4.packNumber = '0016624';
      b4.startTicket = 0;
      b4.currentTicket = 0;

      b6.status = 'EMPTY';
      b6.needsActivation = false;
      b6.gameName = null;
      b6.packNumber = null;

      const success = window.handleSetBoxForTicket(6, '19100016624000', { id: '1910', name: 'Jumbo Brew Bucks', price: 2 });
      const afterB4 = s.slots.find(sl => Number(sl.boxNumber) === 4);
      const afterB6 = s.slots.find(sl => Number(sl.boxNumber) === 6);

      return {
        success,
        lastToast: window.__lastToast,
        b4Status: afterB4.status,
        b4Pack: afterB4.packNumber,
        b6Status: afterB6.status,
        b6Pack: afterB6.packNumber,
        b6NeedsActivation: afterB6.needsActivation
      };
    })()`);

    console.log('Case B Result:', caseBResult);
    assert(caseBResult.success, 'Case B: Activating Box 6 succeeds when Box 4 only had staged/inactive assignment');
    assert(caseBResult.b6Status === 'ACTIVE', 'Box 6 is now ACTIVE');
    assert(caseBResult.b6NeedsActivation === false, 'Box 6 is fully active (needsActivation: false)');
    assert(caseBResult.b4Status === 'EMPTY', 'Old staged Box 4 is reset to EMPTY');

    // Case A: Exact pack is GENUINELY active in Box 4.
    // Attempting to activate into Box 6 MUST be rejected!
    const caseAResult = await evaluate(`(() => {
      const s = window.state;
      // Clear any other slot with this test pack so only Box 4 is active with it
      s.slots.forEach(sl => {
        if (Number(sl.boxNumber) !== 4 && Number(sl.boxNumber) !== 6 && (sl.packNumber === '001662' || sl.packNumber === '0016624')) {
          sl.status = 'EMPTY';
          sl.packNumber = null;
          sl.gameName = null;
        }
      });
      const b4 = s.slots.find(sl => Number(sl.boxNumber) === 4);
      const b6 = s.slots.find(sl => Number(sl.boxNumber) === 6);

      b4.status = 'ACTIVE';
      b4.needsActivation = false;
      b4.isSoldOut = false;
      b4.gameId = '1910';
      b4.barcodePrefix = '1910';
      b4.gameName = 'Jumbo Brew Bucks';
      b4.packNumber = '0016624';
      b4.startTicket = 0;
      b4.currentTicket = 5;

      b6.status = 'EMPTY';
      b6.gameName = null;
      b6.packNumber = null;

      // Call handleSetBoxForTicket
      const success = window.handleSetBoxForTicket(6, '19100016624000', { id: '1910', name: 'Jumbo Brew Bucks', price: 2 });
      const toasts = document.querySelectorAll('.toast');
      const toastMsg = window.__lastToast || (toasts.length > 0 ? toasts[toasts.length - 1].textContent : null);

      return {
        success,
        toastMsg,
        b4Status: b4.status,
        b6Status: b6.status
      };
    })()`);

    console.log('Case A Result:', caseAResult);
    assert(caseAResult.success === false, 'Case A: Duplicate active assignment in Box 6 is prevented');
    assert(caseAResult.toastMsg && caseAResult.toastMsg.includes('Box #4'), 'Warning correctly names Box #4');
    assert(caseAResult.b6Status === 'EMPTY', 'Box 6 remains EMPTY');

    // Case C: Box 4 has a DIFFERENT game with similar pack number (Game 1422 vs Game 1910)
    const caseCResult = await evaluate(`(() => {
      const s = window.state;
      s.slots.forEach(sl => {
        if (Number(sl.boxNumber) !== 4 && sl.packNumber && (sl.packNumber.includes('001662') || sl.packNumber === '0016624')) {
          sl.status = 'EMPTY';
          sl.packNumber = null;
          sl.gameName = null;
        }
      });
      const b4 = s.slots.find(sl => Number(sl.boxNumber) === 4);
      const b6 = s.slots.find(sl => Number(sl.boxNumber) === 6);

      b4.status = 'ACTIVE';
      b4.needsActivation = false;
      b4.isSoldOut = false;
      b4.gameId = '1422';
      b4.barcodePrefix = '1422';
      b4.gameName = '50X The Cash';
      b4.packNumber = '001662';
      b4.startTicket = 0;
      b4.currentTicket = 10;

      b6.status = 'EMPTY';
      b6.gameName = null;
      b6.packNumber = null;

      const success = window.handleSetBoxForTicket(6, '19100016624000', { id: '1910', name: 'Jumbo Brew Bucks', price: 2 });
      return {
        success,
        toastMsg: window.__lastToast,
        b4Game: b4.gameName,
        b6Status: b6.status,
        b6Game: b6.gameName
      };
    })()`);

    console.log('Case C Result:', caseCResult);
    assert(caseCResult.success, 'Case C: Different game with same numeric pack does NOT collide');
    assert(caseCResult.b6Status === 'ACTIVE', 'Box 6 is activated with Game 1910');

    // -------------------------------------------------------------
    // CHECK 4: Page Reload Persistence
    // -------------------------------------------------------------
    console.log('\n--- CHECK 4: REFRESH PERSISTENCE ---');
    await evaluate(`(async () => {
      const sid = (typeof window.getCurrentStoreId === 'function' ? window.getCurrentStoreId() : null) || localStorage.getItem('lotto_current_store_id') || 'store_admin';
      window.saveState(window.state, sid);
      try {
        await fetch('/api/sync-pos-state?storeId=' + encodeURIComponent(sid), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-store-id': sid },
          body: JSON.stringify({ storeId: sid, state: window.state })
        });
      } catch (_) {}
    })()`);
    await sleep(2500);
    await send('Page.reload');
    await sleep(2500);

    // Wait for POS app to initialize
    for (let i = 0; i < 30; i++) {
      const ready = await evaluate(`typeof window.handleSetBoxForTicket === 'function' && Boolean(window.state)`);
      if (ready) break;
      await sleep(200);
    }

    const persistedState = await evaluate(`(() => {
      const b6 = window.state?.slots?.find(sl => Number(sl.boxNumber) === 6);
      return {
        b6Status: b6?.status,
        b6Game: b6?.gameName,
        b6Pack: b6?.packNumber
      };
    })()`);

    console.log('Persisted state:', persistedState);
    assert(persistedState.b6Status === 'ACTIVE', 'Box 6 assignment persists across reload');
    assert(persistedState.b6Pack === '001662' || persistedState.b6Pack === '0016624' || persistedState.b6Pack === '001662-4', 'Box 6 pack number persists');

    // Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    writeFileSync(join(ARTIFACT_DIR, 'verified-activation-toast-blur.png'), buffer);
    console.log('  📸 Screenshot captured: verified-activation-toast-blur.png');

    console.log('\n================================================================');
    console.log(` ALL CHECKS PASSED: ${passed}/${total} assertions!`);
    console.log('================================================================');

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
