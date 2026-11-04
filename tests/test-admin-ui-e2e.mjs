// ============================================================================
// End-to-End DOM Structure & Interface Isolation Verification Suite
// ============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';

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

console.log('\n====================================================');
console.log('   ADMIN PANEL UI & STORE ISOLATION VERIFICATION    ');
console.log('====================================================\n');

const indexPath = path.join(process.cwd(), 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// ----------------------------------------------------------------------------
// Group 1: Admin Panel Dashboard & Section DOM Structure
// ----------------------------------------------------------------------------
console.log('--- Group 1: Admin Panel DOM Structure (Features 1-7) ---');

it('viewAdminDashboard container exists with separate admin class', () => {
  assert.ok(indexHtml.includes('id="viewAdminDashboard"'));
  assert.ok(indexHtml.includes('class="admin-dashboard-view"'));
});

it('Feature 1: Overview KPIs exist (Total, Pending, Approved, Suspended)', () => {
  assert.ok(indexHtml.includes('id="adminKpiTotalStores"'));
  assert.ok(indexHtml.includes('id="adminKpiPendingApps"'));
  assert.ok(indexHtml.includes('id="adminKpiApprovedStores"'));
  assert.ok(indexHtml.includes('id="adminKpiSuspendedStores"'));
  assert.ok(indexHtml.includes('id="adminOverviewPendingRequestsList"'));
  assert.ok(indexHtml.includes('id="adminOverviewRecentAuditList"'));
});

it('Feature 2: Store Applications table & review modal exist', () => {
  assert.ok(indexHtml.includes('id="paneAdminApplications"'));
  assert.ok(indexHtml.includes('id="adminApplicationsTableBody"'));
  assert.ok(indexHtml.includes('id="adminReviewAppModal"'));
  assert.ok(indexHtml.includes('id="btnAdminAppRequestInfo"'));
  assert.ok(indexHtml.includes('id="btnAdminAppReject"'));
  assert.ok(indexHtml.includes('id="btnAdminAppApprove"'));
});

it('Feature 3: Store Management table exists with status badges', () => {
  assert.ok(indexHtml.includes('id="paneAdminStores"'));
  assert.ok(indexHtml.includes('id="adminStoresTableBody"'));
});

it('Feature 4: Central Ticket Catalog table & Add/Edit modal exist', () => {
  assert.ok(indexHtml.includes('id="paneAdminCatalog"'));
  assert.ok(indexHtml.includes('id="adminCatalogTableBody"'));
  assert.ok(indexHtml.includes('id="adminAddCatalogGameModal"'));
  assert.ok(indexHtml.includes('id="adminGameIsEdit"'));
  assert.ok(indexHtml.includes('id="btnAdminAddNewGameModal"'));
  assert.ok(indexHtml.includes('id="btnAdminCatalogSubmit"'));
});

it('Feature 5: Store Ticket Requests table & review modal exist', () => {
  assert.ok(indexHtml.includes('id="paneAdminRequests"'));
  assert.ok(indexHtml.includes('id="adminRequestsTableBody"'));
  assert.ok(indexHtml.includes('id="adminReviewRequestModal"'));
  assert.ok(indexHtml.includes('id="btnAdminReqApprove"'));
  assert.ok(indexHtml.includes('id="btnAdminReqReject"'));
  assert.ok(indexHtml.includes('id="btnAdminReqMoreInfo"'));
});

it('Feature 6: Stock Allocation table & modal exist', () => {
  assert.ok(indexHtml.includes('id="paneAdminAllocations"'));
  assert.ok(indexHtml.includes('id="adminAllocationsTableBody"'));
  assert.ok(indexHtml.includes('id="adminCreateAllocationModal"'));
  assert.ok(indexHtml.includes('id="adminAllocStoreSelect"'));
  assert.ok(indexHtml.includes('id="adminAllocGameSelect"'));
  assert.ok(indexHtml.includes('id="adminAllocPackNumInput"'));
});

it('Feature 7: Multi-Store Reports has 4 sub-sections (Sales, Inventory, Shifts, Discrepancies)', () => {
  assert.ok(indexHtml.includes('id="paneAdminReports"'));
  assert.ok(indexHtml.includes('data-report-tab="sales"'));
  assert.ok(indexHtml.includes('data-report-tab="inventory"'));
  assert.ok(indexHtml.includes('data-report-tab="shifts"'));
  assert.ok(indexHtml.includes('data-report-tab="discrepancies"'));
  assert.ok(indexHtml.includes('id="adminReportSalesTableBody"'));
  assert.ok(indexHtml.includes('id="adminReportInventoryTableBody"'));
  assert.ok(indexHtml.includes('id="adminReportShiftsTableBody"'));
  assert.ok(indexHtml.includes('id="adminReportDiscrepanciesTableBody"'));
});

// ----------------------------------------------------------------------------
// Group 2: Normal Store User Panel Isolation
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Normal Store User Panel Strict Isolation ---');

it('Normal user sidebar nav does NOT contain any admin navigation or icon', () => {
  // Extract sidebar nav section
  const navStart = indexHtml.indexOf('<nav class="sidebar-nav"');
  const navEnd = indexHtml.indexOf('</nav>', navStart);
  const sidebarNavHtml = indexHtml.slice(navStart, navEnd);

  assert.strictEqual(sidebarNavHtml.includes('admin'), false, 'Normal sidebar must not contain any admin link');
  assert.strictEqual(sidebarNavHtml.includes('Platform Admin'), false, 'Normal sidebar must not contain admin title');
  assert.strictEqual(sidebarNavHtml.includes('navAdminPortal'), false, 'Normal sidebar must not contain navAdminPortal');
});

it('Store switch button exists inside Admin Panel to allow admin to preview POS', () => {
  assert.ok(indexHtml.includes('id="btnAdminTopSwitchPos"'));
});

// ----------------------------------------------------------------------------
// Group 3: JavaScript Controllers Initialization
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Controller Initialization in main.js ---');

const mainJsPath = path.join(process.cwd(), 'src', 'main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

it('main.js imports and initializes adminDashboardScreen and manageTicketsScreen', () => {
  assert.ok(mainJs.includes('initManageTicketsScreen'));
  assert.ok(mainJs.includes('initAdminDashboardScreen'));
  assert.ok(mainJs.includes('const adminDashboardScreen = initAdminDashboardScreen'));
  assert.ok(mainJs.includes('const renderAdminDashboardView = adminDashboardScreen?.renderAdminDashboardView'));
  assert.ok(mainJs.includes('const manageTicketsScreen = initManageTicketsScreen'));
});

it('Admin permissions enforced on showAdminDashboardView', () => {
  assert.ok(mainJs.includes('function showAdminDashboardView()'));
  assert.ok(mainJs.includes('Access Denied: Platform Administrator role required.'));
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL DOM & INTERFACE ISOLATION TESTS PASSED!\n');
}

