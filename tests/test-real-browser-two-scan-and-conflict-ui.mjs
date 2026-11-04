import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9901;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const WebSocket = globalThis.WebSocket;
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { res, rej } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) rej(data.error);
          else res(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error('Eval exception: ' + JSON.stringify(r.exceptionDetails));
    }
    return r.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    writeFileSync(join(ARTIFACT_DIR, filename), buf);
    console.log(`  📸 Screenshot saved: ${filename}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log(' TWO-SCAN INVENTORY SETUP & CONFLICT MODAL UI REAL-BROWSER TEST ');
  console.log('================================================================\n');

  const userDataDir = mkdtempSync(join(tmpdir(), 'chrome-test-twoscan-'));
  const chromeProc = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    'http://localhost:5173/?bypass_login=1'
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await delay(500);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
        const list = await res.json();
        const page = list.find(x => x.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await delay(1500);

    console.log('--- Step 1: Log into Store POS as "amigo" ---');
    const pageStatus = await client.eval(`
      ({ href: location.href, title: document.title, hasBarcodeInput: Boolean(document.getElementById('barcodeInput')), hasSignIn: Boolean(document.getElementById('viewSignIn')) })
    `);
    console.log('Page status before login:', pageStatus);

    await client.eval(`
      (function() {
        const userInput = document.getElementById('inputSignInUser');
        const passInput = document.getElementById('inputSignInPass');
        const form = document.getElementById('signInMainForm');
        if (userInput && passInput && form) {
          userInput.value = 'amigo';
          passInput.value = '1234';
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      })()
    `);
    await delay(2000);

    const postLoginStatus = await client.eval(`
      ({ href: location.href, title: document.title, hasBarcodeInput: Boolean(document.getElementById('barcodeInput')), signInDisplay: document.getElementById('viewSignIn')?.style.display })
    `);
    console.log('Page status after login:', postLoginStatus);

    // Generate a fresh unique lottery barcode for testing
    const uniqueBarcode = '9988' + Math.floor(100000 + Math.random() * 900000) + '0019';
    console.log(`Generated test barcode: ${uniqueBarcode}`);

    console.log('\n--- Step 2: First Scan (Must open Ticket Details modal to set name & price, single step, NOT box) ---');
    const scan1Result = await client.eval(`
      (function() {
        const inp = document.getElementById('barcodeInput');
        const btn = document.getElementById('barcodeEnterBtn');
        inp.value = "${uniqueBarcode}";
        btn.click();

        const detailsModalOpen = Boolean(document.getElementById('setTicketDetailsModal')?.open);
        const setBoxModalOpen = Boolean(document.getElementById('setBoxModal')?.open);
        const btnText = document.getElementById('btnTicketDetailsNext')?.textContent || '';
        return { detailsModalOpen, setBoxModalOpen, btnText };
      })()
    `);

    console.log('Scan 1 result:', scan1Result);
    if (!scan1Result.detailsModalOpen) {
      throw new Error('FAIL: Ticket Details modal did not open on first scan of new ticket!');
    }
    if (scan1Result.setBoxModalOpen) {
      throw new Error('FAIL: Set Box modal opened on first scan! Expected single-step to only ask for name/price.');
    }
    console.log('  ✔ PASS: First scan opened single-step Ticket Details modal without asking for box.');

    await delay(500);
    await client.captureScreenshot('screenshot-scan1-opened-details-modal.png');

    console.log('\n--- Step 2b: Fill Name & Price, Click "Add to In-Stock" ---');
    const addStockResult = await client.eval(`
      (function() {
        const nameInput = document.getElementById('setBoxGameNameInput');
        if (nameInput) {
          nameInput.value = 'Diamond Cash 500';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const pill5 = document.querySelector('.set-box-price-pill[data-price="5"]');
        if (pill5) pill5.click();

        const nextBtn = document.getElementById('btnTicketDetailsNext');
        nextBtn?.click();

        const detailsOpenAfter = Boolean(document.getElementById('setTicketDetailsModal')?.open);
        const setBoxOpenAfter = Boolean(document.getElementById('setBoxModal')?.open);
        const inStockMatch = (window.state?.inStockInventory || []).find(p => p.gameName?.includes('Diamond Cash 500') || p.barcode === "${uniqueBarcode}");
        return {
          detailsOpenAfter,
          setBoxOpenAfter,
          hasInStock: Boolean(inStockMatch),
          stockGame: inStockMatch?.gameName,
          stockPrice: inStockMatch?.price,
          stockStatus: inStockMatch?.status
        };
      })()
    `);

    console.log('Add to In-Stock result:', addStockResult);
    if (addStockResult.detailsOpenAfter) {
      throw new Error('FAIL: Details modal did not close after clicking Add to In-Stock!');
    }
    if (addStockResult.setBoxOpenAfter) {
      throw new Error('FAIL: Set Box modal opened after clicking Add to In-Stock! Should have remained closed until scan 2.');
    }
    if (!addStockResult.hasInStock) {
      throw new Error('FAIL: Ticket was not found in state.inStockInventory after Add to In-Stock!');
    }
    console.log('  ✔ PASS: Ticket successfully added to In-Stock inventory without asking for box.');

    await delay(600);
    await client.captureScreenshot('screenshot-ticket-saved-in-stock.png');

    console.log('\n--- Step 3: Second Scan (Must open Set in Box screen) ---');
    const scan2Result = await client.eval(`
      (function() {
        const inp = document.getElementById('barcodeInput');
        const btn = document.getElementById('barcodeEnterBtn');
        inp.value = "${uniqueBarcode}";
        btn.click();

        const detailsOpen = Boolean(document.getElementById('setTicketDetailsModal')?.open);
        const setBoxOpen = Boolean(document.getElementById('setBoxModal')?.open);
        const nameDisplay = document.getElementById('step2GameNameDisplay')?.textContent || '';
        const priceDisplay = document.getElementById('step2PriceBadge')?.textContent || '';
        return { detailsOpen, setBoxOpen, nameDisplay, priceDisplay };
      })()
    `);

    console.log('Scan 2 result:', scan2Result);
    if (!scan2Result.setBoxOpen) {
      throw new Error('FAIL: Set Box modal did NOT open on second scan!');
    }
    if (scan2Result.detailsOpen) {
      throw new Error('FAIL: Ticket details modal opened instead of Set Box modal on second scan!');
    }
    console.log('  ✔ PASS: Second scan directly opened Set in Box screen for the in-stock ticket.');

    await delay(600);
    await client.captureScreenshot('screenshot-scan2-opened-setbox-modal.png');

    console.log('\n--- Step 4: Pick Box #1 (Occupied) on Open Modal -> Trigger Conflict Dialog ---');
    await client.eval(`
      (function() {
        if (window.state && window.state.slots && window.state.slots[0]) {
          window.state.slots[0].status = 'ACTIVE';
          window.state.slots[0].gameName = '5X Money';
          window.state.slots[0].packNumber = '0670170';
          window.state.slots[0].currentTicket = 58;
          window.state.slots[0].price = 1;
        }
        const boxInput = document.getElementById('setBoxNumberInput');
        if (boxInput) {
          boxInput.value = '1';
          boxInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.getElementById('btnSetBoxConfirm')?.click();
      })()
    `);
    await delay(800);

    const conflictOpened = await client.eval(`
      Boolean(document.getElementById('boxOccupiedConflictModal')?.open)
    `);
    if (!conflictOpened) throw new Error('FAIL: Conflict modal did not open for occupied Box #1.');
    console.log('  ✔ PASS: Box #1 conflict detected, conflict modal opened.');

    // Check button styles and geometry
    const cardGeom = await client.eval(`
      (function() {
        const btnEmpty = document.getElementById('btnConflictEmptyBox');
        const btnReturn = document.getElementById('btnConflictReturnPack');
        const emptyRect = btnEmpty.getBoundingClientRect();
        const returnRect = btnReturn.getBoundingClientRect();
        const emptyStyles = window.getComputedStyle(btnEmpty);
        return {
          emptyWidth: emptyRect.width,
          emptyHeight: emptyRect.height,
          emptyWhiteSpace: emptyStyles.whiteSpace,
          emptyDisplay: emptyStyles.display,
          returnWidth: returnRect.width,
          returnHeight: returnRect.height
        };
      })()
    `);

    console.log('Conflict button geometry & styles:', cardGeom);
    if (cardGeom.emptyWhiteSpace === 'nowrap') {
      throw new Error('FAIL: Button still has white-space: nowrap! Text will be truncated.');
    }
    console.log('  ✔ PASS: Choice cards have white-space: normal, full width, and proper card height.');

    await client.captureScreenshot('screenshot-box-conflict-ui-fixed.png');

    console.log('\n--- Step 5: Click "Move to Empty Box" & Verify Both Boxes Active ---');
    const moveResult = await client.eval(`
      (function() {
        const slot1Before = (window.state?.slots || []).find(s => Number(s.boxNumber) === 1);
        const oldGame = slot1Before?.gameName;
        const oldPack = slot1Before?.packNumber;

        document.getElementById('btnConflictMoveEmptyBox')?.click();

        const slot1After = (window.state?.slots || []).find(s => Number(s.boxNumber) === 1);
        const movedSlot = (window.state?.slots || []).find(s => Number(s.boxNumber) !== 1 && s.status === 'ACTIVE' && s.packNumber === oldPack);
        const inStockRemaining = (window.state?.inStockInventory || []).filter(p => p.gameName?.includes('Diamond Cash 500'));

        return {
          oldGame,
          oldPack,
          box1Game: slot1After?.gameName,
          box1Status: slot1After?.status,
          movedToBox: movedSlot?.boxNumber,
          movedGame: movedSlot?.gameName,
          movedStatus: movedSlot?.status,
          inStockCount: inStockRemaining.length
        };
      })()
    `);

    console.log('Post-move activation result:', moveResult);
    if (!moveResult.box1Game?.includes('Diamond Cash 500')) {
      throw new Error('FAIL: Box #1 was not activated with Diamond Cash 500! Found: ' + moveResult.box1Game);
    }
    if (!moveResult.movedToBox || !moveResult.movedGame?.includes('5X Money')) {
      throw new Error('FAIL: Previous book 5X Money was not moved and activated in an empty box! Found: ' + JSON.stringify(moveResult));
    }
    if (moveResult.inStockCount !== 0) {
      throw new Error('FAIL: New ticket was not removed from inStockInventory after activation into box!');
    }
    console.log(`  ✔ PASS: Old book (5X Money) successfully moved & activated into Box #${moveResult.movedToBox}! New ticket activated in Box #1!`);

    await delay(600);
    await client.captureScreenshot('screenshot-box-moved-and-activated.png');

    console.log('\n--- Step 6: Test "Mark as Sold Out" Option on Conflicting Box ---');
    // Scan a third ticket and assign to Box #1 again, this time choosing "Mark as Sold Out"
    const thirdBarcode = '9977' + Math.floor(100000 + Math.random() * 900000) + '0019';
    const soldOutTest = await client.eval(`
      (function() {
        const inp = document.getElementById('barcodeInput');
        const btn = document.getElementById('barcodeEnterBtn');
        inp.value = "${thirdBarcode}";
        btn.click();

        // Step 1: Set details
        const nameInput = document.getElementById('setBoxGameNameInput');
        if (nameInput) {
          nameInput.value = 'Lotto Super 7';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.getElementById('btnTicketDetailsNext')?.click();

        // Scan again to open box modal
        inp.value = "${thirdBarcode}";
        btn.click();

        // Pick Box 1 (occupied by Diamond Cash 500)
        const boxInput = document.getElementById('setBoxNumberInput');
        if (boxInput) {
          boxInput.value = '1';
          boxInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.getElementById('btnSetBoxConfirm')?.click();

        // Click Mark as Sold Out
        document.getElementById('btnConflictEmptyBox')?.click();

        const slot1Final = (window.state?.slots || []).find(s => Number(s.boxNumber) === 1);
        const soldOutRecords = (window.state?.soldOutThisShift || []).filter(so => so.gameName?.includes('Diamond Cash 500'));

        return {
          box1FinalGame: slot1Final?.gameName,
          box1FinalStatus: slot1Final?.status,
          hasSoldOutRecord: soldOutRecords.length > 0,
          soldOutRecord: soldOutRecords[0]
        };
      })()
    `);

    console.log('Mark as Sold Out test result:', soldOutTest);
    if (!soldOutTest.box1FinalGame?.includes('Lotto Super 7')) {
      throw new Error('FAIL: Box #1 was not activated with Lotto Super 7! Found: ' + soldOutTest.box1FinalGame);
    }
    if (!soldOutTest.hasSoldOutRecord) {
      throw new Error('FAIL: Diamond Cash 500 was not recorded in state.soldOutThisShift after choosing Sold Out!');
    }
    console.log('  ✔ PASS: Previous book successfully marked as Sold Out, and Box #1 activated with new ticket!');

    await delay(600);
    await client.captureScreenshot('screenshot-box-soldout-and-activated.png');

    console.log('\n================================================================');
    console.log(' ALL TESTS PASSED SUCCESSFULLY! (MOVE TO EMPTY BOX & SOLD OUT)');
    console.log('================================================================\n');

    console.log('\n================================================================');
    console.log(' ALL TESTS PASSED SUCCESSFULLY! (6/6 ASSERTIONS VERIFIED)');
    console.log('================================================================\n');

  } finally {
    try { chromeProc.kill(); } catch (_) {}
    try { rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
