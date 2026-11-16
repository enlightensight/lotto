import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
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
  console.log(' JACKPOTLO GET REPORT COMPREHENSIVE WORKFLOW SUITE             ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-verify-get-report-'));
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
      const ready = await evaluate(`typeof window.confirmEndShift === 'function' && Boolean(window.state)`);
      if (ready) break;
      await sleep(200);
    }

    console.log('Step 1: POS Application Loaded and Initialized');
    await sleep(1500);

    // -------------------------------------------------------------
    // SETUP: 10 Active Boxes in Shift
    // -------------------------------------------------------------
    console.log('\n--- SETUP: CONFIGURE 10 ACTIVE BOXES ---');
    await evaluate(`(() => {
      const gameDefs = [
        { id: 'g101', name: '5X MONEY', prefix: '1417', price: 1, pack: '001001' },
        { id: 'g102', name: 'JR JUMBO', prefix: '1410', price: 1, pack: '001002' },
        { id: 'g103', name: 'LOTERIA', prefix: '1322', price: 2, pack: '001003' },
        { id: 'g104', name: 'HIT 100', prefix: '1891', price: 2, pack: '001004' },
        { id: 'g105', name: 'SPICY HOT CASH', prefix: '1853', price: 2, pack: '001005' },
        { id: 'g106', name: 'JACKPOTS', prefix: '1883', price: 2, pack: '001006' },
        { id: 'g107', name: '10X MONEY', prefix: '1418', price: 2, pack: '001007' },
        { id: 'g108', name: 'JUMBO BUCKS', prefix: '1411', price: 2, pack: '001008' },
        { id: 'g109', name: 'CROSS WORD', prefix: '1898', price: 3, pack: '001009' },
        { id: 'g110', name: '2026 HAPPY NEW', prefix: '1874', price: 3, pack: '001010' }
      ];

      state.shiftStatus = 'IN_PROGRESS';
      state.shiftNumber = 4;
      state.totalSlots = 20;
      state.soldOutThisShift = [];
      state.slots = [];
      for (let i = 0; i < 10; i++) {
        const g = gameDefs[i];
        state.slots.push({
          boxNumber: i + 1,
          status: 'ACTIVE',
          gameId: g.id,
          gameName: g.name,
          barcodePrefix: g.prefix,
          price: g.price,
          packNumber: g.pack,
          packSize: 100,
          startTicket: 0,
          currentTicket: 5,
          ticketsSold: 0,
          packCumulativeSoldBase: 10,
          packCumulativeSold: 10,
          scannedInEndShift: false,
          declaredOutThere: false
        });
      }
      saveState(state);
      renderDispenserRack();
      renderSlotsRibbon();
      renderHeaderAndMetrics();
    })()`);

    const setupCheck = await evaluate(`state.slots.filter(s => s.status === 'ACTIVE').length`);
    assert(setupCheck === 10, '10 active boxes configured in state');

    // Enter Get Report mode (SCANNING_END_SHIFT)
    console.log('\n--- ENTER GET REPORT MODE ---');
    await evaluate(`(() => {
      document.getElementById('mainShiftActionBtn')?.click();
    })()`);
    await sleep(300);

    const shiftStatus = await evaluate(`state.shiftStatus`);
    assert(shiftStatus === 'SCANNING_END_SHIFT', 'Entered SCANNING_END_SHIFT mode');

    // -------------------------------------------------------------
    // REQ 6: CLICKING ACTIVE BOX OPENS REVIEW MODAL & DOES NOT MARK SCANNED
    // -------------------------------------------------------------
    console.log('\n--- REQ 6: CLICK BOX 1 IN REVIEW MODE ---');
    const box1ClickRes = await evaluate(`(() => {
      const slot1 = state.slots.find(s => s.boxNumber === 1);
      const prevScanned = slot1.scannedInEndShift;
      // Click box card
      const card1 = document.querySelector('.box-card[data-box="1"]') || document.querySelectorAll('.box-card')[0];
      card1.click();
      const modal = document.getElementById('endShiftTicketReviewModal');
      const isOpen = modal && modal.open;
      const gameName = document.getElementById('esrGameName')?.textContent;
      const boxNum = document.getElementById('esrBoxNumber')?.textContent;
      const status = document.getElementById('esrVerificationStatus')?.textContent;
      return {
        isOpen,
        gameName,
        boxNum,
        status,
        stillNotScanned: slot1.scannedInEndShift === false,
        scannedUnchanged: slot1.scannedInEndShift === prevScanned
      };
    })()`);
    console.log('Box 1 Review Modal:', box1ClickRes);
    assert(box1ClickRes.isOpen === true, 'Review modal opened on box click');
    assert(box1ClickRes.boxNum === '#1', 'Review modal shows Box #1');
    assert(box1ClickRes.gameName === '5X MONEY', 'Review modal shows 5X MONEY');
    assert(box1ClickRes.stillNotScanned === true, 'Clicking box did NOT mark it scanned');
    assert(box1ClickRes.scannedUnchanged === true, 'Verification status unchanged by click');

    // Close review modal
    await evaluate(`document.getElementById('closeEndShiftReviewBtn')?.click()`);
    await sleep(200);

    // -------------------------------------------------------------
    // REQ 9 & 10: SCAN 5 BOXES & DUPLICATE PROTECTION
    // -------------------------------------------------------------
    console.log('\n--- REQ 9 & 10: SCAN BOXES 1 THROUGH 5 ---');
    const scanBarcodes = [
      '14170010010010', // Box 1: 5X MONEY
      '14100010020010', // Box 2: JR JUMBO
      '13220010030010', // Box 3: LOTERIA
      '18910010040010', // Box 4: HIT 100
      '18530010050010'  // Box 5: SPICY HOT CASH
    ];

    for (const b of scanBarcodes) {
      await evaluate(`(() => {
        const input = document.getElementById('barcodeInput');
        if (input) input.value = '${b}';
        document.getElementById('barcodeEnterBtn')?.click();
      })()`);
      await sleep(250);
    }

    const scannedCount = await evaluate(`state.slots.filter(s => s.scannedInEndShift).length`);
    assert(scannedCount === 5, '5 of 10 boxes successfully scanned and verified');

    // REQ 10: Scan Box 1 again
    console.log('Testing duplicate scan of Box 1...');
    await evaluate(`(() => {
      const input = document.getElementById('barcodeInput');
      if (input) input.value = '${scanBarcodes[0]}';
      document.getElementById('barcodeEnterBtn')?.click();
    })()`);
    await sleep(250);
    const scannedCountAfterDup = await evaluate(`state.slots.filter(s => s.scannedInEndShift).length`);
    assert(scannedCountAfterDup === 5, 'Scanning same box twice does not increment count (still 5)');

    // -------------------------------------------------------------
    // REQ 3: MARK BOX 6 AS SOLD OUT
    // -------------------------------------------------------------
    console.log('\n--- REQ 3: MARK BOX 6 AS SOLD OUT ---');
    const soldOutRes = await evaluate(`(() => {
      const slot6 = state.slots.find(s => s.boxNumber === 6);
      openEndShiftBoxReviewModal(slot6);
      document.getElementById('btnEsrMarkSoldOut')?.click();
      return {
        box6Status: slot6.status,
        box6Scanned: slot6.scannedInEndShift,
        soldOutCount: state.soldOutThisShift.length,
        soldOutItem: state.soldOutThisShift.find(so => so.boxNumber === 6)
      };
    })()`);
    console.log('Sold Out Result:', soldOutRes);
    assert(soldOutRes.box6Status === 'SOLD_OUT', 'Box 6 status is SOLD_OUT');
    assert(soldOutRes.box6Scanned === false, 'Box 6 is NOT marked scanned (scannedInEndShift = false)');
    assert(soldOutRes.soldOutItem !== undefined, 'Box 6 recorded in soldOutThisShift');

    // -------------------------------------------------------------
    // REQ 4: RETURN BOX 7 TO SAFE INVENTORY
    // -------------------------------------------------------------
    console.log('\n--- REQ 4: RETURN BOX 7 TO SAFE INVENTORY ---');
    const returnRes = await evaluate(`(() => {
      const slot7 = state.slots.find(s => s.boxNumber === 7);
      openEndShiftBoxReviewModal(slot7);
      document.getElementById('btnEsrReturnSafe')?.click();
      return {
        box7Status: slot7.status,
        box7Scanned: slot7.scannedInEndShift,
        safeInvFound: state.inStockInventory.some(p => p.packNumber === '001007'),
        soldOutReturnFound: state.soldOutThisShift.some(so => so.boxNumber === 7 && so.isReturned)
      };
    })()`);
    console.log('Return Result:', returnRes);
    assert(returnRes.box7Status === 'EMPTY', 'Box 7 emptied on return to safe');
    assert(returnRes.box7Scanned === false, 'Box 7 is NOT marked scanned');
    assert(returnRes.safeInvFound === true, 'Box 7 pack added to inStockInventory (Safe Inventory)');
    assert(returnRes.soldOutReturnFound === true, 'Box 7 recorded in soldOutThisShift as isReturned = true');

    // -------------------------------------------------------------
    // REQ 5: DECLARE BOX 8 OUT THERE (NOT SCANNED)
    // -------------------------------------------------------------
    console.log('\n--- REQ 5: DECLARE BOX 8 OUT THERE ---');
    const declareRes = await evaluate(`(() => {
      const slot8 = state.slots.find(s => s.boxNumber === 8);
      openEndShiftBoxReviewModal(slot8);
      document.getElementById('btnEsrDeclareOutThere')?.click();
      return {
        declaredOutThere: slot8.declaredOutThere,
        scannedInEndShift: slot8.scannedInEndShift
      };
    })()`);
    console.log('Declare Out There Result:', declareRes);
    assert(declareRes.declaredOutThere === true, 'Box 8 declaredOutThere is true');
    assert(declareRes.scannedInEndShift === false, 'Box 8 scannedInEndShift is strictly false');

    // -------------------------------------------------------------
    // REQ 7 & 8: NEW TICKET SCAN & UNRESOLVED ACTIVATION BLOCKS REPORT
    // -------------------------------------------------------------
    console.log('\n--- REQ 7 & 8: NEW TICKET SCAN & RESOLUTION ---');
    // Introduce pending activation manually to verify guard
    await evaluate(`(() => {
      state.slots.push({
        boxNumber: 15,
        status: 'ACTIVE',
        needsActivation: true,
        gameName: 'Pending Pack',
        packNumber: '1999-001234'
      });
    })()`);

    // Click Get Report while box 15 needs activation
    const blockedRes = await evaluate(`(() => {
      executeGetReportWithLoading();
      const modal = document.getElementById('endShiftConfirmModal');
      return { isOpen: modal ? modal.open : false };
    })()`);
    assert(blockedRes.isOpen === false, 'Report generation blocked when box needs activation');

    // Resolve / remove pending box
    await evaluate(`(() => {
      state.slots = state.slots.filter(s => s.boxNumber !== 15);
    })()`);

    // -------------------------------------------------------------
    // REQ 1 & PARTIAL SCANNING: GET REPORT ALLOWED WITH 5 SCANNED
    // -------------------------------------------------------------
    console.log('\n--- REQ 1: GET REPORT ALLOWED WITH PARTIAL SCAN ---');
    const step1OpenRes = await evaluate(`(() => {
      executeGetReportWithLoading();
      const modal = document.getElementById('endShiftConfirmModal');
      const step1 = document.getElementById('endShiftStep1View');
      const step2 = document.getElementById('endShiftStep2View');
      return {
        modalOpen: modal && modal.open,
        step1Visible: step1 && step1.style.display !== 'none',
        step2Hidden: step2 && step2.style.display === 'none'
      };
    })()`);
    console.log('Step 1 Open Result:', step1OpenRes);
    assert(step1OpenRes.modalOpen === true, 'End shift modal opens with partial scanned boxes (5 of 10)');
    assert(step1OpenRes.step1Visible === true, 'Step 1 (Activations & Empty Slots) view is displayed');
    assert(step1OpenRes.step2Hidden === true, 'Step 2 view is initially hidden');

    // -------------------------------------------------------------
    // REQ 11: STEP 1 ACTIVATIONS & EMPTY SLOTS SAVED
    // -------------------------------------------------------------
    console.log('\n--- REQ 11: STEP 1 VALUES SAVED ---');
    await evaluate(`(() => {
      document.getElementById('inputManualActivations').value = '4';
      document.getElementById('inputManualEmptySlots').value = '9';
      document.getElementById('btnEndShiftStep1Next').click();
    })()`);
    await sleep(200);

    const step2OpenRes = await evaluate(`(() => {
      const step1 = document.getElementById('endShiftStep1View');
      const step2 = document.getElementById('endShiftStep2View');
      return {
        step1Hidden: step1 && step1.style.display === 'none',
        step2Visible: step2 && step2.style.display !== 'none',
        manualAct: state.manualActivations,
        manualEmpty: state.manualEmptySlots
      };
    })()`);
    console.log('Step 2 Result:', step2OpenRes);
    assert(step2OpenRes.step2Visible === true, 'Navigated to Step 2 (Terminal Sales Entry)');
    assert(step2OpenRes.manualAct === 4, 'Step 1 Number of Activations saved as 4');
    assert(step2OpenRes.manualEmpty === 9, 'Step 1 Number of Empty Slots saved as 9');

    // Capture screenshot of Step 2 modal
    const step2Shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(
      join('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544', 'verified-step2-redesign.png'),
      Buffer.from(step2Shot.data, 'base64')
    );

    // -------------------------------------------------------------
    // REQ 12 & 13: STEP 2 SALES & BACK/FORWARD PRESERVATION
    // -------------------------------------------------------------
    console.log('\n--- REQ 12 & 13: BACK/FORWARD PRESERVATION ---');
    await evaluate(`(() => {
      document.getElementById('inputManualScratchSales').value = '350.00';
      document.getElementById('inputManualOnlineSales').value = '175.50';
      // Navigate Back to Step 1
      document.getElementById('btnEndShiftStep2Back').click();
    })()`);
    await sleep(200);

    const backRes = await evaluate(`(() => {
      const step1 = document.getElementById('endShiftStep1View');
      const step2 = document.getElementById('endShiftStep2View');
      const actVal = document.getElementById('inputManualActivations').value;
      const emptyVal = document.getElementById('inputManualEmptySlots').value;
      return {
        step1Visible: step1 && step1.style.display !== 'none',
        step2Hidden: step2 && step2.style.display === 'none',
        actVal,
        emptyVal,
        savedScratch: state.manualScratchOffSales,
        savedOnline: state.manualOnlineSales
      };
    })()`);
    console.log('Back to Step 1 Result:', backRes);
    assert(backRes.step1Visible === true, 'Back button returned to Step 1');
    assert(backRes.actVal === '4', 'Step 1 preserved Activations input (4)');
    assert(backRes.emptyVal === '9', 'Step 1 preserved Empty Slots input (9)');
    assert(backRes.savedScratch === 350, 'Step 2 Scratch-Off Sales preserved on back (350)');
    assert(backRes.savedOnline === 175.5, 'Step 2 Online Sales preserved on back (175.5)');

    // Navigate Forward again
    await evaluate(`document.getElementById('btnEndShiftStep1Next').click()`);
    await sleep(200);

    const forwardRes = await evaluate(`(() => {
      return {
        scratchVal: document.getElementById('inputManualScratchSales').value,
        onlineVal: document.getElementById('inputManualOnlineSales').value
      };
    })()`);
    assert(parseFloat(forwardRes.scratchVal) === 350, 'Step 2 Scratch-Off input retained value (350)');
    assert(parseFloat(forwardRes.onlineVal) === 175.5, 'Step 2 Online Sales input retained value (175.5)');

    // -------------------------------------------------------------
    // REQ 14, 2, 15: CONFIRM & VERIFY REPORT ACCURACY & EXCLUSIONS
    // -------------------------------------------------------------
    console.log('\n--- REQ 14, 2, 15: CONFIRM END SHIFT & AUDIT REPORT ---');
    await evaluate(`confirmEndShift()`);
    await sleep(500);

    const reportData = await evaluate(`(() => {
      const rows = buildShiftReportRows(state.slots, state.soldOutThisShift);
      const isShiftEnded = state.shiftStatus === 'SHIFT_ENDED';
      const rowBoxes = rows.map(r => r.boxNumber);
      const box6Row = rows.find(r => r.boxNumber === 6);
      const box7Row = rows.find(r => r.boxNumber === 7);
      const box8Row = rows.find(r => r.boxNumber === 8);
      const box9Row = rows.find(r => r.boxNumber === 9);
      const box10Row = rows.find(r => r.boxNumber === 10);
      return {
        isShiftEnded,
        totalRows: rows.length,
        rowBoxes,
        box6Row,
        box7Row,
        box8Row,
        box9Row,
        box10Row,
        manualAct: state.manualActivations,
        manualEmpty: state.manualEmptySlots,
        manualScratch: state.manualScratchOffSales,
        manualOnline: state.manualOnlineSales
      };
    })()`);
    console.log('Final Report Audit:', reportData);
    assert(reportData.isShiftEnded === true, 'Shift status transitioned to SHIFT_ENDED');

    // Scanned boxes 1-5 included
    for (let b = 1; b <= 5; b++) {
      assert(reportData.rowBoxes.includes(b), `Box ${b} (Scanned) is INCLUDED in report`);
    }

    // Box 6 included as Sold Out
    assert(reportData.box6Row !== undefined && reportData.box6Row.statusTag === 'SOLD OUT', 'Box 6 is INCLUDED as SOLD OUT');

    // Box 7 included as Returned
    assert(reportData.box7Row !== undefined && reportData.box7Row.isReturned === true, 'Box 7 is INCLUDED as RETURNED');

    // Box 8 included as MANUALLY DECLARED OUT THERE — NOT SCANNED
    assert(reportData.box8Row !== undefined && reportData.box8Row.statusTag === 'MANUALLY DECLARED OUT THERE — NOT SCANNED', 'Box 8 is INCLUDED as MANUALLY DECLARED OUT THERE — NOT SCANNED');

    // Boxes 9 and 10 (untouched unscanned) EXCLUDED COMPLETELY
    assert(reportData.box9Row === undefined, 'Box 9 (Untouched unscanned) is COMPLETELY EXCLUDED');
    assert(reportData.box10Row === undefined, 'Box 10 (Untouched unscanned) is COMPLETELY EXCLUDED');

    // -------------------------------------------------------------
    // REQ 16, 17, 18: NORMAL SALES & CUMULATIVE SALES INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- REQ 16, 17, 18: CUMULATIVE & SHIFT INTEGRITY ---');
    const integrityData = await evaluate(`(() => {
      // Untouched slot 9 cumulative sold must remain unchanged
      const s9 = state.slots.find(s => s.boxNumber === 9);
      // Scanned slot 1 cumulative sold must be base (10) + sold (10) = 20
      const s1 = state.slots.find(s => s.boxNumber === 1);
      return {
        s9Cum: s9.packCumulativeSold,
        s9Sold: s9.ticketsSold,
        s1Cum: s1.packCumulativeSold,
        s1Sold: s1.ticketsSold
      };
    })()`);
    console.log('Integrity Data:', integrityData);
    assert(integrityData.s9Cum === 10, 'Untouched Box 9 cumulative sold preserved (10)');
    assert(integrityData.s9Sold === 0, 'Untouched Box 9 tickets sold is 0 (no invented sales)');
    assert(integrityData.s1Cum === 20, 'Scanned Box 1 cumulative sold correctly updated (base 10 + sold 10 = 20)');
    assert(integrityData.s1Sold === 10, 'Scanned Box 1 tickets sold correctly calculated (10)');

    // -------------------------------------------------------------
    // CAPTURE REPORT PREVIEW SCREENSHOT
    // -------------------------------------------------------------
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const screenshotPath = join(ARTIFACT_DIR, 'verified-complete-get-report-workflow.png');
    writeFileSync(screenshotPath, buffer);
    console.log(`\n📸 Screenshot captured: verified-complete-get-report-workflow.png`);

    console.log('\n================================================================');
    console.log(` ALL GET REPORT WORKFLOW TESTS PASSED: ${passed}/${total} assertions!`);
    console.log('================================================================\n');

  } finally {
    try {
      chromeProcess.kill();
    } catch (_) { }
  }
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
