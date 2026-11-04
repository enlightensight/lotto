import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9888;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

const credLines = readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});

const SHARED_EMAIL = creds.SHARED_TEST_EMAIL || 'amigofoodmart2300@gmail.com';
const STORE_PASSWORD = creds.STORE_TEST_PASS;

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
  console.log(' JACKPOTLO REAL-BROWSER TEST: BOX CONFLICT & TAB REMOVAL        ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-box-conflict-'));
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
      return res.result?.value;
    }

    async function captureScreenshot(filename) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = join(ARTIFACT_DIR, filename);
      writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`  📸 Screenshot saved: ${filename}`);
      return outPath;
    }

    // Wait for page to load
    await sleep(2000);

    // 1. Sign in to Store POS
    await evaluate(`
      (function() {
        const emailInput = document.getElementById('inputSignInUser');
        const passInput = document.getElementById('inputSignInPass');
        const form = document.getElementById('signInMainForm');
        emailInput.value = '${SHARED_EMAIL}';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.value = '${STORE_PASSWORD}';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()
    `);

    await sleep(2500);

    const isStoreOpen = await evaluate(`
      document.querySelector('.pos-app-layout') !== null &&
      document.getElementById('viewSignIn').style.display === 'none'
    `);
    assert(isStoreOpen === true, 'Successfully logged into Store POS');

    // 2. Open Box 2 to inspect Box Details Modal (#boxAdjustModal)
    await evaluate(`
      (function() {
        // Ensure Box 2 has active game
        const slot2 = state.slots.find(s => s.boxNumber === 2);
        if (slot2) {
          slot2.status = 'ACTIVE';
          slot2.gameName = 'Scratch Game 1877';
          slot2.packNumber = '0011999';
          slot2.price = 10;
          slot2.packSize = 30;
          slot2.currentTicket = 5;
          slot2.startTicket = 0;
          window.openBoxAdjustModal(slot2);
        }
      })()
    `);

    await sleep(1000);

    // Verify Active new ticket button does NOT exist in DOM
    const hasActiveNewTicketTab = await evaluate(`
      Boolean(document.getElementById('tabBoxReplace'))
    `);
    assert(hasActiveNewTicketTab === false, 'Tab "Active new ticket" (#tabBoxReplace) is completely removed from modal');

    const hasReplaceTabContent = await evaluate(`
      Boolean(document.getElementById('boxReplaceTabContent'))
    `);
    assert(hasReplaceTabContent === false, 'Replace tab content (#boxReplaceTabContent) is completely removed from modal');

    // Check visible tabs
    const visibleTabs = await evaluate(`
      Array.from(document.querySelectorAll('#boxAdjustModal .tabs .tab')).map(t => t.textContent.trim())
    `);
    console.log('  Visible tabs in Box Details Modal:', visibleTabs);
    assert(visibleTabs.length === 3, 'Exactly 3 tabs present: Change box, Edit details, Remove book');

    await captureScreenshot('screenshot-box-details-modal-tab-removed.png');

    // Close Box Details Modal
    await evaluate(`document.getElementById('boxAdjustModal').close()`);
    await sleep(500);

    // 3. Scan a new ticket barcode that is NOT in stock
    // Barcode: 1420-0099881-010 (new scratch game)
    const scanResult = await evaluate(`
      (function() {
        const testBarcode = '14200099881010';
        window.handleTicketBarcodeScan(testBarcode);
        return {
          step1Open: document.getElementById('setTicketDetailsModal')?.open,
          barcode: testBarcode
        };
      })()
    `);
    assert(scanResult.step1Open === true, 'Step 1: Set Ticket Details Modal opened on new ticket scan');

    // Advance from Step 1 to Step 2
    await evaluate(`
      (function() {
        document.getElementById('setBoxGameNameInput').value = 'Golden 7s Jackpot';
        document.getElementById('btnTicketDetailsNext').click();
      })()
    `);

    await sleep(1000);

    const step2Open = await evaluate(`Boolean(document.getElementById('setBoxModal')?.open)`);
    assert(step2Open === true, 'Step 2: Put Ticket into Box Modal opened');

    // 4. In Step 2, enter Box #2 (which is occupied by Scratch Game 1877) and click Add
    await evaluate(`
      (function() {
        const input = document.getElementById('setBoxNumberInput');
        input.value = '2';
        document.getElementById('btnSetBoxConfirm').click();
      })()
    `);

    await sleep(1000);

    // 5. Verify that #boxOccupiedConflictModal popped up!
    const conflictModalState = await evaluate(`
      (function() {
        const modal = document.getElementById('boxOccupiedConflictModal');
        return {
          open: Boolean(modal?.open),
          boxNum: document.getElementById('conflictBoxNum')?.textContent,
          currentGame: document.getElementById('conflictCurrentGameTitle')?.textContent,
          newGame: document.getElementById('conflictNewGameTitle')?.textContent,
          hasEmptyBtn: Boolean(document.getElementById('btnConflictEmptyBox')),
          hasReturnBtn: Boolean(document.getElementById('btnConflictReturnPack')),
          hasCancelBtn: Boolean(document.getElementById('btnConflictCancel'))
        };
      })()
    `);

    assert(conflictModalState.open === true, 'Box Occupied Conflict Modal popped up!');
    assert(conflictModalState.boxNum === '2', 'Conflict modal correctly identified Box #2');
    assert(conflictModalState.currentGame.includes('1877'), 'Conflict modal displays current game (Scratch Game 1877)');
    assert(conflictModalState.hasEmptyBtn === true, 'Option 1: Replace Box with Empty button is present');
    assert(conflictModalState.hasReturnBtn === true, 'Option 2: Return the Pack button is present');

    await captureScreenshot('screenshot-box-occupied-conflict-modal.png');

    // 6. Test Option 2: Click "Return the Pack"
    await evaluate(`
      document.getElementById('btnConflictReturnPack').click()
    `);

    await sleep(1000);

    // 7. Verify result:
    // Conflict modal closed, Step 2 closed, Box 2 now has the new game, old pack returned to in-stock inventory!
    const postConflictState = await evaluate(`
      (function() {
        const slot2 = state.slots.find(s => s.boxNumber === 2);
        const inStock = state.inStockInventory || [];
        const returnedOldPack = inStock.find(p => p.packNumber === '0011999');
        return {
          conflictModalClosed: !document.getElementById('boxOccupiedConflictModal')?.open,
          step2Closed: !document.getElementById('setBoxModal')?.open,
          slot2Game: slot2?.gameName,
          slot2Status: slot2?.status,
          oldPackReturnedToSafe: Boolean(returnedOldPack),
          returnedTicketsCount: returnedOldPack?.currentTicket
        };
      })()
    `);

    assert(postConflictState.conflictModalClosed === true, 'Conflict modal closed');
    assert(postConflictState.step2Closed === true, 'Step 2 modal closed');
    assert(postConflictState.slot2Game.includes('Golden 7s Jackpot'), 'Box 2 successfully activated with new game (Golden 7s Jackpot)');
    assert(postConflictState.slot2Status === 'ACTIVE', 'Box 2 status is ACTIVE');
    assert(postConflictState.oldPackReturnedToSafe === true, 'Previous pack (0011999) returned to Safe Inventory');

    await captureScreenshot('screenshot-box2-activated-after-pack-returned.png');

    // 8. Now test Option 1: "Replace the box with empty"
    // Let's activate another new ticket into Box 2, choosing Option 1
    await evaluate(`
      (function() {
        window.handleTicketBarcodeScan('14210088776005');
      })()
    `);
    await sleep(600);
    await evaluate(`
      (function() {
        document.getElementById('setBoxGameNameInput').value = 'Diamond Royale';
        document.getElementById('btnTicketDetailsNext').click();
      })()
    `);
    await sleep(600);
    await evaluate(`
      (function() {
        document.getElementById('setBoxNumberInput').value = '2';
        document.getElementById('btnSetBoxConfirm').click();
      })()
    `);
    await sleep(600);

    const conflict2Open = await evaluate(`Boolean(document.getElementById('boxOccupiedConflictModal')?.open)`);
    assert(conflict2Open === true, 'Conflict modal popped up again for Box #2');

    // Choose Option 1: "Replace Box with Empty"
    await evaluate(`
      document.getElementById('btnConflictEmptyBox').click()
    `);
    await sleep(1000);

    const postEmptyState = await evaluate(`
      (function() {
        const slot2 = state.slots.find(s => s.boxNumber === 2);
        return {
          conflictModalClosed: !document.getElementById('boxOccupiedConflictModal')?.open,
          step2Closed: !document.getElementById('setBoxModal')?.open,
          slot2Game: slot2?.gameName,
          slot2Status: slot2?.status
        };
      })()
    `);

    assert(postEmptyState.slot2Game.includes('Diamond Royale'), 'Box 2 successfully replaced and activated with Diamond Royale');
    assert(postEmptyState.slot2Status === 'ACTIVE', 'Box 2 status is ACTIVE');

    await captureScreenshot('screenshot-box2-replaced-and-emptied-active.png');

    console.log(`\n================================================================`);
    console.log(` REAL-BROWSER TEST COMPLETE: ${passed}/${total} ASSERTIONS PASSED!`);
    console.log(`================================================================\n`);

    ws.close();
  } finally {
    chromeProcess.kill();
    try {
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('\n❌ Browser test failed:', err);
  process.exit(1);
});
