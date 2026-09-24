// Modern Lottery POS & Tracking System - Application Controller
import { loadState, saveState, resetToDefaults, resetToCleanState, SAMPLE_GAMES, findGameByBarcode, getStandardPackDetails, parseLotteryBarcode, normalizePackNumber } from './data.js';
import { sfx, voice } from './audio.js';
import { setupDayReportHandlers, openDayReportModal, printDayReport, populateDayReportDOM } from './dayReportRenderer.js';
import { getDayReportData } from './dayReportData.js';

let state = loadState();
let undoHistory = [];

// Auto-sanitize existing state to purge any invalid pack numbers (e.g. emojis or non-digits)
function sanitizeStatePacks(appState) {
  if (!appState || !Array.isArray(appState.slots)) return;
  let changed = false;
  appState.slots.forEach(s => {
    if (s.packNumber) {
      const clean = String(s.packNumber).replace(/[^0-9]/g, '');
      if (clean.length === 0) {
        s.packNumber = String(Math.floor(100000 + Math.random() * 900000));
        changed = true;
      } else if (clean !== String(s.packNumber)) {
        s.packNumber = clean;
        changed = true;
      }
    }
  });
  if (Array.isArray(appState.inventory)) {
    appState.inventory.forEach(p => {
      if (p.packNumber) {
        const clean = String(p.packNumber).replace(/[^0-9]/g, '');
        if (clean.length === 0) {
          p.packNumber = String(Math.floor(100000 + Math.random() * 900000));
          changed = true;
        } else if (clean !== String(p.packNumber)) {
          p.packNumber = clean;
          changed = true;
        }
      }
    });
  }

  // Auto-correct any slot, soldOutThisShift record, or inventory pack that deviates from standard pack rules:
  // - Below $50 price ticket goes for $300 pack (packSize = 300 / price)
  // - $50 and above price ticket goes for $900 pack (packSize = 900 / price, e.g. $50 -> 18 pk, $100 -> 9 pk)
  appState.slots.forEach(s => {
    if (s.price) {
      const std = getStandardPackDetails(s.price);
      if (!s.packSize) {
        s.packSize = s.initialTickets || std.packSize;
        changed = true;
      } else if (s.packSize > std.packSize) {
        s.packSize = std.packSize;
        changed = true;
      }
      const packSize = s.initialTickets || s.packSize || std.packSize;
      if (s.currentTicket > packSize || (s.status === 'ACTIVE' && s.currentTicket >= packSize)) {
        s.currentTicket = s.status === 'ACTIVE' ? Math.max(0, packSize - 1) : packSize;
        changed = true;
      }
      if (s.startTicket >= packSize) {
        s.startTicket = Math.max(0, packSize - 1);
        changed = true;
      }
    }
    // Only link a slot to soldOutThisShift if its packNumber strictly matches!
    // NEVER assume a newly activated pack with 0 sales is a sold-out pack.
    const soRecord = (appState.soldOutThisShift || []).find(
      so => so.boxNumber === s.boxNumber && so.packNumber === s.packNumber
    );
    if (soRecord) {
      if (s.status !== 'SOLD_OUT') {
        s.status = 'SOLD_OUT';
        s.currentTicket = soRecord.closeTicket || s.packSize || 1;
        changed = true;
      }
    }
  });

  // Purge any glitched sold-out record where a $50 pack prematurely sold out at 5 tickets ($250) instead of 18 tickets ($900)
  if (Array.isArray(appState.soldOutThisShift)) {
    const origLen = appState.soldOutThisShift.length;
    appState.soldOutThisShift = appState.soldOutThisShift.filter(so => {
      if ((so.packNumber === '426319' || so.gameName?.includes('500X')) && so.closeTicket === 5 && so.price === 50) {
        return false;
      }
      return true;
    });
    if (appState.soldOutThisShift.length !== origLen) {
      changed = true;
    }
  }

  // Auto-heal any lingering "Off Game" name to "Scratch-Off Game"
  appState.slots.forEach(s => {
    if (s.gameName === 'Off Game') {
      s.gameName = 'Scratch-Off Game';
      changed = true;
    }
  });
  if (Array.isArray(appState.soldOutThisShift)) {
    appState.soldOutThisShift.forEach(so => {
      if (so.gameName === 'Off Game') {
        so.gameName = 'Scratch-Off Game';
        changed = true;
      }
    });
  }

  // Auto-correct any sold-out record to ensure packSize and closeTicket obey the $300 / $900 rule
  if (Array.isArray(appState.soldOutThisShift)) {
    appState.soldOutThisShift.forEach(so => {
      if (so.price) {
        const std = getStandardPackDetails(so.price);
        if (so.packSize !== std.packSize) {
          so.packSize = std.packSize;
          changed = true;
        }
        if (so.closeTicket > so.packSize) {
          so.closeTicket = so.packSize;
          changed = true;
        }
        if (so.startTicket >= so.packSize) {
          so.startTicket = Math.max(0, so.packSize - 1);
          changed = true;
        }
        const sold = Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
        if (so.ticketsSold !== sold) {
          so.ticketsSold = sold;
          changed = true;
        }
        const amt = sold * (so.price || 0);
        if (so.salesAmount !== amt) {
          so.salesAmount = amt;
          changed = true;
        }
      }
    });
  }

  // Auto-correct inventory pack sizes
  if (Array.isArray(appState.inventory)) {
    appState.inventory.forEach(p => {
      if (p.price) {
        const std = getStandardPackDetails(p.price);
        if (p.packSize !== std.packSize) {
          p.packSize = std.packSize;
          changed = true;
        }
      }
    });
  }

  // Auto-correct custom games
  if (Array.isArray(appState.customGames)) {
    appState.customGames.forEach(cg => {
      if (cg.price) {
        const std = getStandardPackDetails(cg.price);
        if (cg.packSize !== std.packSize) {
          cg.packSize = std.packSize;
          changed = true;
        }
        if (cg.bookValue !== std.bookValue) {
          cg.bookValue = std.bookValue;
          changed = true;
        }
      }
    });
  }

  if (changed) saveState(appState);
}
sanitizeStatePacks(state);

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

  const std = getStandardPackDetails(slot.price || 2);
  const packSize = std.packSize;
  const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
  let close = closeOverride !== null 
    ? closeOverride 
    : ((slot.currentTicket !== undefined && slot.currentTicket !== null) ? slot.currentTicket : packSize);
  
  if (close > packSize) close = packSize;
  const sold = Math.max(0, close - start);
  const amount = sold * (slot.price || 0);

  const existingIdx = state.soldOutThisShift.findIndex(
    so => so.boxNumber === slot.boxNumber && so.packNumber === slot.packNumber
  );

  // If 0 tickets were sold from this pack, DO NOT record it in soldOutThisShift!
  // If it was previously recorded and now sold is 0, remove it.
  if (sold <= 0) {
    if (existingIdx >= 0) {
      state.soldOutThisShift.splice(existingIdx, 1);
    }
    return;
  }

  const record = {
    boxNumber: slot.boxNumber,
    gameName: slot.gameName,
    price: slot.price || 0,
    packNumber: slot.packNumber,
    packSize: packSize,
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
const inventoryDoneBtn = document.getElementById('inventoryDoneBtn');
const invBoxTicketBarcodeInput = document.getElementById('invBoxTicketBarcodeInput');
const btnInvBoxTicketScan = document.getElementById('btnInvBoxTicketScan');

const setTicketDetailsModal = document.getElementById('setTicketDetailsModal');
const closeSetTicketDetailsModalBtn = document.getElementById('closeSetTicketDetailsModalBtn');
const btnCancelTicketDetails = document.getElementById('btnCancelTicketDetails');
const btnTicketDetailsNext = document.getElementById('btnTicketDetailsNext');
const btnBackToTicketDetails = document.getElementById('btnBackToTicketDetails');

const setBoxModal = document.getElementById('setBoxModal');
const closeSetBoxModalBtn = document.getElementById('closeSetBoxModalBtn');
const btnCancelSetBox = document.getElementById('btnCancelSetBox');
const btnSetBoxConfirm = document.getElementById('btnSetBoxConfirm');
const setBoxNumberInput = document.getElementById('setBoxNumberInput');

const boxBarcodesModal = document.getElementById('boxBarcodesModal');
const closeBoxBarcodesBtn = document.getElementById('closeBoxBarcodesBtn');
const closeBoxBarcodesBtn2 = document.getElementById('closeBoxBarcodesBtn2');

const adjustTicketsInBox = document.getElementById('adjustTicketsInBox');
const adjustBarcodesCount = document.getElementById('adjustBarcodesCount');
const btnAdjustViewBarcodes = document.getElementById('btnAdjustViewBarcodes');

// LTSYSTEM Modals & Controls
const ticketNotInInventoryModal = document.getElementById('ticketNotInInventoryModal');
const closeTicketNotInInvBtn = document.getElementById('closeTicketNotInInvBtn');
const notInInvBarcodeDetails = document.getElementById('notInInvBarcodeDetails');
const btnConfirmNotInInvOk = document.getElementById('btnConfirmNotInInvOk');
const btnGoToUpdateInventory = document.getElementById('btnGoToUpdateInventory');

const updateSoldOutTicketModal = document.getElementById('updateSoldOutTicketModal');
const closeUpdateSoldOutBtn = document.getElementById('closeUpdateSoldOutBtn');
const soldOutGameHeader = document.getElementById('soldOutGameHeader');
const btnSoldOutNo = document.getElementById('btnSoldOutNo');
const btnSoldOutFix = document.getElementById('btnSoldOutFix');

const fixTicketPositionModal = document.getElementById('fixTicketPositionModal');
const closeFixTicketPosBtn = document.getElementById('closeFixTicketPosBtn');
const fixPosGameName = document.getElementById('fixPosGameName');
const fixPosScannedPos = document.getElementById('fixPosScannedPos');
const inputFixTicketPosition = document.getElementById('inputFixTicketPosition');
const btnCancelFixTicketPos = document.getElementById('btnCancelFixTicketPos');
const btnConfirmFixTicketPos = document.getElementById('btnConfirmFixTicketPos');

const terminalReconcileModal = document.getElementById('terminalReconcileModal');
const closeTerminalReconcileBtn = document.getElementById('closeTerminalReconcileBtn');
const inputTermOnlineSale = document.getElementById('inputTermOnlineSale');
const inputTermOnlineCashOut = document.getElementById('inputTermOnlineCashOut');
const inputTermScratchOffCash = document.getElementById('inputTermScratchOffCash');
const btnTerminalReconcileDone = document.getElementById('btnTerminalReconcileDone');

const switchBoxModal = document.getElementById('switchBoxModal');
const closeSwitchBoxBtn = document.getElementById('closeSwitchBoxBtn');
const switchBoxSourceInfo = document.getElementById('switchBoxSourceInfo');
const inputSwitchTargetBox = document.getElementById('inputSwitchTargetBox');
const btnCancelSwitchBox = document.getElementById('btnCancelSwitchBox');
const btnConfirmSwitchBox = document.getElementById('btnConfirmSwitchBox');

const changeBoxModal = document.getElementById('changeBoxModal');
const closeChangeBoxBtn = document.getElementById('closeChangeBoxBtn');
const changeBoxSourceInfo = document.getElementById('changeBoxSourceInfo');
const inputChangeTargetBox = document.getElementById('inputChangeTargetBox');
const btnCancelChangeBox = document.getElementById('btnCancelChangeBox');
const btnConfirmChangeBox = document.getElementById('btnConfirmChangeBox');

const btnBoxSwitch = document.getElementById('btnBoxSwitch');
const btnBoxChange = document.getElementById('btnBoxChange');
const btnFixPosition = document.getElementById('btnFixPosition');

const setBoxStepUp = document.getElementById('setBoxStepUp');
const setBoxStepDown = document.getElementById('setBoxStepDown');

const lastScanReadoutContainer = document.getElementById('lastScanReadoutContainer');
const calculatingSpinnerModal = document.getElementById('calculatingSpinnerModal');
const calculatingSpinnerText = document.getElementById('calculatingSpinnerText');
const calculatingSubText = document.getElementById('calculatingSubText');

let scanAlertTimeout = null;

export function clearScanAlertBanner() {
  if (scanAlertTimeout) {
    clearTimeout(scanAlertTimeout);
    scanAlertTimeout = null;
  }
  if (lastScanReadoutContainer) {
    lastScanReadoutContainer.classList.remove('alert-yellow');
  }
  if (scanActionTitle) {
    scanActionTitle.style.background = '';
    scanActionTitle.style.color = '';
    scanActionTitle.style.padding = '';
    scanActionTitle.style.borderRadius = '';
  }
  renderHeaderAndMetrics();
}

const historyModal = document.getElementById('historyModal');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const closeHistoryBottomBtn = document.getElementById('closeHistoryBottomBtn');
const historyTableBody = document.getElementById('historyTableBody');
const menuHistoryBtn = document.getElementById('menuHistoryBtn');

const toastContainer = document.getElementById('toastContainer');

// Theme Toggle References
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeToggleIcon = document.getElementById('themeToggleIcon');
const themeToggleText = document.getElementById('themeToggleText');

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
    if (notify) showToast('Switched to Dark Mode (Classic POS)', 'info');
  } else {
    if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    if (themeToggleText) themeToggleText.textContent = 'Dark Mode';
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
    // Ensure packSize matches standard rules (<$50 -> 300 / price pk / $300; >=$50 -> 900 / price pk / $900)
    if (slot.price) {
      const std = getStandardPackDetails(slot.price);
      if (!slot.packSize || slot.packSize !== std.packSize) {
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
    if (slot.status === 'EMPTY' && slot.currentTicket !== 0) {
      slot.currentTicket = 0;
      modified = true;
    }
    if (!slot.scannedBarcodes) {
      slot.scannedBarcodes = [];
      modified = true;
    }
    if (slot.ticketsInBox === undefined) {
      slot.ticketsInBox = slot.scannedBarcodes.length;
      modified = true;
    }
  });

  if (!state.inventoryBarcodes) {
    state.inventoryBarcodes = {};
    modified = true;
  }

  if (!Array.isArray(state.visibleBoxNumbers)) {
    state.visibleBoxNumbers = [];
    modified = true;
  } else {
    const filtered = state.visibleBoxNumbers.filter(bNum => {
      const s = (state.slots || []).find(x => x.boxNumber === bNum);
      return s && s.status === 'ACTIVE' && s.packNumber;
    });
    if (filtered.length !== state.visibleBoxNumbers.length) {
      state.visibleBoxNumbers = filtered;
      modified = true;
    }
  }

  if (state.dataCleared) {
    state.visibleBoxNumbers = [];
    modified = true;
  }

  // Also clean stale lastScannedBarcode and lastScanData string in state if it contained duplicated prices
  if (state.lastScannedBarcode) {
    const cleanedBarcode = state.lastScannedBarcode
      .replace(/\$\s*(\d+)\s+\$\s*\1/g, '$$$1')
      .replace(/\$+\s*\$+/g, '$');
    if (cleanedBarcode !== state.lastScannedBarcode) {
      state.lastScannedBarcode = cleanedBarcode;
      modified = true;
    }
  }

  if (state.lastScanData && state.lastScanData.gameName) {
    const cleanedGameName = cleanGameTitle(state.lastScanData.gameName);
    if (cleanedGameName !== state.lastScanData.gameName) {
      state.lastScanData.gameName = cleanedGameName;
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
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    shiftStatusBadge.className = 'btn-lt-green-progress scanning';
    shiftStatusText.textContent = 'Scanning... End Shift';
    mainShiftActionBtn.className = 'btn-lt-black-end btn-get-report';
    mainShiftActionBtn.textContent = 'Get Report';
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    shiftStatusBadge.className = 'btn-lt-green-progress ended';
    shiftStatusText.textContent = 'Shift Closed';
    mainShiftActionBtn.className = 'btn-lt-black-end btn-start-shift';
    mainShiftActionBtn.textContent = 'Start New Shift';
  }

  // Update Readout if not currently in an alert yellow state
  if (!lastScanReadoutContainer?.classList.contains('alert-yellow')) {
    if (state.shiftStatus === 'SCANNING_END_SHIFT') {
      scanActionTitle.textContent = 'Scanning...End Shift';
    } else if (state.shiftStatus === 'IN_PROGRESS') {
      scanActionTitle.textContent = 'Shift in Progress';
    } else if (state.shiftStatus === 'SHIFT_ENDED') {
      scanActionTitle.textContent = 'Shift Ended';
    }

    if (state.lastScanData) {
      const d = state.lastScanData;
      const cleanName = cleanGameTitle(d.gameName);
      const priceFmt = `$${Number(d.price || 1).toFixed(2)}`;
      lastScanDisplay.textContent = `Last Scan: ${priceFmt} · ${cleanName} (#${String(d.ticketNumber).padStart(2, '0')})`;
    } else if (state.lastScannedBarcode) {
      lastScanDisplay.textContent = `Last Scan: ${state.lastScannedBarcode}`;
    } else {
      lastScanDisplay.textContent = 'Ready for scan';
    }
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
    if (largeStatLabel) largeStatLabel.textContent = '';
  } else {
    largeStatReadout.textContent = state.lastScannedSlot || activeCount;
    if (largeStatLabel) largeStatLabel.textContent = '';
  }

  const now = new Date();
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const isThisWeek = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= oneWeekAgo && d <= now;
  };

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // 1. Calculate current sales this shift (from active slots + packs sold out this shift)
  const { totalSold, totalRevenue } = getShiftSalesTotals();
  const currentShiftSales = totalRevenue;
  const currentShiftTickets = totalSold;

  // 2. Aggregate across past shifts properly by date
  const todayPastTickets = (state.shiftHistory || [])
    .filter(h => isToday(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);
  const totalTodayTickets = todayPastTickets + currentShiftTickets;

  const weekPastTickets = (state.shiftHistory || [])
    .filter(h => isThisWeek(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);
  const totalWeekTickets = weekPastTickets + currentShiftTickets;

  const monthPastTickets = (state.shiftHistory || [])
    .filter(h => isThisMonth(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);
  const totalMonthTickets = monthPastTickets + currentShiftTickets;

  if (metricSettlement) metricSettlement.textContent = `$${currentShiftSales.toFixed(2)}`;
  if (metricToday) metricToday.textContent = totalTodayTickets;
  if (metricThisWeek) metricThisWeek.textContent = totalWeekTickets;
  if (metricThisMonth) metricThisMonth.textContent = totalMonthTickets;
  if (metricInactive) metricInactive.textContent = emptyCount;
  const soldOutCount = (state.soldOutThisShift || []).length;
  if (metricInventoryCount) {
    if (activeCount > 0) {
      metricInventoryCount.textContent = `${activeCount} Packs`;
    } else if (soldOutCount > 0) {
      metricInventoryCount.textContent = `${soldOutCount} Finished`;
    } else {
      metricInventoryCount.textContent = '0 Packs';
    }
  }

  if (ribbonActiveCount) ribbonActiveCount.textContent = activeCount;
  if (ribbonEmptyCount) ribbonEmptyCount.textContent = emptyCount;

  const totalSlotsCountDisplay = document.getElementById('totalSlotsCountDisplay');
  if (totalSlotsCountDisplay) {
    totalSlotsCountDisplay.textContent = state.totalSlots;
  }

  // Live real-time update of Inventory Status modal if open (rising counts, tickets left)!
  if (inventoryModal && inventoryModal.open) {
    renderInventoryTable();
  }
}

const VISIBLE_RACK_CAPACITY = 20;

function ensureVisibleBoxesInitialized() {
  if (!Array.isArray(state.visibleBoxNumbers)) {
    // Scan-to-Appear: Rack starts empty until tickets are scanned or boxes are activated!
    state.visibleBoxNumbers = [];
  } else {
    // Purge any box numbers that are no longer active or have no pack
    state.visibleBoxNumbers = state.visibleBoxNumbers.filter(bNum => {
      const s = (state.slots || []).find(x => x.boxNumber === bNum);
      return s && s.status === 'ACTIVE' && s.packNumber;
    });
  }
  if (!state.boxAccessTimes) {
    state.boxAccessTimes = {};
  }
}

function bringBoxToVisibleRack(boxNumber) {
  if (!boxNumber) return;
  ensureVisibleBoxesInitialized();

  // Verify the slot is active and has a pack
  const slot = (state.slots || []).find(s => s.boxNumber === boxNumber);
  if (!slot || slot.status !== 'ACTIVE' || !slot.packNumber) {
    return;
  }

  const now = Date.now();
  state.boxAccessTimes[boxNumber] = now;

  const idx = state.visibleBoxNumbers.indexOf(boxNumber);
  if (idx !== -1) {
    // Box is already visible in the rack: update access time
    saveState(state);
    return;
  }

  // Not in visible rack yet:
  if (state.visibleBoxNumbers.length < VISIBLE_RACK_CAPACITY) {
    state.visibleBoxNumbers.push(boxNumber);
  } else {
    // Rack is full (20 boxes): Replace the oldest / least recently accessed box!
    let oldestIdx = 0;
    let oldestTime = Infinity;

    state.visibleBoxNumbers.forEach((bNum, i) => {
      const t = state.boxAccessTimes[bNum] || 0;
      if (t < oldestTime) {
        oldestTime = t;
        oldestIdx = i;
      }
    });

    state.visibleBoxNumbers[oldestIdx] = boxNumber;
  }

  saveState(state);
}

function renderDispenserRack() {
  dispensersGrid.innerHTML = '';
  ensureVisibleBoxesInitialized();

  // If no boxes are scanned/active yet, the rack must stay completely empty!
  if (!state.visibleBoxNumbers || state.visibleBoxNumbers.length === 0) {
    return;
  }

  // Exactly 2 rows x 10 columns layout matching real LTSYSTEM counter rack (Zero scroll in any direction)
  dispensersGrid.style.gridTemplateColumns = 'repeat(10, minmax(0, 1fr))';
  dispensersGrid.style.gridTemplateRows = 'repeat(2, minmax(0, 1fr))';

  state.visibleBoxNumbers.forEach(boxNum => {
    const slot = state.slots.find(s => s.boxNumber === boxNum);
    if (!slot || slot.status !== 'ACTIVE' || !slot.packNumber) {
      return; // Do NOT render empty slot cards in the rack!
    }

    const card = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';
    const isLastScanned = state.lastScannedSlot === slot.boxNumber;

    let ageBoxClass = '';
    if (slot.daysActive >= 21) {
      ageBoxClass = 'age-21-box';
    } else if (slot.daysActive >= 12) {
      ageBoxClass = 'age-12-box';
    } else if (slot.daysActive >= 7) {
      ageBoxClass = 'age-7-box';
    }

    card.className = `box-card active ${ageBoxClass} ${isLastScanned ? 'selected-box-card' : ''} ${isScanning ? (slot.scannedInEndShift ? 'scanned-done' : 'scanning-target') : ''}`;
    card.dataset.box = slot.boxNumber;

    const cleanName = cleanGameTitle(slot.gameName);
    const std = getStandardPackDetails(slot.price || 1);
    const packSize = slot.initialTickets || slot.packSize || std.packSize || 100;
    const soldTickets = slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0;
    const remainingInBox = Math.max(0, packSize - soldTickets);
    const displayCount = String(remainingInBox);
    card.innerHTML = `
      <div class="card-header-row">
        <span class="price-tag">$${slot.price}</span>
        ${!isScanning ? `<button class="quick-sell-btn" data-box="${slot.boxNumber}" title="Quick Sell 1 Ticket">+1</button>` : ''}
      </div>
      <div class="card-center-body">
        <div class="box-main-number">${slot.boxNumber}</div>
        <div class="game-title-strip" title="${cleanName}">${cleanName}</div>
        ${slot.activatedThisShift ? '<div class="new-activation-text" title="New Activation">New Activation</div>' : ''}
      </div>
      <div class="card-dashed-line"></div>
      <div class="card-footer-row ${isScanning ? 'is-scanning' : ''}">
        <span class="ticket-number-display ticket-sold-count ${isScanning ? 'scanning-num' : ''}" title="Remaining: ${remainingInBox} tickets left in box (${soldTickets} sold)">${displayCount}</span>
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

    dispensersGrid.appendChild(card);
  });
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
      bringBoxToVisibleRack(slot.boxNumber);
      handleBoxCardClick(slot);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
    });

    slotsRibbon.appendChild(cell);
  });
}

// -------------------------------------------------------------
// Interactive Behaviors & Box Click
// -------------------------------------------------------------

function handleBoxCardClick(slot) {
  if (slot && slot.boxNumber) {
    bringBoxToVisibleRack(slot.boxNumber);
  }
  const isBoxActive = Boolean(slot && slot.status === 'ACTIVE' && slot.packNumber);

  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    if (isBoxActive) {
      const prevTicket = slot.currentTicket;
      const prevScanned = slot.scannedInEndShift;
      slot.scannedInEndShift = true;
      recordUndoAction({
        type: 'VERIFY_END_SHIFT',
        boxNumber: slot.boxNumber,
        prevTicket: prevTicket,
        prevScannedInEndShift: prevScanned
      });
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
    } else {
      sfx.alert();
      showToast(`Box #${slot.boxNumber} is empty and does not require verification.`, 'info');
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

// Return Pack Modal References
const returnPackModal = document.getElementById('returnPackModal');
const btnReturnPack = document.getElementById('btnReturnPack');
const closeReturnPackBtn = document.getElementById('closeReturnPackBtn');
const cancelReturnPackBtn = document.getElementById('cancelReturnPackBtn');
const confirmReturnPackBtn = document.getElementById('confirmReturnPackBtn');
const returnPackGameTitle = document.getElementById('returnPackGameTitle');
const returnPackSerial = document.getElementById('returnPackSerial');
const returnPackBoxNum = document.getElementById('returnPackBoxNum');
const returnPackPriceTag = document.getElementById('returnPackPriceTag');
const returnPackSoldTickets = document.getElementById('returnPackSoldTickets');
const returnPackSoldAmount = document.getElementById('returnPackSoldAmount');
const returnPackReturnedTickets = document.getElementById('returnPackReturnedTickets');
const returnPackReturnedAmount = document.getElementById('returnPackReturnedAmount');
const returnPackNoteSold = document.getElementById('returnPackNoteSold');

export function showModalError(bannerId, msg, targetInput = null) {
  const banner = document.getElementById(bannerId);
  if (banner) {
    banner.innerHTML = `<span>⚠️</span> <div>${msg}</div>`;
    banner.style.display = 'flex';
  }
  if (targetInput) {
    targetInput.classList.add('input-error-highlight');
    targetInput.focus();
    targetInput.select?.();
    targetInput.addEventListener('input', () => {
      targetInput.classList.remove('input-error-highlight');
      if (banner) banner.style.display = 'none';
    }, { once: true });
  }
  sfx.alert();
  showToast(msg, 'error');
}

export function clearModalError(bannerId, ...inputs) {
  const banner = document.getElementById(bannerId);
  if (banner) banner.style.display = 'none';
  inputs.forEach(inp => {
    if (inp) inp.classList.remove('input-error-highlight');
  });
}

function updateAdjustModalDynamicStats() {
  if (!currentAdjustingSlot) return;
  const std = getStandardPackDetails(currentAdjustingSlot.price || 2);
  const packSize = currentAdjustingSlot.packSize || std.packSize;
  const start = (currentAdjustingSlot.startTicket !== undefined && currentAdjustingSlot.startTicket !== null) ? currentAdjustingSlot.startTicket : 0;
  let curr = parseInt(inputAdjustCount?.value, 10);
  if (isNaN(curr)) curr = currentAdjustingSlot.currentTicket !== undefined ? currentAdjustingSlot.currentTicket : 0;
  if (curr < 0) curr = 0;
  if (curr > packSize) curr = packSize;

  const soldThisShift = Math.max(0, curr - start);
  const remainingInBox = Math.max(0, packSize - curr);
  const price = currentAdjustingSlot.price || 0;

  const adjustSoldThisShift = document.getElementById('adjustSoldThisShift');
  if (adjustSoldThisShift) {
    adjustSoldThisShift.textContent = `${soldThisShift} tix ($${(soldThisShift * price).toFixed(2)})`;
  }
  if (adjustTicketsInBox) {
    adjustTicketsInBox.textContent = `${remainingInBox} tix`;
  }
}

function openBoxAdjustModal(slot) {
  currentAdjustingSlot = slot;
  if (!boxAdjustModal) return;
  clearModalError('boxAdjustErrorBanner', inputAdjustCount);

  const std = getStandardPackDetails(slot.price || 2);
  const packSize = slot.packSize || std.packSize;
  const currentTicket = slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0;
  const startTicket = slot.startTicket !== undefined && slot.startTicket !== null ? slot.startTicket : 0;

  adjustModalTitle.textContent = `Dispenser Box #${slot.boxNumber} Details`;
  adjustGameName.textContent = cleanGameTitle(slot.gameName);
  adjustPriceTag.textContent = `$${slot.price}`;
  adjustPriceTag.className = `price-tag p${slot.price}`;
  adjustPackNum.textContent = `#${slot.packNumber || '884901'}`;
  adjustPackSize.textContent = `${packSize} pk`;
  adjustStartTicket.textContent = `#${String(startTicket).padStart(2, '0')}`;
  adjustDaysActive.textContent = `${slot.daysActive || 1} Day${(slot.daysActive || 1) === 1 ? '' : 's'}`;
  if (inputAdjustCount) inputAdjustCount.value = currentTicket;

  const soldThisShift = Math.max(0, currentTicket - startTicket);
  const remainingInBox = Math.max(0, packSize - currentTicket);

  const adjustSoldThisShift = document.getElementById('adjustSoldThisShift');
  if (adjustSoldThisShift) {
    adjustSoldThisShift.textContent = `${soldThisShift} tix ($${(soldThisShift * (slot.price || 0)).toFixed(2)})`;
  }

  const chkSetAsStartingTicket = document.getElementById('chkSetAsStartingTicket');
  if (chkSetAsStartingTicket) {
    chkSetAsStartingTicket.checked = (soldThisShift === 0);
  }

  if (adjustTicketsInBox) {
    adjustTicketsInBox.textContent = `${remainingInBox} tix`;
  }
  if (adjustBarcodesCount) {
    adjustBarcodesCount.textContent = (slot.scannedBarcodes || []).length;
  }

  sfx.keypad();
  boxAdjustModal.showModal();
}

function openReturnPackModal(slot) {
  if (!returnPackModal || !slot) return;
  const std = getStandardPackDetails(slot.price || 2);
  const packSize = slot.packSize || std.packSize;
  const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
  let curr = parseInt(inputAdjustCount?.value, 10);
  if (isNaN(curr)) curr = slot.currentTicket !== undefined ? slot.currentTicket : 0;
  if (curr > packSize) curr = packSize;
  if (curr < start) curr = start;

  const sold = Math.max(0, curr - start);
  const returned = Math.max(0, packSize - curr);
  const price = slot.price || 0;
  const soldAmt = sold * price;
  const returnedAmt = returned * price;

  if (returnPackGameTitle) returnPackGameTitle.textContent = cleanGameTitle(slot.gameName || 'Lottery Pack');
  if (returnPackSerial) returnPackSerial.textContent = slot.packNumber || '---';
  if (returnPackBoxNum) returnPackBoxNum.textContent = slot.boxNumber;
  if (returnPackPriceTag) {
    returnPackPriceTag.textContent = `$${price}`;
    returnPackPriceTag.className = `price-tag p${price}`;
  }
  if (returnPackSoldTickets) returnPackSoldTickets.textContent = `${sold}`;
  if (returnPackSoldAmount) returnPackSoldAmount.textContent = `+$${soldAmt.toFixed(2)} Sales`;
  if (returnPackReturnedTickets) returnPackReturnedTickets.textContent = `${returned}`;
  if (returnPackReturnedAmount) returnPackReturnedAmount.textContent = `$${returnedAmt.toFixed(2)} Value`;
  if (returnPackNoteSold) returnPackNoteSold.textContent = `$${soldAmt.toFixed(2)}`;

  sfx.keypad();
  returnPackModal.showModal();
}

function handleConfirmReturnPack() {
  if (!currentAdjustingSlot || !currentAdjustingSlot.packNumber) {
    returnPackModal?.close();
    return;
  }

  const slot = currentAdjustingSlot;
  const std = getStandardPackDetails(slot.price || 2);
  const packSize = slot.packSize || std.packSize;
  const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
  let curr = parseInt(inputAdjustCount?.value, 10);
  if (isNaN(curr)) curr = slot.currentTicket !== undefined ? slot.currentTicket : 0;
  if (curr > packSize) curr = packSize;
  if (curr < start) curr = start;

  const sold = Math.max(0, curr - start);
  const returned = Math.max(0, packSize - curr);
  const price = slot.price || 0;
  const soldAmt = sold * price;
  const returnedAmt = returned * price;

  recordUndoAction({
    type: 'RETURN_PACK',
    boxNumber: slot.boxNumber,
    slotSnapshot: JSON.parse(JSON.stringify(slot))
  });

  if (!state.soldOutThisShift) state.soldOutThisShift = [];
  const existingIdx = state.soldOutThisShift.findIndex(
    so => so.boxNumber === slot.boxNumber && so.packNumber === slot.packNumber
  );

  const returnRecord = {
    boxNumber: slot.boxNumber,
    gameName: slot.gameName,
    price: price,
    packNumber: slot.packNumber,
    packSize: packSize,
    startTicket: start,
    closeTicket: curr,
    ticketsSold: sold,
    salesAmount: soldAmt,
    ticketsReturned: returned,
    returnedAmount: returnedAmt,
    isReturned: true,
    soldAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };

  if (existingIdx >= 0) {
    state.soldOutThisShift[existingIdx] = returnRecord;
  } else {
    state.soldOutThisShift.push(returnRecord);
  }

  // Increment discontinued packs count for official Georgia Lottery Day Report
  state.discontinuedCount = (state.discontinuedCount || 0) + 1;

  // Empty the dispenser box
  slot.currentTicket = 0;
  slot.startTicket = 0;
  slot.status = 'EMPTY';
  slot.packNumber = '';
  slot.gameName = '';
  slot.price = null;
  slot.gameId = null;
  slot.activatedThisShift = false;
  slot.scannedBarcodes = [];
  slot.ticketsInBox = 0;

  saveState(state);
  sfx.alert();
  returnPackModal?.close();
  boxAdjustModal?.close();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`↩️ Box #${returnRecord.boxNumber} returned: ${sold} sold ($${soldAmt.toFixed(2)}), ${returned} returned to lottery ($${returnedAmt.toFixed(2)}). Box emptied.`, 'info');
}

function setupBoxAdjustModal() {
  if (!boxAdjustModal) return;

  closeBoxAdjustBtn?.addEventListener('click', () => boxAdjustModal.close());
  cancelBoxAdjustBtn?.addEventListener('click', () => boxAdjustModal.close());
  btnAdjustViewBarcodes?.addEventListener('click', () => {
    if (currentAdjustingSlot) {
      openBoxBarcodesModal(currentAdjustingSlot);
    }
  });

  // Return Pack Modal Wire-up
  closeReturnPackBtn?.addEventListener('click', () => returnPackModal?.close());
  cancelReturnPackBtn?.addEventListener('click', () => returnPackModal?.close());
  confirmReturnPackBtn?.addEventListener('click', handleConfirmReturnPack);

  btnReturnPack?.addEventListener('click', () => {
    if (!currentAdjustingSlot || currentAdjustingSlot.status !== 'ACTIVE' || !currentAdjustingSlot.packNumber) {
      sfx.alert();
      showToast('⚠️ No active lottery pack in this box to return.', 'warning');
      return;
    }
    openReturnPackModal(currentAdjustingSlot);
  });

  // LTSYSTEM Box Controls
  btnBoxSwitch?.addEventListener('click', () => {
    if (currentAdjustingSlot) openSwitchBoxModal(currentAdjustingSlot);
  });
  btnBoxChange?.addEventListener('click', () => {
    if (currentAdjustingSlot) openChangeBoxModal(currentAdjustingSlot);
  });
  btnFixPosition?.addEventListener('click', () => {
    if (currentAdjustingSlot) openFixTicketPositionModal(currentAdjustingSlot);
  });

  inputAdjustCount?.addEventListener('input', updateAdjustModalDynamicStats);

  btnCountMinus?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(inputAdjustCount.value, 10) || 0;
    if (val > 0) inputAdjustCount.value = val - 1;
    updateAdjustModalDynamicStats();
  });

  btnCountPlus?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(inputAdjustCount.value, 10) || 0;
    inputAdjustCount.value = val + 1;
    updateAdjustModalDynamicStats();
  });

  btnSellOneTicket?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    const std = getStandardPackDetails(currentAdjustingSlot.price || 2);
    const packSize = currentAdjustingSlot.packSize || std.packSize;
    const nextTicket = (currentAdjustingSlot.currentTicket || 0) + 1;

    recordUndoAction({
      type: 'SELL',
      boxNumber: currentAdjustingSlot.boxNumber,
      prevTicket: currentAdjustingSlot.currentTicket
    });

    if (nextTicket >= packSize) {
      currentAdjustingSlot.currentTicket = packSize;
      currentAdjustingSlot.status = 'SOLD_OUT';
      recordSoldOutPack(currentAdjustingSlot, packSize);
      sfx.alert();
      boxAdjustModal.close();
      const totalAmt = packSize * (currentAdjustingSlot.price || 0);
      showToast(`🚨 Box #${currentAdjustingSlot.boxNumber} (${cleanGameTitle(currentAdjustingSlot.gameName)}) is SOLD OUT! Pack completed (${packSize} tickets = $${totalAmt.toFixed(2)}).`, 'warning');
    } else {
      sfx.success();
      currentAdjustingSlot.currentTicket = nextTicket;
      inputAdjustCount.value = currentAdjustingSlot.currentTicket;
      updateAdjustModalDynamicStats();
      showToast(`🛒 Box #${currentAdjustingSlot.boxNumber} sold 1 ticket! (Now #${String(currentAdjustingSlot.currentTicket).padStart(2, '0')})`, 'success');
    }

    saveState(state);
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
  });

  const btnMarkPackSoldOut = document.getElementById('btnMarkPackSoldOut');
  btnMarkPackSoldOut?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    const std = getStandardPackDetails(currentAdjustingSlot.price || 2);
    const packSize = currentAdjustingSlot.packSize || std.packSize;
    
    recordUndoAction({
      type: 'ADJUST_COUNT',
      boxNumber: currentAdjustingSlot.boxNumber,
      prevTicket: currentAdjustingSlot.currentTicket,
      prevStatus: currentAdjustingSlot.status
    });

    currentAdjustingSlot.currentTicket = packSize;
    currentAdjustingSlot.status = 'SOLD_OUT';
    recordSoldOutPack(currentAdjustingSlot, packSize);
    saveState(state);
    sfx.alert();
    boxAdjustModal.close();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    const totalAmt = packSize * (currentAdjustingSlot.price || 0);
    showToast(`🚨 Box #${currentAdjustingSlot.boxNumber} marked FULLY SOLD OUT (${packSize} tickets = $${totalAmt.toFixed(2)})!`, 'warning');
  });

  btnSetCountZero?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    sfx.alert();
    if ((currentAdjustingSlot.currentTicket || 0) > 0) {
      recordSoldOutPack(currentAdjustingSlot, currentAdjustingSlot.currentTicket);
    }
    currentAdjustingSlot.currentTicket = 0;
    currentAdjustingSlot.status = 'EMPTY';
    currentAdjustingSlot.activatedThisShift = false;
    saveState(state);
    boxAdjustModal.close();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast(`📦 Box #${currentAdjustingSlot.boxNumber} emptied.`, 'info');
  });

  saveBoxAdjustBtn?.addEventListener('click', () => {
    if (!currentAdjustingSlot || !inputAdjustCount) {
      boxAdjustModal?.close();
      return;
    }
    clearModalError('boxAdjustErrorBanner', inputAdjustCount);
    const newCount = parseInt(inputAdjustCount.value, 10);
    if (isNaN(newCount) || newCount < 0) {
      showModalError('boxAdjustErrorBanner', 'Please enter a valid ticket count (0 or higher).', inputAdjustCount);
      return;
    }

    const std = getStandardPackDetails(currentAdjustingSlot.price || 2);
    const packSize = currentAdjustingSlot.packSize || std.packSize;

    if (newCount > packSize) {
      showModalError('boxAdjustErrorBanner', `⚠️ Invalid Count! A $${currentAdjustingSlot.price} pack only has ${packSize} tickets (#00 to #${String(packSize - 1).padStart(2, '0')}). Max value is ${packSize}.`, inputAdjustCount);
      return;
    }

    recordUndoAction({
      type: 'ADJUST_COUNT',
      boxNumber: currentAdjustingSlot.boxNumber,
      prevTicket: currentAdjustingSlot.currentTicket,
      prevStatus: currentAdjustingSlot.status
    });

    if (newCount === 0) {
      if ((currentAdjustingSlot.currentTicket || 0) > 0) {
        recordSoldOutPack(currentAdjustingSlot, currentAdjustingSlot.currentTicket);
      }
      currentAdjustingSlot.currentTicket = 0;
      currentAdjustingSlot.status = 'EMPTY';
      currentAdjustingSlot.activatedThisShift = false;
      showToast(`📦 Box #${currentAdjustingSlot.boxNumber} count set to 0 (Emptied).`, 'info');
    } else if (newCount >= packSize) {
      currentAdjustingSlot.currentTicket = packSize;
      currentAdjustingSlot.status = 'SOLD_OUT';
      recordSoldOutPack(currentAdjustingSlot, packSize);
      const totalAmt = packSize * (currentAdjustingSlot.price || 0);
      showToast(`🚨 Box #${currentAdjustingSlot.boxNumber} marked as SOLD OUT (${packSize} tickets = $${totalAmt.toFixed(2)})!`, 'warning');
    } else {
      const isStarting = document.getElementById('chkSetAsStartingTicket')?.checked;
      if (isStarting) {
        currentAdjustingSlot.startTicket = newCount;
        currentAdjustingSlot.currentTicket = newCount;
        currentAdjustingSlot.status = 'ACTIVE';
        currentAdjustingSlot.activatedThisShift = (newCount === 0);
        showToast(`✓ Box #${currentAdjustingSlot.boxNumber} set to start at Ticket #${String(newCount).padStart(2, '0')} (0 sold this shift)`, 'success');
      } else {
        currentAdjustingSlot.currentTicket = newCount;
        currentAdjustingSlot.status = 'ACTIVE';
        showToast(`✓ Box #${currentAdjustingSlot.boxNumber} count updated to #${String(newCount).padStart(2, '0')}`, 'success');
      }
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
// LTSYSTEM: Box Re-routing, Fix Position, Terminal Reconcile & Gatekeeper Modals
// -------------------------------------------------------------

function openSwitchBoxModal(slot) {
  if (!switchBoxModal || !slot) return;
  clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
  if (switchBoxSourceInfo) {
    switchBoxSourceInfo.textContent = `Switching Box #${slot.boxNumber} (${cleanGameTitle(slot.gameName || 'Active Box')})`;
  }
  if (inputSwitchTargetBox) inputSwitchTargetBox.value = '';
  sfx.keypad();
  switchBoxModal.showModal();
  setTimeout(() => {
    inputSwitchTargetBox?.focus();
  }, 100);
}

function handleConfirmSwitchBox() {
  if (!currentAdjustingSlot) {
    switchBoxModal?.close();
    return;
  }
  clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
  const targetBoxNum = parseInt(inputSwitchTargetBox?.value, 10);
  if (isNaN(targetBoxNum) || targetBoxNum < 1 || targetBoxNum > 100) {
    showModalError('switchBoxErrorBanner', 'Please enter a valid target Box # (1-100).', inputSwitchTargetBox);
    return;
  }
  if (targetBoxNum === currentAdjustingSlot.boxNumber) {
    showModalError('switchBoxErrorBanner', 'Cannot switch box with itself. Enter a different box number.', inputSwitchTargetBox);
    return;
  }

  let targetSlot = state.slots.find(s => s.boxNumber === targetBoxNum);
  if (!targetSlot) {
    while (state.slots.length < targetBoxNum) {
      const nextNum = state.slots.length + 1;
      state.slots.push({
        boxNumber: nextNum,
        status: 'EMPTY',
        gameId: null,
        gameName: null,
        price: null,
        packNumber: null,
        packSize: null,
        startTicket: 0,
        currentTicket: 0,
        ticketsInBox: 0,
        scannedBarcodes: [],
        activatedThisShift: false,
        daysActive: 0,
        scannedInEndShift: false
      });
    }
    targetSlot = state.slots.find(s => s.boxNumber === targetBoxNum);
  }

  // Swap all pack data between currentAdjustingSlot and targetSlot
  const fields = [
    'status', 'gameId', 'gameName', 'price', 'packNumber', 'packSize',
    'startTicket', 'currentTicket', 'ticketsInBox', 'scannedBarcodes',
    'activatedThisShift', 'daysActive', 'scannedInEndShift'
  ];
  fields.forEach(f => {
    const tmp = currentAdjustingSlot[f];
    currentAdjustingSlot[f] = targetSlot[f];
    targetSlot[f] = tmp;
  });

  saveState(state);
  sfx.success();
  switchBoxModal.close();
  boxAdjustModal?.close();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(`⇄ Swapped Box #${currentAdjustingSlot.boxNumber} with Box #${targetBoxNum}!`, 'success');
}

function openChangeBoxModal(slot) {
  if (!changeBoxModal || !slot) return;
  clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
  if (changeBoxSourceInfo) {
    changeBoxSourceInfo.textContent = `Box #${slot.boxNumber} · ${cleanGameTitle(slot.gameName || 'Active Box')}`;
  }
  if (inputChangeTargetBox) inputChangeTargetBox.value = '';
  sfx.keypad();
  changeBoxModal.showModal();
  setTimeout(() => {
    inputChangeTargetBox?.focus();
  }, 100);
}

function handleConfirmChangeBox() {
  if (!currentAdjustingSlot) {
    changeBoxModal?.close();
    return;
  }
  clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
  const targetBoxNum = parseInt(inputChangeTargetBox?.value, 10);
  if (isNaN(targetBoxNum) || targetBoxNum < 1 || targetBoxNum > 100) {
    showModalError('changeBoxErrorBanner', 'Please enter a valid target Box # (1-100).', inputChangeTargetBox);
    return;
  }
  if (targetBoxNum === currentAdjustingSlot.boxNumber) {
    showModalError('changeBoxErrorBanner', `Pack is already in Box #${targetBoxNum}. Enter a different box number.`, inputChangeTargetBox);
    return;
  }

  let targetSlot = state.slots.find(s => s.boxNumber === targetBoxNum);
  if (!targetSlot) {
    while (state.slots.length < targetBoxNum) {
      const nextNum = state.slots.length + 1;
      state.slots.push({
        boxNumber: nextNum,
        status: 'EMPTY',
        gameId: null,
        gameName: null,
        price: null,
        packNumber: null,
        packSize: null,
        startTicket: 0,
        currentTicket: 0,
        ticketsInBox: 0,
        scannedBarcodes: [],
        activatedThisShift: false,
        daysActive: 0,
        scannedInEndShift: false
      });
    }
    targetSlot = state.slots.find(s => s.boxNumber === targetBoxNum);
  }

  // If target box is already occupied with another active game
  if (targetSlot && targetSlot.status !== 'EMPTY' && targetSlot.gameName) {
    showModalError('changeBoxErrorBanner', `Box #${targetBoxNum} already contains "${cleanGameTitle(targetSlot.gameName)}". Use "⇄ Switch Box" to swap them instead.`, inputChangeTargetBox);
    return;
  }

  // Move pack data from currentAdjustingSlot to targetSlot
  const fields = [
    'status', 'gameId', 'gameName', 'price', 'packNumber', 'packSize',
    'startTicket', 'currentTicket', 'ticketsInBox', 'scannedBarcodes',
    'activatedThisShift', 'daysActive', 'scannedInEndShift'
  ];
  fields.forEach(f => {
    targetSlot[f] = currentAdjustingSlot[f];
  });

  const fromBox = currentAdjustingSlot.boxNumber;

  // Reset source slot to EMPTY
  currentAdjustingSlot.status = 'EMPTY';
  currentAdjustingSlot.gameId = null;
  currentAdjustingSlot.gameName = null;
  currentAdjustingSlot.price = null;
  currentAdjustingSlot.packNumber = null;
  currentAdjustingSlot.packSize = null;
  currentAdjustingSlot.startTicket = 0;
  currentAdjustingSlot.currentTicket = 0;
  currentAdjustingSlot.ticketsInBox = 0;
  currentAdjustingSlot.scannedBarcodes = [];
  currentAdjustingSlot.activatedThisShift = false;
  currentAdjustingSlot.daysActive = 0;
  currentAdjustingSlot.scannedInEndShift = false;

  saveState(state);
  sfx.success();
  changeBoxModal.close();
  boxAdjustModal?.close();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(`✏️ Moved pack from Box #${fromBox} to Box #${targetBoxNum}!`, 'success');
}

function openFixTicketPositionModal(slot) {
  if (!fixTicketPositionModal || !slot) return;
  clearModalError('fixPosErrorBanner', inputFixTicketPosition);
  fixPosGameName.textContent = `Name: ${cleanGameTitle(slot.gameName || 'Scratch Off')}`;
  fixPosScannedPos.textContent = `Scanned position: ${String(slot.currentTicket || 0).padStart(3, '0')}`;
  inputFixTicketPosition.value = slot.currentTicket !== undefined ? slot.currentTicket : 0;
  sfx.keypad();
  fixTicketPositionModal.showModal();
  setTimeout(() => {
    inputFixTicketPosition?.focus();
    inputFixTicketPosition?.select();
  }, 100);
}

function handleConfirmFixTicketPosition() {
  if (!currentAdjustingSlot) {
    fixTicketPositionModal?.close();
    return;
  }
  clearModalError('fixPosErrorBanner', inputFixTicketPosition);
  const rawVal = inputFixTicketPosition.value.trim();
  if (rawVal === '') {
    fixTicketPositionModal.close();
    return;
  }
  const newPos = parseInt(rawVal, 10);
  if (isNaN(newPos) || newPos < 0) {
    showModalError('fixPosErrorBanner', 'Please enter a valid ticket number (0 or higher).', inputFixTicketPosition);
    return;
  }
  const std = getStandardPackDetails(currentAdjustingSlot.price || 2);
  const packSize = currentAdjustingSlot.packSize || std.packSize;

  if (newPos >= packSize) {
    showModalError('fixPosErrorBanner', `⚠️ Invalid Position! A $${currentAdjustingSlot.price} game ($${(packSize * currentAdjustingSlot.price).toFixed(0)} book) only has ${packSize} tickets (#00 to #${String(packSize - 1).padStart(2, '0')}). Position #${newPos} exceeds the pack!`, inputFixTicketPosition);
    return;
  }

  // If this box was just activated or 0 tickets were sold this shift, fixing position updates both start and current!
  if (currentAdjustingSlot.currentTicket === currentAdjustingSlot.startTicket || currentAdjustingSlot.activatedThisShift) {
    currentAdjustingSlot.startTicket = newPos;
    currentAdjustingSlot.currentTicket = newPos;
    currentAdjustingSlot.activatedThisShift = (newPos === 0);
  } else {
    currentAdjustingSlot.currentTicket = newPos;
  }
  if (inputAdjustCount) inputAdjustCount.value = newPos;
  saveState(state);
  sfx.success();
  voice.speakMissedTicketFixed();
  if (lastScanReadoutContainer) lastScanReadoutContainer.classList.remove('alert-yellow');
  if (scanActionTitle) scanActionTitle.textContent = 'Missed Ticket is Fixed';
  if (lastScanDisplay) lastScanDisplay.textContent = `Box #${currentAdjustingSlot.boxNumber} (${cleanGameTitle(currentAdjustingSlot.gameName)}) at #${String(newPos).padStart(2, '0')}`;
  fixTicketPositionModal.close();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(`🎯 Missed Ticket is Fixed! Box #${currentAdjustingSlot.boxNumber} position set to #${String(newPos).padStart(2, '0')}`, 'success');
}

function showCalculatingSpinner(title, subtext, onDone, duration = 900) {
  if (!calculatingSpinnerModal) {
    if (onDone) onDone();
    return;
  }
  if (calculatingSpinnerText) calculatingSpinnerText.textContent = title;
  if (calculatingSubText) calculatingSubText.textContent = subtext;
  sfx.keypad();
  calculatingSpinnerModal.showModal();
  setTimeout(() => {
    calculatingSpinnerModal.close();
    if (onDone) onDone();
  }, duration);
}

function setupFixTicketPositionKeypad() {
  closeFixTicketPosBtn?.addEventListener('click', () => fixTicketPositionModal?.close());
  btnCancelFixTicketPos?.addEventListener('click', () => fixTicketPositionModal?.close());
  btnConfirmFixTicketPos?.addEventListener('click', handleConfirmFixTicketPosition);

  const numBtns = fixTicketPositionModal?.querySelectorAll('.key-num-fix');
  numBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      const val = btn.getAttribute('data-val');
      if (val === '.') return;
      if (inputFixTicketPosition.value === '0') {
        inputFixTicketPosition.value = val;
      } else {
        inputFixTicketPosition.value += val;
      }
    });
  });

  const keyFixClear = document.getElementById('keyFixClear');
  keyFixClear?.addEventListener('click', () => {
    sfx.keypad();
    inputFixTicketPosition.value = '';
    inputFixTicketPosition.focus();
  });

  const keyFixBackspace = document.getElementById('keyFixBackspace');
  keyFixBackspace?.addEventListener('click', () => {
    sfx.keypad();
    inputFixTicketPosition.value = inputFixTicketPosition.value.slice(0, -1);
  });

  const keyFixEnter = document.getElementById('keyFixEnter');
  keyFixEnter?.addEventListener('click', handleConfirmFixTicketPosition);

  inputFixTicketPosition?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmFixTicketPosition();
    }
  });
}

let activeTermInput = null;
let terminalReconcileOnDone = null;

function openTerminalReconcileModal(onDoneCallback = null) {
  if (!terminalReconcileModal) {
    if (typeof onDoneCallback === 'function') onDoneCallback();
    return;
  }
  activeTermInput = inputTermOnlineSale;
  inputTermOnlineSale.value = state.onlineSales || 0;
  inputTermOnlineCashOut.value = state.onlineCashes || 0;
  inputTermScratchOffCash.value = state.cashes || 0;
  terminalReconcileOnDone = onDoneCallback;
  sfx.keypad();
  terminalReconcileModal.showModal();
  setTimeout(() => {
    inputTermOnlineSale?.focus();
    inputTermOnlineSale?.select();
  }, 100);
}

function setupTerminalReconcileLogic() {
  closeTerminalReconcileBtn?.addEventListener('click', () => terminalReconcileModal?.close());

  [inputTermOnlineSale, inputTermOnlineCashOut, inputTermScratchOffCash].forEach(inp => {
    inp?.addEventListener('focus', () => {
      activeTermInput = inp;
    });
  });

  const numBtns = terminalReconcileModal?.querySelectorAll('.key-num-term');
  numBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      if (!activeTermInput) activeTermInput = inputTermOnlineSale;
      const val = btn.getAttribute('data-val');
      if (val === '.') {
        if (!activeTermInput.value.includes('.')) {
          activeTermInput.value += '.';
        }
      } else {
        if (activeTermInput.value === '0') {
          activeTermInput.value = val;
        } else {
          activeTermInput.value += val;
        }
      }
    });
  });

  const keyTermClear = document.getElementById('keyTermClear');
  keyTermClear?.addEventListener('click', () => {
    sfx.keypad();
    if (!activeTermInput) activeTermInput = inputTermOnlineSale;
    activeTermInput.value = '0';
    activeTermInput.focus();
  });

  const keyTermBackspace = document.getElementById('keyTermBackspace');
  keyTermBackspace?.addEventListener('click', () => {
    sfx.keypad();
    if (!activeTermInput) activeTermInput = inputTermOnlineSale;
    if (activeTermInput.value.length > 1) {
      activeTermInput.value = activeTermInput.value.slice(0, -1);
    } else {
      activeTermInput.value = '0';
    }
  });

  const handleTerminalDone = () => {
    state.onlineSales = parseFloat(inputTermOnlineSale?.value) || 0;
    state.onlineCashes = parseFloat(inputTermOnlineCashOut?.value) || 0;
    state.cashes = parseFloat(inputTermScratchOffCash?.value) || 0;
    saveState(state);
    sfx.success();
    terminalReconcileModal.close();
    renderHeaderAndMetrics();
    showToast(`✓ Terminal data reconciled: Online Sales $${state.onlineSales.toFixed(2)}, Cashes $${state.cashes.toFixed(2)}`, 'success');
    
    // Show Calculating Segmented Spinner (Matching Video 03:35)
    showCalculatingSpinner('Calculating', 'Generating Georgia Lottery Report...', () => {
      if (typeof terminalReconcileOnDone === 'function') {
        const cb = terminalReconcileOnDone;
        terminalReconcileOnDone = null;
        cb();
      } else {
        openDayReportModal(() => state, sfx);
      }
    }, 800);
  };

  btnTerminalReconcileDone?.addEventListener('click', handleTerminalDone);
  const keyTermEnter = document.getElementById('keyTermEnter');
  keyTermEnter?.addEventListener('click', handleTerminalDone);
}

let pendingSoldOutBarcode = null;
let pendingSoldOutPack = null;
let pendingRestorePack = null;

function setupDiscrepancyAndInventoryGatekeeperModals() {
  // Ticket Not In Inventory Modal
  closeTicketNotInInvBtn?.addEventListener('click', () => {
    ticketNotInInventoryModal?.close();
    barcodeInput?.focus();
  });
  btnConfirmNotInInvOk?.addEventListener('click', () => {
    ticketNotInInventoryModal?.close();
    barcodeInput?.focus();
  });
  btnGoToUpdateInventory?.addEventListener('click', () => {
    ticketNotInInventoryModal?.close();
    openInventoryModal();
    if (invBoxTicketBarcodeInput && notInInvBarcodeDetails) {
      invBoxTicketBarcodeInput.value = notInInvBarcodeDetails.textContent.trim();
      invBoxTicketBarcodeInput.focus();
    }
  });

  // Update Sold Out Ticket Modal
  closeUpdateSoldOutBtn?.addEventListener('click', () => {
    updateSoldOutTicketModal?.close();
    clearScanAlertBanner();
    barcodeInput?.focus();
  });
  btnSoldOutNo?.addEventListener('click', () => {
    updateSoldOutTicketModal?.close();
    clearScanAlertBanner();
    barcodeInput?.focus();
  });
  btnSoldOutFix?.addEventListener('click', () => {
    updateSoldOutTicketModal?.close();
    if (pendingSoldOutBarcode) {
      pendingRestorePack = pendingSoldOutPack;
      openSetTicketDetailsModal(pendingSoldOutBarcode);
    }
  });
  updateSoldOutTicketModal?.addEventListener('close', () => {
    if (!pendingRestorePack) {
      clearScanAlertBanner();
    }
  });
  updateSoldOutTicketModal?.addEventListener('cancel', () => {
    clearScanAlertBanner();
  });

  // Set Box Stepper buttons
  setBoxStepUp?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(setBoxNumberInput.value, 10) || 1;
    if (val < 100) setBoxNumberInput.value = val + 1;
  });
  setBoxStepDown?.addEventListener('click', () => {
    sfx.keypad();
    let val = parseInt(setBoxNumberInput.value, 10) || 1;
    if (val > 1) setBoxNumberInput.value = val - 1;
  });
}

function setupSwitchAndChangeBoxModals() {
  // --- Switch Box Modal Listeners ---
  closeSwitchBoxBtn?.addEventListener('click', () => switchBoxModal?.close());
  btnCancelSwitchBox?.addEventListener('click', () => switchBoxModal?.close());
  btnConfirmSwitchBox?.addEventListener('click', handleConfirmSwitchBox);
  inputSwitchTargetBox?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmSwitchBox();
    }
  });

  document.getElementById('stepSwitchUp')?.addEventListener('click', () => {
    clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
    sfx.keypad();
    let val = parseInt(inputSwitchTargetBox?.value, 10);
    if (isNaN(val)) val = currentAdjustingSlot ? currentAdjustingSlot.boxNumber + 1 : 1;
    else val += 1;
    if (val > 100) val = 100;
    if (inputSwitchTargetBox) inputSwitchTargetBox.value = val;
  });

  document.getElementById('stepSwitchDown')?.addEventListener('click', () => {
    clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
    sfx.keypad();
    let val = parseInt(inputSwitchTargetBox?.value, 10);
    if (isNaN(val)) val = currentAdjustingSlot ? Math.max(1, currentAdjustingSlot.boxNumber - 1) : 1;
    else val -= 1;
    if (val < 1) val = 1;
    if (inputSwitchTargetBox) inputSwitchTargetBox.value = val;
  });

  const switchKeyBtns = switchBoxModal?.querySelectorAll('.key-num-switch');
  switchKeyBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
      sfx.keypad();
      const val = btn.getAttribute('data-val');
      if (val === '.') return;
      if (!inputSwitchTargetBox) return;
      let cur = inputSwitchTargetBox.value.trim();
      if (cur === '0' || cur === '') {
        inputSwitchTargetBox.value = val;
      } else if (cur.length < 3) {
        inputSwitchTargetBox.value = cur + val;
      }
    });
  });

  document.getElementById('keySwitchClear')?.addEventListener('click', () => {
    clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
    sfx.keypad();
    if (inputSwitchTargetBox) {
      inputSwitchTargetBox.value = '';
      inputSwitchTargetBox.focus();
    }
  });

  document.getElementById('keySwitchBackspace')?.addEventListener('click', () => {
    clearModalError('switchBoxErrorBanner', inputSwitchTargetBox);
    sfx.keypad();
    if (inputSwitchTargetBox) {
      inputSwitchTargetBox.value = inputSwitchTargetBox.value.slice(0, -1);
    }
  });

  document.getElementById('keySwitchEnter')?.addEventListener('click', handleConfirmSwitchBox);

  // --- Change Box Modal Listeners ---
  closeChangeBoxBtn?.addEventListener('click', () => changeBoxModal?.close());
  btnCancelChangeBox?.addEventListener('click', () => changeBoxModal?.close());
  btnConfirmChangeBox?.addEventListener('click', handleConfirmChangeBox);
  inputChangeTargetBox?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmChangeBox();
    }
  });

  document.getElementById('stepChangeUp')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    let val = parseInt(inputChangeTargetBox?.value, 10);
    if (isNaN(val)) val = currentAdjustingSlot ? currentAdjustingSlot.boxNumber + 1 : 1;
    else val += 1;
    if (val > 100) val = 100;
    if (inputChangeTargetBox) inputChangeTargetBox.value = val;
  });

  document.getElementById('stepChangeDown')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    let val = parseInt(inputChangeTargetBox?.value, 10);
    if (isNaN(val)) val = currentAdjustingSlot ? Math.max(1, currentAdjustingSlot.boxNumber - 1) : 1;
    else val -= 1;
    if (val < 1) val = 1;
    if (inputChangeTargetBox) inputChangeTargetBox.value = val;
  });

  const changeKeyBtns = changeBoxModal?.querySelectorAll('.key-num-change');
  changeKeyBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
      clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
      sfx.keypad();
      const val = btn.getAttribute('data-val');
      if (val === '.') return;
      if (!inputChangeTargetBox) return;
      let cur = inputChangeTargetBox.value.trim();
      if (cur === '0' || cur === '') {
        inputChangeTargetBox.value = val;
      } else if (cur.length < 3) {
        inputChangeTargetBox.value = cur + val;
      }
    });
  });

  document.getElementById('keyChangeClear')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    if (inputChangeTargetBox) {
      inputChangeTargetBox.value = '';
      inputChangeTargetBox.focus();
    }
  });

  document.getElementById('keyChangeBackspace')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    if (inputChangeTargetBox) {
      inputChangeTargetBox.value = inputChangeTargetBox.value.slice(0, -1);
    }
  });

  document.getElementById('keyChangeEnter')?.addEventListener('click', handleConfirmChangeBox);
}

// -------------------------------------------------------------
// Ticket Activation & Touch Keypad Workflow
// -------------------------------------------------------------

export function formatGameTitle(price, name) {
  const clean = cleanGameTitle(name);
  if (!clean) return price ? `$${price}` : '';
  return price ? `$${price} · ${clean}` : clean;
}


function showActivationModalError(msg, targetInput = null) {
  showModalError('activationErrorBanner', msg, targetInput);
}

function clearActivationModalError() {
  clearModalError(
    'activationErrorBanner',
    document.getElementById('presetStartTicketInput'),
    document.getElementById('presetPackNumberInput'),
    keypadBoxInput
  );
}

function updateActivationPackHints(game) {
  if (!game) return;
  const packHint = document.getElementById('activationPackHint');
  const startMaxHint = document.getElementById('startTicketMaxHint');
  const presetStartInput = document.getElementById('presetStartTicketInput');
  const std = getStandardPackDetails(game.price);
  const fullPackSize = std.packSize || game.packSize;
  const bookVal = std.bookValue || (fullPackSize * game.price).toFixed(0);

  if (packHint) {
    packHint.textContent = `📖 Full Roll: ${fullPackSize} Tickets • Book Value: $${bookVal}.00`;
  }
  if (startMaxHint) {
    startMaxHint.textContent = `0 = All (${fullPackSize})`;
  }
  if (presetStartInput) {
    presetStartInput.max = fullPackSize;
    presetStartInput.title = `0 for full roll (${fullPackSize} tix), or enter custom count (e.g. 50)`;
  }
}

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
    clearActivationModalError();
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
      updateActivationPackHints(chosenGame);
      sfx.keypad();
    }
  });
}

function openActivationForBox(boxNumber, preselectedPack = null) {
  clearActivationModalError();
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
  if (presetStartInput) {
    presetStartInput.value = 0;
  }
  updateActivationPackHints(pack);

  const boxInputHint = document.getElementById('boxInputHint');
  if (boxInputHint) {
    boxInputHint.textContent = `Assign to dispenser slot (1-${state.totalSlots} or enter higher number to add new box).`;
  }


  sfx.keypad();
  activationModal.showModal();
}

function findFirstEmptyBox() {
  const empty = state.slots.find(s => s.status !== 'ACTIVE' || !s.packNumber);
  return empty ? empty.boxNumber : 1;
}

function setupKeypad() {
  // Connect scanner mode label to open activation
  const scannerModeLabel = document.getElementById('scannerModeLabel');
  if (scannerModeLabel) {
    scannerModeLabel.addEventListener('click', () => {
      openActivationForBox(findFirstEmptyBox());
      showToast('🎟️ Pack Activation opened!', 'info');
    });
  }

  // Physical keyboard support for keypadBoxInput
  keypadBoxInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitBoxActivation();
    }
  });

  const presetPackNumberInput = document.getElementById('presetPackNumberInput');
  if (presetPackNumberInput) {
    presetPackNumberInput.addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/[^0-9]/g, '');
      if (e.target.value !== cleaned) {
        e.target.value = cleaned;
      }
    });
  }

  ['presetPackNumberInput', 'presetStartTicketInput'].forEach(id => {
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
    clearActivationModalError();
    activationModal.close();
    showToast(`Pack #${pendingActivationPack?.packNumber || '0000'} stored in back-office inventory.`, 'info');
  });

  closeActivationBtn.addEventListener('click', () => {
    clearActivationModalError();
    activationModal.close();
  });


}

function commitBoxActivation() {
  clearActivationModalError();
  const boxNum = parseInt(keypadBoxInput.value, 10);
  if (!boxNum || boxNum < 1 || boxNum > 100) {
    showActivationModalError('Please enter a valid box number between 1 and 100', keypadBoxInput);
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
  const stdPack = getStandardPackDetails(chosenPrice);
  const fullRollCapacity = stdPack.packSize;
  let chosenSize = fullRollCapacity;
  let chosenStart = 0; // 0 = Full roll

  const pPackInput = document.getElementById('presetPackNumberInput');
  const pPackRaw = pPackInput?.value.trim();
  const pStartInput = document.getElementById('presetStartTicketInput');
  const pStart = parseInt(pStartInput?.value, 10);
  if (pPackRaw) {
    const cleanPack = pPackRaw.replace(/[^0-9]/g, '');
    if (cleanPack.length === 0) {
      showActivationModalError('⚠️ Invalid Pack Number! Pack numbers must contain only digits (e.g. 882853). Emojis and letters are not allowed.', pPackInput);
      return;
    }
    chosenPack = cleanPack;
  }
  if (!isNaN(pStart) && pStart >= 0) chosenStart = pStart;

  // Validate that ticket count does NOT exceed full roll capacity!
  if (chosenStart > fullRollCapacity) {
    showActivationModalError(`⚠️ Invalid Ticket Count! A $${chosenPrice} game ($${stdPack.bookValue} book) only has ${fullRollCapacity} tickets in a full roll. Cannot activate ${chosenStart} tickets!`, pStartInput);
    return;
  }

  // If user entered a specific count (e.g. 50 tickets in 300$ roll):
  // They are activating that many tickets into the box!
  // If user entered 0 or left empty: full roll is activated (e.g. 300 tickets for $1)
  const activatedTicketCount = (chosenStart > 0) ? chosenStart : fullRollCapacity;
  chosenSize = activatedTicketCount;

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
  targetSlot.initialTickets = activatedTicketCount;
  targetSlot.packSize = activatedTicketCount;
  targetSlot.startTicket = 0;
  targetSlot.currentTicket = 0;
  targetSlot.activatedThisShift = true;
  targetSlot.activatedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  targetSlot.daysActive = 1;
  targetSlot.scannedInEndShift = false;

  state.lastScannedSlot = boxNum;
  bringBoxToVisibleRack(boxNum);
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

  showToast(`✓ Box #${boxNum} activated with $${Number(chosenPrice).toFixed(2)} · ${cleanName} (${chosenSize} tickets in box)! Ready to sell.`, 'success');
  return;
}

function quickSellTicket(slot, barcodeScanned = null, skipIncrement = false, explicitPrevTicket = null) {
  const prevTicketVal = (explicitPrevTicket !== null && explicitPrevTicket !== undefined)
    ? explicitPrevTicket
    : (slot.currentTicket || 0);

  recordUndoAction({
    type: 'SELL',
    boxNumber: slot.boxNumber,
    prevTicket: prevTicketVal
  });

  const cleanName = cleanGameTitle(slot.gameName);
  if (!skipIncrement) {
    slot.currentTicket = (slot.currentTicket || 0) + 1;
  }
  state.lastScannedSlot = slot.boxNumber;
  bringBoxToVisibleRack(slot.boxNumber);
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
  
  const std = getStandardPackDetails(slot.price || 2);
  const packSize = slot.packSize || std.packSize;

  if (packSize && slot.currentTicket >= packSize) {
    slot.currentTicket = packSize;
    slot.status = 'SOLD_OUT';
    recordSoldOutPack(slot, packSize);
    sfx.alert();
    const totalAmt = packSize * (slot.price || 0);
    showToast(`🚨 Box #${slot.boxNumber} (${cleanName}) is SOLD OUT! Full pack of ${packSize} tickets sold ($${totalAmt.toFixed(2)}).`, 'warning');
  } else {
    sfx.success();
    const remaining = Math.max(0, packSize - slot.currentTicket);
    showToast(`Sold 1x $${Number(slot.price).toFixed(2)} · ${cleanName} (Box #${slot.boxNumber}) · ${remaining} left in box`, 'success');
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
    if (slot) {
      if (slot.status === 'SOLD_OUT') {
        slot.status = 'ACTIVE';
        if (state.soldOutThisShift && state.soldOutThisShift.length > 0) {
          const soIdx = state.soldOutThisShift.findIndex(so => so.boxNumber === slot.boxNumber && so.packNumber === slot.packNumber);
          if (soIdx !== -1) {
            state.soldOutThisShift.splice(soIdx, 1);
          }
        }
      }
      slot.currentTicket = action.prevTicket !== undefined ? action.prevTicket : slot.startTicket;
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
  } else if (action.type === 'VERIFY_END_SHIFT') {
    const slot = state.slots.find(s => s.boxNumber === action.boxNumber);
    if (slot) {
      slot.scannedInEndShift = action.prevScannedInEndShift;
      slot.currentTicket = action.prevTicket;
      saveState(state);
      sfx.keypad();
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast(`↩️ Undid verification on Box #${slot.boxNumber}.`, 'info');
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
  } else if (action.type === 'RETURN_PACK') {
    const slotIdx = state.slots.findIndex(s => s.boxNumber === action.boxNumber);
    if (slotIdx >= 0 && action.slotSnapshot) {
      state.slots[slotIdx] = action.slotSnapshot;
      if (state.soldOutThisShift) {
        const soIdx = state.soldOutThisShift.findIndex(so => so.boxNumber === action.boxNumber && so.isReturned);
        if (soIdx >= 0) state.soldOutThisShift.splice(soIdx, 1);
      }
      if (state.discontinuedCount > 0) state.discontinuedCount -= 1;
      saveState(state);
      sfx.keypad();
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      showToast(`↩️ Undid pack return on Box #${action.boxNumber}. Pack restored.`, 'info');
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
    // Show Calculating Segmented Spinner (Matching Video 02:55)
    showCalculatingSpinner('Calculating', 'Calculating End Shift', () => {
      openEndShiftConfirmation();
    }, 900);
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    startNewShift();
  }
}

function openEndShiftConfirmation() {
  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);
  const activeCount = state.slots.filter(isBoxActive).length;
  const activations = state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length;
  const emptySlots = state.totalSlots - activeCount;

  // Authentic LTSYSTEM Voice Prompt (Video 02:58)
  voice.speakEmptySlotCheck(activations, emptySlots);

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

  sfx.keypad();
  endShiftConfirmModal.showModal();
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
  openTerminalReconcileModal(() => {
    // Open the authentic Georgia Lottery Day Report directly (Matching Video 03:38)
    openDayReportModal(() => state, sfx);
  });
}

function openShiftReportModal() {
  voice.speakReport();
  repShiftNum.textContent = `#${state.shiftNumber}`;
  repCashier.textContent = state.cashierName;

  reportBodyRows.innerHTML = '';
  let totalSold = 0;
  let totalRevenue = 0;

  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);

  // 1. Render all active dispenser boxes (skipping duplicate 0-sale active rows if this box already sold out this shift)
  state.slots.forEach(s => {
    if (isBoxActive(s)) {
      const soldOutMatch = (state.soldOutThisShift || []).find(so => so.boxNumber === s.boxNumber);
      const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));

      if (soldOutMatch && (sold === 0 || s.packNumber === soldOutMatch.packNumber)) {
        return; // Already rendered in sold-out list below
      }

      const amount = sold * (s.price || 0);
      totalSold += sold;
      totalRevenue += amount;

      const row = document.createElement('tr');
      row.className = 'report-row';
      row.innerHTML = `
        <td class="col-box"><span class="report-box-badge">Box ${s.boxNumber}</span></td>
        <td class="col-game" title="${s.gameName || ''}">${cleanGameTitle(s.gameName || 'Scratch Off')}</td>
        <td class="col-price">$${s.price || 0}</td>
        <td class="col-start">${String(s.startTicket || 0).padStart(2, '0')}</td>
        <td class="col-close">${String(s.currentTicket || 0).padStart(2, '0')}</td>
        <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
        <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
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
    row.className = 'report-row';
    if (so.isReturned) {
      row.innerHTML = `
        <td class="col-box"><span class="report-box-badge">Box ${so.boxNumber}</span></td>
        <td class="col-game" title="${so.gameName || ''}">
          ${cleanGameTitle(so.gameName || 'Scratch Off')}
          <span class="report-status-tag report-tag-returned">RETURNED (${so.ticketsReturned || 0})</span>
        </td>
        <td class="col-price">$${so.price || 0}</td>
        <td class="col-start">${String(so.startTicket || 0).padStart(2, '0')}</td>
        <td class="col-close">${String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(2, '0')}</td>
        <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
        <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
      `;
    } else {
      row.innerHTML = `
        <td class="col-box"><span class="report-box-badge">Box ${so.boxNumber}</span></td>
        <td class="col-game" title="${so.gameName || ''}">
          ${cleanGameTitle(so.gameName || 'Scratch Off')}
          <span class="report-status-tag report-tag-soldout">SOLD OUT</span>
        </td>
        <td class="col-price">$${so.price || 0}</td>
        <td class="col-start">${String(so.startTicket || 0).padStart(2, '0')}</td>
        <td class="col-close">${String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(2, '0')}</td>
        <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
        <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
      `;
    }
    reportBodyRows.appendChild(row);
  });

  repTicketsSold.textContent = totalSold;
  repTotalRevenue.textContent = `$${totalRevenue.toFixed(2)}`;
  repSumSold.textContent = totalSold;
  repSumAmount.textContent = `$${totalRevenue.toFixed(2)}`;

  // Show empty state if no tickets sold
  if (reportBodyRows.children.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="7" style="text-align:center; padding:24px 14px; color:#94a3b8; font-style:italic; font-family:inherit; font-size:0.88rem;">
      🎟️ No ticket sales recorded in this shift.
    </td>`;
    reportBodyRows.appendChild(emptyRow);
  }

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
        recExpectedCash.style.color = 'var(--text-primary)';
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
        repDrawerBalance.className = 'drawer-balance-pill status-pending';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = 'PENDING';
      return;
    }

    const cashVal = parseFloat(rawCash) || 0;
    const diff = cashVal - expectedDrawerCash;
    if (Math.abs(diff) < 0.01) {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `$0.00 (Balanced)`;
        repDrawerBalance.className = 'drawer-balance-pill status-balanced';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = `$0.00 (BALANCED)`;
    } else if (diff > 0) {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `+$${diff.toFixed(2)} OVER`;
        repDrawerBalance.className = 'drawer-balance-pill status-over';
      }
      if (prDrawerBalance) prDrawerBalance.textContent = `+$${diff.toFixed(2)} (OVER)`;
    } else {
      if (repDrawerBalance) {
        repDrawerBalance.textContent = `-$${Math.abs(diff).toFixed(2)} SHORT`;
        repDrawerBalance.className = 'drawer-balance-pill status-short';
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
  const shiftActivations = state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length;
  const shiftSlotsSnapshot = JSON.parse(JSON.stringify(state.slots));
  const shiftSoldOutSnapshot = JSON.parse(JSON.stringify(state.soldOutThisShift || []));

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
    activationsCount: shiftActivations,
    emptySlotsCount: state.slots.filter(s => !isBoxActive(s)).length,
    slotsSnapshot: shiftSlotsSnapshot,
    soldOutSnapshot: shiftSoldOutSnapshot
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
  state.visibleBoxNumbers = [];
  state.boxAccessTimes = {};

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

let pendingNewTicketBarcode = null;
let currentInventoryModalMode = 'status';
let lastKnownSoldCount = {};

function openInventoryModal(mode = 'status') {
  currentInventoryModalMode = mode;
  renderInventoryTable();
  sfx.keypad();
  
  const modalTitle = document.querySelector('#inventoryModal .inv-title-text');
  const scannerCard = document.getElementById('invScannerCard');
  const scanInput = document.getElementById('invBoxTicketBarcodeInput');

  if (mode === 'intake') {
    if (modalTitle) modalTitle.textContent = 'Stock Intake - Put into Box';
    if (scannerCard) scannerCard.style.display = 'block';
    if (scanInput && pendingNewTicketBarcode) {
      scanInput.value = pendingNewTicketBarcode;
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Store Lottery Inventory Status';
    if (scannerCard) scannerCard.style.display = 'none';
  }

  inventoryModal.showModal();
  if (mode === 'intake') {
    setTimeout(() => {
      scanInput?.focus();
      if (scanInput && scanInput.value) {
        scanInput.select();
      }
    }, 100);
  }
}

function renderInventoryTable() {
  if (!inventoryTableBody) return;
  inventoryTableBody.innerHTML = '';

  const activeSlots = (state.slots || []).filter(isBoxActive);
  const soldOutList = state.soldOutThisShift || [];
  const searchInput = document.getElementById('invSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  // Compute overall active totals across all active slots
  let totalActiveValue = 0;
  let totalActiveTickets = 0;
  let totalSoldThisShift = 0;
  let totalSoldValue = 0;

  activeSlots.forEach(slot => {
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    const sold = Math.max(0, current - start);
    const remaining = Math.max(0, totalPackSize - current);
    
    totalActiveTickets += remaining;
    totalActiveValue += remaining * (slot.price || 1);
    totalSoldThisShift += sold;
    totalSoldValue += sold * (slot.price || 1);
  });

  soldOutList.forEach(so => {
    const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    totalSoldThisShift += sold;
    totalSoldValue += sold * (so.price || 1);
  });

  const packsStat = document.getElementById('invActivePacksStat');
  const valStat = document.getElementById('invActiveValueStat');
  const tixStat = document.getElementById('invActiveTicketsStat');
  const soldStat = document.getElementById('invActiveSoldStat');

  if (packsStat) packsStat.textContent = `${activeSlots.length} Active${soldOutList.length > 0 ? ` (+${soldOutList.length} Finished)` : ''}`;
  if (tixStat) tixStat.textContent = `${totalActiveTickets.toLocaleString()} Left`;
  if (soldStat) soldStat.textContent = `${totalSoldThisShift.toLocaleString()} Sold ($${totalSoldValue.toFixed(2)})`;
  if (valStat) valStat.textContent = `$${totalActiveValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  const matchesQuery = (item) => {
    if (!query) return true;
    const name = cleanGameTitle(item.gameName).toLowerCase();
    const boxStr = String(item.boxNumber);
    const priceStr = String(item.price);
    const packStr = String(item.packNumber || '').toLowerCase();
    return name.includes(query) || boxStr === query || priceStr === query.replace('$', '') || packStr.includes(query);
  };

  const filteredActive = activeSlots.filter(matchesQuery);
  const filteredSoldOut = soldOutList.filter(matchesQuery);

  if (filteredActive.length === 0 && filteredSoldOut.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="7" style="text-align:center; color:var(--text-muted); padding:28px; font-size:0.9rem;">
        ${activeSlots.length === 0 ? 'No activated tickets in dispensers.' : `No tickets match "${query}".`}
      </td>
    `;
    inventoryTableBody.appendChild(emptyRow);
    return;
  }

  // 1. Render Active Dispenser Boxes (7 clean columns, read-only tracking)
  filteredActive.forEach(slot => {
    const row = document.createElement('tr');
    const cleanName = cleanGameTitle(slot.gameName);
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    const sold = Math.max(0, current - start);
    const soldVal = sold * (slot.price || 1);
    const remaining = Math.max(0, totalPackSize - current);
    const cleanPack = String(slot.packNumber || '---').replace(/[^0-9]/g, '') || '---';

    const prevSold = lastKnownSoldCount[slot.boxNumber];
    const isRising = prevSold !== undefined && sold > prevSold;
    lastKnownSoldCount[slot.boxNumber] = sold;

    row.innerHTML = `
      <td><span class="inv-box-badge">Box #${slot.boxNumber}</span></td>
      <td>
        <div class="inv-game-cell">
          <span class="inv-game-title" title="${cleanName}">${cleanName}</span>
          <span class="inv-pack-sub">Pack #${cleanPack}</span>
        </div>
      </td>
      <td style="text-align: center;"><span class="inv-price-badge">$${slot.price}</span></td>
      <td style="text-align: center;">
        <span class="inv-ticket-pos">#${String(current).padStart(2, '0')} <span class="inv-ticket-max">/ ${totalPackSize}</span></span>
      </td>
      <td style="text-align: center;">
        ${sold > 0 
          ? `<span class="inv-sold-badge-active ${isRising ? 'inv-sold-rise' : ''}">
               <strong>${sold} Sold</strong> <small>($${soldVal.toFixed(2)})</small>
             </span>`
          : `<span class="inv-sold-badge-zero">0 Sold</span>`
        }
      </td>
      <td style="text-align: center;">
        <span class="inv-remaining-tix">${remaining} Left</span>
      </td>
      <td style="text-align: center;">
        <span class="inv-status-active">Active</span>
      </td>
    `;

    inventoryTableBody.appendChild(row);
  });

  // 2. Render Sold-Out & Returned Packs This Shift
  filteredSoldOut.forEach(so => {
    const row = document.createElement('tr');
    const soCleanName = cleanGameTitle(so.gameName || 'Scratch-Off Game');
    const soPackSize = so.packSize || (so.price === 1 ? 300 : so.price === 2 ? 150 : 30);
    const soSold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    const soSoldVal = soSold * (so.price || 1);
    const soPack = String(so.packNumber || '---').replace(/[^0-9]/g, '') || '---';

    row.className = so.isReturned ? 'inv-row-returned' : 'inv-row-soldout';
    row.innerHTML = `
      <td><span class="inv-box-badge so-badge">Box #${so.boxNumber}</span></td>
      <td>
        <div class="inv-game-cell">
          <span class="inv-game-title" title="${soCleanName}">${soCleanName}</span>
          <span class="inv-pack-sub">Pack #${soPack}</span>
        </div>
      </td>
      <td style="text-align: center;"><span class="inv-price-badge">$${so.price}</span></td>
      <td style="text-align: center;">
        <span class="inv-ticket-pos so-pos">#${String(so.closeTicket !== undefined ? so.closeTicket : soPackSize).padStart(2, '0')} / ${soPackSize}</span>
      </td>
      <td style="text-align: center;">
        <span class="inv-sold-badge-active ${so.isReturned ? 'badge-returned' : 'badge-soldout'}">
          <strong>${soSold} Sold</strong> <small>($${soSoldVal.toFixed(2)})</small>
        </span>
      </td>
      <td style="text-align: center;">
        <span class="inv-remaining-tix so-rem">
          ${so.isReturned ? `0 Left (${so.ticketsReturned || 0} Ret)` : '0 Left'}
        </span>
      </td>
      <td style="text-align: center;">
        ${so.isReturned 
          ? `<span class="inv-status-returned">Returned</span>` 
          : `<span class="inv-status-soldout">Sold Out</span>`
        }
      </td>
    `;

    inventoryTableBody.appendChild(row);
  });
}

// -------------------------------------------------------------
// Inventory Barcode Tracking, Duplicate Detection & Box Setting
// -------------------------------------------------------------

let pendingSetBoxBarcode = null;
let pendingSetBoxGame = null;

function isBarcodeAlreadyScanned(barcode) {
  if (!barcode) return false;
  const clean = String(barcode).trim();
  if (!clean) return false;

  const parsed = parseLotteryBarcode(barcode);
  const targetCanonical = parsed?.canonicalId;

  // 1. Check in state.inventoryBarcodes
  if (state.inventoryBarcodes) {
    if (state.inventoryBarcodes[clean]) return true;
    if (targetCanonical && state.inventoryBarcodes[targetCanonical]) return true;
  }

  // 2. Check across all dispenser slots
  for (const slot of (state.slots || [])) {
    if (slot.scannedBarcodes) {
      const match = slot.scannedBarcodes.some(b => {
        const rawStr = typeof b === 'string' ? b : b.barcode;
        if (rawStr === clean) return true;
        if (targetCanonical) {
          const bParsed = parseLotteryBarcode(rawStr);
          if (bParsed?.canonicalId && bParsed.canonicalId === targetCanonical) {
            return true;
          }
        }
        return false;
      });
      if (match) return true;
    }
  }
  return false;
}

function findScannedBarcodeInfo(barcode) {
  if (!barcode) return null;
  const clean = String(barcode).trim();
  const parsed = parseLotteryBarcode(barcode);
  const targetCanonical = parsed?.canonicalId;

  if (state.inventoryBarcodes) {
    if (state.inventoryBarcodes[clean]) return state.inventoryBarcodes[clean];
    if (targetCanonical && state.inventoryBarcodes[targetCanonical]) return state.inventoryBarcodes[targetCanonical];
  }

  for (const slot of (state.slots || [])) {
    if (slot.scannedBarcodes) {
      const match = slot.scannedBarcodes.find(b => {
        const rawStr = typeof b === 'string' ? b : b.barcode;
        if (rawStr === clean) return true;
        if (targetCanonical) {
          const bParsed = parseLotteryBarcode(rawStr);
          if (bParsed?.canonicalId && bParsed.canonicalId === targetCanonical) {
            return true;
          }
        }
        return false;
      });
      if (match) {
        return {
          boxNumber: slot.boxNumber,
          gameName: slot.gameName,
          price: slot.price,
          scannedAt: (typeof match === 'object' && match.scannedAt) ? match.scannedAt : 'Earlier'
        };
      }
    }
  }
  return null;
}

function handleTicketBarcodeScan(rawBarcode, source = 'main') {
  const barcode = String(rawBarcode).trim();
  if (!barcode) {
    sfx.alert();
    showToast('Please scan or enter a ticket barcode.', 'error');
    return;
  }

  // 1. Duplicate check: Has this barcode already been scanned into inventory?
  if (isBarcodeAlreadyScanned(barcode)) {
    const existing = findScannedBarcodeInfo(barcode);
    sfx.alert();
    const errorMsg = `⚠️ Already Scanned! Ticket [${barcode}] was already put into Box #${existing?.boxNumber || '?'}. Skipping duplicate.`;
    showToast(errorMsg, 'error');

    if (voice && typeof voice.speak === 'function') {
      voice.speak('Ticket already scanned. Skipping duplicate.');
    }

    const fb = document.getElementById('invScanFeedback');
    if (fb) {
      fb.style.display = 'flex';
      fb.className = 'inv-scan-feedback error';
      fb.innerHTML = `❌ <strong>ALREADY SCANNED:</strong> Ticket <code>${barcode}</code> was already put into <strong>Box #${existing?.boxNumber}</strong> (${existing?.gameName || 'Game'}). <strong>Skipped duplicate!</strong>`;
    }

    const invInput = document.getElementById('invBoxTicketBarcodeInput');
    if (invInput) {
      invInput.value = '';
      invInput.focus();
    }
    return; // SKIPS DUPLICATE!
  }

  // 2. New ticket: Pop up Step 1 modal (Name and Price only)
  openSetTicketDetailsModal(barcode);
}

let pendingChosenName = 'Scratch-Off Game';
let pendingChosenPrice = 1;
let setBoxModalOpenedAt = 0;

function updatePricePillsSelection(price) {
  const p = Number(price) || 1;
  document.querySelectorAll('.set-box-price-pill').forEach(pill => {
    const val = Number(pill.getAttribute('data-price'));
    pill.classList.toggle('active', val === p);
  });
  const packInfo = document.getElementById('setBoxPackInfoDisplay');
  if (packInfo) {
    const std = getStandardPackDetails(p);
    packInfo.innerHTML = `📖 <strong>$${std.bookValue} Pack</strong> (${std.packSize} tickets)`;
  }
}

// -------------------------------------------------------------
// Step 1: Open Ticket Details Modal (Only Name & Price)
// -------------------------------------------------------------
function openSetTicketDetailsModal(barcode) {
  if (!barcode) return;
  pendingSetBoxBarcode = barcode;

  const barcodeDisplay = document.getElementById('setTicketBarcodeDisplay');
  const gameDisplay = document.getElementById('setTicketGameDisplay');
  const nameInput = document.getElementById('setBoxGameNameInput');
  const priceInput = document.getElementById('setBoxPriceInput');

  if (barcodeDisplay) barcodeDisplay.textContent = barcode;

  // Auto-detect game and barcode details
  const parsed = parseLotteryBarcode(barcode);
  const matchedGame = findGameByBarcode(barcode, state.customGames);
  pendingSetBoxGame = matchedGame;

  let initialName = '';
  let initialPrice = 1;

  if (matchedGame) {
    initialName = cleanGameTitle(matchedGame.name);
    initialPrice = matchedGame.price || 1;
    const tixInfo = (parsed && parsed.ticketNumber !== null) ? ` · Start Tix: #${String(parsed.ticketNumber).padStart(2, '0')}` : '';
    const packInfo = (parsed && parsed.packNumber) ? ` · Pack #${parsed.packNumber}` : '';
    if (gameDisplay) {
      gameDisplay.innerHTML = `<span style="color:#10b981; font-weight:800;">✓ Matched Game:</span> ${initialName} · <strong style="color:#ffffff;">$${initialPrice}.00</strong> <span style="color:#a1a1aa; font-size:0.78rem; font-family:var(--font-mono); font-weight:700;">${packInfo}${tixInfo}</span>`;
    }
  } else {
    initialName = 'Scratch-Off Game';
    initialPrice = 1;
    const tixInfo = (parsed && parsed.ticketNumber !== null) ? ` · Tix #${String(parsed.ticketNumber).padStart(2, '0')}` : '';
    const packInfo = (parsed && parsed.packNumber) ? ` · Pack #${parsed.packNumber}` : '';
    if (gameDisplay) {
      gameDisplay.innerHTML = `<span style="color:#e4e4e7; font-weight:700;">New Lottery Ticket</span> <span style="color:#a1a1aa; font-size:0.78rem; font-family:var(--font-mono);">${packInfo}${tixInfo}</span>`;
    }
  }

  pendingChosenName = initialName;
  pendingChosenPrice = initialPrice;

  if (nameInput) {
    nameInput.value = initialName;
  }
  if (priceInput) {
    priceInput.value = initialPrice;
  }
  updatePricePillsSelection(initialPrice);

  sfx.beep();
  if (setTicketDetailsModal) {
    setTicketDetailsModal.showModal();
    setTimeout(() => {
      nameInput?.focus();
      nameInput?.select();
    }, 100);
  }
}

// -------------------------------------------------------------
// Transition from Step 1 to Step 2 (Box Assignment)
// -------------------------------------------------------------
function proceedToSetBoxStep() {
  const nameInput = document.getElementById('setBoxGameNameInput');
  const priceInput = document.getElementById('setBoxPriceInput');

  pendingChosenName = nameInput?.value?.trim() || 'Scratch-Off Game';
  pendingChosenPrice = Math.max(1, parseFloat(priceInput?.value) || 1);

  // Close Step 1
  setTicketDetailsModal?.close();

  // Open Step 2: Set into Box modal
  openSetBoxModal(pendingSetBoxBarcode);
}

// -------------------------------------------------------------
// Step 2: Put Ticket into Box Modal
// -------------------------------------------------------------
function openSetBoxModal(barcode) {
  if (!barcode) barcode = pendingSetBoxBarcode;
  if (!barcode) return;
  pendingSetBoxBarcode = barcode;
  setBoxModalOpenedAt = Date.now();

  const parsed = parseLotteryBarcode(barcode);
  const cleanPack = (parsed && parsed.packNumber) ? parsed.packNumber : (barcode ? String(barcode).replace(/[^0-9]/g, '').slice(-7) : '---');

  // Fill Step 2 Ticket Summary
  const s2Name = document.getElementById('step2GameNameDisplay');
  const s2Price = document.getElementById('step2PriceBadge');
  const s2Pack = document.getElementById('step2PackDisplay');
  const s2Barcode = document.getElementById('step2BarcodeDisplay');

  if (s2Name) s2Name.textContent = cleanGameTitle(pendingChosenName);
  if (s2Price) s2Price.textContent = `$${pendingChosenPrice}`;
  if (s2Pack) s2Pack.textContent = `Pack #${cleanPack}`;
  if (s2Barcode) s2Barcode.textContent = `Barcode #${barcode}`;

  // Suggest box: existing active box with same game, or first empty box
  let suggestedBox = null;
  const existingSlot = state.slots.find(s => s.status === 'ACTIVE' && (
    (pendingSetBoxGame && s.gameId === pendingSetBoxGame.id) ||
    cleanGameTitle(s.gameName).toLowerCase() === cleanGameTitle(pendingChosenName).toLowerCase()
  ));
  if (existingSlot) suggestedBox = existingSlot.boxNumber;
  if (!suggestedBox) {
    suggestedBox = findFirstEmptyBox() || 1;
  }

  const boxInput = document.getElementById('setBoxNumberInput');
  if (boxInput) {
    boxInput.value = suggestedBox;
  }

  // Quick suggestions buttons
  const suggestionsDiv = document.getElementById('setBoxQuickSuggestions');
  if (suggestionsDiv) {
    suggestionsDiv.innerHTML = '';
    const suggestedBoxes = [];
    if (suggestedBox) suggestedBoxes.push({ num: suggestedBox, label: `Suggested Box #${suggestedBox}` });

    const emptySlots = (state.slots || []).filter(s => s.status === 'EMPTY').slice(0, 3);
    emptySlots.forEach(s => {
      if (!suggestedBoxes.some(sb => sb.num === s.boxNumber)) {
        suggestedBoxes.push({ num: s.boxNumber, label: `Empty Box #${s.boxNumber}` });
      }
    });

    suggestedBoxes.forEach(sb => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = sb.label;
      btn.addEventListener('click', () => {
        if (boxInput) boxInput.value = sb.num;
        sfx.keypad();
      });
      suggestionsDiv.appendChild(btn);
    });
  }

  sfx.beep();
  if (setBoxModal) {
    setBoxModal.showModal();
    setTimeout(() => {
      boxInput?.focus();
      boxInput?.select();
    }, 100);
  }
}

function confirmSetBoxForTicket() {
  if (Date.now() - setBoxModalOpenedAt < 400) {
    return; // Prevent immediate auto-confirmation from the Enter key that opened the modal
  }
  const boxInput = document.getElementById('setBoxNumberInput');
  const boxNum = parseInt(boxInput?.value, 10);
  if (isNaN(boxNum) || boxNum < 1) {
    sfx.alert();
    showToast('Please enter a valid Box # (1 to 100).', 'error');
    boxInput?.focus();
    return;
  }

  if (!pendingSetBoxBarcode) {
    setBoxModal?.close();
    return;
  }

  const barcode = pendingSetBoxBarcode;
  const restorePack = pendingRestorePack;
  const chosenName = pendingChosenName || 'Scratch-Off Game';
  const chosenPrice = pendingChosenPrice || 1;

  const success = handleSetBoxForTicket(boxNum, barcode, pendingSetBoxGame, restorePack, chosenName, chosenPrice);
  if (success) {
    setBoxModal?.close();
    pendingSetBoxBarcode = null;
    pendingSetBoxGame = null;
    pendingRestorePack = null;
    pendingNewTicketBarcode = null;

    if (lastScanReadoutContainer) {
      lastScanReadoutContainer.classList.remove('alert-yellow');
    }

    // Matching LTSYSTEM Video 01:21: If fixing a sold-out ticket, immediately open Fix Ticket Position keypad!
    if (restorePack) {
      const slot = state.slots.find(s => s.boxNumber === boxNum);
      if (slot) {
        currentAdjustingSlot = slot;
        openFixTicketPositionModal(slot);
        return;
      }
    }

    const invInput = document.getElementById('invBoxTicketBarcodeInput');
    if (invInput) {
      invInput.value = '';
      invInput.focus();
    }
    const fb = document.getElementById('invScanFeedback');
    if (fb) {
      fb.style.display = 'flex';
      fb.className = 'inv-scan-feedback success';
      const slot = state.slots.find(s => s.boxNumber === boxNum);
      fb.innerHTML = `✓ <strong>TICKET SAVED:</strong> Barcode <code>${barcode}</code> (${cleanGameTitle(chosenName)}, $${chosenPrice}) put into <strong>Box #${boxNum}</strong>!`;
    }
  }
}

function handleSetBoxForTicket(boxNumber, barcode, detectedGame, restorePack = null, customName = null, customPrice = null) {
  const boxNum = parseInt(boxNumber, 10);
  if (isNaN(boxNum) || boxNum < 1) {
    showToast('Please enter a valid Box # (1 or higher).', 'error');
    return false;
  }

  // Duplicate safety check
  if (isBarcodeAlreadyScanned(barcode)) {
    const existing = findScannedBarcodeInfo(barcode);
    showToast(`⚠️ Already Scanned! Ticket [${barcode}] is already in Box #${existing?.boxNumber || '?'}. Skipping duplicate.`, 'error');
    sfx.alert();
    return false;
  }

  // Expand slots if box number exceeds totalSlots
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
        ticketsInBox: 0,
        scannedBarcodes: [],
        activatedThisShift: false,
        daysActive: 0,
        scannedInEndShift: false
      });
    }
    state.totalSlots = boxNum;
  }

  let slot = state.slots.find(s => s.boxNumber === boxNum);
  if (!slot) {
    showToast(`Box #${boxNum} not found.`, 'error');
    return false;
  }

  if (!slot.scannedBarcodes) slot.scannedBarcodes = [];

  // Determine game, name, price, and pack size
  const game = detectedGame || findGameByBarcode(barcode, state.customGames) || SAMPLE_GAMES[0];
  const finalPrice = (customPrice !== null && !isNaN(customPrice) && customPrice > 0) ? customPrice : (game.price || 1);
  const finalName = customName ? cleanGameTitle(customName) : cleanGameTitle(game.name || 'Scratch-Off Game');
  const std = getStandardPackDetails(finalPrice);
  const packSize = std.packSize;

  // Register in state.customGames if this is a custom game
  if (customName && !state.customGames.some(cg => cg.name.toLowerCase() === finalName.toLowerCase())) {
    const cleanDigits = barcode.replace(/[^0-9]/g, '');
    const prefix = cleanDigits.length >= 4 ? cleanDigits.slice(0, 4) : '';
    state.customGames.push({
      id: 'cg_' + Date.now(),
      name: finalName,
      price: finalPrice,
      packSize: packSize,
      barcodePrefix: prefix
    });
  }

  // Parse ticket number and pack number using robust lottery barcode parser
  const parsed = parseLotteryBarcode(barcode);
  const cleanDigits = barcode.replace(/[^0-9]/g, '');
  let ticketNum = null;

  if (parsed && parsed.ticketNumber !== null && parsed.ticketNumber < packSize) {
    ticketNum = parsed.ticketNumber;
  } else if (barcode.includes('-')) {
    const parts = barcode.split('-');
    const lastPart = parts[parts.length - 1].replace(/[^0-9]/g, '');
    if (lastPart) {
      const parsedPart = parseInt(lastPart, 10);
      if (parsedPart < packSize) ticketNum = parsedPart;
    }
  } else if (cleanDigits.length >= 10) {
    const candidate = parseInt(cleanDigits.slice(-3), 10);
    if (!isNaN(candidate) && candidate < packSize) {
      ticketNum = candidate;
    }
  }

  // Strictly ensure validTicketNum is within 0 .. packSize - 1. Default to 0 for fresh activation!
  let validTicketNum = 0;
  if (ticketNum !== null && !isNaN(ticketNum) && ticketNum >= 0 && ticketNum < packSize) {
    validTicketNum = ticketNum;
  }

  const realPackNumber = (parsed && parsed.packNumber)
    ? parsed.packNumber
    : (cleanDigits.length >= 6 ? cleanDigits.slice(-7) : barcode);

  const barcodeRecord = {
    barcode: barcode,
    scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    ticketNumber: validTicketNum
  };

  slot.scannedBarcodes.push(barcodeRecord);
  slot.ticketsInBox = slot.scannedBarcodes.length;

  // Restore sold-out pack vs brand new activation
  if (restorePack) {
    slot.status = 'ACTIVE';
    slot.gameId = restorePack.gameId || (detectedGame ? detectedGame.id : 'g101');
    slot.gameName = finalName;
    slot.price = finalPrice;
    slot.packNumber = restorePack.packNumber || realPackNumber;
    slot.packSize = packSize;

    // Use ticket number from scanned barcode, or closing ticket from sold-out pack
    const restoredPos = (validTicketNum > 0)
      ? validTicketNum
      : ((restorePack.closeTicket !== undefined && restorePack.closeTicket !== null && restorePack.closeTicket < packSize) ? restorePack.closeTicket : 0);

    slot.startTicket = restoredPos;
    slot.currentTicket = restoredPos;
    slot.activatedThisShift = false; // Restored pack, NOT a brand new #00 pack
    slot.daysActive = restorePack.daysActive || 1;
    slot.scannedInEndShift = false;

    // Remove from state.soldOutThisShift so it's no longer marked sold out
    if (state.soldOutThisShift) {
      const soIdx = state.soldOutThisShift.findIndex(
        so => so.packNumber === slot.packNumber || so.boxNumber === slot.boxNumber
      );
      if (soIdx >= 0) {
        state.soldOutThisShift.splice(soIdx, 1);
      }
    }
    showToast(`✓ Restored Pack #${slot.packNumber} into Box #${boxNum} (${finalName}, $${finalPrice}) at Ticket #${String(restoredPos).padStart(2, '0')}!`, 'success');
  } else {
    // Brand new activation or putting new ticket into empty/sold-out box!
    slot.status = 'ACTIVE';
    slot.gameId = (game && game.name === finalName) ? game.id : 'custom';
    slot.gameName = finalName;
    slot.price = finalPrice;
    slot.packNumber = realPackNumber;
    slot.packSize = packSize;
    slot.startTicket = validTicketNum;
    slot.currentTicket = validTicketNum;
    slot.activatedThisShift = (validTicketNum === 0);
    slot.daysActive = 1;
    slot.scannedInEndShift = false;

    // Remove from state.soldOutThisShift if this box was previously sold out
    if (state.soldOutThisShift) {
      const soIdx = state.soldOutThisShift.findIndex(
        so => so.packNumber === slot.packNumber || so.boxNumber === slot.boxNumber
      );
      if (soIdx >= 0) {
        state.soldOutThisShift.splice(soIdx, 1);
      }
    }
  }

  // Record in global inventoryBarcodes
  if (!state.inventoryBarcodes) state.inventoryBarcodes = {};
  state.inventoryBarcodes[barcode] = {
    boxNumber: boxNum,
    barcode: barcode,
    gameName: slot.gameName,
    price: slot.price,
    scannedAt: barcodeRecord.scannedAt
  };

  // Scan-to-Appear: Immediately bring this newly assigned box into the dispenser rack!
  state.lastScannedSlot = boxNum;
  bringBoxToVisibleRack(boxNum);

  const cleanName = cleanGameTitle(slot.gameName);
  state.lastScanData = {
    barcode: barcode,
    boxNumber: boxNum,
    gameName: cleanName,
    price: slot.price,
    packNumber: slot.packNumber || '---',
    ticketNumber: slot.currentTicket || 0,
    action: 'ASSIGNED'
  };
  state.lastScannedBarcode = `[${barcode}] Box #${boxNum}: $${Number(slot.price).toFixed(2)} · ${cleanName} (#${String(slot.currentTicket || 0).padStart(2, '0')})`;

  saveState(state);
  sfx.success();
  showToast(`✓ Ticket [${barcode}] saved to Box #${boxNum} ($${slot.price} · ${cleanName})!`, 'success');

  renderInventoryTable();
  renderDispenserRack();
  renderHeaderAndMetrics();
  renderSlotsRibbon();

  return true;
}

function openBoxBarcodesModal(slot) {
  if (!boxBarcodesModal) return;
  const title = document.getElementById('boxBarcodesTitle');
  const countBadge = document.getElementById('boxBarcodesCountBadge');
  const gameInfo = document.getElementById('boxBarcodesGameInfo');
  const tbody = document.getElementById('boxBarcodesTableBody');

  if (title) title.textContent = `📦 Box #${slot.boxNumber} Saved Barcodes`;
  const barcodes = slot.scannedBarcodes || [];
  const count = barcodes.length;
  if (countBadge) countBadge.textContent = `${count} Barcodes (${slot.ticketsInBox || count} Tickets)`;
  if (gameInfo) {
    gameInfo.innerHTML = `<strong>${cleanGameTitle(slot.gameName)}</strong> · Price: <strong>$${slot.price}.00</strong> · Pack #: <code>${slot.packNumber || '---'}</code>`;
  }

  if (tbody) {
    tbody.innerHTML = '';
    if (barcodes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:24px;">No barcodes saved in Box #${slot.boxNumber} yet. Scan tickets to put them into this box.</td></tr>`;
    } else {
      barcodes.forEach((b, idx) => {
        const bCode = typeof b === 'string' ? b : b.barcode;
        const bTime = typeof b === 'object' && b.scannedAt ? b.scannedAt : '---';
        const bTix = typeof b === 'object' && b.ticketNumber !== undefined ? `#${String(b.ticketNumber).padStart(2, '0')}` : `#${String(idx + 1).padStart(2, '0')}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:var(--text-muted); font-weight:700;">${idx + 1}</td>
          <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">${bCode}</td>
          <td style="font-weight:700; color:var(--color-primary);">${bTix}</td>
          <td style="color:var(--text-secondary); font-size:0.8rem;">${bTime}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  boxBarcodesModal.showModal();
}

function setupSetBoxModalLogic() {
  // Step 1: Ticket Details
  closeSetTicketDetailsModalBtn?.addEventListener('click', () => {
    setTicketDetailsModal?.close();
    pendingSetBoxBarcode = null;
  });
  btnCancelTicketDetails?.addEventListener('click', () => {
    setTicketDetailsModal?.close();
    pendingSetBoxBarcode = null;
  });
  btnTicketDetailsNext?.addEventListener('click', proceedToSetBoxStep);

  // Step 2: Set Box
  closeSetBoxModalBtn?.addEventListener('click', () => {
    setBoxModal?.close();
    pendingSetBoxBarcode = null;
  });
  btnCancelSetBox?.addEventListener('click', () => {
    setBoxModal?.close();
    pendingSetBoxBarcode = null;
  });
  btnBackToTicketDetails?.addEventListener('click', () => {
    setBoxModal?.close();
    if (setTicketDetailsModal) {
      setTicketDetailsModal.showModal();
    }
  });
  btnSetBoxConfirm?.addEventListener('click', confirmSetBoxForTicket);

  setBoxNumberInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - setBoxModalOpenedAt >= 400) {
        confirmSetBoxForTicket();
      }
    }
  });

  // Step Up / Down arrows for Box input
  document.getElementById('setBoxStepUp')?.addEventListener('click', () => {
    if (setBoxNumberInput) {
      setBoxNumberInput.value = Math.min(100, (parseInt(setBoxNumberInput.value, 10) || 1) + 1);
      sfx.keypad();
    }
  });
  document.getElementById('setBoxStepDown')?.addEventListener('click', () => {
    if (setBoxNumberInput) {
      setBoxNumberInput.value = Math.max(1, (parseInt(setBoxNumberInput.value, 10) || 1) - 1);
      sfx.keypad();
    }
  });

  // Price pill clicks
  document.querySelectorAll('.set-box-price-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      sfx.keypad();
      const p = Number(pill.getAttribute('data-price'));
      const priceInput = document.getElementById('setBoxPriceInput');
      if (priceInput) priceInput.value = p;
      updatePricePillsSelection(p);
    });
  });

  const priceInput = document.getElementById('setBoxPriceInput');
  priceInput?.addEventListener('input', (e) => {
    updatePricePillsSelection(e.target.value);
  });

  // Enter keys in name and price inputs for smooth keyboard navigation
  document.getElementById('setBoxGameNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('setBoxPriceInput')?.focus();
      document.getElementById('setBoxPriceInput')?.select();
    }
  });

  priceInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      proceedToSetBoxStep();
    }
  });

  closeBoxBarcodesBtn?.addEventListener('click', () => boxBarcodesModal?.close());
  closeBoxBarcodesBtn2?.addEventListener('click', () => boxBarcodesModal?.close());
}

function setupInventoryModalLogic() {
  const invSearchInput = document.getElementById('invSearchInput');

  invSearchInput?.addEventListener('input', () => {
    renderInventoryTable();
  });

  document.getElementById('btnInvModeStatus')?.addEventListener('click', () => {
    openInventoryModal('status');
  });

  document.getElementById('btnInvModeIntake')?.addEventListener('click', () => {
    openInventoryModal('intake');
  });

  invBoxTicketBarcodeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleTicketBarcodeScan(invBoxTicketBarcodeInput.value.trim(), 'inventory');
    }
  });

  btnInvBoxTicketScan?.addEventListener('click', () => {
    handleTicketBarcodeScan(invBoxTicketBarcodeInput?.value.trim(), 'inventory');
  });
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

      // If keypadBoxInput was active inside activationModal
      if (activeEl === keypadBoxInput) {
        scanBuffer = '';
        commitBoxActivation();
        e.preventDefault();
        return;
      }

      // If setBoxModal is open, confirm set box (only if opened for at least 400ms)
      if (setBoxModal && setBoxModal.open) {
        scanBuffer = '';
        if (Date.now() - setBoxModalOpenedAt >= 400) {
          confirmSetBoxForTicket();
        }
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
      // Hardware barcode scanners type with < 60ms between characters; wireless/Bluetooth jitter can reach 200ms
      if (now - lastKeystrokeTime > 250) {
        scanBuffer = ''; // Reset buffer on pause
      }
      scanBuffer += e.key;
      lastKeystrokeTime = now;
    }
  });

  // Dedicated listener for the main scanner input
  barcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const val = barcodeInput.value.trim();
      if (val) {
        barcodeInput.value = '';
        processScannedBarcode(val);
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

let lastScannedRawBarcode = '';
let lastScannedBarcodeTime = 0;

function processScannedBarcode(rawBarcode) {
  sfx.beep();
  state.lastScannedBarcode = rawBarcode;

  // Reset any alert banner styles from previous gatekeeper warnings
  if (scanAlertTimeout) {
    clearTimeout(scanAlertTimeout);
    scanAlertTimeout = null;
  }
  if (lastScanReadoutContainer) {
    lastScanReadoutContainer.classList.remove('alert-yellow');
  }
  if (scanActionTitle) {
    scanActionTitle.style.background = '';
    scanActionTitle.style.color = '';
    scanActionTitle.style.padding = '';
    scanActionTitle.style.borderRadius = '';
  }

  // Scenario 1: Update Inventory Modal is open -> handle ticket scan for intake or lookup only
  if (inventoryModal && inventoryModal.open) {
    if (currentInventoryModalMode === 'intake') {
      handleTicketBarcodeScan(rawBarcode, 'inventory');
      return;
    }
    // Mode is 'status': strictly read-only monitoring dashboard, no sales allowed from this screen!
    const searchInput = document.getElementById('invSearchInput');
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    const parsedTicket = parseLotteryBarcode(rawBarcode);

    if (parsedBoxNum && parsedBoxNum >= 1 && parsedBoxNum <= 100) {
      if (searchInput) {
        searchInput.value = String(parsedBoxNum);
        renderInventoryTable();
      }
      showToast(`🔍 Filtered to Box #${parsedBoxNum} (Sales disabled on Inventory Status screen).`, 'info');
      return;
    }

    if (parsedTicket && parsedTicket.packNumber) {
      if (searchInput) {
        searchInput.value = parsedTicket.packNumber;
        renderInventoryTable();
      }
      showToast(`🔍 Located Pack #${parsedTicket.packNumber} in Inventory. (Sales disabled on this screen).`, 'info');
      return;
    }

    showToast('⚠️ Inventory Status is read-only. Close screen to sell tickets at register.', 'info');
    return;
  }

  // Scenario 1a: Ticket Details Modal is open -> if user scans box barcode, advance to box and set
  if (setTicketDetailsModal && setTicketDetailsModal.open) {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    if (parsedBoxNum && parsedBoxNum >= 1 && parsedBoxNum <= 100) {
      proceedToSetBoxStep();
      if (setBoxNumberInput) setBoxNumberInput.value = parsedBoxNum;
      confirmSetBoxForTicket();
      return;
    }
  }

  // Scenario 1b: Set Box Modal is open -> if user scans box barcode, confirm set box
  if (setBoxModal && setBoxModal.open) {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    if (parsedBoxNum && parsedBoxNum >= 1 && parsedBoxNum <= 100) {
      if (setBoxNumberInput) setBoxNumberInput.value = parsedBoxNum;
      confirmSetBoxForTicket();
      return;
    }
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
      // Scanned another pack barcode: dynamically detect game & pack info
      const parsed = parseLotteryBarcode(rawBarcode);
      const matchedGame = findGameByBarcode(rawBarcode, state.customGames);
      const gamePrice = matchedGame ? matchedGame.price : 20;
      const gameName = matchedGame ? cleanGameTitle(matchedGame.name) : 'Scratch-Off Game';
      const std = getStandardPackDetails(gamePrice);
      const packNum = (parsed && parsed.packNumber) ? parsed.packNumber : (rawBarcode.replace(/[^0-9]/g, '').slice(-7) || '889901');

      pendingActivationPack = {
        packNumber: packNum,
        gameId: matchedGame ? matchedGame.id : ('g' + Math.floor(100 + Math.random() * 900)),
        gameName: gameName,
        price: gamePrice,
        packSize: std.packSize
      };
      activationGameTitle.textContent = formatGameTitle(pendingActivationPack.price, pendingActivationPack.gameName);
      showToast(`Pack #${pendingActivationPack.packNumber} scanned: $${gamePrice} ${gameName}!`, 'info');
      return;
    }
  }

  // Scenario 3: End Shift Scanning (Verify Active Boxes)
  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    const parsedTicket = parseLotteryBarcode(rawBarcode);
    const cleanDigits = rawBarcode.replace(/[^0-9]/g, '');
    let targetSlot = null;

    // 1. Check if scanned barcode is a box identifier (e.g. "BOX-01", "1")
    if (parsedBoxNum) {
      targetSlot = state.slots.find(s => s.boxNumber === parsedBoxNum && isBoxActive(s));
    }

    // 2. Check if this exact barcode was previously scanned and stored into any active box
    if (!targetSlot) {
      const scannedInfo = findScannedBarcodeInfo(rawBarcode);
      if (scannedInfo && scannedInfo.boxNumber) {
        targetSlot = state.slots.find(s => s.boxNumber === scannedInfo.boxNumber && isBoxActive(s));
      }
    }

    // 3. Match by parsed pack number (STRICT: exact normalized match only to prevent wrong-ticket corruption)
    if (!targetSlot && parsedTicket && parsedTicket.packNumber) {
      const targetPackNorm = normalizePackNumber(parsedTicket.packNumber);
      if (targetPackNorm.length >= 4) {
        targetSlot = state.slots.find(s => {
          if (!isBoxActive(s)) return false;
          const slotPackNorm = normalizePackNumber(s.packNumber);
          return slotPackNorm === targetPackNorm;
        });
      }
    }

    // 4. Also check if barcode contains an active box's exact normalized pack number
    if (!targetSlot) {
      targetSlot = state.slots.find(s => {
        if (!isBoxActive(s)) return false;
        const slotPackNorm = normalizePackNumber(s.packNumber);
        if (slotPackNorm.length < 4) return false;
        return cleanDigits.includes(slotPackNorm);
      });
    }

    // 5. Match by game barcodePrefix (ONLY if pack number also matches exactly)
    if (!targetSlot && parsedTicket && parsedTicket.gameNumber) {
      const matchingSlots = state.slots.filter(s => {
        if (!isBoxActive(s)) return false;
        // Pack number MUST match exactly if the ticket has one
        if (parsedTicket.packNumber) {
          const slotPackNorm = normalizePackNumber(s.packNumber);
          const ticketPackNorm = normalizePackNumber(parsedTicket.packNumber);
          if (slotPackNorm !== ticketPackNorm) {
            return false;
          }
        }
        const gameDef = SAMPLE_GAMES.find(g => g.id === s.gameId) || (state.customGames || []).find(g => g.id === s.gameId);
        return gameDef && gameDef.barcodePrefix === parsedTicket.gameNumber;
      });
      if (matchingSlots.length === 1) {
        targetSlot = matchingSlots[0];
      }
    }

    // STRICT CHECK: If scanned barcode does not match ANY active dispenser box, REJECT IT!
    // NEVER fall back to arbitrarily matching an unscanned active box!
    if (!targetSlot) {
      const soldOutMatch = (state.soldOutThisShift || []).find(so => {
        if (!so.packNumber) return false;
        const soClean = String(so.packNumber).replace(/[^0-9]/g, '');
        return cleanDigits.includes(soClean) || (parsedTicket?.packNumber && parsedTicket.packNumber.includes(soClean));
      });

      sfx.alert();
      voice.speakTicket();
      if (lastScanReadoutContainer) {
        lastScanReadoutContainer.classList.add('alert-yellow');
      }
      if (scanActionTitle) {
        scanActionTitle.textContent = soldOutMatch ? 'PACK ALREADY SOLD OUT' : 'WRONG TICKET - NOT IN ACTIVE BOX';
      }
      if (lastScanDisplay) {
        lastScanDisplay.textContent = soldOutMatch
          ? `Pack #${soldOutMatch.packNumber} (Box #${soldOutMatch.boxNumber}) is already sold out!`
          : `Barcode [${rawBarcode}] is NOT in any active dispenser box!`;
      }
      showToast(
        soldOutMatch
          ? `⚠️ Pack #${soldOutMatch.packNumber} (Box #${soldOutMatch.boxNumber}) is already SOLD OUT. Please scan an active box ticket.`
          : `❌ Wrong ticket [${rawBarcode}]! This ticket is not in any active dispenser box.`,
        'error'
      );

      clearTimeout(scanAlertTimeout);
      scanAlertTimeout = setTimeout(() => {
        if (lastScanReadoutContainer?.classList.contains('alert-yellow') && (scanActionTitle?.textContent === 'WRONG TICKET - NOT IN ACTIVE BOX' || scanActionTitle?.textContent === 'PACK ALREADY SOLD OUT')) {
          clearScanAlertBanner();
        }
      }, 5000);
      return;
    }

    // Box was found. Check if it was ALREADY verified in this End Shift session
    if (targetSlot.scannedInEndShift) {
      let ticketUpdated = false;
      const prevTicket = targetSlot.currentTicket;
      if (parsedTicket && parsedTicket.ticketNumber !== null) {
        const std = getStandardPackDetails(targetSlot.price || 2);
        const packSize = targetSlot.packSize || std.packSize;
        // Validate pack ownership before updating ticket number
        let packOwnershipValid = true;
        if (parsedTicket.packNumber && targetSlot.packNumber) {
          const ticketPackNorm = normalizePackNumber(parsedTicket.packNumber);
          const slotPackNorm = normalizePackNumber(targetSlot.packNumber);
          packOwnershipValid = (ticketPackNorm === slotPackNorm);
        }
        if (packOwnershipValid && parsedTicket.ticketNumber >= 0 && parsedTicket.ticketNumber <= packSize) {
          if (targetSlot.currentTicket !== parsedTicket.ticketNumber) {
            targetSlot.currentTicket = parsedTicket.ticketNumber;
            ticketUpdated = true;
          }
        }
      }

      if (ticketUpdated) {
        recordUndoAction({
          type: 'VERIFY_END_SHIFT',
          boxNumber: targetSlot.boxNumber,
          prevTicket: prevTicket,
          prevScannedInEndShift: true
        });
      }

      const cleanName = cleanGameTitle(targetSlot.gameName);
      state.lastScannedSlot = targetSlot.boxNumber;
      bringBoxToVisibleRack(targetSlot.boxNumber);
      state.lastScanData = {
        barcode: rawBarcode,
        boxNumber: targetSlot.boxNumber,
        gameName: cleanName,
        price: targetSlot.price,
        packNumber: targetSlot.packNumber || '---',
        ticketNumber: targetSlot.currentTicket || 0,
        action: 'VERIFIED'
      };
      state.lastScannedBarcode = `[${rawBarcode}] Box #${targetSlot.boxNumber} Already Verified: $${Number(targetSlot.price).toFixed(2)} · ${cleanName} (#${String(targetSlot.currentTicket || 0).padStart(2, '0')})`;
      sfx.beep();
      if (ticketUpdated) {
        showToast(`ℹ️ Box #${targetSlot.boxNumber} closing ticket updated to #${String(targetSlot.currentTicket || 0).padStart(2, '0')}.`, 'info');
      } else {
        showToast(`ℹ️ Box #${targetSlot.boxNumber} was already verified ($${Number(targetSlot.price).toFixed(2)} · ${cleanName} at #${String(targetSlot.currentTicket || 0).padStart(2, '0')}).`, 'info');
      }

      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      return;
    }

    // First time verifying this active box in this End Shift
    const prevTicket = targetSlot.currentTicket;
    targetSlot.scannedInEndShift = true;

    // If a valid ticket number was extracted from the scanned barcode, update currentTicket
    // ONLY if the scanned ticket's pack number matches this slot's pack (prevents wrong ticket corruption)
    if (parsedTicket && parsedTicket.ticketNumber !== null) {
      const std = getStandardPackDetails(targetSlot.price || 2);
      const packSize = targetSlot.packSize || std.packSize;
      let packOwnershipValid = true;
      if (parsedTicket.packNumber && targetSlot.packNumber) {
        const ticketPackNorm = normalizePackNumber(parsedTicket.packNumber);
        const slotPackNorm = normalizePackNumber(targetSlot.packNumber);
        packOwnershipValid = (ticketPackNorm === slotPackNorm);
      }
      if (packOwnershipValid && parsedTicket.ticketNumber >= 0 && parsedTicket.ticketNumber <= packSize) {
        targetSlot.currentTicket = parsedTicket.ticketNumber;
      }
    }

    recordUndoAction({
      type: 'VERIFY_END_SHIFT',
      boxNumber: targetSlot.boxNumber,
      prevTicket: prevTicket,
      prevScannedInEndShift: false
    });

    const cleanName = cleanGameTitle(targetSlot.gameName);
    state.lastScannedSlot = targetSlot.boxNumber;
    bringBoxToVisibleRack(targetSlot.boxNumber);
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

    const activeSlots = state.slots.filter(isBoxActive);
    const verifiedCount = activeSlots.filter(s => s.scannedInEndShift).length;
    const remainingCount = activeSlots.length - verifiedCount;

    if (remainingCount === 0) {
      sfx.chime();
      showToast(`✓ Box #${targetSlot.boxNumber} Verified! All ${activeSlots.length} active dispenser boxes are verified!`, 'success');
    } else {
      sfx.success();
      showToast(`✓ Scanned [${rawBarcode}] Box #${targetSlot.boxNumber} ($${Number(targetSlot.price).toFixed(2)} · ${cleanName} at #${String(targetSlot.currentTicket || 0).padStart(2, '0')}) · ${remainingCount} remaining`, 'success');
    }

    saveState(state);
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    return;
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

    // 2. Parse barcode as lottery ticket
    const parsedTicket = parseLotteryBarcode(rawBarcode);
    const cleanNum = rawBarcode.replace(/[^0-9]/g, '');

    // 2a. Match by exact normalized pack number first (HIGH ACCURACY)
    let activeSlotToSell = null;
    if (parsedTicket && parsedTicket.packNumber) {
      const targetPackNorm = normalizePackNumber(parsedTicket.packNumber);
      if (targetPackNorm) {
        activeSlotToSell = state.slots.find(s => {
          if (s.status !== 'ACTIVE' || !s.packNumber) return false;
          return normalizePackNumber(s.packNumber) === targetPackNorm;
        });
      }
    }

    // 2b. Match by slot's normalized pack number contained in clean barcode digits (requires >= 5 digits to avoid false collisions)
    if (!activeSlotToSell) {
      activeSlotToSell = state.slots.find(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber) return false;
        const slotPackNorm = normalizePackNumber(s.packNumber);
        if (slotPackNorm.length < 5) return false;
        return cleanNum.includes(slotPackNorm);
      });
    }

    // 2c. Match by game barcodePrefix (ONLY if the slot has matching pack or no pack specified)
    if (!activeSlotToSell && parsedTicket && parsedTicket.gameNumber) {
      const matchingSlots = state.slots.filter(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber) return false;
        if (parsedTicket.packNumber) {
          const slotPackNorm = normalizePackNumber(s.packNumber);
          const ticketPackNorm = normalizePackNumber(parsedTicket.packNumber);
          if (slotPackNorm !== ticketPackNorm) return false;
        }
        const gameDef = SAMPLE_GAMES.find(g => g.id === s.gameId) || (state.customGames || []).find(g => g.id === s.gameId);
        return gameDef && gameDef.barcodePrefix === parsedTicket.gameNumber;
      });
      if (matchingSlots.length === 1) {
        activeSlotToSell = matchingSlots[0];
      }
    }

    // 2d. Match by game name (ONLY if pack number matches or not specified)
    if (!activeSlotToSell) {
      activeSlotToSell = state.slots.find(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber || !s.gameName) return false;
        if (parsedTicket && parsedTicket.packNumber) {
          const slotPackNorm = normalizePackNumber(s.packNumber);
          const ticketPackNorm = normalizePackNumber(parsedTicket.packNumber);
          if (slotPackNorm !== ticketPackNorm) return false;
        }
        const gName = cleanGameTitle(s.gameName).toLowerCase();
        return rawBarcode.toLowerCase().includes(gName);
      });
    }

    if (activeSlotToSell) {
      const now = Date.now();
      // Double-scan hardware debounce (ignore duplicate scan within 1200ms)
      if (lastScannedRawBarcode === rawBarcode && (now - lastScannedBarcodeTime) < 1200) {
        sfx.beep();
        showToast('⚠️ Duplicate scan ignored (Double-scan debounce).', 'info');
        return;
      }
      lastScannedRawBarcode = rawBarcode;
      lastScannedBarcodeTime = now;

      const std = getStandardPackDetails(activeSlotToSell.price || 2);
      const packSize = activeSlotToSell.packSize || std.packSize;
      const prevTicketBefore = activeSlotToSell.currentTicket !== undefined && activeSlotToSell.currentTicket !== null ? activeSlotToSell.currentTicket : 0;

      if (parsedTicket && parsedTicket.ticketNumber !== null) {
        const tixNum = parsedTicket.ticketNumber;

        // Check if ticket scanned was already sold (e.g. scanning ticket #5 when current position is #11)
        if (tixNum < prevTicketBefore) {
          sfx.alert();
          if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
          if (scanActionTitle) scanActionTitle.textContent = `TICKET #${String(tixNum).padStart(3, '0')} ALREADY SOLD`;
          showToast(`⚠️ Ticket #${String(tixNum).padStart(3, '0')} was already sold! Box #${activeSlotToSell.boxNumber} is currently at #${String(prevTicketBefore).padStart(3, '0')}.`, 'warning');
          return;
        }

        if (tixNum >= prevTicketBefore && tixNum < packSize) {
          activeSlotToSell.currentTicket = tixNum + 1;
        } else {
          activeSlotToSell.currentTicket = prevTicketBefore + 1;
        }
        quickSellTicket(activeSlotToSell, rawBarcode, true, prevTicketBefore);
      } else {
        quickSellTicket(activeSlotToSell, rawBarcode, false, prevTicketBefore);
      }
      return;
    }

    // 2b. Check if scanned barcode matches a sold-out pack (Discrepancy Handling - Video 01:13)
    const soldOutPack = (state.soldOutThisShift || []).find(so => {
      const soNorm = normalizePackNumber(so.packNumber);
      if (!soNorm) return false;
      if (parsedTicket && parsedTicket.packNumber) {
        if (normalizePackNumber(parsedTicket.packNumber) === soNorm) return true;
      }
      if (soNorm.length >= 5 && cleanNum.includes(soNorm)) {
        return true;
      }
      return false;
    });
    if (soldOutPack) {
      sfx.alert();
      voice.speakTicket();
      if (lastScanReadoutContainer) {
        lastScanReadoutContainer.classList.add('alert-yellow');
      }
      if (scanActionTitle) {
        scanActionTitle.textContent = 'This Ticket was sold out in previous shift';
      }
      if (lastScanDisplay) {
        lastScanDisplay.textContent = '';
      }
      pendingSoldOutBarcode = rawBarcode;
      pendingSoldOutPack = soldOutPack;
      if (soldOutGameHeader) {
        soldOutGameHeader.textContent = cleanGameTitle(soldOutPack.gameName || 'Scratch Off Ticket');
      }
      updateSoldOutTicketModal?.showModal();
      return;
    }

    // 3. Duplicate check: Has this barcode already been scanned into inventory? (Video 00:31)
    if (isBarcodeAlreadyScanned(rawBarcode)) {
      const existing = findScannedBarcodeInfo(rawBarcode);
      sfx.alert();
      voice.speakDuplicateError();
      if (existing && existing.boxNumber) {
        bringBoxToVisibleRack(existing.boxNumber);
        state.lastScannedSlot = existing.boxNumber;
        renderDispenserRack();
        renderSlotsRibbon();
      }
      if (lastScanReadoutContainer) {
        lastScanReadoutContainer.classList.add('alert-yellow');
      }
      if (scanActionTitle) {
        scanActionTitle.textContent = 'THIS NUMBER HAS BEEN SCANNED';
      }
      if (lastScanDisplay) {
        const gameTitle = existing?.gameName ? cleanGameTitle(existing.gameName) : 'Game Pack';
        const packPart = existing?.packNumber ? ` #${existing.packNumber}` : '';
        lastScanDisplay.textContent = `${gameTitle}${packPart} · Box #${existing?.boxNumber || '?'}`;
      }
      showToast(`⚠️ THIS NUMBER HAS BEEN SCANNED! Ticket [${rawBarcode}] was already put into Box #${existing?.boxNumber || '?'}.`, 'error');
      
      clearTimeout(scanAlertTimeout);
      scanAlertTimeout = setTimeout(() => {
        if (lastScanReadoutContainer?.classList.contains('alert-yellow') && scanActionTitle?.textContent === 'THIS NUMBER HAS BEEN SCANNED') {
          clearScanAlertBanner();
        }
      }, 6000);
      return;
    }

    // 4. Scan-to-Appear: New ticket scanned (not in an active box yet)!
    // Ask which box to put this ticket into
    pendingNewTicketBarcode = rawBarcode;
    openSetTicketDetailsModal(rawBarcode);
    showToast(`🏷️ New ticket scanned [${rawBarcode}]: Set name and price.`, 'info');
    return;
  }

  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
}


// -------------------------------------------------------------
// Shift History Viewer
// -------------------------------------------------------------

function openHistoryModal(filter = 'all') {
  if (!historyTableBody) return;
  historyTableBody.innerHTML = '';
  
  const now = new Date();
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const isThisWeek = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= oneWeekAgo && d <= now;
  };

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // Setup filter button active states and click handlers
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    const f = btn.getAttribute('data-filter');
    btn.classList.toggle('active', f === filter);
    btn.onclick = () => {
      sfx.keypad();
      openHistoryModal(f);
    };
  });

  let list = state.shiftHistory || [];
  if (filter === 'today') {
    list = list.filter(h => isToday(h.endedAt || h.startedAt));
  } else if (filter === 'week') {
    list = list.filter(h => isThisWeek(h.endedAt || h.startedAt));
  } else if (filter === 'month') {
    list = list.filter(h => isThisMonth(h.endedAt || h.startedAt));
  }

  const historyTotalBadge = document.getElementById('historyTotalBadge');
  if (historyTotalBadge) {
    historyTotalBadge.textContent = `${list.length} Shift${list.length === 1 ? '' : 's'}`;
  }

  if (list.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align:center; padding:28px 14px; color:var(--text-muted); font-style:italic;">No shifts recorded for ${filter === 'today' ? 'today' : filter === 'week' ? 'this week' : filter === 'month' ? 'this month' : 'this period'}.</td>`;
    historyTableBody.appendChild(row);
  } else {
    list.forEach(h => {
      const dateObj = h.endedAt ? new Date(h.endedAt) : (h.startedAt ? new Date(h.startedAt) : null);
      const dateFormatted = dateObj && !isNaN(dateObj.getTime())
        ? `${dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '--';

      const row = document.createElement('tr');
      const actCount = h.activationsCount || 0;
      row.innerHTML = `
        <td>
          <span class="history-shift-badge">
            Shift #${h.shiftNumber}
          </span>
        </td>
        <td class="history-cashier-cell">${h.cashier || 'Clerk'}</td>
        <td class="history-date-cell">${dateFormatted}</td>
        <td class="history-tickets-cell">${(h.totalTicketsSold || 0).toLocaleString()}</td>
        <td class="history-sales-cell">$${Number(h.totalSalesRevenue || 0).toFixed(2)}</td>
        <td class="history-act-cell">
          ${actCount > 0 ? `<span class="history-act-badge">${actCount}</span>` : `<span class="history-act-zero">0</span>`}
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-history-view" title="View detailed report for Shift #${h.shiftNumber}">
            <span>📄</span> Report
          </button>
        </td>
      `;
      row.querySelector('.btn-history-view')?.addEventListener('click', () => {
        openPastShiftReportModal(h);
      });
      historyTableBody.appendChild(row);
    });
  }
  sfx.keypad();
  historyModal.showModal();
}

function openPastShiftReportModal(h) {
  if (!shiftReportModal || !h) return;
  historyModal?.close();
  voice.speakReport();

  repShiftNum.innerHTML = `#${h.shiftNumber} <span class="audit-history-badge">HISTORY</span>`;
  repCashier.textContent = h.cashier || 'Clerk';

  reportBodyRows.innerHTML = '';
  let totalSold = h.totalTicketsSold || 0;
  let totalRevenue = h.totalSalesRevenue || 0;

  if (h.slotsSnapshot && Array.isArray(h.slotsSnapshot)) {
    h.slotsSnapshot.forEach(s => {
      if (s && s.status === 'ACTIVE' && s.packNumber) {
        const soldOutMatch = (h.soldOutSnapshot || []).find(so => so.boxNumber === s.boxNumber);
        const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));

        if (soldOutMatch && (sold === 0 || s.packNumber === soldOutMatch.packNumber)) {
          return;
        }

        const amount = sold * (s.price || 0);

        const row = document.createElement('tr');
        row.className = 'report-row';
        row.innerHTML = `
          <td class="col-box"><span class="report-box-badge">Box ${s.boxNumber}</span></td>
          <td class="col-game" title="${s.gameName || ''}">${cleanGameTitle(s.gameName || 'Scratch Off')}</td>
          <td class="col-price">$${s.price || 0}</td>
          <td class="col-start">${String(s.startTicket || 0).padStart(2, '0')}</td>
          <td class="col-close">${String(s.currentTicket || 0).padStart(2, '0')}</td>
          <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
          <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
        `;
        reportBodyRows.appendChild(row);
      }
    });

    // Also render sold-out packs from history if available
    if (h.soldOutSnapshot && Array.isArray(h.soldOutSnapshot)) {
      h.soldOutSnapshot.forEach(so => {
        const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
        const amount = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
        const row = document.createElement('tr');
        row.className = 'report-row';
        if (so.isReturned) {
          row.innerHTML = `
            <td class="col-box"><span class="report-box-badge">Box ${so.boxNumber}</span></td>
            <td class="col-game" title="${so.gameName || ''}">
              ${cleanGameTitle(so.gameName || 'Scratch Off')}
              <span class="report-status-tag report-tag-returned">RETURNED (${so.ticketsReturned || 0})</span>
            </td>
            <td class="col-price">$${so.price || 0}</td>
            <td class="col-start">${String(so.startTicket || 0).padStart(2, '0')}</td>
            <td class="col-close">${String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(2, '0')}</td>
            <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
            <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
          `;
        } else {
          row.innerHTML = `
            <td class="col-box"><span class="report-box-badge">Box ${so.boxNumber}</span></td>
            <td class="col-game" title="${so.gameName || ''}">
              ${cleanGameTitle(so.gameName || 'Scratch Off')}
              <span class="report-status-tag report-tag-soldout">SOLD OUT</span>
            </td>
            <td class="col-price">$${so.price || 0}</td>
            <td class="col-start">${String(so.startTicket || 0).padStart(2, '0')}</td>
            <td class="col-close">${String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(2, '0')}</td>
            <td class="col-sold ${sold > 0 ? 'has-sales' : 'no-sales'}">${sold}</td>
            <td class="col-amount ${amount > 0 ? 'has-sales' : 'no-sales'}">$${amount.toFixed(2)}</td>
          `;
        }
        reportBodyRows.appendChild(row);
      });
    }
  } else {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align:center; padding:20px; color:#94a3b8; font-style:italic;">
      Historical Shift #${h.shiftNumber} &bull; Total Sold: ${totalSold} tickets &bull; Revenue: $${Number(totalRevenue).toFixed(2)}
    </td>`;
    reportBodyRows.appendChild(row);
  }

  // Show empty state if no rows rendered
  if (reportBodyRows.children.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="7" style="text-align:center; padding:24px 14px; color:#94a3b8; font-style:italic; font-family:inherit; font-size:0.88rem;">
      🎟️ No ticket sales recorded in this shift.
    </td>`;
    reportBodyRows.appendChild(emptyRow);
  }

  repTicketsSold.textContent = totalSold;
  repTotalRevenue.textContent = `$${Number(totalRevenue).toFixed(2)}`;
  repSumSold.textContent = totalSold;
  repSumAmount.textContent = `$${Number(totalRevenue).toFixed(2)}`;

  // Populate cash reconciliation from historical data
  const recLottoSales = document.getElementById('recLottoSales');
  const inputShiftPayouts = document.getElementById('inputShiftPayouts');
  const inputDrawerFloat = document.getElementById('inputDrawerFloat');
  const recExpectedCash = document.getElementById('recExpectedCash');
  const recPayoutNote = document.getElementById('recPayoutNote');
  const inputActualCash = document.getElementById('inputActualCashCounted');
  const repDrawerBalance = document.getElementById('repDrawerBalance');

  const histPayouts = Number(h.cashes || 0);
  const histFloat = Number(h.drawerFloat || 0);
  const netCash = totalRevenue - histPayouts;
  const expectedCash = histFloat + netCash;

  if (recLottoSales) recLottoSales.textContent = `$${totalRevenue.toFixed(2)}`;
  if (inputShiftPayouts) inputShiftPayouts.value = histPayouts.toFixed(2);
  if (inputDrawerFloat) inputDrawerFloat.value = histFloat.toFixed(2);
  if (recExpectedCash) {
    recExpectedCash.textContent = expectedCash < 0 ? `-$${Math.abs(expectedCash).toFixed(2)}` : `$${expectedCash.toFixed(2)}`;
    recExpectedCash.style.color = expectedCash < 0 ? '#ef4444' : 'var(--text-primary)';
  }
  if (recPayoutNote) {
    recPayoutNote.style.display = (histPayouts > totalRevenue && histFloat === 0) ? 'block' : 'none';
  }
  if (inputActualCash) inputActualCash.value = '';
  if (repDrawerBalance) {
    repDrawerBalance.textContent = 'Enter Counted Cash';
    repDrawerBalance.className = 'drawer-balance-pill status-pending';
  }

  // Populate print slip
  const dateObj = h.endedAt ? new Date(h.endedAt) : (h.startedAt ? new Date(h.startedAt) : new Date());
  const prDateEl = document.getElementById('prDate');
  if (prDateEl) prDateEl.textContent = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const prTimeEl = document.getElementById('prTime');
  if (prTimeEl) prTimeEl.textContent = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const prShiftEl = document.getElementById('prShift');
  if (prShiftEl) prShiftEl.textContent = `#${h.shiftNumber} (${h.cashier || 'Clerk'}) [AUDIT]`;
  const prTotalSalesEl = document.getElementById('prTotalSales');
  if (prTotalSalesEl) prTotalSalesEl.textContent = `$${Number(totalRevenue).toFixed(2)}`;
  const prTotalTicketsEl = document.getElementById('prTotalTickets');
  if (prTotalTicketsEl) prTotalTicketsEl.textContent = totalSold;

  sfx.chime();
  shiftReportModal.showModal();
  showToast(`Viewing Audit Report for Shift #${h.shiftNumber}`, 'info');
}

// -------------------------------------------------------------
// Toast Messages
// -------------------------------------------------------------

function showToast(message, type = 'info') {
  // If an active modal dialog is open, show toast inside the dialog
  // so the browser's top-layer backdrop never obscures it in the background!
  const openModal = document.querySelector('dialog[open]');
  let container = toastContainer;

  if (openModal) {
    let modalToastContainer = openModal.querySelector('.modal-toast-container');
    if (!modalToastContainer) {
      modalToastContainer = document.createElement('div');
      modalToastContainer.className = 'modal-toast-container';
      openModal.appendChild(modalToastContainer);
    }
    container = modalToastContainer;
  }

  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : (type === 'error' ? '⚠' : 'ℹ')}</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// -------------------------------------------------------------
// System Refresh & State Synchronization
// -------------------------------------------------------------

export function refreshSystem() {
  const badgeBox = document.getElementById('shiftBadgeBox');
  const refreshBtn = document.getElementById('systemRefreshBtn');
  if (badgeBox) badgeBox.classList.add('refreshing');
  if (refreshBtn) refreshBtn.classList.add('refreshing');
  setTimeout(() => {
    badgeBox?.classList.remove('refreshing');
    refreshBtn?.classList.remove('refreshing');
  }, 780);

  sfx.chime();

  // Clear any active alert banners (e.g. "This Ticket was sold out in previous shift" or duplicate warnings)
  clearScanAlertBanner();

  // 1. Reload the latest persisted state
  state = loadState();

  // 2. Sanitize and migrate slots and pack numbers
  sanitizeStatePacks(state);
  sanitizeAndMigrateSlots();

  // 3. Re-render all views and metrics
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  // 4. Focus scanner input for immediate use
  barcodeInput?.focus();

  // 5. User feedback
  showToast(`🔄 System Refreshed! Shift #${state.shiftNumber} metrics, dispenser boxes, and state synchronized.`, 'success');
}

// -------------------------------------------------------------
// Event Listeners Wire-up
// -------------------------------------------------------------

function setupEventListeners() {
  mainShiftActionBtn.addEventListener('click', handleMainShiftAction);

  cancelActionBtn.addEventListener('click', () => {
    clearScanAlertBanner();
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

  const btnAddDispenserBoxBtn = document.getElementById('btnAddDispenserBoxBtn');
  if (btnAddDispenserBoxBtn) {
    btnAddDispenserBoxBtn.addEventListener('click', () => {
      openActivationForBox(findFirstEmptyBox());
    });
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
      h.totalTicketsSold || 0,
      Number(h.totalSalesRevenue || 0).toFixed(2),
      h.activationsCount || 0
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
      openTerminalReconcileModal(() => {
        openDayReportModal(() => state, sfx);
      });
    });
  }
  reportEmailBtn.addEventListener('click', () => {
    sfx.success();
    showToast(`✓ Shift Report emailed to: ${state.settings.targetEmails}`, 'success');
  });
  reportNewShiftBtn.addEventListener('click', startNewShift);

  // Inventory Modal buttons
  tabUpdateInventory?.addEventListener('click', () => {
    sfx.keypad();
    openInventoryModal('intake');
  });
  document.getElementById('tabInventoryStatus')?.addEventListener('click', () => {
    sfx.keypad();
    openInventoryModal('status');
  });
  closeInventoryBtn?.addEventListener('click', () => inventoryModal.close());
  inventoryDoneBtn?.addEventListener('click', () => inventoryModal.close());
  setupInventoryModalLogic();

  // Summary Metric Tabs Click Handlers
  document.getElementById('tabSettlement')?.addEventListener('click', () => {
    sfx.keypad();
    if (state.shiftStatus === 'SHIFT_ENDED') {
      openDayReportModal(() => state, sfx);
    } else {
      openShiftReportModal();
    }
  });

  document.getElementById('tabToday')?.addEventListener('click', () => {
    sfx.keypad();
    openHistoryModal('today');
    showToast(`📅 Today's Sales: ${metricToday?.textContent || 0} tickets sold`, 'info');
  });

  document.getElementById('tabThisWeek')?.addEventListener('click', () => {
    sfx.keypad();
    openHistoryModal('week');
    showToast(`📅 This Week's Sales: ${metricThisWeek?.textContent || 0} tickets sold`, 'info');
  });

  document.getElementById('tabThisMonth')?.addEventListener('click', () => {
    sfx.keypad();
    openHistoryModal('month');
    showToast(`📅 This Month's Sales: ${metricThisMonth?.textContent || 0} tickets sold`, 'info');
  });

  document.getElementById('tabInactive')?.addEventListener('click', () => {
    sfx.keypad();
    const firstEmpty = document.querySelector('.ribbon-cell.empty-slot');
    if (firstEmpty) {
      firstEmpty.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      firstEmpty.classList.add('pulse-highlight');
      setTimeout(() => firstEmpty.classList.remove('pulse-highlight'), 1800);
      showToast(`📦 ${metricInactive?.textContent || 0} Inactive / Empty dispenser slots in rack. Scan a pack barcode to activate a ticket.`, 'info');
    } else {
      showToast('All dispenser boxes are currently active!', 'success');
    }
  });


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

  document.getElementById('shiftBadgeText')?.addEventListener('click', openCashierModal);
  document.getElementById('currentCashier')?.addEventListener('click', openCashierModal);
  document.getElementById('systemRefreshBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshSystem();
  });
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
    const cashierInput = document.getElementById('inputNewShiftCashierName');
    const name = cashierInput?.value?.trim() || state.cashierName || 'master';
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
  // Box Adjust Modal
  setupBoxAdjustModal();

  // Set Box & Saved Barcodes Modals
  setupSetBoxModalLogic();

  // LTSYSTEM Modals (Fix Position, Terminal Reconcile, Gatekeeper, Sold Out, Switch & Change Box)
  setupFixTicketPositionKeypad();
  setupTerminalReconcileLogic();
  setupDiscrepancyAndInventoryGatekeeperModals();
  setupSwitchAndChangeBoxModals();

  const menuClearDataBtn = document.getElementById('menuClearDataBtn');
  if (menuClearDataBtn) {
    menuClearDataBtn.addEventListener('click', () => {
      if (confirm('Erase all POS lottery data and reset to a fresh blank start?')) {
        state = resetToCleanState();
        state.dataCleared = true;
        saveState(state);
        // Clear Day Report print DOM and preview container immediately so no stale data remains
        const printSection = document.getElementById('dayReportPrintSection');
        if (printSection) {
          const freshData = getDayReportData(state);
          populateDayReportDOM(freshData, printSection);
        }
        const previewContainer = document.getElementById('dayReportPreviewContainer');
        if (previewContainer) {
          previewContainer.innerHTML = '';
        }
        initPOS();
        sfx.alert();
        showToast('All POS data wiped. Clean start ready.', 'info');
      }
    });
  }

  // Official 2-Page Day Report (AMIGO FOOD MART)
  setupDayReportHandlers(() => state, sfx, showToast, handleUndoAction, promptStartNewShift);
}

// Launch application
initPOS();
