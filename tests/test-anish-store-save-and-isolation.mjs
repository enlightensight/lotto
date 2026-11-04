import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CDP_PORT = 9245;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log(' TEST: ANISH STORE DATA PERSISTENCE & MULTI-TENANT ISOLATION   ');
  console.log('================================================================');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-anish-persistence-'));
  const chromeProcess = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'http://127.0.0.1:5173/'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
        targets = await res.json();
        break;
      } catch (_) {
        await sleep(200);
      }
    }

    const pageTarget = targets?.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('Could not find Chrome page target');
    console.log('\n  ✓ PASS: Chrome CDP page target connected');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.result);
        callbacks.delete(data.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((r) => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return res.result ? res.result.value : undefined;
    }

    await sleep(800);

    // --- STEP 1: Log in as Anish ---
    console.log('\n--- Step 1: Sign in as Anish (Fresh Session) ---');
    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'anish';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    const step1Check = await evaluate(`
      (function() {
        const sidebarStore = document.getElementById('sidebarStoreName')?.textContent?.trim() || '';
        return {
          sidebarStore,
          currentSid: getCurrentStoreId(),
          storeId: state.storeId,
          cashier: state.cashierName
        };
      })()
    `);

    console.log('  Login readout:', step1Check);
    assert(step1Check.sidebarStore === 'ANISH STORE', 'Active sidebar shows ANISH STORE');
    assert(step1Check.currentSid === 'store_anish', 'Current store ID is store_anish');

    // --- STEP 2: Save Custom Data in Anish Store (Activate Box 1 with unique Pack 5678901) ---
    console.log('\n--- Step 2: Set up and Save Box 1 in Anish Store ---');
    await evaluate(`
      (function() {
        const slot1 = {
          boxNumber: 1,
          gameName: 'Anish Lucky Star',
          packNumber: '5678901',
          price: 5,
          startTicket: 100,
          currentTicket: 108,
          ticketsPerPack: 150,
          status: 'ACTIVE',
          needsActivation: false,
          activatedThisShift: true
        };
        state.slots[0] = slot1;
        state.dataCleared = false;
        state.shiftStatus = 'IN_PROGRESS';
        saveState(state, 'store_anish');
        renderDispenserRack();
        renderHeaderAndMetrics();
      })()
    `);
    await sleep(1500); // Allow debounced sync to complete

    // Verify backend received and saved state for store_anish
    const backendCheck = await (async () => {
      const res = await fetch('http://127.0.0.1:3001/api/load-pos-state?storeId=store_anish');
      return await res.json();
    })();

    console.log('  Backend check for store_anish:', {
      success: backendCheck.success,
      storeId: backendCheck.storeId,
      box1Pack: backendCheck.state?.slots?.[0]?.packNumber,
      box1Game: backendCheck.state?.slots?.[0]?.gameName,
      box1Status: backendCheck.state?.slots?.[0]?.status
    });

    assert(backendCheck.success === true, 'Backend successfully returned saved state for store_anish');
    assert(backendCheck.state?.slots?.[0]?.packNumber === '5678901', 'Backend persistent file has Pack 5678901 for Box 1');
    assert(backendCheck.state?.slots?.[0]?.gameName === 'Anish Lucky Star', 'Backend persistent file has "Anish Lucky Star"');

    // --- STEP 3: Simulate Another Device / Fresh Session Logging In with Anish ID & Password ---
    console.log('\n--- Step 3: Simulate New Device/Browser by Wiping Local Storage and Logging In ---');
    // Wipe all browser storage to simulate a new device
    await evaluate(`
      (function() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      })()
    `);
    await sleep(1500);

    // Now log in again as Anish
    console.log('  Submitting login credentials for Anish on fresh browser instance...');
    await evaluate(`
      (function() {
        const userEl = document.getElementById('inputSignInUser');
        const passEl = document.getElementById('inputSignInPass');
        if (userEl) userEl.value = 'anish';
        if (passEl) passEl.value = 'AX123456@';
        document.getElementById('btnSubmitSignIn')?.click();
      })()
    `);
    await sleep(1500);

    // Inspect if Box 1 with pack 5678901 was retrieved and rendered!
    const step3Check = await evaluate(`
      (function() {
        const box1 = (state.slots || [])[0];
        const card1 = document.querySelector('.box-card[data-box="1"]');
        const boxMainNum = card1?.querySelector('.box-main-number')?.textContent?.trim() || '';
        const priceTag = card1?.querySelector('.price-tag')?.textContent?.trim() || '';
        const ribbon1 = document.querySelector('.ribbon-cell[data-box="1"]');
        return {
          currentSid: getCurrentStoreId(),
          storeName: state.storeName,
          box1StatePack: box1?.packNumber,
          box1StateGame: box1?.gameName,
          box1StateStatus: box1?.status,
          hasBoxCard: Boolean(card1),
          boxMainNum,
          priceTag,
          isRibbonActive: ribbon1 ? ribbon1.classList.contains('active-slot') : false,
          ribbonTitle: ribbon1 ? ribbon1.title : ''
        };
      })()
    `);

    console.log('  New session state inspection:', step3Check);
    assert(step3Check.currentSid === 'store_anish', 'New session correctly opened store_anish');
    assert(step3Check.box1StatePack === '5678901', 'State automatically loaded saved Box 1 Pack 5678901 from server');
    assert(step3Check.box1StateGame === 'Anish Lucky Star', 'State automatically loaded "Anish Lucky Star"');
    assert(step3Check.box1StateStatus === 'ACTIVE', 'Box 1 is ACTIVE in new session');
    assert(step3Check.hasBoxCard === true, 'Dispenser rack rendered Box 1 card on screen');
    assert(step3Check.boxMainNum === '1', 'Box 1 card displays number 1');
    assert(step3Check.priceTag === '$5', 'Box 1 card displays price $5');
    assert(step3Check.isRibbonActive === true, 'Ribbon Box 1 displays green active-slot indicator');

    // --- STEP 4: Verify Multi-Tenant Cross-Store Isolation ---
    console.log('\n--- Step 4: Verify Store Isolation (Anish Data NOT Present in Other Stores) ---');
    // Switch to store_amigo
    await evaluate(`
      (function() {
        switchStore('store_amigo');
      })()
    `);
    await sleep(800);

    const amigoCheck = await evaluate(`
      (function() {
        const amigoSlots = state.slots || [];
        const hasAnishPack = amigoSlots.some(s => s && s.packNumber === '5678901');
        return {
          currentSid: getCurrentStoreId(),
          hasAnishPack,
          activeCount: amigoSlots.filter(s => s && s.status === 'ACTIVE' && s.packNumber).length
        };
      })()
    `);

    console.log('  Amigo Store check:', amigoCheck);
    assert(amigoCheck.currentSid === 'store_amigo', 'Switched to store_amigo');
    assert(amigoCheck.hasAnishPack === false, 'Strict isolation: Pack 5678901 is NOT in store_amigo!');

    // Switch back to store_anish and verify data is still there
    await evaluate(`
      (function() {
        switchStore('store_anish');
      })()
    `);
    await sleep(800);

    const anishRecheck = await evaluate(`
      (function() {
        const anishSlots = state.slots || [];
        const box1 = anishSlots[0];
        return {
          currentSid: getCurrentStoreId(),
          box1Pack: box1?.packNumber,
          box1Game: box1?.gameName
        };
      })()
    `);

    console.log('  Switching back to Anish Store:', anishRecheck);
    assert(anishRecheck.currentSid === 'store_anish', 'Switched back to store_anish');
    assert(anishRecheck.box1Pack === '5678901', 'Box 1 Pack 5678901 is fully preserved in store_anish');

    console.log('\n================================================================');
    console.log(' ALL ANISH STORE PERSISTENCE & ISOLATION CHECKS PASSED PERFECTLY!');
    console.log('================================================================');
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
