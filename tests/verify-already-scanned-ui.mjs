import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9882;
const ARTIFACT_DIR = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('--- Verifying Already Scanned UI in Headless Chrome ---');

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-verify-already-scanned-'));
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
        if (targets && targets.length > 0 && targets.some(t => t.type === 'page')) break;
      } catch (_) { }
      await sleep(200);
    }

    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('Could not find Chrome page target');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const resolve = pending.get(data.id);
        pending.delete(data.id);
        resolve(data);
      }
    };

    await new Promise((resolve) => ws.onopen = resolve);

    const send = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    await send('Runtime.evaluate', {
      expression: `(function() {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
      })()`
    });
    await sleep(2000);

    // Hide sign-in screen if visible
    await send('Runtime.evaluate', {
      expression: `(function() {
        if (typeof window.hideSignInScreen === 'function') window.hideSignInScreen();
        const signInScreen = document.getElementById('viewSignInScreen');
        if (signInScreen) signInScreen.style.display = 'none';
        const posLayout = document.querySelector('.pos-app-layout');
        if (posLayout) {
          posLayout.style.display = 'flex';
          posLayout.classList.remove('hidden-layout');
        }
      })()`
    });
    await sleep(1000);

    // Scan ticket 015 in an active box, then scan it again
    const scanResult = await send('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async function() {
        // Close any open modals
        document.querySelectorAll('dialog').forEach(d => {
          try { d.close(); } catch(_) {}
          d.removeAttribute('open');
        });

        if (typeof window.showSellCounterView === 'function') window.showSellCounterView();

        // Cancel End Shift scanning if active
        state.shiftStatus = 'IN_PROGRESS';
        state.shiftNumber = 1;
        if (Array.isArray(state.slots)) {
          state.slots.forEach(s => { s.scannedInEndShift = false; });
        }
        if (typeof clearScanAlertBanner === 'function') clearScanAlertBanner();
        // Slot 4 has $2 Hit 100, pack 001004
        const slot4 = state.slots.find(s => s.boxNumber === 4);
        if (slot4) {
          slot4.status = 'ACTIVE';
          slot4.gameName = 'HIT 100';
          slot4.gameId = 'g104';
          slot4.barcodePrefix = '1891';
          slot4.price = 2;
          slot4.packNumber = '001004';
          slot4.packSize = 150;
          slot4.startTicket = 0;
          slot4.currentTicket = 15;
          slot4.needsActivation = false;
        }
        saveState(state);
        renderHeaderAndMetrics();
        renderDispenserRack();

        // 1. First scan of ticket 015
        processScannedBarcode('1891001004015');

        // Wait past debounce window (500ms)
        await new Promise(r => setTimeout(r, 600));

        // 2. Second scan of the SAME ticket 015
        processScannedBarcode('1891001004015');

        const title = document.getElementById('scanActionTitle')?.textContent;
        const display = document.getElementById('lastScanDisplay')?.textContent;
        const badge = document.getElementById('largeStatReadout')?.textContent;
        const isAlertYellow = document.getElementById('lastScanReadoutContainer')?.classList.contains('alert-yellow');

        return { title, display, badge, isAlertYellow };
      })()`,
      returnByValue: true
    });

    console.log('Full scanResult:', JSON.stringify(scanResult));
    console.log('Scan result DOM evaluation:', scanResult.result?.result?.value);
    const { title, display, badge, isAlertYellow } = scanResult.result?.result?.value || {};

    if (title !== 'Already Scanned') {
      throw new Error(`Expected title 'Already Scanned', got '${title}'`);
    }
    if (!display.includes('already scanned')) {
      throw new Error(`Expected display to contain 'already scanned', got '${display}'`);
    }
    if (display.includes('sold out') || display.includes('already sold') || display.includes('Cannot be sold again')) {
      throw new Error(`Display must not say sold out or cannot be sold again: '${display}'`);
    }
    if (badge !== '!') {
      throw new Error(`Expected badge '!', got '${badge}'`);
    }
    if (!isAlertYellow) {
      throw new Error('Expected container to have alert-yellow class');
    }

    console.log('  ✓ PASS: Title is "Already Scanned"');
    console.log(`  ✓ PASS: Display is "${display}"`);
    console.log('  ✓ PASS: Badge is "!"');
    console.log('  ✓ PASS: Alert yellow banner applied');

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.result.data, 'base64');
    const outPath = join(ARTIFACT_DIR, 'verified-already-scanned-banner.png');
    writeFileSync(outPath, buffer);
    console.log(`  ✓ Visual verification screenshot written to ${outPath}`);

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
