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
  getAdminHeaders,
  adminLogout,
  fetchAdminFeedback,
  reviewStoreFeedback,
  fetchPaymentGatewayConfig,
  createPaymentCheckoutSession,
  checkoutSubscriptionAndRegister,
  resubmitStoreDocuments,
  fetchStoreAdminDetails,
  verifyStoreDocumentsAndRetailer,
  suspendStoreWithReason,
  reapproveSuspendedStore
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
    try {
      const rawSess = sessionStorage.getItem('lotto_session_user') || localStorage.getItem('lotto_session_user');
      if (rawSess) {
        const parsed = JSON.parse(rawSess);
        parsed.activeView = 'pos';
        parsed.posStoreId = targetStoreId;
        const updated = JSON.stringify(parsed);
        sessionStorage.setItem('lotto_session_user', updated);
        localStorage.setItem('lotto_session_user', updated);
      }
    } catch (_) { }
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

  // Self-Service Store Application & Lottery License Modal setup
  const storeAppModal = document.getElementById('modalStoreApplication');
  const licenseFileInput = document.getElementById('appInputLicenseFiles');
  const licenseDropzone = document.getElementById('appLicenseDropzone');
  const licensePreviewEl = document.getElementById('appLicenseFilesPreview');
  const storeAppFeedbackEl = document.getElementById('storeAppFeedbackAlert');
  let pendingLicenseAttachments = [];

  const ALLOWED_LICENSE_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff',
    '.pdf', '.txt', '.csv',
    '.zip', '.7z', '.rar', '.tar', '.gz',
    '.enc', '.gpg', '.pgp', '.asc', '.p7m', '.p7s'
  ]);
  const ARCHIVE_EXTS = new Set(['.zip', '.7z', '.rar', '.tar', '.gz']);
  const ENCRYPTED_EXTS = new Set(['.enc', '.gpg', '.pgp', '.asc', '.p7m', '.p7s']);

  function getFileExt(name = '') {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
  }

  function setStoreAppAlert(message, isError = false) {
    if (!storeAppFeedbackEl) return;
    if (!message) {
      storeAppFeedbackEl.style.display = 'none';
      storeAppFeedbackEl.textContent = '';
      return;
    }
    storeAppFeedbackEl.style.display = 'block';
    storeAppFeedbackEl.style.background = isError ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)';
    storeAppFeedbackEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)';
    storeAppFeedbackEl.style.color = isError ? '#ef4444' : '#10b981';
    storeAppFeedbackEl.textContent = message;
  }

  function renderPendingLicenseFiles() {
    if (!licensePreviewEl) return;
    if (pendingLicenseAttachments.length === 0) {
      licensePreviewEl.innerHTML = '';
      return;
    }
    licensePreviewEl.innerHTML = pendingLicenseAttachments.map((file, idx) => {
      const sizeKb = Math.max(1, Math.round((file.size || 0) / 1024));
      const ext = getFileExt(file.name);
      const displayLabel = file.relativePath || file.name;
      let thumb = `<span style="font-size:1.15rem;">📄</span>`;
      if (file.mimeType.startsWith('image/')) {
        thumb = `<img src="${file.dataUrl}" alt="${escapeHtml(file.name)}">`;
      } else if (ENCRYPTED_EXTS.has(ext)) {
        thumb = `<span style="font-size:1.15rem;">🔒</span>`;
      } else if (ARCHIVE_EXTS.has(ext)) {
        thumb = `<span style="font-size:1.15rem;">🗜️</span>`;
      }
      const badge = ENCRYPTED_EXTS.has(ext)
        ? ' · Encrypted'
        : (ARCHIVE_EXTS.has(ext) ? ' · Archive' : '');
      return `
        <div class="app-license-file-chip">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            ${thumb}
            <div style="min-width:0;">
              <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(displayLabel)}">${escapeHtml(displayLabel)}</div>
              <div style="font-size:0.72rem; color:var(--admin-text-muted);">${escapeHtml(file.mimeType || ext)} · ${sizeKb} KB${badge}</div>
            </div>
          </div>
          <button type="button" class="btn-action-sm btn-secondary" data-remove-lic-idx="${idx}" style="padding:2px 8px;">Remove</button>
        </div>
      `;
    }).join('');

    licensePreviewEl.querySelectorAll('[data-remove-lic-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.removeLicIdx);
        pendingLicenseAttachments.splice(idx, 1);
        renderPendingLicenseFiles();
      });
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function enqueueLicenseFiles(fileList) {
    setStoreAppAlert('');
    let skipped = [];
    for (const item of fileList) {
      const file = item.file || item;
      const relPath = item.relativePath || file.webkitRelativePath || file.name;
      const base = file.name || '';
      if (!base || base === '.DS_Store' || base === 'Thumbs.db' || base === 'desktop.ini' || relPath.includes('__MACOSX/')) {
        continue;
      }
      const ext = getFileExt(base);
      if (!ALLOWED_LICENSE_EXTS.has(ext)) {
        skipped.push(`${base} (unsupported type)`);
        continue;
      }
      if (pendingLicenseAttachments.length >= 25) {
        setStoreAppAlert('Maximum 25 files per application.', true);
        break;
      }
      if (file.size > 15 * 1024 * 1024) {
        skipped.push(`${base} (>15 MB)`);
        continue;
      }
      const totalExisting = pendingLicenseAttachments.reduce((sum, f) => sum + (f.size || 0), 0);
      if (totalExisting + file.size > 45 * 1024 * 1024) {
        setStoreAppAlert('Total upload size exceeds 45 MB limit.', true);
        break;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        pendingLicenseAttachments.push({
          name: base,
          relativePath: relPath,
          mimeType: file.type || (ARCHIVE_EXTS.has(ext) ? 'application/zip' : ENCRYPTED_EXTS.has(ext) ? 'application/octet-stream' : ''),
          size: file.size,
          isEncrypted: ENCRYPTED_EXTS.has(ext),
          dataUrl
        });
      } catch (err) {
        setStoreAppAlert(err.message, true);
      }
    }
    if (skipped.length > 0) {
      setStoreAppAlert(`Skipped: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? ` (+${skipped.length - 3} more)` : ''}`, true);
    }
    renderPendingLicenseFiles();
  }

  async function collectDroppedEntryFiles(entry, prefix = '') {
    if (!entry) return [];
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          file => resolve([{ file, relativePath: prefix ? `${prefix}/${file.name}` : file.name }]),
          () => resolve([])
        );
      });
    }
    if (entry.isDirectory) {
      const dirPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      const reader = entry.createReader();
      const allEntries = [];
      // readEntries returns chunks up to 100 entries; loop until empty
      while (true) {
        const batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
        if (!batch || batch.length === 0) break;
        allEntries.push(...batch);
      }
      const nested = [];
      for (const child of allEntries) {
        nested.push(...(await collectDroppedEntryFiles(child, dirPrefix)));
      }
      return nested;
    }
    return [];
  }

  document.getElementById('btnPickLicenseFiles')?.addEventListener('click', () => licenseFileInput?.click());

  licenseFileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target?.files || []);
    if (files.length > 0) await enqueueLicenseFiles(files);
    if (licenseFileInput) licenseFileInput.value = '';
  });

  if (licenseDropzone) {
    licenseDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      licenseDropzone.classList.add('drag-over');
    });
    licenseDropzone.addEventListener('dragleave', () => {
      licenseDropzone.classList.remove('drag-over');
    });
    licenseDropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      licenseDropzone.classList.remove('drag-over');
      const items = Array.from(e.dataTransfer?.items || []);
      const collected = [];
      for (const item of items) {
        const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
        if (entry) {
          collected.push(...(await collectDroppedEntryFiles(entry)));
        } else if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) collected.push({ file: f, relativePath: f.name });
        }
      }
      if (collected.length > 0) {
        await enqueueLicenseFiles(collected);
      } else if (e.dataTransfer?.files?.length) {
        await enqueueLicenseFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  const POS_SIGNUP_DRAFT_KEY = 'jackpotlo_pos_signup_draft';

  async function completeLifetimeSignUp({ storeName, storeMobile, email = '', paymentSessionId = '' }) {
    const planId = 'lifetime';
    const billingCycle = 'lifetime';
    let sessionId = paymentSessionId || window.__verifiedCheckoutSessionId || '';
    if (!sessionId) {
      const sessionRes = await createPaymentCheckoutSession(planId, billingCycle);
      if (!sessionRes?.success) {
        setStoreAppAlert(sessionRes?.message || 'Unable to initiate server-verified $179 lifetime payment.', true);
        return false;
      }
      if (sessionRes.checkoutUrl) {
        sessionStorage.setItem(POS_SIGNUP_DRAFT_KEY, JSON.stringify({ storeName, storeMobile, email }));
        window.location.href = sessionRes.checkoutUrl;
        return true;
      }
      sessionId = sessionRes.sessionId || '';
    }

    const data = await checkoutSubscriptionAndRegister({
      planId,
      billingCycle,
      paymentMethodLabel: 'Lifetime $179',
      paymentSessionId: sessionId,
      storeName,
      phone: storeMobile,
      applicantPhone: storeMobile,
      email,
      applicantEmail: email
    });

    if (data.success) {
      sessionStorage.removeItem(POS_SIGNUP_DRAFT_KEY);
      window.history?.replaceState?.({}, document.title, window.location.pathname + (window.location.hash || ''));
      sfx.win?.();
      document.getElementById('formSubmitStoreApp')?.reset();
      storeAppModal?.close();
      if (typeof window.completeStoreLoginSession === 'function' && data.token) {
        await window.completeStoreLoginSession(data);
      } else {
        showToast(data.message || `✓ Lifetime subscription activated for "${storeName}"!`, 'success');
      }
      return true;
    }

    setStoreAppAlert(data.message || 'Failed to activate lifetime subscription.', true);
    showToast(data.message || 'Failed to activate lifetime subscription', 'error');
    return false;
  }

  document.getElementById('btnOpenStoreAppModal')?.addEventListener('click', async () => {
    sfx.keypad?.();
    setStoreAppAlert('');
    storeAppModal?.showModal();
    try {
      const cfg = await fetchPaymentGatewayConfig();
      if (cfg && cfg.configured === false && !cfg.testHarnessEnabled) {
        setStoreAppAlert('Notice: Live payment gateway is not configured on this server (STRIPE_SECRET_KEY missing). Paid subscription checkout requires live gateway configuration.', true);
      }
    } catch (_) { }
  });
  document.getElementById('closeStoreAppModalBtn')?.addEventListener('click', () => storeAppModal?.close());
  document.getElementById('cancelStoreAppBtn')?.addEventListener('click', () => storeAppModal?.close());

  // Resume POS Sign Up after Stripe Checkout redirect
  (async function resumePosSignupFromStripeReturn() {
    const params = new URLSearchParams(window.location.search || '');
    const checkoutSessionId = params.get('checkout_session_id');
    const checkoutCancelled = params.get('checkout_cancelled');
    let draft = null;
    try {
      const raw = sessionStorage.getItem(POS_SIGNUP_DRAFT_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch (_) { }
    if (!draft || (!checkoutSessionId && !checkoutCancelled)) return;

    const storeInput = document.getElementById('appInputStoreName');
    const phoneInput = document.getElementById('appInputPhone');
    const emailInput = document.getElementById('appInputEmail');
    if (storeInput) storeInput.value = draft.storeName || '';
    if (phoneInput) phoneInput.value = draft.storeMobile || '';
    if (emailInput) emailInput.value = draft.email || '';

    if (checkoutCancelled === '1') {
      storeAppModal?.showModal();
      setStoreAppAlert('Payment was cancelled. Complete $179 Lifetime payment to finish Sign Up.', true);
      return;
    }

    if (checkoutSessionId) {
      storeAppModal?.showModal();
      setStoreAppAlert('Verifying $179 lifetime payment and activating your store...', false);
      try {
        await completeLifetimeSignUp({
          storeName: draft.storeName || '',
          storeMobile: draft.storeMobile || '',
          email: draft.email || '',
          paymentSessionId: checkoutSessionId
        });
      } catch (err) {
        setStoreAppAlert('Network error finishing sign up: ' + err.message, true);
      }
    }
  })();

  document.getElementById('formSubmitStoreApp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStoreAppAlert('');
    const storeName = document.getElementById('appInputStoreName')?.value?.trim();
    const ownerName = document.getElementById('appInputOwnerName')?.value?.trim();
    const lotteryRetailerId = document.getElementById('appInputRetailerId')?.value?.trim();
    const businessTaxId = document.getElementById('appInputTaxId')?.value?.trim();
    const licenseExpiry = document.getElementById('appInputLicenseExpiry')?.value?.trim();
    const ownerEmail = document.getElementById('appInputEmail')?.value?.trim();
    const ownerPhone = document.getElementById('appInputPhone')?.value?.trim();
    const address = document.getElementById('appInputAddress')?.value?.trim();
    const requestedUsername = document.getElementById('appInputUsername')?.value?.trim() || '';
    const requestedPassword = document.getElementById('appInputPassword')?.value || '';
    const notesText = document.getElementById('appInputNotes')?.value?.trim();
    const selectedPlan = document.querySelector('input[name="appSubscriptionPlan"]:checked')?.value || 'pro';
    const billingCycle = document.getElementById('appBillingCycle')?.value || 'monthly';
    const paymentMethodLabel = document.getElementById('appInputPaymentCardLast4')?.value?.trim() || 'Stripe Checkout';
    const paymentConfirmed = document.getElementById('appInputPaymentConfirm')?.checked !== false;
    const storeInput = document.getElementById('appInputStoreName');
    const phoneInput = document.getElementById('appInputPhone');
    const emailInput = document.getElementById('appInputEmail');
    const storeName = storeInput?.value?.trim() || '';
    const storeMobile = phoneInput?.value?.trim() || '';
    const email = emailInput?.value?.trim() || '';

    if (requestedPassword && requestedPassword.length < 4) {
      setStoreAppAlert('Store login password must be at least 4 characters.', true);
      if (!storeName) {
        setStoreAppAlert('Store Name is required.', true);
        storeInput?.focus();
        return;
      }
      if (!storeMobile || storeMobile.replace(/\D/g, '').length < 7) {
        setStoreAppAlert('Please enter a valid Store Mobile Number.', true);
        phoneInput?.focus();
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStoreAppAlert('Please enter a valid Email address or leave it blank.', true);
        emailInput?.focus();
        return;
      }

      const submitBtn = document.getElementById('btnSubmitStoreApp');
      if (submitBtn) submitBtn.disabled = true;

      try {
        // Request a server-verified payment session before activating paid subscription & immediate store access
        if (requestedPassword && requestedPassword.length >= 4) {
          if (!paymentConfirmed) {
            setStoreAppAlert('Please confirm subscription payment to activate immediate store access.', true);
            return;
          }
          const urlParams = new URLSearchParams(window.location.search || '');
          let paymentSessionId = urlParams.get('checkout_session_id') || window.__verifiedCheckoutSessionId || '';
          if (!paymentSessionId) {
            const sessionRes = await createPaymentCheckoutSession(selectedPlan, billingCycle);
            if (!sessionRes?.success) {
              setStoreAppAlert(sessionRes?.message || 'Unable to initiate server-verified subscription payment.', true);
              return;
            }
            if (sessionRes.checkoutUrl) {
              window.location.href = sessionRes.checkoutUrl;
              return;
            }
            paymentSessionId = sessionRes.sessionId || '';
          }
          const data = await checkoutSubscriptionAndRegister({
            planId: selectedPlan,
            billingCycle,
            paymentMethodLabel,
            paymentSessionId,
            storeName,
            applicantName: ownerName,
            ownerName,
            retailerId: lotteryRetailerId,
            lotteryRetailerId,
            businessTaxId,
            licenseExpiry,
            email: ownerEmail,
            applicantEmail: ownerEmail,
            phone: ownerPhone,
            applicantPhone: ownerPhone,
            address,
            username: requestedUsername,
            password: requestedPassword,
            documentsUrl: notesText,
            notes: notesText,
            applicantNotes: notesText,
            licenseFiles: pendingLicenseAttachments
          });

          if (data.success) {
            sfx.win?.();
            document.getElementById('formSubmitStoreApp')?.reset();
            pendingLicenseAttachments = [];
            renderPendingLicenseFiles();
            storeAppModal?.close();
            if (typeof window.completeStoreLoginSession === 'function' && data.token) {
              await window.completeStoreLoginSession(data);
            } else {
              showToast(data.message || `✓ Subscription activated for "${storeName}"!`, 'success');
            }
          } else {
            setStoreAppAlert(data.message || 'Failed to activate subscription.', true);
            showToast(data.message || 'Failed to activate subscription', 'error');
          }
          return;
        }

        // Legacy fallback when no password was created on the form
        const res = await fetch('/api/store-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeName,
            ownerName,
            businessNumber: lotteryRetailerId,
            lotteryRetailerId,
            businessTaxId,
            licenseExpiry,
            ownerEmail,
            ownerPhone,
            address,
            requestedPassword,
            documentsUrl: notesText,
            applicantNotes: notesText,
            licenseFiles: pendingLicenseAttachments,
            requestedBy: ownerName
          })
        });
        const data = await res.json();
        if (data.success) {
          sfx.win?.();
          const refId = data.application?.id || '';
          showToast(`✓ License & application for "${storeName}" submitted (Ref #${refId}).`, 'success');
          document.getElementById('formSubmitStoreApp')?.reset();
          pendingLicenseAttachments = [];
          renderPendingLicenseFiles();
          storeAppModal?.close();
        } else {
          setStoreAppAlert(data.message || 'Failed to submit application.', true);
          showToast(data.message || 'Failed to submit application', 'error');
        }
        const urlParams = new URLSearchParams(window.location.search || '');
        const paymentSessionId = urlParams.get('checkout_session_id') || window.__verifiedCheckoutSessionId || '';
        await completeLifetimeSignUp({ storeName, storeMobile, email, paymentSessionId });
      } catch (err) {
        setStoreAppAlert('Network error submitting registration: ' + err.message, true);
        showToast('Network error submitting registration: ' + err.message, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

  // Customer Corrected Documents Resubmission Modal (Works for both active and suspended accounts)
  const resubModal = document.getElementById('modalResubmitDocuments');
  let pendingResubAttachments = [];

  function setResubAlert(msg, isError = false) {
    const el = document.getElementById('resubFeedbackAlert');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)';
    el.style.color = isError ? '#ef4444' : '#059669';
    el.style.border = `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`;
  }

  window.openResubmitDocsModal = ({ identifier = '', suspensionReason = '', retailerNumber = '', isSuspended = true } = {}) => {
    setResubAlert('');
    pendingResubAttachments = [];
    const summary = document.getElementById('resubFilesSummary');
    if (summary) summary.textContent = '';
    const fileInp = document.getElementById('resubInputFiles');
    if (fileInp) fileInp.value = '';
    const credsSec = document.getElementById('resubCredsSection');
    const hasActiveStoreToken = Boolean(sessionStorage.getItem('lotto_store_token') || localStorage.getItem('lotto_store_token'));
    if (credsSec) credsSec.style.display = (!isSuspended && hasActiveStoreToken) ? 'none' : 'grid';

    const idInp = document.getElementById('resubInputIdentifier');
    if (idInp && identifier) idInp.value = identifier;
    const retInp = document.getElementById('resubInputRetailerId');
    if (retInp && retailerNumber) retInp.value = retailerNumber;
    const banner = document.getElementById('resubSuspensionReasonBanner');
    if (banner) {
      if (suspensionReason) {
        banner.style.display = 'block';
        banner.textContent = `Admin Suspension Reason: ${suspensionReason}`;
      } else {
        banner.style.display = 'none';
      }
    }
    resubModal?.showModal();
  };

  document.getElementById('closeResubDocsModalBtn')?.addEventListener('click', () => resubModal?.close());
  document.getElementById('cancelResubDocsBtn')?.addEventListener('click', () => resubModal?.close());
  document.getElementById('btnOpenResubmitDocsModal')?.addEventListener('click', () => {
    const preId = document.getElementById('inputSignInUser')?.value?.trim() || '';
    const preReason = window.__lastSuspensionDetail?.suspensionReason || '';
    window.openResubmitDocsModal({ identifier: preId, suspensionReason: preReason, isSuspended: true });
  });
  document.getElementById('btnOpenPosResubmitDocs')?.addEventListener('click', () => {
    let sess = null;
    try { sess = JSON.parse(sessionStorage.getItem('lotto_session_user') || 'null'); } catch (_) { }
    window.openResubmitDocsModal({
      identifier: sess?.email || sess?.username || '',
      retailerNumber: sess?.retailerNumber || '',
      isSuspended: false
    });
  });

  document.getElementById('resubInputFiles')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target?.files || []);
    pendingResubAttachments = [];
    for (const f of files.slice(0, 15)) {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        pendingResubAttachments.push({
          name: f.name,
          relativePath: f.webkitRelativePath || f.name,
          mimeType: f.type || '',
          size: f.size,
          dataUrl
        });
      } catch (_) { }
    }
    const summary = document.getElementById('resubFilesSummary');
    if (summary) {
      summary.textContent = pendingResubAttachments.length > 0
        ? `${pendingResubAttachments.length} file(s) staged: ${pendingResubAttachments.map(f => f.name).join(', ')}`
        : '';
    }
  });

  document.getElementById('formResubmitDocuments')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setResubAlert('');
    const identifier = document.getElementById('resubInputIdentifier')?.value?.trim() || '';
    const password = document.getElementById('resubInputPassword')?.value || '';
    const retailerId = document.getElementById('resubInputRetailerId')?.value?.trim() || '';
    const licenseExpiry = document.getElementById('resubInputLicenseExpiry')?.value?.trim() || '';
    const notes = document.getElementById('resubInputNotes')?.value?.trim() || '';

    const btn = document.getElementById('btnSubmitResubmission');
    if (btn) btn.disabled = true;
    try {
      const data = await resubmitStoreDocuments({
        identifier,
        password,
        retailerId,
        licenseExpiry,
        notes,
        licenseFiles: pendingResubAttachments
      });
      if (data.success) {
        sfx.win?.();
        setResubAlert(data.message || 'Corrected documents submitted for Admin review.');
        showToast(data.message || 'Corrected documents submitted for Admin review.', 'success');
        if (typeof window.refreshStoreComplianceStatus === 'function') {
          window.refreshStoreComplianceStatus();
        }
      } else {
        setResubAlert(data.message || 'Failed to submit corrected documents.', true);
      }
    } catch (err) {
      setResubAlert('Network error: ' + err.message, true);
    } finally {
      if (btn) btn.disabled = false;
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
    if (typeof window.signOutUser === 'function') {
      window.signOutUser();
      return;
    }
    sessionStorage.clear();
    localStorage.setItem('lotto_signed_out', 'true');
    localStorage.removeItem('lotto_session_user');
    localStorage.removeItem('lotto_admin_token');
    localStorage.removeItem('lotto_store_token');
    localStorage.removeItem('lotto_current_store_id');
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
  let activeLicenseBlobUrl = null;
  function revokeLicensePreviewUrl() {
    if (activeLicenseBlobUrl) {
      try { URL.revokeObjectURL(activeLicenseBlobUrl); } catch (_) { }
      activeLicenseBlobUrl = null;
    }
  }
  function closeReviewAppModal() {
    revokeLicensePreviewUrl();
    appModal?.close();
  }
  document.getElementById('closeAdminAppModalBtn')?.addEventListener('click', closeReviewAppModal);
  appModal?.addEventListener('close', revokeLicensePreviewUrl);

  async function handleApplicationDecision(decision) {
    if (!selectedAppForReview) return;
    const notes = document.getElementById('adminAppNotesInput')?.value || '';
    const retailerValidChecked = Boolean(document.getElementById('adminAppVerifyRetailerValid')?.checked);
    const extra = decision === 'APPROVE' && retailerValidChecked
      ? { confirmOfficialRetailerValid: true, retailerAuthStatus: 'VALID' }
      : {};
    const res = await reviewStoreApplication(selectedAppForReview.id, decision, 'admin', notes, extra);
    if (!res.success) {
      showToast(res.message || 'Failed to update application.', 'error');
      return;
    }
    if (decision === 'APPROVE') {
      sfx.win?.();
      const creds = res.credentials;
      const loginInfo = creds
        ? ` Login ID: ${creds.username}${creds.temporaryPassword ? ` · Temp Pass: ${creds.temporaryPassword}` : ' (Applicant password active)'}`
        : '';
      showToast(`✓ Approved "${selectedAppForReview.storeName}".${loginInfo}`, 'success');
    } else if (decision === 'REJECT') {
      showToast(`Store application for "${selectedAppForReview.storeName}" rejected.`, 'info');
    } else {
      showToast('Requested more information from applicant.', 'info');
    }
    closeReviewAppModal();
    renderActiveAdminPane();
  }

  document.getElementById('btnAdminAppApprove')?.addEventListener('click', () => handleApplicationDecision('APPROVE'));
  document.getElementById('btnAdminAppReject')?.addEventListener('click', () => handleApplicationDecision('REJECT'));
  document.getElementById('btnAdminAppRequestInfo')?.addEventListener('click', () => handleApplicationDecision('MORE_INFO'));

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
      if (['overview', 'applications', 'stores', 'feedback', 'audit'].includes(sub)) {
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

      const filesArr = Array.isArray(a.licenseFiles) ? a.licenseFiles : [];
      const attachedCount = filesArr.length;
      const hasFolder = filesArr.some(f => f.relativePath && f.relativePath.includes('/'));
      const hasZip = filesArr.some(f => f.isArchive || (f.ext || '').toLowerCase() === '.zip');
      const hasEnc = filesArr.some(f => f.isEncrypted);
      const tagIcons = [hasFolder ? '📁' : '', hasZip ? '🗜️' : '', hasEnc ? '🔒' : ''].filter(Boolean).join('');
      const docSummary = attachedCount > 0
        ? `<span style="font-family:var(--mono); font-size:0.75rem; color:var(--admin-primary); font-weight:600; white-space:nowrap;">${tagIcons || '📎'} ${attachedCount} File${attachedCount > 1 ? 's' : ''}</span>`
        : (Array.isArray(a.documents) && a.documents.length > 0
          ? `<span style="font-size:0.75rem; color:var(--admin-text-muted); display:inline-block; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(a.documents.join(', '))}">📄 ${escapeHtml(a.documents[0])}${a.documents.length > 1 ? ` (+${a.documents.length - 1})` : ''}</span>`
          : '');

      const expiryBadge = a.licenseExpiry
        ? `<div style="font-size:0.72rem; color:var(--admin-text-muted);">Exp: ${escapeHtml(a.licenseExpiry)}</div>`
        : '';

      return `
        <tr>
          <td style="max-width:190px; white-space:normal; word-break:break-word;">
            <strong style="color:var(--admin-heading-color);">${escapeHtml(a.storeName)}</strong>
            <div style="font-size:0.72rem; color:var(--admin-text-muted); max-width:185px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(a.address || a.storeId || '')}</div>
          </td>
          <td style="max-width:140px; white-space:normal; word-break:break-word;">
            <div>${escapeHtml(a.applicantName)}</div>
            <div style="font-size:0.72rem; color:var(--admin-text-muted); font-family:var(--mono);">${escapeHtml(a.ownerUsername || '')}</div>
          </td>
          <td style="max-width:170px; white-space:normal; word-break:break-word;">
            <div>${escapeHtml(a.applicantPhone || '—')}</div>
            <div style="font-size:0.72rem; color:var(--admin-text-muted);">${escapeHtml(a.applicantEmail || '')}</div>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-family:var(--mono); font-weight:600;">${escapeHtml(a.lotteryRetailerId || 'N/A')}</div>
            <div style="font-size:0.72rem; color:var(--admin-text-muted); font-family:var(--mono);">${escapeHtml(a.businessTaxId || '')}</div>
            ${expiryBadge}
          </td>
          <td>${docSummary || '<span style="color:var(--admin-text-muted); font-size:0.76rem;">No file</span>'}</td>
          <td><span class="badge-status ${badgeClass}">${escapeHtml(a.status)}</span></td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn-action-sm btn-info btn-review-app" data-app-id="${escapeHtml(a.id)}">Review License</button>
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

  function renderBlobIntoViewport(viewport, blob, mimeType, titleName) {
    activeLicenseBlobUrl = URL.createObjectURL(blob);
    if (mimeType.startsWith('image/')) {
      viewport.innerHTML = `<img src="${activeLicenseBlobUrl}" alt="${escapeHtml(titleName)}">`;
    } else if (mimeType === 'application/pdf') {
      viewport.innerHTML = `<iframe src="${activeLicenseBlobUrl}" title="${escapeHtml(titleName)}"></iframe>`;
    } else if (mimeType.startsWith('text/')) {
      blob.text().then(txt => {
        viewport.innerHTML = `<pre style="width:100%; height:100%; margin:0; padding:12px; overflow:auto; text-align:left; font-size:0.8rem; color:var(--admin-text-main); white-space:pre-wrap; word-break:break-word;">${escapeHtml(txt.slice(0, 50000))}</pre>`;
      });
    } else {
      viewport.innerHTML = `<div style="text-align:center; color:var(--admin-text-muted);">Binary file loaded. Click <strong>Open / Download</strong> above to save it.</div>`;
    }
    return activeLicenseBlobUrl;
  }

  async function loadZipEntryPreview(app, fileMeta, entry) {
    const fileNameEl = document.getElementById('adminDocViewerFileName');
    const downloadBtn = document.getElementById('adminDocViewerDownloadBtn');
    const viewport = document.getElementById('adminDocViewerViewport');
    if (!viewport) return;

    revokeLicensePreviewUrl();
    if (fileNameEl) fileNameEl.textContent = `${fileMeta.name} → ${entry.name}`;
    viewport.innerHTML = `<div style="color:var(--admin-text-muted); font-size:0.86rem;">Extracting ZIP entry...</div>`;

    try {
      const headers = getAdminHeaders();
      delete headers['Content-Type'];
      const url = `/api/admin/applications/${encodeURIComponent(app.id)}/files/${encodeURIComponent(fileMeta.storedName)}?entry=${encodeURIComponent(entry.name)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const mime = entry.mimeType || res.headers.get('content-type') || 'application/octet-stream';
      const blobUrl = renderBlobIntoViewport(viewport, blob, mime, entry.name);
      if (downloadBtn) {
        downloadBtn.href = blobUrl;
        downloadBtn.download = entry.name.split('/').pop() || entry.name;
        downloadBtn.style.display = 'inline-flex';
      }
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'btn-action-sm btn-secondary';
      backBtn.textContent = '← Back to ZIP Contents';
      backBtn.style.cssText = 'position:absolute; top:10px; left:10px; z-index:5;';
      backBtn.addEventListener('click', () => loadLicenseFilePreview(app, fileMeta));
      viewport.appendChild(backBtn);
    } catch (err) {
      viewport.innerHTML = `
        <div style="text-align:center; padding:20px; color:var(--admin-text-muted);">
          <div style="font-size:1.5rem; margin-bottom:8px;">🔒</div>
          <div style="color:#ef4444; font-weight:600; margin-bottom:10px;">${escapeHtml(err.message)}</div>
          <button type="button" id="btnBackToZipList" class="btn-action-sm btn-secondary">← Back to ZIP Contents</button>
        </div>
      `;
      document.getElementById('btnBackToZipList')?.addEventListener('click', () => loadLicenseFilePreview(app, fileMeta));
    }
  }

  async function loadLicenseFilePreview(app, fileMeta) {
    const fileNameEl = document.getElementById('adminDocViewerFileName');
    const downloadBtn = document.getElementById('adminDocViewerDownloadBtn');
    const viewport = document.getElementById('adminDocViewerViewport');
    if (!viewport) return;

    revokeLicensePreviewUrl();
    if (downloadBtn) downloadBtn.style.display = 'none';

    if (!fileMeta) {
      if (fileNameEl) fileNameEl.textContent = 'License Preview';
      const urlHtml = (app.documentsUrl && /^https?:\/\//i.test(app.documentsUrl))
        ? `<p style="margin-top:8px;"><a href="${escapeHtml(app.documentsUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--admin-primary); text-decoration:underline;">Open External License Link ↗</a></p>`
        : '';
      const legacyDocs = Array.isArray(app.documents) && app.documents.length > 0
        ? `<div style="margin-top:8px; font-size:0.8rem; color:var(--admin-text-main);">Listed items: ${app.documents.map(d => escapeHtml(d)).join(', ')}</div>`
        : '';
      viewport.innerHTML = `
        <div style="text-align:center; padding:24px; color:var(--admin-text-muted);">
          <div style="font-size:2rem; margin-bottom:8px;">📄</div>
          <div style="font-weight:600; color:var(--admin-heading-color);">No Uploaded License Image or PDF</div>
          ${legacyDocs}
          ${urlHtml}
        </div>
      `;
      return;
    }

    const sizeKb = Math.max(1, Math.round((fileMeta.size || 0) / 1024));
    const displayPath = fileMeta.relativePath || fileMeta.name;
    if (fileNameEl) fileNameEl.textContent = `${displayPath} (${sizeKb} KB)`;
    viewport.innerHTML = `<div style="color:var(--admin-text-muted); font-size:0.86rem;">Loading license document...</div>`;

    try {
      const headers = getAdminHeaders();
      delete headers['Content-Type'];
      const fileUrl = `/api/admin/applications/${encodeURIComponent(app.id)}/files/${encodeURIComponent(fileMeta.storedName)}`;
      const res = await fetch(fileUrl, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (downloadBtn) {
        downloadBtn.href = blobUrl;
        downloadBtn.download = fileMeta.name || fileMeta.storedName;
        downloadBtn.style.display = 'inline-flex';
      }

      const ext = (fileMeta.ext || getFileExt(fileMeta.name)).toLowerCase();
      if (ext === '.zip' || fileMeta.mimeType === 'application/zip') {
        activeLicenseBlobUrl = blobUrl;
        let entries = Array.isArray(fileMeta.zipEntries) ? fileMeta.zipEntries : null;
        if (!entries) {
          const zRes = await fetch(`${fileUrl}?inspect=zip`, { headers });
          const zData = await zRes.json().catch(() => null);
          if (zData?.success) entries = zData.entries;
        }
        if (entries && entries.length > 0) {
          viewport.innerHTML = `
            <div class="admin-zip-entry-list">
              <div style="font-size:0.78rem; font-weight:700; color:var(--admin-text-muted); text-transform:uppercase; letter-spacing:0.04em;">
                🗜️ ZIP Archive Contents (${entries.length} file${entries.length > 1 ? 's' : ''})
              </div>
              ${entries.map((entry, idx) => {
            const eSizeKb = Math.max(1, Math.round((entry.size || 0) / 1024));
            const canPreview = !entry.encrypted && (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.pdf', '.txt', '.csv'].includes((entry.ext || '').toLowerCase()));
            return `
                  <div class="admin-zip-entry-row">
                    <div style="min-width:0; text-align:left;">
                      <div style="font-weight:600; color:var(--admin-heading-color); word-break:break-word;">${entry.encrypted ? '🔒 ' : '📄 '}${escapeHtml(entry.name)}</div>
                      <div style="font-size:0.72rem; color:var(--admin-text-muted);">${eSizeKb} KB${entry.encrypted ? ' · Password-encrypted entry' : ''}</div>
                    </div>
                    ${canPreview ? `<button type="button" class="btn-action-sm btn-info" data-zip-entry-idx="${idx}">Preview</button>` : `<span style="font-size:0.72rem; color:var(--admin-text-muted);">${entry.encrypted ? 'Encrypted' : 'Download ZIP'}</span>`}
                  </div>
                `;
          }).join('')}
            </div>
          `;
          viewport.querySelectorAll('[data-zip-entry-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
              const entry = entries[Number(btn.dataset.zipEntryIdx)];
              if (entry) loadZipEntryPreview(app, fileMeta, entry);
            });
          });
          return;
        }
      }

      if (fileMeta.isEncrypted || ENCRYPTED_EXTS.has(ext) || ['.7z', '.rar', '.tar', '.gz'].includes(ext)) {
        activeLicenseBlobUrl = blobUrl;
        const passHint = app.archivePassword
          ? `<div style="margin-top:10px; font-size:0.82rem;">Provided File Password: <code style="background:var(--admin-bg-surface); padding:2px 6px; border-radius:4px;">${escapeHtml(app.archivePassword)}</code></div>`
          : '';
        viewport.innerHTML = `
          <div style="text-align:center; padding:24px; color:var(--admin-text-muted); max-width:420px;">
            <div style="font-size:2.2rem; margin-bottom:8px;">${fileMeta.isEncrypted ? '🔒' : '🗜️'}</div>
            <div style="font-weight:700; color:var(--admin-heading-color); font-size:0.95rem;">
              ${fileMeta.isEncrypted ? 'Encrypted License Container' : 'Compressed Archive File'}
            </div>
            <div style="font-size:0.8rem; margin-top:6px;">
              Format: <code>${escapeHtml(ext || fileMeta.mimeType)}</code> · Size: ${sizeKb} KB
            </div>
            ${fileMeta.sha256 ? `<div style="font-size:0.7rem; margin-top:6px; font-family:var(--mono); word-break:break-all;">SHA-256: ${escapeHtml(fileMeta.sha256)}</div>` : ''}
            ${passHint}
            <div style="margin-top:12px; font-size:0.78rem;">Use <strong>Open / Download</strong> in the toolbar to download and open/decrypt locally.</div>
          </div>
        `;
        return;
      }

      URL.revokeObjectURL(blobUrl);
      const renderedUrl = renderBlobIntoViewport(viewport, blob, fileMeta.mimeType || 'application/octet-stream', fileMeta.name);
      if (downloadBtn) downloadBtn.href = renderedUrl;
    } catch (err) {
      viewport.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:0.85rem;">Unable to load file preview (${escapeHtml(err.message)}).</div>`;
    }
  }

  function openReviewAppModal(appId) {
    const st = getLocalAdminState();
    const app = st.applications.find(a => String(a.id) === String(appId));
    if (!app) return;
    selectedAppForReview = app;

    const statusLower = String(app.status || 'PENDING').toLowerCase().replace(/_/g, '-');
    const submittedAt = app.createdAt ? new Date(app.createdAt).toLocaleString() : 'Unknown';
    const reviewedAtStr = app.reviewedAt ? new Date(app.reviewedAt).toLocaleString() : null;
    const safeExtUrl = (app.documentsUrl && /^https?:\/\//i.test(app.documentsUrl)) ? app.documentsUrl : '';

    const historyHtml = Array.isArray(app.reviewHistory) && app.reviewHistory.length > 0
      ? app.reviewHistory.slice(0, 5).map(h => `
          <div style="font-size:0.78rem; padding:6px 0; border-top:1px solid var(--admin-border-subtle);">
            <strong>${escapeHtml(h.status)}</strong> by <code>${escapeHtml(h.reviewedBy || 'admin')}</code>
            <span style="color:var(--admin-text-muted);">· ${h.reviewedAt ? escapeHtml(new Date(h.reviewedAt).toLocaleString()) : ''}</span>
            ${h.notes ? `<div style="color:var(--admin-text-main); margin-top:2px;">${escapeHtml(h.notes)}</div>` : ''}
          </div>
        `).join('')
      : (reviewedAtStr ? `<div style="font-size:0.78rem; color:var(--admin-text-muted);">Last reviewed by ${escapeHtml(app.reviewedBy || 'admin')} at ${escapeHtml(reviewedAtStr)}</div>` : '<div style="font-size:0.78rem; color:var(--admin-text-muted);">Not yet reviewed.</div>');

    document.getElementById('adminAppModalTitle').textContent = `Review License · ${app.storeName || ''}`;
    const subtitleEl = document.getElementById('adminAppModalSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Application Ref #${app.id} · Submitted ${submittedAt}`;

    document.getElementById('adminAppModalContent').innerHTML = `
      <div class="admin-review-section">
        <div class="admin-review-section-title">Store &amp; Owner Profile</div>
        <div class="admin-review-kv-grid">
          <div><div class="admin-review-kv-label">Store Name</div><div class="admin-review-kv-val">${escapeHtml(app.storeName)}</div></div>
          <div><div class="admin-review-kv-label">Assigned Store ID</div><div class="admin-review-kv-val" style="font-family:var(--mono);">${escapeHtml(app.storeId || 'Pending')}</div></div>
          <div><div class="admin-review-kv-label">Owner / Applicant</div><div class="admin-review-kv-val">${escapeHtml(app.applicantName)}</div></div>
          <div><div class="admin-review-kv-label">Login Username</div><div class="admin-review-kv-val" style="font-family:var(--mono);">${escapeHtml(app.ownerUsername || 'Auto-assigned')}</div></div>
          <div><div class="admin-review-kv-label">Email Address</div><div class="admin-review-kv-val">${escapeHtml(app.applicantEmail || 'N/A')}</div></div>
          <div><div class="admin-review-kv-label">Phone Number</div><div class="admin-review-kv-val">${escapeHtml(app.applicantPhone || 'N/A')}</div></div>
        </div>
        <div style="margin-top:10px;">
          <div class="admin-review-kv-label">Physical Street Address</div>
          <div class="admin-review-kv-val">${escapeHtml(app.address || 'N/A')}</div>
        </div>
        ${app.subscription ? `<div style="margin-top:8px; padding:8px; border-radius:6px; background:rgba(16,185,129,0.08); font-size:0.8rem;">Subscription: <strong>${escapeHtml(app.subscription.planName)}</strong> ($${Number(app.subscription.amountPaid || 0).toFixed(2)} ${escapeHtml(app.subscription.billingCycle || '')}) · Payment Ref: <span style="font-family:var(--mono);">${escapeHtml(app.subscription.paymentRef || '')}</span></div>` : ''}
      </div>

      <div class="admin-review-section">
        <div class="admin-review-section-title">Lottery License &amp; Business Credentials</div>
        <div class="admin-review-kv-grid">
          <div><div class="admin-review-kv-label">Lottery License # / Retailer ID</div><div class="admin-review-kv-val" style="font-family:var(--mono);">${escapeHtml(app.lotteryRetailerId || 'N/A')}</div></div>
          <div><div class="admin-review-kv-label">Business Tax ID / FEIN</div><div class="admin-review-kv-val" style="font-family:var(--mono);">${escapeHtml(app.businessTaxId || 'N/A')}</div></div>
          <div><div class="admin-review-kv-label">License Expiration Date</div><div class="admin-review-kv-val">${escapeHtml(app.licenseExpiry || 'Not specified')}</div></div>
          <div><div class="admin-review-kv-label">Current Status</div><div><span class="badge-status ${statusLower}">${escapeHtml(app.status)}</span></div></div>
        </div>
        ${app.archivePassword ? `<div style="margin-top:10px;"><div class="admin-review-kv-label">Archive / File Encryption Password</div><div class="admin-review-kv-val" style="font-family:var(--mono);">🔒 ${escapeHtml(app.archivePassword)}</div></div>` : ''}
        ${app.applicantNotes ? `<div style="margin-top:10px;"><div class="admin-review-kv-label">Applicant Notes / Declaration</div><div style="font-size:0.84rem; white-space:pre-wrap; margin-top:2px;">${escapeHtml(app.applicantNotes)}</div></div>` : ''}
        ${safeExtUrl ? `<div style="margin-top:8px;"><a href="${escapeHtml(safeExtUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--admin-primary); font-size:0.82rem; text-decoration:underline;">External Document Link ↗</a></div>` : ''}
      </div>

      <div class="admin-review-section">
        <div class="admin-review-section-title">Review History</div>
        ${historyHtml}
      </div>
    `;

    const notesInput = document.getElementById('adminAppNotesInput');
    if (notesInput) notesInput.value = app.adminNotes || '';
    const retValidChk = document.getElementById('adminAppVerifyRetailerValid');
    if (retValidChk) retValidChk.checked = app.retailerAuthStatus === 'VALID';

    const files = Array.isArray(app.licenseFiles) ? app.licenseFiles : [];
    const switcher = document.getElementById('adminAppLicenseSwitcher');
    if (switcher) {
      if (files.length > 0) {
        switcher.innerHTML = files.map((f, idx) => {
          const icon = f.isEncrypted ? '🔒' : (f.isArchive ? '🗜️' : (f.relativePath && f.relativePath.includes('/') ? '📁' : '📄'));
          return `
            <button type="button" class="admin-license-tab ${idx === 0 ? 'active' : ''}" data-lic-idx="${idx}" title="${escapeHtml(f.relativePath || f.name)}">
              ${icon} ${escapeHtml(f.relativePath || f.name)}
            </button>
          `;
        }).join('');
        switcher.querySelectorAll('.admin-license-tab').forEach(btn => {
          btn.addEventListener('click', () => {
            switcher.querySelectorAll('.admin-license-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadLicenseFilePreview(app, files[Number(btn.dataset.licIdx)]);
          });
        });
      } else {
        switcher.innerHTML = '';
      }
    }

    loadLicenseFilePreview(app, files[0] || null);
    appModal?.showModal();
  }

  const storeCtrlModal = document.getElementById('adminStoreControlModal');
  document.getElementById('closeAdminStoreCtrlModalBtn')?.addEventListener('click', () => storeCtrlModal?.close());

  async function openStoreControlModal(storeId) {
    const titleEl = document.getElementById('adminStoreCtrlTitle');
    const subEl = document.getElementById('adminStoreCtrlSubtitle');
    const bodyEl = document.getElementById('adminStoreCtrlBody');
    if (!bodyEl) return;

    bodyEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--admin-text-muted);">Loading store compliance &amp; audit details...</div>';
    storeCtrlModal?.showModal();

    const detailsRes = await fetchStoreAdminDetails(storeId);
    if (!detailsRes.success || !detailsRes.store) {
      bodyEl.innerHTML = `<div style="color:#ef4444; padding:12px;">${escapeHtml(detailsRes.message || 'Could not load store details.')}</div>`;
      return;
    }
    const s = detailsRes.store;
    const app = detailsRes.application;
    const sub = s.subscription || {};
    const users = detailsRes.users || [];
    const logs = detailsRes.auditHistory || [];
    const isSuspended = s.softwareAccessStatus === 'SUSPENDED' || s.authorizationStatus === 'SUSPENDED';

    if (titleEl) titleEl.textContent = `${s.storeName} (${s.storeId})`;
    if (subEl) subEl.textContent = `Retailer #: ${s.retailerNumber || 'N/A'} · Tax ID: ${s.taxId || 'N/A'} · Address: ${s.address || 'N/A'}`;

    const auditRowsHtml = logs.length > 0
      ? logs.slice(0, 15).map(l => `
          <div style="display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid rgba(148,163,184,0.16); font-size:0.78rem;">
            <div>
              <strong>${escapeHtml(l.actionType)}</strong>
              <span style="color:var(--admin-text-muted);"> by ${escapeHtml(l.adminUsername || 'system')}</span>
              ${l.details?.reason ? `<div style="color:#ef4444;">Reason: ${escapeHtml(l.details.reason)}</div>` : ''}
            </div>
            <span style="color:var(--admin-text-muted); white-space:nowrap;">${l.createdAt ? new Date(l.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
          </div>
        `).join('')
      : '<div style="color:var(--admin-text-muted); font-size:0.78rem;">No audit entries recorded yet.</div>';

    bodyEl.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
        <div style="padding:8px 10px; border-radius:8px; background:rgba(148,163,184,0.08);">
          <div style="font-size:0.72rem; color:var(--admin-text-muted);">Subscription</div>
          <span class="badge-status ${s.subscriptionStatus === 'ACTIVE' ? 'approved' : 'suspended'}">${escapeHtml(s.subscriptionStatus)}</span>
        </div>
        <div style="padding:8px 10px; border-radius:8px; background:rgba(148,163,184,0.08);">
          <div style="font-size:0.72rem; color:var(--admin-text-muted);">Documents</div>
          <span class="badge-status ${s.documentStatus === 'APPROVED' ? 'approved' : (s.documentStatus === 'ACTION_REQUIRED' || s.documentStatus === 'REJECTED' ? 'rejected' : 'pending')}">${escapeHtml(s.documentStatus)}</span>
        </div>
        <div style="padding:8px 10px; border-radius:8px; background:rgba(148,163,184,0.08);">
          <div style="font-size:0.72rem; color:var(--admin-text-muted);">Retailer Auth</div>
          <span class="badge-status ${s.retailerAuthStatus === 'VALID' ? 'approved' : (s.retailerAuthStatus === 'INVALID' ? 'rejected' : 'pending')}">${escapeHtml(s.retailerAuthStatus)}</span>
        </div>
        <div style="padding:8px 10px; border-radius:8px; background:rgba(148,163,184,0.08);">
          <div style="font-size:0.72rem; color:var(--admin-text-muted);">Software Access</div>
          <span class="badge-status ${isSuspended ? 'suspended' : 'active'}">${escapeHtml(s.softwareAccessStatus)}</span>
        </div>
      </div>

      ${isSuspended && s.suspensionReason ? `<div style="padding:10px 12px; border-radius:8px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); color:#ef4444;"><strong>Active Suspension Reason:</strong> ${escapeHtml(s.suspensionReason)} <div style="font-size:0.75rem; margin-top:2px;">Suspended at ${s.suspendedAt ? new Date(s.suspendedAt).toLocaleString() : ''} by ${escapeHtml(s.suspendedBy || 'admin')}</div></div>` : ''}

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="admin-review-section" style="margin:0;">
          <div class="admin-review-section-title">Subscription &amp; Payment Details</div>
          <div>Plan: <strong>${escapeHtml(sub.planName || 'Standard')}</strong> (${escapeHtml(sub.billingCycle || 'monthly')})</div>
          <div>Amount: <strong>$${Number(sub.amountPaid || 0).toFixed(2)} ${escapeHtml(sub.currency || 'USD')}</strong> · ${escapeHtml(sub.paymentMethodLabel || 'On File')}</div>
          <div style="font-family:var(--mono); font-size:0.78rem; color:var(--admin-text-muted);">Ref: ${escapeHtml(sub.paymentRef || 'LEGACY')} ${sub.paidAt ? '· ' + new Date(sub.paidAt).toLocaleString() : ''}</div>
          <div style="margin-top:6px;">Registered Accounts: ${users.map(u => `<span style="font-family:var(--mono); font-size:0.78rem;">${escapeHtml(u.username)} (${escapeHtml(u.email || '')})</span>`).join(', ') || escapeHtml(s.ownerUsername || '')}</div>
        </div>

        <div class="admin-review-section" style="margin:0;">
          <div class="admin-review-section-title">Submitted &amp; Corrected Documents</div>
          <div>Files on record: <strong>${app ? (app.licenseFiles?.length || app.documents?.length || 0) : 0}</strong>${app?.resubmissionCount ? ` · <span class="badge-status pending">Resubmitted ${app.resubmissionCount}x</span>` : ''}</div>
          ${app?.applicantNotes ? `<div style="font-size:0.78rem; margin-top:4px; color:var(--admin-text-muted);">Latest Note: ${escapeHtml(app.applicantNotes)}</div>` : ''}
          ${app ? `<button type="button" id="btnCtrlInspectAppDocs" class="btn-action-sm btn-secondary" style="margin-top:8px;">Open Full Document &amp; License Viewer</button>` : ''}
        </div>
      </div>

      <div class="admin-review-section" style="margin:0;">
        <div class="admin-review-section-title">Document &amp; Official Retailer Authorization Review (Separate from Subscription)</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
          <div>
            <label class="admin-form-label">Document Verification Status</label>
            <select id="ctrlSelectDocStatus" class="admin-form-select">
              <option value="PENDING_REVIEW" ${s.documentStatus === 'PENDING_REVIEW' ? 'selected' : ''}>PENDING_REVIEW</option>
              <option value="APPROVED" ${s.documentStatus === 'APPROVED' ? 'selected' : ''}>APPROVED</option>
              <option value="ACTION_REQUIRED" ${s.documentStatus === 'ACTION_REQUIRED' ? 'selected' : ''}>ACTION_REQUIRED</option>
              <option value="REJECTED" ${s.documentStatus === 'REJECTED' ? 'selected' : ''}>REJECTED</option>
            </select>
          </div>
          <div>
            <label class="admin-form-label">Official Lottery Retailer Authorization</label>
            <select id="ctrlSelectRetailerAuth" class="admin-form-select">
              <option value="PENDING_VERIFICATION" ${s.retailerAuthStatus === 'PENDING_VERIFICATION' ? 'selected' : ''}>PENDING_VERIFICATION (Sales Locked)</option>
              <option value="VALID" ${s.retailerAuthStatus === 'VALID' ? 'selected' : ''}>VALID (Official License Confirmed)</option>
              <option value="INVALID" ${s.retailerAuthStatus === 'INVALID' ? 'selected' : ''}>INVALID (Sales Locked)</option>
              <option value="SUSPENDED" ${s.retailerAuthStatus === 'SUSPENDED' ? 'selected' : ''}>SUSPENDED</option>
            </select>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="text" id="ctrlVerifyNotesInput" class="admin-form-input" value="${escapeHtml(s.adminNotes || '')}" placeholder="Verification / retailer authority confirmation notes...">
          <button type="button" id="btnCtrlSaveVerification" class="btn-action-sm btn-approve" style="white-space:nowrap;">Save Verification</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="admin-review-section" style="margin:0; border-color:rgba(239,68,68,0.35);">
          <div class="admin-review-section-title" style="color:#ef4444;">Suspend Store &amp; Revoke Access</div>
          <textarea id="adminSuspendReasonInput" class="admin-form-input" rows="2" placeholder="Required reason (shown to customer, sessions revoked immediately)..."></textarea>
          <button type="button" id="btnAdminConfirmSuspend" class="btn-action-sm btn-suspend" style="margin-top:8px;">Suspend Store</button>
        </div>
        <div class="admin-review-section" style="margin:0; border-color:rgba(16,185,129,0.35);">
          <div class="admin-review-section-title" style="color:#10b981;">Reapprove Store &amp; Restore Access</div>
          <div style="font-size:0.75rem; color:var(--admin-text-muted); margin-bottom:6px;">Checks: Subscription ACTIVE &amp; Official Retailer Auth VALID &amp; Docs Approved</div>
          <input type="text" id="adminReapproveNotesInput" class="admin-form-input" placeholder="Reapproval decision notes...">
          <label style="display:flex; align-items:center; gap:6px; font-size:0.76rem; margin-top:6px;">
            <input type="checkbox" id="adminReapproveConfirmDocs" ${s.documentStatus === 'APPROVED' ? 'checked' : ''}>
            <span>Confirm corrected documents resolved &amp; approved</span>
          </label>
          <button type="button" id="btnAdminConfirmReapprove" class="btn-action-sm btn-approve" style="margin-top:8px;">Reapprove Store</button>
        </div>
      </div>

      <div class="admin-review-section" style="margin:0;">
        <div class="admin-review-section-title">Store Audit &amp; Compliance Timeline</div>
        ${auditRowsHtml}
      </div>
    `;

    document.getElementById('btnCtrlInspectAppDocs')?.addEventListener('click', () => {
      storeCtrlModal?.close();
      if (app) openReviewAppModal(app.id);
    });

    document.getElementById('btnCtrlSaveVerification')?.addEventListener('click', async () => {
      const docSt = document.getElementById('ctrlSelectDocStatus')?.value;
      const retSt = document.getElementById('ctrlSelectRetailerAuth')?.value;
      const notes = document.getElementById('ctrlVerifyNotesInput')?.value?.trim() || '';
      const res = await verifyStoreDocumentsAndRetailer(storeId, { documentStatus: docSt, retailerAuthStatus: retSt, adminNotes: notes });
      if (res.success) {
        sfx.win?.();
        showToast('✓ Store document & retailer authorization statuses updated.', 'success');
        await syncAdminStateFromServer();
        renderActiveAdminPane();
        openStoreControlModal(storeId);
      } else {
        showToast(res.message || 'Verification update failed.', 'error');
      }
    });

    document.getElementById('btnAdminConfirmSuspend')?.addEventListener('click', async () => {
      const reason = document.getElementById('adminSuspendReasonInput')?.value?.trim() || '';
      if (!reason) {
        showToast('Please enter a clear suspension reason before suspending.', 'warning');
        return;
      }
      const res = await suspendStoreWithReason(storeId, reason, 'admin');
      if (res.success) {
        showToast(`Store suspended. Sessions revoked immediately.`, 'warning');
        await syncAdminStateFromServer();
        renderActiveAdminPane();
        openStoreControlModal(storeId);
      } else {
        showToast(res.message || 'Failed to suspend store.', 'error');
      }
    });

    document.getElementById('btnAdminConfirmReapprove')?.addEventListener('click', async () => {
      const notes = document.getElementById('adminReapproveNotesInput')?.value?.trim() || '';
      const markDocumentsApproved = Boolean(document.getElementById('adminReapproveConfirmDocs')?.checked);
      const res = await reapproveSuspendedStore(storeId, { notes, markDocumentsApproved });
      if (res.success) {
        sfx.win?.();
        showToast(`✓ Store reapproved and software access restored!`, 'success');
        await syncAdminStateFromServer();
        renderActiveAdminPane();
        openStoreControlModal(storeId);
      } else {
        showToast(res.message || 'Cannot reapprove store until requirements are met.', 'error');
      }
    });
  }

  function renderStores() {
    const st = getLocalAdminState();
    const tbody = document.getElementById('adminStoresTableBody');
    if (!tbody) return;

    tbody.innerHTML = st.stores.map(s => {
      const subSt = s.subscriptionStatus || 'ACTIVE';
      const docSt = s.documentStatus || 'APPROVED';
      const retSt = s.retailerAuthStatus || 'VALID';
      const accSt = s.softwareAccessStatus || (s.authorizationStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
      const isSuspended = accSt === 'SUSPENDED' || s.authorizationStatus === 'SUSPENDED';

      const subBadge = `<span class="badge-status ${subSt === 'ACTIVE' ? 'approved' : 'suspended'}">${escapeHtml(subSt)}</span>`;
      const docBadge = `<span class="badge-status ${docSt === 'APPROVED' ? 'approved' : (docSt === 'ACTION_REQUIRED' || docSt === 'REJECTED' ? 'rejected' : 'pending')}">${escapeHtml(docSt)}</span>`;
      const retBadge = `<span class="badge-status ${retSt === 'VALID' ? 'approved' : (retSt === 'INVALID' || retSt === 'SUSPENDED' ? 'rejected' : 'pending')}">${escapeHtml(retSt)}</span>`;
      const accBadge = `<span class="badge-status ${isSuspended ? 'suspended' : 'active'}">${escapeHtml(accSt)}</span>`;

      const planLabel = s.subscription ? `${s.subscription.planName} ($${s.subscription.amountPaid || 0})` : 'Standard';
      const docsLabel = s.licenseFilesCount ? `${s.licenseFilesCount} file(s)` : '';
      const resubTag = s.resubmissionCount > 0 ? `<div style="font-size:0.7rem; color:#f59e0b; font-weight:700;">Corrected Docs Submitted (${s.resubmissionCount}x)</div>` : '';
      const reasonLine = isSuspended && s.suspensionReason ? `<div style="font-size:0.72rem; color:#ef4444; max-width:200px;">Reason: ${escapeHtml(s.suspensionReason)}</div>` : '';

      return `
        <tr>
          <td>
            <strong style="color:var(--admin-heading-color);">${escapeHtml(s.storeName)}</strong>
            <div style="font-family:var(--mono); font-size:0.72rem; color:#94a3b8;">${escapeHtml(s.storeId)} · ${escapeHtml(planLabel)}</div>
          </td>
          <td>
            <div>${escapeHtml(s.ownerUsername || s.ownerName || '')}</div>
            <div style="font-family:var(--mono); font-size:0.74rem; color:#94a3b8;">${escapeHtml(s.retailerNumber || 'Pending')} ${docsLabel ? '· ' + escapeHtml(docsLabel) : ''}</div>
          </td>
          <td>${subBadge}</td>
          <td>${docBadge}${resubTag}</td>
          <td>${retBadge}</td>
          <td>${accBadge}${reasonLine}</td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn-action-sm btn-secondary btn-inspect-store" data-store-id="${escapeHtml(s.storeId)}">Review / Control</button>
            ${isSuspended
          ? `<button type="button" class="btn-action-sm btn-approve btn-reactivate-store" data-store-id="${escapeHtml(s.storeId)}">Reapprove</button>`
          : `<button type="button" class="btn-action-sm btn-suspend btn-suspend-store" data-store-id="${escapeHtml(s.storeId)}">Suspend</button>`}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-inspect-store').forEach(btn => {
      btn.addEventListener('click', () => openStoreControlModal(btn.dataset.storeId));
    });

    tbody.querySelectorAll('.btn-suspend-store').forEach(btn => {
      btn.addEventListener('click', () => openStoreControlModal(btn.dataset.storeId));
    });

    tbody.querySelectorAll('.btn-reactivate-store').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeId = btn.dataset.storeId;
        const res = await reapproveSuspendedStore(storeId, { notes: 'Reapproved by administrator' });
        if (res.success) {
          sfx.win?.();
          showToast(`✓ Store reapproved. Software access restored.`, 'success');
          await syncAdminStateFromServer();
          renderStores();
        } else {
          showToast(res.message || 'Please review documents & retailer authorization before reapproving.', 'warning');
          openStoreControlModal(storeId);
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
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:12px;">
          <div style="min-width:0; flex:1;">
            <div style="font-size:1.02rem; font-weight:700; color:var(--admin-heading-color); word-break:break-word;">${escapeHtml(fb.subject || 'Store Issue Report')}</div>
            <div style="font-size:0.78rem; color:var(--admin-text-muted); margin-top:2px;">Reported by <strong style="color:var(--admin-text-main);">${escapeHtml(fb.cashierName || 'Cashier')}</strong> at <strong>${escapeHtml(fb.storeName)}</strong> (${escapeHtml(fb.storeId)})</div>
          </div>
          <span style="font-size:0.75rem; font-weight:700; color:${sevColor}; border:1px solid ${sevColor}50; background:${sevColor}15; padding:3px 10px; border-radius:6px; flex-shrink:0;">${escapeHtml(fb.severity)}</span>
        </div>
        <div style="margin: 10px 0; padding: 12px 14px; background: var(--admin-payload-box-bg); border: 1px solid var(--admin-payload-box-border); border-radius: 8px; font-size: 0.86rem; color: var(--admin-text-main); white-space: pre-wrap; line-height: 1.5; word-break:break-word;">${escapeHtml(fb.message)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 16px; font-size:0.76rem; color:var(--admin-text-dim); margin-top:10px; padding:0 2px;">
          <span>Category: <strong style="color:var(--admin-primary);">${escapeHtml(fb.category)}</strong></span>
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
