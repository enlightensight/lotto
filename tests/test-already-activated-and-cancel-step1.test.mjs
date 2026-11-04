import { spawn } from 'child_process';

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9784;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('  ALREADY-ACTIVATED GUARD & STEP 1 CANCEL TEST      ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_profile_' + Date.now(),
    'http://localhost:5173'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('No Chrome page found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 1;
    const cbs = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id && cbs.has(d.id)) {
        cbs.get(d.id)(d);
        cbs.delete(d.id);
      }
    };
    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      return new Promise(res => {
        const reqId = id++;
        cbs.set(reqId, res);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    async function evalInPage(expression) {
      const res = await call('Runtime.evaluate', {
        returnByValue: true,
        expression
      });
      return res.result?.result?.value;
    }

    await call('Page.enable');
    await call('DOM.enable');
    await sleep(1500);

    // Setup initial state: Store active, Box 1 activated with 10X Money (0996564)
    await evalInPage(`
      window.state = window.state || {};
      window.state.shiftStatus = 'IN_PROGRESS';
      window.state.currentShiftNumber = 13;
      window.state.inStockInventory = [];
      window.state.inventory = [];
      window.state.slots = window.state.slots || [];
      window.state.slots[0] = {
        boxNumber: 1,
        gameName: '10X Money',
        price: 2,
        packNumber: '099656',
        packSize: 150,
        startTicket: 81,
        currentTicket: 81,
        ticketsSold: 0,
        status: 'ACTIVE',
        barcodePrefix: '1418',
        scannedBarcodes: [{
          barcode: '14180996564081',
          ticketNumber: 81
        }]
      };
      window.state.slots[1] = {
        boxNumber: 2,
        status: 'EMPTY',
        packNumber: null
      };
      window.saveState(window.state);
      window.renderDispenserRack();
      window.renderHeaderAndMetrics();
    `);

    console.log('--- Test Group 1: Scanning Already Activated Ticket ---');
    const scanResult = await evalInPage(`
      (() => {
        window.processScannedBarcode('1418-0996564-081 (068)');

        const ticketDetailsOpen = document.getElementById('setTicketDetailsModal')?.open;
        const setBoxOpen = document.getElementById('setBoxModal')?.open;
        const toastEl = document.querySelector('.toast, #toastContainer .toast-item, .scan-toast');
        const toastText = toastEl ? toastEl.textContent : '';
        const b1 = window.state.slots.find(s => s.boxNumber === 1);
        const b2 = window.state.slots.find(s => s.boxNumber === 2);
        return {
          ticketDetailsOpen: Boolean(ticketDetailsOpen),
          setBoxOpen: Boolean(setBoxOpen),
          toastText,
          box1Status: b1 ? b1.status : null,
          box1Game: b1 ? b1.gameName : null,
          box2Status: b2 ? b2.status : null
        };
      })()
    `);

    assert(scanResult.ticketDetailsOpen === false, `Ticket Details modal is NOT opened (got ${scanResult.ticketDetailsOpen})`);
    assert(scanResult.setBoxOpen === false, `Set Box modal is NOT opened (got ${scanResult.setBoxOpen})`);
    assert(scanResult.toastText.includes('already activated') || scanResult.toastText.includes('Box #1'), `Toast confirms ticket was already activated in Box #1 (toast: "${scanResult.toastText}")`);
    assert(scanResult.box1Status === 'ACTIVE', `Box 1 remains ACTIVE (got ${scanResult.box1Status})`);
    assert(scanResult.box2Status !== 'ACTIVE', `Box 2 was NOT changed or activated (got ${scanResult.box2Status})`);

    console.log('\n--- Test Group 2: Cancelling from Step 1 (Ticket Details) DOES NOT Save to Stock ---');
    const cancelResult = await evalInPage(`
      (() => {
        // Record initial inventory counts
        const initialInStockCount = (window.state.inStockInventory || []).length;
        const initialWarehouseCount = (window.state.inventory || []).length;

        // Open Ticket Details modal for a BRAND NEW unassigned pack
        window.openSetTicketDetailsModal('1672-007252-3-000 (099)');

        const modalOpenBefore = document.getElementById('setTicketDetailsModal')?.open;

        // Click Cancel button on Step 1
        const cancelBtn = document.getElementById('btnCancelTicketDetails');
        if (cancelBtn) cancelBtn.click();

        const modalOpenAfter = document.getElementById('setTicketDetailsModal')?.open;
        const finalInStockCount = (window.state.inStockInventory || []).length;
        const finalWarehouseCount = (window.state.inventory || []).length;

        const isPackInStock = (window.state.inStockInventory || []).some(p => p.packNumber && p.packNumber.includes('007252'));
        const isPackInWarehouse = (window.state.inventory || []).some(p => p.packNumber && p.packNumber.includes('007252'));

        return {
          modalOpenBefore: Boolean(modalOpenBefore),
          modalOpenAfter: Boolean(modalOpenAfter),
          initialInStockCount,
          finalInStockCount,
          isPackInStock,
          isPackInWarehouse
        };
      })()
    `);

    assert(cancelResult.modalOpenBefore === true, `Step 1 Ticket Details modal opened initially`);
    assert(cancelResult.modalOpenAfter === false, `Step 1 Ticket Details modal closed on Cancel`);
    assert(cancelResult.initialInStockCount === cancelResult.finalInStockCount, `In-Stock inventory count unchanged (${cancelResult.initialInStockCount} -> ${cancelResult.finalInStockCount})`);
    assert(cancelResult.isPackInStock === false, `Canceled pack is NOT in In-Stock inventory`);
    assert(cancelResult.isPackInWarehouse === false, `Canceled pack is NOT in Warehouse inventory`);

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('====================================================\n');

    ws.close();
  } finally {
    try { p.kill(); } catch (err) {}
  }

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
