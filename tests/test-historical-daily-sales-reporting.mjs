// tests/test-historical-daily-sales-reporting.mjs
import { getScreenDayReportData, parseFlexibleDate, isSameBusinessDay } from '../src/dayReportData.js';
import { getDailyReportData, getHistoryScreenData } from '../src/historyData.js';

console.log('================================================================');
console.log(' TEST: HISTORICAL DAILY LOTTERY SALES REPORTING VERIFICATION');
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

// -------------------------------------------------------------------------
// SETUP TEST DATA WITH 3 HISTORICAL DATES AND MULTIPLE SHIFTS/PACKS
// -------------------------------------------------------------------------

// Date 1: 10/14/2026 (Shifts 1 & 2)
// Box 1: Pack-A ($1). Shift 1 sold 15, Shift 2 sold 20. Total Box 1 = 35 tickets ($35.00)
// Box 2: Pack-C ($2). Shift 1 sold 10, Shift 2 sold 15. Total Box 2 = 25 tickets ($50.00)
// Expected Date 1: 60 tickets, $85.00 sales, cashes = $12.00, online = $30.00
const shift1 = {
  shiftNumber: 1,
  cashier: 'Daniel',
  date: 'Tue, Oct 14',
  startedAt: '2026-10-14T07:00:00.000Z',
  endedAt: '2026-10-14T15:00:00.000Z',
  totalTicketsSold: 25,
  totalSalesRevenue: 35.00,
  cashes: 5.00,
  onlineSales: 10.00,
  onlineCashes: 0.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-A', gameName: '5X Money', price: 1, startTicket: 0, currentTicket: 15, ticketsSold: 15 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 0, currentTicket: 10, ticketsSold: 10 }
  ],
  soldOutSnapshot: []
};

const shift2 = {
  shiftNumber: 2,
  cashier: 'Rosa',
  date: 'Tue, Oct 14',
  startedAt: '2026-10-14T15:05:00.000Z',
  endedAt: '2026-10-14T22:00:00.000Z',
  totalTicketsSold: 35,
  totalSalesRevenue: 50.00,
  cashes: 7.00,
  onlineSales: 20.00,
  onlineCashes: 5.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-A', gameName: '5X Money', price: 1, startTicket: 15, currentTicket: 35, ticketsSold: 20 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 10, currentTicket: 25, ticketsSold: 15 }
  ],
  soldOutSnapshot: []
};

// Date 2: 10/15/2026 (Shifts 3 & 4)
// Box 1: Pack-A sells remaining 65 tickets (sold out!). Pack-B ($2) activated, sells 5 tickets in Shift 3.
// Shift 4: Box 1 (Pack-B) sells 7 tickets. Box 3 (Pack-D $5) activated, sells 8 tickets.
// Expected Date 2:
// Pack-A: 65 tickets ($65.00, sold out)
// Pack-B: 5 + 7 = 12 tickets ($24.00, active)
// Pack-D: 8 tickets ($40.00, active)
// Total Date 2 tickets = 65 + 12 + 8 = 85 tickets
// Total Date 2 sales = $65 + $24 + $40 = $129.00
const shift3 = {
  shiftNumber: 3,
  cashier: 'Daniel',
  date: 'Wed, Oct 15',
  startedAt: '2026-10-15T07:00:00.000Z',
  endedAt: '2026-10-15T15:00:00.000Z',
  totalTicketsSold: 70,
  totalSalesRevenue: 75.00, // 65 * $1 + 5 * $2
  cashes: 15.00,
  onlineSales: 25.00,
  onlineCashes: 10.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, packStartTicket: 0, startTicket: 0, currentTicket: 5, ticketsSold: 5 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 25, ticketsSold: 0 }
  ],
  soldOutSnapshot: [
    { boxNumber: 1, packNumber: 'PACK-A', gameName: '5X Money', price: 1, startTicket: 35, closeTicket: 100, ticketsSold: 65, salesAmount: 65.00 }
  ]
};

const shift4 = {
  shiftNumber: 4,
  cashier: 'Rosa',
  date: 'Wed, Oct 15',
  startedAt: '2026-10-15T15:05:00.000Z',
  endedAt: '2026-10-15T22:00:00.000Z',
  totalTicketsSold: 15,
  totalSalesRevenue: 54.00, // 7 * $2 + 8 * $5
  cashes: 10.00,
  onlineSales: 15.00,
  onlineCashes: 0.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, packStartTicket: 0, startTicket: 5, currentTicket: 12, ticketsSold: 7 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 25, ticketsSold: 0 },
    { boxNumber: 3, status: 'ACTIVE', packNumber: 'PACK-D', gameName: 'Jumbo 7s', price: 5, packStartTicket: 0, startTicket: 0, currentTicket: 8, ticketsSold: 8 }
  ],
  soldOutSnapshot: []
};

// Date 3: 10/16/2026 (Shifts 5 & 6)
// Box 1 (Pack-B): Shift 5 sells 10, Shift 6 sells 8. Total = 18 tickets ($36.00)
// Box 3 (Pack-D): Shift 5 sells 5, Shift 6 sells 0. Total = 5 tickets ($25.00)
// Box 4 (Pack-E $10): Shift 5 sells 0, Shift 6 sells 6. Total = 6 tickets ($60.00)
// Expected Date 3:
// Total tickets = 18 + 5 + 6 = 29 tickets
// Total sales = $36 + $25 + $60 = $121.00
const shift5 = {
  shiftNumber: 5,
  cashier: 'Daniel',
  date: 'Thu, Oct 16',
  startedAt: '2026-10-16T07:00:00.000Z',
  endedAt: '2026-10-16T15:00:00.000Z',
  totalTicketsSold: 15,
  totalSalesRevenue: 45.00, // 10 * $2 + 5 * $5
  cashes: 20.00,
  onlineSales: 40.00,
  onlineCashes: 15.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, startTicket: 12, currentTicket: 22, ticketsSold: 10 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 25, ticketsSold: 0 },
    { boxNumber: 3, status: 'ACTIVE', packNumber: 'PACK-D', gameName: 'Jumbo 7s', price: 5, startTicket: 8, currentTicket: 13, ticketsSold: 5 }
  ],
  soldOutSnapshot: []
};

const shift6 = {
  shiftNumber: 6,
  cashier: 'Rosa',
  date: 'Thu, Oct 16',
  startedAt: '2026-10-16T15:05:00.000Z',
  endedAt: '2026-10-16T22:00:00.000Z',
  totalTicketsSold: 14,
  totalSalesRevenue: 76.00, // 8 * $2 + 6 * $10
  cashes: 18.00,
  onlineSales: 30.00,
  onlineCashes: 5.00,
  slotsSnapshot: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, startTicket: 22, currentTicket: 30, ticketsSold: 8 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 25, ticketsSold: 0 },
    { boxNumber: 3, status: 'ACTIVE', packNumber: 'PACK-D', gameName: 'Jumbo 7s', price: 5, startTicket: 13, currentTicket: 13, ticketsSold: 0 },
    { boxNumber: 4, status: 'ACTIVE', packNumber: 'PACK-E', gameName: 'Diamond Millions', price: 10, packStartTicket: 0, startTicket: 0, currentTicket: 6, ticketsSold: 6 }
  ],
  soldOutSnapshot: []
};

// Initial state containing the 3 historical days
const historicalState = {
  storeName: 'AMIGO FOOD MART',
  storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
  shiftNumber: 7,
  cashierName: 'Anish',
  shiftStartedAt: '2026-10-17T07:00:00.000Z',
  slots: [
    { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, startTicket: 30, currentTicket: 30, ticketsSold: 0 },
    { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 25, ticketsSold: 0 },
    { boxNumber: 3, status: 'ACTIVE', packNumber: 'PACK-D', gameName: 'Jumbo 7s', price: 5, startTicket: 13, currentTicket: 13, ticketsSold: 0 },
    { boxNumber: 4, status: 'ACTIVE', packNumber: 'PACK-E', gameName: 'Diamond Millions', price: 10, startTicket: 6, currentTicket: 6, ticketsSold: 0 }
  ],
  soldOutThisShift: [],
  shiftHistory: [shift6, shift5, shift4, shift3, shift2, shift1]
};

// -------------------------------------------------------------------------
// TEST 1: HISTORICAL DATE 1 (Oct 14, 2026)
// -------------------------------------------------------------------------
console.log('--- TEST 1: Historical Date 1 (Oct 14, 2026) ---');
const date1Report = getScreenDayReportData(historicalState, { targetDate: 'Oct 14, 2026' });

console.log(`  Expected Date 1 Tickets: 60 | Calculated: ${date1Report.totalTickets}`);
console.log(`  Expected Date 1 Sales: $85.00 | Calculated: $${date1Report.totalInstantSales.toFixed(2)}`);

assert(date1Report.totalTickets === 60, `Date 1 total tickets strictly equals 60 (got ${date1Report.totalTickets})`);
assert(date1Report.totalInstantSales === 85.00, `Date 1 total instant sales strictly equals $85.00 (got $${date1Report.totalInstantSales})`);
assert(date1Report.shifts.length === 2, `Date 1 has 2 shifts included (got ${date1Report.shifts.length})`);
assert(date1Report.shifts[0].tickets === 25, `Shift 1 tickets equals 25`);
assert(date1Report.shifts[1].tickets === 35, `Shift 2 tickets equals 35`);

const date1Box1 = date1Report.boxes.find(b => b.box === 1);
assert(Boolean(date1Box1), `Date 1 Box 1 exists in report`);
assert(date1Box1.open === '000', `Date 1 Box 1 opening ticket is 000 (got ${date1Box1.open})`);
assert(date1Box1.close === '035', `Date 1 Box 1 closing ticket is 035 (got ${date1Box1.close})`);
assert(date1Box1.sold === 35, `Date 1 Box 1 sold tickets is 35 (got ${date1Box1.sold})`);

const date1DailyTab = getDailyReportData(historicalState, 'Oct 14');
assert(date1DailyTab.totalTickets === 60, `getDailyReportData for Oct 14 returns 60 tickets (got ${date1DailyTab.totalTickets})`);
assert(date1DailyTab.totalSales === 85.00, `getDailyReportData for Oct 14 returns $85.00 sales (got $${date1DailyTab.totalSales})`);

// -------------------------------------------------------------------------
// TEST 2: HISTORICAL DATE 2 (Oct 15, 2026)
// Multi-pack in Box 1: Pack-A (sold out, 65 sold) + Pack-B (active, 12 sold)
// -------------------------------------------------------------------------
console.log('\n--- TEST 2: Historical Date 2 (Oct 15, 2026) ---');
const date2Report = getScreenDayReportData(historicalState, { targetDate: 'Oct 15, 2026' });

console.log(`  Expected Date 2 Tickets: 85 | Calculated: ${date2Report.totalTickets}`);
console.log(`  Expected Date 2 Sales: $129.00 | Calculated: $${date2Report.totalInstantSales.toFixed(2)}`);

assert(date2Report.totalTickets === 85, `Date 2 total tickets strictly equals 85 (got ${date2Report.totalTickets})`);
assert(date2Report.totalInstantSales === 129.00, `Date 2 total sales strictly equals $129.00 (got $${date2Report.totalInstantSales})`);
assert(date2Report.shifts.length === 2, `Date 2 includes 2 shifts (got ${date2Report.shifts.length})`);
assert(date2Report.soldOutCount === 1, `Date 2 records 1 sold-out pack (got ${date2Report.soldOutCount})`);

// Verify Box 1 includes BOTH sold-out Pack-A and active Pack-B
const box1Rows = date2Report.boxes.filter(b => b.box === 1);
assert(box1Rows.length === 2, `Date 2 Box 1 has 2 rows for the two packs used that day (got ${box1Rows.length})`);

const packARow = box1Rows.find(r => r.pack === 'PACK-A');
assert(Boolean(packARow), `Date 2 includes sold-out PACK-A`);
assert(packARow.isSoldOut === true, `PACK-A is marked sold out`);
assert(packARow.sold === 65, `PACK-A sold 65 tickets (got ${packARow.sold})`);

const packBRow = box1Rows.find(r => r.pack === 'PACK-B');
assert(Boolean(packBRow), `Date 2 includes active PACK-B`);
assert(packBRow.isSoldOut === false, `PACK-B is marked active (not sold out)`);
assert(packBRow.sold === 12, `PACK-B sold 12 tickets on Date 2 (got ${packBRow.sold})`);

// No double counting: 65 + 12 = 77 tickets for Box 1
assert((packARow.sold + packBRow.sold) === 77, `Box 1 total tickets is 77 (65 from Pack A + 12 from Pack B)`);

const date2DailyTab = getDailyReportData(historicalState, 'Oct 15');
assert(date2DailyTab.totalTickets === 85, `getDailyReportData for Oct 15 returns 85 tickets (got ${date2DailyTab.totalTickets})`);
assert(date2DailyTab.totalSales === 129.00, `getDailyReportData for Oct 15 returns $129.00 sales (got $${date2DailyTab.totalSales})`);

// -------------------------------------------------------------------------
// TEST 3: HISTORICAL DATE 3 (Oct 16, 2026)
// Multiple boxes & packs: Box 1 (18 sold), Box 3 (5 sold), Box 4 (6 sold)
// -------------------------------------------------------------------------
console.log('\n--- TEST 3: Historical Date 3 (Oct 16, 2026) ---');
const date3Report = getScreenDayReportData(historicalState, { targetDate: 'Oct 16, 2026' });

console.log(`  Expected Date 3 Tickets: 29 | Calculated: ${date3Report.totalTickets}`);
console.log(`  Expected Date 3 Sales: $121.00 | Calculated: $${date3Report.totalInstantSales.toFixed(2)}`);

assert(date3Report.totalTickets === 29, `Date 3 total tickets strictly equals 29 (got ${date3Report.totalTickets})`);
assert(date3Report.totalInstantSales === 121.00, `Date 3 total sales strictly equals $121.00 (got $${date3Report.totalInstantSales})`);
assert(date3Report.shifts.length === 2, `Date 3 includes 2 shifts (got ${date3Report.shifts.length})`);

const date3Box1 = date3Report.boxes.find(b => b.box === 1);
assert(Boolean(date3Box1), `Date 3 Box 1 exists`);
assert(date3Box1.open === '012', `Date 3 Box 1 opens at 012 (got ${date3Box1.open})`);
assert(date3Box1.close === '030', `Date 3 Box 1 closes at 030 (got ${date3Box1.close})`);
assert(date3Box1.sold === 18, `Date 3 Box 1 sold 18 tickets (got ${date3Box1.sold})`);

const date3Box4 = date3Report.boxes.find(b => b.box === 4);
assert(Boolean(date3Box4), `Date 3 Box 4 exists (Pack-E)`);
assert(date3Box4.open === '000', `Date 3 Box 4 opens at 000 (got ${date3Box4.open})`);
assert(date3Box4.close === '006', `Date 3 Box 4 closes at 006 (got ${date3Box4.close})`);
assert(date3Box4.sold === 6, `Date 3 Box 4 sold 6 tickets (got ${date3Box4.sold})`);

const date3DailyTab = getDailyReportData(historicalState, 'Oct 16');
assert(date3DailyTab.totalTickets === 29, `getDailyReportData for Oct 16 returns 29 tickets (got ${date3DailyTab.totalTickets})`);
assert(date3DailyTab.totalSales === 121.00, `getDailyReportData for Oct 16 returns $121.00 sales (got $${date3DailyTab.totalSales})`);

// -------------------------------------------------------------------------
// TEST 4: FROZEN HISTORICAL ACCURACY WHEN SUBSEQUENT SALES OCCUR (DATE 4 / TODAY)
// -------------------------------------------------------------------------
console.log('\n--- TEST 4: Frozen Historical Accuracy Across Later Sales ---');
// Simulate massive new sales happening on Day 4 (Today: 10/17/2026)
const activeSlotsNow = [
  { boxNumber: 1, status: 'ACTIVE', packNumber: 'PACK-B', gameName: '10X Money', price: 2, startTicket: 30, currentTicket: 70, ticketsSold: 40 },
  { boxNumber: 2, status: 'ACTIVE', packNumber: 'PACK-C', gameName: 'Hit 100', price: 2, startTicket: 25, currentTicket: 45, ticketsSold: 20 },
  { boxNumber: 3, status: 'ACTIVE', packNumber: 'PACK-D', gameName: 'Jumbo 7s', price: 5, startTicket: 13, currentTicket: 23, ticketsSold: 10 },
  { boxNumber: 4, status: 'ACTIVE', packNumber: 'PACK-E', gameName: 'Diamond Millions', price: 10, startTicket: 6, currentTicket: 16, ticketsSold: 10 }
];

const stateAfterLaterSales = {
  ...historicalState,
  slots: activeSlotsNow,
  shiftStartedAt: '2026-10-17T08:00:00.000Z'
};

// Re-query historical dates 1, 2, and 3
const date1After = getScreenDayReportData(stateAfterLaterSales, { targetDate: 'Oct 14, 2026' });
const date2After = getScreenDayReportData(stateAfterLaterSales, { targetDate: 'Oct 15, 2026' });
const date3After = getScreenDayReportData(stateAfterLaterSales, { targetDate: 'Oct 16, 2026' });

assert(date1After.totalTickets === 60, `Date 1 remains EXACTLY 60 tickets after later sales (got ${date1After.totalTickets})`);
assert(date1After.totalInstantSales === 85.00, `Date 1 sales remain EXACTLY $85.00 (got $${date1After.totalInstantSales})`);

assert(date2After.totalTickets === 85, `Date 2 remains EXACTLY 85 tickets after later sales (got ${date2After.totalTickets})`);
assert(date2After.totalInstantSales === 129.00, `Date 2 sales remain EXACTLY $129.00 (got $${date2After.totalInstantSales})`);

assert(date3After.totalTickets === 29, `Date 3 remains EXACTLY 29 tickets after later sales (got ${date3After.totalTickets})`);
assert(date3After.totalInstantSales === 121.00, `Date 3 sales remain EXACTLY $121.00 (got $${date3After.totalInstantSales})`);

// -------------------------------------------------------------------------
// TEST 5: DATE SELECTION & REFERENCE FALLBACK INTEGRITY
// -------------------------------------------------------------------------
console.log('\n--- TEST 5: Date Selection & Reference Fallback Integrity ---');

// Fallback when shiftHistory is empty: REFERENCE_CLOSED_SHIFTS provides Oct 17, 16, 15, 14
const emptyState = { shiftHistory: [] };
const refOct17 = getDailyReportData(emptyState, 'Oct 17');
assert(refOct17.totalTickets === 449, `Empty history fallback: Oct 17 has 449 tickets (got ${refOct17.totalTickets})`);
assert(refOct17.totalSales === 2685.00, `Empty history fallback: Oct 17 has $2685.00 sales (got $${refOct17.totalSales})`);
assert(refOct17.closedCount === 2, `Empty history fallback: Oct 17 has 2 shifts (got ${refOct17.closedCount})`);

const refOct16 = getDailyReportData(emptyState, 'Oct 16');
assert(refOct16.totalTickets === 409, `Empty history fallback: Oct 16 has 409 tickets (got ${refOct16.totalTickets})`);
assert(refOct16.totalSales === 2441.00, `Empty history fallback: Oct 16 has $2441.00 sales (got $${refOct16.totalSales})`);

const refOct15 = getDailyReportData(emptyState, 'Oct 15');
assert(refOct15.totalTickets === 427, `Empty history fallback: Oct 15 has 427 tickets (got ${refOct15.totalTickets})`);
assert(refOct15.totalSales === 2518.00, `Empty history fallback: Oct 15 has $2518.00 sales (got $${refOct15.totalSales})`);

const refOct14 = getDailyReportData(emptyState, 'Oct 14');
assert(refOct14.totalTickets === 413, `Empty history fallback: Oct 14 has 413 tickets (got ${refOct14.totalTickets})`);
assert(refOct14.totalSales === 2436.00, `Empty history fallback: Oct 14 has $2436.00 sales (got $${refOct14.totalSales})`);

console.log(`\n================================================================`);
console.log(` ALL HISTORICAL REPORTING TESTS PASSED: ${passed} / ${total}`);
console.log(`================================================================\n`);

