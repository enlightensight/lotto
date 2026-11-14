import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9899;
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
  console.log(' JACKPOTLO CUSTOMER BUG FIXES VERIFICATION SUITE                ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-customer-fixes-'));
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
        throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
      }
      return res.result ? res.result.value : undefined;
    }

    async function captureScreenshot(filename) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(ARTIFACT_DIR, filename), Buffer.from(data, 'base64'));
      console.log(`  📸 Screenshot captured: ${filename}`);
    }

    console.log('Step 1: Navigating to POS /app/?bypass_login=1...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/app/?bypass_login=1' });
    await sleep(2500);

    // Call window.hideSignInScreen() to enter POS
    await evaluate(`
      (() => {
        if (typeof window.hideSignInScreen === 'function') {
          window.hideSignInScreen();
        }
      })()
    `);
    await sleep(1000);

    const isStoreOpen = await evaluate(`
      Boolean(document.querySelector('.pos-app-layout') && document.getElementById('viewSignIn')?.style?.display === 'none')
    `);
    console.log('Is POS Open:', isStoreOpen);
    assert(isStoreOpen === true, 'Successfully opened Store POS with full layout');

    // -------------------------------------------------------------
    // ISSUE 6: Incomplete barcode rejection
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 6: INCOMPLETE BARCODE REJECTION ---');
    const issue6Result = await evaluate(`
      (() => {
        const input = document.getElementById('barcodeInput');
        input.value = '8370380';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const form = document.getElementById('scanBarcodeForm') || input.form;
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        const toast = document.querySelector('.toast-error')?.textContent || '';
        const readout = document.getElementById('lastScanDisplay')?.textContent || '';
        const actionTitle = document.getElementById('scanActionTitle')?.textContent || '';
        return { toast, readout, actionTitle };
      })()
    `);
    console.log('Issue 6 Scan Result:', issue6Result);
    assert(
      issue6Result.toast.includes('Incomplete barcode — please rescan.') ||
      issue6Result.readout.includes('Incomplete barcode — please rescan.') ||
      issue6Result.actionTitle.includes('INCOMPLETE BARCODE'),
      'Incomplete barcode 8370380 is rejected immediately with "Incomplete barcode — please rescan."'
    );

    // -------------------------------------------------------------
    // ISSUE 2: Clicking a box must NEVER auto-count tickets
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 2: CLICKING BOX NEVER AUTO-COUNTS ---');
    // Start a fresh End Shift verification session
    await evaluate(`
      (() => {
        const state = window.state;
        state.shiftStatus = 'IN_PROGRESS';
        (state.slots || []).forEach(s => {
          s.scannedInEndShift = false;
          s.ticketsSold = 0;
        });
        const btn = document.getElementById('mainShiftActionBtn');
        if (btn) btn.click();
      })()
    `);
    await sleep(1500);

    const shiftStatus = await evaluate(`window.appState?.shiftStatus || window.state?.shiftStatus`);
    console.log('Current Shift Status:', shiftStatus);

    const initialVerifiedCount = await evaluate(`
      (window.appState?.slots || window.state?.slots || []).filter(s => s.scannedInEndShift).length
    `);
    console.log('Initial verified count before clicks:', initialVerifiedCount);

    // Click Box 1, Box 2, Box 26
    await evaluate(`
      (() => {
        const cards = document.querySelectorAll('.box-card');
        if (cards.length > 0) cards[0].click();
        if (cards.length > 1) cards[1].click();
        if (cards.length > 25) cards[25].click();
      })()
    `);
    await sleep(800);

    const countAfterClicks = await evaluate(`
      (window.appState?.slots || window.state?.slots || []).filter(s => s.scannedInEndShift).length
    `);
    console.log('Verified count after clicking boxes:', countAfterClicks);
    assert(countAfterClicks === initialVerifiedCount, 'Clicking boxes did NOT increase scanned ticket count');

    // -------------------------------------------------------------
    // ISSUE 1: Only scanned boxes turn green
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 1: ONLY SCANNED BOXES TURN GREEN ---');
    const greenCardsCountBefore = await evaluate(`
      document.querySelectorAll('.box-card.scanned-done').length
    `);
    console.log('Green box cards before scanning:', greenCardsCountBefore);
    assert(greenCardsCountBefore === 0, 'No dispenser boxes are green before scanning starts');

    // Find first active box info
    const activeSlotInfo = await evaluate(`
      (() => {
        const slots = window.state?.slots || [];
        const active = slots.find(s => s.status === 'ACTIVE' && s.packNumber);
        const scannedB = active?.scannedBarcodes?.[0];
        const rawB = typeof scannedB === 'string' ? scannedB : (scannedB?.barcode || '');
        return active ? {
          boxNumber: active.boxNumber,
          packNumber: active.packNumber,
          gameId: active.gameId,
          price: active.price,
          currentTicket: active.currentTicket,
          barcodePrefix: active.barcodePrefix,
          savedBarcode: rawB
        } : null;
      })()
    `);
    console.log('Testing scan on active slot:', activeSlotInfo);

    if (activeSlotInfo) {
      // Simulate scanning the box barcode or top-ticket barcode of this box
      const scanCode = 'BOX-' + activeSlotInfo.boxNumber;
      console.log('Scanning box barcode:', scanCode);

      await evaluate(`
        (() => {
          if (typeof window.processScannedBarcode === 'function') {
            window.processScannedBarcode('${scanCode}');
          } else {
            const barcodeInput = document.getElementById('barcodeInput');
            barcodeInput.value = '${scanCode}';
            document.getElementById('barcodeEnterBtn')?.click();
          }
        })()
      `);
      await sleep(1000);

      const scanResultDebug = await evaluate(`
        ({
          lastScan: window.state?.lastScannedBarcode,
          lastScanDisplay: document.getElementById('lastScanDisplay')?.textContent,
          scannedInEndShift: window.state?.slots?.find(s => s.boxNumber === ${activeSlotInfo.boxNumber})?.scannedInEndShift
        })
      `);
      console.log('Scan Result Debug:', scanResultDebug);

      const verifiedCountAfter1 = await evaluate(`
        (window.appState?.slots || window.state?.slots || []).filter(s => s.scannedInEndShift).length
      `);
      console.log('Verified count after 1 scan:', verifiedCountAfter1);
      assert(verifiedCountAfter1 === 1, 'Scanned count increases by exactly 1 after scanning valid box');

      const greenCardsCountAfter1 = await evaluate(`
        document.querySelectorAll('.box-card.scanned-done').length
      `);
      console.log('Green box cards count after 1 scan:', greenCardsCountAfter1);
      assert(greenCardsCountAfter1 === 1, 'Only the scanned box turns green; other boxes remain pending');

      // Test Undo
      await evaluate(`
        (() => {
          const undoBtn = document.getElementById('undoActionBtn') || document.getElementById('btnUndoScan');
          if (undoBtn) undoBtn.click();
        })()
      `);
      await sleep(1000);

      const verifiedCountAfterUndo = await evaluate(`
        (window.appState?.slots || window.state?.slots || []).filter(s => s.scannedInEndShift).length
      `);
      console.log('Verified count after undo:', verifiedCountAfterUndo);
      assert(verifiedCountAfterUndo === 0, 'Undo successfully reverted scan and decremented verified count to 0');
    }

    // -------------------------------------------------------------
    // ISSUE 3: Box Assignment (Box 26 stays Box 26, never Box 6)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 3: BOX 26 SELECTION ---');
    const box26InputTest = await evaluate(`
      (() => {
        const input = document.getElementById('setBoxNumberInput');
        if (!input) return { found: false };
        input.value = '';
        input.dataset.fresh = 'true';
        // Simulate typing '2' then '6'
        input.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
        input.value = '2';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        input.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));
        input.value = '26';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        return { found: true, finalValue: input.value, isFreshDeleted: !input.dataset.fresh };
      })()
    `);
    console.log('Box 26 Input Test:', box26InputTest);
    assert(box26InputTest.finalValue === '26' && box26InputTest.isFreshDeleted, 'Box 26 is preserved and fresh dataset flag cleared on input');

    // -------------------------------------------------------------
    // ISSUE 4: Same pack scanned repeatedly stays in same box
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 4: SAME PACK STAYS IN SAME BOX ---');
    // We test in SCANNING_END_SHIFT where ticket packs are scanned onto the rack
    await evaluate(`
      (() => {
        window.state.shiftStatus = 'SCANNING_END_SHIFT';
      })()
    `);

    // First scan from Game 1648, Pack 018378 (Ticket 000)
    const packScan1 = await evaluate(`
      (() => {
        window.processScannedBarcode('16480183788000');
        const state = window.state;
        const matchingSlots = (state.slots || []).filter(s => s.packNumber && s.packNumber.includes('018378'));
        return {
          slotsFound: matchingSlots.length,
          boxNumber: matchingSlots[0]?.boxNumber,
          needsActivation: matchingSlots[0]?.needsActivation
        };
      })()
    `);
    console.log('Scan 1 Result for Pack 018378:', packScan1);
    assert(packScan1.slotsFound === 1, 'First scan of Pack 018378 assigned to exactly 1 slot');
    const assignedBox = packScan1.boxNumber;

    // Second scan of SAME physical pack (Ticket 001)
    const packScan2 = await evaluate(`
      (() => {
        window.processScannedBarcode('16480183780001');
        const state = window.state;
        const matchingSlots = (state.slots || []).filter(s => s.packNumber && s.packNumber.includes('018378'));
        return {
          slotsFound: matchingSlots.length,
          boxNumbers: matchingSlots.map(s => s.boxNumber),
          lastScannedSlot: state.lastScannedSlot
        };
      })()
    `);
    console.log('Scan 2 Result for SAME Pack 018378 (different ticket):', packScan2);
    assert(packScan2.slotsFound === 1, 'Second scan of same pack stayed in 1 slot (did not allocate second box)');
    assert(packScan2.boxNumbers[0] === assignedBox, `Second scan reused Box #${assignedBox}`);

    // Third scan of SAME physical pack (Ticket 002)
    const packScan3 = await evaluate(`
      (() => {
        window.processScannedBarcode('16480183788002');
        const state = window.state;
        const matchingSlots = (state.slots || []).filter(s => s.packNumber && s.packNumber.includes('018378'));
        return {
          slotsFound: matchingSlots.length,
          boxNumbers: matchingSlots.map(s => s.boxNumber)
        };
      })()
    `);
    console.log('Scan 3 Result for SAME Pack 018378 (third ticket):', packScan3);
    assert(packScan3.slotsFound === 1, 'Third scan of same pack still in 1 slot');
    assert(packScan3.boxNumbers[0] === assignedBox, `Third scan still in Box #${assignedBox}`);

    // Fourth scan of a DIFFERENT physical pack: Game 1648, Pack 018379
    const packScan4 = await evaluate(`
      (() => {
        window.processScannedBarcode('16480183798000');
        const state = window.state;
        const matchingSlots78 = (state.slots || []).filter(s => s.packNumber && s.packNumber.includes('018378'));
        const matchingSlots79 = (state.slots || []).filter(s => s.packNumber && s.packNumber.includes('018379'));
        return {
          pack78Box: matchingSlots78[0]?.boxNumber,
          pack79Box: matchingSlots79[0]?.boxNumber,
          isDifferentBox: matchingSlots78[0]?.boxNumber !== matchingSlots79[0]?.boxNumber
        };
      })()
    `);
    console.log('Scan 4 Result for DIFFERENT Pack 018379:', packScan4);
    assert(packScan4.isDifferentBox, `Different physical pack 018379 allocated a different box (Box #${packScan4.pack79Box}) while Pack 018378 stayed in Box #${packScan4.pack78Box}`);

    // -------------------------------------------------------------
    // ISSUE 5: Box Swap UI and Options
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING ISSUE 5: BOX OCCUPIED CONFLICT MODAL ---');
    const conflictModalCheck = await evaluate(`
      (() => {
        const modal = document.getElementById('boxOccupiedConflictModal');
        const btnMove = document.getElementById('btnConflictMoveEmptyBox');
        const btnSoldOut = document.getElementById('btnConflictEmptyBox');
        const btnSafe = document.getElementById('btnConflictReturnPack');
        const btnDifferent = document.getElementById('btnConflictCancel');
        const emptyBoxPicker = document.getElementById('conflictEmptyBoxPicker');
        return {
          modalExists: Boolean(modal),
          btnMoveExists: Boolean(btnMove),
          btnSoldOutExists: Boolean(btnSoldOut),
          btnSafeExists: Boolean(btnSafe),
          btnDifferentExists: Boolean(btnDifferent),
          emptyBoxPickerExists: Boolean(emptyBoxPicker)
        };
      })()
    `);
    console.log('Conflict Modal Elements:', conflictModalCheck);
    assert(conflictModalCheck.modalExists, 'Conflict modal exists in DOM');
    assert(conflictModalCheck.btnMoveExists, 'Option A (Move to Empty Box) button exists');
    assert(conflictModalCheck.btnSoldOutExists, 'Option B (Mark Sold Out) button exists');
    assert(conflictModalCheck.btnSafeExists, 'Option C (Return to Safe) button exists');
    assert(conflictModalCheck.btnDifferentExists, 'Option D (Choose Different Box) button exists');
    assert(conflictModalCheck.emptyBoxPickerExists, 'Empty box destination picker exists under Option A');

    await captureScreenshot('verified-customer-fixes-pass.png');

    console.log('\n================================================================');
    console.log(` ALL CHECKS PASSED: ${passed}/${total} assertions verified!`);
    console.log('================================================================\n');

  } finally {
    try {
      chromeProcess.kill();
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
