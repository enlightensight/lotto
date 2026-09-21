// Modern Lottery POS & Tracking System - Application Controller
import { loadState, saveState, resetToDefaults, resetToCleanState, SAMPLE_GAMES, findGameByBarcode, getStandardPackDetails } from './data.js';
import { sfx, voice } from './audio.js';
import { setupDayReportHandlers, openDayReportModal, printDayReport } from './dayReportRenderer.js';
import { AMIGO_DAY_REPORT_REFERENCE } from './dayReportData.js';

let state = loadState();
let undoHistory = [];

export const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);

export function getShiftSalesTotals() {
  let totalSold = 0;
  let totalRevenue = 0;

  (state.slots || []).forEach(s => {
    if (isBoxActive(s)) {
      const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
      totalSold += sold;
      totalRevenue += sold * (s.price || 0);
    }
  });

  (state.soldOutThisShift || []).forEach(so => {
    const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    const amt = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
    totalSold += sold;
    totalRevenue += amt;
  });

  return { totalSold, totalRevenue };
}

export function recordSoldOutPack(slot, closeOverride = null) {
  if (!slot || !slot.packNumber || !slot.gameName) return;
  if (!state.soldOutThisShift) state.soldOutThisShift = [];

  const start = slot.startTicket || 0;
  const close = closeOverride !== null ? closeOverride : (slot.currentTicket || slot.packSize || 0);
  const sold = Math.max(0, close - start);
  const amount = sold * (slot.price || 0);

  const existingIdx = state.soldOutThisShift.findIndex(
    so => so.boxNumber === slot.boxNumber && so.packNumber === slot.packNumber
  );

  const record = {
    boxNumber: slot.boxNumber,
    gameName: slot.gameName,
    price: slot.price || 0,
    packNumber: slot.packNumber,
    packSize: slot.packSize || 100,
    startTicket: start,
    closeTicket: close,
    ticketsSold: sold,
    salesAmount: amount,
    soldAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };

  if (existingIdx >= 0) {
    state.soldOutThisShift[existingIdx] = record;
  } else {
    state.soldOutThisShift.push(record);
  }
}

// DOM Element References
const currentShiftNumberEl = document.getElementById('currentShiftNumber');
const currentCashierEl = document.getElementById('currentCashier');
const shiftStatusBadge = document.getElementById('shiftStatusBadge');
const shiftStatusText = document.getElementById('shiftStatusText');
const mainShiftActionBtn = document.getElementById('mainShiftActionBtn');
const cancelActionBtn = document.getElementById('cancelActionBtn');
const undoActionBtn = document.getElementById('undoActionBtn');

const barcodeInput = document.getElementById('barcodeInput');
const scanActionTitle = document.getElementById('scanActionTitle');
const lastScanDisplay = document.getElementById('lastScanDisplay');
const largeStatReadout = document.getElementById('largeStatReadout');
const largeStatLabel = document.getElementById('largeStatLabel');

const dispensersGrid = document.getElementById('dispensersGrid');
const slotsRibbon = document.getElementById('slotsRibbon');
const ribbonActiveCount = document.getElementById('ribbonActiveCount');
const ribbonEmptyCount = document.getElementById('ribbonEmptyCount');

// Metric Tabs
const metricSettlement = document.getElementById('metricSettlement');
const metricThisMonth = document.getElementById('metricThisMonth');
const metricThisWeek = document.getElementById('metricThisWeek');
const metricToday = document.getElementById('metricToday');
const metricInactive = document.getElementById('metricInactive');
const metricInventoryCount = document.getElementById('metricInventoryCount');
const tabUpdateInventory = document.getElementById('tabUpdateInventory');

// Modals
const activationModal = document.getElementById('activationModal');
const closeActivationBtn = document.getElementById('closeActivationBtn');
const activationGameTitle = document.getElementById('activationGameTitle');
const keypadBoxInput = document.getElementById('keypadBoxInput');
const stepBoxUp = document.getElementById('stepBoxUp');
const stepBoxDown = document.getElementById('stepBoxDown');
const btnNotInBox = document.getElementById('btnNotInBox');
const btnAddBox = document.getElementById('btnAddBox');

const endShiftConfirmModal = document.getElementById('endShiftConfirmModal');
const closeEndShiftConfirmBtn = document.getElementById('closeEndShiftConfirmBtn');
const confActivationCount = document.getElementById('confActivationCount');
const confEmptySlotsCount = document.getElementById('confEmptySlotsCount');
const soldOutListContainer = document.getElementById('soldOutListContainer');
const confTotalSlots = document.getElementById('confTotalSlots');
const confCancelBtn = document.getElementById('confCancelBtn');
const confConfirmBtn = document.getElementById('confConfirmBtn');

const shiftReportModal = document.getElementById('shiftReportModal');
const closeReportBtn = document.getElementById('closeReportBtn');
const repShiftNum = document.getElementById('repShiftNum');
const repCashier = document.getElementById('repCashier');
const repTicketsSold = document.getElementById('repTicketsSold');
const repTotalRevenue = document.getElementById('repTotalRevenue');
const reportBodyRows = document.getElementById('reportBodyRows');
const repSumSold = document.getElementById('repSumSold');
const repSumAmount = document.getElementById('repSumAmount');
const reportPrintBtn = document.getElementById('reportPrintBtn');
const reportPrintFullBtn = document.getElementById('reportPrintFullBtn');
const reportEmailBtn = document.getElementById('reportEmailBtn');
const reportNewShiftBtn = document.getElementById('reportNewShiftBtn');

const inventoryModal = document.getElementById('inventoryModal');
const closeInventoryBtn = document.getElementById('closeInventoryBtn');
const inventoryBarcodeInput = document.getElementById('inventoryBarcodeInput');
const inventoryAddManualBtn = document.getElementById('inventoryAddManualBtn');
const inventoryTableBody = document.getElementById('inventoryTableBody');
const inventoryDoneBtn = document.getElementById('inventoryDoneBtn');

const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const closeHistoryBottomBtn = document.getElementById('closeHistoryBottomBtn');
const historyTableBody = document.getElementById('historyTableBody');
const menuHistoryBtn = document.getElementById('menuHistoryBtn');

// Demo Drawer Elements
const demoFabBtn = document.getElementById('demoFabBtn');
const demoDrawer = document.getElementById('demoDrawer');
const closeDemoDrawer = document.getElementById('closeDemoDrawer');
const simCustomerBuyBtn = document.getElementById('simCustomerBuyBtn');
const simScanNewPackBtn = document.getElementById('simScanNewPackBtn');
const simScan$20PackBtn = document.getElementById('simScan$20PackBtn');
const simEndShiftScanAllBtn = document.getElementById('simEndShiftScanAllBtn');
const simResetStateBtn = document.getElementById('simResetStateBtn');

const toastContainer = document.getElementById('toastContainer');

// Theme Toggle References
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');
const themeToggleText = document.getElementById('themeToggleText');
const drawerThemeToggleBtn = document.getElementById('drawerThemeToggleBtn');
const drawerThemeIcon = document.getElementById('drawerThemeIcon');
const drawerThemeTitle = document.getElementById('drawerThemeTitle');

// Theme Management
let currentTheme = localStorage.getItem('lotto_theme') || 'dark';

function initTheme() {
  applyTheme(currentTheme, false);
}

function applyTheme(theme, notify = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lotto_theme', theme);

  if (theme === 'dark') {
    if (themeToggleIcon) themeToggleIcon.textContent = '☀️';
    if (themeToggleText) themeToggleText.textContent = 'Light Mode';
    if (drawerThemeIcon) drawerThemeIcon.textContent = '☀️';
    if (drawerThemeTitle) drawerThemeTitle.textContent = 'Switch to Light Mode';
    if (notify) showToast('Switched to Dark Mode (Classic POS)', 'info');
  } else {
    if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    if (themeToggleText) themeToggleText.textContent = 'Dark Mode';
    if (drawerThemeIcon) drawerThemeIcon.textContent = '🌙';
    if (drawerThemeTitle) drawerThemeTitle.textContent = 'Switch to Dark Mode';
    if (notify) showToast('Switched to Light Mode (Arron Portal)', 'info');
  }
}

function toggleTheme() {
  sfx.keypad();
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

// Active pack being activated in modal
let pendingActivationPack = null;

// Strips repeated or leading dollar price prefixes and trailing dots (e.g. "$1 $1 5X MONEY......" -> "5X MONEY")
export function cleanGameTitle(name) {
  if (!name) return '';
  let s = String(name).trim();
  s = s.replace(/\.+$/g, '').trim(); // Remove trailing dots
  s = s.replace(/^(\$\s*\d*\s*)+/i, '').trim(); // Strip repeated or single leading $price
  s = s.replace(/^\$+/i, '').trim(); // Strip lingering double dollar sign
  s = s.replace(/\.+$/g, '').trim();
  return s;
}

// Seed full Georgia Lottery store dispenser boxes (from AMIGO FOOD MART reference) if slots are empty
export function seedInitialActiveSlotsIfEmpty() {
  // If user deliberately cleared data, do not re-seed
  if (state.dataCleared) return false;
  const activeCount = (state.slots || []).filter(isBoxActive).length;
  if (activeCount === 0 && AMIGO_DAY_REPORT_REFERENCE && Array.isArray(AMIGO_DAY_REPORT_REFERENCE.boxes)) {
    const newSlots = [];
    for (let b = 1; b <= 70; b++) {
      const boxDef = AMIGO_DAY_REPORT_REFERENCE.boxes.find(item => item.box === b);
      if (!boxDef || boxDef.isEmpty) {
        newSlots.push({
          boxNumber: b,
          status: 'EMPTY',
          gameId: null,
          gameName: null,
          price: null,
          packNumber: null,
          packSize: null,
          startTicket: 0,
          currentTicket: 0,
          activatedThisShift: false,
          daysActive: 0,
          scannedInEndShift: false
        });
      } else {
        let packNum = boxDef.pack;
        let rawName = boxDef.name;
        let price = boxDef.price || 1;
        let current = boxDef.open !== undefined ? boxDef.open : 0;
        let isNewAct = false;
        if (boxDef.isMultiPack && boxDef.subRows && boxDef.subRows.length > 0) {
          packNum = boxDef.subRows[0].pack;
          rawName = boxDef.subRows[0].name;
          price = boxDef.subRows[0].price || price;
          current = boxDef.subRows[0].open !== undefined ? boxDef.subRows[0].open : 0;
          isNewAct = boxDef.subRows[0].highlight === 'green';
        }
        const cleanName = cleanGameTitle(rawName);
        const std = getStandardPackDetails(price);
        const packSize = std.packSize;
        newSlots.push({
          boxNumber: b,
          status: 'ACTIVE',
          gameId: 'g_' + (packNum ? packNum.replace(/[^0-9]/g, '').slice(0, 4) : b),
          gameName: cleanName,
          price: price,
          packNumber: packNum,
          packSize: packSize,
          startTicket: current,
          currentTicket: current,
          activatedThisShift: isNewAct,
          daysActive: Math.max(1, (b % 5) + 1),
          scannedInEndShift: false
        });
      }
    }
    state.slots = newSlots;
    state.totalSlots = 70;
    state.shiftOpeningActiveCount = newSlots.filter(isBoxActive).length;
    saveState(state);
    return true;
  }
  return false;
}

// Sanitize & migrate existing state:
// 1. If an active box was activated with count 0 (due to prior bug), update to 1 (01)
// 2. If a box has status EMPTY or SOLD_OUT, or has count 0 without a pack, ensure it renders as empty
// 3. Clean up any duplicated dollar signs or prices in game names (e.g. "$1 $1 5X MONEY" -> "5X MONEY")
function sanitizeAndMigrateSlots() {
  let modified = false;
  state.slots.forEach(slot => {
    if (slot.gameName) {
      const cleaned = cleanGameTitle(slot.gameName);
      if (cleaned && cleaned !== slot.gameName) {
        slot.gameName = cleaned;
        modified = true;
      }
    }
    // Ensure packSize matches standard rules ($50 -> 18 pk / $900; <$50 -> 300 / price pk / $300)
    if (slot.price) {
      const std = getStandardPackDetails(slot.price);
      if (!slot.packSize || slot.packSize === 100 || (slot.price >= 50 && slot.packSize !== 18) || (slot.price < 50 && slot.packSize !== std.packSize)) {
        slot.packSize = std.packSize;
        modified = true;
      }
    }
    if (slot.status === 'ACTIVE' && (slot.currentTicket === null || slot.currentTicket === undefined)) {
      if (slot.gameName && slot.packNumber) {
        slot.startTicket = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
        slot.currentTicket = slot.startTicket;
        modified = true;
      } else {
        slot.status = 'EMPTY';
        slot.currentTicket = 0;
        modified = true;
      }
    }
    if ((slot.status === 'EMPTY' || slot.status === 'SOLD_OUT') && slot.currentTicket !== 0) {
      slot.currentTicket = 0;
      modified = true;
    }
  });

  // Also clean stale lastScannedBarcode string in state if it contained duplicated prices
  if (state.lastScannedBarcode) {
    const cleanedBarcode = state.lastScannedBarcode
      .replace(/\$\s*(\d+)\s+\$\s*\1/g, '$$$1')
      .replace(/\$+\s*\$+/g, '$');
    if (cleanedBarcode !== state.lastScannedBarcode) {
      state.lastScannedBarcode = cleanedBarcode;
      modified = true;
    }
  }

  if (modified) {
    saveState(state);
  }
}

let _eventListenersInitialized = false;

// Initialize System
function initPOS() {
  initTheme();
  seedInitialActiveSlotsIfEmpty();
  sanitizeAndMigrateSlots();
  populateActivationGameDropdown();
  if (state.settings && state.settings.soundEnabled === false) {
    sfx.muted = true;
  }
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  if (!_eventListenersInitialized) {
    setupEventListeners();
    setupKeypad();
    setupHardwareScannerListener();
    _eventListenersInitialized = true;
  }
}

// -------------------------------------------------------------
// Rendering Functions
// -------------------------------------------------------------

function renderHeaderAndMetrics() {
  currentShiftNumberEl.textContent = state.shiftNumber;
  currentCashierEl.textContent = `[${state.cashierName}]`;

  // Status Badge and Action Button (Matching LTSYSTEM 2-Column Buttons)
  if (state.shiftStatus === 'IN_PROGRESS') {
    shiftStatusBadge.className = 'btn-lt-green-progress';
    shiftStatusText.textContent = 'Shift in Progress';
    mainShiftActionBtn.className = 'btn-lt-black-end';
    mainShiftActionBtn.textContent = 'End Shift';
    scanActionTitle.textContent = state.lastScannedSlot 
      ? `Scanner Ready · Last Box Sold: #${state.lastScannedSlot}` 
      : 'Scanner Ready · Shift in Progress';
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    shiftStatusBadge.className = 'btn-lt-green-progress scanning';
    shiftStatusText.textContent = 'Scanning... End Shift';
    mainShiftActionBtn.className = 'btn-lt-black-end btn-get-report';
    mainShiftActionBtn.textContent = 'Get Report';
    scanActionTitle.textContent = 'End Shift Audit · Scan Active Dispenser Boxes';
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    shiftStatusBadge.className = 'btn-lt-green-progress ended';
    shiftStatusText.textContent = 'Shift Closed';
    mainShiftActionBtn.className = 'btn-lt-black-end btn-start-shift';
    mainShiftActionBtn.textContent = 'Start New Shift';
    scanActionTitle.textContent = 'Shift Closed · Ready for New Shift';
  }

  if (state.lastScanData) {
    const d = state.lastScanData;
    const isVerified = d.action === 'VERIFIED';
    const formattedPrice = Number(d.price).toFixed(2);
    lastScanDisplay.innerHTML = `
      <div class="scan-chips-row">
        <span class="scan-chip chip-barcode" title="Scanned Barcode"><span class="chip-lbl">BARCODE:</span> ${d.barcode}</span>
        <span class="scan-chip chip-box">BOX #${d.boxNumber}</span>
        <span class="scan-chip chip-price">$${formattedPrice}</span>
        <span class="scan-chip chip-game">${d.gameName}</span>
        <span class="scan-chip chip-pack"><span class="chip-lbl">PACK:</span> #${d.packNumber}</span>
        <span class="scan-chip chip-ticket"><span class="chip-lbl">TICKET:</span> #${String(d.ticketNumber).padStart(2, '0')}</span>
        <span class="scan-chip chip-action ${isVerified ? 'verified' : 'sold'}">${isVerified ? '✓ VERIFIED' : `🛒 +1 SOLD ($${formattedPrice})`}</span>
      </div>
    `;
  } else if (state.lastScannedBarcode) {
    lastScanDisplay.textContent = `Last Scan: ${state.lastScannedBarcode}`;
  } else {
    lastScanDisplay.innerHTML = `<span class="scan-chip chip-idle">⚡ Scanner Ready · Point scanner at ticket barcode or enter box number</span>`;
  }
  if (state.recentScans && state.recentScans.length > 0) {
    lastScanDisplay.title = 'Recent Scans (Hover to View):\n' + state.recentScans.slice(0, 10).map(s => `• ${s.time} - [${s.barcode}] Box #${s.boxNumber} (${s.gameName}) → Ticket #${String(s.ticketNumber).padStart(2, '0')}`).join('\n');
  } else {
    lastScanDisplay.title = 'Point scanner at any ticket or enter box number';
  }

  const remainingPacksCount = document.getElementById('remainingPacksCount');
  if (remainingPacksCount) {
    remainingPacksCount.textContent = state.inventory ? state.inventory.length : 0;
  }

  // Count active vs empty: any box with an active pack is considered active and ready to sell
  const activeCount = state.slots.filter(isBoxActive).length;
  const emptyCount = state.totalSlots - activeCount;

  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    const verifiedCount = state.slots.filter(s => isBoxActive(s) && s.scannedInEndShift).length;
    largeStatReadout.textContent = `${verifiedCount}/${activeCount}`;
    if (largeStatLabel) largeStatLabel.textContent = 'Boxes Verified';
  } else {
    largeStatReadout.textContent = state.lastScannedSlot || activeCount;
    if (largeStatLabel) largeStatLabel.textContent = state.lastScannedSlot ? `Box #${state.lastScannedSlot}` : 'Active Slots';
  }

  // Calculate current sales this shift (from active slots + packs sold out this shift)
  const { totalSold, totalRevenue } = getShiftSalesTotals();
  const todaySales = totalRevenue;
  const todayTickets = totalSold;

  const pastShiftTickets = (state.shiftHistory || []).reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);

  if (metricSettlement) metricSettlement.textContent = `$${todaySales.toFixed(2)}`;
  if (metricToday) metricToday.textContent = todayTickets;
  if (metricThisWeek) metricThisWeek.textContent = pastShiftTickets + todayTickets;
  if (metricThisMonth) metricThisMonth.textContent = pastShiftTickets + todayTickets;
  if (metricInactive) metricInactive.textContent = emptyCount;
  if (metricInventoryCount) metricInventoryCount.textContent = `${activeCount} Packs`;

  if (ribbonActiveCount) ribbonActiveCount.textContent = activeCount;
  if (ribbonEmptyCount) ribbonEmptyCount.textContent = emptyCount;

  const totalSlotsCountDisplay = document.getElementById('totalSlotsCountDisplay');
  if (totalSlotsCountDisplay) {
    totalSlotsCountDisplay.textContent = state.totalSlots;
  }
}

function renderDispenserRack() {
  dispensersGrid.innerHTML = '';

  state.slots.forEach(slot => {
    const card = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';

    // A box is active when it has an assigned pack and status ACTIVE
    const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.packNumber;

    if (!isBoxEmpty) {
      let ageBoxClass = '';
      if (slot.daysActive >= 21) {
        ageBoxClass = 'age-21-box';
      } else if (slot.daysActive >= 12) {
        ageBoxClass = 'age-12-box';
      } else if (slot.daysActive >= 7) {
        ageBoxClass = 'age-7-box';
      }

      card.className = `box-card active ${ageBoxClass} ${isScanning ? (slot.scannedInEndShift ? 'scanned-done' : 'scanning-target') : ''}`;

      const cleanName = cleanGameTitle(slot.gameName);
      card.innerHTML = `
        <div class="card-header-row">
          <span class="price-tag">$${slot.price}</span>
        </div>
        <div class="card-center-body">
          <div class="box-main-number">${slot.boxNumber}</div>
          <div class="game-title-strip" title="${cleanName}">${cleanName}</div>
          ${slot.activatedThisShift ? '<div class="new-activation-text">New Activation</div>' : ''}
        </div>
        <div class="card-dashed-line"></div>
        <div class="card-footer-row ${isScanning ? 'is-scanning' : ''}">
          <span class="ticket-number-display ${isScanning ? 'scanning-num' : ''}">${String(slot.currentTicket !== undefined ? slot.currentTicket : 0).padStart(2, '0')}</span>
          ${!isScanning ? `<button class="quick-sell-btn" data-box="${slot.boxNumber}" title="Quick Sell 1 Ticket">+1</button>` : ''}
          ${isScanning ? (slot.scannedInEndShift ? '<span class="card-scan-badge done">✓ SCANNED</span>' : '<span class="card-scan-badge pending">SCAN</span>') : ''}
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.quick-sell-btn')) {
          e.stopPropagation();
          quickSellTicket(slot);
          return;
        }
        handleBoxCardClick(slot);
      });
    } else {
      // Empty slot
      card.className = 'box-card empty-slot';
      card.innerHTML = `
        <div class="empty-slot-plus">+</div>
        <div class="empty-slot-title">Box ${slot.boxNumber} · Empty</div>
        <span class="empty-slot-sub">Tap to Activate</span>
      `;
      card.addEventListener('click', () => {
        openActivationForBox(slot.boxNumber);
      });
    }

    dispensersGrid.appendChild(card);
  });

  // Dedicated "+ Add Box" card at the end of the dispenser rack
  const addCard = document.createElement('div');
  addCard.className = 'box-card add-new-box-card';
  addCard.id = 'cardAddNewBox';
  addCard.innerHTML = `
    <div class="empty-slot-plus">+</div>
    <div class="empty-slot-title">Add Box #${state.totalSlots + 1}</div>
    <span class="empty-slot-sub">Expand Store Rack</span>
  `;
  addCard.addEventListener('click', () => {
    addNewBox();
  });
  dispensersGrid.appendChild(addCard);
}

function renderSlotsRibbon() {
  slotsRibbon.innerHTML = '';

  state.slots.forEach(slot => {
    const cell = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';
    const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.packNumber;

    if (!isBoxEmpty) {
      if (isScanning && slot.scannedInEndShift) {
        cell.className = 'ribbon-cell scanned-slot';
      } else if (state.lastScannedSlot === slot.boxNumber) {
        cell.className = 'ribbon-cell selected-slot';
      } else {
        cell.className = 'ribbon-cell active-slot';
      }
    } else {
      cell.className = 'ribbon-cell empty-slot';
    }

    cell.textContent = slot.boxNumber;
    cell.title = `Box #${slot.boxNumber}: ${!isBoxEmpty ? (slot.gameName || 'Active') : 'Empty'}`;
    
    cell.addEventListener('click', () => {
      handleBoxCardClick(slot);
    });

    slotsRibbon.appendChild(cell);
  });
}

// -------------------------------------------------------------
// Interactive Behaviors & Box Click
// -------------------------------------------------------------

function handleBoxCardClick(slot) {
  const isBoxActive = Boolean(slot && slot.status === 'ACTIVE' && slot.packNumber);

  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    if (isBoxActive) {
      slot.scannedInEndShift = true;
      const cleanName = cleanGameTitle(slot.gameName);
      state.lastScannedSlot = slot.boxNumber;
      const simBarcode = slot.packNumber ? `${slot.gameId || '1417'}-${slot.packNumber}-${String(slot.currentTicket || 0).padStart(3, '0')}` : `BOX-${slot.boxNumber}`;
      state.lastScanData = {
        barcode: simBarcode,
        boxNumber: slot.boxNumber,
        gameName: cleanName,
        price: slot.price,
        packNumber: slot.packNumber || '---',
        ticketNumber: slot.currentTicket || 0,
        action: 'VERIFIED'
      };
      state.lastScannedBarcode = `[${simBarcode}] Box #${slot.boxNumber} Verified: $${Number(slot.price).toFixed(2)} · ${cleanName} (#${String(slot.currentTicket || 0).padStart(2, '0')})`;
      sfx.beep();
      showToast(`Verified Box #${slot.boxNumber} ($${Number(slot.price).toFixed(2)} · ${cleanName})`, 'info');
      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
    }
  } else if (state.shiftStatus === 'IN_PROGRESS') {
    if (isBoxActive) {
      // Open Box Adjust Modal so user can view details or adjust count or set to 0 (make empty)
      openBoxAdjustModal(slot);
    } else {
      openActivationForBox(slot.boxNumber);
    }
  }
}

// -------------------------------------------------------------
// Box Detail & Count Adjust Modal
// -------------------------------------------------------------
let currentAdjustingSlot = null;

const boxAdjustModal = document.getElementById('boxAdjustModal');
const closeBoxAdjustBtn = document.getElementById('closeBoxAdjustBtn');
const cancelBoxAdjustBtn = document.getElementById('cancelBoxAdjustBtn');
const adjustModalTitle = document.getElementById('adjustModalTitle');
const adjustGameName = document.getElementById('adjustGameName');
const adjustPriceTag = document.getElementById('adjustPriceTag');
const adjustPackNum = document.getElementById('adjustPackNum');
const adjustPackSize = document.getElementById('adjustPackSize');
const adjustStartTicket = document.getElementById('adjustStartTicket');
const adjustDaysActive = document.getElementById('adjustDaysActive');
const inputAdjustCount = document.getElementById('inputAdjustCount');
const btnCountMinus = document.getElementById('btnCountMinus');
const btnCountPlus = document.getElementById('btnCountPlus');
const btnSellOneTicket = document.getElementById('btnSellOneTicket');
const btnSetCountZero = document.getElementById('btnSetCountZero');
const saveBoxAdjustBtn = document.getElementById('saveBoxAdjustBtn');

function openBoxAdjustModal(slot) {
  currentAdjustingSlot = slot;
  if (!boxAdjustModal) return;

  adjustModalTitle.textContent = `📦 Dispenser Box #${slot.boxNumber} Details`;
  adjustGameName.textContent = slot.gameName;
  adjustPriceTag.textContent = `$${slot.price}`;
  adjustPriceTag.className = `price-tag p${slot.price}`;
  adjustPackNum.textContent = `#${slot.packNumber || '884901'}`;
  adjustPackSize.textContent = `${slot.packSize || 150} pk`;
  adjustStartTicket.textContent = `#${String(slot.startTicket || 1).padStart(2, '0')}`;
  adjustDaysActive.textContent = `${slot.daysActive || 1} d`;
  inputAdjustCount.value = slot.currentTicket || 1;

  sfx.keypad();
  boxAdjustModal.showModal();
}

function setupBoxAdjustModal() {
  if (!boxAdjustModal) return;

  closeBoxAdjustBtn?.addEventListener('click', () => boxAdjustModal.close());
  cancelBoxAdjustBtn?.addEventListener('click', () => boxAdjustModal.close());

  btnCountMinus?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(inputAdjustCount.value, 10) || 0;
    if (val > 0) inputAdjustCount.value = val - 1;
  });

  btnCountPlus?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(inputAdjustCount.value, 10) || 0;
    inputAdjustCount.value = val + 1;
  });

  btnSellOneTicket?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    recordUndoAction({
      type: 'SELL',
      boxNumber: currentAdjustingSlot.boxNumber,
      prevTicket: currentAdjustingSlot.currentTicket
    });
    sfx.success();
    currentAdjustingSlot.currentTicket += 1;
    inputAdjustCount.value = currentAdjustingSlot.currentTicket;
    saveState(state);
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast(`🛒 Box #${currentAdjustingSlot.boxNumber} sold 1 ticket! (Now #${String(currentAdjustingSlot.currentTicket).padStart(2, '0')})`, 'success');
  });

  btnSetCountZero?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    sfx.alert();
    recordSoldOutPack(currentAdjustingSlot, currentAdjustingSlot.currentTicket);
    currentAdjustingSlot.currentTicket = 0;
    currentAdjustingSlot.status = 'EMPTY';
    currentAdjustingSlot.activatedThisShift = false;
    saveState(state);
    boxAdjustModal.close();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast(`📦 Box #${currentAdjustingSlot.boxNumber} count set to 0: marked as SOLD OUT / Empty!`, 'info');
  });

  saveBoxAdjustBtn?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    const newCount = parseInt(inputAdjustCount.value, 10);
    if (isNaN(newCount) || newCount < 0) {
      showToast('Please enter a valid ticket count (0 or higher).', 'error');
      return;
    }

    recordUndoAction({
      type: 'ADJUST_COUNT',
      boxNumber: currentAdjustingSlot.boxNumber,
      prevTicket: currentAdjustingSlot.currentTicket,
      prevStatus: currentAdjustingSlot.status
    });

    if (newCount === 0) {
      recordSoldOutPack(currentAdjustingSlot, currentAdjustingSlot.currentTicket);
      currentAdjustingSlot.currentTicket = 0;
      currentAdjustingSlot.status = 'EMPTY';
      currentAdjustingSlot.activatedThisShift = false;
      showToast(`📦 Box #${currentAdjustingSlot.boxNumber} count set to 0: marked as SOLD OUT / Empty!`, 'info');
    } else {
      currentAdjustingSlot.currentTicket = newCount;
      currentAdjustingSlot.status = 'ACTIVE';
      showToast(`✓ Box #${currentAdjustingSlot.boxNumber} count updated to #${String(newCount).padStart(2, '0')}`, 'success');
    }

    saveState(state);
    sfx.success();
    boxAdjustModal.close();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
  });
}

// -------------------------------------------------------------
// Ticket Activation & Touch Keypad Workflow
// -------------------------------------------------------------

export function formatGameTitle(price, name) {
  const clean = cleanGameTitle(name);
  if (!clean) return price ? `$${price}` : '';
  return price ? `$${price} ${clean}` : clean;
}

let isManualActivationMode = false;

function populateActivationGameDropdown() {
  const activationGameDropdown = document.getElementById('activationGameDropdown');
  if (!activationGameDropdown) return;
  activationGameDropdown.innerHTML = '';
  SAMPLE_GAMES.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.name} ($${g.price} · ${g.packSize} pk)`;
    activationGameDropdown.appendChild(opt);
  });

  activationGameDropdown.addEventListener('change', () => {
    const chosenGame = SAMPLE_GAMES.find(g => g.id === activationGameDropdown.value);
    if (chosenGame) {
      pendingActivationPack = {
        packNumber: pendingActivationPack?.packNumber || String(Math.floor(100000 + Math.random() * 900000)),
        gameId: chosenGame.id,
        gameName: chosenGame.name,
        price: chosenGame.price,
        packSize: chosenGame.packSize
      };
      activationGameTitle.textContent = formatGameTitle(chosenGame.price, chosenGame.name);
      const presetPackInput = document.getElementById('presetPackNumberInput');
      if (presetPackInput) presetPackInput.value = pendingActivationPack.packNumber;
      sfx.keypad();
    }
  });
}

function openActivationForBox(boxNumber, preselectedPack = null, forceManual = false) {
  let pack = preselectedPack;
  const activationGameDropdown = document.getElementById('activationGameDropdown');
  
  if (!pack) {
    const defaultGame = SAMPLE_GAMES.find(g => g.id === activationGameDropdown?.value) || SAMPLE_GAMES[0];
    pack = {
      packNumber: String(Math.floor(100000 + Math.random() * 900000)),
      gameId: defaultGame.id,
      gameName: defaultGame.name,
      price: defaultGame.price,
      packSize: defaultGame.packSize
    };
  }

  pendingActivationPack = pack;
  if (activationGameDropdown) {
    activationGameDropdown.value = pack.gameId;
  }
  activationGameTitle.textContent = formatGameTitle(pack.price, pack.gameName);
  keypadBoxInput.value = boxNumber || findFirstEmptyBox();

  const presetPackInput = document.getElementById('presetPackNumberInput');
  if (presetPackInput) presetPackInput.value = pack.packNumber || '';
  const presetStartInput = document.getElementById('presetStartTicketInput');
  if (presetStartInput) presetStartInput.value = 1;

  // Pre-fill manual inputs with default game if empty
  const manualName = document.getElementById('manualGameName');
  if (manualName && !manualName.value) manualName.value = pack.gameName || '';
  const manualPrice = document.getElementById('manualGamePrice');
  if (manualPrice) manualPrice.value = pack.price || 2;
  const manualPack = document.getElementById('manualPackNumber');
  if (manualPack && !manualPack.value) manualPack.value = pack.packNumber || '';
  const manualSize = document.getElementById('manualPackSize');
  if (manualSize) manualSize.value = pack.packSize || getStandardPackDetails(pack.price || 2).packSize;
  const manualStart = document.getElementById('manualStartTicket');
  if (manualStart) manualStart.value = 1;

  const boxInputHint = document.getElementById('boxInputHint');
  if (boxInputHint) {
    boxInputHint.textContent = `Assign to dispenser slot (1-${state.totalSlots} or enter higher number to add new box).`;
  }

  setActivationMode(forceManual);

  sfx.keypad();
  activationModal.showModal();
}

function setActivationMode(manual) {
  isManualActivationMode = manual;
  const btnModeDropdown = document.getElementById('btnModeDropdown');
  const btnModeManual = document.getElementById('btnModeManual');
  const activationDropdownContainer = document.getElementById('activationDropdownContainer');
  const activationManualContainer = document.getElementById('activationManualContainer');

  if (manual) {
    btnModeManual?.classList.add('active');
    btnModeDropdown?.classList.remove('active');
    if (activationManualContainer) activationManualContainer.style.display = 'block';
    if (activationDropdownContainer) activationDropdownContainer.style.display = 'none';
    const mName = document.getElementById('manualGameName')?.value.trim() || 'CUSTOM GAME';
    const mPrice = parseFloat(document.getElementById('manualGamePrice')?.value) || 1;
    activationGameTitle.textContent = formatGameTitle(mPrice, mName);
  } else {
    btnModeDropdown?.classList.add('active');
    btnModeManual?.classList.remove('active');
    if (activationDropdownContainer) activationDropdownContainer.style.display = 'flex';
    if (activationManualContainer) activationManualContainer.style.display = 'none';
    const chosenGame = SAMPLE_GAMES.find(g => g.id === document.getElementById('activationGameDropdown')?.value) || SAMPLE_GAMES[0];
    if (chosenGame) {
      activationGameTitle.textContent = formatGameTitle(chosenGame.price, chosenGame.name);
    }
  }
}

function findFirstEmptyBox() {
  const empty = state.slots.find(s => s.status !== 'ACTIVE' || !s.packNumber);
  return empty ? empty.boxNumber : 1;
}

function setupKeypad() {
  // Mode switcher listeners
  const btnModeDropdown = document.getElementById('btnModeDropdown');
  const btnModeManual = document.getElementById('btnModeManual');
  btnModeDropdown?.addEventListener('click', () => setActivationMode(false));
  btnModeManual?.addEventListener('click', () => setActivationMode(true));

  // Live title and pack size synchronization as user types custom name or price
  const manualGameNameEl = document.getElementById('manualGameName');
  const manualGamePriceEl = document.getElementById('manualGamePrice');
  const syncManualTitle = () => {
    if (isManualActivationMode) {
      const n = manualGameNameEl?.value.trim() || 'CUSTOM GAME';
      const p = parseFloat(manualGamePriceEl?.value) || 1;
      activationGameTitle.textContent = formatGameTitle(p, n);
    }
  };
  manualGameNameEl?.addEventListener('input', syncManualTitle);
  manualGamePriceEl?.addEventListener('input', () => {
    syncManualTitle();
    const p = parseFloat(manualGamePriceEl.value);
    if (!isNaN(p) && p > 0) {
      const manualPackSizeEl = document.getElementById('manualPackSize');
      if (manualPackSizeEl) {
        manualPackSizeEl.value = getStandardPackDetails(p).packSize;
      }
    }
  });

  // Connect scanner mode label ML to manual mode
  const scannerModeLabel = document.getElementById('scannerModeLabel');
  if (scannerModeLabel) {
    scannerModeLabel.addEventListener('click', () => {
      openActivationForBox(findFirstEmptyBox(), null, true);
      showToast('✍️ Manual Pack Entry (ML Mode) opened!', 'info');
    });
  }

  // Physical keyboard support for keypadBoxInput
  keypadBoxInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitBoxActivation();
    }
  });

  // Also support Enter on manual inputs
  ['manualGameName', 'manualGamePrice', 'manualPackNumber', 'manualPackSize', 'manualStartTicket', 'presetPackNumberInput', 'presetStartTicketInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitBoxActivation();
        }
      });
    }
  });

  // Numeric keypad buttons: support up to 3-digit box numbers (1-999)
  document.querySelectorAll('.key-num').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      const val = btn.getAttribute('data-val');
      if (val === '.') return; // Whole box numbers
      const current = String(keypadBoxInput.value || '');
      if (current.length < 3) {
        keypadBoxInput.value = (current === '0' || current === '') ? val : current + val;
      }
    });
  });

  // Clear & Backspace
  document.getElementById('keyClear').addEventListener('click', () => {
    sfx.keypad();
    keypadBoxInput.value = '';
  });

  document.getElementById('keyBackspace').addEventListener('click', () => {
    sfx.keypad();
    keypadBoxInput.value = String(keypadBoxInput.value).slice(0, -1);
  });

  // Enter / Add action
  document.getElementById('keyEnter').addEventListener('click', commitBoxActivation);
  btnAddBox.addEventListener('click', commitBoxActivation);

  // Steppers: allow stepping up beyond current totalSlots to add new boxes!
  stepBoxUp.addEventListener('click', () => {
    sfx.keypad();
    let num = parseInt(keypadBoxInput.value, 10) || 0;
    if (num < 100) keypadBoxInput.value = num + 1;
  });

  stepBoxDown.addEventListener('click', () => {
    sfx.keypad();
    let num = parseInt(keypadBoxInput.value, 10) || 1;
    if (num > 1) keypadBoxInput.value = num - 1;
  });

  // "Not In Box" action
  btnNotInBox.addEventListener('click', () => {
    sfx.chime();
    activationModal.close();
    showToast(`Pack #${pendingActivationPack?.packNumber || '0000'} stored in back-office inventory.`, 'info');
  });

  closeActivationBtn.addEventListener('click', () => {
    activationModal.close();
  });
}

function commitBoxActivation() {
  const boxNum = parseInt(keypadBoxInput.value, 10);
  if (!boxNum || boxNum < 1 || boxNum > 100) {
    sfx.alert();
    showToast('Please enter a valid box number between 1 and 100', 'error');
    return;
  }

  const pack = pendingActivationPack || {
    packNumber: String(Math.floor(100000 + Math.random() * 900000)),
    gameId: 'g105',
    gameName: '$5 Cash Blast',
    price: 5,
    packSize: 60
  };

  let chosenName = pack.gameName;
  let chosenPrice = pack.price;
  let chosenPack = pack.packNumber;
  let chosenSize = pack.packSize || getStandardPackDetails(chosenPrice).packSize;
  let chosenStart = 0; // Georgia Lottery packs start at ticket 00

  if (isManualActivationMode) {
    const mName = document.getElementById('manualGameName')?.value.trim();
    const mPrice = parseFloat(document.getElementById('manualGamePrice')?.value);
    const mPack = document.getElementById('manualPackNumber')?.value.trim();
    const mSize = parseInt(document.getElementById('manualPackSize')?.value, 10);
    const mStart = parseInt(document.getElementById('manualStartTicket')?.value, 10);

    if (mName) chosenName = mName;
    if (!isNaN(mPrice) && mPrice > 0) chosenPrice = mPrice;
    if (mPack) chosenPack = mPack;
    if (!isNaN(mSize) && mSize > 0) {
      chosenSize = mSize;
    } else {
      chosenSize = getStandardPackDetails(chosenPrice).packSize;
    }
    if (!isNaN(mStart) && mStart >= 0) chosenStart = mStart;
  } else {
    const pPack = document.getElementById('presetPackNumberInput')?.value.trim();
    const pStart = parseInt(document.getElementById('presetStartTicketInput')?.value, 10);
    if (pPack) chosenPack = pPack;
    if (!isNaN(pStart) && pStart >= 0) chosenStart = pStart;
    chosenSize = getStandardPackDetails(chosenPrice).packSize;
  }

  // If user enters a box number beyond current totalSlots, dynamically expand capacity!
  if (boxNum > state.totalSlots) {
    for (let i = state.totalSlots + 1; i <= boxNum; i++) {
      state.slots.push({
        boxNumber: i,
        status: 'EMPTY',
        gameId: null,
        gameName: null,
        price: null,
        packNumber: null,
        packSize: null,
        startTicket: 0,
        currentTicket: 0,
        activatedThisShift: false,
        daysActive: 0,
        scannedInEndShift: false
      });
    }
    state.totalSlots = boxNum;
    showToast(`✨ Dispenser expanded to ${state.totalSlots} boxes!`, 'info');
  }

  const targetSlot = state.slots.find(s => s.boxNumber === boxNum);
  if (!targetSlot) return;

  // If slot had an existing pack that is different from chosenPack, record it as completed/sold out!
  if (targetSlot.packNumber && targetSlot.packNumber !== chosenPack) {
    recordSoldOutPack(targetSlot, targetSlot.currentTicket);
  }

  // Remove from warehouse inventory if it was there
  state.inventory = state.inventory.filter(p => p.packNumber !== chosenPack);

  // Assign to slot with manual or chosen parameters
  const cleanName = cleanGameTitle(chosenName);
  targetSlot.status = 'ACTIVE';
  targetSlot.gameId = pack.gameId || 'custom';
  targetSlot.gameName = cleanName;
  targetSlot.price = chosenPrice;
  targetSlot.packNumber = chosenPack;
  targetSlot.packSize = chosenSize;
  targetSlot.startTicket = chosenStart;
  targetSlot.currentTicket = chosenStart;
  targetSlot.activatedThisShift = true;
  targetSlot.activatedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  targetSlot.daysActive = 1;
  targetSlot.scannedInEndShift = false;

  state.lastScannedSlot = boxNum;
  state.lastScannedBarcode = `Box #${boxNum} Activated: $${Number(chosenPrice).toFixed(2)} · ${cleanName} (Pack #${chosenPack})`;

  // Clear the dataCleared flag since user is now actively using the system
  if (state.dataCleared) delete state.dataCleared;

  recordUndoAction({
    type: 'ACTIVATION',
    boxNumber: boxNum
  });

  saveState(state);
  sfx.success();
  voice.speakReadyToSell(boxNum);
  activationModal.close();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`✓ Box #${boxNum} activated with $${Number(chosenPrice).toFixed(2)} · ${cleanName} (Pack #${chosenPack}, Start #${String(chosenStart).padStart(2, '0')})! Ready to sell.`, 'success');
  return;
}

function quickSellTicket(slot, barcodeScanned = null) {
  recordUndoAction({
    type: 'SELL',
    boxNumber: slot.boxNumber,
    prevTicket: slot.currentTicket
  });

  const cleanName = cleanGameTitle(slot.gameName);
  slot.currentTicket = (slot.currentTicket || 0) + 1;
  state.lastScannedSlot = slot.boxNumber;
  const actualBarcode = barcodeScanned || (slot.packNumber ? `${slot.gameId || '1417'}-${slot.packNumber}-${String(slot.currentTicket).padStart(3, '0')}` : `BOX-${slot.boxNumber}`);
  const bcPrefix = `[${actualBarcode}] `;
  state.lastScannedBarcode = `${bcPrefix}Box #${slot.boxNumber} · $${Number(slot.price).toFixed(2)} · ${cleanName} (Sold 1x → #${String(slot.currentTicket).padStart(2, '0')})`;

  state.lastScanData = {
    barcode: actualBarcode,
    boxNumber: slot.boxNumber,
    gameName: cleanName,
    price: slot.price,
    packNumber: slot.packNumber || '---',
    ticketNumber: slot.currentTicket,
    action: 'SOLD'
  };

  if (!state.recentScans) state.recentScans = [];
  state.recentScans.unshift({
    barcode: actualBarcode,
    boxNumber: slot.boxNumber,
    gameName: cleanName,
    price: slot.price,
    ticketNumber: slot.currentTicket,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  });
  if (state.recentScans.length > 50) state.recentScans.pop();
  
  if (slot.packSize && slot.currentTicket >= slot.packSize) {
    slot.status = 'SOLD_OUT';
    recordSoldOutPack(slot, slot.currentTicket);
    sfx.alert();
    showToast(`🚨 Box #${slot.boxNumber} (${cleanName}) is SOLD OUT! Pack completed.`, 'warning');
  } else {
    sfx.success();
    showToast(`🛒 ${bcPrefix}Sold 1x $${Number(slot.price).toFixed(2)} · ${cleanName} (Box #${slot.boxNumber})! Now #${String(slot.currentTicket).padStart(2, '0')}`, 'success');
  }

  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
}

function recordUndoAction(action) {
  undoHistory.push(action);
  if (undoHistory.length > 20) undoHistory.shift();
}

function handleUndoAction() {
  if (undoHistory.length === 0) {
    sfx.alert();
    showToast('Nothing to undo.', 'info');
    return;
  }

  const action = undoHistory.pop();
  if (action.type === 'SELL') {
    const slot = state.slots.find(s => s.boxNumber === action.boxNumber);
    if (slot && slot.currentTicket > slot.startTicket) {
      slot.currentTicket = action.prevTicket;
      saveState(state);
      sfx.keypad();
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast(`↩️ Undid sale on Box #${slot.boxNumber}. Ticket restored to #${String(slot.currentTicket).padStart(2, '0')}`, 'info');
    }
  } else if (action.type === 'ADJUST_COUNT') {
    const slot = state.slots.find(s => s.boxNumber === action.boxNumber);
    if (slot) {
      slot.currentTicket = action.prevTicket;
      slot.status = action.prevStatus;
      saveState(state);
      sfx.keypad();
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast(`↩️ Undid adjustment on Box #${slot.boxNumber}.`, 'info');
    }
  } else if (action.type === 'ACTIVATION') {
    const slot = state.slots.find(s => s.boxNumber === action.boxNumber);
    if (slot) {
      slot.status = 'EMPTY';
      slot.currentTicket = 0;
      slot.startTicket = 0;
      slot.gameId = null;
      slot.gameName = null;
      slot.price = null;
      slot.activatedThisShift = false;
      saveState(state);
      sfx.keypad();
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast(`↩️ Undid activation of Box #${slot.boxNumber}.`, 'info');
    }
  }
}

function trimRackToStandard() {
  // Check if any boxes have active packs
  const hasActivePacks = (state.slots || []).some(s => s.status === 'ACTIVE' && s.packNumber);
  if (hasActivePacks) {
    sfx.alert();
    showToast('⚠ Cannot reset: Some boxes still have active packs. Clear all boxes first, then reset.', 'error');
    return;
  }

  const MIN_SLOTS = 20;
  if (state.totalSlots <= MIN_SLOTS) {
    sfx.alert();
    showToast(`Rack is already at minimum ${MIN_SLOTS} boxes. Nothing to trim.`, 'info');
    return;
  }

  if (!confirm(`Trim rack from ${state.totalSlots} boxes down to ${MIN_SLOTS} boxes? All extra empty boxes will be removed.`)) {
    return;
  }

  state.slots = state.slots.slice(0, MIN_SLOTS);
  state.totalSlots = MIN_SLOTS;

  saveState(state);
  sfx.chime();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(`✓ Rack trimmed to ${MIN_SLOTS} boxes!`, 'success');
}

// Dedicated function to add a new dispenser box directly to the store rack
function addNewBox() {
  const newBoxNum = state.totalSlots + 1;
  state.slots.push({
    boxNumber: newBoxNum,
    status: 'EMPTY',
    gameId: null,
    gameName: null,
    price: null,
    packNumber: null,
    packSize: null,
    startTicket: 0,
    currentTicket: 0,
    activatedThisShift: false,
    daysActive: 0,
    scannedInEndShift: false
  });
  state.totalSlots = newBoxNum;

  saveState(state);
  sfx.chime();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`✓ Created Box #${newBoxNum} · Empty and ready for activation!`, 'success');
}

// -------------------------------------------------------------
// Shift Management Workflows
// -------------------------------------------------------------

function handleMainShiftAction() {
  if (state.shiftStatus === 'IN_PROGRESS') {
    // Transition to Scanning End Shift mode
    state.shiftStatus = 'SCANNING_END_SHIFT';
    state.slots.forEach(s => s.scannedInEndShift = false);
    saveState(state);
    sfx.beep();
    voice.speakStartScanning();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast('End Shift mode started! Scan or tap each active dispenser box.', 'info');
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    // Open Confirmation Dialog
    openEndShiftConfirmation();
    voice.speakEmptySlot();
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    startNewShift();
  }
}

function openEndShiftConfirmation() {
  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);
  const activeCount = state.slots.filter(isBoxActive).length;
  const activations = state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length;
  const emptySlots = state.totalSlots - activeCount;

  // Gather all sold out packs and empty dispenser boxes
  const soldOutItems = [];

  // 1. Explicitly recorded sold-out packs during this shift
  if (state.soldOutThisShift && state.soldOutThisShift.length > 0) {
    state.soldOutThisShift.forEach(so => {
      soldOutItems.push({
        boxNumber: so.boxNumber,
        gameName: so.gameName || 'Lottery Pack',
        isSoldOutPack: true
      });
    });
  }

  // 2. Any slots currently marked SOLD_OUT
  state.slots.forEach(s => {
    if (s.status === 'SOLD_OUT' && !soldOutItems.some(item => item.boxNumber === s.boxNumber)) {
      soldOutItems.push({
        boxNumber: s.boxNumber,
        gameName: s.gameName || 'Pack Sold Out',
        isSoldOutPack: true
      });
    }
  });

  // 3. All currently empty slots in the store rack (e.g. Boxes 8, 9, 10...)
  state.slots.forEach(s => {
    if (!isBoxActive(s) && !soldOutItems.some(item => item.boxNumber === s.boxNumber)) {
      soldOutItems.push({
        boxNumber: s.boxNumber,
        gameName: s.gameName ? `${s.gameName} (Empty)` : 'Empty Slot',
        isSoldOutPack: false
      });
    }
  });

  // Sort by boxNumber ascending
  soldOutItems.sort((a, b) => a.boxNumber - b.boxNumber);

  const confActiveSlotsCount = document.getElementById('confActiveSlotsCount');
  if (confActiveSlotsCount) confActiveSlotsCount.textContent = activeCount;
  confActivationCount.textContent = activations;
  confEmptySlotsCount.textContent = emptySlots;
  confTotalSlots.textContent = state.totalSlots;

  soldOutListContainer.innerHTML = '';
  if (soldOutItems.length > 0) {
    soldOutItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'sold-out-item';
      row.innerHTML = `
        <span class="sold-out-box">Box #${item.boxNumber}</span>
        <span class="sold-out-name">${item.gameName}</span>
        <span class="sold-out-tag ${item.isSoldOutPack ? '' : 'tag-empty'}">${item.isSoldOutPack ? 'SOLD OUT' : 'EMPTY'}</span>
      `;
      soldOutListContainer.appendChild(row);
    });
  } else {
    soldOutListContainer.innerHTML = '<div style="font-style:italic; color:#64748b;">None</div>';
  }

  // Pre-fill or sync drawer cash input
  const confDrawerCashInput = document.getElementById('confDrawerCashInput');
  if (confDrawerCashInput) {
    const { totalRevenue } = getShiftSalesTotals();
    if (!confDrawerCashInput.value && totalRevenue > 0) {
      confDrawerCashInput.value = totalRevenue.toFixed(2);
    }
  }

  sfx.keypad();
  endShiftConfirmModal.showModal();
  setTimeout(() => {
    confDrawerCashInput?.focus();
    confDrawerCashInput?.select();
  }, 100);
}

function confirmEndShift() {
  const confDrawerCashInput = document.getElementById('confDrawerCashInput');
  const drawerCash = parseFloat(confDrawerCashInput?.value) || 0;
  state.drawerCashCounted = drawerCash;

  // Transition shiftStatus to SHIFT_ENDED
  state.shiftStatus = 'SHIFT_ENDED';
  state.shiftEndedAt = new Date().toISOString();
  saveState(state);

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  endShiftConfirmModal.close();

  // Populate actual drawer cash in Shift Settlement Report
  const inputActualCash = document.getElementById('inputActualCashCounted');
  if (inputActualCash) {
    inputActualCash.value = drawerCash.toFixed(2);
  }
  openShiftReportModal();
}

function openShiftReportModal() {
  voice.speakReport();
  repShiftNum.textContent = `Shift #${state.shiftNumber}`;
  repCashier.textContent = state.cashierName;

  reportBodyRows.innerHTML = '';
  let totalSold = 0;
  let totalRevenue = 0;

  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);

  // 1. Render all active dispenser boxes
  state.slots.forEach(s => {
    if (isBoxActive(s)) {
      const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
      const amount = sold * (s.price || 0);
      totalSold += sold;
      totalRevenue += amount;

      const row = document.createElement('tr');
      if (sold > 0) {
        row.style.background = 'rgba(16, 185, 129, 0.12)';
        row.style.borderLeft = '4px solid var(--color-success)';
      }
      row.innerHTML = `
        <td style="font-weight:700; color:var(--color-primary);">
          Box ${s.boxNumber}
          ${sold > 0 ? `<span style="background:var(--color-success); color:#000; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:4px; margin-left:6px;">SOLD ${sold}x</span>` : ''}
        </td>
        <td>${s.gameName}</td>
        <td>$${s.price}</td>
        <td>${String(s.startTicket || 0).padStart(2, '0')}</td>
        <td style="font-weight:700;">${String(s.currentTicket || 0).padStart(2, '0')}</td>
        <td style="color:${sold > 0 ? 'var(--color-success)' : 'var(--text-primary)'}; font-weight:800;">${sold}</td>
        <td style="color:var(--color-success); font-weight:700;">$${amount.toFixed(2)}</td>
      `;
      reportBodyRows.appendChild(row);
    }
  });

  // 2. Render all completed / sold-out packs this shift (e.g. replaced or emptied boxes)
  (state.soldOutThisShift || []).forEach(so => {
    const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    const amount = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
    totalSold += sold;
    totalRevenue += amount;

    const row = document.createElement('tr');
    row.style.background = 'rgba(239, 68, 68, 0.08)';
    row.innerHTML = `
      <td style="font-weight:700; color:#ef4444;">Box ${so.boxNumber} <span style="font-size:0.68rem; background:#fee2e2; color:#b91c1c; padding:1px 5px; border-radius:4px; margin-left:4px; font-weight:800;">SOLD OUT</span></td>
      <td>${so.gameName}</td>
      <td>$${so.price}</td>
      <td>${String(so.startTicket || 0).padStart(2, '0')}</td>
      <td style="font-weight:700; color:#ef4444;">${String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(2, '0')}</td>
      <td style="color:var(--text-primary); font-weight:700;">${sold}</td>
      <td style="color:var(--color-success); font-weight:700;">$${amount.toFixed(2)}</td>
    `;
    reportBodyRows.appendChild(row);
  });

  repTicketsSold.textContent = totalSold;
  repTotalRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
  repSumSold.textContent = totalSold;
  repSumAmount.textContent = `$${totalRevenue.toFixed(2)}`;

  // Populate structured 80mm thermal print layout
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const prDateEl = document.getElementById('prDate');
  if (prDateEl) prDateEl.textContent = dateStr;

  const prTimeEl = document.getElementById('prTime');
  if (prTimeEl) prTimeEl.textContent = timeStr;

  const prShiftEl = document.getElementById('prShift');
  if (prShiftEl) prShiftEl.textContent = `#${state.shiftNumber} (${state.cashierName})`;

  const prTotalSalesEl = document.getElementById('prTotalSales');
  if (prTotalSalesEl) prTotalSalesEl.textContent = `$${totalRevenue.toFixed(2)}`;

  const prTotalTicketsEl = document.getElementById('prTotalTickets');
  if (prTotalTicketsEl) prTotalTicketsEl.textContent = totalSold;

  const activeCount = state.slots.filter(isBoxActive).length;
  const emptyCount = state.totalSlots - activeCount;
  const activationCount = state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length;

  const prActiveCountEl = document.getElementById('prActiveCount');
  if (prActiveCountEl) prActiveCountEl.textContent = activeCount;

  const prEmptyCountEl = document.getElementById('prEmptyCount');
  if (prEmptyCountEl) prEmptyCountEl.textContent = emptyCount;

  const prActivationCountEl = document.getElementById('prActivationCount');
  if (prActivationCountEl) prActivationCountEl.textContent = activationCount;

  const prEmailsEl = document.getElementById('prEmails');
  if (prEmailsEl) prEmailsEl.textContent = state.settings.targetEmails;

  const prBarcodeCodeEl = document.getElementById('prBarcodeCode');
  if (prBarcodeCodeEl) prBarcodeCodeEl.textContent = `*SHFT-402-${String(state.shiftNumber).padStart(4, '0')}-REC*`;

  const prPrintedAtEl = document.getElementById('prPrintedAt');
  if (prPrintedAtEl) prPrintedAtEl.textContent = `PRINTED: ${dateStr} ${timeStr}`;

  const prList = document.getElementById('prItemsList');
  if (prList) {
    prList.innerHTML = '';
    
    // In thermal retail receipts, only list dispenser boxes that actually had sales in this shift.
    // This keeps the receipt compact (fits on 1 roll slip) instead of printing 70 empty lines of $0.00.
    const activeSlotsWithSales = state.slots
      .filter(s => isBoxActive(s) && ((s.currentTicket || 0) - (s.startTicket || 0) > 0))
      .sort((a, b) => a.boxNumber - b.boxNumber);

    const soldOutPacks = state.soldOutThisShift || [];

    if (activeSlotsWithSales.length === 0 && soldOutPacks.length === 0) {
      const emptyRow = document.createElement('div');
      emptyRow.className = 'receipt-row';
      emptyRow.style.cssText = 'text-align:center; padding:4px 0; color:#444; font-style:italic; display:block !important; font-size:9.5px;';
      emptyRow.textContent = '-- NO LOTTERY SALES RECORDED THIS SHIFT --';
      prList.appendChild(emptyRow);
    } else {
      activeSlotsWithSales.forEach(s => {
        const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
        const amt = sold * (s.price || 0);
        const row = document.createElement('div');
        row.className = 'receipt-row has-sales';
        
        const boxStr = `#${String(s.boxNumber).padStart(2, '0')}`;
        let cleanName = (s.gameName || 'SCRATCH').trim();
        if (cleanName.length > 13) {
          cleanName = cleanName.substring(0, 13);
        }

        row.innerHTML = `
          <span class="col-box">${boxStr}</span>
          <span class="col-game">${cleanName}</span>
          <span class="col-qty">${sold}x</span>
          <span class="col-amt">$${amt.toFixed(2)}</span>
        `;
        prList.appendChild(row);
      });

      // Also include sold-out packs on the printed 80mm receipt
      soldOutPacks.forEach(so => {
        const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
        const amt = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
        const row = document.createElement('div');
        row.className = 'receipt-row has-sales';
        const boxStr = `#${String(so.boxNumber).padStart(2, '0')}*`;
        let cleanName = (so.gameName || 'SCRATCH').trim();
        if (cleanName.length > 10) cleanName = cleanName.substring(0, 10);

        row.innerHTML = `
          <span class="col-box">${boxStr}</span>
          <span class="col-game">${cleanName} (SOLD)</span>
          <span class="col-qty">${sold}x</span>
          <span class="col-amt">$${amt.toFixed(2)}</span>
        `;
        prList.appendChild(row);
      });
    }
  }

  // Cash Drawer Balancing & Reconciliation
  const inputShiftPayouts = document.getElementById('inputShiftPayouts');
  const inputDrawerFloat = document.getElementById('inputDrawerFloat');
  const recLottoSales = document.getElementById('recLottoSales');
  const recExpectedCash = document.getElementById('recExpectedCash');
  const recPayoutNote = document.getElementById('recPayoutNote');
  const inputActualCash = document.getElementById('inputActualCashCounted');
  const repDrawerBalance = document.getElementById('repDrawerBalance');
  const prDrawerBalance = document.getElementById('prDrawerBalance');
  const prTotalPayouts = document.getElementById('prTotalPayouts');
  const prExpectedCash = document.getElementById('prExpectedCash');

  if (recLottoSales) {
    recLottoSales.textContent = `$${totalRevenue.toFixed(2)}`;
  }
  if (inputShiftPayouts) {
    inputShiftPayouts.value = (state.cashes || 0) > 0 ? Number(state.cashes).toFixed(2) : '0.00';
  }
  if (inputDrawerFloat) {
    inputDrawerFloat.value = (state.drawerFloat || 0) > 0 ? Number(state.drawerFloat).toFixed(2) : '0.00';
  }

  function updateReconciliation() {
    const payouts = Math.max(0, parseFloat(inputShiftPayouts?.value) || 0);
    const floatVal = Math.max(0, parseFloat(inputDrawerFloat?.value) || 0);
    state.cashes = payouts;
    state.drawerFloat = floatVal;
    saveState(state);

    // Exact mathematical formula: Starting Bank + Scratcher Sales - Payouts
    const netLotteryCash = totalRevenue - payouts;
    const expectedDrawerCash = floatVal + netLotteryCash;

    if (recExpectedCash) {
      if (expectedDrawerCash < 0) {
        recExpectedCash.textContent = `-$${Math.abs(expectedDrawerCash).toFixed(2)}`;
        recExpectedCash.style.color = '#ef4444';
      } else {
        recExpectedCash.textContent = `$${expectedDrawerCash.toFixed(2)}`;
        recExpectedCash.style.color = 'var(--color-primary)';
      }
    }

    if (recPayoutNote) {
      if (payouts > totalRevenue && floatVal === 0) {
        recPayoutNote.style.display = 'block';
        recPayoutNote.innerHTML = `⚠️ <strong>Payouts exceed sales:</strong> Cash drawer paid out <strong>$${(payouts - totalRevenue).toFixed(2)}</strong> more in winning tickets than it took in from sales. If your register has an opening cash bank float, enter it above.`;
      } else {
        recPayoutNote.style.display = 'none';
      }
    }

    if (prTotalPayouts) prTotalPayouts.textContent = `-$${payouts.toFixed(2)}`;
    if (prExpectedCash) prExpectedCash.textContent = expectedDrawerCash < 0 ? `-$${Math.abs(expectedDrawerCash).toFixed(2)}` : `$${expectedDrawerCash.toFixed(2)}`;

    const rawCash = inputActualCash?.value !== undefined ? String(inputActualCash.value).trim() : '';
    if (rawCash === '' || isNaN(parseFloat(rawCash))) {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = 'Enter Counted Cash';
        repDrawerBalance.style.color = 'var(--text-muted)';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = 'PENDING';
      return;
    }

    const cashVal = parseFloat(rawCash) || 0;
    const diff = cashVal - expectedDrawerCash;
    if (Math.abs(diff) < 0.01) {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `$0.00 (Balanced)`;
        repDrawerBalance.style.color = 'var(--color-success)';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = `$0.00 (BALANCED)`;
    } else if (diff > 0) {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `+$${diff.toFixed(2)} OVER`;
        repDrawerBalance.style.color = 'var(--color-success)';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = `+$${diff.toFixed(2)} (OVER)`;
    } else {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `-$${Math.abs(diff).toFixed(2)} SHORT`;
        repDrawerBalance.style.color = '#ef4444';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = `-$${Math.abs(diff).toFixed(2)} (SHORT)`;
    }
  }

  if (inputShiftPayouts) {
    inputShiftPayouts.oninput = updateReconciliation;
  }
  if (inputDrawerFloat) {
    inputDrawerFloat.oninput = updateReconciliation;
  }

  if (inputActualCash) {
    inputActualCash.oninput = updateReconciliation;
    updateReconciliation();
    setTimeout(() => {
      inputActualCash.focus();
    }, 150);
  }

  sfx.chime();
  shiftReportModal.showModal();
}

function promptStartNewShift() {
  shiftReportModal.close();
  const startShiftConfirmModal = document.getElementById('startShiftConfirmModal');
  if (!startShiftConfirmModal) {
    executeStartNewShift();
    return;
  }
  const nextShift = (state.shiftNumber || 1) + 1;
  const titleEl = document.getElementById('startShiftModalTitle');
  if (titleEl) titleEl.textContent = `Start New Shift #${nextShift}`;
  const cashierInp = document.getElementById('inputNewShiftCashierName');
  if (cashierInp) cashierInp.value = state.cashierName || 'master';
  const floatInp = document.getElementById('inputNewShiftDrawerFloat');
  if (floatInp) floatInp.value = (state.drawerFloat || 0).toFixed(2);
  sfx.keypad();
  startShiftConfirmModal.showModal();
  setTimeout(() => {
    cashierInp?.focus();
    cashierInp?.select();
  }, 100);
}

function executeStartNewShift(newCashier = null, newFloat = 0) {
  const startShiftConfirmModal = document.getElementById('startShiftConfirmModal');
  if (startShiftConfirmModal && startShiftConfirmModal.open) {
    startShiftConfirmModal.close();
  }

  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);

  // Compute shift summary before closing (including active slots + sold out packs)
  const { totalSold, totalRevenue } = getShiftSalesTotals();

  state.slots.forEach(s => {
    if (isBoxActive(s)) {
      // Previous closing numbers become new open numbers!
      s.startTicket = s.currentTicket;
      s.activatedThisShift = false;
      s.scannedInEndShift = false;
      s.daysActive = (s.daysActive || 0) + 1;
    } else {
      s.status = 'EMPTY';
      s.currentTicket = 0;
      s.startTicket = 0;
      s.activatedThisShift = false;
      s.scannedInEndShift = false;
    }
  });

  // Record history
  state.shiftHistory.unshift({
    shiftNumber: state.shiftNumber,
    cashier: state.cashierName,
    startedAt: state.shiftStartedAt,
    endedAt: new Date().toISOString(),
    totalTicketsSold: totalSold,
    totalSalesRevenue: totalRevenue,
    cashes: state.cashes || 0,
    onlineSales: state.onlineSales || 0,
    onlineCashes: state.onlineCashes || 0,
    drawerFloat: state.drawerFloat || 0,
    activationsCount: state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length,
    emptySlotsCount: state.slots.filter(s => !isBoxActive(s)).length
  });

  // Advance shift number & worker
  state.shiftNumber += 1;
  if (newCashier) state.cashierName = newCashier;
  state.drawerFloat = newFloat;
  state.shiftStatus = 'IN_PROGRESS';
  state.shiftStartedAt = new Date().toISOString();
  state.soldOutThisShift = [];
  state.shiftOpeningActiveCount = state.slots.filter(isBoxActive).length;
  state.cashes = 0;
  state.onlineSales = 0;
  state.onlineCashes = 0;

  saveState(state);
  sfx.success();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`🚀 Shift #${state.shiftNumber} started by ${state.cashierName}! Opening numbers set to previous closing numbers.`, 'success');
}

const startNewShift = promptStartNewShift;

// -------------------------------------------------------------
// Update Inventory (Pack Intake) Workflow
// -------------------------------------------------------------

function openInventoryModal(tab = 'ACTIVATED') {
  setInventoryTab(tab);
  sfx.keypad();
  inventoryModal.showModal();
}

function setInventoryTab(tab) {
  const btnTabActive = document.getElementById('btnTabActiveInventory');
  const btnTabIntake = document.getElementById('btnTabIntake');
  const viewActive = document.getElementById('invViewActive');
  const viewIntake = document.getElementById('invViewIntake');
  const footerHint = document.getElementById('invFooterHint');

  if (tab === 'INTAKE') {
    btnTabIntake?.classList.add('active');
    btnTabActive?.classList.remove('active');
    if (viewIntake) viewIntake.style.display = 'block';
    if (viewActive) viewActive.style.display = 'none';
    if (footerHint) footerHint.textContent = '💡 Scan Georgia Lottery delivery pack barcode to register books into store safe.';
    renderSafeBackstockTable();
    setTimeout(() => {
      const barcodeInput = document.getElementById('inventoryBarcodeInput');
      barcodeInput?.focus();
    }, 100);
  } else {
    // ACTIVATED (default)
    btnTabActive?.classList.add('active');
    btnTabIntake?.classList.remove('active');
    if (viewActive) viewActive.style.display = 'block';
    if (viewIntake) viewIntake.style.display = 'none';
    if (footerHint) footerHint.textContent = '💡 Showing all live lottery tickets currently activated across store dispensers.';
    renderInventoryTable();
  }
  updateInventoryTabCounters();
}

function updateInventoryTabCounters() {
  const activeCount = (state.slots || []).filter(isBoxActive).length;
  const safeCount = (state.inventory || []).length;
  const navActive = document.getElementById('invNavActiveCount');
  const navSafe = document.getElementById('invNavSafeCount');
  if (navActive) navActive.textContent = activeCount;
  if (navSafe) navSafe.textContent = safeCount;
}

function renderInventoryTable() {
  if (!inventoryTableBody) return;
  inventoryTableBody.innerHTML = '';

  const activeSlots = (state.slots || []).filter(isBoxActive);
  const searchInput = document.getElementById('invSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  // Compute overall active totals across all active slots
  let totalActiveValue = 0;
  let totalActiveTickets = 0;

  activeSlots.forEach(slot => {
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const remaining = Math.max(0, totalPackSize - current);
    totalActiveTickets += remaining;
    totalActiveValue += remaining * (slot.price || 1);
  });

  const packsStat = document.getElementById('invActivePacksStat');
  const valStat = document.getElementById('invActiveValueStat');
  const tixStat = document.getElementById('invActiveTicketsStat');

  if (packsStat) packsStat.textContent = `${activeSlots.length} Packs`;
  if (valStat) valStat.textContent = `$${totalActiveValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  if (tixStat) tixStat.textContent = `${totalActiveTickets.toLocaleString()} Tickets`;

  // Apply search query filter if user typed in search box
  const filtered = query
    ? activeSlots.filter(s => {
        const name = cleanGameTitle(s.gameName).toLowerCase();
        const boxStr = String(s.boxNumber);
        const priceStr = String(s.price);
        const packStr = String(s.packNumber || '').toLowerCase();
        return name.includes(query) || boxStr === query || priceStr === query.replace('$', '') || packStr.includes(query);
      })
    : activeSlots;

  if (filtered.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="8" style="text-align:center; color:var(--text-muted); padding:28px; font-size:0.9rem;">
        ${activeSlots.length === 0 ? 'No activated tickets in dispensers. Tap any empty box to activate a ticket pack.' : `No activated tickets match "${query}".`}
      </td>
    `;
    inventoryTableBody.appendChild(emptyRow);
    updateInventoryTabCounters();
    return;
  }

  filtered.forEach(slot => {
    const row = document.createElement('tr');
    const cleanName = cleanGameTitle(slot.gameName);
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const remaining = Math.max(0, totalPackSize - current);
    const remainingVal = remaining * (slot.price || 1);

    row.innerHTML = `
      <td style="font-weight: 800; color: var(--color-primary); font-size: 0.95rem;">Box #${slot.boxNumber}</td>
      <td style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${cleanName}</td>
      <td style="font-family: monospace; font-weight: 700; color: var(--text-secondary); font-size: 0.85rem;">#${slot.packNumber || '---'}</td>
      <td style="font-weight: 800; color: var(--text-primary); font-size: 0.9rem;">$${slot.price}.00</td>
      <td>
        <span style="font-weight: 800; color: var(--color-primary); font-size: 0.9rem;">#${String(current).padStart(2, '0')}</span>
        <small style="color: var(--text-muted); font-size: 0.75rem;">/ ${totalPackSize}</small>
      </td>
      <td>
        <span style="font-weight: 700; color: #10b981; font-size: 0.85rem;">${remaining} tix</span>
        <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">$${remainingVal.toFixed(2)}</div>
      </td>
      <td>
        <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.72rem; display: inline-block;">
          ⚡ ACTIVATED
        </span>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-outline btn-manage-box" style="padding: 4px 10px; font-size: 0.75rem; font-weight: 700; border-color: var(--border-color);" data-box="${slot.boxNumber}">
          ⚙️ Box #${slot.boxNumber}
        </button>
      </td>
    `;

    row.querySelector('.btn-manage-box')?.addEventListener('click', () => {
      inventoryModal.close();
      openBoxAdjustModal(slot);
    });

    inventoryTableBody.appendChild(row);
  });

  updateInventoryTabCounters();
}

function renderSafeBackstockTable() {
  const safeTableBody = document.getElementById('inventorySafeTableBody');
  const safePacks = state.inventory || [];
  const safeCountDisplay = document.getElementById('invSafePacksCount');
  if (safeCountDisplay) safeCountDisplay.textContent = safePacks.length;
  if (!safeTableBody) return;

  safeTableBody.innerHTML = '';
  if (safePacks.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px; font-size:0.85rem;">
        No unactivated packs in safe backstock. Use Auto-Intake above to register delivery books into safe.
      </td>
    `;
    safeTableBody.appendChild(emptyRow);
    return;
  }

  safePacks.forEach(pack => {
    const row = document.createElement('tr');
    const bookVal = pack.bookValue || (pack.price * pack.packSize);
    const cleanName = cleanGameTitle(pack.gameName);

    row.innerHTML = `
      <td style="font-weight:700; color:var(--color-primary); font-family:monospace;">#${pack.packNumber}</td>
      <td style="font-weight:600;">${cleanName}</td>
      <td style="font-weight:700;">$${pack.price}.00</td>
      <td style="color:var(--color-success); font-weight:700;">$${bookVal}</td>
      <td>${pack.packSize} pk</td>
      <td><span style="background:rgba(34,197,94,0.12); color:var(--color-success); border:1px solid rgba(34,197,94,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">IN SAFE</span></td>
      <td style="text-align:center;">
        <button class="btn btn-primary btn-act-safe" style="padding:4px 10px; font-size:0.75rem; font-weight:700;" data-pack="${pack.packNumber}">
          📥 Activate into Box...
        </button>
      </td>
    `;

    row.querySelector('.btn-act-safe')?.addEventListener('click', () => {
      inventoryModal.close();
      const targetBox = prompt(`Enter Box Number to activate ${cleanName} into dispenser (e.g. 1-70):`, '1');
      const boxNum = parseInt(targetBox, 10) || findFirstEmptyBox();
      openActivationForBox(boxNum, pack);
    });

    safeTableBody.appendChild(row);
  });
}

function setupInventoryModalLogic() {
  const btnTabActive = document.getElementById('btnTabActiveInventory');
  const btnTabIntake = document.getElementById('btnTabIntake');
  const invSearchInput = document.getElementById('invSearchInput');

  btnTabActive?.addEventListener('click', () => setInventoryTab('ACTIVATED'));
  btnTabIntake?.addEventListener('click', () => setInventoryTab('INTAKE'));

  invSearchInput?.addEventListener('input', () => {
    renderInventoryTable();
  });

  const btnInvModeOld = document.getElementById('btnInvModeOld');
  const btnInvModeNew = document.getElementById('btnInvModeNew');
  const invOldTicketSection = document.getElementById('invOldTicketSection');
  const invNewTicketSection = document.getElementById('invNewTicketSection');
  const newTicketNameInput = document.getElementById('newTicketNameInput');
  const newTicketValueSelect = document.getElementById('newTicketValueSelect');
  const newBookValueInput = document.getElementById('newBookValueInput');
  const newPackNumberInput = document.getElementById('newPackNumberInput');
  const newComputedPackSize = document.getElementById('newComputedPackSize');
  const newComputedFormula = document.getElementById('newComputedFormula');
  const btnRegisterNewTicket = document.getElementById('btnRegisterNewTicket');

  function setIntakeMode(isNew) {
    if (isNew) {
      btnInvModeNew?.classList.add('active');
      btnInvModeOld?.classList.remove('active');
      if (invNewTicketSection) invNewTicketSection.style.display = 'block';
      if (invOldTicketSection) invOldTicketSection.style.display = 'none';
      setTimeout(() => newTicketNameInput?.focus(), 100);
    } else {
      btnInvModeOld?.classList.add('active');
      btnInvModeNew?.classList.remove('active');
      if (invOldTicketSection) invOldTicketSection.style.display = 'block';
      if (invNewTicketSection) invNewTicketSection.style.display = 'none';
      setTimeout(() => inventoryBarcodeInput?.focus(), 100);
    }
  }

  btnInvModeOld?.addEventListener('click', () => setIntakeMode(false));
  btnInvModeNew?.addEventListener('click', () => setIntakeMode(true));

  function updateComputedPackSize() {
    const tv = parseFloat(newTicketValueSelect?.value) || 2;
    const std = getStandardPackDetails(tv);
    
    // Auto-update book value based on ticket value if not manually overridden
    if (newBookValueInput && (!newBookValueInput.dataset.manualEdit || newBookValueInput.dataset.lastTv !== String(tv))) {
      newBookValueInput.value = std.bookValue;
      newBookValueInput.dataset.lastTv = String(tv);
    }
    
    const bv = parseFloat(newBookValueInput?.value) || std.bookValue;
    const pkSize = Math.max(1, Math.round(bv / tv));
    if (newComputedPackSize) newComputedPackSize.textContent = `${pkSize} Tickets`;
    if (newComputedFormula) newComputedFormula.textContent = `($${bv} Book ÷ $${tv} Ticket)`;
  }

  newTicketValueSelect?.addEventListener('change', () => {
    delete newBookValueInput.dataset.manualEdit;
    updateComputedPackSize();
  });
  newBookValueInput?.addEventListener('input', () => {
    newBookValueInput.dataset.manualEdit = 'true';
    updateComputedPackSize();
  });

  document.querySelectorAll('.btn-book-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (newBookValueInput) {
        newBookValueInput.value = val;
        newBookValueInput.dataset.manualEdit = 'true';
      }
      sfx.keypad();
      updateComputedPackSize();
    });
  });

  btnRegisterNewTicket?.addEventListener('click', () => {
    const rawName = newTicketNameInput?.value.trim();
    if (!rawName) {
      sfx.alert();
      showToast('Please enter a Ticket Name for the brand new game.', 'error');
      newTicketNameInput?.focus();
      return;
    }

    const price = parseFloat(newTicketValueSelect?.value) || 2;
    const std = getStandardPackDetails(price);
    const bookValue = parseFloat(newBookValueInput?.value) || std.bookValue;
    const packSize = Math.max(1, Math.round(bookValue / price));
    const rawPack = newPackNumberInput?.value.trim() || String(Math.floor(100000 + Math.random() * 900000));
    const cleanPack = rawPack.replace(/[^0-9]/g, '').slice(-7) || rawPack;

    const newGameId = 'g_' + Date.now();
    const formattedName = cleanGameTitle(rawName).toUpperCase();
    const customGame = {
      id: newGameId,
      name: formattedName,
      price: price,
      bookValue: bookValue,
      packSize: packSize,
      barcodePrefix: cleanPack.slice(0, 4)
    };

    if (!state.customGames) state.customGames = [];
    if (!state.customGames.some(g => g.name === formattedName)) {
      state.customGames.push(customGame);
    }

    const newPack = {
      packNumber: cleanPack,
      gameId: newGameId,
      gameName: formattedName,
      price: price,
      bookValue: bookValue,
      packSize: packSize,
      dateReceived: new Date().toISOString().split('T')[0],
      status: 'IN_SAFE'
    };

    state.inventory.unshift(newPack);
    saveState(state);
    sfx.chime();
    voice.speakInventoryUpdated();

    if (newTicketNameInput) newTicketNameInput.value = '';
    if (newPackNumberInput) newPackNumberInput.value = '';
    renderSafeBackstockTable();
    renderHeaderAndMetrics();
    updateInventoryTabCounters();

    showToast(`✨ Brand New Ticket Registered: ${formattedName} · Book Value: $${bookValue} · Ticket Value: $${price} (${packSize} pk) stored in safe!`, 'success');
  });

  inventoryBarcodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInventoryPackIntake();
    }
  });

  document.getElementById('inventoryAddManualBtn')?.addEventListener('click', handleInventoryPackIntake);
}

function handleInventoryPackIntake() {
  const rawInput = inventoryBarcodeInput.value.trim();
  if (!rawInput) {
    sfx.alert();
    showToast('Please scan or enter a ticket barcode.', 'error');
    return;
  }

  const cleanNum = rawInput.replace(/[^0-9]/g, '');
  const matchedGame = findGameByBarcode(rawInput, state.customGames);

  if (matchedGame) {
    // Old ticket: Take automatically!
    const packNum = cleanNum.length >= 6 ? cleanNum.slice(-7) : (rawInput || String(Math.floor(100000 + Math.random() * 900000)));
    const bookVal = matchedGame.bookValue || (matchedGame.price * matchedGame.packSize);

    const newPack = {
      packNumber: packNum,
      gameId: matchedGame.id,
      gameName: matchedGame.name,
      price: matchedGame.price,
      bookValue: bookVal,
      packSize: matchedGame.packSize,
      dateReceived: new Date().toISOString().split('T')[0],
      status: 'IN_SAFE'
    };

    state.inventory.unshift(newPack);
    saveState(state);
    sfx.success();
    voice.speakInventoryUpdated();
    inventoryBarcodeInput.value = '';

    const fb = document.getElementById('invOldAutoFeedback');
    if (fb) {
      fb.style.display = 'block';
      fb.innerHTML = `✓ Auto-Intake: <strong>${newPack.gameName}</strong> · Ticket Value: <strong>$${newPack.price}</strong> · Book Value: <strong>$${bookVal}</strong> (${newPack.packSize} pk) · Pack #${newPack.packNumber} registered in safe!`;
    }

    renderInventoryTable();
    renderHeaderAndMetrics();
    showToast(`✓ Old Ticket Auto-Intake: ${newPack.gameName} · Pack #${newPack.packNumber} ($${bookVal} Book Value) registered in safe!`, 'success');
  } else {
    // Not recognized: switch to Brand New Ticket mode!
    sfx.keypad();
    const btnInvModeNew = document.getElementById('btnInvModeNew');
    btnInvModeNew?.click();

    const newPackNumberInput = document.getElementById('newPackNumberInput');
    if (newPackNumberInput) newPackNumberInput.value = rawInput;

    const newTicketNameInput = document.getElementById('newTicketNameInput');
    newTicketNameInput?.focus();

    showToast(`✨ Brand New Ticket detected! Enter Ticket Name & Book Value to register.`, 'info');
  }
}

// -------------------------------------------------------------
// Barcode Scanner Integration (Hardware & Virtual POS Scanners)
// -------------------------------------------------------------

function setupHardwareScannerListener() {
  let scanBuffer = '';
  let lastKeystrokeTime = Date.now();

  window.addEventListener('keydown', e => {
    const activeEl = document.activeElement;
    const isTextInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    // Hardware scanners typically send Enter or NumpadEnter (or Tab) upon decoding
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      // If the main barcodeInput was active, it will handle via its own event listener
      if (activeEl === barcodeInput) {
        scanBuffer = '';
        return;
      }

      // If inventoryBarcodeInput was active, let it handle pack intake
      if (activeEl === inventoryBarcodeInput) {
        scanBuffer = '';
        return;
      }

      // If keypadBoxInput was active inside activationModal
      if (activeEl === keypadBoxInput) {
        scanBuffer = '';
        commitBoxActivation();
        e.preventDefault();
        return;
      }

      // Global scanner capture: if scanBuffer has accumulated barcode digits/text
      if (scanBuffer.length >= 2) {
        processScannedBarcode(scanBuffer.trim());
        scanBuffer = '';
        e.preventDefault();
      }
    } else if (e.key.length === 1) {
      // Don't accumulate if user is typing manually into a standard text field other than background
      if (isTextInputFocused && activeEl !== barcodeInput) {
        scanBuffer = '';
        return;
      }

      const now = Date.now();
      // Hardware barcode scanners type with < 60ms between characters; human typing is > 120ms
      if (now - lastKeystrokeTime > 120) {
        scanBuffer = ''; // Reset buffer on pause
      }
      scanBuffer += e.key;
      lastKeystrokeTime = now;
    }
  });

  // Dedicated listener for the main scanner input
  barcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      const val = barcodeInput.value.trim();
      if (val) {
        processScannedBarcode(val);
        barcodeInput.value = '';
        e.preventDefault();
      }
    }
  });
}

// Helper to detect if a scanned barcode represents a dispenser box
function parseBoxBarcode(barcode) {
  if (!barcode) return null;
  const s = String(barcode).trim();
  // Format 1: Prefix like BOX-05, BOX05, BOX 5, BOX#5, B-05, B05, B5, SLOT-05, SLOT 5, *BOX05*, etc.
  const prefixMatch = s.match(/^\*?(?:box|slot|b|bin|dispenser)[-_#\s]*(\d{1,3})\*?$/i);
  if (prefixMatch) {
    return parseInt(prefixMatch[1], 10);
  }
  // Format 2: Short 1 or 2 digit slot number (1 to 99) if string is only 1-2 digits
  if (/^\d{1,2}$/.test(s)) {
    const num = parseInt(s, 10);
    if (num >= 1 && num <= 100) return num;
  }
  return null;
}

function processScannedBarcode(rawBarcode) {
  sfx.beep();
  state.lastScannedBarcode = rawBarcode;

  // Scenario 1: Update Inventory Modal is open -> register pack into safe inventory
  if (inventoryModal && inventoryModal.open) {
    inventoryBarcodeInput.value = rawBarcode;
    handleInventoryPackIntake();
    return;
  }

  // Scenario 2: Ticket Activation Modal is open -> clerk can scan a box barcode or new pack
  if (activationModal && activationModal.open) {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);

    if (parsedBoxNum && parsedBoxNum >= 1 && parsedBoxNum <= 100) {
      keypadBoxInput.value = parsedBoxNum;
      showToast(`✓ Box #${parsedBoxNum} barcode scanned! Activating pack into Box #${parsedBoxNum}...`, 'success');
      commitBoxActivation();
      return;
    } else {
      // Scanned another pack barcode: update pack info
      const std = getStandardPackDetails(20);
      pendingActivationPack = {
        packNumber: rawBarcode.replace(/[^0-9]/g, '').slice(-6) || '889901',
        gameId: 'g' + Math.floor(100 + Math.random() * 900),
        gameName: '$20 100X THE MONEY',
        price: 20,
        packSize: std.packSize
      };
      activationGameTitle.textContent = formatGameTitle(pendingActivationPack.price, pendingActivationPack.gameName);
      showToast(`Pack #${pendingActivationPack.packNumber} scanned!`, 'info');
      return;
    }
  }

  // Scenario 3: End Shift Scanning (Verify Active Boxes)
  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    let targetSlot = null;

    if (parsedBoxNum) {
      targetSlot = state.slots.find(s => s.boxNumber === parsedBoxNum && s.status === 'ACTIVE' && s.packNumber);
    }

    // Also check if barcode matches packNumber of any active box
    if (!targetSlot) {
      targetSlot = state.slots.find(s => s.status === 'ACTIVE' && s.packNumber && rawBarcode.includes(s.packNumber));
    }

    // If no specific match, scan next unscanned active box
    if (!targetSlot || targetSlot.scannedInEndShift) {
      targetSlot = state.slots.find(s => s.status === 'ACTIVE' && s.packNumber && !s.scannedInEndShift);
    }

    if (targetSlot) {
      targetSlot.scannedInEndShift = true;
      const cleanName = cleanGameTitle(targetSlot.gameName);
      state.lastScannedSlot = targetSlot.boxNumber;
      state.lastScanData = {
        barcode: rawBarcode,
        boxNumber: targetSlot.boxNumber,
        gameName: cleanName,
        price: targetSlot.price,
        packNumber: targetSlot.packNumber || '---',
        ticketNumber: targetSlot.currentTicket || 0,
        action: 'VERIFIED'
      };
      state.lastScannedBarcode = `[${rawBarcode}] Box #${targetSlot.boxNumber} Verified: $${Number(targetSlot.price).toFixed(2)} · ${cleanName} (#${String(targetSlot.currentTicket || 0).padStart(2, '0')})`;
      showToast(`✓ Scanned [${rawBarcode}] Box #${targetSlot.boxNumber} ($${Number(targetSlot.price).toFixed(2)} · ${cleanName})`, 'success');
    } else {
      showToast('All active dispenser boxes have already been verified!', 'info');
    }
  } else {
    // Scenario 4: Normal Shift in Progress
    // 1. Check if scanned barcode is a box identifier (e.g. "3", "BOX-03", "B3")
    const scannedBoxNum = parseBoxBarcode(rawBarcode);
    if (scannedBoxNum) {
      const slot = state.slots.find(s => s.boxNumber === scannedBoxNum);
      const isBoxEmpty = !slot || slot.status !== 'ACTIVE' || !slot.packNumber;

      if (isBoxEmpty) {
        openActivationForBox(scannedBoxNum);
        showToast(`✓ Box #${scannedBoxNum} scanned: Ready to activate pack!`, 'info');
      } else {
        // Quick sell 1 ticket from that box!
        quickSellTicket(slot, rawBarcode);
      }
      return;
    }

    // 2. Check if scanned barcode matches an active game barcodePrefix, packNumber, or game name (Ready to sell!)
    const cleanNum = rawBarcode.replace(/[^0-9]/g, '');
    const activeSlotByPack = state.slots.find(s => {
      if (s.status !== 'ACTIVE' || !s.packNumber) return false;
      const p = String(s.packNumber).trim();
      const pClean = p.replace(/[^0-9]/g, '');
      return (cleanNum && cleanNum.includes(p)) || (pClean && cleanNum.includes(pClean));
    });
    const activeSlotByPrefix = state.slots.find(s => {
      if (s.status !== 'ACTIVE' || !s.packNumber) return false;
      const gameDef = SAMPLE_GAMES.find(g => g.id === s.gameId) || (state.customGames || []).find(g => g.id === s.gameId);
      if (!gameDef || !gameDef.barcodePrefix) return false;
      const prefix = String(gameDef.barcodePrefix).trim();
      return rawBarcode.startsWith(prefix) || (cleanNum && cleanNum.includes(prefix));
    });
    const activeSlotByName = state.slots.find(s => {
      if (s.status !== 'ACTIVE' || !s.packNumber || !s.gameName) return false;
      const gName = cleanGameTitle(s.gameName).toLowerCase();
      return rawBarcode.toLowerCase().includes(gName);
    });

    const activeSlotToSell = activeSlotByPack || activeSlotByPrefix || activeSlotByName;
    if (activeSlotToSell) {
      quickSellTicket(activeSlotToSell, rawBarcode);
      return;
    }

    // 3. If not an active box, this is a pack activation: look in safe inventory or detect game
    let packInfo = null;
    const invIndex = state.inventory.findIndex(p => p.packNumber && cleanNum.includes(p.packNumber));
    if (invIndex !== -1) {
      packInfo = state.inventory.splice(invIndex, 1)[0];
    } else {
      const matchedGame = findGameByBarcode(rawBarcode, state.customGames) || SAMPLE_GAMES[0];
      const std = getStandardPackDetails(matchedGame.price);
      const bookVal = matchedGame.bookValue || std.bookValue;
      packInfo = {
        packNumber: cleanNum.slice(-7) || String(Math.floor(100000 + Math.random() * 900000)),
        gameId: matchedGame.id,
        gameName: matchedGame.name,
        price: matchedGame.price,
        bookValue: bookVal,
        packSize: matchedGame.packSize || std.packSize
      };
    }

    const emptyBox = findFirstEmptyBox();
    openActivationForBox(emptyBox, packInfo);
    showToast(`Pack #${packInfo.packNumber} (${packInfo.gameName}) scanned! Assign to Box #${emptyBox} (or enter 63).`, 'info');
  }

  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
}

// -------------------------------------------------------------
// Interactive Customer Purchase & Demo Simulation
// -------------------------------------------------------------

function simulateCustomerPurchase() {
  const activeSlots = state.slots.filter(s => s.status === 'ACTIVE' && s.packNumber);
  if (activeSlots.length === 0) {
    showToast('No active dispenser boxes with tickets to sell from!', 'error');
    return;
  }

  // Pick random active box
  const target = activeSlots[Math.floor(Math.random() * activeSlots.length)];
  const cleanName = cleanGameTitle(target.gameName);
  target.currentTicket = (target.currentTicket || 0) + count;
  state.lastScannedSlot = target.boxNumber;
  state.lastScannedBarcode = `Box #${target.boxNumber} · $${Number(target.price).toFixed(2)} · ${cleanName} (Sold ${count}x → #${String(target.currentTicket).padStart(2, '0')})`;

  if (target.packSize && target.currentTicket >= target.packSize) {
    target.status = 'SOLD_OUT';
    recordSoldOutPack(target, target.currentTicket);
    sfx.alert();
    showToast(`🚨 Box #${target.boxNumber} (${cleanName}) is SOLD OUT! Pack completed.`, 'warning');
  } else {
    sfx.keypad();
    showToast(`🛒 Customer purchased ${count}x $${Number(target.price).toFixed(2)} · ${cleanName} from Box #${target.boxNumber}! (Now #${String(target.currentTicket).padStart(2, '0')})`, 'success');
  }
}

function simulateEndShiftScanAll() {
  if (state.shiftStatus !== 'SCANNING_END_SHIFT') {
    handleMainShiftAction(); // Switch to End Shift scanning first
  }

  state.slots.forEach(s => {
    if (s.status === 'ACTIVE' && s.packNumber) {
      s.scannedInEndShift = true;
    }
  });

  sfx.chime();
  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast('✓ All active dispenser boxes verified!', 'success');
}

// -------------------------------------------------------------
// Shift History Viewer
// -------------------------------------------------------------

function openHistoryModal() {
  historyTableBody.innerHTML = '';
  state.shiftHistory.forEach(h => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:var(--color-primary);">Shift #${h.shiftNumber}</td>
      <td>${h.cashier}</td>
      <td>${new Date(h.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${h.totalTicketsSold}</td>
      <td style="color:var(--color-success); font-weight:700;">$${h.totalSalesRevenue.toFixed(2)}</td>
      <td>${h.activationsCount}</td>
    `;
    historyTableBody.appendChild(row);
  });
  sfx.keypad();
  historyModal.showModal();
}

// -------------------------------------------------------------
// Toast Messages
// -------------------------------------------------------------

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : (type === 'error' ? '⚠' : 'ℹ')}</span> <div>${message}</div>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------
// Event Listeners Wire-up
// -------------------------------------------------------------

function setupEventListeners() {
  mainShiftActionBtn.addEventListener('click', handleMainShiftAction);

  cancelActionBtn.addEventListener('click', () => {
    if (state.shiftStatus === 'SCANNING_END_SHIFT') {
      state.shiftStatus = 'IN_PROGRESS';
      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast('End Shift cancelled. Resuming shift in progress.', 'info');
    }
  });

  undoActionBtn.addEventListener('click', handleUndoAction);

  const btnTrimRackBtn = document.getElementById('btnTrimRackBtn');
  if (btnTrimRackBtn) {
    btnTrimRackBtn.addEventListener('click', trimRackToStandard);
  }

  // Settings Modal controls
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingStoreName = document.getElementById('settingStoreName');
  const settingCashierName = document.getElementById('settingCashierName');
  const settingTargetEmail = document.getElementById('settingTargetEmail');
  const settingSoundToggle = document.getElementById('settingSoundToggle');

  function openSettingsModal() {
    if (!settingsModal) return;
    settingStoreName.value = state.storeName || 'LOTTO EXPRESS POS';
    settingCashierName.value = state.cashierName || 'CLERK';
    settingTargetEmail.value = state.settings?.targetEmails || 'manager@eltesystemsoftware.com';
    settingSoundToggle.checked = state.settings?.soundEnabled !== false;
    sfx.keypad();
    settingsModal.showModal();
  }

  function saveSettings() {
    state.storeName = settingStoreName.value.trim() || 'LOTTO EXPRESS POS';
    state.cashierName = settingCashierName.value.trim() || 'CLERK';
    if (!state.settings) state.settings = {};
    state.settings.targetEmails = settingTargetEmail.value.trim() || '';
    state.settings.soundEnabled = settingSoundToggle.checked;
    sfx.muted = !state.settings.soundEnabled;

    saveState(state);
    settingsModal.close();
    sfx.success();
    renderHeaderAndMetrics();
    showToast('✓ Settings updated successfully!', 'success');
  }

  closeSettingsBtn?.addEventListener('click', () => settingsModal.close());
  cancelSettingsBtn?.addEventListener('click', () => settingsModal.close());
  saveSettingsBtn?.addEventListener('click', saveSettings);

  function exportHistoryToCSV() {
    if (!state.shiftHistory || state.shiftHistory.length === 0) {
      showToast('No shift history to export yet!', 'info');
      return;
    }

    const headers = ['Shift #', 'Cashier', 'Started At', 'Ended At', 'Tickets Sold', 'Revenue ($)', 'Activations'];
    const rows = state.shiftHistory.map(h => [
      h.shiftNumber,
      `"${h.cashier || ''}"`,
      `"${h.startedAt || ''}"`,
      `"${h.endedAt || ''}"`,
      h.totalTicketsSold,
      h.totalSalesRevenue.toFixed(2),
      h.activationsCount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lotto_shift_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sfx.chime();
    showToast('✓ Shift history exported to CSV!', 'success');
  }

  const exportHistoryCsvBtn = document.getElementById('exportHistoryCsvBtn');
  if (exportHistoryCsvBtn) {
    exportHistoryCsvBtn.addEventListener('click', exportHistoryToCSV);
  }

  // End Shift Confirm Modal buttons
  closeEndShiftConfirmBtn.addEventListener('click', () => endShiftConfirmModal.close());
  confCancelBtn.addEventListener('click', () => endShiftConfirmModal.close());
  confConfirmBtn.addEventListener('click', confirmEndShift);

  // -------------------------------------------------------------
  // Thermal Slip (80mm) and Full-Page Report Printing Engine
  // -------------------------------------------------------------
  function setDynamicPrintPageSize(cssText) {
    let styleEl = document.getElementById('dynamicPrintPageStyle');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamicPrintPageStyle';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = cssText;
  }

  function printReceiptSlip() {
    document.body.classList.remove('print-fullpage-report');
    document.body.classList.remove('print-day-report');
    setDynamicPrintPageSize(`
      @page {
        size: 80mm auto !important;
        margin: 0mm !important;
      }
    `);
    sfx.chime();
    window.print();
  }

  function printFullPageReport() {
    document.body.classList.remove('print-day-report');
    document.body.classList.add('print-fullpage-report');
    setDynamicPrintPageSize(`
      @page {
        size: letter portrait !important;
        margin: 10mm !important;
      }
    `);
    sfx.chime();
    window.print();
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-fullpage-report');
    document.body.classList.remove('print-day-report');
  });

  // Shift Report Modal buttons
  closeReportBtn.addEventListener('click', () => shiftReportModal.close());
  reportPrintBtn.addEventListener('click', () => {
    printReceiptSlip();
  });
  if (reportPrintFullBtn) {
    reportPrintFullBtn.addEventListener('click', () => {
      openDayReportModal(state, sfx);
    });
  }
  reportEmailBtn.addEventListener('click', () => {
    sfx.success();
    showToast(`✓ Shift Report emailed to: ${state.settings.targetEmails}`, 'success');
  });
  reportNewShiftBtn.addEventListener('click', startNewShift);

  // Inventory Modal buttons
  tabUpdateInventory?.addEventListener('click', () => openInventoryModal());
  document.getElementById('tabInventoryStatus')?.addEventListener('click', () => openInventoryModal());
  closeInventoryBtn?.addEventListener('click', () => inventoryModal.close());
  inventoryDoneBtn?.addEventListener('click', () => inventoryModal.close());
  setupInventoryModalLogic();


  // -------------------------------------------------------------
  // 5-Step Voice-Guided Pack Intake & Shift Workflow (AMIGO FOOD MART)
  // -------------------------------------------------------------
  function initGuidedWorkflow() {
    const modal = document.getElementById('guidedWorkflowModal');
    const openBtn = document.getElementById('menuVoiceGuideBtn');
    const closeBtn = document.getElementById('closeGuidedWorkflowBtn');
    if (!modal) return;

    let currentStep = 1;

    const stepBadges = [
      document.getElementById('stepBadge1'),
      document.getElementById('stepBadge2'),
      document.getElementById('stepBadge3'),
      document.getElementById('stepBadge4'),
      document.getElementById('stepBadge5')
    ];

    const stepPanes = [
      document.getElementById('stepContainer1'),
      document.getElementById('stepContainer2'),
      document.getElementById('stepContainer3'),
      document.getElementById('stepContainer4'),
      document.getElementById('stepContainer5')
    ];

    const voiceTextEl = document.getElementById('guidedVoiceText');
    const btnReplayVoice = document.getElementById('btnReplayVoice');

    // Step 1 Elements
    const guidedBarcodeInput = document.getElementById('guidedBarcodeInput');
    const btnGuidedSimulateScan = document.getElementById('btnGuidedSimulateScan');
    const yellowTicketsGrid = document.getElementById('yellowTicketsGrid');
    const btnStep1Next = document.getElementById('btnStep1Next');

    // Step 2 Elements
    const btnFeedbackRescan = document.getElementById('btnFeedbackRescan');
    const btnFeedbackDuplicate = document.getElementById('btnFeedbackDuplicate');
    const btnFeedbackScanning = document.getElementById('btnFeedbackScanning');
    const btnFeedbackSuccess = document.getElementById('btnFeedbackSuccess');
    const guidedFeedbackLog = document.getElementById('guidedFeedbackLog');
    const btnStep2Back = document.getElementById('btnStep2Back');
    const btnStep2Next = document.getElementById('btnStep2Next');

    // Step 3 Elements
    const guidedBoxInput = document.getElementById('guidedBoxInput');
    const btnConfirmBoxNum = document.getElementById('btnConfirmBoxNum');
    const boxesMatrix65 = document.getElementById('boxesMatrix65');
    const btnStep3Back = document.getElementById('btnStep3Back');
    const btnStep3Next = document.getElementById('btnStep3Next');

    // Step 4 Elements
    const guidedEmptySlotsCount = document.getElementById('guidedEmptySlotsCount');
    const btnStepEmptyDown = document.getElementById('btnStepEmptyDown');
    const btnStepEmptyUp = document.getElementById('btnStepEmptyUp');
    const btnStep4Back = document.getElementById('btnStep4Back');
    const btnProceedActivation = document.getElementById('btnProceedActivation');

    // Step 5 Elements
    const voiceReportDateTime = document.getElementById('voiceReportDateTime');
    const btnStep5Back = document.getElementById('btnStep5Back');
    const btnVoicePrintReport = document.getElementById('btnVoicePrintReport');
    const btnSaveVoiceReport = document.getElementById('btnSaveVoiceReport');
    const btnFinishVoiceSession = document.getElementById('btnFinishVoiceSession');

    function logFeedback(msg, type = 'system') {
      if (!guidedFeedbackLog) return;
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.innerHTML = `<span class="time">${now}</span> ${msg}`;
      guidedFeedbackLog.prepend(entry);
    }

    function renderYellowTickets() {
      if (!yellowTicketsGrid) return;
      yellowTicketsGrid.innerHTML = '';
      for (let i = 0; i < 30; i++) {
        const ticketNum = String(i).padStart(3, '0');
        const card = document.createElement('div');
        card.className = 'yellow-ticket-card';
        card.title = `Ticket #${ticketNum} - Game 1898 ($3 Crossword)`;
        card.innerHTML = `
          <div class="yellow-ticket-game">GA $3</div>
          <div class="yellow-ticket-num">${ticketNum}</div>
          <div class="yellow-ticket-barcode-sim"></div>
        `;
        card.addEventListener('click', () => {
          sfx.beep();
          showToast(`Selected Yellow Ticket #${ticketNum} in Pack #0019425`, 'info');
        });
        yellowTicketsGrid.appendChild(card);
      }
    }

    function render65BoxesMatrix(targetedBox = 62) {
      if (!boxesMatrix65) return;
      boxesMatrix65.innerHTML = '';
      for (let b = 1; b <= 65; b++) {
        const cell = document.createElement('div');
        const isTarget = (b === Number(targetedBox));
        const dispenser = (state.slots || []).find(d => d.boxNumber === b);
        const isEmpty = !dispenser || dispenser.status === 'EMPTY' || !dispenser.currentTicket;

        cell.className = `box-matrix-cell ${isEmpty ? 'empty' : ''} ${isTarget ? 'targeted' : ''}`;
        cell.dataset.box = b;
        cell.innerHTML = `
          <span class="b-num">#${b}</span>
          <span class="b-tag">${isTarget ? 'TARGET' : (isEmpty ? 'EMPTY' : `$${dispenser.price || 2}`)}</span>
        `;
        cell.addEventListener('click', () => {
          if (guidedBoxInput) guidedBoxInput.value = b;
          render65BoxesMatrix(b);
          sfx.keypad();
          voice.speakBoxNumber(b);
          if (voiceTextEl) voiceTextEl.textContent = `"Box number ${b}. Select or press enter."`;
        });
        boxesMatrix65.appendChild(cell);
      }
    }

    function goToStep(stepNum) {
      currentStep = stepNum;
      stepBadges.forEach((badge, idx) => {
        if (!badge) return;
        const bStep = idx + 1;
        badge.classList.remove('active', 'completed');
        if (bStep === stepNum) badge.classList.add('active');
        else if (bStep < stepNum) badge.classList.add('completed');
      });

      stepPanes.forEach((pane, idx) => {
        if (!pane) return;
        pane.style.display = (idx + 1 === stepNum) ? 'block' : 'none';
      });

      // Step-specific voice prompts and UI setup
      if (stepNum === 1) {
        voice.speakStartScanning();
        if (voiceTextEl) voiceTextEl.textContent = '"Start scanning barcode"';
        renderYellowTickets();
      } else if (stepNum === 2) {
        voice.speakScanning();
        if (voiceTextEl) voiceTextEl.textContent = '"Scanning" / Check Result (Rescan, Duplicate, or Inventory Updated)';
      } else if (stepNum === 3) {
        voice.speakBoxPrompt();
        if (voiceTextEl) voiceTextEl.textContent = '"Box number" (Type box number e.g. 62 and press Enter)';
        const bVal = parseInt(guidedBoxInput?.value || '62', 10);
        render65BoxesMatrix(bVal);
      } else if (stepNum === 4) {
        voice.speakEmptySlot();
        if (voiceTextEl) voiceTextEl.textContent = '"Empty slot. Please check the number of empty slots to activation"';
        const emptyCount = (state.slots || []).filter(d => d.status === 'EMPTY' || !d.currentTicket).length;
        if (guidedEmptySlotsCount) guidedEmptySlotsCount.value = Math.max(1, emptyCount || 5);
      } else if (stepNum === 5) {
        voice.speakReport();
        const { totalSold, totalRevenue } = getShiftSalesTotals();
        const activeCount = (state.slots || []).filter(s => isBoxActive(s)).length;
        const totalInv = activeCount + (state.inventory || []).length;
        if (voiceTextEl) {
          voiceTextEl.textContent = `"Report" (Inventory Stats • Total Sale = $${totalRevenue.toFixed(2)})`;
        }
        if (voiceReportDateTime) {
          voiceReportDateTime.textContent = `Shift Reconciliation • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        const repSoldEl = document.getElementById('voiceReportSoldTickets');
        if (repSoldEl) repSoldEl.textContent = totalSold;
        const repActiveEl = document.getElementById('voiceReportActiveTickets');
        if (repActiveEl) repActiveEl.textContent = activeCount;
        const repInvEl = document.getElementById('voiceReportTotalInv');
        if (repInvEl) repInvEl.textContent = totalInv;
      }
    }

    // Modal Triggers
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        modal.showModal();
        goToStep(1);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.close());
    }

    // Replay Voice Button
    if (btnReplayVoice) {
      btnReplayVoice.addEventListener('click', () => {
        if (currentStep === 1) voice.speakStartScanning();
        else if (currentStep === 2) voice.speak("Rescan barcode, or inventory updated");
        else if (currentStep === 3) voice.speakBoxNumber(parseInt(guidedBoxInput?.value || '62', 10));
        else if (currentStep === 4) voice.speakEmptySlot();
        else if (currentStep === 5) voice.speakReport();
      });
    }

    // Stepper Navigation clicks
    stepBadges.forEach((badge, idx) => {
      if (badge) {
        badge.addEventListener('click', () => goToStep(idx + 1));
      }
    });

    // Step 1 Events
    if (btnGuidedSimulateScan) {
      btnGuidedSimulateScan.addEventListener('click', () => {
        sfx.beep();
        const code = guidedBarcodeInput?.value.trim() || '1898-0019425-058';
        logFeedback(`Scanned pack barcode: ${code}`, 'system');
        showToast(`✓ Scanned Pack ${code}`, 'success');
      });
    }
    if (btnStep1Next) {
      btnStep1Next.addEventListener('click', () => goToStep(2));
    }

    // Step 2 Events
    if (btnFeedbackRescan) {
      btnFeedbackRescan.addEventListener('click', () => {
        voice.speakRescan();
        if (voiceTextEl) voiceTextEl.textContent = '"Rescan barcode"';
        logFeedback('Barcode read failure -> Rescan barcode', 'rescan');
        sfx.alert();
        showToast('⚠️ Audio: "Rescan barcode" (Operator must rescan same pack)', 'warning');
      });
    }

    if (btnFeedbackDuplicate) {
      btnFeedbackDuplicate.addEventListener('click', () => {
        voice.speakDuplicateError();
        if (voiceTextEl) voiceTextEl.textContent = '"Technical error. This pack has been scanned."';
        logFeedback('Technical Error: Duplicate pack scanned -> Skipped', 'error');
        sfx.alert();
        showToast('❌ Technical error: Pack has already been scanned. Skip!', 'error');
      });
    }

    if (btnFeedbackScanning) {
      btnFeedbackScanning.addEventListener('click', () => {
        voice.speakScanning();
        if (voiceTextEl) voiceTextEl.textContent = '"Scanning... please wait 2 seconds"';
        logFeedback('System processing barcode ("Scanning")', 'scanning');
        sfx.beep();
        setTimeout(() => {
          logFeedback('Scanning complete', 'system');
          if (voiceTextEl) voiceTextEl.textContent = '"Scanning complete. Ready for next action."';
        }, 2000);
      });
    }

    if (btnFeedbackSuccess) {
      btnFeedbackSuccess.addEventListener('click', () => {
        voice.speakInventoryUpdated();
        if (voiceTextEl) voiceTextEl.textContent = '"Inventory updated"';
        logFeedback('✓ Inventory updated successfully! Advancing to Box Entry...', 'success');
        sfx.success();
        showToast('✓ Audio: "Inventory updated" - Success!', 'success');
        setTimeout(() => goToStep(3), 1200);
      });
    }

    if (btnStep2Back) btnStep2Back.addEventListener('click', () => goToStep(1));
    if (btnStep2Next) btnStep2Next.addEventListener('click', () => goToStep(3));

    // Step 3 Events
    document.querySelectorAll('.box-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.box-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const b = chip.dataset.box;
        if (guidedBoxInput) guidedBoxInput.value = b;
        render65BoxesMatrix(b);
        sfx.keypad();
        voice.speakBoxNumber(b);
      });
    });

    if (guidedBoxInput) {
      guidedBoxInput.addEventListener('change', () => {
        const val = parseInt(guidedBoxInput.value, 10) || 62;
        render65BoxesMatrix(val);
      });
      guidedBoxInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          btnConfirmBoxNum?.click();
        }
      });
    }

    if (btnConfirmBoxNum) {
      btnConfirmBoxNum.addEventListener('click', () => {
        const val = parseInt(guidedBoxInput?.value || '62', 10);
        if (isNaN(val) || val < 1 || val > 65) {
          alert('Please enter a valid box number between 1 and 65.');
          return;
        }
        sfx.success();
        voice.speakBoxNumber(val);
        goToStep(4);
      });
    }

    if (btnStep3Back) btnStep3Back.addEventListener('click', () => goToStep(2));
    if (btnStep3Next) btnStep3Next.addEventListener('click', () => goToStep(4));

    // Step 4 Events
    if (btnStepEmptyDown) {
      btnStepEmptyDown.addEventListener('click', () => {
        if (!guidedEmptySlotsCount) return;
        let c = parseInt(guidedEmptySlotsCount.value, 10) || 0;
        guidedEmptySlotsCount.value = Math.max(0, c - 1);
        sfx.keypad();
      });
    }

    if (btnStepEmptyUp) {
      btnStepEmptyUp.addEventListener('click', () => {
        if (!guidedEmptySlotsCount) return;
        let c = parseInt(guidedEmptySlotsCount.value, 10) || 0;
        guidedEmptySlotsCount.value = Math.min(65, c + 1);
        sfx.keypad();
      });
    }

    if (btnProceedActivation) {
      btnProceedActivation.addEventListener('click', () => {
        const boxNum = parseInt(guidedBoxInput?.value || '62', 10);
        // Activate Box in live POS state!
        let target = (state.slots || []).find(d => d.boxNumber === boxNum);
        if (!target) {
          target = {
            boxNumber: boxNum,
            status: 'ACTIVE',
            gameId: 'g104',
            gameName: '$3 CROSS WORD',
            price: 3,
            packNumber: '0019425',
            packSize: 30,
            startTicket: 0,
            currentTicket: 1,
            activatedThisShift: true,
            daysActive: 1,
            scannedInEndShift: false
          };
          if (!state.slots) state.slots = [];
          state.slots.push(target);
          state.slots.sort((a, b) => a.boxNumber - b.boxNumber);
        } else {
          target.status = 'ACTIVE';
          target.gameId = 'g104';
          target.gameName = '$3 CROSS WORD';
          target.price = 3;
          target.packNumber = '0019425';
          target.packSize = 30;
          target.startTicket = 0;
          target.currentTicket = 1;
          target.activatedThisShift = true;
        }

        saveState(state);
        renderDispenserRack();
        renderSlotsRibbon();
        renderHeaderAndMetrics();

        sfx.chime();
        showToast(`✨ Box #${boxNum} Activated with Georgia Lottery $3 Crossword!`, 'success');
        goToStep(5);
      });
    }

    if (btnStep4Back) btnStep4Back.addEventListener('click', () => goToStep(3));

    // Step 5 Events
    if (btnVoicePrintReport) {
      btnVoicePrintReport.addEventListener('click', () => {
        printReceiptSlip();
      });
    }

    if (btnSaveVoiceReport) {
      btnSaveVoiceReport.addEventListener('click', () => {
        saveState(state);
        sfx.success();
        showToast('✓ Shift settlement saved and synced to POS ledger!', 'success');
      });
    }

    if (btnFinishVoiceSession) {
      btnFinishVoiceSession.addEventListener('click', () => {
        voice.speakBye();
        if (voiceTextEl) voiceTextEl.textContent = '"Bye"';
        sfx.chime();
        setTimeout(() => {
          modal.close();
          showToast('🎉 Voice-Guided session successfully finished! Store: AMIGO FOOD MART', 'success');
        }, 800);
      });
    }

    if (btnStep5Back) btnStep5Back.addEventListener('click', () => goToStep(4));
  }

  // Initialize Voice Workflow Handler
  initGuidedWorkflow();

  // Menu items
  menuHistoryBtn.addEventListener('click', openHistoryModal);
  closeHistoryBtn.addEventListener('click', () => historyModal.close());
  closeHistoryBottomBtn.addEventListener('click', () => historyModal.close());
  document.getElementById('menuPrintBtn').addEventListener('click', () => {
    openShiftReportModal();
  });
  document.getElementById('tabSettlement')?.addEventListener('click', () => {
    openShiftReportModal();
  });
  document.getElementById('menuSettingsBtn').addEventListener('click', openSettingsModal);

  // Quick Cashier Switcher Dialog
  function openCashierModal() {
    const cashierModal = document.getElementById('cashierModal');
    if (!cashierModal) return;
    const shiftInfo = document.getElementById('cashierModalShiftInfo');
    if (shiftInfo) shiftInfo.textContent = `Shift #${state.shiftNumber} (${state.shiftStatus === 'IN_PROGRESS' ? 'In Progress' : 'Closed'})`;
    const nameInp = document.getElementById('inputCashierModalName');
    if (nameInp) nameInp.value = state.cashierName || 'master';
    sfx.keypad();
    cashierModal.showModal();
    setTimeout(() => {
      nameInp?.focus();
      nameInp?.select();
    }, 100);
  }

  function saveCashierModal() {
    const cashierModal = document.getElementById('cashierModal');
    const nameInp = document.getElementById('inputCashierModalName');
    const newName = nameInp?.value?.trim();
    if (!newName) {
      showToast('Please enter a worker name.', 'warning');
      return;
    }
    state.cashierName = newName;
    saveState(state);
    cashierModal?.close();
    sfx.success();
    renderHeaderAndMetrics();
    showToast(`👤 Active Worker / Cashier set to "${newName}"!`, 'success');
  }

  document.getElementById('shiftBadgeBox')?.addEventListener('click', openCashierModal);
  document.getElementById('currentCashier')?.addEventListener('click', openCashierModal);
  document.getElementById('closeCashierModalBtn')?.addEventListener('click', () => document.getElementById('cashierModal')?.close());
  document.getElementById('cancelCashierModalBtn')?.addEventListener('click', () => document.getElementById('cashierModal')?.close());
  document.getElementById('saveCashierModalBtn')?.addEventListener('click', saveCashierModal);
  document.getElementById('inputCashierModalName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCashierModal();
  });

  // Handover Start Shift Confirm Modal
  document.getElementById('closeStartShiftConfirmBtn')?.addEventListener('click', () => document.getElementById('startShiftConfirmModal')?.close());
  document.getElementById('cancelStartShiftConfirmBtn')?.addEventListener('click', () => document.getElementById('startShiftConfirmModal')?.close());
  document.getElementById('confirmStartShiftBtn')?.addEventListener('click', () => {
    const name = document.getElementById('inputNewShiftCashierName')?.value?.trim() || state.cashierName || 'master';
    const floatVal = Math.max(0, parseFloat(document.getElementById('inputNewShiftDrawerFloat')?.value) || 0);
    executeStartNewShift(name, floatVal);
  });
  document.getElementById('inputNewShiftCashierName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('confirmStartShiftBtn')?.click();
  });

  document.getElementById('menuSignOutBtn').addEventListener('click', openCashierModal);

  // Worker Quick Guide Modal
  const helpModal = document.getElementById('helpModal');
  const openHelpModal = () => {
    if (!helpModal) return;
    sfx.keypad();
    helpModal.showModal();
  };
  document.getElementById('menuHelpBtn')?.addEventListener('click', openHelpModal);
  document.getElementById('closeHelpModalBtn')?.addEventListener('click', () => helpModal?.close());
  document.getElementById('closeHelpModalBottomBtn')?.addEventListener('click', () => helpModal?.close());

  // Theme Toggles
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (drawerThemeToggleBtn) drawerThemeToggleBtn.addEventListener('click', toggleTheme);

  // Box Adjust Modal
  setupBoxAdjustModal();

  // Floating Demo Drawer
  demoFabBtn.addEventListener('click', () => {
    demoDrawer.classList.toggle('open');
  });
  closeDemoDrawer.addEventListener('click', () => {
    demoDrawer.classList.remove('open');
  });

  simCustomerBuyBtn.addEventListener('click', simulateCustomerPurchase);
  simScanNewPackBtn.addEventListener('click', () => {
    openActivationForBox(findFirstEmptyBox(), {
      packNumber: '668102',
      gameId: 'g102',
      gameName: '$2 HIT 200......',
      price: 2,
      packSize: 150
    });
  });
  simScan$20PackBtn.addEventListener('click', () => {
    openActivationForBox(findFirstEmptyBox(), {
      packNumber: '779201',
      gameId: 'g120',
      gameName: '$20 100X THE MONEY',
      price: 20,
      packSize: 30
    });
  });
  simEndShiftScanAllBtn.addEventListener('click', simulateEndShiftScanAll);

  const simSetBoxEmptyBtn = document.getElementById('simSetBoxEmptyBtn');
  if (simSetBoxEmptyBtn) {
    simSetBoxEmptyBtn.addEventListener('click', () => {
      // Find Box 19 (or Box 20 or any active box) and set its count to 0 to demonstrate turning into Box 5
      const target = state.slots.find(s => s.boxNumber === 19 && s.status === 'ACTIVE' && s.packNumber)
        || state.slots.find(s => s.boxNumber === 20 && s.status === 'ACTIVE' && s.packNumber)
        || state.slots.find(s => s.status === 'ACTIVE' && s.packNumber);

      if (target) {
        recordSoldOutPack(target, target.currentTicket);
        target.currentTicket = 0;
        target.status = 'EMPTY';
        target.activatedThisShift = false;
        saveState(state);
        sfx.alert();
        renderHeaderAndMetrics();
        renderDispenserRack();
        renderSlotsRibbon();
        showToast(`📦 Box #${target.boxNumber} (${target.gameName}) marked as SOLD OUT / Empty!`, 'info');
      } else {
        showToast('No active box with tickets available to set to 0. Activate a box first!', 'error');
      }
    });
  }

  const btnAddDispenserBoxBtn = document.getElementById('btnAddDispenserBoxBtn');
  if (btnAddDispenserBoxBtn) {
    btnAddDispenserBoxBtn.addEventListener('click', addNewBox);
  }

  const simScanBoxBarcodeBtn = document.getElementById('simScanBoxBarcodeBtn');
  if (simScanBoxBarcodeBtn) {
    simScanBoxBarcodeBtn.addEventListener('click', () => {
      processScannedBarcode('BOX-05');
    });
  }

  const simAddNewBoxBtn = document.getElementById('simAddNewBoxBtn');
  if (simAddNewBoxBtn) {
    simAddNewBoxBtn.addEventListener('click', addNewBox);
  }

  if (simResetStateBtn) {
    simResetStateBtn.addEventListener('click', () => {
      if (confirm('Erase all mock data and reset the POS to a clean slate?')) {
        state = resetToCleanState();
        state.dataCleared = true;
        saveState(state);
        initPOS();
        sfx.alert();
        showToast('All fake data erased! Clean POS ready.', 'info');
      }
    });
  }

  const menuClearDataBtn = document.getElementById('menuClearDataBtn');
  if (menuClearDataBtn) {
    menuClearDataBtn.addEventListener('click', () => {
      if (confirm('Erase all POS lottery data and reset to a fresh blank start?')) {
        state = resetToCleanState();
        state.dataCleared = true;
        saveState(state);
        initPOS();
        sfx.alert();
        showToast('All POS data wiped. Clean start ready.', 'info');
      }
    });
  }

  // Official 2-Page Day Report (AMIGO FOOD MART)
  setupDayReportHandlers(state, sfx, showToast);
}

// Launch application
initPOS();
