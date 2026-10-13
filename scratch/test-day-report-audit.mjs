import { getScreenDayReportData, AMIGO_SCREENSHOT_DAY_REPORT } from '../src/dayReportData.js';

let passed = 0;
let failed = 0;

function assert(condition, desc) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${desc}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

console.log('=== TESTING DAY REPORT SCREEN DATA AUDIT ===\n');

// Test 1: Screenshot reference dataset
console.log('1. Verifying Reference Dataset (Matching UI Screenshot):');
const defaultData = getScreenDayReportData(null, { showEmptyBoxes: false });

assert(defaultData.storeName === 'AMIGO FOOD MART', 'Store name matches AMIGO FOOD MART');
assert(defaultData.totalInstantSales === 1237.00, 'Total instant sales is $1,237.00');
assert(defaultData.totalTickets === 248, 'Total tickets sold is 248');
assert(defaultData.soldOutCount === 1, 'Sold out count is 1');
assert(defaultData.soldOutBox === 'Box 16', 'Sold out box is Box 16');
assert(defaultData.boxes.length === 20, '20 active boxes with sales in summary table');

// Box 16 sold out check
const box16 = defaultData.boxes.find(b => b.box === 16);
assert(box16 && box16.isSoldOut === true, 'Box 16 is marked as isSoldOut');
assert(box16 && box16.sold === 100 && box16.price === 3 && box16.total === 300, 'Box 16 has 100 sold @ $3 = $300');

// Price breakdown mathematical verification
console.log('\n2. Verifying Sales By Price Breakdown:');
const sumBreakdownTix = defaultData.priceBreakdown.reduce((s, p) => s + p.count, 0);
const sumBreakdownSales = defaultData.priceBreakdown.reduce((s, p) => s + p.total, 0);
assert(sumBreakdownTix === 248, `Breakdown tickets sum = ${sumBreakdownTix} (expected 248)`);
assert(sumBreakdownSales === 1237.00, `Breakdown sales sum = $${sumBreakdownSales} (expected $1237.00)`);

// Test 2: Show Empty Boxes Toggle
console.log('\n3. Verifying Show Empty Boxes Toggle:');
const emptyData = getScreenDayReportData(null, { showEmptyBoxes: true });
assert(emptyData.boxes.length === 65, `Empty boxes expanded total = ${emptyData.boxes.length} (expected 65)`);
assert(emptyData.boxes[0].box === 1, 'First box is Box 1');
assert(emptyData.boxes[64].box === 65, 'Last box is Box 65');
const box5 = emptyData.boxes.find(b => b.box === 5);
assert(box5 && box5.isEmpty === true, 'Box 5 is marked as empty row');

// Test 3: Live store state calculation
console.log('\n4. Verifying Live Store State Calculation:');
const mockLiveState = {
  storeName: 'AMIGO FOOD MART',
  cashierName: 'master',
  shiftStartedAt: new Date().toISOString(),
  slots: [
    { boxNumber: 1, packNumber: '141701', gameName: '5X MONEY', price: 1, startTicket: 0, currentTicket: 10, status: 'ACTIVE' },
    { boxNumber: 2, packNumber: '141001', gameName: 'JR JUMBO', price: 2, startTicket: 0, currentTicket: 5, status: 'ACTIVE' }
  ],
  soldOutThisShift: []
};

const liveData = getScreenDayReportData(mockLiveState, { showEmptyBoxes: false });
assert(liveData.isLive === true, 'Live state recognized as live report');
assert(liveData.totalTickets === 15, `Live total tickets = ${liveData.totalTickets} (expected 15)`);
assert(liveData.totalInstantSales === 20.00, `Live total sales = $${liveData.totalInstantSales} (expected 10*1 + 5*2 = $20.00)`);

console.log(`\n=== RESULTS: Passed: ${passed}, Failed: ${failed} ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL DAY REPORT AUDIT TESTS PASSED CLEANLY!\n');
}
