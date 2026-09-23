// =============================================================
// Georgia Lottery Official 2-Page Day Report Renderer
// Exact Match to AMIGO FOOD MART LT System Software Specification
// =============================================================

import { getDayReportData } from './dayReportData.js';
import { saveState } from './data.js';

/**
 * Populates a DOM tree (either print section or modal preview) with Day Report data
 */
export function populateDayReportDOM(reportData, rootElement = document) {
  if (!reportData) return;

  // 1. Header (Page 1)
  const p1TotalTitle = rootElement.querySelector('#drP1TotalTitle') || rootElement.querySelector('.dr-total-title');
  if (p1TotalTitle) {
    p1TotalTitle.textContent = `Total $${Number(reportData.totalScratcherSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const p1StoreName = rootElement.querySelector('#drP1StoreName') || rootElement.querySelector('.dr-store-name');
  if (p1StoreName) p1StoreName.textContent = reportData.storeName || 'AMIGO FOOD MART';

  const p1StoreAddr = rootElement.querySelector('#drP1StoreAddr') || rootElement.querySelector('.dr-store-addr');
  if (p1StoreAddr) p1StoreAddr.textContent = reportData.storeAddress || '2300 MOODY RD WARNER ROBINS, GA, 31088';

  const p1UserId = rootElement.querySelector('#drP1UserId') || rootElement.querySelector('.dr-user-id');
  if (p1UserId) p1UserId.textContent = `User ID: ${reportData.userId || 'master'}`;

  const p1Heading = rootElement.querySelector('#drReportHeadingText') || rootElement.querySelector('.dr-report-heading');
  if (p1Heading) {
    p1Heading.textContent = 'Day Report';
  }

  const p1Timestamp = rootElement.querySelector('#drP1Timestamp') || rootElement.querySelector('.dr-timestamp-line');
  if (p1Timestamp) {
    p1Timestamp.innerHTML = `${reportData.reportDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${reportData.reportTime}`;
  }

  // Box rows rendering helper
  function renderBoxRows(boxes, tbodyEl) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    if (!boxes || boxes.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 18px 12px; color: #64748b; font-style: italic; font-size: 11px;">
          No active scratcher dispenser boxes recorded in this shift. (Tap any box on main screen to activate packs)
        </td>
      `;
      tbodyEl.appendChild(tr);
      return;
    }

    boxes.forEach(item => {
      // Empty slot row — displayed per user request
      if (item.isEmpty) {
        const tr = document.createElement('tr');
        tr.className = 'dr-row-empty';
        tr.innerHTML = `
          <td class="dr-box-num">${item.box}</td>
          <td class="dr-pack-num" style="color: #64748b;">${item.pack && item.pack !== '---' ? item.pack : '---'}</td>
          <td class="dr-game-name" style="color: #64748b;">${item.name || 'EMPTY'}</td>
          <td class="dr-num-cell" style="color: #64748b;">${item.open ?? '-'}</td>
          <td class="dr-num-cell" style="color: #64748b;">${item.close ?? '-'}</td>
          <td class="dr-num-cell" style="color: #64748b;">${item.price ? '$' + item.price : '-'}</td>
          <td class="dr-num-cell" style="color: #64748b;">${item.total !== undefined ? item.total : '0'}</td>
        `;
        tbodyEl.appendChild(tr);
        return;
      }

      if (item.isMultiPack && item.subRows && item.subRows.length > 0) {
        // Multi-pack box (e.g. Box 6 with green row 1 and red row 2)
        item.subRows.forEach((sr, idx) => {
          const tr = document.createElement('tr');
          if (sr.highlight === 'green') tr.className = 'dr-row-green';
          else if (sr.highlight === 'red') tr.className = 'dr-row-red';
          else if (sr.highlight === 'purple') tr.className = 'dr-row-purple';

          const boxCol = idx === 0 
            ? `<td class="dr-box-num" rowspan="${item.subRows.length}">${item.box}</td>` 
            : '';

          tr.innerHTML = `
            ${boxCol}
            <td class="dr-pack-num">${sr.pack || ''}</td>
            <td class="dr-game-name">${sr.name || ''}</td>
            <td class="dr-num-cell">${sr.open ?? ''}</td>
            <td class="dr-num-cell">${sr.close ?? ''}</td>
            <td class="dr-num-cell">${sr.price ?? ''}</td>
            <td class="dr-num-cell">${sr.total ?? ''}</td>
          `;
          tbodyEl.appendChild(tr);
        });
        return;
      }

      // Standard single-pack box
      const tr = document.createElement('tr');
      if (item.highlight === 'green') tr.className = 'dr-row-green';
      else if (item.highlight === 'red') tr.className = 'dr-row-red';
      else if (item.highlight === 'purple') tr.className = 'dr-row-purple';

      tr.innerHTML = `
        <td class="dr-box-num">${item.box}</td>
        <td class="dr-pack-num">${item.pack || ''}</td>
        <td class="dr-game-name">${item.name || ''}</td>
        <td class="dr-num-cell">${item.open ?? ''}</td>
        <td class="dr-num-cell">${item.close ?? ''}</td>
        <td class="dr-num-cell">${item.price ?? ''}</td>
        <td class="dr-num-cell">${item.total ?? ''}</td>
      `;
      tbodyEl.appendChild(tr);
    });
  }

  // Render ALL boxes (active and empty) on the single full 1-page report
  const allBoxes = reportData.boxes || [];
  const p1Tbody = rootElement.querySelector('#drP1TableBody') || rootElement.querySelector('.dr-table tbody');
  renderBoxRows(allBoxes, p1Tbody);

  // 4. Financial Summary
  const setEl = (id, val) => {
    const el = rootElement.querySelector(id);
    if (el) el.textContent = val;
  };

  const fmt = (num) => `$${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  setEl('#drFinTotal', fmt(reportData.totalScratcherSales));
  setEl('#drFinCashes', fmt(reportData.cashes));
  setEl('#drFinOnline', fmt(reportData.onlineSales));
  setEl('#drFinOnlineCashes', fmt(reportData.onlineCashes));
  setEl('#drFinTotalSales', fmt(reportData.totalSales));
  setEl('#drFinTotalCashes', fmt(reportData.totalCashes));

  // 5. Inventory Stats
  const inv = reportData.inventoryStats || {};
  setEl('#drStatOpening', inv.openingCount ?? 0);
  setEl('#drStatEnding', inv.endingCount ?? 0);
  setEl('#drStatActivations', inv.activations ?? 0);
  setEl('#drStatSold', inv.sold ?? 0);
  setEl('#drStatDiscontinued', inv.discontinued ?? 0);
  setEl('#drStatRemoved', inv.removed ?? '-');
  setEl('#drStatBackInv', inv.backInventory ?? 0);
  setEl('#drStatTotalInv', inv.totalInventory ?? 0);
  setEl('#drStatActiveVal', fmt(inv.activeValue ?? 0));

  // 6. Activations Subtable
  const actTbody = rootElement.querySelector('#drActivationsTableBody');
  if (actTbody) {
    actTbody.innerHTML = '';
    if (!reportData.activations || reportData.activations.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="padding: 4px 8px; color: #64748b; font-style: italic; font-size: 9.5px; text-align: center;">None (No new activations today)</td>`;
      actTbody.appendChild(tr);
    } else {
      reportData.activations.forEach(act => {
        const tr = document.createElement('tr');
        tr.className = 'dr-row-green';
        tr.innerHTML = `
          <td class="dr-box-num">${act.box}</td>
          <td class="dr-time-cell">${act.time || ''}</td>
          <td class="dr-pack-num">${act.packNumber || ''}</td>
          <td class="dr-num-cell">${act.price || ''}</td>
          <td class="dr-game-name">${act.name || ''}</td>
        `;
        actTbody.appendChild(tr);
      });
    }
  }

  // 7. Sold Subtable
  const soldTbody = rootElement.querySelector('#drSoldTableBody');
  if (soldTbody) {
    soldTbody.innerHTML = '';
    if (!reportData.soldOut || reportData.soldOut.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="padding: 4px 8px; color: #64748b; font-style: italic; font-size: 9.5px; text-align: center;">None (No packs sold out today)</td>`;
      soldTbody.appendChild(tr);
    } else {
      reportData.soldOut.forEach(sold => {
        const tr = document.createElement('tr');
        tr.className = 'dr-row-red';
        tr.innerHTML = `
          <td class="dr-box-num">${sold.box}</td>
          <td class="dr-pack-num">${sold.packNumber || ''}</td>
          <td class="dr-num-cell">${sold.price || ''}</td>
          <td class="dr-game-name">${sold.name || ''}</td>
        `;
        soldTbody.appendChild(tr);
      });
    }
  }
}

/**
 * Generates an interactive preview inside the Day Report Modal (Matching Video 03:38 - 04:00)
 */
export function renderDayReportModalPreview(reportData, state = null, onRefresh = null) {
  const container = document.getElementById('dayReportPreviewContainer');
  if (!container) return;

  // Clone sheets from the print section to ensure 100% visual parity
  const printSection = document.getElementById('dayReportPrintSection');
  if (!printSection) return;

  // First ensure print section has the latest data
  populateDayReportDOM(reportData, printSection);

  // 1. Update Unified Header Elements
  const shiftEl = document.getElementById('drReportShiftNumber');
  if (shiftEl) {
    shiftEl.innerHTML = `<span class="dr-shift-dot"></span><span>Shift : ${state?.shiftNumber || 1}</span>`;
  }

  const totalSaleEl = document.getElementById('drReportTotalSaleTitle');
  if (totalSaleEl) {
    const tot = reportData.totalSales || reportData.totalScratcherSales || 0;
    const formatted = Number(tot).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    totalSaleEl.textContent = `$${formatted}`;
  }

  const statEl = document.getElementById('drReportLargeStat');
  if (statEl) {
    const activeCount = (reportData.boxes || []).filter(b => !b.isEmpty).length;
    statEl.innerHTML = `
      <span class="dr-metric-dot"></span>
      <span class="dr-metric-label">Active Boxes</span>
      <span class="dr-metric-val">${activeCount}</span>
    `;
  }

  // 2. Clear and Render Sheets
  container.innerHTML = '';

  const sheetsWrapper = document.createElement('div');
  sheetsWrapper.className = 'dr-sheets-wrapper';
  sheetsWrapper.id = 'drSheetsWrapper';

  let p1Sheet = null;

  try {
    const p1Source = printSection.querySelector('#dayReportSheetPage1');
    if (p1Source) {
      p1Sheet = p1Source.cloneNode(true);
      p1Sheet.removeAttribute('id');
      p1Sheet.classList.add('dr-preview-sheet');
      sheetsWrapper.appendChild(p1Sheet);
    }
  } catch (err) {
    console.error('Error cloning Day Report sheet for preview:', err);
  }

  container.appendChild(sheetsWrapper);

  // 3. Integrated Document Toolbar Logic (No floating overlap over table!)
  const floatPrint = document.getElementById('drFloatPrintBtn');
  const floatSave = document.getElementById('drFloatSaveBtn');
  const floatPrev = document.getElementById('drFloatPrevBtn');
  const floatNext = document.getElementById('drFloatNextBtn');
  const floatIndicator = document.getElementById('drFloatPageIndicator');
  const floatZoomOut = document.getElementById('drFloatZoomOutBtn');
  const floatZoomIn = document.getElementById('drFloatZoomInBtn');
  const floatFit = document.getElementById('drFloatFitBtn');
  const zoomText = document.getElementById('drZoomLevelText');

  if (floatIndicator) {
    floatIndicator.textContent = '1 / 1';
  }

  if (floatPrint) {
    floatPrint.onclick = () => printDayReport(reportData);
  }
  if (floatSave) {
    floatSave.onclick = () => printDayReport(reportData);
  }
  if (floatPrev) {
    floatPrev.onclick = () => {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }
  if (floatNext) {
    floatNext.onclick = () => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    };
  }

  let currentZoom = 1.0;
  const updateZoomDisplay = () => {
    if (zoomText) zoomText.textContent = `${Math.round(currentZoom * 100)}%`;
  };

  if (floatZoomIn) {
    floatZoomIn.onclick = () => {
      currentZoom = Math.min(1.35, currentZoom + 0.1);
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
      updateZoomDisplay();
    };
  }
  if (floatZoomOut) {
    floatZoomOut.onclick = () => {
      currentZoom = Math.max(0.65, currentZoom - 0.1);
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
      updateZoomDisplay();
    };
  }
  if (floatFit) {
    floatFit.onclick = () => {
      currentZoom = (currentZoom === 1.0) ? 0.85 : 1.0;
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
      updateZoomDisplay();
    };
  }

  container.onscroll = () => {
    if (floatIndicator) {
      floatIndicator.textContent = '1 / 1';
    }
  };
}

/**
 * Triggers official 2-page print dialog
 */
export function printDayReport(reportData, sfx = null) {
  const printSection = document.getElementById('dayReportPrintSection');
  if (printSection) {
    populateDayReportDOM(reportData, printSection);
  }

  // Set Letter Portrait print page size
  let styleEl = document.getElementById('dynamicDayReportPrintStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicDayReportPrintStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    @page {
      size: letter portrait !important;
      margin: 8mm 10mm !important;
    }
  `;

  document.body.classList.remove('print-fullpage-report');
  document.body.classList.add('print-day-report');

  if (sfx && typeof sfx.chime === 'function') {
    sfx.chime();
  }

  window.print();
}

// Clean up print classes automatically after printing
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-day-report');
  const styleEl = document.getElementById('dynamicDayReportPrintStyle');
  if (styleEl) styleEl.textContent = '';
});

/**
 * Helper to open the Day Report modal and initialize handlers
 */
export function openDayReportModal(getStateOrState, sfx = null) {
  const getState = typeof getStateOrState === 'function' ? getStateOrState : () => getStateOrState;
  const modal = document.getElementById('dayReportModal');
  if (!modal) return;

  const refreshModal = () => {
    const currentState = getState();
    const data = getDayReportData(currentState);
    renderDayReportModalPreview(data, currentState, refreshModal);
  };

  refreshModal();

  if (sfx && typeof sfx.keypad === 'function') {
    sfx.keypad();
  }

  modal.showModal();
}

/**
 * Wires Day Report UI buttons across the application
 */
export function setupDayReportHandlers(getStateOrState, sfx = null, showToast = null) {
  const getState = typeof getStateOrState === 'function' ? getStateOrState : () => getStateOrState;
  const menuBtn = document.getElementById('menuDayReportBtn');
  const modal = document.getElementById('dayReportModal');
  const closeBtn = document.getElementById('closeDayReportModalBtn');
  const closeBottomBtn = document.getElementById('closeDayReportBottomBtn');
  const printBtn = document.getElementById('btnPrintDayReportModalBtn');

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openDayReportModal(getState, sfx);
      if (showToast) {
        showToast('📄 Official 2-Page Day Report loaded', 'info');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.close());
  }

  if (closeBottomBtn && modal) {
    closeBottomBtn.addEventListener('click', () => modal.close());
  }

  const btnDone = document.getElementById('btnReportDone');
  if (btnDone && modal) {
    btnDone.addEventListener('click', () => {
      modal.close();
      if (sfx && typeof sfx.success === 'function') sfx.success();
      if (showToast) showToast('✓ Day Report closed.', 'info');
    });
  }

  const btnCancel = document.getElementById('drReportCancelBtn');
  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.close());
  }

  const btnUndo = document.getElementById('drReportUndoBtn');
  if (btnUndo && modal) {
    btnUndo.addEventListener('click', () => modal.close());
  }

  const btnStartNew = document.getElementById('drReportStartNewShiftBtn');
  if (btnStartNew && modal) {
    btnStartNew.addEventListener('click', () => {
      modal.close();
      const startShiftModal = document.getElementById('startShiftConfirmModal');
      if (startShiftModal) {
        startShiftModal.showModal();
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const currentState = getState();
      const data = getDayReportData(currentState);
      printDayReport(data, sfx);
    });
  }
}
