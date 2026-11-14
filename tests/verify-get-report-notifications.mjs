import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9882;
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
  console.log(' VERIFY: GET REPORT EXACT RED-MARKED MESSAGE PANEL WORKFLOW     ');
  console.log('================================================================\n');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-verify-getrep-'));
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
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    }

    console.log('Waiting for POS application to mount and settle...');
    for (let i = 0; i < 40; i++) {
      const ready = await evaluate(`typeof window.handleSetBoxForTicket === 'function' && Boolean(window.state)`);
      if (ready) break;
      await sleep(200);
    }
    await sleep(3000);

    await evaluate(`
      (() => {
        if (typeof window.hideSignInScreen === 'function') {
          window.hideSignInScreen();
        }
      })()
    `);
    await sleep(1000);

    // Setup 3 active boxes for Get Report testing (Box 1: $1 Game, Box 2: $2 Jumbo Brew Bucks, Box 3: $5 Game)
    await evaluate(`
      (() => {
        const st = window.state;
        st.shiftStatus = 'IN_PROGRESS';
        st.shiftNumber = 1;
        st.slots = [
          {
            boxNumber: 1,
            status: 'ACTIVE',
            gameId: '1417',
            gameName: '$1 Jumbo 7s',
            price: 1,
            packNumber: '001001',
            packSize: 100,
            startTicket: 0,
            currentTicket: 0,
            ticketsSold: 0,
            scannedInEndShift: false
          },
          {
            boxNumber: 2,
            status: 'ACTIVE',
            gameId: '1910',
            gameName: 'Jumbo Brew Bucks',
            price: 2,
            packNumber: '001662',
            packSize: 150,
            startTicket: 0,
            currentTicket: 0,
            ticketsSold: 0,
            scannedInEndShift: false
          },
          {
            boxNumber: 3,
            status: 'ACTIVE',
            gameId: '1648',
            gameName: '$5 Epic Riches',
            price: 5,
            packNumber: '018378',
            packSize: 60,
            startTicket: 0,
            currentTicket: 0,
            ticketsSold: 0,
            scannedInEndShift: false
          }
        ];
        st.totalSlots = 3;
        window.saveState(st);
        window.renderHeaderAndMetrics();
        window.renderDispenserRack();
        window.renderSlotsRibbon();
      })()
    `);

    console.log('\n--- TEST 1: ENTER GET REPORT (SCANNING_END_SHIFT) ---');
    // Set shift to SCANNING_END_SHIFT and render
    await evaluate(`
      (() => {
        const st = window.state;
        st.shiftStatus = 'SCANNING_END_SHIFT';
        st.shiftNumber = 1;
        st.lastScanData = null;
        if (Array.isArray(st.slots)) {
          st.slots.forEach(s => { s.scannedInEndShift = false; s.ticketsSold = 0; });
        }
        window.saveState(st);
        window.renderHeaderAndMetrics();
        window.renderDispenserRack();
        window.renderSlotsRibbon();
      })()
    `);
    await sleep(500);

    const initReportCheck = await evaluate(`
      (() => {
        const banner = document.getElementById('getReportInstructionBanner');
        const stPill = document.getElementById('shiftStatusPill');
        const card = document.getElementById('lastScanReadoutContainer');
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const display = document.getElementById('lastScanDisplay')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const micro = document.querySelector('.last-scan-micro-label')?.textContent?.trim();
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));

        return {
          shiftStatus: window.state.shiftStatus,
          hasBanner: Boolean(banner),
          stPillVisible: stPill && getComputedStyle(stPill).display !== 'none',
          title,
          display,
          badge,
          micro,
          toastCount: toasts.length
        };
      })()
    `);

    console.log('Initial Get Report State:', initReportCheck);
    assert(initReportCheck.shiftStatus === 'SCANNING_END_SHIFT', 'POS entered SCANNING_END_SHIFT mode');
    assert(!initReportCheck.hasBanner, 'No top instruction banner exists in DOM (banner is not stuck at the top header)');
    assert(initReportCheck.stPillVisible, 'Shift status pill in header remains normally visible');
    assert(initReportCheck.title === 'Scan top ticket in each box', 'Red panel title displays scanning instructions');
    assert(initReportCheck.display.includes('Boxes turn green as you scan'), 'Red panel display details scanning workflow');
    assert(initReportCheck.badge === '0/3', 'Initial count displays 0/3 scanned');
    assert(initReportCheck.micro === 'SHIFT #1', 'Micro-label displays SHIFT #1');
    assert(initReportCheck.toastCount === 0, 'No floating toast outside the red panel was created automatically on screen open');

    console.log('\n--- TEST 2: SCAN INCOMPLETE BARCODE ---');
    await evaluate(`
      const input = document.getElementById('barcodeInput');
      input.value = '1918-004';
      document.getElementById('barcodeEnterBtn').click();
    `);
    await sleep(400);

    const incompleteCheck = await evaluate(`
      (() => {
        const card = document.getElementById('lastScanReadoutContainer');
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const display = document.getElementById('lastScanDisplay')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));

        return {
          title,
          display,
          badge,
          hasErrorClass: card?.classList.contains('card-msg-error') || card?.classList.contains('alert-yellow'),
          toastCount: toasts.length
        };
      })()
    `);

    console.log('Incomplete Barcode Scan Result:', incompleteCheck);
    assert(incompleteCheck.title.includes('Incomplete barcode'), 'Red panel displays "Incomplete barcode" message');
    assert(incompleteCheck.badge === '!', 'Badge displays "!" for error');
    assert(incompleteCheck.hasErrorClass, 'Red panel has error visual state');
    assert(incompleteCheck.toastCount === 0, 'No floating toast appeared outside the red panel');

    console.log('\n--- TEST 3: SCAN MISMATCHED / INVALID TICKET ---');
    await evaluate(`
      (() => {
        const input = document.getElementById('barcodeInput');
        input.value = '9999009999001';
        document.getElementById('barcodeEnterBtn').click();
      })()
    `);
    await sleep(400);

    const mismatchCheck = await evaluate(`
      (() => {
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));
        return {
          title,
          badge,
          toastCount: toasts.length
        };
      })()
    `);

    console.log('Mismatch Scan Result:', mismatchCheck);
    assert(mismatchCheck.title.includes('Ticket is not in any active dispenser box') || mismatchCheck.title.includes('WRONG TICKET'), 'Red panel displays ticket mismatch/not in box error');
    assert(mismatchCheck.badge === '!', 'Badge displays "!" for error');
    assert(mismatchCheck.toastCount === 0, 'No floating toast appeared outside the red panel');

    console.log('\n--- TEST 4: SCAN VALID TICKET FOR BOX #2 ---');
    // Box 2 has Game 1910, Pack 001662, ticket 001
    await evaluate(`
      (() => {
        const input = document.getElementById('barcodeInput');
        input.value = '19100016620001';
        document.getElementById('barcodeEnterBtn').click();
      })()
    `);
    await sleep(400);

    const successCheck = await evaluate(`
      (() => {
        const card = document.getElementById('lastScanReadoutContainer');
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const display = document.getElementById('lastScanDisplay')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const badgeColor = getComputedStyle(document.getElementById('largeStatReadout')).color;
        const micro = document.querySelector('.last-scan-micro-label')?.textContent?.trim();
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));
        const box2Slot = window.state.slots.find(s => s.boxNumber === 2);

        return {
          title,
          display,
          badge,
          badgeColor,
          micro,
          hasSuccessClass: card?.classList.contains('card-msg-success'),
          box2Scanned: box2Slot?.scannedInEndShift,
          toastCount: toasts.length
        };
      })()
    `);

    console.log('Success Scan Result for Box 2:', successCheck);
    assert(successCheck.title.includes('Box #2 successfully verified'), 'Red panel title displays "Box #2 successfully verified."');
    assert(successCheck.badge === '1/3', 'Scanned count displays 1/3');
    assert(successCheck.hasSuccessClass, 'Red panel has card-msg-success class');
    assert(successCheck.box2Scanned === true, 'Box #2 slot verified status is true');
    assert(successCheck.toastCount === 0, 'No floating toast outside red panel');

    // Capture visual artifact showing the message inside the red-marked panel
    const screenshotData = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(ARTIFACT_DIR, 'verified-get-report-red-panel.png'), Buffer.from(screenshotData.data, 'base64'));
    console.log('  📸 Screenshot captured: verified-get-report-red-panel.png');

    console.log('\n--- TEST 5: SCAN DUPLICATE TICKET FOR BOX #2 ---');
    await evaluate(`
      (() => {
        const input = document.getElementById('barcodeInput');
        input.value = '19100016620001';
        document.getElementById('barcodeEnterBtn').click();
      })()
    `);
    await sleep(400);

    const dupCheck = await evaluate(`
      (() => {
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));
        return {
          title,
          badge,
          toastCount: toasts.length
        };
      })()
    `);

    console.log('Duplicate Scan Result:', dupCheck);
    assert(dupCheck.title.includes('already been scanned') || dupCheck.title.includes('already verified'), 'Red panel displays "This box has already been scanned."');
    assert(dupCheck.badge === '1/3', 'Count remains 1/3 and is not incremented twice');
    assert(dupCheck.toastCount === 0, 'No floating toast outside red panel');

    console.log('\n--- TEST 6: MESSAGE TIMEOUT RESTORES NORMAL SHIFT/GAME/BOX INFO ---');
    console.log('Waiting 5 seconds for message to clear...');
    await sleep(5000);

    const restoredCheck = await evaluate(`
      (() => {
        const title = document.getElementById('scanActionTitle')?.textContent?.trim();
        const display = document.getElementById('lastScanDisplay')?.textContent?.trim();
        const badge = document.getElementById('largeStatReadout')?.textContent?.trim();
        const micro = document.querySelector('.last-scan-micro-label')?.textContent?.trim();
        const card = document.getElementById('lastScanReadoutContainer');

        return {
          title,
          display,
          badge,
          micro,
          hasSuccessClass: card?.classList.contains('card-msg-success'),
          hasErrorClass: card?.classList.contains('card-msg-error')
        };
      })()
    `);

    console.log('Restored Normal Information Result:', restoredCheck);
    assert(restoredCheck.micro === 'SHIFT #1', 'Micro-label is SHIFT #1');
    assert(restoredCheck.title === 'Jumbo Brew Bucks', 'Title restored to game title "Jumbo Brew Bucks"');
    assert(restoredCheck.display === 'Box 2', 'Display restored to "Box 2"');
    assert(restoredCheck.badge === '1/3', 'Badge displays count 1/3');
    assert(!restoredCheck.hasSuccessClass && !restoredCheck.hasErrorClass, 'Alert classes cleared cleanly');

    console.log('\n--- TEST 7: RE-RENDER STABILITY (NO DUPLICATE NOTIFICATIONS) ---');
    await evaluate(`
      window.renderHeaderAndMetrics();
      window.renderDispenserRack();
      window.renderSlotsRibbon();
    `);
    await sleep(500);

    const reRenderCheck = await evaluate(`
      (() => {
        const toasts = Array.from(document.querySelectorAll('#toastContainer .toast'));
        const banner = document.getElementById('getReportInstructionBanner');
        return {
          toastCount: toasts.length,
          hasBanner: Boolean(banner)
        };
      })()
    `);

    assert(reRenderCheck.toastCount === 0, 'Re-render created 0 duplicate notifications');
    assert(!reRenderCheck.hasBanner, 'No top banner re-created on render');

    console.log('\n================================================================');
    console.log(` ALL GET REPORT NOTIFICATION CHECKS PASSED: ${passed}/${total} assertions!`);
    console.log('================================================================\n');

  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
