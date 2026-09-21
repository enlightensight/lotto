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

  const p1Timestamp = rootElement.querySelector('#drP1Timestamp') || rootElement.querySelector('.dr-timestamp-line');
  if (p1Timestamp) {
    p1Timestamp.innerHTML = `${reportData.reportDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${reportData.reportTime}`;
  }

  // Box rows rendering helper
  function renderBoxRows(boxes, tbodyEl) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    boxes.forEach(item => {
      // Do NOT write empty slots on receipts or reports!
      if (item.isEmpty) {
        return;
      }

      if (item.isMultiPack && item.subRows && item.subRows.length > 0) {
        // Multi-pack box (e.g. Box 6 with green row 1 and red row 2)
        item.subRows.forEach((sr, idx) => {
          const tr = document.createElement('tr');
          if (sr.highlight === 'green') tr.className = 'dr-row-green';
          else if (sr.highlight === 'red') tr.className = 'dr-row-red';

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

  // Filter only active dispenser boxes (skip empty slots completely)
  const activeBoxes = (reportData.boxes || []).filter(b => !b.isEmpty);
  const p1Boxes = activeBoxes.slice(0, 45);
  const p2Boxes = activeBoxes.slice(45);

  // 2. Table Page 1
  const p1Tbody = rootElement.querySelector('#drP1TableBody') || rootElement.querySelectorAll('.dr-table tbody')[0];
  renderBoxRows(p1Boxes, p1Tbody);

  // 3. Table Page 2 (Only if there are more than 45 active boxes)
  const p2Tbody = rootElement.querySelector('#drP2TableBody') || rootElement.querySelectorAll('.dr-table tbody')[1];
  const p2Table = p2Tbody ? p2Tbody.closest('.dr-table') : null;
  if (p2Boxes.length > 0) {
    if (p2Table) p2Table.style.display = 'table';
    renderBoxRows(p2Boxes, p2Tbody);
  } else {
    if (p2Table) p2Table.style.display = 'none';
    if (p2Tbody) p2Tbody.innerHTML = '';
  }

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

  // 1. Update Video-Authentic Header Elements
  const shiftEl = document.getElementById('drReportShiftNumber');
  if (shiftEl) shiftEl.textContent = `Current Shift : ${state?.shiftNumber || 1}`;

  const totalSaleEl = document.getElementById('drReportTotalSaleTitle');
  if (totalSaleEl) {
    const tot = reportData.totalSales || reportData.totalScratcherSales || 0;
    totalSaleEl.textContent = `Total Sale = $ ${Math.round(tot)}`;
  }

  const statEl = document.getElementById('drReportLargeStat');
  if (statEl) {
    const activeCount = (reportData.boxes || []).filter(b => !b.isEmpty).length;
    statEl.textContent = activeCount || 65;
  }

  // 2. Clear and Render Sheets
  container.innerHTML = '';

  const sheetsWrapper = document.createElement('div');
  sheetsWrapper.className = 'dr-sheets-wrapper';
  sheetsWrapper.id = 'drSheetsWrapper';

  // Page 1 clone
  const p1Sheet = printSection.querySelector('#dayReportSheetPage1').cloneNode(true);
  p1Sheet.removeAttribute('id');
  p1Sheet.classList.add('dr-preview-sheet');
  sheetsWrapper.appendChild(p1Sheet);

  // Page 2 clone
  const p2Sheet = printSection.querySelector('#dayReportSheetPage2').cloneNode(true);
  p2Sheet.removeAttribute('id');
  p2Sheet.classList.add('dr-preview-sheet');
  sheetsWrapper.appendChild(p2Sheet);

  container.appendChild(sheetsWrapper);

  // 3. Floating Toolbar Logic (Matching Video 03:38)
  const floatPrint = document.getElementById('drFloatPrintBtn');
  const floatSave = document.getElementById('drFloatSaveBtn');
  const floatPrev = document.getElementById('drFloatPrevBtn');
  const floatNext = document.getElementById('drFloatNextBtn');
  const floatIndicator = document.getElementById('drFloatPageIndicator');
  const floatZoomOut = document.getElementById('drFloatZoomOutBtn');
  const floatZoomIn = document.getElementById('drFloatZoomInBtn');
  const floatFit = document.getElementById('drFloatFitBtn');

  if (floatPrint) {
    floatPrint.onclick = () => printDayReport(reportData);
  }
  if (floatSave) {
    floatSave.onclick = () => printDayReport(reportData);
  }
  if (floatPrev) {
    floatPrev.onclick = () => {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      if (floatIndicator) floatIndicator.textContent = '1 / 2';
    };
  }
  if (floatNext) {
    floatNext.onclick = () => {
      container.scrollTo({ top: p1Sheet.offsetHeight + 24, behavior: 'smooth' });
      if (floatIndicator) floatIndicator.textContent = '2 / 2';
    };
  }

  let currentZoom = 1.0;
  if (floatZoomIn) {
    floatZoomIn.onclick = () => {
      currentZoom = Math.min(1.35, currentZoom + 0.1);
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
    };
  }
  if (floatZoomOut) {
    floatZoomOut.onclick = () => {
      currentZoom = Math.max(0.65, currentZoom - 0.1);
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
    };
  }
  if (floatFit) {
    floatFit.onclick = () => {
      currentZoom = (currentZoom === 1.0) ? 0.85 : 1.0;
      sheetsWrapper.style.transform = `scale(${currentZoom})`;
      sheetsWrapper.style.transformOrigin = 'top center';
    };
  }

  // Update page indicator on scroll
  container.onscroll = () => {
    if (!floatIndicator) return;
    if (container.scrollTop > p1Sheet.offsetHeight / 2) {
      floatIndicator.textContent = '2 / 2';
    } else {
      floatIndicator.textContent = '1 / 2';
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
      if (showToast) showToast('✓ Shift Report closed.', 'info');
    });
  }

  const btnCancel = document.getElementById('drReportCancelBtn');
  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => modal.close());
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
