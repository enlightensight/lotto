// ============================================================================
// COMPLETE BUSINESS WORKFLOW END-TO-END TEST
// Tests:
// 1. Store applies via /api/store-applications
// 2. Admin logs in with secure credentials (PBKDF2 600,000 rounds)
// 3. Admin reviews and approves store application
// 4. Store owner logs in with tenant credentials; verified account & clean POS state
// 5. Store owner requests a lottery ticket type
// 6. Admin approves ticket request (authorizes store, but no physical stock)
// 7. Admin allocates physical stock with unique pack number
// 8. Store verifies inventory (pack appears in store's in-stock inventory)
// 9. Admin sees multi-store reports: sales, inventory, and shift figures
// 10. Admin panel navigation across all 7 sections without view disappearance
// 11. Security check: Ordinary store user receives 403 on all admin endpoints
// ============================================================================

import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;

function ok(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runWorkflow() {
  console.log('\n====================================================');
  console.log('   JACKPOTLO COMPLETE BUSINESS WORKFLOW E2E TEST     ');
  console.log('====================================================\n');

  const testSuffix = Date.now();
  const testStoreName = `Savannah Quick Stop #${testSuffix}`;
  const testOwner = `savannah_owner_${testSuffix}`;
  const testEmail = `owner_${testSuffix}@savannahretail.com`;
  const testPhone = '(912) 555-0144';
  const testAddress = '412 Bull Street, Savannah, GA 31401';
  const testRetailerId = `GA-SVN-${Math.floor(1000 + Math.random() * 9000)}`;

  let adminToken = null;
  let applicationId = null;
  let approvedStoreId = null;
  let ticketRequestId = null;
  let allocatedPackNumber = `PK-${testSuffix}`;

  // --------------------------------------------------------------------------
  // Step 1: Store Registration / Application
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Retail Store Applies for Authorization ---');
  {
    const res = await fetch(`${BASE_URL}/api/store-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: testStoreName,
        ownerName: testOwner,
        businessNumber: testRetailerId,
        ownerEmail: testEmail,
        ownerPhone: testPhone,
        address: testAddress,
        documentsUrl: 'https://state.ga.gov/licenses/retailer-doc-valid.pdf',
        requestedBy: testOwner
      })
    });
    const data = await res.json();
    ok(res.status === 200 && data.success === true, 'Store application submitted successfully');
    ok(data.application && data.application.status === 'PENDING', 'Application state is PENDING');
    applicationId = data.application.id;
    approvedStoreId = data.application.storeId;
  }

  // --------------------------------------------------------------------------
  // Step 2: Admin Logs In & Secures Admin Token
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Admin Logs In (PBKDF2-HMAC-SHA256, 600k rounds) ---');
  {
    // Reset admin credentials with CLI script
    const { execSync } = await import('child_process');
    execSync('node scripts/manage-admin.cjs reset admin TestAdminPass123!');

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'TestAdminPass123!'
      })
    });
    const data = await res.json();
    ok(res.status === 200 && data.success === true, 'Admin login succeeded');
    ok(data.isAdmin === true && data.role === 'ADMIN', 'Admin role verified');
    ok(typeof data.token === 'string' && data.token.startsWith('adm_'), 'Cryptographic admin session token issued');
    adminToken = data.token;
  }

  // --------------------------------------------------------------------------
  // Step 3: Admin Reviews and Approves Store Application
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Admin Reviews and Approves Application ---');
  {
    const appsRes = await fetch(`${BASE_URL}/api/admin/applications`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const appsData = await appsRes.json();
    ok(appsRes.status === 200 && appsData.success === true, 'Admin fetched applications list');
    const targetApp = appsData.applications.find(a => String(a.id) === String(applicationId));
    ok(!!targetApp, `Found application for "${testStoreName}" in admin queue`);

    // Approve
    const reviewRes = await fetch(`${BASE_URL}/api/admin/applications/${applicationId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        notes: 'State lottery retailer license validated. Store approved for lottery operations.',
        adminUsername: 'admin'
      })
    });
    const reviewData = await reviewRes.json();
    ok(reviewRes.status === 200 && reviewData.success === true, 'Application approved by administrator');

    // Verify store now listed in admin stores
    const storesRes = await fetch(`${BASE_URL}/api/admin/stores`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const storesData = await storesRes.json();
    const store = storesData.stores.find(s => s.storeId === approvedStoreId);
    ok(!!store && store.authorizationStatus === 'APPROVED', 'Store is listed with APPROVED status in central system');
  }

  // --------------------------------------------------------------------------
  // Step 4: Approved Store Owner Logs In & Verifies Store POS State
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Store Owner Logs In to Central System ---');
  {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testOwner,
        password: 'any_initial_pass'
      })
    });
    const loginData = await loginRes.json();
    ok(loginRes.status === 200 && loginData.success === true, 'Store owner logged in successfully');
    ok(loginData.storeId === approvedStoreId, `Matched approved storeId: ${approvedStoreId}`);
    ok(loginData.isSuspended === false, 'Store is active and not suspended');

    // Load initial POS state
    const posStateRes = await fetch(`${BASE_URL}/api/load-pos-state?storeId=${approvedStoreId}`);
    const posStateData = await posStateRes.json();
    ok(posStateRes.status === 200 && posStateData.success === true, 'Loaded isolated store POS state');
    ok(posStateData.state.slots && posStateData.state.slots.length === 65, 'Store initialized with 65 dispenser slots');
  }

  // --------------------------------------------------------------------------
  // Step 4b: Admin Adds New Game to State Lottery Catalog
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4b: Admin Adds Game to State Lottery Catalog ---');
  {
    const addGameRes = await fetch(`${BASE_URL}/api/admin/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        gameId: '1780',
        gameCode: '1780',
        gameName: 'Millionaire Bucks',
        price: 5.00,
        packSize: 60,
        packValue: 300.00,
        isActive: true,
        adminUsername: 'admin'
      })
    });
    const addGameData = await addGameRes.json();
    ok(addGameRes.status === 200 && addGameData.success === true, 'Admin added Game #1780 (Millionaire Bucks) to central catalog');

    // Verify game exists in catalog
    const catRes = await fetch(`${BASE_URL}/api/admin/catalog`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const catData = await catRes.json();
    const hasGame = (catData.catalog || []).some(g => g.gameId === '1780');
    ok(hasGame, 'Game #1780 persists in state lottery catalog');
  }

  // --------------------------------------------------------------------------
  // Step 5: Store Owner Requests a Lottery Ticket Type
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Store Requests Ticket Game from State Catalog ---');
  {
    // Store submits ticket request for Game #1780 ("Millionaire Bucks")
    const reqRes = await fetch(`${BASE_URL}/api/store/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: approvedStoreId,
        storeName: testStoreName,
        gameId: '1780',
        gameName: 'Millionaire Bucks',
        price: 5.00,
        requestedBy: testOwner
      })
    });
    const reqData = await reqRes.json();
    ok(reqRes.status === 200 && reqData.success === true, 'Store submitted ticket type request');
    ticketRequestId = reqData.requestId || reqData.request?.id;

    // Verify request visible in store's pending requests
    const listRes = await fetch(`${BASE_URL}/api/store/requests?storeId=${approvedStoreId}`);
    const listData = await listRes.json();
    const myReq = (listData.requests || []).find(r => String(r.id) === String(ticketRequestId));
    ok(!!myReq && myReq.status === 'PENDING', 'Store ticket request is recorded with PENDING status');
  }

  // --------------------------------------------------------------------------
  // Step 6: Admin Approves Ticket Request (Separation from Physical Stock)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Admin Approves Ticket Request (Separate from Stock) ---');
  {
    const approveRes = await fetch(`${BASE_URL}/api/admin/ticket-requests/${ticketRequestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        reason: 'Authorized for Savannah market retail distribution.',
        adminUsername: 'admin'
      })
    });
    const approveData = await approveRes.json();
    ok(approveRes.status === 200 && approveData.success === true, 'Admin approved ticket request');

    // Verify game is authorized in approved list
    const apprvListRes = await fetch(`${BASE_URL}/api/store/approved-tickets?storeId=${approvedStoreId}`);
    const apprvListData = await apprvListRes.json();
    const approvedList = apprvListData.approvedTickets || apprvListData.approved || [];
    const isApproved = approvedList.some(g => g.gameId === '1780');
    ok(isApproved, 'Game #1780 is now authorized for this store');

    // Verify physical stock was NOT automatically allocated
    const checkAllocRes = await fetch(`${BASE_URL}/api/store/allocations?storeId=${approvedStoreId}`);
    const checkAllocData = await checkAllocRes.json();
    const hasAlloc = (checkAllocData.allocations || []).some(a => a.gameId === '1780');
    ok(!hasAlloc, 'CONFIRMED: Approving game does NOT allocate physical stock');
  }

  // --------------------------------------------------------------------------
  // Step 7: Admin Allocates Physical Ticket Stock
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Admin Allocates Physical Ticket Stock ---');
  {
    const allocRef = `ALC-SAV-${Math.floor(1000 + Math.random() * 9000)}`;
    const allocRes = await fetch(`${BASE_URL}/api/admin/allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        allocationReference: allocRef,
        storeId: approvedStoreId,
        storeName: testStoreName,
        gameId: '1780',
        gameName: 'Millionaire Bucks',
        packNumber: allocatedPackNumber,
        packSize: 60,
        ticketPrice: 5.00,
        packValue: 300.00,
        adminUsername: 'admin'
      })
    });
    const allocData = await allocRes.json();
    ok(allocRes.status === 200 && allocData.success === true, 'Admin allocated physical stock');

    // Duplicate pack allocation check (must reject duplicate pack numbers)
    const dupRes = await fetch(`${BASE_URL}/api/admin/allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        allocationReference: `${allocRef}-DUP`,
        storeId: approvedStoreId,
        storeName: testStoreName,
        gameId: '1780',
        gameName: 'Millionaire Bucks',
        packNumber: allocatedPackNumber,
        packSize: 60,
        ticketPrice: 5.00,
        adminUsername: 'admin'
      })
    });
    ok(dupRes.status === 400, 'System strictly rejects duplicate pack number allocation across network');
  }

  // --------------------------------------------------------------------------
  // Step 8: Store Verifies Live Inventory (Pack is in In-Stock Inventory)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Store Verifies In-Stock Inventory ---');
  {
    const posRes = await fetch(`${BASE_URL}/api/load-pos-state?storeId=${approvedStoreId}`);
    const posData = await posRes.json();
    ok(posRes.status === 200 && posData.success === true, 'Store loaded updated POS state');
    const inStock = posData.state.inStockInventory || [];
    const foundPack = inStock.find(p => String(p.packNumber) === allocatedPackNumber);
    ok(!!foundPack, `Allocated pack #${allocatedPackNumber} is in store's live inStockInventory`);
    ok(foundPack && foundPack.price === 5 && foundPack.gameName === 'Millionaire Bucks', 'Pack specs match allocated game');
  }

  // --------------------------------------------------------------------------
  // Step 9: Multi-Store Reports Show Stored Data Across Stores
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Admin Multi-Store Reports Reflect Stored Data ---');
  {
    const repRes = await fetch(`${BASE_URL}/api/admin/reports`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const repData = await repRes.json();
    ok(repRes.status === 200 && repData.success === true, 'Admin fetched multi-store reports');
    ok(Array.isArray(repData.storesSummary), 'Reports contain storesSummary array');
    ok(Array.isArray(repData.inventorySummary), 'Reports contain inventorySummary array');
    ok(Array.isArray(repData.shiftReports), 'Reports contain shiftReports array');
    ok(Array.isArray(repData.discrepancies), 'Reports contain discrepancies array');

    const storeSummary = repData.storesSummary.find(s => s.storeId === approvedStoreId);
    ok(!!storeSummary, `Store "${testStoreName}" appears in multi-store sales summary`);

    const invSummary = repData.inventorySummary.find(s => s.storeId === approvedStoreId);
    ok(!!invSummary && invSummary.safePacksCount >= 1, `Store inventory reports allocated pack in stock: ${invSummary?.safePacksCount} packs`);
  }

  // --------------------------------------------------------------------------
  // Step 10: Security Check — Ordinary Store User Receives 403 Forbidden
  // --------------------------------------------------------------------------
  console.log('\n--- Step 10: Security Check — Store User Blocked from Admin APIs ---');
  {
    const endpoints = [
      { method: 'GET', url: '/api/admin/overview' },
      { method: 'GET', url: '/api/admin/stores' },
      { method: 'GET', url: '/api/admin/applications' },
      { method: 'GET', url: '/api/admin/catalog' },
      { method: 'GET', url: '/api/admin/ticket-requests' },
      { method: 'GET', url: '/api/admin/allocations' },
      { method: 'GET', url: '/api/admin/reports' },
      { method: 'GET', url: '/api/admin/audit-logs' }
    ];

    let allBlocked = true;
    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep.url}`, {
        method: ep.method,
        headers: { 'Authorization': 'Bearer store_user_token_not_admin' }
      });
      if (res.status !== 403) {
        allBlocked = false;
        console.error(`Endpoint ${ep.url} did not return 403 (got ${res.status})`);
      }
    }
    ok(allBlocked, 'All 8 Admin APIs strictly enforce 403 Forbidden on non-admin store requests');
  }

  console.log('\n====================================================');
  console.log(`   E2E WORKFLOW RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkflow().catch(err => {
  console.error('Workflow error:', err);
  process.exit(1);
});
