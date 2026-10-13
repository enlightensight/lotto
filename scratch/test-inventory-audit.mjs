import { getInventoryScreenData } from '../src/inventoryData.js';

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

console.log('=== TESTING INVENTORY & AUDIT SCREEN AUDIT ===\n');

// 1. KPI Metrics
console.log('1. Verifying Top 5 KPI Metrics:');
const defaultData = getInventoryScreenData(null, 'rack', '');

assert(defaultData.kpis.packsOnRackCount === 19, `Packs on rack = ${defaultData.kpis.packsOnRackCount} (expected 19)`);
assert(defaultData.kpis.emptyBoxesCount === 46, `Empty boxes = ${defaultData.kpis.emptyBoxesCount} (expected 46)`);
assert(defaultData.kpis.ticketsOnRackCount === 1882, `Tickets on rack = ${defaultData.kpis.ticketsOnRackCount} (expected 1,882)`);
assert(defaultData.kpis.totalRackCapacity === 2240, `Total rack capacity = ${defaultData.kpis.totalRackCapacity} (expected 2,240)`);
assert(defaultData.kpis.rackValue === 6383.00, `Rack value = $${defaultData.kpis.rackValue} (expected $6,383.00)`);
assert(defaultData.kpis.safeValue === 1200.00, `Safe value = $${defaultData.kpis.safeValue} (expected $1,200.00)`);
assert(defaultData.kpis.safePacksCount === 4, `Safe packs count = ${defaultData.kpis.safePacksCount} (expected 4)`);
assert(defaultData.kpis.soldTodaySales === 1237.00, `Sold today sales = $${defaultData.kpis.soldTodaySales} (expected $1,237.00)`);
assert(defaultData.kpis.soldTodayTickets === 248, `Sold today tickets = ${defaultData.kpis.soldTodayTickets} (expected 248)`);

// 2. Tab counts
console.log('\n2. Verifying Filter Tabs and Counts:');
assert(defaultData.counts.rack === 19, `Rack tab count = ${defaultData.counts.rack} (expected 19)`);
assert(defaultData.counts.safe === 4, `Safe tab count = ${defaultData.counts.safe} (expected 4)`);
assert(defaultData.counts.sold === 1, `Sold tab count = ${defaultData.counts.sold} (expected 1)`);
assert(defaultData.counts.returned === 0, `Returned tab count = ${defaultData.counts.returned} (expected 0)`);
assert(defaultData.counts.empty === 46, `Empty tab count = ${defaultData.counts.empty} (expected 46)`);

// 3. Tab contents
console.log('\n3. Verifying Tab Contents:');
const rackData = getInventoryScreenData(null, 'rack', '');
assert(rackData.rackItems.length === 19, `Rack table has 19 active items`);
assert(rackData.rackItems[0].box === 1 && rackData.rackItems[0].game === '5X Money', 'Row 1 is Box 1 5X Money');
assert(rackData.rackItems[0].currentTicket === 13 && rackData.rackItems[0].ticketsLeft === 287, 'Box 1 has #013/300, 287 left');

const safeData = getInventoryScreenData(null, 'safe', '');
assert(safeData.safeItems.length === 4, `Safe table has 4 packs`);

const soldData = getInventoryScreenData(null, 'sold', '');
assert(soldData.soldOutItems.length === 1, `Sold out table has 1 pack`);
assert(soldData.soldOutItems[0].box === 16 && soldData.soldOutItems[0].gameName === 'Treasure Hunt', 'Sold out item is Box 16 Treasure Hunt');

const emptyData = getInventoryScreenData(null, 'empty', '');
assert(emptyData.emptyBoxes.length === 46, `Empty boxes table has 46 items`);

// 4. Search Filter
console.log('\n4. Verifying Search Functionality:');
const searchFrogger = getInventoryScreenData(null, 'rack', 'frogger');
assert(searchFrogger.rackItems.length === 1, 'Search "frogger" returns 1 result');
assert(searchFrogger.rackItems[0].box === 57, 'Frogger is in Box 57');

const searchBox25 = getInventoryScreenData(null, 'rack', '25');
assert(searchBox25.rackItems.length >= 1, 'Search "25" finds Box 25');
assert(searchBox25.rackItems.some(i => i.box === 25), 'Search results include Box 25');

const searchPack = getInventoryScreenData(null, 'rack', '128842');
assert(searchPack.rackItems.length === 1 && searchPack.rackItems[0].box === 1, 'Search "128842" finds Box 1');

console.log(`\n=== RESULTS: Passed: ${passed}, Failed: ${failed} ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL INVENTORY AUDIT TESTS PASSED CLEANLY!\n');
}
