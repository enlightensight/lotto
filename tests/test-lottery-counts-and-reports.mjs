// tests/test-lottery-counts-and-reports.mjs
import { spawn } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getScreenDayReportData, getTodayVsYesterdayComparison } from '../src/dayReportData.js';

console.log('================================================================');
console.log(' TEST: LOTTERY DISPENSER COUNT AND REPORT VERIFICATION');
console.log('================================================================\n');

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------------------
// PART 1: PURE RECONCILIATION & REPORT LOGIC TESTS
// -------------------------------------------------------------------------
console.log('--- PART 1: Day Report & Today vs Yesterday Comparison Logic ---');

// Test Day Report with multiple shifts on same day
{
  const state = {
    settings: { operationMode: 'DAILY' },
    shiftNumber: 2,
    shiftStartedAt: new Date().toISOString(),
    slots: [
      {
        boxNumber: 1,
        status: 'ACTIVE',
        packNumber: 'PACK-A',
        gameName: '5X Money',
        price: 1,
        packSize: 100,
        startTicket: 10,
        currentTicket: 15,
        ticketsSold: 5
      }
    ],
    soldOutThisShift: [],
    shiftHistory: [
      {
        shiftNumber: 1,
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        endedAt: new Date(Date.now() - 1800000).toISOString(),
        totalTicketsSold: 10,
        totalSalesRevenue: 10,
        cashes: 2,
        onlineSales: 5,
        onlineCashes: 0,
        slotsSnapshot: [
          {
            boxNumber: 1,
            status: 'ACTIVE',
            packNumber: 'PACK-A',
            gameName: '5X Money',
            price: 1,
            packSize: 100,
            startTicket: 0,
            currentTicket: 10,
            ticketsSold: 10
          }
        ],
        soldOutSnapshot: []
      }
    ]
  };

  const dayData = getScreenDayReportData(state);
  const box1 = dayData.boxes.find(b => b.box === 1);
  assert(Boolean(box1), 'Scenario 6: Box 1 exists in Day Report');
  assert(box1.open === '000', `Scenario 6: Day opening ticket is 000 (got ${box1.open})`);
  assert(box1.close === '015', `Scenario 6: Day closing ticket is 015 (got ${box1.close})`);
  assert(box1.sold === 15, `Scenario 6: Total tickets sold today for Box 1 is 15 (got ${box1.sold})`);
  assert(dayData.totalTickets === 15, `Scenario 6: Total day tickets is 15 (got ${dayData.totalTickets})`);
  assert(dayData.totalInstantSales === 15, `Scenario 6: Total day sales is $15.00 (got ${dayData.totalInstantSales})`);
}

// Test Day Report with Pack A sold out and Pack B loaded
{
  const packBSlot = {
    boxNumber: 1,
    status: 'ACTIVE',
    packNumber: 'PACK-B',
    gameName: '10X Money',
    price: 2,
    packSize: 100,
    packStartTicket: 0,
    startTicket: 0,
    currentTicket: 3,
    ticketsSold: 3
  };

  const stateWithBothPacks = {
    settings: { operationMode: 'DAILY' },
    shiftNumber: 2,
    shiftStartedAt: new Date().toISOString(),
    slots: [packBSlot],
    soldOutThisShift: [
      {
        boxNumber: 1,
        packNumber: 'PACK-A',
        gameName: '5X Money',
        price: 1,
        packSize: 100,
        startTicket: 10,
        closeTicket: 100,
        ticketsSold: 90,
        salesAmount: 90
      }
    ],
    shiftHistory: []
  };

  const dayData = getScreenDayReportData(stateWithBothPacks);
  assert(dayData.totalTickets === 93, `Scenario 8: Day Report includes Pack A (90) + Pack B (3) = 93 (got ${dayData.totalTickets})`);
  assert(dayData.totalInstantSales === 96, `Scenario 8: Day Report includes Pack A ($90) + Pack B ($6) = $96 (got ${dayData.totalInstantSales})`);
}

// Test Today vs Yesterday comparison
{
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString();
  const state = {
    shiftStatus: 'IN_PROGRESS',
    slots: [
      {
        boxNumber: 1,
        status: 'ACTIVE',
        packNumber: 'PACK-A',
        price: 1,
        startTicket: 0,
        currentTicket: 25
      }
    ],
    soldOutThisShift: [],
    shiftHistory: [
      {
        shiftNumber: 1,
        startedAt: yesterdayDate,
        endedAt: yesterdayDate,
        totalTicketsSold: 40,
        totalSalesRevenue: 120,
        cashes: 20,
        onlineSales: 30,
        onlineCashes: 10,
        activationsCount: 2
      }
    ]
  };

  const comparison = getTodayVsYesterdayComparison(state);
  assert(comparison.yesterday.totalTickets === 40, `Scenario 9: Yesterday tickets strictly equals 40 (got ${comparison.yesterday.totalTickets})`);
  assert(comparison.yesterday.totalSales === 120, `Scenario 9: Yesterday sales strictly equals $120 (got ${comparison.yesterday.totalSales})`);
  assert(comparison.today.totalTickets === 25, `Scenario 9: Today tickets equals 25 (got ${comparison.today.totalTickets})`);
  assert(comparison.today.totalSales === 25, `Scenario 9: Today sales equals $25 (got ${comparison.today.totalSales})`);
  assert(comparison.differences.ticketsDelta === -15, `Scenario 9: Tickets delta is -15 (got ${comparison.differences.ticketsDelta})`);
}

// Test financial safety & accounting distinctions
{
  const state = {
    cashes: 45.00,
    onlineSales: 150.00,
    onlineCashes: 20.00,
    slots: [
      {
        boxNumber: 1,
        status: 'ACTIVE',
        packNumber: 'PACK-1',
        price: 5,
        startTicket: 0,
        currentTicket: 10
      }
    ],
    soldOutThisShift: [],
    shiftHistory: []
  };

  const comparison = getTodayVsYesterdayComparison(state);
  assert(comparison.today.totalSales === 50.00, `Scenario 13: Instant sales is $50.00 (got ${comparison.today.totalSales})`);
  assert(comparison.today.cashCollected === 45.00, `Scenario 13: Cash collected is $45.00 (got ${comparison.today.cashCollected})`);
  assert(comparison.today.onlineSales === 150.00, `Scenario 13: Online sales is $150.00 (got ${comparison.today.onlineSales})`);
  assert(comparison.today.onlineCashes === 20.00, `Scenario 13: Online cashes is $20.00 (got ${comparison.today.onlineCashes})`);
  assert(comparison.today.netSettlement === 135.00, `Scenario 13: Net settlement is $135.00 (got ${comparison.today.netSettlement})`);
}

// -------------------------------------------------------------------------
// PART 2: LIVE BROWSER RECONCILIATION VIA CDP (SELENIUM / CHROMIUM)
// -------------------------------------------------------------------------
console.log('\n--- PART 2: Live Browser Pack Progress & Dispenser Cards via CDP ---');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9922;

async function runBrowserTests() {
  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-lotto-count-'));
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

    const page = targets.find((t) => t.type === 'page');
    assert(Boolean(page), 'Chrome CDP page target found');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const callbacks = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (callbacks.has(data.id)) {
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

    await new Promise((r) => { ws.onopen = r; });
    await send('Runtime.enable');

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true });
      return res.result?.value;
    }

    // Wait for app to be ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      ready = await evaluate(`typeof window.calculatePackCumulativeSold === 'function' && typeof window.calculateSlotSoldTickets === 'function'`);
      if (ready) break;
      await sleep(250);
    }
    assert(ready, 'App loaded with calculatePackCumulativeSold and calculateSlotSoldTickets available');

    // Run Scenarios 1 to 5 in the browser environment:
    const browserResults = await evaluate(`
      (() => {
        // 1. Pack A initial state
        const slotA = {
          boxNumber: 1,
          status: 'ACTIVE',
          packNumber: 'PACK-A',
          gameName: '5X Money',
          price: 1,
          packSize: 100,
          packStartTicket: 0,
          startTicket: 0,
          currentTicket: 10,
          ticketsSold: 10,
          packCumulativeSold: 10,
          packCumulativeSoldBase: 0
        };

        const sc1_shiftSold = window.calculateSlotSoldTickets(slotA);
        const sc1_packSold = window.calculatePackCumulativeSold(slotA);

        // 2 & 3. Close shift and start new shift
        const slotA_shift2 = {
          boxNumber: 1,
          status: 'ACTIVE',
          packNumber: 'PACK-A',
          gameName: '5X Money',
          price: 1,
          packSize: 100,
          packStartTicket: 0,
          startTicket: 10,
          currentTicket: 10,
          ticketsSold: 0,
          previousShiftSold: 10,
          packCumulativeSold: 10,
          packCumulativeSoldBase: 10
        };

        const sc2_shiftSold = window.calculateSlotSoldTickets(slotA_shift2);
        const sc2_packSold = window.calculatePackCumulativeSold(slotA_shift2);

        // 4 & 5. Sell 5 tickets in Shift 2
        const slotA_shift2_sold5 = {
          ...slotA_shift2,
          currentTicket: 15,
          ticketsSold: 5
        };

        const sc4_shiftSold = window.calculateSlotSoldTickets(slotA_shift2_sold5);
        const sc4_packSold = window.calculatePackCumulativeSold(slotA_shift2_sold5);

        // 7. Load Pack B
        const slotB = {
          boxNumber: 1,
          status: 'ACTIVE',
          packNumber: 'PACK-B',
          price: 2,
          packSize: 100,
          packStartTicket: 0,
          startTicket: 0,
          currentTicket: 0,
          ticketsSold: 0,
          packCumulativeSold: 0,
          packCumulativeSoldBase: 0
        };
        const sc7_packSold = window.calculatePackCumulativeSold(slotB);

        // 11. Countdown descending pack
        const slotCountdown = {
          price: 5,
          packSize: 60,
          startTicket: 0,
          currentTicket: 55
        };
        const sc11_sold = window.calculateSlotSoldTickets(slotCountdown);

        return {
          sc1_shiftSold,
          sc1_packSold,
          sc2_shiftSold,
          sc2_packSold,
          sc4_shiftSold,
          sc4_packSold,
          sc7_packSold,
          sc11_sold
        };
      })()
    `);

    assert(browserResults.sc1_shiftSold === 10, 'Browser: Scenario 1 shiftSold is 10');
    assert(browserResults.sc1_packSold === 10, 'Browser: Scenario 1 packSold is 10');
    assert(browserResults.sc2_shiftSold === 0, 'Browser: Scenario 2 shiftSold resets to 0 in new shift');
    assert(browserResults.sc2_packSold === 10, 'Browser: Scenario 3 packSold remains 10 on new shift start');
    assert(browserResults.sc4_shiftSold === 5, 'Browser: Scenario 4 shiftSold is 5 after 5 sales');
    assert(browserResults.sc4_packSold === 15, 'Browser: Scenario 5 packSold advances to 15 (10 + 5)');
    assert(browserResults.sc7_packSold === 0, 'Browser: Scenario 7 Pack B starts fresh cumulative count at 0');
    assert(browserResults.sc11_sold === 4, 'Browser: Scenario 11 Descending countdown pack calculates 4 tickets sold');

    ws.close();
  } finally {
    try {
      chromeProcess.kill('SIGKILL');
    } catch (_) {}
  }
}

await runBrowserTests();

console.log(`\n================================================================`);
console.log(` ALL LOTTERY & REPORT TESTS PASSED: ${passed} / ${total}`);
console.log(`================================================================`);
