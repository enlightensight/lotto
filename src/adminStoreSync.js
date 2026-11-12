// ============================================================================
// Jackpotlo Admin & Store Ticket Management API / Sync Client
// Manages:
//   1. Lottery Ticket Catalog
//   2. Store Ticket Requests & Approvals
//   3. Physical Ticket Stock Allocations
//   4. Store Authorization Status (Active / Suspended)
// ============================================================================

const ADMIN_STORAGE_KEY = 'jackpotlo_admin_state_v1';
const STORE_APPROVED_GAMES_KEY = 'jackpotlo_store_approved_games_';
const STORE_TICKET_REQUESTS_KEY = 'jackpotlo_store_ticket_requests_';
const STORE_ALLOCATIONS_KEY = 'jackpotlo_store_allocations_';

// Default initial catalog games (Georgia Lottery)
export const DEFAULT_LOTTERY_CATALOG = [
  { gameId: '1650', gameName: '5X Money', gameCode: '1650', price: 1.00, packSize: 300, packValue: 300.00, isActive: true },
  { gameId: '1602', gameName: 'Jr Jumbo', gameCode: '1602', price: 1.00, packSize: 300, packValue: 300.00, isActive: true },
  { gameId: '1631', gameName: 'Loteria', gameCode: '1631', price: 2.00, packSize: 150, packValue: 300.00, isActive: true },
  { gameId: '1644', gameName: 'Hit 100', gameCode: '1644', price: 2.00, packSize: 150, packValue: 300.00, isActive: true },
  { gameId: '1590', gameName: 'Cross Word', gameCode: '1590', price: 3.00, packSize: 100, packValue: 300.00, isActive: true },
  { gameId: '1611', gameName: 'Treasure Hunt', gameCode: '1611', price: 3.00, packSize: 100, packValue: 300.00, isActive: true },
  { gameId: '1688', gameName: 'Lucky 7s', gameCode: '1688', price: 5.00, packSize: 60, packValue: 300.00, isActive: true },
  { gameId: '1711', gameName: '50X Money', gameCode: '1711', price: 10.00, packSize: 30, packValue: 300.00, isActive: true },
  { gameId: '1720', gameName: 'Hit 1000', gameCode: '1720', price: 20.00, packSize: 30, packValue: 600.00, isActive: true },
  { gameId: '1770', gameName: '500X The Money', gameCode: '1770', price: 50.00, packSize: 20, packValue: 1000.00, isActive: true }
];

export const DEFAULT_INITIAL_STORES = [
  { storeId: 'store_amigo', storeName: 'AMIGO FOOD MART', ownerUsername: 'amigo', retailerNumber: 'GA-89412', address: '2300 MOODY RD WARNER ROBINS, GA, 31088', phone: '(478) 923-4567', totalBoxes: 65, subscriptionStatus: 'ACTIVE', documentStatus: 'APPROVED', retailerAuthStatus: 'VALID', softwareAccessStatus: 'ACTIVE', authorizationStatus: 'APPROVED', operationalStatus: 'ACTIVE' },
  { storeId: 'store_downtown', storeName: 'DOWNTOWN QUICK MART', ownerUsername: 'downtown_owner', retailerNumber: 'GA-94103', address: '104 N COMMERCIAL BLVD, WARNER ROBINS, GA, 31088', phone: '(478) 953-8821', totalBoxes: 60, subscriptionStatus: 'ACTIVE', documentStatus: 'APPROVED', retailerAuthStatus: 'VALID', softwareAccessStatus: 'ACTIVE', authorizationStatus: 'APPROVED', operationalStatus: 'ACTIVE' }
];

export const DEFAULT_INITIAL_APPLICATIONS = [
  {
    id: 1,
    storeId: 'store_metro',
    storeName: 'METRO EXPRESS MART',
    applicantName: 'Sarah Jenkins',
    applicantEmail: 'sarah@metromart.com',
    applicantPhone: '(478) 555-0199',
    businessTaxId: 'TAX-98214',
    lotteryRetailerId: 'GA-77120',
    address: '450 Northside Dr, Macon, GA 31210',
    documents: ['GA_Lottery_License_2026.pdf', 'Storefront_Photo.jpg'],
    status: 'PENDING',
    adminNotes: '',
    createdAt: new Date().toISOString()
  }
];

// Helper to get local admin state
export function getLocalAdminState() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.catalog) && parsed.catalog.length > 0) {
        return parsed;
      }
    }
  } catch (e) { }

  const initial = {
    stores: DEFAULT_INITIAL_STORES,
    applications: DEFAULT_INITIAL_APPLICATIONS,
    catalog: DEFAULT_LOTTERY_CATALOG,
    ticketRequests: [
      {
        id: 1,
        storeId: 'store_amigo',
        storeName: 'AMIGO FOOD MART',
        gameId: '1720',
        gameName: 'Hit 1000',
        price: 20,
        packSize: 30,
        requestedBy: 'amigo',
        status: 'PENDING',
        adminDecisionReason: '',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString()
      }
    ],
    approvedTickets: [
      { storeId: 'store_amigo', gameId: '1650', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1602', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1631', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1644', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1590', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1611', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1688', approvedBy: 'admin', approvedAt: new Date().toISOString() },
      { storeId: 'store_amigo', gameId: '1711', approvedBy: 'admin', approvedAt: new Date().toISOString() }
    ],
    allocations: [
      {
        id: 1,
        allocationReference: 'ALC-2026-001',
        storeId: 'store_amigo',
        storeName: 'AMIGO FOOD MART',
        gameId: '1650',
        gameName: '5X Money',
        packNumber: '128842',
        packSize: 300,
        ticketPrice: 1.00,
        packValue: 300.00,
        totalTickets: 300,
        allocatedBy: 'admin',
        allocationDate: new Date().toISOString().split('T')[0],
        status: 'ALLOCATED',
        receivedAt: null,
        createdAt: new Date().toISOString()
      }
    ],
    auditLogs: [
      {
        id: 'aud_init',
        adminUsername: 'system',
        actionType: 'SYSTEM_BOOTSTRAP',
        targetEntity: 'platform',
        targetId: 'jackpotlo',
        details: { message: 'Initialized enterprise lottery management system' },
        createdAt: new Date().toISOString()
      }
    ]
  };

  saveLocalAdminState(initial);
  return initial;
}

export function saveLocalAdminState(state) {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving local admin state:', e);
  }
}

// ----------------------------------------------------------------------------
// Store-Side API Helpers
// ----------------------------------------------------------------------------

export async function fetchStoreCatalog(storeId) {
  // Try server first
  try {
    const res = await fetch(`/api/store/catalog?storeId=${encodeURIComponent(storeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.catalog)) {
        return data.catalog;
      }
    }
  } catch (err) { }

  // Fallback to local admin state
  const adminState = getLocalAdminState();
  const approved = (adminState.approvedTickets || []).filter(a => a.storeId === storeId).map(a => a.gameId);
  const requested = (adminState.ticketRequests || []).filter(r => r.storeId === storeId);

  return (adminState.catalog || []).map(g => {
    const isApproved = approved.includes(g.gameId);
    const existingReq = requested.find(r => r.gameId === g.gameId);
    return {
      ...g,
      isApproved,
      requestStatus: isApproved ? 'APPROVED' : (existingReq ? existingReq.status : null),
      requestId: existingReq ? existingReq.id : null,
      adminReason: existingReq ? existingReq.adminDecisionReason : null
    };
  });
}

export async function fetchStoreTicketRequests(storeId) {
  try {
    const res = await fetch(`/api/store/requests?storeId=${encodeURIComponent(storeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        return data.requests;
      }
    }
  } catch (err) { }

  const adminState = getLocalAdminState();
  return (adminState.ticketRequests || []).filter(r => r.storeId === storeId);
}

export async function submitStoreTicketRequest(storeId, storeName, gameId, requestedBy) {
  const payload = { storeId, storeName, gameId, requestedBy };

  try {
    const res = await fetch('/api/store/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  // Fallback local update
  const adminState = getLocalAdminState();
  const game = (adminState.catalog || []).find(g => g.gameId === gameId) || { gameName: 'Lottery Game', price: 1, packSize: 100 };

  // Check if pending request exists
  const existing = (adminState.ticketRequests || []).find(r => r.storeId === storeId && r.gameId === gameId && r.status === 'PENDING');
  if (existing) {
    return { success: false, message: 'A request for this game is already pending administrator review.' };
  }

  const newRequest = {
    id: Date.now(),
    storeId,
    storeName: storeName || 'Store',
    gameId,
    gameName: game.gameName,
    price: game.price,
    packSize: game.packSize,
    requestedBy: requestedBy || 'owner',
    status: 'PENDING',
    adminDecisionReason: '',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString()
  };

  adminState.ticketRequests.unshift(newRequest);
  saveLocalAdminState(adminState);
  return { success: true, request: newRequest, message: 'Ticket request submitted to administrator.' };
}

export async function fetchStoreApprovedTickets(storeId) {
  try {
    const res = await fetch(`/api/store/approved-tickets?storeId=${encodeURIComponent(storeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.approved)) {
        return data.approved;
      }
    }
  } catch (err) { }

  const adminState = getLocalAdminState();
  const approvedIds = (adminState.approvedTickets || []).filter(a => a.storeId === storeId && a.status !== 'REVOKED').map(a => a.gameId);
  return (adminState.catalog || []).filter(g => approvedIds.includes(g.gameId));
}

export async function fetchStoreAllocations(storeId) {
  try {
    const res = await fetch(`/api/store/allocations?storeId=${encodeURIComponent(storeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.allocations)) {
        return data.allocations;
      }
    }
  } catch (err) { }

  const adminState = getLocalAdminState();
  return (adminState.allocations || []).filter(a => a.storeId === storeId);
}

export async function receiveStoreAllocation(allocationId, storeId, receivedBy) {
  try {
    const res = await fetch('/api/store/receive-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocationId, storeId, receivedBy })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const adminState = getLocalAdminState();
  const alloc = (adminState.allocations || []).find(a => (a.id === allocationId || String(a.id) === String(allocationId)) && a.storeId === storeId);
  if (!alloc) {
    return { success: false, message: 'Allocation record not found.' };
  }

  alloc.status = 'RECEIVED';
  alloc.receivedAt = new Date().toISOString();
  saveLocalAdminState(adminState);

  return { success: true, allocation: alloc, message: `Pack #${alloc.packNumber} marked received into inventory.` };
}

// ----------------------------------------------------------------------------
// Admin-Side API Helpers
// ----------------------------------------------------------------------------

export function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    let token = sessionStorage.getItem('lotto_admin_token') || localStorage.getItem('lotto_admin_token');
    if (!token) {
      const sess = sessionStorage.getItem('lotto_session_user');
      if (sess) {
        try {
          const parsed = JSON.parse(sess);
          if (parsed?.adminToken) token = parsed.adminToken;
        } catch (_) { }
      }
    }
    if (token) {
      headers['x-admin-token'] = token;
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) { }
  return headers;
}

export async function fetchAdminOverview() {
  try {
    const res = await fetch('/api/admin/overview', { headers: getAdminHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const totalStores = st.stores.length;
  const pendingApps = st.applications.filter(a => a.status === 'PENDING').length;
  const approvedStores = st.stores.filter(s => s.authorizationStatus === 'APPROVED').length;
  const suspendedStores = st.stores.filter(s => s.authorizationStatus === 'SUSPENDED').length;
  const totalCatalog = st.catalog.length;
  const pendingRequests = st.ticketRequests.filter(r => r.status === 'PENDING').length;
  const totalAllocations = st.allocations.length;
  const pendingFeedback = (st.feedback || []).filter(f => f.status === 'PENDING').length;

  return {
    success: true,
    stats: {
      totalStores,
      pendingApplications: pendingApps,
      approvedStores,
      suspendedStores,
      totalCatalogGames: totalCatalog,
      pendingRequests,
      totalAllocations,
      pendingFeedback
    },
    recentFeedback: (st.feedback || []).slice(0, 5),
    recentActivity: st.auditLogs.slice(0, 8)
  };
}

export async function updateStoreStatus(storeId, authorizationStatus, operationalStatus, adminUsername, reason = '') {
  try {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ authorizationStatus, operationalStatus, adminUsername, reason })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const store = st.stores.find(s => s.storeId === storeId);
  if (store) {
    store.authorizationStatus = authorizationStatus;
    store.operationalStatus = operationalStatus;
    store.updatedAt = new Date().toISOString();

    st.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      adminUsername: adminUsername || 'admin',
      actionType: `STORE_${authorizationStatus}`,
      targetEntity: 'stores',
      targetId: storeId,
      details: { storeName: store.storeName, reason, authorizationStatus, operationalStatus },
      createdAt: new Date().toISOString()
    });

    saveLocalAdminState(st);
    return { success: true, store };
  }
  return { success: false, message: 'Store not found.' };
}

export async function reviewStoreApplication(appId, decision, adminUsername, notes = '', extra = {}) {
  try {
    const res = await fetch(`/api/admin/applications/${encodeURIComponent(appId)}/review`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ decision, adminUsername, notes, ...extra })
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) return data;
    if (data && data.message) return { success: false, message: data.message };
  } catch (err) { }

  const st = getLocalAdminState();
  const app = st.applications.find(a => a.id === appId || String(a.id) === String(appId));
  if (!app) return { success: false, message: 'Application not found.' };

  const statusMap = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    MORE_INFO: 'MORE_INFO_REQUIRED'
  };
  app.status = statusMap[decision] || 'PENDING';
  app.adminNotes = notes;
  app.reviewedBy = adminUsername || 'admin';
  app.reviewedAt = new Date().toISOString();

  if (decision === 'APPROVE') {
    // Add/activate store in stores list
    if (!st.stores.some(s => s.storeId === app.storeId)) {
      st.stores.push({
        storeId: app.storeId,
        storeName: app.storeName,
        ownerUsername: (app.applicantName || 'owner').toLowerCase().replace(/\s+/g, '_'),
        retailerNumber: app.lotteryRetailerId || `GA-${Math.floor(10000 + Math.random() * 90000)}`,
        address: app.address,
        phone: app.applicantPhone,
        totalBoxes: 65,
        authorizationStatus: 'APPROVED',
        operationalStatus: 'ACTIVE'
      });
    }
  }

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: adminUsername || 'admin',
    actionType: `APPLICATION_${app.status}`,
    targetEntity: 'store_applications',
    targetId: String(appId),
    details: { storeName: app.storeName, applicant: app.applicantName, notes },
    createdAt: new Date().toISOString()
  });

  saveLocalAdminState(st);
  return { success: true, application: app };
}

export async function addOrUpdateCatalogGame(gameObj, adminUsername) {
  try {
    const res = await fetch('/api/admin/catalog', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ ...gameObj, adminUsername })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const existingIdx = st.catalog.findIndex(g => g.gameId === gameObj.gameId);
  if (existingIdx >= 0) {
    st.catalog[existingIdx] = { ...st.catalog[existingIdx], ...gameObj };
  } else {
    st.catalog.push(gameObj);
  }

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: adminUsername || 'admin',
    actionType: existingIdx >= 0 ? 'CATALOG_GAME_UPDATED' : 'CATALOG_GAME_ADDED',
    targetEntity: 'lottery_ticket_catalog',
    targetId: gameObj.gameId,
    details: { gameName: gameObj.gameName, price: gameObj.price },
    createdAt: new Date().toISOString()
  });

  saveLocalAdminState(st);
  return { success: true, game: gameObj };
}

export async function reviewStoreTicketRequest(requestId, decision, adminUsername, reason = '') {
  try {
    const res = await fetch(`/api/admin/ticket-requests/${encodeURIComponent(requestId)}/review`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ decision, adminUsername, reason })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const req = st.ticketRequests.find(r => r.id === requestId || String(r.id) === String(requestId));
  if (!req) return { success: false, message: 'Ticket request not found.' };

  const statusMap = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    MORE_INFO: 'MORE_INFO_REQUIRED'
  };
  req.status = statusMap[decision] || 'PENDING';
  req.adminDecisionReason = reason;
  req.reviewedBy = adminUsername || 'admin';
  req.reviewedAt = new Date().toISOString();

  // If approved: record in store_approved_tickets (authorizes store, but does NOT create physical stock!)
  if (decision === 'APPROVE') {
    const alreadyApproved = st.approvedTickets.some(a => a.storeId === req.storeId && a.gameId === req.gameId);
    if (!alreadyApproved) {
      st.approvedTickets.push({
        storeId: req.storeId,
        gameId: req.gameId,
        approvedBy: adminUsername || 'admin',
        approvedAt: new Date().toISOString(),
        status: 'ACTIVE'
      });
    }
  }

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: adminUsername || 'admin',
    actionType: `TICKET_REQUEST_${req.status}`,
    targetEntity: 'store_ticket_requests',
    targetId: String(requestId),
    details: { storeId: req.storeId, gameName: req.gameName, reason },
    createdAt: new Date().toISOString()
  });

  saveLocalAdminState(st);
  return { success: true, request: req };
}

export async function createTicketAllocation(allocationData, adminUsername) {
  try {
    const res = await fetch('/api/admin/allocations', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ ...allocationData, adminUsername })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const cleanPack = String(allocationData.packNumber || '').trim();

  // Prevent duplicate allocations of the same pack to this store
  const isDuplicate = st.allocations.some(a => a.storeId === allocationData.storeId && String(a.packNumber).trim() === cleanPack);
  if (isDuplicate) {
    return { success: false, message: `Pack #${cleanPack} is already allocated to store "${allocationData.storeName || allocationData.storeId}". Duplicate allocations are prevented.` };
  }

  const newAlloc = {
    id: Date.now(),
    allocationReference: allocationData.allocationReference || `ALC-${Date.now().toString().slice(-6)}`,
    storeId: allocationData.storeId,
    storeName: allocationData.storeName || allocationData.storeId,
    gameId: allocationData.gameId,
    gameName: allocationData.gameName,
    packNumber: cleanPack,
    packSize: Number(allocationData.packSize) || 100,
    ticketPrice: Number(allocationData.ticketPrice) || 1.00,
    packValue: Number(allocationData.packValue) || ((Number(allocationData.ticketPrice) || 1) * (Number(allocationData.packSize) || 100)),
    totalTickets: Number(allocationData.packSize) || 100,
    allocatedBy: adminUsername || 'admin',
    allocationDate: allocationData.allocationDate || new Date().toISOString().split('T')[0],
    status: 'ALLOCATED',
    receivedAt: null,
    createdAt: new Date().toISOString()
  };

  st.allocations.unshift(newAlloc);

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: adminUsername || 'admin',
    actionType: 'STOCK_ALLOCATED',
    targetEntity: 'ticket_stock_allocations',
    targetId: cleanPack,
    details: { storeId: allocationData.storeId, gameName: allocationData.gameName, packNumber: cleanPack, ref: newAlloc.allocationReference },
    createdAt: new Date().toISOString()
  });

  saveLocalAdminState(st);
  return { success: true, allocation: newAlloc, message: `Successfully allocated Pack #${cleanPack} to ${newAlloc.storeName}.` };
}

// ----------------------------------------------------------------------------

// Synchronize latest admin state from server
export async function syncAdminStateFromServer() {
  const headers = getAdminHeaders();
  const st = getLocalAdminState();
  try {
    const [storesRes, appsRes, catRes, reqsRes, allocsRes, logsRes, feedbackRes] = await Promise.all([
      fetch('/api/admin/stores', { headers }).catch(() => null),
      fetch('/api/admin/applications', { headers }).catch(() => null),
      fetch('/api/admin/catalog', { headers }).catch(() => null),
      fetch('/api/admin/ticket-requests', { headers }).catch(() => null),
      fetch('/api/admin/allocations', { headers }).catch(() => null),
      fetch('/api/admin/audit-logs', { headers }).catch(() => null),
      fetch('/api/admin/feedback', { headers }).catch(() => null)
    ]);

    if (storesRes?.ok) {
      const d = await storesRes.json();
      if (d.success && Array.isArray(d.stores) && d.stores.length > 0) st.stores = d.stores;
    }
    if (appsRes?.ok) {
      const d = await appsRes.json();
      if (d.success && Array.isArray(d.applications)) st.applications = d.applications;
    }
    if (catRes?.ok) {
      const d = await catRes.json();
      if (d.success && Array.isArray(d.catalog) && d.catalog.length > 0) st.catalog = d.catalog;
    }
    if (reqsRes?.ok) {
      const d = await reqsRes.json();
      if (d.success && Array.isArray(d.requests)) st.ticketRequests = d.requests;
    }
    if (allocsRes?.ok) {
      const d = await allocsRes.json();
      if (d.success && Array.isArray(d.allocations)) st.allocations = d.allocations;
    }
    if (logsRes?.ok) {
      const d = await logsRes.json();
      if (d.success && Array.isArray(d.auditLogs)) st.auditLogs = d.auditLogs;
    }
    if (feedbackRes?.ok) {
      const d = await feedbackRes.json();
      if (d.success && Array.isArray(d.feedback)) st.feedback = d.feedback;
    }
    saveLocalAdminState(st);
  } catch (_) { }
  return st;
}

// ----------------------------------------------------------------------------
// Store Feedback & Issue Reporting Client Helpers
// ----------------------------------------------------------------------------

export async function submitStoreFeedback(data) {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

export async function fetchAdminFeedback() {
  const headers = getAdminHeaders();
  try {
    const res = await fetch('/api/admin/feedback', { headers });
    const data = await res.json();
    if (data.success && Array.isArray(data.feedback)) {
      const st = getLocalAdminState();
      st.feedback = data.feedback;
      saveLocalAdminState(st);
      return data.feedback;
    }
  } catch (e) { }
  const st = getLocalAdminState();
  return st.feedback || [];
}

export async function reviewStoreFeedback(id, status, adminUsername, adminNotes) {
  const headers = getAdminHeaders();
  try {
    const res = await fetch(`/api/admin/feedback/${id}/review`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNotes, adminUsername })
    });
    const data = await res.json();
    if (data.success && data.feedback) {
      const st = getLocalAdminState();
      if (!Array.isArray(st.feedback)) st.feedback = [];
      const idx = st.feedback.findIndex(f => f.id === id);
      if (idx !== -1) st.feedback[idx] = data.feedback;
      saveLocalAdminState(st);
    }
    return data;
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Fetch multi-store operational reports
export async function fetchAdminReports() {
  try {
    const res = await fetch('/api/admin/reports', { headers: getAdminHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (err) { }

  const st = getLocalAdminState();
  const storesSummary = (st.stores || []).map(s => ({
    storeId: s.storeId,
    storeName: s.storeName,
    retailerNumber: s.retailerNumber || 'GA-Pending',
    authorizationStatus: s.authorizationStatus || 'APPROVED',
    operationalStatus: s.operationalStatus || 'ACTIVE',
    activeBoxes: 19,
    ticketsSold: 0,
    salesRevenue: 0,
    onlineSales: 0,
    cashes: 0,
    netBalance: 0
  }));

  const inventorySummary = (st.stores || []).map(s => ({
    storeId: s.storeId,
    storeName: s.storeName,
    activeCounterPacks: 19,
    activeCounterValue: 5700,
    safePacksCount: 1,
    safePacksValue: 300,
    storagePacksCount: 2,
    storagePacksValue: 600,
    totalPacks: 22,
    totalInventoryValue: 6600,
    packs: []
  }));

  const shiftReports = [
    {
      storeId: 'store_amigo',
      storeName: 'AMIGO FOOD MART',
      shiftNumber: 13,
      date: new Date().toLocaleDateString('en-US'),
      cashier: 'Amigo food mart',
      ticketsSold: 0,
      salesRevenue: 0,
      cashes: 0,
      drawerFloat: 100,
      actualCashCounted: 100,
      drawerOverShort: 0
    }
  ];

  return {
    success: true,
    storesSummary,
    inventorySummary,
    shiftReports,
    discrepancies: []
  };
}

// Store Authorization Check Helper
// ----------------------------------------------------------------------------

export async function adminLogout() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: getAdminHeaders()
    });
  } catch (_) { }
  sessionStorage.removeItem('lotto_admin_token');
  localStorage.removeItem('lotto_admin_token');
  sessionStorage.removeItem('lotto_session_user');
  localStorage.removeItem('lotto_remembered_user');
}

export async function fetchSubscriptionPlans() {
  const res = await fetch('/api/subscription/plans');
  return res.json();
}

export async function fetchPaymentGatewayConfig() {
  const res = await fetch('/api/payments/config');
  return res.json();
}

  export async function createPaymentCheckoutSession(planId, billingCycle = 'monthly', options = {}) {
    const res = await fetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        planId,
        billingCycle,
        returnOrigin: window.location.origin,
        returnPath: options.returnPath || window.location.pathname || '/pos'
      })
    });
    return res.json();
  }

  export async function checkoutSubscriptionAndRegister(payload) {
    const res = await fetch('/api/subscriptions/checkout-and-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  export async function resubmitStoreDocuments(payload) {
    const headers = { 'Content-Type': 'application/json' };
    const storeToken = sessionStorage.getItem('lotto_store_token') || localStorage.getItem('lotto_store_token');
    if (storeToken) {
      headers['x-store-token'] = storeToken;
      headers['Authorization'] = `Bearer ${storeToken}`;
    }
    const res = await fetch('/api/store/resubmit-documents', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  export async function fetchStoreAdminDetails(storeId) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/details`, {
      headers: getAdminHeaders()
    });
    return res.json();
  }

  export async function verifyStoreDocumentsAndRetailer(storeId, payload) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/verify-documents`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  export async function suspendStoreWithReason(storeId, reason, adminUsername = 'admin') {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/suspend`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ reason, adminUsername })
    });
    return res.json();
  }

  export async function reapproveSuspendedStore(storeId, payload = {}) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/reapprove`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  export function checkStoreCanSell(storeId, gameId = null) {
    const st = getLocalAdminState();
    const store = st.stores.find(s => s.storeId === storeId);
    let sessionUser = null;
    try {
      sessionUser = JSON.parse(sessionStorage.getItem('lotto_session_user') || localStorage.getItem('lotto_session_user') || 'null');
    } catch (_) { }

    const effectiveAccess = store?.softwareAccessStatus || (sessionUser?.storeId === storeId ? sessionUser?.softwareAccessStatus : null);
    const effectiveAuth = store?.authorizationStatus;
    if (effectiveAccess === 'SUSPENDED' || effectiveAuth === 'SUSPENDED') {
      const rsn = store?.suspensionReason || sessionUser?.suspensionReason || '';
      return {
        allowed: false,
        reason: 'STORE_SUSPENDED',
        message: `Store "${store?.storeName || storeId}" is SUSPENDED.${rsn ? ' Reason: ' + rsn : ' Ticket sales are disabled.'}`
      };
    }

    const subStatus = store?.subscriptionStatus || (sessionUser?.storeId === storeId ? sessionUser?.subscriptionStatus : null);
    if (subStatus && subStatus !== 'ACTIVE') {
      return {
        allowed: false,
        reason: 'SUBSCRIPTION_INACTIVE',
        message: `Store subscription is ${subStatus}. Ticket selling is disabled.`
      };
    }

    const retailerStatus = store?.retailerAuthStatus || (sessionUser?.storeId === storeId ? sessionUser?.retailerAuthStatus : null);
    if (retailerStatus && retailerStatus !== 'VALID') {
      return {
        allowed: false,
        reason: 'RETAILER_AUTH_REQUIRED',
        message: `Lottery ticket sales are locked: Official lottery retailer authorization is "${retailerStatus}" for this business location. Software access is ACTIVE while official retailer verification is completed.`
      };
    }

    if (gameId) {
      const isApproved = (st.approvedTickets || []).some(a => a.storeId === storeId && a.gameId === String(gameId) && a.status !== 'REVOKED');
      if (!isApproved) {
        const game = (st.catalog || []).find(g => g.gameId === String(gameId));
        const gameTitle = game ? game.gameName : `Game #${gameId}`;
        return {
          allowed: false,
          reason: 'GAME_NOT_APPROVED',
          message: `Ticket type "${gameTitle}" is not yet approved by the administrator for this store. Please submit an approval request under "Manage Lottery Tickets".`
        };
      }
    }

    return { allowed: true };
  }
