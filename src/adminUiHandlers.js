// ============================================================================
// Jackpotlo Admin & Store Ticket Management UI Handlers
// ============================================================================

import {
  fetchStoreCatalog,
  fetchStoreTicketRequests,
  submitStoreTicketRequest,
  fetchStoreApprovedTickets,
  fetchStoreAllocations,
  receiveStoreAllocation,
  fetchAdminOverview,
  updateStoreStatus,
  reviewStoreApplication,
  addOrUpdateCatalogGame,
  reviewStoreTicketRequest,
  createTicketAllocation,
  checkStoreCanSell,
  getLocalAdminState,
  syncAdminStateFromServer,
  adminLogout,
  fetchAdminReports,
  fetchAdminFeedback,
  reviewStoreFeedback
} from './adminStoreSync.js';

// ----------------------------------------------------------------------------
// 1. STORE-SIDE: Manage Lottery Tickets View Controller
// ----------------------------------------------------------------------------

export function initManageTicketsScreen({ getState, saveState, showToast, sfx, getCurrentStoreId }) {
  let activeTab = 'catalog';

  // Subnav tab switching
  document.querySelectorAll('#storeTicketsSubnav .admin-subnav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      sfx.keypad?.();
      document.querySelectorAll('#storeTicketsSubnav .admin-subnav-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      activeTab = tabBtn.dataset.storeTab || 'catalog';

      document.getElementById('paneStoreTicketCatalog').style.display = activeTab === 'catalog' ? 'block' : 'none';
      document.getElementById('paneStoreMyRequests').style.display = activeTab === 'my_requests' ? 'block' : 'none';
      document.getElementById('paneStoreApprovedTickets').style.display = activeTab === 'approved' ? 'block' : 'none';
      document.getElementById('paneStoreAllocations').style.display = activeTab === 'allocations' ? 'block' : 'none';

      renderActiveStorePane();
    });
  });

  async function renderActiveStorePane() {
    const storeId = getCurrentStoreId();
    updateStoreBanner(storeId);

    if (activeTab === 'catalog') {
      await renderCatalogPane(storeId);
    } else if (activeTab === 'my_requests') {
      await renderRequestsPane(storeId);
    } else if (activeTab === 'approved') {
      await renderApprovedPane(storeId);
    } else if (activeTab === 'allocations') {
      await renderAllocationsPane(storeId);
    }
  }

  function updateStoreBanner(storeId) {
    const state = getState();
    const st = getLocalAdminState();
    const store = (st.stores || []).find(s => s.storeId === storeId) || { storeName: state.storeName || 'My Store', authorizationStatus: 'APPROVED' };

    const pill = document.getElementById('storeNamePillDisplay');
    if (pill) pill.textContent = store.storeName;

    const badge = document.getElementById('storeAuthStatusBadge');
    const alertBanner = document.getElementById('storeSuspendedAlertBanner');

    if (store.authorizationStatus === 'SUSPENDED') {
      if (badge) {
        badge.className = 'badge-status suspended';
        badge.textContent = '⚠️ Store Suspended';
      }
      if (alertBanner) alertBanner.style.display = 'flex';
    } else {
      if (badge) {
        badge.className = 'badge-status approved';
        badge.textContent = '✓ Store Authorized';
      }
      if (alertBanner) alertBanner.style.display = 'none';
    }
  }

  async function renderCatalogPane(storeId) {
    const tbody = document.getElementById('storeCatalogTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#94a3b8;">Loading catalog...</td></tr>';

    const catalog = await fetchStoreCatalog(storeId);
    if (!catalog || catalog.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#94a3b8;">No lottery ticket games found.</td></tr>';
      return;
    }

    tbody.innerHTML = catalog.map(game => {
      let statusHtml = '';
      let actionHtml = '';

      if (game.isApproved) {
        statusHtml = '<span class="badge-status approved">✓ Authorized to Sell</span>';
        actionHtml = '<span style="color:#10b981; font-weight:600; font-size:0.82rem;">Ready in POS</span>';
      } else if (game.requestStatus === 'PENDING') {
        statusHtml = '<span class="badge-status pending">⏳ Request Pending</span>';
        actionHtml = '<span style="color:#f59e0b; font-size:0.8rem;">Awaiting Admin</span>';
      } else if (game.requestStatus === 'REJECTED') {
        statusHtml = `<span class="badge-status rejected" title="${game.adminReason || 'Request Rejected'}">✕ Rejected</span>`;
        actionHtml = `<button type="button" class="btn-action-sm btn-info btn-re-request-ticket" data-game-id="${game.gameId}">Re-request</button>`;
      } else if (game.requestStatus === 'MORE_INFO_REQUIRED') {
        statusHtml = `<span class="badge-status more-info" title="${game.adminReason || ''}">ℹ Info Needed</span>`;
        actionHtml = `<button type="button" class="btn-action-sm btn-info btn-re-request-ticket" data-game-id="${game.gameId}">Provide Info</button>`;
      } else {
        statusHtml = '<span style="color:#64748b; font-size:0.8rem;">Not Requested</span>';
        actionHtml = `<button type="button" class="btn-action-sm btn-approve btn-request-ticket" data-game-id="${game.gameId}">Request Approval</button>`;
      }

      return `
        <tr>
          <td><strong style="color:#818cf8; font-family:var(--mono);">${game.gameCode || game.gameId}</strong></td>
          <td><strong style="color:var(--admin-heading-color);">${game.gameName}</strong></td>
          <td>$${Number(game.price).toFixed(2)}</td>
          <td>${game.packSize} tickets</td>
          <td>$${(Number(game.price) * Number(game.packSize)).toFixed(2)}</td>
          <td>${statusHtml}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');

    // Attach request click handlers
    tbody.querySelectorAll('.btn-request-ticket, .btn-re-request-ticket').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gameId = btn.dataset.gameId;
        const state = getState();
        sfx.keypad?.();
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        const res = await submitStoreTicketRequest(storeId, state.storeName || 'Store', gameId, state.cashierName || 'Owner');
        if (res.success) {
          sfx.success?.();
          showToast(`✓ Request to sell game #${gameId} submitted to administrator.`, 'success');
        } else {
          showToast(res.message || 'Could not submit request.', 'warning');
        }
        await renderCatalogPane(storeId);
        updateBadges(storeId);
      });
    });
  }

  async function renderRequestsPane(storeId) {
    const tbody = document.getElementById('storeRequestsTableBody');
    if (!tbody) return;
    const requests = await fetchStoreTicketRequests(storeId);

    if (!requests || requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color:#94a3b8;">No requests submitted yet. Browse the catalog to request games.</td></tr>';
      return;
    }

    tbody.innerHTML = requests.map(r => {
      let badgeClass = 'pending';
      let label = 'PENDING';
      if (r.status === 'APPROVED') { badgeClass = 'approved'; label = 'APPROVED'; }
      else if (r.status === 'REJECTED') { badgeClass = 'rejected'; label = 'REJECTED'; }
      else if (r.status === 'MORE_INFO_REQUIRED') { badgeClass = 'more-info'; label = 'MORE INFO'; }

      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : 'Recent';
      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${r.gameName}</strong></td>
          <td>$${Number(r.price).toFixed(2)}</td>
          <td>${r.requestedBy || 'Owner'}</td>
          <td><span class="badge-status ${badgeClass}">${label}</span></td>
          <td style="color:#cbd5e1; font-size:0.82rem;">${r.adminDecisionReason || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  async function renderApprovedPane(storeId) {
    const tbody = document.getElementById('storeApprovedTableBody');
    if (!tbody) return;
    const approved = await fetchStoreApprovedTickets(storeId);

    if (!approved || approved.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color:#94a3b8;">No authorized games for this store yet.</td></tr>';
      return;
    }

    tbody.innerHTML = approved.map(g => `
      <tr>
        <td><strong style="color:#818cf8; font-family:var(--mono);">${g.gameCode || g.gameId}</strong></td>
        <td><strong style="color:var(--admin-heading-color);">${g.gameName}</strong></td>
        <td>$${Number(g.price).toFixed(2)}</td>
        <td>${g.packSize} tickets</td>
        <td><span class="badge-status approved">✓ Authorized to Sell</span></td>
      </tr>
    `).join('');
  }

  async function renderAllocationsPane(storeId) {
    const tbody = document.getElementById('storeAllocationsTableBody');
    if (!tbody) return;
    const allocations = await fetchStoreAllocations(storeId);

    if (!allocations || allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color:#94a3b8;">No physical stock allocations assigned to this store yet.</td></tr>';
      return;
    }

    tbody.innerHTML = allocations.map(a => {
      const isReceived = a.status === 'RECEIVED';
      const actionHtml = isReceived
        ? '<span style="color:#10b981; font-weight:600; font-size:0.82rem;">✓ In Safe Stock</span>'
        : `<button type="button" class="btn-action-sm btn-approve btn-receive-pack" data-alloc-id="${a.id}">Receive Pack</button>`;

      return `
        <tr>
          <td><span style="font-family:var(--mono); color:#94a3b8;">${a.allocationReference || 'ALC'}</span></td>
          <td>${a.allocationDate || 'Today'}</td>
          <td><strong>${a.gameName}</strong></td>
          <td><strong style="font-family:var(--mono); color:#38bdf8;">#${a.packNumber}</strong></td>
          <td>${a.packSize} tix</td>
          <td>$${Number(a.packValue || (a.ticketPrice * a.packSize)).toFixed(2)}</td>
          <td><span class="badge-status ${isReceived ? 'approved' : 'pending'}">${isReceived ? 'RECEIVED' : 'ALLOCATED'}</span></td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');

    // Attach "Receive Pack" click handlers
    tbody.querySelectorAll('.btn-receive-pack').forEach(btn => {
      btn.addEventListener('click', async () => {
        const allocId = btn.dataset.allocId;
        const state = getState();
        sfx.keypad?.();

        const res = await receiveStoreAllocation(allocId, storeId, state.cashierName || 'Owner');
        if (res.success && res.allocation) {
          const pack = res.allocation;

          // Add pack to store's inStockInventory
          if (!Array.isArray(state.inStockInventory)) {
            state.inStockInventory = [];
          }

          const existingPack = state.inStockInventory.find(p => String(p.packNumber) === String(pack.packNumber));
          if (!existingPack) {
            state.inStockInventory.push({
              packNumber: String(pack.packNumber),
              gameName: pack.gameName,
              gameId: pack.gameId,
              price: pack.ticketPrice,
              packSize: pack.packSize,
              location: 'SAFE',
              receivedDate: new Date().toISOString()
            });
            saveState(state);
          }

          sfx.win?.();
          showToast(`🎉 Pack #${pack.packNumber} received into Safe inventory! Ready for counter activation.`, 'success');
          await renderAllocationsPane(storeId);
          updateBadges(storeId);
        } else {
          showToast(res.message || 'Could not receive pack.', 'error');
        }
      });
    });
  }

  function updateBadges(storeId) {
    const st = getLocalAdminState();
    const reqs = (st.ticketRequests || []).filter(r => r.storeId === storeId);
    const approved = (st.approvedTickets || []).filter(a => a.storeId === storeId && a.status !== 'REVOKED');
    const allocs = (st.allocations || []).filter(a => a.storeId === storeId && a.status === 'ALLOCATED');

    const reqBadge = document.getElementById('countMyRequestsBadge');
    if (reqBadge) reqBadge.textContent = String(reqs.length);

    const apprBadge = document.getElementById('countApprovedTicketsBadge');
    if (apprBadge) apprBadge.textContent = String(approved.length);

    const allocBadge = document.getElementById('countAllocationsBadge');
    if (allocBadge) allocBadge.textContent = String(allocs.length);
  }

  return {
    renderStoreManageTicketsView: () => {
      const storeId = getCurrentStoreId();
      updateBadges(storeId);
      renderActiveStorePane();
    }
  };
}

// ----------------------------------------------------------------------------
// 2. ADMIN-SIDE: Platform Administrator Dashboard Controller
// ----------------------------------------------------------------------------

export function initAdminDashboardScreen({ showToast, sfx, showSellCounterView }) {
  let activeAdminTab = 'overview';
  let activeReportTab = 'sales';
  let selectedAppForReview = null;
  let selectedRequestForReview = null;

  // Day / Night Theme Toggle for Admin Portal
  const adminTopToggle = document.getElementById('adminThemeToggleBtn');
  if (adminTopToggle && !adminTopToggle._hasThemeListener) {
    adminTopToggle._hasThemeListener = true;
    adminTopToggle.addEventListener('click', () => {
      sfx.keypad?.();
      if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
      }
    });
  }

  // Mobile navigation drawer toggle
  const adminMobileBtn = document.getElementById('adminMobileToggleBtn');
  const adminSidebar = document.getElementById('adminSidebar');
  if (adminMobileBtn && adminSidebar && !adminMobileBtn._hasDrawerListener) {
    adminMobileBtn._hasDrawerListener = true;
    adminMobileBtn.addEventListener('click', () => {
      sfx.keypad?.();
      adminSidebar.classList.toggle('mobile-open');
    });
  }

  // Reports subnav tab switching
  document.querySelectorAll('#adminReportsSubnav button').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad?.();
      document.querySelectorAll('#adminReportsSubnav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeReportTab = btn.dataset.reportTab || 'sales';

      const secSales = document.getElementById('adminReportSectionSales');
      const secInv = document.getElementById('adminReportSectionInventory');
      const secShifts = document.getElementById('adminReportSectionShifts');
      const secDisc = document.getElementById('adminReportSectionDiscrepancies');

      if (secSales) secSales.style.display = activeReportTab === 'sales' ? 'block' : 'none';
      if (secInv) secInv.style.display = activeReportTab === 'inventory' ? 'block' : 'none';
      if (secShifts) secShifts.style.display = activeReportTab === 'shifts' ? 'block' : 'none';
      if (secDisc) secDisc.style.display = activeReportTab === 'discrepancies' ? 'block' : 'none';
    });
  });

  // Subnav tab switching
  document.querySelectorAll('#adminDashboardSubnav .admin-subnav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      sfx.keypad?.();
      document.querySelectorAll('#adminDashboardSubnav .admin-subnav-tab').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      activeAdminTab = tabBtn.dataset.adminTab || 'overview';

      const paneMap = {
        overview: 'paneAdminOverview',
        applications: 'paneAdminApplications',
        stores: 'paneAdminStores',
        feedback: 'paneAdminFeedback',
        catalog: 'paneAdminFeedback',
        requests: 'paneAdminFeedback',
        allocations: 'paneAdminFeedback',
        reports: 'paneAdminReports',
        audit: 'paneAdminAudit'
      };

      Object.entries(paneMap).forEach(([tabKey, paneId]) => {
        const pane = document.getElementById(paneId);
        if (pane) pane.style.display = tabKey === activeAdminTab ? 'block' : 'none';
      });

      // Update URL hash & Topbar title
      const targetHash = activeAdminTab === 'overview' ? '#admin' : '#admin/' + activeAdminTab;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
      const titleEl = document.getElementById('adminActiveSectionTitle');
      if (titleEl) {
        const labelSpan = tabBtn.querySelector('.nav-label');
        titleEl.textContent = labelSpan ? labelSpan.textContent.trim() : tabBtn.textContent.trim();
      }

      renderActiveAdminPane();
    });
  });

  // Switch to Store POS button (Sidebar + Topbar)
  const handleSwitchToPos = () => {
    sfx.keypad?.();
    const targetStoreId = 'store_admin';
    if (typeof window.switchStore === 'function') {
      window.switchStore(targetStoreId);
    }
    showSellCounterView();
    window.location.hash = '';
    history.replaceState(null, '', '/');
    showToast('Switched to Admin Store POS counter view.', 'info');
  };
  document.getElementById('btnAdminSwitchToStore')?.addEventListener('click', handleSwitchToPos);
  document.getElementById('btnAdminTopSwitchPos')?.addEventListener('click', handleSwitchToPos);

  // Return to Store POS button from Ticket Request page
  document.getElementById('btnStoreReturnToPos')?.addEventListener('click', () => {
    sfx.keypad?.();
    showSellCounterView();
    window.location.hash = '';
    history.replaceState(null, '', '/');
    showToast('Returned to Store POS counter view.', 'info');
  });

  // Self-Service Store Application Modal setup
  const storeAppModal = document.getElementById('modalStoreApplication');
  document.getElementById('btnOpenStoreAppModal')?.addEventListener('click', () => {
    sfx.keypad?.();
    storeAppModal?.showModal();
  });
  document.getElementById('closeStoreAppModalBtn')?.addEventListener('click', () => storeAppModal?.close());
  document.getElementById('cancelStoreAppBtn')?.addEventListener('click', () => storeAppModal?.close());

  document.getElementById('formSubmitStoreApp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const storeName = document.getElementById('appInputStoreName')?.value?.trim();
    const ownerName = document.getElementById('appInputOwnerName')?.value?.trim();
    const businessNumber = document.getElementById('appInputRetailerId')?.value?.trim();
    const ownerEmail = document.getElementById('appInputEmail')?.value?.trim();
    const ownerPhone = document.getElementById('appInputPhone')?.value?.trim();
    const address = document.getElementById('appInputAddress')?.value?.trim();
    const documentsUrl = document.getElementById('appInputNotes')?.value?.trim();

    try {
      const res = await fetch('/api/store-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          ownerName,
          businessNumber,
          ownerEmail,
          ownerPhone,
          address,
          documentsUrl,
          requestedBy: ownerName
        })
      });
      const data = await res.json();
      if (data.success) {
        sfx.win?.();
        showToast(`✓ Application for "${storeName}" submitted! Pending administrator review.`, 'success');
        storeAppModal?.close();
        document.getElementById('formSubmitStoreApp')?.reset();
      } else {
        showToast(data.message || 'Failed to submit application', 'error');
      }
    } catch (err) {
      showToast('Network error submitting application: ' + err.message, 'error');
    }
  });

  // Direct shortcuts from Store Inventory & Settings to Manage Tickets
  document.getElementById('invBtnRequestTickets')?.addEventListener('click', () => {
    if (typeof window.showManageTicketsView === 'function') window.showManageTicketsView();
  });
  document.getElementById('settingsBtnManageTickets')?.addEventListener('click', () => {
    if (typeof window.showManageTicketsView === 'function') window.showManageTicketsView();
  });

  // Sign out button
  document.getElementById('btnAdminLogout')?.addEventListener('click', async () => {
    await adminLogout();
    sessionStorage.clear();
    localStorage.removeItem('lotto_session_user');
    window.location.href = '/';
  });

  // Quick jump from overview
  document.getElementById('btnAdminViewAllFeedback')?.addEventListener('click', () => {
    document.querySelector('[data-admin-tab="feedback"]')?.click();
  });
  document.getElementById('btnAdminViewAllRequests')?.addEventListener('click', () => {
    document.querySelector('[data-admin-tab="feedback"]')?.click();
  });

  // --------------------------------------------------------------------------
  // Modals Setup
  // --------------------------------------------------------------------------

  // Review Store Feedback Modal
  let selectedFeedbackForReview = null;
  const feedbackModal = document.getElementById('adminReviewFeedbackModal');
  document.getElementById('closeAdminFeedbackModalBtn')?.addEventListener('click', () => feedbackModal?.close());
  document.getElementById('cancelAdminFeedbackModalBtn')?.addEventListener('click', () => feedbackModal?.close());

  document.getElementById('btnSaveAdminFeedbackReview')?.addEventListener('click', async () => {
    if (!selectedFeedbackForReview) return;
    const status = document.getElementById('adminFeedbackStatusSelect')?.value || 'RESOLVED';
    const notes = document.getElementById('adminFeedbackNotesTextarea')?.value || '';
    const res = await reviewStoreFeedback(selectedFeedbackForReview.id, status, 'admin', notes);
    if (res.success) {
      sfx.win?.();
      showToast(`✓ Store feedback marked as "${status}".`, 'success');
      feedbackModal?.close();
      renderActiveAdminPane();
    } else {
      showToast(res.message || 'Failed to update feedback.', 'error');
    }
  });

  // Review Application Modal
  const appModal = document.getElementById('adminReviewAppModal');
  document.getElementById('closeAdminAppModalBtn')?.addEventListener('click', () => appModal?.close());

  document.getElementById('btnAdminAppApprove')?.addEventListener('click', async () => {
    if (!selectedAppForReview) return;
    const notes = document.getElementById('adminAppNotesInput')?.value || '';
    const res = await reviewStoreApplication(selectedAppForReview.id, 'APPROVE', 'admin', notes);
    if (res.success) {
      sfx.win?.();
      showToast(`✓ Store application for "${selectedAppForReview.storeName}" APPROVED!`, 'success');
      appModal?.close();
      renderActiveAdminPane();
    }
  });

  document.getElementById('btnAdminAppReject')?.addEventListener('click', async () => {
    if (!selectedAppForReview) return;
    const notes = document.getElementById('adminAppNotesInput')?.value || '';
    const res = await reviewStoreApplication(selectedAppForReview.id, 'REJECT', 'admin', notes);
    if (res.success) {
      showToast(`Store application for "${selectedAppForReview.storeName}" rejected.`, 'info');
      appModal?.close();
      renderActiveAdminPane();
    }
  });

  document.getElementById('btnAdminAppRequestInfo')?.addEventListener('click', async () => {
    if (!selectedAppForReview) return;
    const notes = document.getElementById('adminAppNotesInput')?.value || '';
    const res = await reviewStoreApplication(selectedAppForReview.id, 'MORE_INFO', 'admin', notes);
    if (res.success) {
      showToast('Requested more information from applicant.', 'info');
      appModal?.close();
      renderActiveAdminPane();
    }
  });

  // Review Ticket Request Modal
  const reqModal = document.getElementById('adminReviewRequestModal');
  document.getElementById('closeAdminRequestModalBtn')?.addEventListener('click', () => reqModal?.close());

  document.getElementById('btnAdminReqApprove')?.addEventListener('click', async () => {
    if (!selectedRequestForReview) return;
    const reason = document.getElementById('adminRequestReasonInput')?.value || 'Approved for retail sale';
    const res = await reviewStoreTicketRequest(selectedRequestForReview.id, 'APPROVE', 'admin', reason);
    if (res.success) {
      sfx.win?.();
      showToast(`✓ Approved ticket type "${selectedRequestForReview.gameName}" for ${selectedRequestForReview.storeName}. (Physical stock not yet allocated)`, 'success');
      reqModal?.close();
      renderActiveAdminPane();
    }
  });

  document.getElementById('btnAdminReqReject')?.addEventListener('click', async () => {
    if (!selectedRequestForReview) return;
    const reason = document.getElementById('adminRequestReasonInput')?.value || 'Denied by administrator';
    const res = await reviewStoreTicketRequest(selectedRequestForReview.id, 'REJECT', 'admin', reason);
    if (res.success) {
      showToast(`Ticket request rejected.`, 'info');
      reqModal?.close();
      renderActiveAdminPane();
    }
  });

  document.getElementById('btnAdminReqMoreInfo')?.addEventListener('click', async () => {
    if (!selectedRequestForReview) return;
    const reason = document.getElementById('adminRequestReasonInput')?.value || 'More details required';
    const res = await reviewStoreTicketRequest(selectedRequestForReview.id, 'MORE_INFO', 'admin', reason);
    if (res.success) {
      showToast('Requested more information from store.', 'info');
      reqModal?.close();
      renderActiveAdminPane();
    }
  });

  // Add / Edit Game Modal
  const addGameModal = document.getElementById('adminAddCatalogGameModal');
  document.getElementById('btnAdminAddNewGameModal')?.addEventListener('click', () => {
    sfx.keypad?.();
    const titleEl = document.getElementById('adminCatalogModalTitle');
    if (titleEl) titleEl.textContent = 'Add Game to State Lottery Catalog';
    const isEditInp = document.getElementById('adminGameIsEdit');
    if (isEditInp) isEditInp.value = '0';
    const codeInp = document.getElementById('adminGameCodeInput');
    if (codeInp) { codeInp.value = ''; codeInp.readOnly = false; }
    const titleInp = document.getElementById('adminGameTitleInput');
    if (titleInp) titleInp.value = '';
    const priceInp = document.getElementById('adminGamePriceInput');
    if (priceInp) priceInp.value = '5';
    const packInp = document.getElementById('adminGamePackSizeInput');
    if (packInp) packInp.value = '60';
    const submitBtn = document.getElementById('btnAdminCatalogSubmit');
    if (submitBtn) submitBtn.textContent = 'Add to Catalog';
    addGameModal?.showModal();
  });
  document.getElementById('closeAdminAddGameModalBtn')?.addEventListener('click', () => addGameModal?.close());
  document.getElementById('cancelAdminAddGameBtn')?.addEventListener('click', () => addGameModal?.close());

  document.getElementById('adminAddGameForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = document.getElementById('adminGameIsEdit')?.value === '1';
    const code = document.getElementById('adminGameCodeInput')?.value?.trim();
    const title = document.getElementById('adminGameTitleInput')?.value?.trim();
    const price = Number(document.getElementById('adminGamePriceInput')?.value) || 1;
    const packSize = Number(document.getElementById('adminGamePackSizeInput')?.value) || 100;

    if (!code || !title) return;

    const st = getLocalAdminState();
    const existingGame = st.catalog.find(g => g.gameId === code);

    const res = await addOrUpdateCatalogGame({
      gameId: code,
      gameCode: code,
      gameName: title,
      price,
      packSize,
      packValue: price * packSize,
      isActive: existingGame ? existingGame.isActive : true
    }, 'admin');

    if (res.success) {
      sfx.win?.();
      showToast(isEdit ? `✓ Game "${title}" updated in lottery catalog!` : `✓ Game "${title}" added to central lottery catalog!`, 'success');
      addGameModal?.close();
      (document.getElementById('adminAddGameForm')).reset();
      renderActiveAdminPane();
    }
  });

  // Stock Allocation Modal
  const allocModal = document.getElementById('adminCreateAllocationModal');
  document.getElementById('btnAdminOpenNewAllocationModal')?.addEventListener('click', () => {
    sfx.keypad?.();
    populateAllocationForm();
    allocModal?.showModal();
  });
  document.getElementById('closeAdminAllocModalBtn')?.addEventListener('click', () => allocModal?.close());
  document.getElementById('cancelAdminAllocBtn')?.addEventListener('click', () => allocModal?.close());

  function populateAllocationForm() {
    const st = getLocalAdminState();
    const storeSel = document.getElementById('adminAllocStoreSelect');
    const gameSel = document.getElementById('adminAllocGameSelect');
    if (!storeSel || !gameSel) return;

    // Stores dropdown (only APPROVED stores)
    const approvedStores = st.stores.filter(s => s.authorizationStatus === 'APPROVED');
    storeSel.innerHTML = approvedStores.map(s => `<option value="${s.storeId}">${s.storeName} (${s.retailerNumber || s.storeId})</option>`).join('');

    function updateGamesForSelectedStore() {
      const selectedStoreId = storeSel.value;
      const approvedGameIds = (st.approvedTickets || []).filter(a => a.storeId === selectedStoreId && a.status !== 'REVOKED').map(a => a.gameId);
      const eligibleGames = st.catalog.filter(g => approvedGameIds.includes(g.gameId));

      if (eligibleGames.length === 0) {
        gameSel.innerHTML = '<option value="">No approved games for this store</option>';
      } else {
        gameSel.innerHTML = eligibleGames.map(g => `<option value="${g.gameId}" data-price="${g.price}" data-packsize="${g.packSize}" data-gamename="${g.gameName}">${g.gameName} ($${g.price} · ${g.packSize} tix)</option>`).join('');
      }
      updateAllocationSpecs();
    }

    function updateAllocationSpecs() {
      const opt = gameSel.selectedOptions[0];
      if (opt && opt.value) {
        const price = opt.dataset.price || '1';
        const packSize = opt.dataset.packsize || '100';
        const priceInp = document.getElementById('adminAllocPriceInput');
        const packInp = document.getElementById('adminAllocPackSizeInput');
        if (priceInp) priceInp.value = price;
        if (packInp) packInp.value = packSize;
      }
    }

    storeSel.onchange = updateGamesForSelectedStore;
    gameSel.onchange = updateAllocationSpecs;
    updateGamesForSelectedStore();

    // Default allocation ref
    const refInput = document.getElementById('adminAllocRefInput');
    if (refInput) refInput.value = `ALC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const packInp = document.getElementById('adminAllocPackNumInput');
    if (packInp) packInp.value = String(Math.floor(100000 + Math.random() * 900000));
  }

  document.getElementById('adminCreateAllocForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const st = getLocalAdminState();
    const storeSel = document.getElementById('adminAllocStoreSelect');
    const gameSel = document.getElementById('adminAllocGameSelect');
    const packInp = document.getElementById('adminAllocPackNumInput');
    const refInp = document.getElementById('adminAllocRefInput');

    const storeId = storeSel?.value;
    const gameId = gameSel?.value;
    const packNumber = packInp?.value?.trim();
    const allocationReference = refInp?.value?.trim();

    if (!storeId || !gameId || !packNumber) {
      showToast('Please select store, approved game, and pack number.', 'warning');
      return;
    }

    const store = st.stores.find(s => s.storeId === storeId);
    const game = st.catalog.find(g => g.gameId === gameId);

    const res = await createTicketAllocation({
      allocationReference,
      storeId,
      storeName: store?.storeName || storeId,
      gameId,
      gameName: game?.gameName || 'Scratch Ticket',
      packNumber,
      packSize: game?.packSize || 100,
      ticketPrice: game?.price || 1.00
    }, 'admin');

    if (res.success) {
      sfx.win?.();
      showToast(res.message || 'Stock allocated successfully!', 'success');
      allocModal?.close();
      renderActiveAdminPane();
    } else {
      showToast(res.message || 'Allocation failed.', 'error');
    }
  });

  // --------------------------------------------------------------------------
  // Active Pane Renderers
  // --------------------------------------------------------------------------

  async function renderActiveAdminPane() {
    if (window.location.hash.startsWith('#admin/')) {
      const sub = window.location.hash.replace('#admin/', '').trim().toLowerCase();
      if (['overview', 'applications', 'stores', 'feedback', 'reports', 'audit'].includes(sub)) {
        activeAdminTab = sub;
        document.querySelectorAll('#adminDashboardSubnav .admin-subnav-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.adminTab === sub);
        });
      }
    }

    const paneMap = {
      overview: 'paneAdminOverview',
      applications: 'paneAdminApplications',
      stores: 'paneAdminStores',
      feedback: 'paneAdminFeedback',
      reports: 'paneAdminReports',
      audit: 'paneAdminAudit'
    };

    Object.entries(paneMap).forEach(([tabKey, paneId]) => {
      const pane = document.getElementById(paneId);
      if (pane) pane.style.display = tabKey === activeAdminTab ? 'block' : 'none';
    });

    await syncAdminStateFromServer();
    updateAdminBadges();

    if (activeAdminTab === 'overview') renderOverview();
    else if (activeAdminTab === 'applications') renderApplications();
    else if (activeAdminTab === 'stores') renderStores();
    else if (activeAdminTab === 'feedback') renderFeedback();
    else if (activeAdminTab === 'reports') renderReports();
    else if (activeAdminTab === 'audit') renderAudit();
  }

  function updateAdminBadges() {
    const st = getLocalAdminState();
    const pendingApps = st.applications.filter(a => a.status === 'PENDING').length;
    const pendingReqs = st.ticketRequests.filter(r => r.status === 'PENDING').length;
    const pendingFeedback = (st.feedback || []).filter(f => f.status === 'PENDING').length;

    const bApps = document.getElementById('adminCountPendingAppsBadge');
    if (bApps) bApps.textContent = String(pendingApps);

    const bStores = document.getElementById('adminCountStoresBadge');
    if (bStores) bStores.textContent = String(st.stores.length);

    const bCat = document.getElementById('adminCountCatalogBadge');
    if (bCat) bCat.textContent = String(st.catalog.length);

    const bReqs = document.getElementById('adminCountPendingRequestsBadge');
    if (bReqs) bReqs.textContent = String(pendingReqs);

    const bFb = document.getElementById('adminCountPendingFeedbackBadge');
    if (bFb) bFb.textContent = String(pendingFeedback);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function renderOverview() {
    const overview = await fetchAdminOverview();
    const stats = overview?.stats || {
      totalStores: 0,
      pendingApplications: 0,
      approvedStores: 0,
      suspendedStores: 0
    };

    const elTotal = document.getElementById('adminKpiTotalStores');
    const elPending = document.getElementById('adminKpiPendingApps');
    const elApproved = document.getElementById('adminKpiApprovedStores');
    const elSuspended = document.getElementById('adminKpiSuspendedStores');

    if (elTotal) elTotal.textContent = String(stats.totalStores ?? 0);
    if (elPending) elPending.textContent = String(stats.pendingApplications ?? 0);
    if (elApproved) elApproved.textContent = String(stats.approvedStores ?? 0);
    if (elSuspended) elSuspended.textContent = String(stats.suspendedStores ?? 0);

    // Recent store user feedback preview
    const st = getLocalAdminState();
    const fbListEl = document.getElementById('adminOverviewFeedbackList');
    if (fbListEl) {
      const feedbackList = (st.feedback || []);
      if (feedbackList.length === 0) {
        fbListEl.innerHTML = '<div style="padding: 32px 20px; text-align: center; color: var(--admin-text-dim); font-size: 0.85rem;"><span style="font-size: 1.6rem; display: block; margin-bottom: 6px;">💬</span>No store feedback or issues reported yet.</div>';
      } else {
        fbListEl.innerHTML = feedbackList.slice(0, 5).map(fb => {
          let sevClass = 'sev-low';
          if (fb.severity === 'CRITICAL') sevClass = 'sev-critical';
          else if (fb.severity === 'HIGH') sevClass = 'sev-high';
          else if (fb.severity === 'MEDIUM') sevClass = 'sev-medium';

          let statusClass = 'pending';
          if (fb.status === 'RESOLVED') statusClass = 'approved';
          else if (fb.status === 'IN_PROGRESS') statusClass = 'more-info';
          else if (fb.status === 'DISMISSED') statusClass = 'rejected';

          const dateDisplay = fb.createdAt ? new Date(fb.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }) : '';

          return `
            <div class="overview-feedback-item">
              <div class="overview-feedback-main">
                <div class="overview-feedback-header">
                  <span class="overview-store-title">${escapeHtml(fb.storeName)}</span>
                  <span class="overview-sev-badge ${sevClass}">${escapeHtml(fb.severity)}</span>
                  <span class="badge-status ${statusClass}">${escapeHtml(fb.status)}</span>
                </div>
                <div class="overview-feedback-subject">${escapeHtml(fb.subject || (fb.message || '').slice(0, 60))}</div>
                <div class="overview-feedback-meta">
                  <span>${escapeHtml(fb.cashierName || 'Cashier')}</span>
                  <span>&middot;</span>
                  <span>${dateDisplay}</span>
                </div>
              </div>
              <button type="button" class="btn-action-sm btn-info btn-overview-review-fb" data-fb-id="${fb.id}">Review</button>
            </div>
          `;
        }).join('');

        fbListEl.querySelectorAll('.btn-overview-review-fb').forEach(btn => {
          btn.addEventListener('click', () => {
            const fbId = btn.dataset.fbId;
            openReviewFeedbackModal(fbId);
          });
        });
      }
    }

    // Recent audit list
    const auditEl = document.getElementById('adminOverviewRecentAuditList');
    if (auditEl) {
      const logs = (st.auditLogs || []).slice(0, 6);
      if (logs.length === 0) {
        auditEl.innerHTML = '<div style="padding: 32px 20px; text-align: center; color: var(--admin-text-dim); font-size: 0.85rem;"><span style="font-size: 1.6rem; display: block; margin-bottom: 6px;">📜</span>No administrative actions recorded yet.</div>';
      } else {
        auditEl.innerHTML = logs.map(l => {
          let actionClass = 'action-default';
          const aType = (l.actionType || '').toUpperCase();
          if (aType.includes('LOGIN')) actionClass = 'action-login';
          else if (aType.includes('APPROVE')) actionClass = 'action-approve';
          else if (aType.includes('SUSPEND') || aType.includes('REJECT')) actionClass = 'action-danger';
          else if (aType.includes('FEEDBACK')) actionClass = 'action-feedback';

          const timeStr = l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const targetStr = l.targetId ? String(l.targetId).replace(/^(fb_|store_|req_)/, '') : (l.targetEntity || '');

          return `
            <div class="audit-log-item">
              <div class="audit-log-left">
                <span class="audit-action-tag ${actionClass}">${escapeHtml(l.actionType)}</span>
                <span class="audit-target">${escapeHtml(targetStr || l.targetEntity || '')}</span>
              </div>
              <span class="audit-time">${timeStr}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  function renderApplications() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminApplicationsTableBody');
    if (!tbody) return;

    if (st.applications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#94a3b8;">No applications submitted.</td></tr>';
      return;
    }

    tbody.innerHTML = st.applications.map(a => {
      let badgeClass = 'pending';
      if (a.status === 'APPROVED') badgeClass = 'approved';
      else if (a.status === 'REJECTED') badgeClass = 'rejected';
      else if (a.status === 'MORE_INFO_REQUIRED') badgeClass = 'more-info';

      const docLinks = (a.documents || []).map(d => `<span style="font-family:var(--mono); font-size:0.76rem; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">📄 ${d}</span>`).join(' ');

      return `
        <tr>
          <td><strong style="color:var(--admin-heading-color);">${a.storeName}</strong></td>
          <td>${a.applicantName}</td>
          <td>${a.applicantPhone || a.applicantEmail}</td>
          <td><span style="font-family:var(--mono);">${a.lotteryRetailerId || a.businessTaxId}</span></td>
          <td>${docLinks || 'None'}</td>
          <td><span class="badge-status ${badgeClass}">${a.status}</span></td>
          <td>
            <button type="button" class="btn-action-sm btn-info btn-review-app" data-app-id="${a.id}">Review</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-review-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.dataset.appId;
        openReviewAppModal(appId);
      });
    });
  }

  function openReviewAppModal(appId) {
    const st = getLocalAdminState();
    const app = st.applications.find(a => String(a.id) === String(appId));
    if (!app) return;
    selectedAppForReview = app;

    document.getElementById('adminAppModalTitle').textContent = `Review Application · ${app.storeName}`;
    document.getElementById('adminAppModalContent').innerHTML = `
      <div style="background:rgba(255,255,255,0.04); padding:14px; border-radius:8px; margin-bottom:12px;">
        <div><strong>Applicant:</strong> ${app.applicantName} (${app.applicantEmail || ''} · ${app.applicantPhone || ''})</div>
        <div><strong>Tax ID:</strong> ${app.businessTaxId || 'N/A'} &nbsp;|&nbsp; <strong>Retailer ID:</strong> ${app.lotteryRetailerId || 'N/A'}</div>
        <div><strong>Address:</strong> ${app.address || 'N/A'}</div>
        <div style="margin-top:6px;"><strong>Submitted Documents:</strong> ${(app.documents || []).join(', ') || 'None'}</div>
        <div style="margin-top:6px;"><strong>Current Status:</strong> <span class="badge-status ${app.status.toLowerCase()}">${app.status}</span></div>
      </div>
    `;
    const notesInput = document.getElementById('adminAppNotesInput');
    if (notesInput) notesInput.value = app.adminNotes || '';
    appModal?.showModal();
  }

  function renderStores() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminStoresTableBody');
    if (!tbody) return;

    tbody.innerHTML = st.stores.map(s => {
      const isSuspended = s.authorizationStatus === 'SUSPENDED';
      const authBadge = isSuspended
        ? '<span class="badge-status suspended">SUSPENDED</span>'
        : '<span class="badge-status approved">APPROVED</span>';
      
      const operBadge = s.operationalStatus === 'ACTIVE'
        ? '<span style="color:#10b981; font-weight:600;">ACTIVE</span>'
        : '<span style="color:#ef4444; font-weight:600;">INACTIVE</span>';

      const actionBtn = isSuspended
        ? `<button type="button" class="btn-action-sm btn-approve btn-reactivate-store" data-store-id="${s.storeId}">Reactivate</button>`
        : `<button type="button" class="btn-action-sm btn-suspend btn-suspend-store" data-store-id="${s.storeId}">Suspend</button>`;

      return `
        <tr>
          <td><span style="font-family:var(--mono); color:#94a3b8;">${s.storeId}</span></td>
          <td><strong style="color:var(--admin-heading-color);">${s.storeName}</strong></td>
          <td>${s.ownerUsername}</td>
          <td><span style="font-family:var(--mono);">${s.retailerNumber || 'GA-Pending'}</span></td>
          <td style="font-size:0.8rem; color:#94a3b8; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${s.address || 'Georgia, USA'}</td>
          <td>${authBadge}</td>
          <td>${operBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-suspend-store').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeId = btn.dataset.storeId;
        const reason = prompt('Enter reason for suspension:') || 'Administrative compliance review';
        const res = await updateStoreStatus(storeId, 'SUSPENDED', 'INACTIVE', 'admin', reason);
        if (res.success) {
          showToast(`Store suspended. Ticket sales blocked.`, 'warning');
          renderStores();
        }
      });
    });

    tbody.querySelectorAll('.btn-reactivate-store').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeId = btn.dataset.storeId;
        const res = await updateStoreStatus(storeId, 'APPROVED', 'ACTIVE', 'admin', 'Reactivated by administrator');
        if (res.success) {
          sfx.win?.();
          showToast(`✓ Store reactivated. Sales enabled.`, 'success');
          renderStores();
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Store Feedback & Issue Reporting Renderer
  // --------------------------------------------------------------------------
  let currentFeedbackFilter = 'ALL';
  let feedbackSearchTerm = '';

  document.querySelectorAll('#adminFeedbackFilterGroup button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#adminFeedbackFilterGroup button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFeedbackFilter = btn.dataset.fbFilter || 'ALL';
      renderFeedback();
    });
  });

  document.getElementById('adminFeedbackSearchInput')?.addEventListener('input', (e) => {
    feedbackSearchTerm = (e.target.value || '').trim().toLowerCase();
    renderFeedback();
  });

  function renderFeedback() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminFeedbackTableBody');
    if (!tbody) return;

    let items = (st.feedback || []);

    if (currentFeedbackFilter !== 'ALL') {
      items = items.filter(f => f.status === currentFeedbackFilter);
    }

    if (feedbackSearchTerm) {
      items = items.filter(f =>
        (f.storeName || '').toLowerCase().includes(feedbackSearchTerm) ||
        (f.cashierName || '').toLowerCase().includes(feedbackSearchTerm) ||
        (f.subject || '').toLowerCase().includes(feedbackSearchTerm) ||
        (f.message || '').toLowerCase().includes(feedbackSearchTerm) ||
        (f.category || '').toLowerCase().includes(feedbackSearchTerm)
      );
    }

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#94a3b8;">No feedback reports match current filter.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(fb => {
      let sevColor = '#94a3b8';
      let sevBg = 'rgba(148,163,184,0.1)';
      if (fb.severity === 'CRITICAL') { sevColor = '#f43f5e'; sevBg = 'rgba(244,63,94,0.15)'; }
      else if (fb.severity === 'HIGH') { sevColor = '#f59e0b'; sevBg = 'rgba(245,158,11,0.15)'; }
      else if (fb.severity === 'MEDIUM') { sevColor = '#38bdf8'; sevBg = 'rgba(56,189,248,0.15)'; }

      let statusClass = 'pending';
      if (fb.status === 'RESOLVED') statusClass = 'approved';
      else if (fb.status === 'IN_PROGRESS') statusClass = 'more-info';
      else if (fb.status === 'DISMISSED') statusClass = 'rejected';

      const dateStr = fb.createdAt ? new Date(fb.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent';

      const catIcons = {
        SCANNER: '🔍 SCANNER',
        INVENTORY: '📦 INVENTORY',
        SHIFT: '⏱️ SHIFT',
        SALES: '💰 SALES',
        BUG: '🐛 BUG',
        OTHER: '💡 OTHER'
      };
      const catDisplay = catIcons[fb.category] || fb.category;

      return `
        <tr>
          <td>
            <strong style="color:var(--admin-heading-color);">${escapeHtml(fb.storeName)}</strong>
            <div style="font-size:0.75rem; color:#94a3b8;">${escapeHtml(fb.cashierName || 'Cashier')} &middot; <span style="font-family:var(--mono);">${escapeHtml(fb.storeId)}</span></div>
          </td>
          <td><span style="font-family:var(--mono); font-size:0.78rem; font-weight:600; color:#818cf8;">${escapeHtml(catDisplay)}</span></td>
          <td><span style="font-size:0.72rem; font-weight:700; color:${sevColor}; background:${sevBg}; border:1px solid ${sevColor}40; padding:2px 7px; border-radius:4px;">${escapeHtml(fb.severity)}</span></td>
          <td>
            <strong style="color:var(--admin-text-main); font-size:0.84rem;">${escapeHtml(fb.subject || 'Issue Report')}</strong>
            <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px; max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(fb.message || '')}</div>
          </td>
          <td style="color:#94a3b8; font-size:0.8rem;">${dateStr}</td>
          <td><span class="badge-status ${statusClass}">${escapeHtml(fb.status)}</span></td>
          <td>
            <button type="button" class="btn-action-sm btn-info btn-review-feedback" data-fb-id="${fb.id}">Review</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-review-feedback').forEach(btn => {
      btn.addEventListener('click', () => {
        const fbId = btn.dataset.fbId;
        openReviewFeedbackModal(fbId);
      });
    });
  }

  function openReviewFeedbackModal(fbId) {
    const st = getLocalAdminState();
    const fb = (st.feedback || []).find(f => f.id === fbId);
    if (!fb) return;
    selectedFeedbackForReview = fb;

    const modalTitle = document.getElementById('adminReviewFeedbackModalTitle');
    if (modalTitle) modalTitle.textContent = `Review Feedback · ${fb.storeName}`;

    let sevColor = '#94a3b8';
    if (fb.severity === 'CRITICAL') sevColor = '#f43f5e';
    else if (fb.severity === 'HIGH') sevColor = '#f59e0b';
    else if (fb.severity === 'MEDIUM') sevColor = '#38bdf8';

    const card = document.getElementById('adminReviewFeedbackDetailsCard');
    if (card) {
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <div style="font-size:1rem; font-weight:700; color:var(--admin-heading-color);">${escapeHtml(fb.subject || 'Store Issue Report')}</div>
            <div style="font-size:0.78rem; color:#94a3b8;">Reported by <strong style="color:#cbd5e1;">${escapeHtml(fb.cashierName || 'Cashier')}</strong> at <strong>${escapeHtml(fb.storeName)}</strong> (${escapeHtml(fb.storeId)})</div>
          </div>
          <span style="font-size:0.75rem; font-weight:700; color:${sevColor}; border:1px solid ${sevColor}50; padding:2px 8px; border-radius:4px;">${escapeHtml(fb.severity)}</span>
        </div>
        <div style="margin: 8px 0; padding: 10px; background: var(--admin-payload-box-bg); border: 1px solid var(--admin-payload-box-border); border-radius: 8px; font-size: 0.85rem; color: var(--admin-text-main); white-space: pre-wrap; line-height: 1.45;">${escapeHtml(fb.message)}</div>
        <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:#64748b; margin-top:8px;">
          <span>Category: <strong style="color:#818cf8;">${escapeHtml(fb.category)}</strong></span>
          <span>Date: ${fb.createdAt ? new Date(fb.createdAt).toLocaleString() : 'N/A'}</span>
          <span>Status: <strong style="color:var(--admin-heading-color);">${escapeHtml(fb.status)}</strong></span>
        </div>
      `;
    }

    const sel = document.getElementById('adminFeedbackStatusSelect');
    if (sel) sel.value = fb.status || 'PENDING';

    const notes = document.getElementById('adminFeedbackNotesTextarea');
    if (notes) notes.value = fb.adminNotes || '';

    feedbackModal?.showModal();
  }

  function renderCatalog() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminCatalogTableBody');
    if (!tbody) return;

    tbody.innerHTML = st.catalog.map(g => `
      <tr>
        <td><strong style="color:#818cf8; font-family:var(--mono);">${g.gameCode || g.gameId}</strong></td>
        <td><strong style="color:var(--admin-heading-color);">${g.gameName}</strong></td>
        <td>${Number(g.price).toFixed(2)}</td>
        <td>${g.packSize} tickets</td>
        <td>${Number(g.packValue || (g.price * g.packSize)).toFixed(2)}</td>
        <td><span class="badge-status ${g.isActive ? 'approved' : 'rejected'}">${g.isActive ? 'ACTIVE' : 'INACTIVE'}</span></td>
        <td>
          <button type="button" class="btn-action-sm btn-info btn-edit-game" data-game-id="${g.gameId}" style="margin-right:6px;">
            Edit
          </button>
          <button type="button" class="btn-action-sm btn-info btn-toggle-game" data-game-id="${g.gameId}">
            ${g.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-game').forEach(btn => {
      btn.addEventListener('click', () => {
        const gameId = btn.dataset.gameId;
        const game = st.catalog.find(g => g.gameId === gameId);
        if (!game) return;
        sfx.keypad?.();
        const titleEl = document.getElementById('adminCatalogModalTitle');
        if (titleEl) titleEl.textContent = `Edit Game · ${game.gameName}`;
        const isEditInp = document.getElementById('adminGameIsEdit');
        if (isEditInp) isEditInp.value = '1';
        const codeInp = document.getElementById('adminGameCodeInput');
        if (codeInp) { codeInp.value = game.gameCode || game.gameId; codeInp.readOnly = true; }
        const titleInp = document.getElementById('adminGameTitleInput');
        if (titleInp) titleInp.value = game.gameName;
        const priceInp = document.getElementById('adminGamePriceInput');
        if (priceInp) priceInp.value = game.price;
        const packInp = document.getElementById('adminGamePackSizeInput');
        if (packInp) packInp.value = game.packSize;
        const submitBtn = document.getElementById('btnAdminCatalogSubmit');
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        addGameModal?.showModal();
      });
    });

    tbody.querySelectorAll('.btn-toggle-game').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gameId = btn.dataset.gameId;
        const game = st.catalog.find(g => g.gameId === gameId);
        if (game) {
          await addOrUpdateCatalogGame({ ...game, isActive: !game.isActive }, 'admin');
          renderCatalog();
        }
      });
    });
  }

  function renderRequests() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminRequestsTableBody');
    if (!tbody) return;

    if (st.ticketRequests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color:#94a3b8;">No store ticket requests.</td></tr>';
      return;
    }

    tbody.innerHTML = st.ticketRequests.map(r => {
      let badgeClass = 'pending';
      if (r.status === 'APPROVED') badgeClass = 'approved';
      else if (r.status === 'REJECTED') badgeClass = 'rejected';
      else if (r.status === 'MORE_INFO_REQUIRED') badgeClass = 'more-info';

      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : 'Recent';

      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong style="color:var(--admin-heading-color);">${r.storeName}</strong></td>
          <td><strong style="color:#818cf8;">${r.gameName}</strong></td>
          <td>$${Number(r.price).toFixed(2)}</td>
          <td>${r.requestedBy || 'Owner'}</td>
          <td><span class="badge-status ${badgeClass}">${r.status}</span></td>
          <td style="color:#cbd5e1; font-size:0.82rem;">${r.adminDecisionReason || '—'}</td>
          <td>
            <button type="button" class="btn-action-sm btn-info btn-admin-review-req" data-req-id="${r.id}">Decision</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-admin-review-req').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.reqId;
        openReviewRequestModal(reqId);
      });
    });
  }

  function openReviewRequestModal(reqId) {
    const st = getLocalAdminState();
    const req = st.ticketRequests.find(r => String(r.id) === String(reqId));
    if (!req) return;
    selectedRequestForReview = req;

    document.getElementById('adminRequestModalTitle').textContent = `Review Request · ${req.gameName}`;
    document.getElementById('adminRequestModalDetails').innerHTML = `
      <div style="background:rgba(255,255,255,0.04); padding:14px; border-radius:8px; margin-bottom:12px;">
        <div><strong>Store:</strong> ${req.storeName} (${req.storeId})</div>
        <div><strong>Game:</strong> ${req.gameName} &nbsp;|&nbsp; <strong>Price:</strong> $${req.price} &nbsp;|&nbsp; <strong>Pack Size:</strong> ${req.packSize || 100} tickets</div>
        <div><strong>Requested By:</strong> ${req.requestedBy} &nbsp;|&nbsp; <strong>Current Status:</strong> <span class="badge-status ${req.status.toLowerCase()}">${req.status}</span></div>
        <div style="margin-top:8px; font-size:0.8rem; color:#94a3b8;">* Approving authorizes the store to sell this ticket type. Physical stock is not assigned until stock allocation is recorded.</div>
      </div>
    `;
    const reasonInput = document.getElementById('adminRequestReasonInput');
    if (reasonInput) reasonInput.value = req.adminDecisionReason || '';
    reqModal?.showModal();
  }

  function renderAllocations() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminAllocationsTableBody');
    if (!tbody) return;

    if (st.allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px; color:#94a3b8;">No allocations recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = st.allocations.map(a => `
      <tr>
        <td><span style="font-family:var(--mono); color:#94a3b8;">${a.allocationReference}</span></td>
        <td>${a.allocationDate}</td>
        <td><strong style="color:var(--admin-heading-color);">${a.storeName}</strong></td>
        <td>${a.gameName}</td>
        <td><strong style="font-family:var(--mono); color:#38bdf8;">#${a.packNumber}</strong></td>
        <td>${a.packSize} tix</td>
        <td>$${Number(a.packValue || (a.ticketPrice * a.packSize)).toFixed(2)}</td>
        <td>${a.allocatedBy || 'admin'}</td>
        <td><span class="badge-status ${a.status === 'RECEIVED' ? 'approved' : 'pending'}">${a.status}</span></td>
      </tr>
    `).join('');
  }

  async function renderReports() {
    const reports = await fetchAdminReports();

    // 1. Store Sales
    const tbodySales = document.getElementById('adminReportSalesTableBody');
    if (tbodySales) {
      if (!reports.storesSummary || reports.storesSummary.length === 0) {
        tbodySales.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color:#94a3b8;">No stores recorded.</td></tr>';
      } else {
        tbodySales.innerHTML = reports.storesSummary.map(s => `
          <tr>
            <td><strong style="color:var(--admin-heading-color);">${s.storeName}</strong></td>
            <td><span style="font-family:var(--mono);">${s.retailerNumber || 'GA-Pending'}</span></td>
            <td><span class="badge-status ${s.authorizationStatus === 'APPROVED' ? 'approved' : 'suspended'}">${s.authorizationStatus}</span></td>
            <td>${s.activeBoxes || 0} active</td>
            <td><strong>${s.ticketsSold || 0}</strong></td>
            <td>${Number(s.salesRevenue || 0).toFixed(2)}</td>
            <td style="color:#f87171;">${Number(s.cashes || 0).toFixed(2)}</td>
            <td><strong style="color:${(s.netBalance || 0) >= 0 ? '#34d399' : '#f87171'};">${Number(s.netBalance || 0).toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // 2. Ticket Inventory
    const tbodyInv = document.getElementById('adminReportInventoryTableBody');
    if (tbodyInv) {
      if (!reports.inventorySummary || reports.inventorySummary.length === 0) {
        tbodyInv.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#94a3b8;">No inventory data recorded.</td></tr>';
      } else {
        tbodyInv.innerHTML = reports.inventorySummary.map(inv => `
          <tr>
            <td><strong style="color:var(--admin-heading-color);">${inv.storeName}</strong></td>
            <td>${inv.activeCounterPacks} packs (${Number(inv.activeCounterValue).toFixed(2)})</td>
            <td>${inv.safePacksCount} packs (${Number(inv.safePacksValue).toFixed(2)})</td>
            <td>${inv.storagePacksCount} packs (${Number(inv.storagePacksValue).toFixed(2)})</td>
            <td><strong style="color:#38bdf8;">${inv.totalPacks} packs</strong></td>
            <td><strong style="color:#34d399;">${Number(inv.totalInventoryValue).toFixed(2)}</strong></td>
            <td><span class="badge-status approved">AUDITED</span></td>
          </tr>
        `).join('');
      }
    }

    // 3. Shift Reports
    const tbodyShifts = document.getElementById('adminReportShiftsTableBody');
    if (tbodyShifts) {
      if (!reports.shiftReports || reports.shiftReports.length === 0) {
        tbodyShifts.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px; color:#94a3b8;">No settled shift reports available.</td></tr>';
      } else {
        tbodyShifts.innerHTML = reports.shiftReports.map(sh => `
          <tr>
            <td><strong style="color:var(--admin-heading-color);">${sh.storeName}</strong></td>
            <td><span style="font-family:var(--mono); color:#818cf8;">Shift #${sh.shiftNumber}</span></td>
            <td>${sh.date}</td>
            <td>${sh.cashier}</td>
            <td>${sh.ticketsSold}</td>
            <td>${Number(sh.salesRevenue).toFixed(2)}</td>
            <td style="color:#f87171;">${Number(sh.cashes).toFixed(2)}</td>
            <td>${Number(sh.actualCashCounted).toFixed(2)}</td>
            <td>
              <span style="font-weight:700; color:${sh.drawerOverShort === 0 ? '#34d399' : (sh.drawerOverShort > 0 ? '#38bdf8' : '#f87171')}">
                ${sh.drawerOverShort === 0 ? '$0.00' : (sh.drawerOverShort > 0 ? `+${Number(sh.drawerOverShort).toFixed(2)}` : `-${Math.abs(Number(sh.drawerOverShort)).toFixed(2)}`)}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    // 4. Stock Discrepancies
    const tbodyDisc = document.getElementById('adminReportDiscrepanciesTableBody');
    if (tbodyDisc) {
      if (!reports.discrepancies || reports.discrepancies.length === 0) {
        tbodyDisc.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#34d399;">✓ Zero stock discrepancies detected across all stores.</td></tr>';
      } else {
        tbodyDisc.innerHTML = reports.discrepancies.map(d => `
          <tr>
            <td><strong style="color:var(--admin-heading-color);">${d.storeName}</strong></td>
            <td>Shift #${d.shiftNumber} &middot; ${d.date}</td>
            <td>${d.cashier}</td>
            <td><span class="badge-status ${d.type === 'CASH_OVER_SHORT' ? 'rejected' : 'more-info'}">${d.type}</span></td>
            <td style="font-weight:700; color:${d.varianceAmount < 0 ? '#f87171' : '#fbbf24'};">${d.varianceAmount !== 0 ? (d.varianceAmount > 0 ? `+${Number(d.varianceAmount).toFixed(2)}` : `-${Math.abs(Number(d.varianceAmount)).toFixed(2)}`) : '$0.00'}</td>
            <td><span class="badge-status ${d.auditStatus === 'ATTENTION' ? 'rejected' : 'pending'}">${d.auditStatus}</span></td>
            <td style="font-size:0.82rem; color:#cbd5e1;">${d.description}</td>
          </tr>
        `).join('');
      }
    }
  }

  function renderAudit() {
    const st = getLocalAdminState();
    const listEl = document.getElementById('adminFullAuditTrailList');
    if (!listEl) return;

    if (!st.auditLogs || st.auditLogs.length === 0) {
      listEl.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: var(--admin-text-dim); font-size: 0.88rem;">No audit logs recorded yet.</div>';
      return;
    }

    listEl.innerHTML = st.auditLogs.map(l => {
      let actionClass = 'action-default';
      const aType = (l.actionType || '').toUpperCase();
      if (aType.includes('LOGIN')) actionClass = 'action-login';
      else if (aType.includes('APPROVE')) actionClass = 'action-approve';
      else if (aType.includes('SUSPEND') || aType.includes('REJECT')) actionClass = 'action-danger';
      else if (aType.includes('FEEDBACK')) actionClass = 'action-feedback';

      const timeStr = l.createdAt ? new Date(l.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';

      return `
        <div class="audit-log-item">
          <div class="audit-log-left">
            <span class="audit-action-tag ${actionClass}">${escapeHtml(l.actionType)}</span>
            <span class="audit-target">${escapeHtml(l.targetEntity || '')}${l.targetId ? ' : ' + escapeHtml(l.targetId) : ''}</span>
            <span class="audit-user">by <strong>${escapeHtml(l.adminUsername || 'admin')}</strong></span>
          </div>
          <span class="audit-time">${timeStr}</span>
        </div>
      `;
    }).join('');
  }

  return {
    renderAdminDashboardView: () => {
      renderActiveAdminPane();
    },
    switchAdminTab: (tabKey) => {
      const btn = document.querySelector(`#adminDashboardSubnav [data-admin-tab="${tabKey}"]`);
      if (btn) {
        btn.click();
      } else {
        renderActiveAdminPane();
      }
    }
  };
}
