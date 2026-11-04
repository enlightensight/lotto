// ============================================================================
// Comprehensive Automated Test Suite: Jackpotlo Admin Panel Features 1-7
// ============================================================================

import assert from 'assert';
import {
  DEFAULT_LOTTERY_CATALOG,
  DEFAULT_INITIAL_STORES,
  DEFAULT_INITIAL_APPLICATIONS,
  getLocalAdminState,
  saveLocalAdminState,
  fetchAdminOverview,
  updateStoreStatus,
  reviewStoreApplication,
  addOrUpdateCatalogGame,
  reviewStoreTicketRequest,
  createTicketAllocation,
  checkStoreCanSell,
  fetchAdminReports,
  syncAdminStateFromServer
} from '../src/adminStoreSync.js';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Mock minimal browser storage & fetch for test environment
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}
if (typeof sessionStorage === 'undefined') {
  const sStore = {};
  global.sessionStorage = {
    getItem: (k) => sStore[k] || null,
    setItem: (k, v) => { sStore[k] = String(v); },
    removeItem: (k) => { delete sStore[k]; },
    clear: () => { Object.keys(sStore).forEach(k => delete sStore[k]); }
  };
}

// Reset admin storage to clean baseline before tests
localStorage.clear();
sessionStorage.clear();

console.log('\n====================================================');
console.log('   JACKPOTLO ADMIN PANEL VERIFICATION TEST SUITE    ');
console.log('====================================================\n');

// ----------------------------------------------------------------------------
// Feature 1: Admin Dashboard & Overview KPIs
// ----------------------------------------------------------------------------
console.log('--- Feature 1: Dashboard KPIs ---');
await itAsync('Admin overview returns total stores, pending applications, approved and suspended stores', async () => {
  const res = await fetchAdminOverview();
  assert.strictEqual(res.success, true);
  assert.ok(typeof res.stats.totalStores === 'number');
  assert.ok(typeof res.stats.pendingApplications === 'number');
  assert.ok(typeof res.stats.approvedStores === 'number');
  assert.ok(typeof res.stats.suspendedStores === 'number');
  assert.ok(res.stats.totalStores >= 2, 'Default stores should be >= 2');
  assert.ok(res.stats.pendingApplications >= 1, 'Default pending apps should be >= 1');
});

// ----------------------------------------------------------------------------
// Feature 2: Store Applications (Review, Approve, Reject, More Info)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 2: Store Applications Review & Decision ---');
await itAsync('Admin can request additional info on an application', async () => {
  const st = getLocalAdminState();
  const testAppId = st.applications[0].id;
  const res = await reviewStoreApplication(testAppId, 'MORE_INFO', 'admin', 'Need state lottery certificate copy');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.application.status, 'MORE_INFO_REQUIRED');
  assert.strictEqual(res.application.adminNotes, 'Need state lottery certificate copy');
});

await itAsync('Admin can approve application and register new store', async () => {
  const newApp = {
    id: 999,
    storeId: 'store_test_mart',
    storeName: 'TEST EXPRESS MART',
    applicantName: 'David Miller',
    applicantEmail: 'david@testmart.com',
    applicantPhone: '(478) 555-9988',
    businessTaxId: 'TAX-998811',
    lotteryRetailerId: 'GA-998822',
    address: '100 Test St, Warner Robins, GA',
    documents: ['Test_License.pdf'],
    status: 'PENDING',
    adminNotes: '',
    createdAt: new Date().toISOString()
  };
  const st = getLocalAdminState();
  st.applications.push(newApp);
  saveLocalAdminState(st);

  const res = await reviewStoreApplication(999, 'APPROVE', 'admin', 'Tax and license credentials verified');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.application.status, 'APPROVED');

  const updatedSt = getLocalAdminState();
  const registeredStore = updatedSt.stores.find(s => s.storeId === 'store_test_mart');
  assert.ok(registeredStore, 'Approved application must register store into stores list');
  assert.strictEqual(registeredStore.authorizationStatus, 'APPROVED');
  assert.strictEqual(registeredStore.operationalStatus, 'ACTIVE');
});

// ----------------------------------------------------------------------------
// Feature 3: Store Management (Suspend & Reactivate)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 3: Store Management & Suspension Enforcement ---');
await itAsync('Admin can suspend store and sales are strictly blocked', async () => {
  const res = await updateStoreStatus('store_downtown', 'SUSPENDED', 'INACTIVE', 'admin', 'Audit pending');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.store.authorizationStatus, 'SUSPENDED');

  // Verify POS permission gate blocks suspended store
  const sellCheck = checkStoreCanSell('store_downtown');
  assert.strictEqual(sellCheck.allowed, false, 'Suspended store must be disallowed from selling');
  assert.strictEqual(sellCheck.reason, 'STORE_SUSPENDED');
});

await itAsync('Admin can reactivate suspended store and sales are re-enabled', async () => {
  const res = await updateStoreStatus('store_downtown', 'APPROVED', 'ACTIVE', 'admin', 'Audit passed');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.store.authorizationStatus, 'APPROVED');

  const sellCheck = checkStoreCanSell('store_downtown');
  assert.strictEqual(sellCheck.allowed, true, 'Reactivated store must be allowed to sell');
});

// ----------------------------------------------------------------------------
// Feature 4: Central Lottery Ticket Catalog (Add, Edit, Deactivate)
// ----------------------------------------------------------------------------
console.log('\n--- Feature 4: Lottery Ticket Catalog (Add, Edit, Deactivate) ---');
await itAsync('Admin can add a new ticket type to catalog', async () => {
  const newGame = {
    gameId: '1999',
    gameCode: '1999',
    gameName: 'Georgia Gold Rush',
    price: 25,
    packSize: 20,
    packValue: 500,
    isActive: true
  };
  const res = await addOrUpdateCatalogGame(newGame, 'admin');
  assert.strictEqual(res.success, true);

  const st = getLocalAdminState();
  const game = st.catalog.find(g => g.gameId === '1999');
  assert.ok(game);
  assert.strictEqual(game.gameName, 'Georgia Gold Rush');
  assert.strictEqual(game.price, 25);
});

await itAsync('Admin can edit an existing ticket type in catalog', async () => {
  const res = await addOrUpdateCatalogGame({
    gameId: '1999',
    gameCode: '1999',
    gameName: 'Georgia Gold Rush Extreme',
    price: 30,
    packSize: 20,
    packValue: 600,
    isActive: true
  }, 'admin');
  assert.strictEqual(res.success, true);

  const st = getLocalAdminState();
  const game = st.catalog.find(g => g.gameId === '1999');
  assert.strictEqual(game.gameName, 'Georgia Gold Rush Extreme');
  assert.strictEqual(game.price, 30);
});

await itAsync('Admin can deactivate and activate ticket type', async () => {
  const st = getLocalAdminState();
  const game = st.catalog.find(g => g.gameId === '1999');
  
  // Deactivate
  await addOrUpdateCatalogGame({ ...game, isActive: false }, 'admin');
  let updated = getLocalAdminState().catalog.find(g => g.gameId === '1999');
  assert.strictEqual(updated.isActive, false, 'Game should be deactivated');

  // Reactivate
  await addOrUpdateCatalogGame({ ...game, isActive: true }, 'admin');
  updated = getLocalAdminState().catalog.find(g => g.gameId === '1999');
  assert.strictEqual(updated.isActive, true, 'Game should be active');
});

// ----------------------------------------------------------------------------
// Feature 5: Store Ticket Requests & Approvals
// ----------------------------------------------------------------------------
console.log('\n--- Feature 5: Store Ticket Requests & Approval Decisions ---');
await itAsync('Admin can approve store ticket request and record decision reason', async () => {
  const st = getLocalAdminState();
  const req = st.ticketRequests[0];
  const res = await reviewStoreTicketRequest(req.id, 'APPROVE', 'admin', 'Eligible high volume store');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.request.status, 'APPROVED');
  assert.strictEqual(res.request.adminDecisionReason, 'Eligible high volume store');

  // Verify game is added to store_approved_tickets
  const updatedSt = getLocalAdminState();
  const isApprovedForStore = updatedSt.approvedTickets.some(a => a.storeId === req.storeId && a.gameId === req.gameId);
  assert.ok(isApprovedForStore, 'Approving ticket request must authorize game in store_approved_tickets');
});

// ----------------------------------------------------------------------------
// Feature 6: Ticket Stock Allocation
// ----------------------------------------------------------------------------
console.log('\n--- Feature 6: Ticket Stock Allocation & History ---');
await itAsync('Admin can allocate physical stock packs to authorized store', async () => {
  const allocData = {
    allocationReference: 'ALC-TEST-001',
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    gameId: '1650',
    gameName: '5X Money',
    packNumber: '778899',
    packSize: 300,
    ticketPrice: 1.00,
    packValue: 300.00
  };
  const res = await createTicketAllocation(allocData, 'admin');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.allocation.packNumber, '778899');
  assert.strictEqual(res.allocation.status, 'ALLOCATED');

  const st = getLocalAdminState();
  const alloc = st.allocations.find(a => a.packNumber === '778899');
  assert.ok(alloc, 'Allocated pack must appear in allocations history');
});

await itAsync('Allocation prevents duplicate pack allocation to same store', async () => {
  const dupData = {
    allocationReference: 'ALC-TEST-DUP',
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    gameId: '1650',
    gameName: '5X Money',
    packNumber: '778899', // Same pack
    packSize: 300,
    ticketPrice: 1.00
  };
  const res = await createTicketAllocation(dupData, 'admin');
  assert.strictEqual(res.success, false, 'Duplicate pack allocation must be prevented');
  assert.ok(res.message.includes('already allocated'));
});

// ----------------------------------------------------------------------------
// Feature 7: Multi-Store Reports
// ----------------------------------------------------------------------------
console.log('\n--- Feature 7: Multi-Store Reports ---');
await itAsync('Reports API returns Store Sales, Inventory, Shifts, and Discrepancies', async () => {
  const reports = await fetchAdminReports();
  assert.strictEqual(reports.success, true);
  assert.ok(Array.isArray(reports.storesSummary), 'storesSummary must be array');
  assert.ok(Array.isArray(reports.inventorySummary), 'inventorySummary must be array');
  assert.ok(Array.isArray(reports.shiftReports), 'shiftReports must be array');
  assert.ok(Array.isArray(reports.discrepancies), 'discrepancies must be array');

  // Verify fields in storesSummary
  const storeRow = reports.storesSummary[0];
  assert.ok(storeRow.storeName);
  assert.ok('activeBoxes' in storeRow);
  assert.ok('ticketsSold' in storeRow);
  assert.ok('salesRevenue' in storeRow);

  // Verify fields in inventorySummary
  const invRow = reports.inventorySummary[0];
  assert.ok(invRow.storeName);
  assert.ok('totalPacks' in invRow);
  assert.ok('totalInventoryValue' in invRow);
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL ADMIN PANEL UNIT & FUNCTIONALITY TESTS PASSED!\n');
}

