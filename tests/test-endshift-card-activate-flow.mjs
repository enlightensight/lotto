import { spawn } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9892;
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
  console.log(' TEST: END SHIFT CARD ACTIVATION FLOW & ADD IN STOCK OPTION     ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-endshift-act-'));
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
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params?.args?.map(a => (a.value !== undefined ? a.value : JSON.stringify(a))).join(' ');
        console.log('    [BROWSER CONSOLE]', text);
      }
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

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(2000);

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res?.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
      }
      return res?.result?.value;
    }

    // Bypass login modal
    await evaluate(`
      const modal = document.getElementById('unifiedAuthModal');
      if (modal && modal.open) modal.close();
      localStorage.setItem('lotto_auth_token_v3', 'test_token');
    `);
    await sleep(500);

    console.log('--- Step 1: Configure initial state with 4 active boxes in SCANNING_END_SHIFT ---');
    await evaluate(`
      const state = window.state;
      state.shiftStatus = 'SCANNING_END_SHIFT';
      state.shiftNumber = 1;
      state.slots = [
        { boxNumber: 1, status: 'ACTIVE', gameName: '$1 Cash', price: 1, packNumber: '1001', packSize: 300, startTicket: 300, currentTicket: 295, ticketsSold: 5, scannedInEndShift: true },
        { boxNumber: 2, status: 'ACTIVE', gameName: '$2 Bonus', price: 2, packNumber: '1002', packSize: 150, startTicket: 150, currentTicket: 148, ticketsSold: 2, scannedInEndShift: true },
        { boxNumber: 3, status: 'ACTIVE', gameName: '$3 Triple', price: 3, packNumber: '1003', packSize: 100, startTicket: 100, currentTicket: 97, ticketsSold: 3, scannedInEndShift: true },
        { boxNumber: 4, status: 'ACTIVE', gameName: '$4 Jumbo', price: 4, packNumber: '1004', packSize: 60, startTicket: 60, currentTicket: 60, ticketsSold: 0, scannedInEndShift: true },
        { boxNumber: 5, status: 'EMPTY', gameName: null, price: null, packNumber: null, packSize: null, startTicket: 0, currentTicket: 0, ticketsSold: 0, scannedInEndShift: false }
      ];
      state.visibleBoxNumbers = [4, 3, 2, 1];
      window.renderHeaderAndMetrics();
      window.renderDispenserRack();
      window.renderSlotsRibbon();
    `);
    await sleep(400);

    const initialHeader = await evaluate(`document.getElementById('mainShiftBtnLabel')?.textContent.trim()`);
    console.log('  Initial Header Label:', initialHeader);
    assert(initialHeader.includes('4 of 4 scanned'), 'Header displays "4 of 4 scanned" initially');

    console.log('\n--- Step 2: Cashier scans ticket for Box 5 during End Shift (Game 1904: 15XTRA $2) ---');
    // Ticket 1904-0025565-026 (123)
    await evaluate(`
      window.processScannedBarcode('1904-0025565-026 (123)');
    `);
    await sleep(500);

    // Verify modals are NOT open immediately
    const detailsModalOpen = await evaluate(`Boolean(document.getElementById('setTicketDetailsModal')?.open)`);
    const setBoxModalOpen = await evaluate(`Boolean(document.getElementById('setBoxModal')?.open)`);
    assert(!detailsModalOpen, 'setTicketDetailsModal is NOT opened immediately upon scan');
    assert(!setBoxModalOpen, 'setBoxModal is NOT opened immediately upon scan');

    // Verify Box 5 appears on dispenser rack with an "Activate" button
    const box5Card = await evaluate(`(() => {
      const card = document.querySelector('.box-card[data-box="5"]');
      if (!card) return null;
      const btn = card.querySelector('.btn-card-activate');
      return {
        exists: true,
        btnText: btn?.textContent?.trim() || null,
        classes: card.className
      };
    })()`);
    console.log('  Box 5 card info:', box5Card);
    assert(box5Card && box5Card.exists, 'Box 5 appears on the dispenser rack grid');
    assert(box5Card.btnText === 'Activate', 'Box 5 card has "Activate" button');
    assert(box5Card.classes.includes('needs-activation'), 'Box 5 has needs-activation class');

    // Header should still report 4 of 4 scanned (Box 5 pending activation)
    const headerAfterScan = await evaluate(`document.getElementById('mainShiftBtnLabel')?.textContent.trim()`);
    console.log('  Header After Scan:', headerAfterScan);
    assert(headerAfterScan.includes('4 of 4 scanned'), 'Header still shows 4 of 4 scanned while Box 5 is pending activation');

    console.log('\n--- Step 3: Cashier clicks "Activate" on Box 5 card ---');
    await evaluate(`
      const btn = document.querySelector('.box-card[data-box="5"] .btn-card-activate');
      btn.click();
    `);
    await sleep(500);

    // Verify Step 1: Ticket Details Modal is opened with "Add in Stock" button
    const step1State = await evaluate(`(() => {
      const modal = document.getElementById('setTicketDetailsModal');
      const addStockBtn = document.getElementById('btnTicketDetailsAddStock');
      const nextBtn = document.getElementById('btnTicketDetailsNext');
      const barcodeDisplay = document.getElementById('setTicketBarcodeDisplay');
      return {
        open: modal?.open,
        addStockDisplay: addStockBtn ? window.getComputedStyle(addStockBtn).display : 'none',
        nextBtnText: nextBtn?.textContent?.trim(),
        barcodeText: barcodeDisplay?.textContent?.trim()
      };
    })()`);
    console.log('  Step 1 Modal State:', step1State);
    assert(step1State.open, 'Step 1: Ticket Details Modal opened after clicking Activate');
    assert(step1State.addStockDisplay !== 'none', 'Add in Stock button is visible');
    assert(step1State.nextBtnText.includes('Proceed to Box'), 'Next button shows "Proceed to Box →"');
    assert(step1State.barcodeText.includes('1904-0025565-026'), 'Barcode display contains parsed Georgia game 1904');

    console.log('\n--- Step 4: Click "Proceed to Box →" to transition to Step 2 ---');
    await evaluate(`
      document.getElementById('btnTicketDetailsNext').click();
    `);
    await sleep(500);

    const step2State = await evaluate(`(() => {
      const modal = document.getElementById('setBoxModal');
      const boxInput = document.getElementById('setBoxNumberInput');
      return {
        open: modal?.open,
        boxValue: boxInput?.value
      };
    })()`);
    console.log('  Step 2 Modal State:', step2State);
    assert(step2State.open, 'Step 2: Put Ticket into Box Modal opened');
    assert(step2State.boxValue === '5', 'Step 2 Box input pre-filled with Box #5');

    console.log('\n--- Step 5: Cashier confirms Box 5 activation in Step 2 ---');
    await evaluate(`
      window.confirmSetBoxForTicket(false);
    `);
    await sleep(600);

    const modalAfterConfirm = await evaluate(`Boolean(document.getElementById('setBoxModal')?.open)`);
    assert(!modalAfterConfirm, 'setBoxModal is closed after confirmation');

    // Verify Box 5 is now ACTIVE and verified for End Shift
    const box5Final = await evaluate(`(() => {
      const slot = window.state.slots.find(s => s.boxNumber === 5);
      const card = document.querySelector('.box-card[data-box="5"]');
      const badge = card?.querySelector('.card-scan-badge');
      return {
        status: slot?.status,
        needsActivation: slot?.needsActivation,
        scannedInEndShift: slot?.scannedInEndShift,
        ticketsSold: slot?.ticketsSold,
        cardClasses: card?.className,
        badgeText: badge?.textContent?.trim()
      };
    })()`);
    console.log('  Box 5 Final Slot & Card State:', box5Final);
    assert(box5Final.status === 'ACTIVE', 'Slot 5 status is ACTIVE');
    assert(box5Final.needsActivation === false, 'Slot 5 needsActivation is false');
    assert(box5Final.scannedInEndShift === true, 'Slot 5 scannedInEndShift is true');
    assert(box5Final.badgeText === '✓ SCANNED', 'Card badge shows "✓ SCANNED"');

    // Verify header counter updated to 5 of 5 scanned!
    const headerFinal = await evaluate(`document.getElementById('mainShiftBtnLabel')?.textContent.trim()`);
    console.log('  Header Final:', headerFinal);
    assert(headerFinal.includes('5 of 5 scanned'), 'Header label successfully updated to "5 of 5 scanned"');

    console.log('\n--- Step 6: Test Branch - "Add in Stock" removes pending box and saves to safe ---');
    // Scan another ticket for Box 6
    const scanResult = await evaluate(`(() => {
      try {
        window.processScannedBarcode('1910-0016624-007 (142)');
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message, stack: err.stack };
      }
    })()`);
    console.log('  Scan result:', scanResult);
    await sleep(400);

    const debugInfo = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.box-card')).map(c => ({
        box: c.dataset.box,
        classes: c.className
      }));
      return {
        cards,
        slots: window.state.slots.map(s => ({ box: s.boxNumber, status: s.status, needsAct: s.needsActivation, pack: s.packNumber, scanned: s.scannedInEndShift })),
        vis: window.state.visibleBoxNumbers
      };
    })()`);
    console.log('  Debug Info after scan 1910:', JSON.stringify(debugInfo, null, 2));

    const box6Card = await evaluate(`Boolean(document.querySelector('.box-card[data-box="6"]'))`);
    assert(box6Card, 'Box 6 appears on rack with Activate button');

    // Click Activate on Box 6
    await evaluate(`
      document.querySelector('.box-card[data-box="6"] .btn-card-activate').click();
    `);
    await sleep(400);

    // Click "Add in Stock"
    await evaluate(`
      document.getElementById('btnTicketDetailsAddStock').click();
    `);
    await sleep(400);

    const box6AfterStock = await evaluate(`(() => {
      const slot6 = window.state.slots.find(s => s.boxNumber === 6);
      const card6 = document.querySelector('.box-card[data-box="6"]');
      const inStock = (window.state.inStockInventory || []).find(p => p.packNumber?.includes('0016624') || p.pack?.includes('0016624'));
      return {
        slot6Status: slot6?.status,
        card6Present: Boolean(card6),
        inStockFound: Boolean(inStock)
      };
    })()`);
    console.log('  Box 6 After Add in Stock:', box6AfterStock);
    assert(!box6AfterStock.card6Present, 'Box 6 card is removed from dispenser rack');
    assert(box6AfterStock.slot6Status === 'EMPTY', 'Slot 6 status is restored to EMPTY');
    assert(box6AfterStock.inStockFound, 'Pack 0016624 is stored into In-Stock inventory');

    // Capture screenshot of the verified rack for artifact
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const shotBuf = Buffer.from(screenshot.data, 'base64');
    writeFileSync(join(ARTIFACT_DIR, 'screenshot-endshift-5-of-5-activated.png'), shotBuf);
    console.log('\n📸 Saved screenshot to screenshot-endshift-5-of-5-activated.png');

    console.log(`\n================================================================`);
    console.log(` ALL TESTS PASSED: ${passed}/${total}`);
    console.log(`================================================================`);

  } finally {
    try {
      chromeProcess.kill('SIGTERM');
      rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

