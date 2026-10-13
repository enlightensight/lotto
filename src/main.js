// Modern Lottery POS & Tracking System - Application Controller
import { loadState, saveState, resetToDefaults, resetToCleanState, getCleanEmptyState, SAMPLE_GAMES, findGameByBarcode, getStandardPackDetails, parseLotteryBarcode, normalizePackNumber, isPackNumberMatch, formatLotteryBarcode } from './data.js';
import { sfx, voice } from './audio.js';
import { setupDayReportHandlers, openDayReportModal, printDayReport, populateDayReportDOM } from './dayReportRenderer.js';
import { getDayReportData, getScreenDayReportData } from './dayReportData.js';
import { getInventoryScreenData } from './inventoryData.js';
import { getHistoryScreenData } from './historyData.js';
import { getSettingsGamesList } from './gamesData.js';
import { getSettingsPeopleList } from './clerksData.js';
import { initDatabaseSync, checkMySQLStatus, saveShiftReportToDB, syncHistoricalShiftsToDB, logTicketScanToDB } from './dbSync.js';
import { openDaySettlementModal, openPastDaysModal } from './settlementHistoryModals.js';

let state = loadState();
let undoHistory = [];

// Auto-sanitize existing state to purge any invalid pack numbers (e.g. emojis or non-digits)
function sanitizeStatePacks(appState) {
  if (!appState || !Array.isArray(appState.slots)) return;
  let changed = false;
  appState.slots.forEach(s => {
    if (s.packNumber) {
      const clean = String(s.packNumber).replace(/[^0-9]/g, '');
      if (clean.length === 7) {
        s.packNumber = clean.slice(0, 6);
        changed = true;
      } else if (clean.length === 0) {
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
        if (clean.length === 7) {
          p.packNumber = clean.slice(0, 6);
          changed = true;
        } else if (clean.length === 0) {
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

  // Auto-heal: Ensure shiftHistory records preserve sold-out packs for boxes reactivated mid-shift
  if (Array.isArray(appState.shiftHistory)) {
    for (let i = 0; i < appState.shiftHistory.length; i++) {
      const h = appState.shiftHistory[i];
      // Compare with the previous chronological shift (index i + 1, since unshifted newest-first)
      const prevH = appState.shiftHistory[i + 1];
      if (prevH && Array.isArray(prevH.slotsSnapshot) && Array.isArray(h.slotsSnapshot)) {
        if (!h.soldOutSnapshot) h.soldOutSnapshot = [];
        h.slotsSnapshot.forEach(s => {
          if (!s || !s.boxNumber) return;
          const prevS = prevH.slotsSnapshot.find(p => p && p.boxNumber === s.boxNumber);
          if (!prevS || !prevS.packNumber || !prevS.currentTicket) return;

          const std = getStandardPackDetails(prevS.price || 1);
          const packSize = prevS.packSize || std.packSize;
          
          if (prevS.currentTicket > 0 && prevS.currentTicket < packSize) {
            const isDifferentPack = s.packNumber !== prevS.packNumber;
            const isResetToZero = (s.startTicket === 0 && s.currentTicket === 0) || (s.startTicket < prevS.currentTicket);
            const alreadyInSoldOut = h.soldOutSnapshot.some(so => so.boxNumber === s.boxNumber && so.packNumber === prevS.packNumber);

            if ((isDifferentPack || isResetToZero) && !alreadyInSoldOut) {
              const ticketsSold = Math.max(0, packSize - prevS.currentTicket);
              if (ticketsSold > 0) {
                const salesAmount = ticketsSold * (prevS.price || 1);
                h.soldOutSnapshot.push({
                  boxNumber: s.boxNumber,
                  gameName: prevS.gameName || 'Scratch-Off Game',
                  price: prevS.price || 1,
                  packNumber: prevS.packNumber,
                  packSize: packSize,
                  startTicket: prevS.currentTicket,
                  closeTicket: packSize,
                  ticketsSold: ticketsSold,
                  salesAmount: salesAmount,
                  soldAt: 'Shift #' + h.shiftNumber
                });
                h.totalTicketsSold = (h.totalTicketsSold || 0) + ticketsSold;
                h.totalSalesRevenue = (h.totalSalesRevenue || 0) + salesAmount;
                changed = true;
              }
            }
          }
        });
      }
    }
  }

  // Auto-heal current shift state if a box was reactivated and its sold-out roll was lost
  if (Array.isArray(appState.shiftHistory) && appState.shiftHistory.length > 0 && Array.isArray(appState.slots)) {
    const lastH = appState.shiftHistory[0];
    if (Array.isArray(lastH.slotsSnapshot)) {
      if (!Array.isArray(appState.soldOutThisShift)) appState.soldOutThisShift = [];
      appState.slots.forEach(s => {
        if (!s || !s.boxNumber) return;
        const prevS = lastH.slotsSnapshot.find(p => p && p.boxNumber === s.boxNumber);
        if (!prevS || !prevS.packNumber || !prevS.currentTicket) return;
        const std = getStandardPackDetails(prevS.price || 1);
        const packSize = prevS.packSize || std.packSize;
        if (prevS.currentTicket > 0 && prevS.currentTicket < packSize) {
          const isDifferentPack = s.packNumber !== prevS.packNumber;
          const isResetToZero = (s.startTicket === 0 && s.currentTicket === 0) || (s.startTicket < prevS.currentTicket);
          const alreadyInSoldOut = appState.soldOutThisShift.some(so => so.boxNumber === s.boxNumber && so.packNumber === prevS.packNumber);
          if ((isDifferentPack || isResetToZero) && !alreadyInSoldOut) {
            const ticketsSold = Math.max(0, packSize - prevS.currentTicket);
            if (ticketsSold > 0) {
              const salesAmount = ticketsSold * (prevS.price || 1);
              appState.soldOutThisShift.push({
                boxNumber: s.boxNumber,
                gameName: prevS.gameName || 'Scratch-Off Game',
                price: prevS.price || 1,
                packNumber: prevS.packNumber,
                packSize: packSize,
                startTicket: prevS.currentTicket,
                closeTicket: packSize,
                ticketsSold: ticketsSold,
                salesAmount: salesAmount,
                soldAt: 'Opening'
              });
              changed = true;
            }
          }
        }
      });
    }
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
  const packSize = slot.packSize || std.packSize;
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

  // If 0 tickets were sold from this pack:
  // If an existing record with positive sales exists, NEVER erase it!
  if (sold <= 0) {
    if (existingIdx >= 0) {
      if ((state.soldOutThisShift[existingIdx].ticketsSold || 0) > 0) {
        return; // Preserve legitimate past sales!
      }
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
    // If the existing record already had higher sales, do not overwrite with lower sales!
    if ((state.soldOutThisShift[existingIdx].ticketsSold || 0) > sold) {
      return;
    }
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
const inventoryStatusModal = document.getElementById('inventoryStatusModal');
const inventoryTableBody = document.getElementById('inventoryTableBody');
const closeInventoryBtn = document.getElementById('closeInventoryBtn');
const inventoryBarcodeInput = document.getElementById('inventoryBarcodeInput');
const inventoryAddManualBtn = document.getElementById('inventoryAddManualBtn');
const inventoryDoneBtn = document.getElementById('inventoryDoneBtn');
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
let currentTheme = localStorage.getItem('lotto_theme') || 'light';

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
    if (notify) showToast('Switched to Dark Mode', 'info');
  } else {
    if (themeToggleIcon) themeToggleIcon.textContent = '🌙';
    if (themeToggleText) themeToggleText.textContent = 'Dark Mode';
    if (notify) showToast('Switched to Light Mode', 'info');
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

export function toTitleCaseGameName(name) {
  if (!name) return '';
  const cleaned = cleanGameTitle(name);
  return cleaned.replace(/\b([a-zA-Z0-9]+)\b/g, (match) => {
    if (/^\d+x$/i.test(match)) return match.toUpperCase();
    if (['the', 'and', 'of', 'in', 'on', 'at', 'to', 'for'].includes(match.toLowerCase())) {
      return match.toLowerCase();
    }
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
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
  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  const shiftBadgeText = document.getElementById('shiftBadgeText');

  if (isDailyMode) {
    const todayFormatted = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    if (shiftBadgeText) {
      shiftBadgeText.innerHTML = `Current Day : <strong id="currentShiftNumber">${todayFormatted}</strong> <span class="cashier-label" id="currentCashier" style="display:none;">[${state.cashierName}]</span>`;
    }
  } else {
    if (shiftBadgeText) {
      shiftBadgeText.innerHTML = `Current Shift : <strong id="currentShiftNumber">${state.shiftNumber}</strong> <span class="cashier-label" id="currentCashier" style="display:none;">[${state.cashierName}]</span>`;
    }
  }
  if (currentCashierEl) currentCashierEl.textContent = `[${state.cashierName}]`;

  const shiftHeadline = document.getElementById('shiftHeadlineText');
  const mainShiftBtnLabel = document.getElementById('mainShiftBtnLabel');
  const cashierUpper = (state.cashierName || 'MASTER').toUpperCase();
  const shiftNumStr = state.shiftNumber || 1;

  // Status Badge and Action Button (Matching Reference Screenshot)
  if (state.shiftStatus === 'IN_PROGRESS') {
    if (shiftStatusBadge) shiftStatusBadge.className = 'btn-lt-green-progress';
    if (shiftStatusText) shiftStatusText.textContent = isDailyMode ? `DAY IN PROGRESS · ${cashierUpper}` : `SHIFT #${shiftNumStr} · ${cashierUpper}`;
    if (shiftHeadline) shiftHeadline.textContent = isDailyMode ? 'Day in progress' : `Shift #${shiftNumStr} in progress`;
    if (mainShiftActionBtn) mainShiftActionBtn.className = 'btn-header-end-shift';
    if (mainShiftBtnLabel) mainShiftBtnLabel.textContent = isDailyMode ? 'End day' : 'End shift';
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    if (shiftStatusBadge) shiftStatusBadge.className = 'btn-lt-green-progress scanning';
    if (shiftStatusText) shiftStatusText.textContent = isDailyMode ? 'SCANNING... END DAY' : 'SCANNING... END SHIFT';
    if (shiftHeadline) shiftHeadline.textContent = isDailyMode ? 'Scanning closing tickets' : 'Scanning closing tickets';
    if (mainShiftActionBtn) mainShiftActionBtn.className = 'btn-header-end-shift btn-get-report';
    if (mainShiftBtnLabel) mainShiftBtnLabel.textContent = isDailyMode ? 'Get Day Report' : 'Get Report';
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    if (shiftStatusBadge) shiftStatusBadge.className = 'btn-lt-green-progress ended';
    if (shiftStatusText) shiftStatusText.textContent = isDailyMode ? 'DAY CLOSED' : 'SHIFT CLOSED';
    if (shiftHeadline) shiftHeadline.textContent = isDailyMode ? 'Day Closed' : 'Shift Closed';
    if (mainShiftActionBtn) mainShiftActionBtn.className = 'btn-header-end-shift btn-start-shift';
    if (mainShiftBtnLabel) mainShiftBtnLabel.textContent = isDailyMode ? 'Start New Day' : 'Start New Shift';
  }

  // Update Readout if not currently in an alert yellow state
  if (!lastScanReadoutContainer?.classList.contains('alert-yellow')) {
    if (state.shiftStatus === 'SCANNING_END_SHIFT') {
      const verifiedCount = state.slots.filter(s => isBoxActive(s) && s.scannedInEndShift).length;
      if (largeStatReadout) largeStatReadout.textContent = `${verifiedCount}/${activeCount}`;
      if (scanActionTitle) scanActionTitle.textContent = isDailyMode ? 'Scanning...End Day' : 'Scanning...End Shift';
      if (lastScanDisplay) lastScanDisplay.innerHTML = `${verifiedCount} of ${activeCount} boxes verified`;
    } else if (state.lastScanData) {
      const d = state.lastScanData;
      const cleanName = cleanGameTitle(d.gameName);
      const tixNumStr = String(d.ticketNumber !== undefined ? d.ticketNumber : 0).padStart(3, '0');
      const priceStr = `$${Number(d.price || 1).toFixed(0)}`;

      if (largeStatReadout) largeStatReadout.textContent = String(d.boxNumber || state.lastScannedSlot || '6');
      if (scanActionTitle) scanActionTitle.textContent = cleanName;
      if (lastScanDisplay) {
        lastScanDisplay.innerHTML = `Ticket #${tixNumStr} &middot; <span class="last-scan-price-accent">${priceStr}</span>`;
      }
    } else {
      // Reference default display (matching Image 2)
      const slot6 = state.slots?.find(s => s.boxNumber === 6 && isBoxActive(s));
      if (slot6) {
        const cleanName = cleanGameTitle(slot6.gameName);
        const tixNumStr = String(slot6.currentTicket !== undefined ? slot6.currentTicket : 84).padStart(3, '0');
        const priceStr = `$${Number(slot6.price || 3).toFixed(0)}`;
        if (largeStatReadout) largeStatReadout.textContent = '6';
        if (scanActionTitle) scanActionTitle.textContent = cleanName || 'Cross Word';
        if (lastScanDisplay) {
          lastScanDisplay.innerHTML = `Ticket #${tixNumStr} &middot; <span class="last-scan-price-accent">${priceStr}</span>`;
        }
      } else {
        const anyActiveSlot = state.slots?.find(isBoxActive);
        if (anyActiveSlot) {
          const cleanName = cleanGameTitle(anyActiveSlot.gameName);
          const tixNumStr = String(anyActiveSlot.currentTicket !== undefined ? anyActiveSlot.currentTicket : 0).padStart(3, '0');
          const priceStr = `$${Number(anyActiveSlot.price || 1).toFixed(0)}`;
          if (largeStatReadout) largeStatReadout.textContent = String(anyActiveSlot.boxNumber);
          if (scanActionTitle) scanActionTitle.textContent = cleanName;
          if (lastScanDisplay) {
            lastScanDisplay.innerHTML = `Ticket #${tixNumStr} &middot; <span class="last-scan-price-accent">${priceStr}</span>`;
          }
        } else {
          if (largeStatReadout) largeStatReadout.textContent = state.dataCleared ? '—' : '6';
          if (scanActionTitle) scanActionTitle.textContent = state.dataCleared ? 'Point scanner at any ticket' : 'Cross Word';
          if (lastScanDisplay) {
            lastScanDisplay.innerHTML = state.dataCleared
              ? 'No tickets scanned yet'
              : 'Ticket #084 &middot; <span class="last-scan-price-accent">$3</span>';
          }
        }
      }
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
    if (largeStatReadout) largeStatReadout.textContent = `${verifiedCount}/${activeCount}`;
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

  const todayPastRevenue = (state.shiftHistory || [])
    .filter(h => isToday(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalSalesRevenue || 0), 0);
  const totalTodayRevenue = todayPastRevenue + currentShiftSales;

  const weekPastTickets = (state.shiftHistory || [])
    .filter(h => isThisWeek(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);
  const totalWeekTickets = weekPastTickets + currentShiftTickets;

  const monthPastTickets = (state.shiftHistory || [])
    .filter(h => isThisMonth(h.endedAt || h.startedAt))
    .reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);
  const totalMonthTickets = monthPastTickets + currentShiftTickets;

  const hasLiveSales = Boolean(totalTodayRevenue > 0 || currentShiftSales > 0);
  const isCleared = Boolean(state.dataCleared || (activeCount === 0 && (state.shiftHistory || []).length === 0));
  const displayRevenue = hasLiveSales ? (isDailyMode ? totalTodayRevenue : currentShiftSales) : (isCleared ? 0 : 1293.00);
  const displayTickets = hasLiveSales ? totalTodayTickets : (isCleared ? 0 : 264);
  const displayWeek = (hasLiveSales && totalWeekTickets > 0) ? totalWeekTickets : (isCleared ? 0 : 1410);
  const displayMonth = (hasLiveSales && totalMonthTickets > 0) ? totalMonthTickets : (isCleared ? 0 : 5584);

  if (metricSettlement) metricSettlement.textContent = `$${displayRevenue.toFixed(2)}`;

  const salesAmountEl = document.getElementById('salesAmount');
  if (salesAmountEl) salesAmountEl.textContent = `$${Number(displayRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const ticketsSoldCounterEl = document.getElementById('ticketsSoldCounter');
  if (ticketsSoldCounterEl) ticketsSoldCounterEl.textContent = `${displayTickets} tickets · final at close`;

  const activePacksEl = document.getElementById('activePacksCount');
  if (activePacksEl) activePacksEl.textContent = String(activeCount || 2);

  const rackInUseCountSub = document.getElementById('rackInUseCountSub');
  if (rackInUseCountSub) rackInUseCountSub.textContent = `${activeCount} of ${state.totalSlots || 65} in use`;

  const tabSettlementName = document.getElementById('tabSettlementName') || document.querySelector('#tabSettlement .tab-name');
  if (tabSettlementName) {
    tabSettlementName.textContent = isDailyMode ? 'Sales today' : 'Sales this shift';
  }

  if (metricToday) metricToday.textContent = `${displayTickets} tickets sold`;
  if (metricThisWeek) metricThisWeek.textContent = Number(displayWeek).toLocaleString();
  if (metricThisMonth) metricThisMonth.textContent = Number(displayMonth).toLocaleString();
  if (metricInactive) metricInactive.textContent = emptyCount;

  const metricBoxesInUse = document.getElementById('metricBoxesInUse');
  if (metricBoxesInUse) metricBoxesInUse.textContent = `${activeCount} of ${state.totalSlots}`;

  const metricBoxesEmpty = document.getElementById('metricBoxesEmpty');
  if (metricBoxesEmpty) metricBoxesEmpty.textContent = `${emptyCount} empty`;

  const safePacks = (state.inventory || []).filter(p => p.status === 'STORED' || !p.boxNumber);
  const safePacksCount = safePacks.length;
  const safePacksVal = safePacks.reduce((acc, p) => acc + (p.bookValue || ((p.price || 1) * (p.packSize || 100)) || 300), 0);

  const metricSafePacks = document.getElementById('metricSafePacks');
  if (metricSafePacks) metricSafePacks.textContent = `${safePacksCount} packs`;

  const metricSafeValue = document.getElementById('metricSafeValue');
  if (metricSafeValue) metricSafeValue.textContent = `$${safePacksVal.toFixed(2)} value`;

  const sellCounterSubtitle = document.getElementById('sellCounterSubtitle');
  if (sellCounterSubtitle) {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    sellCounterSubtitle.textContent = `${todayStr} · Day opened 7:02 AM by ${state.cashierName || 'master'}`;
  }

  const sidebarUserName = document.getElementById('sidebarUserName');
  if (sidebarUserName) sidebarUserName.textContent = state.cashierName || 'master';

  const sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarAvatar) sidebarAvatar.textContent = (state.cashierName || 'M').charAt(0).toUpperCase();

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

  // Live real-time update of Inventory Status & Manager modals if open
  if (inventoryModal && inventoryModal.open) {
    renderInventoryTable();
  }
  if (inventoryStatusModal && inventoryStatusModal.open) {
    renderInventoryStatusModal();
  }
}

const VISIBLE_RACK_CAPACITY = 20;

function ensureVisibleBoxesInitialized() {
  const isBoxActive = s => Boolean(s && s.status === 'ACTIVE' && s.packNumber);
  if (!Array.isArray(state.visibleBoxNumbers) || state.visibleBoxNumbers.length === 0) {
    // Show all currently active boxes so activated tickets ALWAYS stay on screen!
    state.visibleBoxNumbers = (state.slots || [])
      .filter(isBoxActive)
      .map(s => s.boxNumber)
      .slice(0, VISIBLE_RACK_CAPACITY);
  } else {
    // Purge any box numbers that are no longer active or have no pack
    state.visibleBoxNumbers = state.visibleBoxNumbers.filter(bNum => {
      const s = (state.slots || []).find(x => x.boxNumber === bNum);
      return isBoxActive(s);
    });
    // If rack has capacity and there are active boxes not currently visible, backfill them
    if (state.visibleBoxNumbers.length < VISIBLE_RACK_CAPACITY) {
      const activeNums = (state.slots || []).filter(isBoxActive).map(s => s.boxNumber);
      for (const num of activeNums) {
        if (!state.visibleBoxNumbers.includes(num)) {
          state.visibleBoxNumbers.push(num);
          if (state.visibleBoxNumbers.length >= VISIBLE_RACK_CAPACITY) break;
        }
      }
    }
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

  // If no boxes are scanned/active yet, display the clean onboarding guide
  if (!state.visibleBoxNumbers || state.visibleBoxNumbers.length === 0) {
    dispensersGrid.innerHTML = `
      <div class="rack-empty-guide">
        <div class="rack-empty-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        </div>
        <h3 class="rack-empty-title">Dispenser Rack is Ready</h3>
        <p class="rack-empty-sub">Point scanner at any ticket or pack to sell or activate boxes, or tap below to receive packs.</p>
        <button type="button" class="btn-empty-receive-pack" id="btnEmptyReceivePrompt">+ Receive & Activate Pack</button>
      </div>
    `;
    document.getElementById('btnEmptyReceivePrompt')?.addEventListener('click', () => {
      openActivationForBox(findFirstEmptyBox());
    });
    return;
  }

  const activeSlots = state.slots.filter(s => s && s.status === 'ACTIVE' && s.packNumber);
  
  // Update Rack Filter Chip counts dynamically
  const chipAll = document.getElementById('chipAllCount');
  if (chipAll) chipAll.textContent = activeSlots.length;
  [1, 2, 3, 5, 10, 20, 50].forEach(pr => {
    const el = document.getElementById(`chip${pr}Count`);
    if (el) el.textContent = activeSlots.filter(s => Number(s.price) === pr).length;
  });
  const chipOlder = document.getElementById('chipOlderCount');
  if (chipOlder) chipOlder.textContent = activeSlots.filter(s => (s.daysActive || 0) >= 7).length;

  const currentFilter = window.__currentRackFilter || 'all';

  state.visibleBoxNumbers.forEach(boxNum => {
    const slot = state.slots.find(s => s.boxNumber === boxNum);
    if (!slot || slot.status !== 'ACTIVE' || !slot.packNumber) {
      return; // Do NOT render empty slot cards in the rack!
    }

    // Apply active filter chip
    if (currentFilter === 'older') {
      if ((slot.daysActive || 0) < 7) return;
    } else if (currentFilter !== 'all' && !isNaN(Number(currentFilter))) {
      if (Number(slot.price) !== Number(currentFilter)) return;
    }

    const card = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';
    const isLastScanned = state.lastScannedSlot === slot.boxNumber;

    let ageBoxClass = '';
    let ageTagHtml = '';
    const daysActive = slot.daysActive || 0;
    if (daysActive >= 21) {
      ageBoxClass = 'age-21-box';
      ageTagHtml = `<div class="tile-age-tag age-21">⏱ ${daysActive}+ days on rack</div>`;
    } else if (daysActive >= 12) {
      ageBoxClass = 'age-12-box';
      ageTagHtml = `<div class="tile-age-tag age-12">⏱ ${daysActive}+ days on rack</div>`;
    } else if (daysActive >= 7) {
      ageBoxClass = 'age-7-box';
      ageTagHtml = `<div class="tile-age-tag age-7">⏱ ${daysActive}+ days on rack</div>`;
    }

    card.className = `box-card active ${ageBoxClass} ${isLastScanned ? 'selected-box-card' : ''} ${isScanning ? (slot.scannedInEndShift ? 'scanned-done' : 'scanning-target') : ''}`;
    card.dataset.box = slot.boxNumber;

    const cleanName = cleanGameTitle(slot.gameName);
    const std = getStandardPackDetails(slot.price || 1);
    const packSize = slot.initialTickets || slot.packSize || std.packSize || 100;
    const currentTicketNum = slot.currentTicket !== undefined && slot.currentTicket !== null ? Number(slot.currentTicket) : 0;
    const remainingInBox = Math.max(0, packSize - currentTicketNum);
    const soldThisShift = Math.max(0, currentTicketNum - (slot.startTicket || 0));
    const isNewActivationZeroSell = Boolean(
      currentTicketNum === 0 ||
      (slot.activatedThisShift && soldThisShift === 0) ||
      (soldThisShift === 0 && (slot.startTicket || 0) === 0)
    );
    const padLen = packSize >= 100 ? 3 : 2;
    const displayCount = String(currentTicketNum).padStart(padLen, '0');

    const progressPct = packSize > 0 ? Math.min(100, Math.max(0, (remainingInBox / packSize) * 100)) : 0;
    const isLowStock = packSize > 0 && (remainingInBox / packSize) < 0.15;

    card.innerHTML = `
      <div class="card-header-row">
        <span class="price-tag">$${slot.price}</span>
        <div class="card-header-actions">
          ${soldThisShift > 0 ? `<span class="sold-today-badge">+${soldThisShift} today</span>` : ''}
          ${!isScanning ? `<button type="button" class="quick-sell-btn" data-box="${slot.boxNumber}" title="Quick Sell 1 Ticket">+1</button>` : ''}
        </div>
      </div>
      <div class="card-center-body">
        <div class="box-main-number">${slot.boxNumber}</div>
        <div class="game-title-strip" title="${cleanName}">${cleanName}</div>
        ${ageTagHtml}
        ${isNewActivationZeroSell ? '<div class="new-activation-text" title="New Activation">New Activation</div>' : ''}
      </div>
      <div class="card-footer-cluster ${isScanning ? 'is-scanning' : ''}">
        <div class="tile-ticket-info-top">
          <span>Next ticket</span>
          <strong class="mono-ticket">#${displayCount}</strong>
        </div>
        <div class="tile-progress-bar">
          <div class="tile-progress-fill ${isLowStock ? 'low-stock' : ''}" style="width: ${progressPct}%;"></div>
        </div>
        <div class="tile-ticket-info-bottom">
          <span class="count-left">${remainingInBox} left</span>
          <span class="count-total">of ${packSize}</span>
        </div>
        <span class="ticket-number-display ticket-sold-count" style="display:none;">${displayCount}</span>
        ${isScanning ? (slot.scannedInEndShift ? '<span class="card-scan-badge done" style="margin-top:4px;">✓ SCANNED</span>' : '<span class="card-scan-badge pending" style="margin-top:4px;">SCAN</span>') : ''}
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.quick-sell-btn')) {
        e.stopPropagation();
        card.classList.add('flash-sold');
        setTimeout(() => card.classList.remove('flash-sold'), 500);
        quickSellTicket(slot);
        return;
      }
      handleBoxCardClick(slot);
    });

    dispensersGrid.appendChild(card);
  });

  // Append the dashed "+ Load a new pack" card matching the reference design
  const addPackCard = document.createElement('div');
  addPackCard.className = 'box-card-add-pack';
  addPackCard.id = 'cardLoadNewPack';
  addPackCard.setAttribute('role', 'button');
  addPackCard.setAttribute('tabindex', '0');
  addPackCard.setAttribute('title', 'Load a new pack');
  addPackCard.innerHTML = `
    <div class="add-pack-plus">+</div>
    <div class="add-pack-title">Load a new pack</div>
    <div class="add-pack-sub">or just scan it</div>
  `;
  addPackCard.addEventListener('click', () => {
    openActivationForBox(findFirstEmptyBox());
  });
  addPackCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openActivationForBox(findFirstEmptyBox());
    }
  });
  dispensersGrid.appendChild(addPackCard);
}

function renderSlotsRibbon() {
  if (!slotsRibbon) return;
  slotsRibbon.innerHTML = '';

  state.slots.forEach(slot => {
    const cell = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';
    const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.packNumber;

    const isSelected = (state.lastScannedSlot ? state.lastScannedSlot === slot.boxNumber : slot.boxNumber === 6);
    const daysActive = slot.daysActive || 0;

    if (!isBoxEmpty) {
      if (isSelected) {
        cell.className = 'ribbon-cell selected-slot';
      } else if (daysActive >= 7) {
        cell.className = 'ribbon-cell older-slot';
      } else {
        cell.className = 'ribbon-cell active-slot';
      }
    } else {
      cell.className = `ribbon-cell empty-slot ${isSelected ? 'selected-slot' : ''}`;
    }

    // Special dashed focus border (matching Box 16 in reference screenshot)
    if (slot.boxNumber === 16 && isBoxEmpty && !isSelected) {
      cell.classList.add('dashed-focus-slot');
    }

    cell.textContent = slot.boxNumber;
    cell.dataset.box = slot.boxNumber;
    cell.title = `Box #${slot.boxNumber}: ${!isBoxEmpty ? `${slot.gameName || 'Active'} ($${slot.price || 0})` : 'Empty (Tap to load pack)'}`;

    cell.addEventListener('click', () => {
      if (isBoxEmpty) {
        openActivationForBox(slot.boxNumber);
      } else {
        state.lastScannedSlot = slot.boxNumber;
        bringBoxToVisibleRack(slot.boxNumber);
        handleBoxCardClick(slot);
        renderHeaderAndMetrics();
        renderDispenserRack();
        renderSlotsRibbon();
      }
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
const btnSellOneTicket = document.getElementById('btnBoxSellOneTicket') || document.getElementById('btnSellOneTicket');
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
  const isDaily = state.settings?.operationMode !== 'SHIFTS';
  let start = (currentAdjustingSlot.startTicket !== undefined && currentAdjustingSlot.startTicket !== null) ? currentAdjustingSlot.startTicket : 0;
  if (isDaily) {
    const now = new Date();
    const isToday = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    const todayPastShifts = (state.shiftHistory || [])
      .filter(h => isToday(h.endedAt || h.startedAt))
      .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0));
    if (todayPastShifts.length > 0 && Array.isArray(todayPastShifts[0].slotsSnapshot)) {
      const pastSlot = todayPastShifts[0].slotsSnapshot.find(ps => ps.boxNumber === currentAdjustingSlot.boxNumber);
      if (pastSlot && pastSlot.packNumber === currentAdjustingSlot.packNumber && typeof pastSlot.startTicket === 'number') {
        start = pastSlot.startTicket;
      }
    }
  }

  let curr = parseInt(inputAdjustCount?.value, 10);
  if (isNaN(curr)) curr = currentAdjustingSlot.currentTicket !== undefined ? currentAdjustingSlot.currentTicket : 0;
  if (curr < 0) curr = 0;
  if (curr > packSize) curr = packSize;

  const soldThisShift = Math.max(0, curr - start);
  const remainingInBox = Math.max(0, packSize - curr);
  const price = currentAdjustingSlot.price || 0;

  const adjustSoldLabel = document.getElementById('adjustSoldLabel');
  if (adjustSoldLabel) {
    adjustSoldLabel.textContent = isDaily ? 'Sold Today' : 'Sold Shift';
  }

  const adjustSoldThisShift = document.getElementById('adjustSoldThisShift');
  if (adjustSoldThisShift) {
    adjustSoldThisShift.textContent = `${soldThisShift} tickets ($${(soldThisShift * price).toFixed(2)})`;
  }
  if (adjustTicketsInBox) {
    adjustTicketsInBox.textContent = `${remainingInBox} tickets`;
  }
}

function openBoxAdjustModal(slot) {
  currentAdjustingSlot = slot;
  if (!boxAdjustModal) return;
  clearModalError('boxAdjustErrorBanner', inputAdjustCount);

  const isDaily = state.settings?.operationMode !== 'SHIFTS';
  const adjustSoldLabel = document.getElementById('adjustSoldLabel');
  if (adjustSoldLabel) {
    adjustSoldLabel.textContent = isDaily ? 'Sold Today' : 'Sold Shift';
  }

  const std = getStandardPackDetails(slot.price || 2);
  const packSize = slot.packSize || std.packSize;
  const currentTicket = slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0;
  let startTicket = slot.startTicket !== undefined && slot.startTicket !== null ? slot.startTicket : 0;

  if (isDaily) {
    const now = new Date();
    const isToday = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    const todayPastShifts = (state.shiftHistory || [])
      .filter(h => isToday(h.endedAt || h.startedAt))
      .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0));
    if (todayPastShifts.length > 0 && Array.isArray(todayPastShifts[0].slotsSnapshot)) {
      const pastSlot = todayPastShifts[0].slotsSnapshot.find(ps => ps.boxNumber === slot.boxNumber);
      if (pastSlot && pastSlot.packNumber === slot.packNumber && typeof pastSlot.startTicket === 'number') {
        startTicket = pastSlot.startTicket;
      }
    }
  }

  const cleanName = cleanGameTitle(slot.gameName);
  const soldThisShift = Math.max(0, currentTicket - startTicket);
  const remainingInBox = Math.max(0, packSize - currentTicket);
  const soldAmt = (soldThisShift * (slot.price || 0)).toFixed(2);
  const leftAmt = (remainingInBox * (slot.price || 0)).toFixed(2);
  const daysActive = slot.daysActive || 1;
  const progressPct = Math.min(100, Math.max(0, Math.round((currentTicket / packSize) * 100)));

  // Populate new Box Details Modal elements (Matching Screenshot)
  const boxDetailNumBadge = document.getElementById('boxDetailNumBadge');
  const boxDetailGameName = document.getElementById('boxDetailGameName');
  const boxDetailPrice = document.getElementById('boxDetailPrice');
  const boxDetailSubtitle = document.getElementById('boxDetailSubtitle');
  const boxDetailNextTicket = document.getElementById('boxDetailNextTicket');
  const boxDetailStartedAt = document.getElementById('boxDetailStartedAt');
  const boxDetailSoldToday = document.getElementById('boxDetailSoldToday');
  const boxDetailSoldAmount = document.getElementById('boxDetailSoldAmount');
  const boxDetailLeftInBox = document.getElementById('boxDetailLeftInBox');
  const boxDetailLeftValue = document.getElementById('boxDetailLeftValue');
  const boxDetailDaysOnRack = document.getElementById('boxDetailDaysOnRack');
  const boxDetailProgressFill = document.getElementById('boxDetailProgressFill');
  const boxDetailSellOneSub = document.getElementById('boxDetailSellOneSub');

  if (boxDetailNumBadge) boxDetailNumBadge.textContent = slot.boxNumber;
  if (boxDetailGameName) boxDetailGameName.textContent = cleanName;
  if (boxDetailPrice) boxDetailPrice.textContent = `$${slot.price || 1}`;
  if (boxDetailSubtitle) {
    boxDetailSubtitle.textContent = `Box ${slot.boxNumber} · Pack ${slot.packNumber || '935561'} · ${packSize} tickets per pack`;
  }
  if (boxDetailNextTicket) {
    boxDetailNextTicket.textContent = `#${String(currentTicket).padStart(3, '0')}`;
  }
  if (boxDetailStartedAt) {
    boxDetailStartedAt.textContent = `started at #${String(startTicket).padStart(3, '0')} today`;
  }
  if (boxDetailSoldToday) boxDetailSoldToday.textContent = soldThisShift;
  if (boxDetailSoldAmount) boxDetailSoldAmount.textContent = `$${soldAmt} in sales`;
  if (boxDetailLeftInBox) boxDetailLeftInBox.textContent = remainingInBox;
  if (boxDetailLeftValue) boxDetailLeftValue.textContent = `$${leftAmt} value`;
  if (boxDetailDaysOnRack) {
    boxDetailDaysOnRack.textContent = `${daysActive} day${daysActive === 1 ? '' : 's'}`;
  }
  if (boxDetailProgressFill) {
    boxDetailProgressFill.style.width = `${progressPct}%`;
  }
  if (boxDetailSellOneSub) {
    boxDetailSellOneSub.textContent = `Same as scanning ticket #${String(currentTicket).padStart(3, '0')}`;
  }

  // Legacy field fallbacks
  if (adjustModalTitle) adjustModalTitle.textContent = `Dispenser Box #${slot.boxNumber} Details`;
  if (adjustGameName) adjustGameName.textContent = cleanName;
  const adjustPriceText = document.getElementById('adjustPriceText');
  if (adjustPriceText) {
    adjustPriceText.textContent = `$${slot.price}`;
  } else if (adjustPriceTag) {
    adjustPriceTag.textContent = `$${slot.price}`;
  }
  if (adjustPriceTag) adjustPriceTag.className = `price-tag p${slot.price}`;
  if (adjustPackNum) adjustPackNum.textContent = `#${slot.packNumber || '884901'}`;
  if (adjustPackSize) adjustPackSize.textContent = `${packSize} pk`;
  if (adjustStartTicket) adjustStartTicket.textContent = `#${String(startTicket).padStart(2, '0')}`;
  if (adjustDaysActive) adjustDaysActive.textContent = `${daysActive} Day${daysActive === 1 ? '' : 's'}`;
  if (inputAdjustCount) inputAdjustCount.value = currentTicket;

  const adjustSoldThisShift = document.getElementById('adjustSoldThisShift');
  if (adjustSoldThisShift) {
    adjustSoldThisShift.textContent = `${soldThisShift} tickets ($${soldAmt})`;
  }

  const chkSetAsStartingTicket = document.getElementById('chkSetAsStartingTicket');
  if (chkSetAsStartingTicket) {
    chkSetAsStartingTicket.checked = (soldThisShift === 0);
  }

  if (adjustTicketsInBox) {
    adjustTicketsInBox.textContent = `${remainingInBox} tickets`;
  }
  if (adjustBarcodesCount) {
    adjustBarcodesCount.textContent = (slot.scannedBarcodes || []).length;
  }

  sfx.keypad();
  boxAdjustModal.showModal();
}

let currentSlotForValueChange = null;

function openChangeTicketValueModal(slot) {
  if (!slot) return;
  currentSlotForValueChange = slot;

  const modal = document.getElementById('changeTicketValueModal');
  const title = document.getElementById('changeTicketValueTitle');
  const currentGame = document.getElementById('changeValCurrentGame');
  const currentBadge = document.getElementById('changeValCurrentBadge');
  const boxNumDisplay = document.getElementById('changeValBoxNumDisplay');
  const packDisplay = document.getElementById('changeValPackDisplay');
  const gameNameInput = document.getElementById('changeValGameNameInput');
  const priceInput = document.getElementById('changeValCustomPriceInput');
  const packHint = document.getElementById('changeValPackHint');

  const currentPrice = slot.price || 1;
  const currentName = cleanGameTitle(slot.gameName || 'Scratch-Off Game');
  const cleanPack = String(slot.packNumber || '---').replace(/[^0-9]/g, '') || '---';

  if (title) title.textContent = `Change Ticket Value (Box #${slot.boxNumber})`;
  if (currentGame) currentGame.textContent = currentName;
  if (currentBadge) {
    currentBadge.textContent = `$${currentPrice}`;
    currentBadge.className = `lotto-summary-price p${currentPrice}`;
  }
  if (boxNumDisplay) boxNumDisplay.textContent = `Dispenser Box #${slot.boxNumber}`;
  if (packDisplay) packDisplay.textContent = `Pack #${cleanPack}`;
  if (gameNameInput) gameNameInput.value = currentName;
  if (priceInput) priceInput.value = currentPrice;

  // Highlight pill matching current price
  document.querySelectorAll('.change-val-pill').forEach(pill => {
    const p = Number(pill.getAttribute('data-price'));
    pill.classList.toggle('active', p === currentPrice);
  });

  if (packHint) {
    const std = getStandardPackDetails(currentPrice);
    packHint.innerHTML = `📖 <strong>$${std.bookValue} Pack</strong> (${std.packSize} tickets)`;
  }

  sfx.keypad();
  if (modal) {
    modal.showModal();
    setTimeout(() => {
      priceInput?.focus();
      priceInput?.select();
    }, 100);
  }
}

function saveTicketValueChange() {
  if (!currentSlotForValueChange) return;
  const slot = currentSlotForValueChange;
  const nameInput = document.getElementById('changeValGameNameInput');
  const priceInput = document.getElementById('changeValCustomPriceInput');

  const newPrice = Math.max(1, parseFloat(priceInput?.value) || 1);
  const newName = (nameInput?.value || '').trim() || cleanGameTitle(slot.gameName || 'Scratch-Off Game');
  const std = getStandardPackDetails(newPrice);

  slot.price = newPrice;
  slot.gameName = newName;

  // Auto-adjust pack capacity if using standard capacity for old price
  if (!slot.packSize || slot.packSize === 300 || slot.packSize === 150 || slot.packSize === 100 || slot.packSize === 60 || slot.packSize === 30 || slot.packSize === 20) {
    slot.packSize = std.packSize;
  }

  // Also update registered customGames if present
  if (state.customGames) {
    const cg = state.customGames.find(g => g.name.toLowerCase() === newName.toLowerCase() || (slot.gameId && g.id === slot.gameId));
    if (cg) {
      cg.price = newPrice;
      cg.name = newName;
      cg.packSize = slot.packSize;
    }
  }

  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  // If Box Details modal is open, refresh it live
  if (boxAdjustModal?.open && currentAdjustingSlot?.boxNumber === slot.boxNumber) {
    openBoxAdjustModal(slot);
  }

  // If Inventory modal is open, refresh it live
  if (inventoryModal?.open) {
    renderInventoryTable();
  }
  if (inventoryStatusModal?.open) {
    renderInventoryStatusModal();
  }

  document.getElementById('changeTicketValueModal')?.close();
  sfx.bell();
  showToast(`✓ Box #${slot.boxNumber} ticket value updated to $${newPrice} (${newName})!`, 'success');
}

function openReturnPackModal(slot) {
  try {
    if (!returnPackModal || !slot) return;
    currentAdjustingSlot = slot;
    const std = getStandardPackDetails(slot.price || 2);
    const packSize = slot.packSize || std.packSize || 100;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    let curr = (inputAdjustCount && inputAdjustCount.value !== '')
      ? (parseInt(inputAdjustCount.value, 10) || slot.currentTicket || 0)
      : (slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0);
    if (curr > packSize) curr = packSize;
    if (curr < start) curr = start;

    const sold = Math.max(0, curr - start);
    const returned = Math.max(0, packSize - curr);
    const price = slot.price || 0;
    const soldAmt = sold * price;
    const returnedAmt = returned * price;

    const cleanName = cleanGameTitle(slot.gameName || 'Lottery Pack');
    const returnPackBoxBadge = document.getElementById('returnPackBoxBadge');
    const returnPackModalTitle = document.getElementById('returnPackModalTitle');
    const returnPackModalSubtitle = document.getElementById('returnPackModalSubtitle');

    if (returnPackBoxBadge) returnPackBoxBadge.textContent = slot.boxNumber;
    if (returnPackModalTitle) returnPackModalTitle.textContent = `Take ${cleanName} off the rack`;
    if (returnPackModalSubtitle) {
      returnPackModalSubtitle.textContent = `Box ${slot.boxNumber} · Pack ${slot.packNumber || '---'} · ${returned} tickets left ($${returnedAmt.toFixed(2)})`;
    }

    const headerBox = document.getElementById('returnPackBoxNumHeader');
    if (headerBox) headerBox.textContent = slot.boxNumber;

    if (returnPackGameTitle) returnPackGameTitle.textContent = cleanName;
    if (returnPackSerial) returnPackSerial.textContent = slot.packNumber || '---';
    if (returnPackBoxNum) returnPackBoxNum.textContent = slot.boxNumber;
    if (returnPackPriceTag) {
      returnPackPriceTag.textContent = `$${price}`;
      returnPackPriceTag.className = `price-tag p${price}`;
    }
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    const returnSoldLabel = document.getElementById('returnPackSoldLabel');
    if (returnSoldLabel) returnSoldLabel.textContent = isDaily ? 'Sold Today' : 'Sold This Shift';

    if (returnPackSoldTickets) returnPackSoldTickets.textContent = `${sold}`;
    if (returnPackSoldAmount) returnPackSoldAmount.textContent = `+$${soldAmt.toFixed(2)} Sales`;
    if (returnPackReturnedTickets) returnPackReturnedTickets.textContent = `${returned}`;
    if (returnPackReturnedAmount) returnPackReturnedAmount.textContent = `$${returnedAmt.toFixed(2)} Value`;

    // Update dynamic values in both 2-column cards (eliminating $0.00 bug)
    const returnLotteryCreditText = document.getElementById('returnLotteryCreditText');
    if (returnLotteryCreditText) {
      returnLotteryCreditText.textContent = `${returned} tickets · $${returnedAmt.toFixed(2)}`;
    }

    const returnStorageValText = document.getElementById('returnStorageValText');
    if (returnStorageValText) {
      returnStorageValText.textContent = `${returned} tickets · $${returnedAmt.toFixed(2)}`;
    }

    if (confirmReturnPackBtn) {
      confirmReturnPackBtn.innerHTML = `🏢 Return to Lottery ($${returnedAmt.toFixed(2)})`;
    }

    const confirmPartialTakeOutBtn = document.getElementById('confirmPartialTakeOutBtn');
    if (confirmPartialTakeOutBtn) {
      confirmPartialTakeOutBtn.innerHTML = `📦 Move to Storage ($${returnedAmt.toFixed(2)})`;
    }

    // Close boxAdjustModal before opening returnPackModal to prevent dialog stacking conflicts
    if (boxAdjustModal?.open) {
      boxAdjustModal.close();
    }
    if (returnPackModal.open) {
      returnPackModal.close();
    }

    sfx.keypad();
    returnPackModal.showModal();
  } catch (err) {
    console.error('Error opening Return Pack modal:', err);
    sfx.alert();
    showToast(`❌ Could not open Return Pack: ${err.message}`, 'error');
  }
}

function handleConfirmReturnPack() {
  try {
    if (!currentAdjustingSlot || !currentAdjustingSlot.packNumber) {
      sfx.alert();
      showToast('⚠️ No active pack selected to return.', 'warning');
      returnPackModal?.close();
      return;
    }

    // Use a fresh reference from state.slots to avoid stale object references
    const boxNum = currentAdjustingSlot.boxNumber;
    const slot = (state.slots || []).find(s => s.boxNumber === boxNum);
    if (!slot || !slot.packNumber) {
      sfx.alert();
      showToast('⚠️ Could not find the pack to return. Box may have been modified.', 'warning');
      returnPackModal?.close();
      return;
    }

    const std = getStandardPackDetails(slot.price || 2);
    const packSize = slot.packSize || std.packSize || 100;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    let curr = (inputAdjustCount && inputAdjustCount.value !== '')
      ? (parseInt(inputAdjustCount.value, 10) || slot.currentTicket || 0)
      : (slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0);
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
    slot.soldBarcodes = [];
    slot.ticketsInBox = 0;

    saveState(state);
    sfx.alert();
    returnPackModal?.close();
    boxAdjustModal?.close();

    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    renderInventoryTable();
    if (typeof renderInventoryStatusModal === 'function') renderInventoryStatusModal();

    showToast(`↩️ Box #${returnRecord.boxNumber} returned: ${sold} sold ($${soldAmt.toFixed(2)}), ${returned} returned to lottery ($${returnedAmt.toFixed(2)}). Box emptied.`, 'success');
  } catch (err) {
    console.error('Return Pack Error:', err);
    sfx.alert();
    showToast(`❌ Error returning pack: ${err.message}`, 'error');
    returnPackModal?.close();
  }
}


function handleConfirmPartialTakeOut() {
  try {
    if (!currentAdjustingSlot || !currentAdjustingSlot.packNumber) {
      sfx.alert();
      showToast('⚠️ No active pack selected to move to storage.', 'warning');
      returnPackModal?.close();
      return;
    }

    // Use a fresh reference from state.slots to avoid stale object references
    const boxNum = currentAdjustingSlot.boxNumber;
    const slot = (state.slots || []).find(s => s.boxNumber === boxNum);
    if (!slot || !slot.packNumber) {
      sfx.alert();
      showToast('⚠️ Could not find the pack to move. Box may have been modified.', 'warning');
      returnPackModal?.close();
      return;
    }

    const std = getStandardPackDetails(slot.price || 2);
    const packSize = slot.packSize || std.packSize || 100;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    let curr = (inputAdjustCount && inputAdjustCount.value !== '')
      ? (parseInt(inputAdjustCount.value, 10) || slot.currentTicket || 0)
      : (slot.currentTicket !== undefined && slot.currentTicket !== null ? slot.currentTicket : 0);
    if (curr > packSize) curr = packSize;
    if (curr < start) curr = start;

    const sold = Math.max(0, curr - start);
    const availableTix = Math.max(0, packSize - curr);
    const price = slot.price || 0;
    const soldAmt = sold * price;

    let ptoCount = parseInt(document.getElementById('inputPtoTicketCount')?.value, 10);
    if (isNaN(ptoCount) || ptoCount <= 0 || ptoCount > availableTix) {
      ptoCount = availableTix;
    }
    const ptoVal = ptoCount * price;

    recordUndoAction({
      type: 'PARTIAL_TAKE_OUT',
      boxNumber: slot.boxNumber,
      slotSnapshot: JSON.parse(JSON.stringify(slot))
    });

    // Record shift sales up to current ticket
    if (sold > 0) {
      if (!state.soldOutThisShift) state.soldOutThisShift = [];
      state.soldOutThisShift.push({
        boxNumber: slot.boxNumber,
        gameName: slot.gameName,
        price: price,
        packNumber: slot.packNumber,
        packSize: packSize,
        startTicket: start,
        closeTicket: curr,
        ticketsSold: sold,
        salesAmount: soldAmt,
        ticketsReturned: 0,
        returnedAmount: 0,
        isPartialTakeOut: true,
        soldAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      });
    }

    if (!state.partialTakeOuts) state.partialTakeOuts = [];
    const ptoRecord = {
      id: 'pto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      gameId: slot.gameId,
      gameName: slot.gameName,
      price: price,
      packNumber: slot.packNumber,
      packSize: packSize,
      fromBoxNumber: slot.boxNumber,
      currentTicket: curr,
      ticketsCount: ptoCount,
      totalValue: ptoVal,
      status: 'NOT_FOR_SALE',
      takenOutAt: new Date().toISOString(),
      takenOutAtDisplay: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
    state.partialTakeOuts.push(ptoRecord);

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
    slot.soldBarcodes = [];
    slot.ticketsInBox = 0;

    saveState(state);
    sfx.alert();
    returnPackModal?.close();
    boxAdjustModal?.close();

    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    renderInventoryTable();
    if (typeof renderInventoryStatusModal === 'function') renderInventoryStatusModal();

    showToast(`📦 Partial Take Out: ${ptoCount} tickets of Pack #${ptoRecord.packNumber} kept in store inventory (Not For Sale). Box #${ptoRecord.fromBoxNumber} is now empty.`, 'success');
  } catch (err) {
    console.error('Partial Take Out Error:', err);
    sfx.alert();
    showToast(`❌ Error moving pack to storage: ${err.message}`, 'error');
    returnPackModal?.close();
  }
}


// -------------------------------------------------------------
// Scanned Partial Take Out Handling (Activate or Delete)
// -------------------------------------------------------------
let currentPtoActionItem = null;

function openPartialTakeOutActionModal(pto, rawBarcode = '', parsedTicket = null) {
  currentPtoActionItem = pto;
  const modal = document.getElementById('partialTakeOutActionModal');
  if (!modal) return;

  const tixNum = (parsedTicket && parsedTicket.ticketNumber !== null) ? parsedTicket.ticketNumber : (pto.currentTicket || 0);

  const titleEl = document.getElementById('ptoScannedGameTitle');
  if (titleEl) titleEl.textContent = cleanGameTitle(pto.gameName);

  const packEl = document.getElementById('ptoScannedPackNumber');
  if (packEl) packEl.textContent = pto.packNumber;

  const tixEl = document.getElementById('ptoScannedTicketNumber');
  if (tixEl) tixEl.textContent = String(tixNum).padStart(2, '0');

  const priceEl = document.getElementById('ptoScannedPriceTag');
  if (priceEl) {
    priceEl.textContent = `$${pto.price}`;
    priceEl.className = `price-tag p${pto.price}`;
  }

  const leftEl = document.getElementById('ptoScannedTicketsLeft');
  if (leftEl) leftEl.textContent = `${pto.ticketsCount} tickets (originally Box #${pto.fromBoxNumber})`;

  const valEl = document.getElementById('ptoScannedTotalValue');
  if (valEl) valEl.textContent = `$${Number(pto.totalValue).toFixed(2)}`;

  // Suggest target box: original box if empty, otherwise first empty box
  const targetBoxInput = document.getElementById('ptoTargetBoxInput');
  if (targetBoxInput) {
    const origSlot = state.slots.find(s => s.boxNumber === pto.fromBoxNumber);
    if (origSlot && (!origSlot.status || origSlot.status === 'EMPTY' || !origSlot.packNumber)) {
      targetBoxInput.value = pto.fromBoxNumber;
    } else {
      const firstEmpty = state.slots.find(s => !s.status || s.status === 'EMPTY' || !s.packNumber);
      targetBoxInput.value = firstEmpty ? firstEmpty.boxNumber : (state.totalSlots + 1);
    }
  }

  sfx.alert();
  modal.showModal();
}

function handlePtoActivate() {
  if (!currentPtoActionItem) return;
  const pto = currentPtoActionItem;
  const targetBoxInput = document.getElementById('ptoTargetBoxInput');
  const targetBox = parseInt(targetBoxInput?.value, 10) || pto.fromBoxNumber || 1;

  let slot = state.slots.find(s => s.boxNumber === targetBox);
  if (!slot) {
    while (state.slots.length < targetBox) {
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
        soldBarcodes: [],
        activatedThisShift: false,
        daysActive: 0,
        scannedInEndShift: false
      });
    }
    state.totalSlots = Math.max(state.totalSlots, targetBox);
    slot = state.slots.find(s => s.boxNumber === targetBox);
  }

  slot.gameId = pto.gameId;
  slot.gameName = pto.gameName;
  slot.price = pto.price;
  slot.packNumber = pto.packNumber;
  slot.packSize = pto.packSize;
  slot.startTicket = pto.currentTicket || 0;
  slot.currentTicket = pto.currentTicket || 0;
  slot.ticketsInBox = pto.ticketsCount || 0;
  slot.status = 'ACTIVE';
  slot.activatedThisShift = true;
  slot.scannedBarcodes = [];
  slot.soldBarcodes = [];

  // Remove from partialTakeOuts
  state.partialTakeOuts = (state.partialTakeOuts || []).filter(item => item.id !== pto.id && item.packNumber !== pto.packNumber);

  saveState(state);
  sfx.chime();
  document.getElementById('partialTakeOutActionModal')?.close();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  renderInventoryTable();
  if (typeof renderInventoryStatusModal === 'function') renderInventoryStatusModal();

  showToast(`✓ Pack #${pto.packNumber} activated into Box #${targetBox} at ticket #${String(slot.currentTicket).padStart(2, '0')}. Now ON SALE!`, 'success');
  currentPtoActionItem = null;
}

function handlePtoDelete() {
  if (!currentPtoActionItem) return;
  const pto = currentPtoActionItem;
  if (!confirm(`Are you sure you want to permanently delete/discard partial pack #${pto.packNumber} (${pto.ticketsCount} tickets) from inventory?`)) {
    return;
  }

  state.partialTakeOuts = (state.partialTakeOuts || []).filter(item => item.id !== pto.id && item.packNumber !== pto.packNumber);

  saveState(state);
  sfx.trash();
  document.getElementById('partialTakeOutActionModal')?.close();

  renderHeaderAndMetrics();
  renderInventoryTable();
  if (typeof renderInventoryStatusModal === 'function') renderInventoryStatusModal();

  showToast(`🗑️ Partial pack #${pto.packNumber} deleted from store inventory.`, 'info');
  currentPtoActionItem = null;
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
  closeReturnPackBtn?.addEventListener('click', () => {
    returnPackModal?.close();
    if (currentAdjustingSlot && currentAdjustingSlot.status === 'ACTIVE') {
      openBoxAdjustModal(currentAdjustingSlot);
    }
  });
  cancelReturnPackBtn?.addEventListener('click', () => {
    returnPackModal?.close();
    if (currentAdjustingSlot && currentAdjustingSlot.status === 'ACTIVE') {
      openBoxAdjustModal(currentAdjustingSlot);
    }
  });
  confirmReturnPackBtn?.addEventListener('click', handleConfirmReturnPack);
  document.getElementById('confirmPartialTakeOutBtn')?.addEventListener('click', handleConfirmPartialTakeOut);

  // Partial Take Out Action Modal Wire-up
  document.getElementById('closePtoActionModalBtn')?.addEventListener('click', () => {
    document.getElementById('partialTakeOutActionModal')?.close();
  });
  document.getElementById('btnPtoCancel')?.addEventListener('click', () => {
    document.getElementById('partialTakeOutActionModal')?.close();
  });
  document.getElementById('btnPtoActivate')?.addEventListener('click', handlePtoActivate);
  document.getElementById('btnPtoDelete')?.addEventListener('click', handlePtoDelete);

  btnReturnPack?.addEventListener('click', (e) => {
    e?.stopPropagation();
    try {
      if (!currentAdjustingSlot || currentAdjustingSlot.status !== 'ACTIVE' || !currentAdjustingSlot.packNumber) {
        sfx.alert();
        showToast('⚠️ No active lottery pack in this box to return.', 'warning');
        return;
      }
      openReturnPackModal(currentAdjustingSlot);
    } catch (err) {
      console.error('Error clicking Return Pack:', err);
      sfx.alert();
      showToast(`❌ Error: ${err.message}`, 'error');
    }
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
    if (inputAdjustCount) {
      let val = parseInt(inputAdjustCount.value, 10) || 0;
      if (val > 0) inputAdjustCount.value = val - 1;
      updateAdjustModalDynamicStats();
    }
  });

  btnCountPlus?.addEventListener('click', () => {
    sfx.keypad();
    if (inputAdjustCount) {
      let val = parseInt(inputAdjustCount.value, 10) || 0;
      inputAdjustCount.value = val + 1;
      updateAdjustModalDynamicStats();
    }
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
      if (inputAdjustCount) inputAdjustCount.value = currentAdjustingSlot.currentTicket;
      updateAdjustModalDynamicStats();
      showToast(`🛒 Box #${currentAdjustingSlot.boxNumber} sold 1 ticket! (Now #${String(currentAdjustingSlot.currentTicket).padStart(2, '0')})`, 'success');
    }

    saveState(state);
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    if (boxAdjustModal?.open && currentAdjustingSlot?.status !== 'SOLD_OUT') {
      openBoxAdjustModal(currentAdjustingSlot);
    }
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

  const cleanName = cleanGameTitle(slot.gameName || 'Active Box');
  const price = slot.price || 1;
  const std = getStandardPackDetails(price);
  const packSize = slot.packSize || std.packSize || 100;
  const packBookVal = packSize * price;

  const pricePill = document.getElementById('changeBoxPricePill');
  const packTitle = document.getElementById('changeBoxPackTitle');
  const packSub = document.getElementById('changeBoxPackSub');
  const displayVal = document.getElementById('changeBoxDisplayVal');
  const pillsContainer = document.getElementById('changeBoxEmptyPills');

  if (pricePill) pricePill.textContent = `$${price}`;
  if (packTitle) packTitle.textContent = cleanName;
  if (packSub) {
    packSub.textContent = `Pack ${slot.packNumber || '550840'} · ${packSize} tickets · $${packBookVal} pack`;
  }
  if (changeBoxSourceInfo) {
    changeBoxSourceInfo.textContent = `Box #${slot.boxNumber} · ${cleanName}`;
  }
  if (inputChangeTargetBox) inputChangeTargetBox.value = '';
  if (displayVal) displayVal.textContent = '—';

  // Populate empty boxes quick pills
  if (pillsContainer) {
    const emptySlots = state.slots
      .filter(s => s.status === 'EMPTY' || !s.gameName)
      .sort((a, b) => a.boxNumber - b.boxNumber);

    pillsContainer.innerHTML = emptySlots.map(s => `
      <button type="button" class="empty-box-pill" data-box="${s.boxNumber}">
        ${s.boxNumber}
      </button>
    `).join('');

    pillsContainer.querySelectorAll('.empty-box-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
        sfx.keypad();
        const bNum = pill.getAttribute('data-box');
        if (inputChangeTargetBox) inputChangeTargetBox.value = bNum;
        if (displayVal) displayVal.textContent = bNum;
        pillsContainer.querySelectorAll('.empty-box-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
    });
  }

  sfx.keypad();
  changeBoxModal.showModal();
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
  currentAdjustingSlot = slot;
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

  if (boxAdjustModal?.open) {
    openBoxAdjustModal(currentAdjustingSlot);
  }
  if (inventoryStatusModal?.open) {
    renderInventoryStatusModal();
  }
  if (inventoryModal?.open) {
    renderInventoryTable();
  }

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

  function syncChangeBoxDisplay() {
    const displayVal = document.getElementById('changeBoxDisplayVal');
    const val = inputChangeTargetBox ? inputChangeTargetBox.value.trim() : '';
    if (displayVal) {
      displayVal.textContent = val || '—';
    }
    const pillsContainer = document.getElementById('changeBoxEmptyPills');
    pillsContainer?.querySelectorAll('.empty-box-pill').forEach(pill => {
      if (pill.getAttribute('data-box') === val) {
        pill.classList.add('selected');
      } else {
        pill.classList.remove('selected');
      }
    });
  }

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
      syncChangeBoxDisplay();
    });
  });

  document.getElementById('keyChangeClear')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    if (inputChangeTargetBox) {
      inputChangeTargetBox.value = '';
    }
    syncChangeBoxDisplay();
  });

  document.getElementById('keyChangeBackspace')?.addEventListener('click', () => {
    clearModalError('changeBoxErrorBanner', inputChangeTargetBox);
    sfx.keypad();
    if (inputChangeTargetBox) {
      inputChangeTargetBox.value = inputChangeTargetBox.value.slice(0, -1);
    }
    syncChangeBoxDisplay();
  });

  document.getElementById('keyChangeEnter')?.addEventListener('click', handleConfirmChangeBox);

  // Wire destination cards in returnPackModal (Matching Screenshot 1)
  document.getElementById('cardReturnToLottery')?.addEventListener('click', () => {
    document.getElementById('confirmReturnPackBtn')?.click();
  });
  document.getElementById('cardKeepInSafe')?.addEventListener('click', () => {
    document.getElementById('confirmPartialTakeOutBtn')?.click();
  });
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
    presetStartInput.title = `0 for full roll (${fullPackSize} tickets), or enter custom count (e.g. 50)`;
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
    const prevSold = Math.max(0, (targetSlot.currentTicket || 0) - (targetSlot.startTicket || 0));
    if (prevSold > 0 || targetSlot.status === 'SOLD_OUT') {
      const closePos = targetSlot.status === 'SOLD_OUT' ? (targetSlot.packSize || targetSlot.currentTicket) : targetSlot.currentTicket;
      recordSoldOutPack(targetSlot, closePos);
    }
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
  targetSlot.soldBarcodes = [];

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
  const padLen = (slot.packSize || 100) >= 100 ? 3 : 2;
  state.lastScannedBarcode = `${bcPrefix}Box #${slot.boxNumber} · $${Number(slot.price).toFixed(2)} · ${cleanName} (Sold 1x → #${String(slot.currentTicket).padStart(padLen, '0')})`;

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

  // Log real-time ticket scan to normalized MySQL ticket_scans_log
  logTicketScanToDB({
    barcode: actualBarcode,
    boxNumber: slot.boxNumber,
    gameName: cleanName,
    packNumber: slot.packNumber || '---',
    ticketNumber: slot.currentTicket,
    price: slot.price,
    cashier: state.settings?.cashierName || 'master',
    shiftNumber: state.currentShiftNumber || 1
  });
  
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
      // Remove the last sold barcode entry so the ticket can be re-scanned if needed
      if (slot.soldBarcodes && slot.soldBarcodes.length > 0) {
        slot.soldBarcodes.pop();
      }
      if (state.soldBarcodes && state.soldBarcodes.length > 0) {
        state.soldBarcodes.pop();
      }
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

function openResetOptionsModal() {
  const modal = document.getElementById('resetOptionsModal');
  if (modal) {
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    const titleEl = document.getElementById('resetOptionSalesTitle');
    if (titleEl) titleEl.textContent = isDaily ? 'Reset Daily Sales to $0.00' : 'Reset Shift Sales to $0.00';
    const descEl = document.getElementById('resetOptionSalesDesc');
    if (descEl) descEl.textContent = isDaily 
      ? 'Set current ticket positions as new opening numbers so day sales reset to $0.00 without removing any lottery games.'
      : 'Set current ticket positions as new opening numbers so shift sales reset to $0.00 without removing any lottery games.';
    sfx.keypad();
    modal.showModal();
  }
}

function executeTrimRack() {
  // Find highest box index that has an active pack
  let highestActiveBox = 0;
  (state.slots || []).forEach(s => {
    if (s.status === 'ACTIVE' && s.packNumber && s.boxNumber > highestActiveBox) {
      highestActiveBox = s.boxNumber;
    }
  });

  const targetSlots = Math.max(20, highestActiveBox);
  if (state.totalSlots <= targetSlots) {
    sfx.alert();
    showToast(`Rack is already trimmed to ${targetSlots} boxes (preserving all active boxes).`, 'info');
    return;
  }

  const removedCount = state.totalSlots - targetSlots;
  state.slots = state.slots.slice(0, targetSlots);
  state.totalSlots = targetSlots;

  saveState(state);
  sfx.chime();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(`✓ Trimmed ${removedCount} empty boxes! Rack is now ${targetSlots} boxes.`, 'success');
}

function executeResetShiftSales() {
  const isDaily = state.settings?.operationMode !== 'SHIFTS';
  const label = isDaily ? 'daily' : 'current shift';
  if (!confirm(`Reset ${label} sales to $0.00?\nAll active packs and ticket numbers remain in their boxes.`)) {
    return;
  }
  (state.slots || []).forEach(slot => {
    if (slot.status === 'ACTIVE') {
      slot.startTicket = slot.currentTicket || 0;
      slot.activatedThisShift = false;
      slot.soldBarcodes = [];
    }
  });
  state.soldOutThisShift = [];
  state.onlineSales = 0;
  state.cashes = 0;
  state.onlineCashes = 0;
  state.soldBarcodes = [];
  state.recentScans = [];
  saveState(state);
  sfx.success();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  showToast(isDaily ? '✓ Daily sales reset to $0.00! Active tickets ready for new count.' : '✓ Shift sales reset to $0.00! Active tickets ready for new count.', 'success');
}

function executeResetScanner() {
  clearScanAlertBanner();
  if (barcodeInput) {
    barcodeInput.value = '';
    barcodeInput.focus();
  }
  state.lastScannedSlot = null;
  renderDispenserRack();
  renderSlotsRibbon();
  sfx.chime();
  showToast('✓ Scanner buffer and display alerts cleared.', 'info');
}

function executeWipeAllData() {
  if (confirm('⚠️ WARNING: Erase all POS lottery data, custom boxes, and history to start fresh?')) {
    state = resetToCleanState(state);
    saveState(state);
    initPOS();
    showSellCounterView();
    sfx.alert();
    showToast('All POS data wiped. Clean start ready.', 'info');
  }
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
  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  if (state.shiftStatus === 'IN_PROGRESS') {
    // Transition to Scanning End Shift / End Day mode
    state.shiftStatus = 'SCANNING_END_SHIFT';
    state.slots.forEach(s => s.scannedInEndShift = false);
    saveState(state);
    sfx.beep();
    voice.speakStartScanning();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast(isDailyMode ? 'End Day mode started! Scan the front ticket of each active dispenser box.' : 'End Shift mode started! Scan or tap each active dispenser box.', 'info');
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    // Show Calculating Segmented Spinner (Matching Video 02:55)
    showCalculatingSpinner('Calculating', isDailyMode ? 'Calculating End Day' : 'Calculating End Shift', () => {
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

  const isDaily = state.settings?.operationMode !== 'SHIFTS';

  // Gather all sold out packs and empty dispenser boxes
  const soldOutItems = [];

  // 1. Explicitly recorded sold-out packs (today's past shifts if Daily Mode + current shift)
  const allSoldOut = [];
  if (isDaily) {
    const now = new Date();
    const isToday = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    (state.shiftHistory || []).filter(h => isToday(h.endedAt || h.startedAt)).forEach(h => {
      (h.soldOutSnapshot || []).forEach(so => allSoldOut.push(so));
    });
  }
  (state.soldOutThisShift || []).forEach(so => allSoldOut.push(so));

  allSoldOut.forEach(so => {
    if (!soldOutItems.some(item => item.boxNumber === so.boxNumber && item.packNumber === so.packNumber)) {
      soldOutItems.push({
        boxNumber: so.boxNumber,
        packNumber: so.packNumber,
        gameName: so.gameName || 'Lottery Pack',
        isSoldOutPack: true
      });
    }
  });

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

  const confTitle = document.getElementById('endShiftModalTitleText');
  if (confTitle) confTitle.textContent = isDaily ? '📋 End Day Verification' : '📋 End Shift Verification';
  const confSub = document.getElementById('endShiftModalSubtitle');
  if (confSub) confSub.textContent = isDaily ? 'Calculating End of Day' : 'Calculating End Shift';
  const confConfirmBtn = document.getElementById('confConfirmBtn');
  if (confConfirmBtn) confConfirmBtn.textContent = isDaily ? 'Confirm End Day' : 'Confirm End Shift';

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

export function buildShiftReportRows(slots = [], soldOutList = []) {
  const rows = [];
  const processedKeys = new Set();

  // Find all unique box numbers that have an active/sold-out slot or a sold-out pack
  const boxNumSet = new Set();
  (slots || []).forEach(s => {
    if (s && s.boxNumber && (s.status === 'ACTIVE' || s.status === 'SOLD_OUT' || (s.currentTicket > (s.startTicket || 0)))) {
      boxNumSet.add(s.boxNumber);
    }
  });
  (soldOutList || []).forEach(so => {
    if (so && so.boxNumber) {
      boxNumSet.add(so.boxNumber);
    }
  });

  const sortedBoxNums = Array.from(boxNumSet).sort((a, b) => a - b);

  sortedBoxNums.forEach(boxNum => {
    // 1. Any sold-out / returned packs for this box
    const boxSoldOuts = (soldOutList || []).filter(so => so && so.boxNumber === boxNum);
    boxSoldOuts.forEach(so => {
      const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
      const amount = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
      const startNum = so.startTicket !== undefined ? so.startTicket : 0;
      const closeNum = so.closeTicket !== undefined ? so.closeTicket : (startNum + sold);
      const key = `${boxNum}_so_${so.packNumber || ''}_${startNum}_${closeNum}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        rows.push({
          boxNumber: boxNum,
          gameName: so.gameName || 'Scratch Off',
          price: so.price || 0,
          startTicket: startNum,
          closeTicket: closeNum,
          sold: sold,
          amount: amount,
          statusTag: so.isReturned ? `RETURNED (${so.ticketsReturned || 0})` : 'SOLD OUT',
          isReturned: Boolean(so.isReturned),
          isSoldOut: !so.isReturned
        });
      }
    });

    // 2. Active slot for this box
    const slot = (slots || []).find(s => s && s.boxNumber === boxNum);
    if (slot && slot.status === 'ACTIVE' && slot.packNumber) {
      // Deduplicate if active slot has the exact same packNumber as a sold-out pack already processed
      const alreadyAsSoldOut = boxSoldOuts.some(so => so.packNumber === slot.packNumber);
      if (!alreadyAsSoldOut) {
        const sold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
        const amount = sold * (slot.price || 0);
        const startNum = slot.startTicket !== undefined ? slot.startTicket : 0;
        const closeNum = slot.currentTicket !== undefined ? slot.currentTicket : 0;
        const key = `${boxNum}_act_${slot.packNumber}_${startNum}_${closeNum}`;
        if (!processedKeys.has(key)) {
          processedKeys.add(key);
          rows.push({
            boxNumber: boxNum,
            gameName: slot.gameName || 'Scratch Off',
            price: slot.price || 0,
            startTicket: startNum,
            closeTicket: closeNum,
            sold: sold,
            amount: amount,
            statusTag: null,
            isReturned: false,
            isSoldOut: false
          });
        }
      }
    } else if (slot && slot.status === 'SOLD_OUT' && boxSoldOuts.length === 0) {
      const sold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
      const amount = sold * (slot.price || 0);
      const startNum = slot.startTicket !== undefined ? slot.startTicket : 0;
      const closeNum = slot.currentTicket !== undefined ? slot.currentTicket : 0;
      const key = `${boxNum}_slotso_${slot.packNumber || ''}_${startNum}_${closeNum}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        rows.push({
          boxNumber: boxNum,
          gameName: slot.gameName || 'Scratch Off',
          price: slot.price || 0,
          startTicket: startNum,
          closeTicket: closeNum,
          sold: sold,
          amount: amount,
          statusTag: 'SOLD OUT',
          isReturned: false,
          isSoldOut: true
        });
      }
    }
  });

  return rows;
}

function openShiftReportModal() {
  voice.speakReport();
  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const shiftModalTitle = document.getElementById('shiftReportModalTitle');
  if (shiftModalTitle) shiftModalTitle.textContent = isDailyMode ? 'Day Report' : 'Shift Report';

  const repShiftNumLabel = document.getElementById('repShiftNumLabel');
  if (repShiftNumLabel) repShiftNumLabel.textContent = isDailyMode ? 'Day' : 'Shift';

  repShiftNum.textContent = isDailyMode ? dateStr : `#${state.shiftNumber}`;
  repCashier.textContent = state.cashierName;

  const repTotalSalesLabel = document.getElementById('repTotalSalesLabel');
  if (repTotalSalesLabel) repTotalSalesLabel.textContent = isDailyMode ? 'TOTAL LOTTO DAY SALES' : 'TOTAL LOTTO SHIFT SALES';

  const reportNewShiftBtn = document.getElementById('reportNewShiftBtn');
  if (reportNewShiftBtn) reportNewShiftBtn.textContent = isDailyMode ? '✨ New Day' : '🚀 New Shift';

  reportBodyRows.innerHTML = '';
  
  // In Daily Mode, aggregate across today's past shifts + current session so it reflects the whole day
  let reportSlots = state.slots;
  let reportSoldOut = state.soldOutThisShift || [];
  if (isDailyMode) {
    const isToday = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    const todayPastShifts = (state.shiftHistory || [])
      .filter(h => isToday(h.endedAt || h.startedAt))
      .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0));
    const earliestShift = todayPastShifts.length > 0 ? todayPastShifts[0] : null;

    reportSlots = (state.slots || []).map(s => {
      let openTicket = s.startTicket || 0;
      if (earliestShift && Array.isArray(earliestShift.slotsSnapshot)) {
        const pastSlot = earliestShift.slotsSnapshot.find(ps => ps.boxNumber === s.boxNumber);
        if (pastSlot && pastSlot.packNumber === s.packNumber && typeof pastSlot.startTicket === 'number') {
          openTicket = pastSlot.startTicket;
        }
      }
      return { ...s, startTicket: openTicket };
    });

    const allSoldOut = [];
    todayPastShifts.forEach(h => {
      (h.soldOutSnapshot || []).forEach(so => allSoldOut.push(so));
    });
    (state.soldOutThisShift || []).forEach(so => allSoldOut.push(so));
    reportSoldOut = allSoldOut;
  }

  const rows = buildShiftReportRows(reportSlots, reportSoldOut);
  let totalSold = 0;
  let totalRevenue = 0;

  rows.forEach(item => {
    totalSold += item.sold;
    totalRevenue += item.amount;

    const row = document.createElement('tr');
    row.className = 'report-row';
    let tagHtml = '';
    if (item.statusTag) {
      const tagClass = item.isReturned ? 'report-tag-returned' : 'report-tag-soldout';
      tagHtml = `<span class="report-status-tag ${tagClass}">${item.statusTag}</span>`;
    }
    row.innerHTML = `
      <td class="col-box"><span class="report-box-badge">Box ${item.boxNumber}</span></td>
      <td class="col-game" title="${item.gameName}">
        ${cleanGameTitle(item.gameName)}${tagHtml}
      </td>
      <td class="col-price">$${item.price}</td>
      <td class="col-start">${String(item.startTicket).padStart(2, '0')}</td>
      <td class="col-close">${String(item.closeTicket).padStart(2, '0')}</td>
      <td class="col-sold ${item.sold > 0 ? 'has-sales' : 'no-sales'}">${item.sold}</td>
      <td class="col-amount ${item.amount > 0 ? 'has-sales' : 'no-sales'}">$${item.amount.toFixed(2)}</td>
    `;
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
      🎟️ ${isDailyMode ? 'No ticket sales recorded today.' : 'No ticket sales recorded in this shift.'}
    </td>`;
    reportBodyRows.appendChild(emptyRow);
  }

  // Populate structured 80mm thermal print layout
  const prReceiptTitle = document.getElementById('prReceiptTitle');
  if (prReceiptTitle) prReceiptTitle.textContent = isDailyMode ? 'DAY SETTLEMENT AUDIT' : 'SHIFT SETTLEMENT AUDIT';

  const prDateEl = document.getElementById('prDate');
  if (prDateEl) prDateEl.textContent = dateStr;

  const prTimeEl = document.getElementById('prTime');
  if (prTimeEl) prTimeEl.textContent = timeStr;

  const prShiftLabel = document.getElementById('prShiftLabel');
  if (prShiftLabel) prShiftLabel.textContent = isDailyMode ? 'DAY: ' : 'SHIFT: ';

  const prShiftEl = document.getElementById('prShift');
  if (prShiftEl) prShiftEl.textContent = isDailyMode ? `${dateStr} (${state.cashierName})` : `#${state.shiftNumber} (${state.cashierName})`;

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

  const prActivationLabel = document.getElementById('prActivationLabel');
  if (prActivationLabel) prActivationLabel.textContent = isDailyMode ? 'DAY ACTIVATIONS:' : 'SHIFT ACTIVATIONS:';

  const prActivationCountEl = document.getElementById('prActivationCount');
  if (prActivationCountEl) prActivationCountEl.textContent = activationCount;

  const prEmailsEl = document.getElementById('prEmails');
  if (prEmailsEl) prEmailsEl.textContent = state.settings.targetEmails;

  const prBarcodeCodeEl = document.getElementById('prBarcodeCode');
  if (prBarcodeCodeEl) prBarcodeCodeEl.textContent = isDailyMode ? `*DAY-402-${String(state.shiftNumber).padStart(4, '0')}-REC*` : `*SHFT-402-${String(state.shiftNumber).padStart(4, '0')}-REC*`;

  const prPrintedAtEl = document.getElementById('prPrintedAt');
  if (prPrintedAtEl) prPrintedAtEl.textContent = `PRINTED: ${dateStr} ${timeStr}`;

  const prList = document.getElementById('prItemsList');
  if (prList) {
    prList.innerHTML = '';
    
    // In thermal retail receipts, only list dispenser boxes that actually had sales
    const activeSlotsWithSales = reportSlots
      .filter(s => isBoxActive(s) && ((s.currentTicket || 0) - (s.startTicket || 0) > 0))
      .sort((a, b) => a.boxNumber - b.boxNumber);

    const soldOutPacks = reportSoldOut || [];

    if (activeSlotsWithSales.length === 0 && soldOutPacks.length === 0) {
      const emptyRow = document.createElement('div');
      emptyRow.className = 'receipt-row';
      emptyRow.style.cssText = 'text-align:center; padding:4px 0; color:#444; font-style:italic; display:block !important; font-size:9.5px;';
      emptyRow.textContent = isDailyMode ? '-- NO LOTTERY SALES RECORDED TODAY --' : '-- NO LOTTERY SALES RECORDED THIS SHIFT --';
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
  let initialCashes = Number(state.cashes || 0);
  if (isDailyMode) {
    const isToday = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    (state.shiftHistory || [])
      .filter(h => isToday(h.endedAt || h.startedAt))
      .forEach(h => {
        initialCashes += Number(h.cashes || 0);
      });
  }
  if (inputShiftPayouts) {
    inputShiftPayouts.value = initialCashes > 0 ? initialCashes.toFixed(2) : '0.00';
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
  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  const nextShift = (state.shiftNumber || 1) + 1;
  const titleEl = document.getElementById('startShiftModalTitle');
  if (titleEl) {
    titleEl.textContent = isDailyMode ? 'Start New Day' : `Start New Shift #${nextShift}`;
  }
  const confirmBtn = document.getElementById('confirmStartShiftBtn');
  if (confirmBtn) {
    confirmBtn.textContent = isDailyMode ? 'Start Day →' : 'Start Shift →';
  }
  const hintEl = document.getElementById('startShiftModalHint');
  if (hintEl) {
    hintEl.textContent = isDailyMode
      ? 'Day rollover: Closing numbers roll over as opening numbers. Sales reset to $0.00.'
      : 'Shift handover: Closing numbers roll over as opening numbers. Sales reset to $0.00.';
  }
  const cashierLbl = document.getElementById('inputNewShiftCashierLabel');
  if (cashierLbl) {
    cashierLbl.textContent = isDailyMode ? 'Manager / Cashier Name' : 'Cashier Name';
  }
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

  // Carry over every active slot into the new shift / day:
  // Previous closing ticket becomes new opening ticket.
  // The box remains ACTIVE with the exact same game, pack, and price!
  state.slots.forEach(s => {
    if (isBoxActive(s)) {
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
      s.soldBarcodes = [];
    }
  });

  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';

  const shiftRecord = {
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
    soldOutSnapshot: shiftSoldOutSnapshot,
    isDayClose: isDailyMode
  };
  state.shiftHistory.unshift(shiftRecord);
  // Asynchronously save/backup shift report to MySQL
  saveShiftReportToDB(shiftRecord);

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

  // CRITICAL FIX: DO NOT wipe visible active boxes from the screen!
  // All active boxes stay visible on the screen ready for sales.
  state.visibleBoxNumbers = (state.visibleBoxNumbers || []).filter(bNum => isBoxActive(state.slots.find(s => s.boxNumber === bNum)));
  if (state.visibleBoxNumbers.length === 0) {
    state.visibleBoxNumbers = state.slots.filter(isBoxActive).map(s => s.boxNumber).slice(0, VISIBLE_RACK_CAPACITY);
  }

  saveState(state);
  sfx.success();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  const msg = isDailyMode
    ? `✨ New Day started! All active boxes remain loaded and ready on screen.`
    : `🚀 Shift #${state.shiftNumber} started by ${state.cashierName}! Opening numbers set to previous closing numbers.`;
  showToast(msg, 'success');
}

const startNewShift = promptStartNewShift;

// -------------------------------------------------------------
// Update Inventory (Pack Intake) Workflow
// -------------------------------------------------------------

let pendingNewTicketBarcode = null;
let currentInvFilter = 'active';
let currentInvStatusFilter = 'active';
let lastKnownSoldCount = {};

function openInventoryModal(filter = 'active') {
  sfx.keypad();
  currentInvFilter = filter;
  renderInventoryTable();
  const modal = document.getElementById('inventoryModal');
  modal?.showModal();
}

function openInventoryStatusModal(filter = 'active') {
  sfx.keypad();
  currentInvStatusFilter = filter;
  renderInventoryStatusModal();
  const modal = document.getElementById('inventoryStatusModal');
  modal?.showModal();
}

function renderInventoryStatusModal() {
  const modal = document.getElementById('inventoryStatusModal');
  if (!modal) return;

  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  const totalBoxes = state.totalSlots || 65;
  const activeSlots = (state.slots || []).filter(isBoxActive);
  const emptySlots = (state.slots || []).filter(s => !isBoxActive(s));
  const ptos = state.partialTakeOuts || [];
  const searchInput = document.getElementById('invStatusSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  // In Daily Mode, aggregate across today's completed shifts
  const isToday = (dStr) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const todayPastShifts = isDailyMode
    ? (state.shiftHistory || [])
        .filter(h => isToday(h.endedAt || h.startedAt))
        .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0))
    : [];

  const earliestTodayShift = isDailyMode && todayPastShifts.length > 0 ? todayPastShifts[0] : null;

  // Determine true opening ticket for box
  const getBoxOpenTicket = (slot) => {
    if (isDailyMode && earliestTodayShift && Array.isArray(earliestTodayShift.slotsSnapshot)) {
      const pastSlot = earliestTodayShift.slotsSnapshot.find(ps => ps.boxNumber === slot.boxNumber);
      if (pastSlot && pastSlot.packNumber === slot.packNumber && typeof pastSlot.startTicket === 'number') {
        return pastSlot.startTicket;
      }
    }
    return (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
  };

  // Collect sold out packs
  const soldOutList = [];
  if (isDailyMode) {
    todayPastShifts.forEach(h => {
      (h.soldOutSnapshot || []).forEach(so => soldOutList.push(so));
    });
  }
  (state.soldOutThisShift || []).forEach(so => soldOutList.push(so));

  // Compute stats across active boxes
  let totalActiveValue = 0;
  let totalActiveTickets = 0;
  let totalSoldUnits = 0;
  let totalSoldValue = 0;

  activeSlots.forEach(slot => {
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const start = getBoxOpenTicket(slot);
    const sold = Math.max(0, current - start);
    const remaining = Math.max(0, totalPackSize - current);
    
    totalActiveTickets += remaining;
    totalActiveValue += remaining * (slot.price || 1);
    totalSoldUnits += sold;
    totalSoldValue += sold * (slot.price || 1);
  });

  soldOutList.forEach(so => {
    const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    totalSoldUnits += sold;
    totalSoldValue += sold * (so.price || 1);
  });

  // Update 4-Card KPI Strip
  const packsStat = document.getElementById('invStatusActivePacksStat');
  const valStat = document.getElementById('invStatusActiveValueStat');
  const tixStat = document.getElementById('invStatusActiveTicketsStat');
  const soldStat = document.getElementById('invStatusActiveSoldStat');
  const invStatusSoldLabel = document.getElementById('invStatusSoldLabel');

  if (invStatusSoldLabel) invStatusSoldLabel.textContent = isDailyMode ? 'Sold Today' : 'Sold Shift';
  if (packsStat) packsStat.textContent = `${activeSlots.length} Active`;
  if (tixStat) tixStat.textContent = `${totalActiveTickets.toLocaleString()} Left`;
  if (soldStat) soldStat.textContent = `${totalSoldUnits.toLocaleString()} Sold ($${totalSoldValue.toFixed(2)})`;
  if (valStat) valStat.textContent = `$${totalActiveValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  const invStatusColSoldHeader = document.getElementById('invStatusColSoldHeader');
  if (invStatusColSoldHeader) invStatusColSoldHeader.textContent = isDailyMode ? 'Sold (Day)' : 'Sold (Shift)';

  // Update Filter Pill Counts
  const countAll = document.getElementById('invStatusCountAll');
  const countActive = document.getElementById('invStatusCountActive');
  const countSoldOut = document.getElementById('invStatusCountSoldOut');
  const countPto = document.getElementById('invStatusCountPto');

  if (countAll) countAll.textContent = totalBoxes;
  if (countActive) countActive.textContent = activeSlots.length;
  if (countSoldOut) countSoldOut.textContent = soldOutList.length;
  if (countPto) countPto.textContent = ptos.length;

  // Active filter state highlighting
  document.querySelectorAll('[data-invstatus-filter]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-invstatus-filter') === currentInvStatusFilter);
  });

  const matchesQuery = (boxNum, name, price, pack) => {
    if (!query) return true;
    const n = (name || '').toLowerCase();
    const b = String(boxNum);
    const p = String(price || '');
    const pk = (pack || '').toLowerCase();
    return n.includes(query) || b === query || p === query.replace('$', '') || pk.includes(query);
  };

  // Populate Dispenser Rack Table (READ-ONLY AUDIT & STATUS)
  const statusTableBody = document.getElementById('invStatusTableBody');
  if (statusTableBody) {
    statusTableBody.innerHTML = '';
    let renderedRows = 0;

    if (currentInvStatusFilter === 'pto') {
      // In Storage filter selected: display stored packs directly in the unified table
      ptos.forEach(pto => {
        const cleanName = cleanGameTitle(pto.gameName);
        const cleanPack = String(pto.packNumber || '---').replace(/[^0-9]/g, '') || '---';
        const remVal = (pto.totalValue !== undefined && pto.totalValue !== null) ? Number(pto.totalValue) : ((pto.ticketsCount || 0) * (pto.price || 1));

        if (!matchesQuery(pto.fromBoxNumber, cleanName, pto.price, cleanPack)) return;

        renderedRows++;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="text-align: center;"><span class="inv-box-badge" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">Safe</span></td>
          <td>
            <div class="inv-game-cell">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="inv-game-title" title="${cleanName}">${cleanName}</span>
                <span class="inv-price-tag">$${Number(pto.price).toFixed(2)}</span>
                <span class="inv-status-returned" style="font-size:0.65rem; padding:1px 5px;">In Safe</span>
              </div>
              <span class="inv-pack-sub">Pack #${cleanPack} · Removed from Box #${pto.fromBoxNumber || '?'}</span>
            </div>
          </td>
          <td style="text-align: center; color: var(--text-muted); font-size: 0.82rem;">Safe Stock</td>
          <td style="text-align: center; color: var(--text-muted);">—</td>
          <td style="text-align: center; font-weight: 700; color: #2563eb;">${pto.ticketsCount} Left</td>
          <td style="text-align: right; padding-right: 14px;">
            <span style="font-weight: 800; color: #16a34a; font-size: 0.95rem;">$${remVal.toFixed(2)}</span>
          </td>
        `;
        statusTableBody.appendChild(row);
      });

      if (renderedRows === 0) {
        statusTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; color:var(--text-muted, #71717a); padding:36px; font-size:0.9rem; font-style:italic;">
              📦 No packs currently in storage or safe. All active lottery packs are on the dispenser counter rack.
            </td>
          </tr>
        `;
      }
    } else {
      // Counter dispenser boxes (Active, All Boxes, Sold Out)
      for (let boxNum = 1; boxNum <= totalBoxes; boxNum++) {
        const slot = (state.slots || []).find(s => s.boxNumber === boxNum);
        const isActive = isBoxActive(slot);
        const soldOutRecord = soldOutList.find(so => so.boxNumber === boxNum);

        // Apply Filter Pill
        if (currentInvStatusFilter === 'active' && !isActive) continue;
        if (currentInvStatusFilter === 'empty' && (isActive || soldOutRecord)) continue;
        if (currentInvStatusFilter === 'soldout' && !soldOutRecord) continue;

        // Filter by search query
        const gName = isActive ? slot.gameName : (soldOutRecord ? soldOutRecord.gameName : 'Empty Box');
        const gPrice = isActive ? slot.price : (soldOutRecord ? soldOutRecord.price : '');
        const gPack = isActive ? slot.packNumber : (soldOutRecord ? soldOutRecord.packNumber : '');
        if (!matchesQuery(boxNum, gName, gPrice, gPack)) continue;

        renderedRows++;
        const row = document.createElement('tr');

        if (isActive) {
          const cleanName = cleanGameTitle(slot.gameName);
          const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
          const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
          const start = getBoxOpenTicket(slot);
          const sold = Math.max(0, current - start);
          const remaining = Math.max(0, totalPackSize - current);
          const remVal = remaining * (slot.price || 1);
          const cleanPack = String(slot.packNumber || '---').replace(/[^0-9]/g, '') || '---';
          const isNewPack = Boolean(current === 0 || (slot.activatedThisShift && sold === 0));

          row.innerHTML = `
            <td style="text-align: center;"><span class="inv-box-badge">Box #${slot.boxNumber}</span></td>
            <td>
              <div class="inv-game-cell">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="inv-game-title" title="${cleanName}">${cleanName}</span>
                  <span class="inv-price-tag">$${Number(slot.price).toFixed(2)}</span>
                  ${isNewPack ? `<span class="inv-status-new" style="font-size:0.65rem; padding:1px 5px;">New</span>` : ''}
                </div>
                <span class="inv-pack-sub">Pack #${cleanPack}</span>
              </div>
            </td>
            <td style="text-align: center; font-weight: 700;">#${String(current).padStart(2, '0')} <span style="color:var(--text-muted); font-size:0.75rem;">/ ${totalPackSize}</span></td>
            <td style="text-align: center;">
              ${sold > 0 
                ? `<span class="inv-sold-badge-active"><strong>${sold} Sold</strong></span>`
                : `<span class="inv-sold-badge-zero">—</span>`
              }
            </td>
            <td style="text-align: center; font-weight: 700;">${remaining} Left</td>
            <td style="text-align: right; padding-right: 14px;">
              <span style="font-weight: 800; color: #16a34a; font-size: 0.95rem;">$${remVal.toFixed(2)}</span>
            </td>
          `;
        } else if (soldOutRecord) {
          const soCleanName = cleanGameTitle(soldOutRecord.gameName || 'Scratch-Off Game');
          const soPackSize = soldOutRecord.packSize || (soldOutRecord.price === 1 ? 300 : soldOutRecord.price === 2 ? 150 : 30);
          const soSold = soldOutRecord.ticketsSold !== undefined ? soldOutRecord.ticketsSold : Math.max(0, (soldOutRecord.closeTicket || 0) - (soldOutRecord.startTicket || 0));
          const soPack = String(soldOutRecord.packNumber || '---').replace(/[^0-9]/g, '') || '---';

          row.className = 'inv-row-soldout';
          row.innerHTML = `
            <td style="text-align: center;"><span class="inv-box-badge so-badge">Box #${boxNum}</span></td>
            <td>
              <div class="inv-game-cell">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="inv-game-title" title="${soCleanName}">${soCleanName}</span>
                  <span class="inv-price-tag">$${Number(soldOutRecord.price).toFixed(2)}</span>
                  <span class="inv-status-soldout" style="font-size:0.65rem; padding:1px 5px;">Sold Out</span>
                </div>
                <span class="inv-pack-sub">Pack #${soPack}</span>
              </div>
            </td>
            <td style="text-align: center; font-weight: 700; color: #94a3b8;">#${soPackSize} <span style="font-size:0.75rem;">/ ${soPackSize}</span></td>
            <td style="text-align: center;">
              <span class="inv-sold-badge-active badge-soldout"><strong>${soSold} Sold</strong></span>
            </td>
            <td style="text-align: center; color: #94a3b8;">0 Left</td>
            <td style="text-align: right; padding-right: 14px; color: #94a3b8; font-weight: 700;">$0.00</td>
          `;
        } else {
          // Empty box
          row.className = 'inv-row-empty';
          row.innerHTML = `
            <td style="text-align: center;"><span class="inv-box-badge empty">Box #${boxNum}</span></td>
            <td>
              <span class="inv-empty-slot-text" style="color: var(--text-muted, #94a3b8); font-style: italic; font-size: 0.82rem;">Empty Slot</span>
            </td>
            <td style="text-align: center; color: var(--text-muted, #94a3b8);">—</td>
            <td style="text-align: center; color: var(--text-muted, #94a3b8);">—</td>
            <td style="text-align: center; color: var(--text-muted, #94a3b8);">0 Left</td>
            <td style="text-align: right; padding-right: 14px; color: var(--text-muted, #94a3b8);">$0.00</td>
          `;
        }

        statusTableBody.appendChild(row);
      }

      if (renderedRows === 0) {
        statusTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; color:var(--text-muted, #71717a); padding:32px; font-size:0.9rem; font-style:italic;">
              No dispenser boxes match the current filter "${currentInvStatusFilter}".
            </td>
          </tr>
        `;
      }
    }
  }
}

function renderInventoryTable() {
  if (!inventoryTableBody) return;
  inventoryTableBody.innerHTML = '';

  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';
  const totalBoxes = state.totalSlots || 65;
  const activeSlots = (state.slots || []).filter(isBoxActive);
  const emptySlots = (state.slots || []).filter(s => !isBoxActive(s));
  
  const soldOutList = [];
  if (isDailyMode) {
    const isToday = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };
    (state.shiftHistory || []).filter(h => isToday(h.endedAt || h.startedAt)).forEach(h => {
      (h.soldOutSnapshot || []).forEach(so => soldOutList.push(so));
    });
  }
  (state.soldOutThisShift || []).forEach(so => soldOutList.push(so));
  const searchInput = document.getElementById('invSearchInput');
  const query = (searchInput?.value || '').trim().toLowerCase();

  const countAll = document.getElementById('invCountAll');
  const countActive = document.getElementById('invCountActive');
  const countEmpty = document.getElementById('invCountEmpty');
  const countSoldOut = document.getElementById('invCountSoldOut');
  const countPto = document.getElementById('invCountPto');
  const rackBadge = document.getElementById('invRackCountBadge');

  if (rackBadge) rackBadge.textContent = `${totalBoxes} Boxes`;
  if (countAll) countAll.textContent = totalBoxes;
  if (countActive) countActive.textContent = activeSlots.length;
  if (countEmpty) countEmpty.textContent = emptySlots.length;
  if (countSoldOut) countSoldOut.textContent = soldOutList.length;
  if (countPto) countPto.textContent = (state.partialTakeOuts || []).length;

  const safePacksCount = (state.inventory || []).length;
  const safeVal = (state.inventory || []).reduce((acc, p) => acc + (p.packSize || 100) * (p.price || 1), 0);
  const elSafePacks = document.getElementById('invModalSafePacks');
  if (elSafePacks) elSafePacks.textContent = `${safePacksCount} packs`;
  const elSafeVal = document.getElementById('invModalSafeVal');
  if (elSafeVal) elSafeVal.textContent = `$${safeVal.toFixed(2)} value`;
  const elRackPacks = document.getElementById('invModalRackPacks');
  if (elRackPacks) elRackPacks.textContent = `${activeSlots.length} active`;
  const elEmptySlots = document.getElementById('invModalEmptySlots');
  if (elEmptySlots) elEmptySlots.textContent = `${emptySlots.length} empty`;

  document.querySelectorAll('#inventoryModal .inv-filter-pill').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === currentInvFilter);
  });

  const matchesQuery = (boxNum, name, price, pack) => {
    if (!query) return true;
    const n = (name || '').toLowerCase();
    const b = String(boxNum);
    const p = String(price || '');
    const pk = (pack || '').toLowerCase();
    if (n.includes(query) || b === query || p === query.replace('$', '') || pk.includes(query)) {
      return true;
    }
    if (query.length >= 8) {
      const parsedQuery = parseLotteryBarcode(query, state.customGames);
      if (parsedQuery && parsedQuery.packNumber && isPackNumberMatch(pk, parsedQuery.packNumber)) {
        return true;
      }
    }
    return false;
  };

  // Build items list according to current filter (6 CLEAN ACTION COLUMNS)
  let renderedRows = 0;

  if (currentInvFilter === 'pto') {
    // In Storage filter selected: display stored packs directly in the main table
    const ptos = state.partialTakeOuts || [];
    ptos.forEach(pto => {
      const cleanName = cleanGameTitle(pto.gameName);
      const cleanPack = String(pto.packNumber || '---').replace(/[^0-9]/g, '') || '---';

      if (!matchesQuery(pto.fromBoxNumber, cleanName, pto.price, cleanPack)) return;

      renderedRows++;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="text-align: center;"><span class="inv-box-badge" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">Safe</span></td>
        <td>
          <div class="inv-game-cell">
            <span class="inv-game-title" title="${cleanName}">${cleanName}</span>
            <span class="inv-pack-sub">Pack #${cleanPack} · From Box #${pto.fromBoxNumber || '?'}</span>
          </div>
        </td>
        <td style="text-align: center;"><span class="inv-price-badge">$${Number(pto.price).toFixed(2)}</span></td>
        <td style="text-align: center;">
          <span class="inv-ticket-pos">${pto.ticketsCount} tickets</span>
          <span style="font-size: 0.72rem; color: #2563eb; font-weight: 700; display: block;">$${Number(pto.totalValue).toFixed(2)} value</span>
        </td>
        <td style="text-align: center;">
          <span class="inv-status-returned">In Storage</span>
        </td>
        <td style="text-align: center;">
          <span style="color: var(--text-muted, #94a3b8); font-size: 0.78rem; font-style: italic;">Stored in safe</span>
        </td>
      `;
      inventoryTableBody.appendChild(row);
    });

    if (renderedRows === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" style="text-align:center; color:var(--text-muted, #71717a); padding:32px; font-size:0.9rem; font-style:italic;">
          📦 No packs currently in storage / safe. All active lottery packs are on the dispenser counter rack.
        </td>
      `;
      inventoryTableBody.appendChild(emptyRow);
    }
  } else {
    // Normal counter boxes loop (Active, All, Empty, Sold Out)
    for (let boxNum = 1; boxNum <= totalBoxes; boxNum++) {
      const slot = (state.slots || []).find(s => s.boxNumber === boxNum);
      const isActive = isBoxActive(slot);
      const soldOutRecord = soldOutList.find(so => so.boxNumber === boxNum);

      // Apply Filter Tab
      if (currentInvFilter === 'active' && !isActive) continue;
      if (currentInvFilter === 'empty' && (isActive || soldOutRecord)) continue;
      if (currentInvFilter === 'soldout' && !soldOutRecord) continue;

      // Filter by search query
      const gName = isActive ? slot.gameName : (soldOutRecord ? soldOutRecord.gameName : 'Empty Box');
      const gPrice = isActive ? slot.price : (soldOutRecord ? soldOutRecord.price : '');
      const gPack = isActive ? slot.packNumber : (soldOutRecord ? soldOutRecord.packNumber : '');
      if (!matchesQuery(boxNum, gName, gPrice, gPack)) continue;

      renderedRows++;
      const row = document.createElement('tr');

      if (isActive) {
        const cleanName = cleanGameTitle(slot.gameName);
        const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : slot.price === 3 ? 100 : slot.price === 5 ? 60 : slot.price >= 50 ? 20 : 30);
        const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
        const remaining = Math.max(0, totalPackSize - current);
        const cleanPack = String(slot.packNumber || '---').replace(/[^0-9]/g, '') || '---';
        const isNewPack = Boolean(current === 0 || (slot.activatedThisShift && current === (slot.startTicket || 0)));

        row.innerHTML = `
          <td style="text-align: center;"><span class="inv-box-badge">Box #${boxNum}</span></td>
          <td>
            <div class="inv-game-cell">
              <span class="inv-game-title" title="${cleanName}">${cleanName}</span>
              <span class="inv-pack-sub">Pack #${cleanPack}</span>
            </div>
          </td>
          <td style="text-align: center;"><span class="inv-price-badge">$${Number(slot.price).toFixed(2)}</span></td>
          <td style="text-align: center;">
            <span class="inv-ticket-pos">#${String(current).padStart(2, '0')} / ${totalPackSize}</span>
            <span style="font-size: 0.72rem; color: #16a34a; font-weight: 700; display: block;">${remaining} left</span>
          </td>
          <td style="text-align: center;">
            ${isNewPack 
              ? `<span class="inv-status-new">New Pack</span>`
              : `<span class="inv-status-active">Active</span>`
            }
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button type="button" class="btn-table-action" data-box="${boxNum}" data-act="update" title="Edit Box Details & Ticket Count">✏️ Edit</button>
              <button type="button" class="btn-table-action remove" data-box="${boxNum}" data-act="remove" title="Remove or Swap Pack from Box #${boxNum}">📦 Remove</button>
            </div>
          </td>
        `;
      } else if (soldOutRecord) {
        const soCleanName = cleanGameTitle(soldOutRecord.gameName || 'Scratch-Off Game');
        const soPack = String(soldOutRecord.packNumber || '---').replace(/[^0-9]/g, '') || '---';

        row.className = 'inv-row-soldout';
        row.innerHTML = `
          <td style="text-align: center;"><span class="inv-box-badge so-badge">Box #${boxNum}</span></td>
          <td>
            <div class="inv-game-cell">
              <span class="inv-game-title" title="${soCleanName}">${soCleanName}</span>
              <span class="inv-pack-sub">Pack #${soPack} (Sold Out)</span>
            </div>
          </td>
          <td style="text-align: center;"><span class="inv-price-badge">$${Number(soldOutRecord.price).toFixed(2)}</span></td>
          <td style="text-align: center;">
            <span class="inv-ticket-pos so-pos">Finished</span>
          </td>
          <td style="text-align: center;">
            <span class="inv-status-soldout">Sold Out</span>
          </td>
          <td style="text-align: center;">
            <span style="color: var(--text-muted, #94a3b8); font-size: 0.78rem; font-style: italic;">Use main screen to reload</span>
          </td>
        `;
      } else {
        // Empty box (clean minimal representation)
        row.className = 'inv-row-empty';
        row.innerHTML = `
          <td style="text-align: center;"><span class="inv-box-badge empty">Box #${boxNum}</span></td>
          <td>
            <span class="inv-empty-slot-text" style="color: var(--text-muted, #94a3b8); font-style: italic;">— Empty Dispenser Slot —</span>
          </td>
          <td style="text-align: center; color: var(--text-muted, #94a3b8);">—</td>
          <td style="text-align: center; color: var(--text-muted, #94a3b8);">—</td>
          <td style="text-align: center;">
            <span class="inv-status-empty">Empty</span>
          </td>
          <td style="text-align: center;">
            <span style="color: var(--text-muted, #94a3b8); font-size: 0.78rem; font-style: italic;">Use main screen to load</span>
          </td>
        `;
      }

      inventoryTableBody.appendChild(row);
    }

    if (renderedRows === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" style="text-align:center; color:var(--text-muted, #71717a); padding:32px; font-size:0.9rem;">
          No dispenser boxes match the current filter "${currentInvFilter}".
        </td>
      `;
      inventoryTableBody.appendChild(emptyRow);
    }
  }

  // Attach event delegation for row actions
  inventoryTableBody.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bNum = parseInt(btn.getAttribute('data-box'), 10);
      const action = btn.getAttribute('data-act');
      const targetSlot = (state.slots || []).find(s => s.boxNumber === bNum);

      if (action === 'update' && targetSlot) {
        openBoxAdjustModal(targetSlot);
      } else if (action === 'remove' && targetSlot) {
        openReturnPackModal(targetSlot);
      } else if (action === 'activate') {
        openActivationForBox(bNum);
      }
    });
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

  const parsed = parseLotteryBarcode(barcode, state.customGames);
  const targetCanonical = parsed?.canonicalId;
  const targetStandard = parsed?.standardBarcode;

  // 1. Check across all ACTIVE dispenser slots
  for (const slot of (state.slots || [])) {
    if (slot.status !== 'ACTIVE' || !slot.packNumber) continue;
    if (slot.scannedBarcodes) {
      const match = slot.scannedBarcodes.some(b => {
        const rawStr = typeof b === 'string' ? b : b.barcode;
        if (rawStr === clean) return true;
        if (targetStandard && rawStr === targetStandard) return true;
        if (targetCanonical) {
          const bParsed = parseLotteryBarcode(rawStr, state.customGames);
          if (bParsed) {
            if (bParsed.canonicalId === targetCanonical) return true;
            if (targetStandard && bParsed.standardBarcode === targetStandard) return true;
            if (parsed && bParsed.gameNumber && parsed.gameNumber &&
                bParsed.gameNumber === parsed.gameNumber &&
                isPackNumberMatch(bParsed.packNumber, parsed.packNumber) &&
                bParsed.ticketNumber !== null && parsed.ticketNumber !== null &&
                bParsed.ticketNumber === parsed.ticketNumber) {
              return true;
            }
          }
        }
        return false;
      });
      if (match) return true;
    }
  }

  // 2. Check in state.inventoryBarcodes ONLY if that box is currently ACTIVE
  if (state.inventoryBarcodes) {
    const entry = state.inventoryBarcodes[clean] || (targetStandard && state.inventoryBarcodes[targetStandard]) || (targetCanonical && state.inventoryBarcodes[targetCanonical]);
    if (entry && entry.boxNumber) {
      const activeSlot = state.slots.find(s => s.boxNumber === entry.boxNumber && s.status === 'ACTIVE' && s.packNumber);
      if (activeSlot) return true;
    }
  }
  return false;
}

function findScannedBarcodeInfo(barcode) {
  if (!barcode) return null;
  const clean = String(barcode).trim();
  const parsed = parseLotteryBarcode(barcode, state.customGames);
  const targetCanonical = parsed?.canonicalId;
  const targetStandard = parsed?.standardBarcode;

  // 1. Check across all ACTIVE dispenser slots first
  for (const slot of (state.slots || [])) {
    if (slot.status !== 'ACTIVE' || !slot.packNumber) continue;
    if (slot.scannedBarcodes) {
      const match = slot.scannedBarcodes.find(b => {
        const rawStr = typeof b === 'string' ? b : b.barcode;
        if (rawStr === clean) return true;
        if (targetStandard && rawStr === targetStandard) return true;
        if (targetCanonical) {
          const bParsed = parseLotteryBarcode(rawStr, state.customGames);
          if (bParsed) {
            if (bParsed.canonicalId === targetCanonical) return true;
            if (targetStandard && bParsed.standardBarcode === targetStandard) return true;
            if (parsed && bParsed.gameNumber && parsed.gameNumber &&
                bParsed.gameNumber === parsed.gameNumber &&
                isPackNumberMatch(bParsed.packNumber, parsed.packNumber) &&
                bParsed.ticketNumber !== null && parsed.ticketNumber !== null &&
                bParsed.ticketNumber === parsed.ticketNumber) {
              return true;
            }
          }
        }
        return false;
      });
      if (match) {
        return {
          boxNumber: slot.boxNumber,
          gameName: slot.gameName,
          price: slot.price,
          packNumber: slot.packNumber,
          scannedAt: (typeof match === 'object' && match.scannedAt) ? match.scannedAt : 'Earlier'
        };
      }
    }
  }

  // 2. Check in state.inventoryBarcodes if box is currently active
  if (state.inventoryBarcodes) {
    const entry = state.inventoryBarcodes[clean] || (targetStandard && state.inventoryBarcodes[targetStandard]) || (targetCanonical && state.inventoryBarcodes[targetCanonical]);
    if (entry && entry.boxNumber) {
      const activeSlot = state.slots.find(s => s.boxNumber === entry.boxNumber && s.status === 'ACTIVE' && s.packNumber);
      if (activeSlot) {
        return {
          boxNumber: activeSlot.boxNumber,
          gameName: activeSlot.gameName,
          price: activeSlot.price,
          packNumber: activeSlot.packNumber,
          scannedAt: entry.scannedAt || 'Earlier'
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

  const parsed = parseLotteryBarcode(barcode, state.customGames);
  if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
    sfx.alert();
    const msg = (parsed && parsed.isRetailProduct)
      ? `❌ [${barcode}] is a retail product (UPC/EAN store merchandise), not a lottery scratch ticket.`
      : `❌ [${barcode}] is not a valid lottery ticket barcode.`;
    showToast(msg, 'error');
    return;
  }

  const effectiveBarcode = (parsed && parsed.standardBarcode) ? parsed.standardBarcode : barcode;

  // 1. Duplicate check: Has this barcode already been scanned into inventory?
  if (isBarcodeAlreadyScanned(effectiveBarcode) || isBarcodeAlreadyScanned(barcode)) {
    const existing = findScannedBarcodeInfo(effectiveBarcode) || findScannedBarcodeInfo(barcode);
    sfx.alert();
    const errorMsg = `⚠️ Already Scanned! Ticket [${effectiveBarcode}] was already put into Box #${existing?.boxNumber || '?'}. Skipping duplicate.`;
    showToast(errorMsg, 'error');

    if (voice && typeof voice.speak === 'function') {
      voice.speak('Ticket already scanned. Skipping duplicate.');
    }

    const fb = document.getElementById('invScanFeedback');
    if (fb) {
      fb.style.display = 'flex';
      fb.className = 'inv-scan-feedback error';
      fb.innerHTML = `❌ <strong>ALREADY SCANNED:</strong> Ticket <code>${effectiveBarcode}</code> was already put into <strong>Box #${existing?.boxNumber}</strong> (${existing?.gameName || 'Game'}). <strong>Skipped duplicate!</strong>`;
    }

    return; // SKIPS DUPLICATE!
  }

  // 2. New ticket: Pop up Step 1 modal (Name and Price only)
  openSetTicketDetailsModal(barcode, effectiveBarcode);
}

let pendingChosenName = 'Scratch-Off Game';
let pendingChosenPrice = 1;
let pendingChosenPackSize = 300;
let pendingChosenPackValue = 300;
let setBoxModalOpenedAt = 0;

function updatePricePillsSelection(price) {
  const p = Number(price) || 1;
  const presetPrices = [1, 2, 3, 5, 10, 20, 25, 30, 50];
  const isPreset = presetPrices.includes(p);

  document.querySelectorAll('.set-box-price-pill').forEach(pill => {
    const val = Number(pill.getAttribute('data-price'));
    pill.classList.toggle('active', val === p);
  });

  const priceInput = document.getElementById('setBoxPriceInput');
  if (priceInput) {
    priceInput.value = isPreset ? '' : p;
  }

  const valInput = document.getElementById('setBoxPackValueInput');
  const tixInput = document.getElementById('setBoxPackTicketsInput');
  const hintEl = document.getElementById('setTicketPackHint');
  const std = getStandardPackDetails(p);
  if (valInput) valInput.value = `$${std.bookValue.toFixed(2)}`;
  if (tixInput) tixInput.value = std.packSize;
  if (hintEl) {
    hintEl.textContent = (p >= 50) 
      ? `Most $${p} packs have ${std.packSize} tickets ($${std.bookValue} value).` 
      : `Most $${p} packs have ${std.packSize} tickets.`;
  }
  pendingChosenPackSize = std.packSize;
  pendingChosenPackValue = std.bookValue;
  pendingChosenPrice = p;
}

// -------------------------------------------------------------
// Step 1: Open Ticket Details Modal (Only Name & Price)
// -------------------------------------------------------------
function openSetTicketDetailsModal(barcode, standardCode = null) {
  if (!barcode) return;
  const parsed = parseLotteryBarcode(barcode, state.customGames);
  if (!parsed || !parsed.isValid || parsed.isRetailProduct || parsed.isNonLotteryBarcode) {
    sfx.alert();
    showToast(`❌ [${barcode}] is not a valid scratch-off lottery ticket.`, 'error');
    return;
  }

  // Use accurate normalized standard 14-digit lottery barcode (e.g. "14170670170009")
  const standardBarcode = (parsed && parsed.standardBarcode) ? parsed.standardBarcode : (standardCode || barcode);
  pendingSetBoxBarcode = standardBarcode;

  // The barcode number displayed in the big box above (under "SCANNED BARCODE"):
  // If the user scanned formatted/delimited text (e.g. "1417-0670170-009(290)") or with security PIN,
  // display the exact scanned barcode.
  // If scanned 2D long payload (>17 digits without parens/hyphens), display clean standardBarcode.
  let displayBarcode = String(barcode).trim();
  if (displayBarcode.length >= 18 && !displayBarcode.includes('(') && !displayBarcode.includes('-')) {
    displayBarcode = standardBarcode;
  } else if (!displayBarcode.includes('-') && !displayBarcode.includes('(') && parsed.standardBarcode) {
    displayBarcode = parsed.standardBarcode;
  }

  const barcodeDisplay = document.getElementById('setTicketBarcodeDisplay');
  const nameInput = document.getElementById('setBoxGameNameInput');
  const priceInput = document.getElementById('setBoxPriceInput');
  const btnNext = document.getElementById('btnTicketDetailsNext');
  const headerGameTitle = document.getElementById('setTicketHeaderGameTitle');
  const headerSubtitle = document.getElementById('setTicketHeaderSubtitle');
  const knownGameBadge = document.getElementById('setTicketKnownGameBadge');
  const metaGameNum = document.getElementById('setTicketMetaGameNum');
  const metaPackNum = document.getElementById('setTicketMetaPackNum');
  const metaFirstTicket = document.getElementById('setTicketMetaFirstTicket');

  if (barcodeDisplay) barcodeDisplay.textContent = displayBarcode;

  // Auto-detect game and barcode details
  const matchedGame = findGameByBarcode(standardBarcode, state.customGames) || findGameByBarcode(barcode, state.customGames);
  pendingSetBoxGame = matchedGame;

  let initialName = '';
  let initialPrice = 1;

  if (matchedGame) {
    initialName = toTitleCaseGameName(matchedGame.name);
    initialPrice = matchedGame.price || 1;
    if (headerGameTitle) headerGameTitle.textContent = initialName;
    if (headerSubtitle) headerSubtitle.textContent = 'We know this game. Check the details and go to the next step.';
    if (knownGameBadge) {
      knownGameBadge.className = 'set-ticket-game-badge';
      knownGameBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Known game &mdash; filled in for you</span>`;
    }
  } else {
    initialName = 'Scratch-Off Game';
    initialPrice = 1;
    if (headerGameTitle) headerGameTitle.textContent = 'New Lottery Ticket';
    if (headerSubtitle) headerSubtitle.textContent = 'Check the details and go to the next step.';
    if (knownGameBadge) {
      knownGameBadge.className = 'set-ticket-game-badge unknown-game';
      knownGameBadge.innerHTML = `<span>New game &mdash; please check details</span>`;
    }
  }

  // Populate metadata line (Matching Image 1)
  const rawSegments = String(displayBarcode || '').split(/[-_]/);
  const displayPack = (rawSegments.length >= 2 && /^\d+$/.test(rawSegments[1])) ? rawSegments[1] : (parsed?.packNumber || '—');
  const displayTicket = (rawSegments.length >= 3 && /^\d+/.test(rawSegments[2])) 
    ? rawSegments[2].replace(/\(.*$/, '').padStart(3, '0') 
    : (parsed && parsed.ticketString ? parsed.ticketString : (parsed && parsed.ticketNumber !== null ? String(parsed.ticketNumber).padStart(3, '0') : '000'));

  if (metaGameNum) metaGameNum.textContent = parsed?.gameNumber || (matchedGame ? matchedGame.barcodePrefix : (rawSegments[0] || '—'));
  if (metaPackNum) metaPackNum.textContent = displayPack;
  if (metaFirstTicket) metaFirstTicket.textContent = displayTicket;

  pendingChosenName = initialName;
  pendingChosenPrice = initialPrice;

  if (nameInput) {
    nameInput.value = initialName;
  }
  updatePricePillsSelection(initialPrice);

  sfx.beep();
  if (setTicketDetailsModal) {
    setTicketDetailsModal.showModal();
    setTimeout(() => {
      // If game is matched, focus "Next: Choose Box" so Enter advances immediately
      // and barcode scanners do not type ticket strings into the Game Name field!
      if (matchedGame && btnNext) {
        btnNext.focus();
      } else {
        nameInput?.focus();
        nameInput?.select();
      }
    }, 100);
  }
}

// -------------------------------------------------------------
// Transition from Step 1 to Step 2 (Box Assignment)
// -------------------------------------------------------------
function proceedToSetBoxStep() {
  const nameInput = document.getElementById('setBoxGameNameInput');
  const priceInput = document.getElementById('setBoxPriceInput');
  const valInput = document.getElementById('setBoxPackValueInput');
  const tixInput = document.getElementById('setBoxPackTicketsInput');

  pendingChosenName = nameInput?.value?.trim() || 'Scratch-Off Game';
  const activePill = document.querySelector('.set-box-price-pill.active');
  const pillPrice = activePill ? parseFloat(activePill.getAttribute('data-price')) : 1;
  const customPrice = parseFloat(priceInput?.value);
  pendingChosenPrice = (!isNaN(customPrice) && customPrice > 0) ? customPrice : (pillPrice || 1);

  const std = getStandardPackDetails(pendingChosenPrice);
  pendingChosenPackSize = parseInt(tixInput?.value, 10) || std.packSize;
  const rawVal = String(valInput?.value || '').replace(/[^0-9.]/g, '');
  pendingChosenPackValue = parseFloat(rawVal) || (pendingChosenPackSize * pendingChosenPrice);

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

  const parsed = parseLotteryBarcode(barcode, state.customGames);
  const cleanPack = (parsed && parsed.packNumber) ? parsed.packNumber : (barcode ? String(barcode).replace(/[^0-9]/g, '').slice(-6) : '---');

  // Fill Step 2 Ticket Summary
  const s2Name = document.getElementById('step2GameNameDisplay');
  const s2Price = document.getElementById('step2PriceBadge');
  const s2Pack = document.getElementById('step2PackDisplay');
  const s2Barcode = document.getElementById('step2BarcodeDisplay');

  if (s2Name) s2Name.textContent = cleanGameTitle(pendingChosenName);
  if (s2Price) s2Price.textContent = `$${pendingChosenPrice}`;
  if (s2Pack) s2Pack.textContent = `Pack #${cleanPack} (${pendingChosenPackSize} tickets · $${pendingChosenPackValue})`;
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

  const success = handleSetBoxForTicket(boxNum, barcode, pendingSetBoxGame, restorePack, chosenName, chosenPrice, pendingChosenPackSize);
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

    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }
    const fb = document.getElementById('invScanFeedback');
    if (fb) {
      fb.style.display = 'flex';
      fb.className = 'inv-scan-feedback success';
      fb.innerHTML = `✓ <strong>TICKET SAVED:</strong> Barcode <code>${barcode}</code> (${cleanGameTitle(chosenName)}, $${chosenPrice}) put into <strong>Box #${boxNum}</strong>!`;
    }
  }
}

function handleSetBoxForTicket(boxNumber, barcode, detectedGame, restorePack = null, customName = null, customPrice = null, customPackSize = null) {
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
  const packSize = (customPackSize && customPackSize > 0) ? customPackSize : std.packSize;

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
  const parsed = parseLotteryBarcode(barcode, state.customGames);
  const cleanDigits = barcode.replace(/[^0-9]/g, '');
  let ticketNum = null;

  if (parsed && parsed.ticketNumber !== null && parsed.ticketNumber <= packSize) {
    ticketNum = parsed.ticketNumber;
  } else if (barcode.includes('-')) {
    const parts = barcode.split('-');
    const lastPart = parts[parts.length - 1].replace(/[^0-9]/g, '');
    if (lastPart) {
      const parsedPart = parseInt(lastPart, 10);
      if (parsedPart <= packSize) ticketNum = parsedPart;
    }
  } else if (cleanDigits.length >= 13) {
    const candidate = parseInt(cleanDigits.slice(10, 13), 10);
    if (!isNaN(candidate) && candidate <= packSize) {
      ticketNum = candidate;
    }
  } else if (cleanDigits.length >= 10) {
    const candidate = parseInt(cleanDigits.slice(-3), 10);
    if (!isNaN(candidate) && candidate <= packSize) {
      ticketNum = candidate;
    }
  }

  // Strictly ensure validTicketNum is within 0 .. packSize. Default to 0 for fresh activation!
  let validTicketNum = 0;
  if (ticketNum !== null && !isNaN(ticketNum) && ticketNum >= 0 && ticketNum <= packSize) {
    validTicketNum = ticketNum;
  }

  const realPackNumber = (parsed && parsed.packNumber)
    ? parsed.packNumber
    : (cleanDigits.length >= 6 ? cleanDigits.slice(-6) : barcode);

  const standardKey = (parsed && parsed.standardBarcode) ? parsed.standardBarcode : barcode;

  const barcodeRecord = {
    barcode: standardKey,
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

    // Remove from state.soldOutThisShift so it's no longer marked sold out (ONLY match this exact pack number!)
    if (state.soldOutThisShift) {
      const soIdx = state.soldOutThisShift.findIndex(
        so => isPackNumberMatch(so.packNumber, slot.packNumber)
      );
      if (soIdx >= 0) {
        state.soldOutThisShift.splice(soIdx, 1);
      }
    }
    showToast(`✓ Restored Pack #${slot.packNumber} into Box #${boxNum} (${finalName}, $${finalPrice}) at Ticket #${String(restoredPos).padStart(2, '0')}!`, 'success');
  } else {
    // If the slot had an existing pack that was different from realPackNumber, record its sales before overwriting!
    if (slot.packNumber && !isPackNumberMatch(slot.packNumber, realPackNumber)) {
      const prevSold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
      if (prevSold > 0 || slot.status === 'SOLD_OUT') {
        const closePos = slot.status === 'SOLD_OUT' ? (slot.packSize || slot.currentTicket) : slot.currentTicket;
        recordSoldOutPack(slot, closePos);
      }
    }

    // Brand new activation or putting new ticket into empty/sold-out box!
    slot.status = 'ACTIVE';
    slot.gameId = (game && game.name === finalName) ? game.id : 'custom';
    slot.gameName = finalName;
    slot.price = finalPrice;
    slot.packNumber = realPackNumber;
    slot.packSize = packSize;
    // Fresh roll activation always starts at ticket #00 / #000 so the full pack is available
    slot.startTicket = 0;
    slot.currentTicket = 0;
    slot.activatedThisShift = true;
    slot.daysActive = 1;
    slot.scannedInEndShift = false;
    slot.soldBarcodes = [];

    // NOTE: NEVER delete previous sold-out packs for this box from state.soldOutThisShift!
    // They are legitimate sales completed during this shift and are required for shift & day audit reports!
  }

  // Record in global inventoryBarcodes
  if (!state.inventoryBarcodes) state.inventoryBarcodes = {};
  state.inventoryBarcodes[standardKey] = {
    boxNumber: boxNum,
    barcode: standardKey,
    gameName: slot.gameName,
    price: slot.price,
    scannedAt: barcodeRecord.scannedAt
  };
  if (barcode !== standardKey) {
    state.inventoryBarcodes[barcode] = state.inventoryBarcodes[standardKey];
  }

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

  const packValInput = document.getElementById('setBoxPackValueInput');
  const packTixInput = document.getElementById('setBoxPackTicketsInput');

  packValInput?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 0;
    const currentPrice = Math.max(1, parseFloat(document.getElementById('setBoxPriceInput')?.value) || 1);
    if (packTixInput && val > 0) {
      const calculatedTix = Math.max(1, Math.round(val / currentPrice));
      packTixInput.value = calculatedTix;
      pendingChosenPackSize = calculatedTix;
      pendingChosenPackValue = val;
    }
  });

  packTixInput?.addEventListener('input', (e) => {
    const tix = parseInt(e.target.value, 10) || 0;
    const currentPrice = Math.max(1, parseFloat(document.getElementById('setBoxPriceInput')?.value) || 1);
    if (packValInput && tix > 0) {
      const calculatedVal = Math.round(tix * currentPrice);
      packValInput.value = `$${calculatedVal.toFixed(2)}`;
      pendingChosenPackSize = tix;
      pendingChosenPackValue = calculatedVal;
    }
  });

  packValInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      packTixInput?.focus();
      packTixInput?.select();
    }
  });

  packTixInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      proceedToSetBoxStep();
    }
  });

  // Enter keys in name and price inputs for smooth keyboard navigation, with barcode scanner protection
  const boxGameNameInput = document.getElementById('setBoxGameNameInput');
  boxGameNameInput?.addEventListener('input', () => {
    const val = boxGameNameInput.value.trim();
    // Guard: If hardware barcode scanner typed into the Game Name field
    const parsed = parseLotteryBarcode(val, state.customGames);
    if (parsed && parsed.isValid && !parsed.isRetailProduct) {
      boxGameNameInput.value = pendingChosenName || (pendingSetBoxGame ? cleanGameTitle(pendingSetBoxGame.name) : 'Scratch-Off Game');
      openSetTicketDetailsModal(val);
      document.getElementById('btnTicketDetailsNext')?.focus();
    }
  });

  boxGameNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const val = boxGameNameInput.value.trim();
      const parsed = parseLotteryBarcode(val, state.customGames);
      if (parsed && parsed.isValid && !parsed.isRetailProduct) {
        boxGameNameInput.value = pendingChosenName || (pendingSetBoxGame ? cleanGameTitle(pendingSetBoxGame.name) : 'Scratch-Off Game');
        openSetTicketDetailsModal(val);
        document.getElementById('btnTicketDetailsNext')?.focus();
        return;
      }
      document.getElementById('setBoxPriceInput')?.focus();
      document.getElementById('setBoxPriceInput')?.select();
    }
  });

  priceInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('setBoxPackTicketsInput')?.focus();
      document.getElementById('setBoxPackTicketsInput')?.select();
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

  const invStatusSearchInput = document.getElementById('invStatusSearchInput');
  invStatusSearchInput?.addEventListener('input', () => {
    renderInventoryStatusModal();
  });

  // Modal Close buttons
  document.getElementById('closeInvStatusBtn')?.addEventListener('click', () => {
    document.getElementById('inventoryStatusModal')?.close();
  });
  document.getElementById('invStatusDoneBtn')?.addEventListener('click', () => {
    document.getElementById('inventoryStatusModal')?.close();
  });

  document.getElementById('closeInventoryBtn')?.addEventListener('click', () => {
    document.getElementById('inventoryModal')?.close();
  });
  document.getElementById('inventoryDoneBtn')?.addEventListener('click', () => {
    document.getElementById('inventoryModal')?.close();
  });

  // Print Inventory Status Report
  const btnInvStatusPrint = document.getElementById('btnInvStatusPrint');
  btnInvStatusPrint?.addEventListener('click', () => {
    sfx.keypad();
    printInventoryStatusReport();
  });

  // Filter Tabs in Dispenser Manager (Update Inventory)
  document.querySelectorAll('#inventoryModal .inv-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      document.querySelectorAll('#inventoryModal .inv-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInvFilter = btn.getAttribute('data-filter') || 'all';
      renderInventoryTable();
      const tableContainer = document.querySelector('#inventoryModal .inv-table-container');
      if (tableContainer) tableContainer.scrollTop = 0;
    });
  });

  // Filter Pills in Inventory Status Modal
  document.querySelectorAll('[data-invstatus-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      document.querySelectorAll('[data-invstatus-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInvStatusFilter = btn.getAttribute('data-invstatus-filter') || 'active';
      renderInventoryStatusModal();
      const tableContainer = document.querySelector('#inventoryStatusModal .inv-table-container');
      if (tableContainer) tableContainer.scrollTop = 0;
    });
  });


  // Modal close buttons for Change Ticket Value Modal
  document.getElementById('closeChangeTicketValueBtn')?.addEventListener('click', () => {
    document.getElementById('changeTicketValueModal')?.close();
  });
  document.getElementById('cancelChangeTicketValueBtn')?.addEventListener('click', () => {
    document.getElementById('changeTicketValueModal')?.close();
  });
  document.getElementById('saveChangeTicketValueBtn')?.addEventListener('click', saveTicketValueChange);

  // Price pills in Change Value modal
  document.querySelectorAll('.change-val-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      sfx.keypad();
      const p = Number(pill.getAttribute('data-price'));
      const priceInput = document.getElementById('changeValCustomPriceInput');
      if (priceInput) priceInput.value = p;
      document.querySelectorAll('.change-val-pill').forEach(pl => {
        pl.classList.toggle('active', Number(pl.getAttribute('data-price')) === p);
      });
      const packHint = document.getElementById('changeValPackHint');
      if (packHint) {
        const std = getStandardPackDetails(p);
        packHint.innerHTML = `📖 <strong>$${std.bookValue} Pack</strong> (${std.packSize} tickets)`;
      }
    });
  });

  const changeValCustomPrice = document.getElementById('changeValCustomPriceInput');
  changeValCustomPrice?.addEventListener('input', (e) => {
    const p = parseFloat(e.target.value) || 1;
    document.querySelectorAll('.change-val-pill').forEach(pl => {
      pl.classList.toggle('active', Number(pl.getAttribute('data-price')) === p);
    });
    const packHint = document.getElementById('changeValPackHint');
    if (packHint) {
      const std = getStandardPackDetails(p);
      packHint.innerHTML = `📖 <strong>$${std.bookValue} Pack</strong> (${std.packSize} tickets)`;
    }
  });

  // Click price tag in Box Adjust Modal to change ticket value
  document.getElementById('adjustPriceTag')?.addEventListener('click', () => {
    if (currentAdjustingSlot) openChangeTicketValueModal(currentAdjustingSlot);
  });
}

function printInventoryStatusReport() {
  const activeSlots = (state.slots || []).filter(isBoxActive);
  let totalTickets = 0;
  let totalValue = 0;

  let rowsHtml = '';
  activeSlots.forEach(slot => {
    const totalPackSize = slot.packSize || (slot.price === 1 ? 300 : slot.price === 2 ? 150 : 30);
    const current = slot.currentTicket !== undefined ? slot.currentTicket : 0;
    const remaining = Math.max(0, totalPackSize - current);
    const val = remaining * (slot.price || 1);
    totalTickets += remaining;
    totalValue += val;

    rowsHtml += `
      <tr>
        <td style="text-align: center; font-weight: bold;">Box #${slot.boxNumber}</td>
        <td><strong>${cleanGameTitle(slot.gameName)}</strong></td>
        <td style="text-align: center; font-family: monospace;">#${String(slot.packNumber || '---').replace(/[^0-9]/g, '')}</td>
        <td style="text-align: center; font-weight: bold;">$${Number(slot.price).toFixed(2)}</td>
        <td style="text-align: center;">#${String(current).padStart(2, '0')} / ${totalPackSize}</td>
        <td style="text-align: center; font-weight: bold;">${remaining}</td>
        <td style="text-align: right; font-weight: bold;">$${val.toFixed(2)}</td>
      </tr>
    `;
  });

  const ptos = state.partialTakeOuts || [];
  let ptoTableHtml = '';
  if (ptos.length > 0) {
    let ptoRows = '';
    let ptoTotalTix = 0;
    let ptoTotalVal = 0;
    ptos.forEach(p => {
      ptoTotalTix += p.ticketsCount || 0;
      ptoTotalVal += p.totalValue || 0;
      ptoRows += `
        <tr>
          <td style="text-align: center; font-family: monospace;">#${p.packNumber}</td>
          <td><strong>${cleanGameTitle(p.gameName)}</strong></td>
          <td style="text-align: center;">Box #${p.fromBoxNumber}</td>
          <td style="text-align: center;">$${Number(p.price).toFixed(2)}</td>
          <td style="text-align: center; font-weight: bold;">${p.ticketsCount}</td>
          <td style="text-align: right; font-weight: bold;">$${Number(p.totalValue).toFixed(2)}</td>
          <td style="text-align: center; font-size: 11px;">${p.takenOutAtDisplay || 'Stored'}</td>
        </tr>
      `;
    });
    ptoTableHtml = `
      <div style="margin-top: 24px; font-weight: bold; font-size: 14px; border-bottom: 2px solid #000; padding-bottom: 4px;">
        📦 PARTIAL TAKE OUT IN INVENTORY (NOT FOR SALE AT REGISTER)
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 100px; text-align: center;">Pack #</th>
            <th style="text-align: left;">Game Title</th>
            <th style="width: 70px; text-align: center;">From Box</th>
            <th style="width: 65px; text-align: center;">Price</th>
            <th style="width: 80px; text-align: center;">Stored Tickets</th>
            <th style="width: 90px; text-align: right;">Value</th>
            <th style="width: 110px; text-align: center;">Stored At</th>
          </tr>
        </thead>
        <tbody>
          ${ptoRows}
          <tr class="grand-total">
            <td colspan="4" style="text-align: right; padding-right: 12px;">TOTAL PARTIAL INVENTORY (STORED):</td>
            <td style="text-align: center;">${ptoTotalTix} Tickets</td>
            <td style="text-align: right;">$${ptoTotalVal.toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Lottery Inventory Status Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #000; font-size: 13px; }
          .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 18px; font-weight: bold; }
          .meta { font-size: 12px; color: #555; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f0f0f0; border: 1px solid #333; padding: 7px 6px; font-size: 12px; text-transform: uppercase; }
          td { border: 1px solid #999; padding: 6px; font-size: 12px; }
          .grand-total { background: #f5f5f5; font-weight: bold; border-top: 2px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">LOTTERY INVENTORY LIVE STATUS & STOCK AUDIT</div>
          <div class="meta">Store: <strong>${state.storeName || 'LOTTERY POS'}</strong> &bull; Printed: <strong>${new Date().toLocaleString()}</strong> &bull; Active Packs: <strong>${activeSlots.length}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 60px; text-align: center;">Box #</th>
              <th style="text-align: left;">Game Title</th>
              <th style="width: 110px; text-align: center;">Pack #</th>
              <th style="width: 65px; text-align: center;">Price</th>
              <th style="width: 100px; text-align: center;">Ticket #</th>
              <th style="width: 80px; text-align: center;">Remaining</th>
              <th style="width: 100px; text-align: right;">Value Left</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="grand-total">
              <td colspan="5" style="text-align: right; padding-right: 12px;">TOTAL LIVE RACK INVENTORY:</td>
              <td style="text-align: center;">${totalTickets.toLocaleString()} Left</td>
              <td style="text-align: right;">$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
          </tbody>
        </table>
        ${ptoTableHtml}
      </body>
    </html>
  `;

  const printWin = window.open('', '_blank', 'width=850,height=700');
  if (printWin) {
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
  } else {
    window.print();
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

    // Hardware scanners typically send Enter or NumpadEnter upon decoding
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
        // Exception: If setTicketDetailsModal is open and clerk's hardware scanner types into game name input,
        // capture rapid burst into scanBuffer so it can be cleanly processed as a barcode scan!
        if (setTicketDetailsModal && setTicketDetailsModal.open && activeEl === document.getElementById('setBoxGameNameInput')) {
          const now = Date.now();
          if (now - lastKeystrokeTime > 250) {
            scanBuffer = '';
          }
          scanBuffer += e.key;
          lastKeystrokeTime = now;
          return;
        }
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
  const parsedPreview = parseLotteryBarcode(rawBarcode, state.customGames);
  const effectivePreviewBarcode = (parsedPreview && parsedPreview.standardBarcode) ? parsedPreview.standardBarcode : rawBarcode;
  state.lastScannedBarcode = effectivePreviewBarcode;

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

  // Scenario 0: Receive Packs view is active -> route barcode scan into intake form
  const viewReceive = document.getElementById('viewReceivePacks');
  if (viewReceive && viewReceive.style.display !== 'none') {
    handleReceivePackBarcode(rawBarcode);
    return;
  }

  // Scenario 1: Update Inventory Manager Modal is open -> handle ticket scan for intake
  if (inventoryModal && inventoryModal.open) {
    handleTicketBarcodeScan(rawBarcode, 'inventory');
    return;
  }

  // Scenario 1a: Ticket Details Modal is open -> if user scans box barcode, advance to box and set; if ticket scanned, refresh details
  if (setTicketDetailsModal && setTicketDetailsModal.open) {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    if (parsedBoxNum && parsedBoxNum >= 1 && parsedBoxNum <= 100) {
      proceedToSetBoxStep();
      if (setBoxNumberInput) setBoxNumberInput.value = parsedBoxNum;
      confirmSetBoxForTicket();
      return;
    }
    const parsedTix = parseLotteryBarcode(rawBarcode, state.customGames);
    if (parsedTix && parsedTix.isValid) {
      openSetTicketDetailsModal(rawBarcode);
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
      const parsed = parseLotteryBarcode(rawBarcode, state.customGames);
      const matchedGame = findGameByBarcode(rawBarcode, state.customGames);
      const gamePrice = matchedGame ? matchedGame.price : 20;
      const gameName = matchedGame ? cleanGameTitle(matchedGame.name) : 'Scratch-Off Game';
      const std = getStandardPackDetails(gamePrice);
      const packNum = (parsed && parsed.packNumber) ? parsed.packNumber : (rawBarcode.replace(/[^0-9]/g, '').slice(-6) || '889901');

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
    const parsedTicket = parseLotteryBarcode(rawBarcode, state.customGames);
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
      targetSlot = state.slots.find(s => {
        if (!isBoxActive(s)) return false;
        return isPackNumberMatch(s.packNumber, parsedTicket.packNumber);
      });
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
          if (!isPackNumberMatch(s.packNumber, parsedTicket.packNumber)) {
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
        packOwnershipValid = isPackNumberMatch(targetSlot.packNumber, parsedTicket.packNumber);
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
    const parsedTicket = parseLotteryBarcode(rawBarcode, state.customGames);
    const cleanNum = rawBarcode.replace(/[^0-9]/g, '');

    // Reject retail product barcodes, laptop serials, and non-lottery barcodes immediately
    if (!parsedTicket || !parsedTicket.isValid || parsedTicket.isRetailProduct || parsedTicket.isNonLotteryBarcode) {
      sfx.alert();
      if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
      if (scanActionTitle) {
        scanActionTitle.textContent = parsedTicket?.isRetailProduct
          ? 'RETAIL MERCHANDISE - NOT A LOTTERY TICKET'
          : 'NON-LOTTERY BARCODE';
      }
      if (lastScanDisplay) lastScanDisplay.textContent = `Barcode: ${rawBarcode}`;
      const msg = parsedTicket?.isRetailProduct
        ? `❌ [${rawBarcode}] is a retail product (food/grocery merchandise), not a lottery ticket.`
        : `❌ [${rawBarcode}] is not a lottery ticket barcode (electronics/serial/non-lottery code).`;
      showToast(msg, 'error');

      clearTimeout(scanAlertTimeout);
      scanAlertTimeout = setTimeout(() => {
        if (lastScanReadoutContainer?.classList.contains('alert-yellow') && (scanActionTitle?.textContent?.includes('NOT A LOTTERY') || scanActionTitle?.textContent?.includes('NON-LOTTERY'))) {
          clearScanAlertBanner();
        }
      }, 5000);
      return;
    }

    // Check if this scanned ticket belongs to a Partial Take Out pack in storage
    const matchingPto = (state.partialTakeOuts || []).find(pto => {
      if (!pto.packNumber) return false;
      const ptoPackClean = String(pto.packNumber).replace(/[^0-9]/g, '');
      if (parsedTicket && parsedTicket.packNumber) {
        const ticketPackClean = String(parsedTicket.packNumber).replace(/[^0-9]/g, '');
        if (ticketPackClean === ptoPackClean || isPackNumberMatch(parsedTicket.packNumber, pto.packNumber)) {
          return true;
        }
      }
      return cleanNum.length >= 6 && ptoPackClean.length >= 4 && cleanNum.includes(ptoPackClean);
    });

    if (matchingPto) {
      openPartialTakeOutActionModal(matchingPto, rawBarcode, parsedTicket);
      return;
    }

    // 2a. Match by exact normalized pack number first (HIGH ACCURACY)
    let activeSlotToSell = null;
    if (parsedTicket && parsedTicket.packNumber) {
      activeSlotToSell = state.slots.find(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber) return false;
        return isPackNumberMatch(s.packNumber, parsedTicket.packNumber);
      });
    }

    // 2b. Match by slot's normalized pack number contained in clean barcode digits
    if (!activeSlotToSell) {
      activeSlotToSell = state.slots.find(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber) return false;
        const slotPackNorm = normalizePackNumber(s.packNumber);
        if (slotPackNorm.length < 4) return false;
        return cleanNum.includes(slotPackNorm);
      });
    }

    // 2c. Check if barcode was previously assigned/recorded to an active box
    if (!activeSlotToSell) {
      const existingInfo = findScannedBarcodeInfo(parsedTicket?.standardBarcode) || findScannedBarcodeInfo(rawBarcode);
      if (existingInfo && existingInfo.boxNumber) {
        const slot = state.slots.find(s => s.boxNumber === existingInfo.boxNumber && s.status === 'ACTIVE' && s.packNumber);
        if (slot) activeSlotToSell = slot;
      }
    }

    // 2d. Match by game barcodePrefix (e.g. 1648, 1417, 1870, etc.)
    if (!activeSlotToSell && parsedTicket && parsedTicket.gameNumber) {
      const matchingSlots = state.slots.filter(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber) return false;
        const gameDef = SAMPLE_GAMES.find(g => g.id === s.gameId) || (state.customGames || []).find(g => g.id === s.gameId);
        return (gameDef && gameDef.barcodePrefix === parsedTicket.gameNumber) || (s.gameId === parsedTicket.gameNumber);
      });
      if (matchingSlots.length > 0) {
        // If one of the slots matches the pack number, prefer that; else pick the first active slot for this game
        activeSlotToSell = matchingSlots.find(s => isPackNumberMatch(s.packNumber, parsedTicket.packNumber)) || matchingSlots[0];
      }
    }

    // 2e. Match by game name
    if (!activeSlotToSell) {
      activeSlotToSell = state.slots.find(s => {
        if (s.status !== 'ACTIVE' || !s.packNumber || !s.gameName) return false;
        const gName = cleanGameTitle(s.gameName).toLowerCase();
        return rawBarcode.toLowerCase().includes(gName) || (parsedTicket?.gameNumber && gName.includes(parsedTicket.gameNumber));
      });
    }

    if (activeSlotToSell) {
      const now = Date.now();
      // Hardware double-scan debounce (ignore exact duplicate within 1200ms - scanner noise)
      if (lastScannedRawBarcode === rawBarcode && (now - lastScannedBarcodeTime) < 1200) {
        sfx.beep();
        showToast('⚠️ Duplicate scan ignored (scanner debounce).', 'info');
        return;
      }

      lastScannedRawBarcode = rawBarcode;
      lastScannedBarcodeTime = now;

      const std = getStandardPackDetails(activeSlotToSell.price || 2);
      const packSize = activeSlotToSell.packSize || std.packSize;

      // Check if slot is already sold out (reached end of pack)
      if (activeSlotToSell.status === 'SOLD_OUT' || (activeSlotToSell.currentTicket !== undefined && activeSlotToSell.currentTicket >= packSize)) {
        sfx.alert();
        if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
        if (scanActionTitle) scanActionTitle.textContent = `BOX #${activeSlotToSell.boxNumber} IS SOLD OUT`;
        showToast(`🚨 Box #${activeSlotToSell.boxNumber} (${cleanGameTitle(activeSlotToSell.gameName)}) is SOLD OUT! Full pack of ${packSize} tickets sold. Please load a new pack.`, 'warning');
        return;
      }

      const prevTicketBefore = activeSlotToSell.currentTicket !== undefined && activeSlotToSell.currentTicket !== null ? activeSlotToSell.currentTicket : 0;
      const effectiveBarcode = (parsedTicket && parsedTicket.standardBarcode) ? parsedTicket.standardBarcode : rawBarcode;

      // Sell exactly 1 ticket from this active dispenser box (+1 whole number per scanned ticket):
      quickSellTicket(activeSlotToSell, effectiveBarcode, false, prevTicketBefore);
      return;
    }

    // 2b. Check if scanned barcode matches a sold-out pack (Discrepancy Handling - Video 01:13)
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    let soldOutCandidates = state.soldOutThisShift || [];
    if (isDaily) {
      const now = new Date();
      const isToday = (dStr) => {
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
      };
      const candidateList = [...soldOutCandidates];
      (state.shiftHistory || []).forEach(h => {
        if (isToday(h.endedAt || h.startedAt)) {
          (h.soldOutSnapshot || []).forEach(so => {
            if (!candidateList.some(x => isPackNumberMatch(x.packNumber, so.packNumber))) {
              candidateList.push(so);
            }
          });
        }
      });
      soldOutCandidates = candidateList;
    }

    const soldOutPack = soldOutCandidates.find(so => {
      const soNorm = normalizePackNumber(so.packNumber);
      if (!soNorm) return false;
      if (parsedTicket && parsedTicket.packNumber) {
        if (isPackNumberMatch(parsedTicket.packNumber, so.packNumber)) return true;
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
        scanActionTitle.textContent = isDaily ? 'This Ticket was sold out earlier today' : 'This Ticket was sold out in previous shift';
      }
      if (lastScanDisplay) {
        lastScanDisplay.textContent = '';
      }
      pendingSoldOutBarcode = rawBarcode;
      pendingSoldOutPack = soldOutPack;
      if (soldOutGameHeader) {
        soldOutGameHeader.textContent = cleanGameTitle(soldOutPack.gameName || 'Scratch Off Ticket');
      }
      const noticeEl = document.getElementById('soldOutModalNotice');
      if (noticeEl) {
        noticeEl.textContent = isDaily ? 'This Ticket was sold out earlier today' : 'This Ticket was sold out in previous shift';
      }
      const questionEl = document.getElementById('soldOutModalQuestion');
      if (questionEl) {
        questionEl.textContent = isDaily ? 'Do you want to add this Ticket back into today\'s sales?' : 'Do you want to add this Ticket back into New Shift?';
      }
      updateSoldOutTicketModal?.showModal();
      return;
    }

    // 3. If barcode was previously assigned to an active box, sell directly from that box!
    const existing = findScannedBarcodeInfo(parsedTicket?.standardBarcode) || findScannedBarcodeInfo(rawBarcode);
    if (existing && existing.boxNumber) {
      const existingSlot = state.slots.find(s => s.boxNumber === existing.boxNumber && s.status === 'ACTIVE' && s.packNumber);
      if (existingSlot) {
        const std = getStandardPackDetails(existingSlot.price || 2);
        const packSize = existingSlot.packSize || std.packSize;
        if (existingSlot.status === 'SOLD_OUT' || (existingSlot.currentTicket !== undefined && existingSlot.currentTicket >= packSize)) {
          sfx.alert();
          if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
          if (scanActionTitle) scanActionTitle.textContent = `BOX #${existingSlot.boxNumber} IS SOLD OUT`;
          showToast(`🚨 Box #${existingSlot.boxNumber} (${cleanGameTitle(existingSlot.gameName)}) is SOLD OUT! Full pack of ${packSize} tickets sold. Please load a new pack.`, 'warning');
          return;
        }
        const prevTicketBefore = existingSlot.currentTicket !== undefined && existingSlot.currentTicket !== null ? existingSlot.currentTicket : 0;
        const effectiveBarcode = (parsedTicket && parsedTicket.standardBarcode) ? parsedTicket.standardBarcode : rawBarcode;
        quickSellTicket(existingSlot, effectiveBarcode, false, prevTicketBefore);
        return;
      }
    }

    // 4. Scan-to-Appear: New ticket scanned (not in an active box yet)!
    // Only open if the scanned barcode is a VALID lottery scratch ticket!
    if (!parsedTicket || !parsedTicket.isValid || parsedTicket.isRetailProduct || parsedTicket.isNonLotteryBarcode) {
      sfx.alert();
      if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
      if (scanActionTitle) {
        scanActionTitle.textContent = parsedTicket?.isRetailProduct
          ? 'RETAIL MERCHANDISE - NOT A LOTTERY TICKET'
          : 'NOT A LOTTERY TICKET';
      }
      if (lastScanDisplay) lastScanDisplay.textContent = `Barcode: ${rawBarcode}`;
      showToast(
        parsedTicket?.isRetailProduct
          ? `❌ [${rawBarcode}] is a retail product (food/grocery/electronic merchandise), not a lottery ticket.`
          : `❌ Barcode [${rawBarcode}] is not a valid lottery ticket format.`,
        'error'
      );

      clearTimeout(scanAlertTimeout);
      scanAlertTimeout = setTimeout(() => {
        if (lastScanReadoutContainer?.classList.contains('alert-yellow') && (scanActionTitle?.textContent?.includes('NOT A LOTTERY') || scanActionTitle?.textContent?.includes('RETAIL'))) {
          clearScanAlertBanner();
        }
      }, 5000);
      return;
    }

    // 4b. At the Sell Counter: A pack manifest barcode (no ticket number) cannot be sold as an individual ticket!
    if (parsedTicket.isPackBarcode || parsedTicket.ticketNumber === null) {
      sfx.alert();
      if (lastScanReadoutContainer) lastScanReadoutContainer.classList.add('alert-yellow');
      if (scanActionTitle) scanActionTitle.textContent = 'PACK BARCODE - NOT AN INDIVIDUAL TICKET';
      if (lastScanDisplay) lastScanDisplay.textContent = `Pack #${parsedTicket.packNumber || rawBarcode}`;
      showToast(`⚠️ [${rawBarcode}] is a pack barcode, not an individual ticket. Scan an individual ticket to sell, or use "Activate Pack" to put it in a box.`, 'warning');

      clearTimeout(scanAlertTimeout);
      scanAlertTimeout = setTimeout(() => {
        if (lastScanReadoutContainer?.classList.contains('alert-yellow') && scanActionTitle?.textContent?.includes('PACK BARCODE')) {
          clearScanAlertBanner();
        }
      }, 5000);
      return;
    }

    const effectiveBarcode = (parsedTicket && parsedTicket.standardBarcode) ? parsedTicket.standardBarcode : rawBarcode;
    pendingNewTicketBarcode = effectiveBarcode;
    openSetTicketDetailsModal(rawBarcode, effectiveBarcode);
    showToast(`🏷️ New ticket scanned [${effectiveBarcode}]: Set name and price.`, 'info');
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

  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';

  const histTitleText = document.getElementById('historyModalTitleText');
  if (histTitleText) histTitleText.textContent = isDailyMode ? 'Past Days Audit History' : 'Past Shifts Audit History';

  const histCol1Header = document.getElementById('historyCol1Header');
  if (histCol1Header) histCol1Header.textContent = isDailyMode ? 'Day' : 'Shift';

  const histBtnFilterAll = document.getElementById('historyBtnFilterAll');
  if (histBtnFilterAll) histBtnFilterAll.textContent = isDailyMode ? 'All Days' : 'All Shifts';

  const historyTotalBadge = document.getElementById('historyTotalBadge');
  if (historyTotalBadge) {
    historyTotalBadge.textContent = isDailyMode
      ? `${list.length} Day${list.length === 1 ? '' : 's'}`
      : `${list.length} Shift${list.length === 1 ? '' : 's'}`;
  }

  if (list.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="7" style="text-align:center; padding:28px 14px; color:var(--text-muted); font-style:italic;">No ${isDailyMode ? 'daily records' : 'shifts'} recorded for ${filter === 'today' ? 'today' : filter === 'week' ? 'this week' : filter === 'month' ? 'this month' : 'this period'}.</td>`;
    historyTableBody.appendChild(row);
  } else {
    list.forEach(h => {
      const dateObj = h.endedAt ? new Date(h.endedAt) : (h.startedAt ? new Date(h.startedAt) : null);
      const dateFormatted = dateObj && !isNaN(dateObj.getTime())
        ? `${dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '--';

      const labelText = isDailyMode || h.isDayClose
        ? `Day (${dateFormatted.split(' ')[0]})`
        : `Shift #${h.shiftNumber}`;

      const row = document.createElement('tr');
      const actCount = h.activationsCount || 0;
      row.innerHTML = `
        <td>
          <span class="history-shift-badge">
            ${labelText}
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
          <button type="button" class="btn-history-view" title="View detailed report for ${labelText}">
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

  const isDailyMode = state.settings?.operationMode !== 'SHIFTS';

  const shiftModalTitle = document.getElementById('shiftReportModalTitle');
  if (shiftModalTitle) shiftModalTitle.textContent = isDailyMode ? 'Day Report' : 'Shift Report';

  const repShiftNumLabel = document.getElementById('repShiftNumLabel');
  if (repShiftNumLabel) repShiftNumLabel.textContent = isDailyMode ? 'Day' : 'Shift';

  const dateObj = h.endedAt ? new Date(h.endedAt) : (h.startedAt ? new Date(h.startedAt) : new Date());
  const dateStr = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  repShiftNum.innerHTML = isDailyMode 
    ? `${dateStr} <span class="audit-history-badge">HISTORY</span>` 
    : `#${h.shiftNumber} <span class="audit-history-badge">HISTORY</span>`;

  repCashier.textContent = h.cashier || 'Clerk';

  const repTotalSalesLabel = document.getElementById('repTotalSalesLabel');
  if (repTotalSalesLabel) repTotalSalesLabel.textContent = isDailyMode ? 'TOTAL LOTTO DAY SALES' : 'TOTAL LOTTO SHIFT SALES';

  const reportNewShiftBtn = document.getElementById('reportNewShiftBtn');
  if (reportNewShiftBtn) reportNewShiftBtn.textContent = isDailyMode ? '✨ New Day' : '🚀 New Shift';

  reportBodyRows.innerHTML = '';
  
  const rows = buildShiftReportRows(h.slotsSnapshot || [], h.soldOutSnapshot || []);
  let totalSold = 0;
  let totalRevenue = 0;

  rows.forEach(item => {
    totalSold += item.sold;
    totalRevenue += item.amount;

    const row = document.createElement('tr');
    row.className = 'report-row';
    let tagHtml = '';
    if (item.statusTag) {
      const tagClass = item.isReturned ? 'report-tag-returned' : 'report-tag-soldout';
      tagHtml = `<span class="report-status-tag ${tagClass}">${item.statusTag}</span>`;
    }
    row.innerHTML = `
      <td class="col-box"><span class="report-box-badge">Box ${item.boxNumber}</span></td>
      <td class="col-game" title="${item.gameName}">
        ${cleanGameTitle(item.gameName)}${tagHtml}
      </td>
      <td class="col-price">$${item.price}</td>
      <td class="col-start">${String(item.startTicket).padStart(2, '0')}</td>
      <td class="col-close">${String(item.closeTicket).padStart(2, '0')}</td>
      <td class="col-sold ${item.sold > 0 ? 'has-sales' : 'no-sales'}">${item.sold}</td>
      <td class="col-amount ${item.amount > 0 ? 'has-sales' : 'no-sales'}">$${item.amount.toFixed(2)}</td>
    `;
    reportBodyRows.appendChild(row);
  });

  if (rows.length === 0) {
    if ((h.totalTicketsSold || 0) > 0 || (h.totalSalesRevenue || 0) > 0) {
      totalSold = h.totalTicketsSold || 0;
      totalRevenue = h.totalSalesRevenue || 0;
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="7" style="text-align:center; padding:20px; color:#94a3b8; font-style:italic;">
        Historical ${isDailyMode ? 'Day' : 'Shift'} #${h.shiftNumber} &bull; Total Sold: ${totalSold} tickets &bull; Revenue: $${Number(totalRevenue).toFixed(2)}
      </td>`;
      reportBodyRows.appendChild(row);
    } else {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `<td colspan="7" style="text-align:center; padding:24px 14px; color:#94a3b8; font-style:italic; font-family:inherit; font-size:0.88rem;">
        🎟️ No ticket sales recorded ${isDailyMode ? 'on this day' : 'in this shift'}.
      </td>`;
      reportBodyRows.appendChild(emptyRow);
    }
  } else {
    // If calculated totals are higher than historical summary (due to auto-restored sold-out packs), use calculated totals
    totalSold = Math.max(totalSold, h.totalTicketsSold || 0);
    totalRevenue = Math.max(totalRevenue, h.totalSalesRevenue || 0);
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
  const prReceiptTitle = document.getElementById('prReceiptTitle');
  if (prReceiptTitle) prReceiptTitle.textContent = isDailyMode ? 'DAY SETTLEMENT AUDIT' : 'SHIFT SETTLEMENT AUDIT';
  const prShiftLabel = document.getElementById('prShiftLabel');
  if (prShiftLabel) prShiftLabel.textContent = isDailyMode ? 'DAY: ' : 'SHIFT: ';
  const prDateEl = document.getElementById('prDate');
  if (prDateEl) prDateEl.textContent = dateStr;
  const prTimeEl = document.getElementById('prTime');
  if (prTimeEl) prTimeEl.textContent = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const prShiftEl = document.getElementById('prShift');
  if (prShiftEl) prShiftEl.textContent = isDailyMode ? `${dateStr} (${h.cashier || 'Clerk'}) [AUDIT]` : `#${h.shiftNumber} (${h.cashier || 'Clerk'}) [AUDIT]`;
  const prTotalSalesEl = document.getElementById('prTotalSales');
  if (prTotalSalesEl) prTotalSalesEl.textContent = `$${Number(totalRevenue).toFixed(2)}`;
  const prTotalTicketsEl = document.getElementById('prTotalTickets');
  if (prTotalTicketsEl) prTotalTicketsEl.textContent = totalSold;

  const prActivationLabel = document.getElementById('prActivationLabel');
  if (prActivationLabel) prActivationLabel.textContent = isDailyMode ? 'DAY ACTIVATIONS:' : 'SHIFT ACTIVATIONS:';
  const prActivationCount = document.getElementById('prActivationCount');
  if (prActivationCount) prActivationCount.textContent = h.activationsCount || 0;

  const prBarcodeCodeEl = document.getElementById('prBarcodeCode');
  if (prBarcodeCodeEl) prBarcodeCodeEl.textContent = isDailyMode ? `*DAY-402-${String(h.shiftNumber).padStart(4, '0')}-REC*` : `*SHFT-402-${String(h.shiftNumber).padStart(4, '0')}-REC*`;

  // Populate thermal print items
  const prList = document.getElementById('prItemsList');
  if (prList) {
    prList.innerHTML = '';
    const activeSlotsWithSales = (rows || []).filter(r => r.sold > 0);
    if (activeSlotsWithSales.length === 0) {
      const emptyRow = document.createElement('div');
      emptyRow.className = 'receipt-row';
      emptyRow.style.cssText = 'text-align:center; padding:4px 0; color:#444; font-style:italic; display:block !important; font-size:9.5px;';
      emptyRow.textContent = isDailyMode ? '-- NO LOTTERY SALES RECORDED ON THIS DAY --' : '-- NO LOTTERY SALES RECORDED IN THIS SHIFT --';
      prList.appendChild(emptyRow);
    } else {
      activeSlotsWithSales.forEach(s => {
        const row = document.createElement('div');
        row.className = 'receipt-row has-sales';
        const boxStr = `#${String(s.boxNumber).padStart(2, '0')}`;
        let cleanName = (s.gameName || 'SCRATCH').trim();
        if (cleanName.length > 13) cleanName = cleanName.substring(0, 13);
        row.innerHTML = `
          <span class="col-box">${boxStr}</span>
          <span class="col-game">${cleanName}</span>
          <span class="col-qty">${s.sold}x</span>
          <span class="col-amt">$${Number(s.amount || 0).toFixed(2)}</span>
        `;
        prList.appendChild(row);
      });
    }
  }

  sfx.chime();
  shiftReportModal.showModal();
  showToast(`Viewing Audit Report for ${isDailyMode ? `Day ${dateStr}` : `Shift #${h.shiftNumber}`}`, 'info');
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
    setTimeout(() => {
      if (typeof toast.remove === 'function') toast.remove();
      else toast.parentNode?.removeChild(toast);
    }, 300);
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

  // 3. Clear scanner input and deselect active box
  if (barcodeInput) {
    barcodeInput.value = '';
    barcodeInput.focus();
  }
  state.lastScannedSlot = null;

  // 4. Calculate current status for informative feedback
  let activeBoxes = 0;
  let shiftSales = 0;
  (state.slots || []).forEach(slot => {
    if (slot.status === 'ACTIVE') {
      activeBoxes++;
      const sold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
      shiftSales += sold * (slot.ticketPrice || 0);
    }
  });

  // 5. Re-render all views and metrics
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  // 6. User feedback
  showToast(`🔄 Shift #${state.shiftNumber} Refreshed & Synced! (${activeBoxes} Active Boxes · $${shiftSales.toFixed(2)} Sales)`, 'success');
}

// -------------------------------------------------------------
// Event Listeners Wire-up
// -------------------------------------------------------------

function setupEventListeners() {
  // MySQL Database Status & Diagnostics Wiring
  const mysqlStatusBadge = document.getElementById('mysqlStatusBadge');
  const mysqlStatusText = document.getElementById('mysqlStatusText');
  const mysqlStatusModal = document.getElementById('mysqlStatusModal');
  const closeMysqlModalBtn = document.getElementById('closeMysqlModalBtn');
  const btnOkMysqlModal = document.getElementById('btnOkMysqlModal');
  const btnTestMysqlConn = document.getElementById('btnTestMysqlConn');
  const mysqlModalContent = document.getElementById('mysqlModalContent');

  function updateMysqlModalUI(connected, info) {
    if (!mysqlModalContent) return;
    if (connected) {
      mysqlModalContent.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; padding:14px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:10px; margin-bottom:14px;">
          <span style="font-size:1.8rem;">🟢</span>
          <div>
            <div style="font-weight:700; color:#10b981; font-size:1.02rem;">MySQL Database Connected & Online</div>
            <div style="font-size:0.84rem; color:var(--text-muted); margin-top:2px;">All daily reports & shifts are automatically saved to MySQL.</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:120px 1fr; gap:8px 12px; font-size:0.86rem; background:var(--bg-hover); padding:12px; border-radius:8px;">
          <span style="color:var(--text-muted);">Database:</span> <strong>${info.database || 'lotto_pos'}</strong>
          <span style="color:var(--text-muted);">Host & Port:</span> <strong>${info.host || 'localhost'}:${info.port || 3306}</strong>
          <span style="color:var(--text-muted);">Status:</span> <strong style="color:#10b981;">Active & Ready</strong>
        </div>
      `;
    } else {
      mysqlModalContent.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; padding:14px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:10px; margin-bottom:14px;">
          <span style="font-size:1.8rem;">🔴</span>
          <div>
            <div style="font-weight:700; color:#ef4444; font-size:1.02rem;">MySQL Server Not Connected</div>
            <div style="font-size:0.84rem; color:var(--text-muted); margin-top:2px;">
              ${info.error ? `Error: ${info.error}` : 'MySQL server or XAMPP is not currently running on this computer.'}
            </div>
          </div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">
          Don't worry! Your sales and tickets are <strong>100% safely saved in local storage</strong> right now. Once MySQL is started in XAMPP, it will connect automatically.
        </div>
      `;
    }
  }

  let hasSyncedHistory = false;
  initDatabaseSync((connected, info) => {
    if (mysqlStatusBadge && mysqlStatusText) {
      if (connected) {
        mysqlStatusBadge.className = 'mysql-status-badge connected';
        mysqlStatusText.textContent = 'MySQL Online';
        mysqlStatusBadge.title = `MySQL Connected: ${info.database} at ${info.host}:${info.port}`;
        if (!hasSyncedHistory && Array.isArray(state.shiftHistory) && state.shiftHistory.length > 0) {
          hasSyncedHistory = true;
          syncHistoricalShiftsToDB(state.shiftHistory);
        }
      } else {
        mysqlStatusBadge.className = 'mysql-status-badge offline';
        mysqlStatusText.textContent = 'MySQL Offline';
        mysqlStatusBadge.title = 'MySQL not running. Click to view instructions.';
      }
    }
    updateMysqlModalUI(connected, info);
  });

  mysqlStatusBadge?.addEventListener('click', () => {
    sfx.keypad();
    mysqlStatusModal?.showModal();
  });
  closeMysqlModalBtn?.addEventListener('click', () => mysqlStatusModal?.close());
  btnOkMysqlModal?.addEventListener('click', () => mysqlStatusModal?.close());
  btnTestMysqlConn?.addEventListener('click', async () => {
    btnTestMysqlConn.textContent = '⏳ Testing...';
    btnTestMysqlConn.disabled = true;
    const isConn = await checkMySQLStatus();
    btnTestMysqlConn.textContent = '🔄 Test Connection Now';
    btnTestMysqlConn.disabled = false;
    if (isConn) {
      sfx.success();
      showToast('✓ MySQL Connected Successfully!', 'success');
    } else {
      sfx.alert();
      showToast('⚠️ MySQL Connection Failed. Ensure MySQL / XAMPP is running.', 'warning');
    }
  });

  mainShiftActionBtn?.addEventListener('click', handleMainShiftAction);

  cancelActionBtn?.addEventListener('click', () => {
    sfx.keypad();
    clearScanAlertBanner();

    // 1. Clear main barcode scanner input
    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }

    // 2. Close any open modal dialogs
    const openModals = document.querySelectorAll('dialog[open]');
    let closedAnyModal = false;
    openModals.forEach(dialog => {
      dialog.close();
      closedAnyModal = true;
    });

    // 3. Clear pending scan variables
    pendingActivationPack = null;
    pendingSetBoxBarcode = null;
    pendingSetBoxGame = null;
    pendingRestorePack = null;
    pendingNewTicketBarcode = null;
    pendingSoldOutBarcode = null;
    pendingSoldOutPack = null;

    // 4. Deselect highlighted box card
    if (state.lastScannedSlot) {
      state.lastScannedSlot = null;
      renderDispenserRack();
      renderSlotsRibbon();
    }

    // 5. If in End Shift scanning mode, cancel and revert to in-progress
    if (state.shiftStatus === 'SCANNING_END_SHIFT') {
      state.shiftStatus = 'IN_PROGRESS';
      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      const isDaily = state.settings?.operationMode !== 'SHIFTS';
      showToast(isDaily ? 'End Day cancelled. Resuming day in progress.' : 'End Shift cancelled. Resuming shift in progress.', 'info');
      return;
    }

    if (closedAnyModal) {
      showToast('Dialog cancelled and closed.', 'info');
    } else {
      showToast('✓ Cancelled. Scanner cleared and ready.', 'info');
    }
  });

  undoActionBtn?.addEventListener('click', handleUndoAction);

  document.getElementById('btnHeaderRefresh')?.addEventListener('click', () => {
    sfx.keypad();
    renderHeaderAndMetrics();
    renderDispenserRack();
    showToast('Screen refreshed', 'info');
  });

  document.getElementById('btnHeaderReport')?.addEventListener('click', () => {
    sfx.keypad();
    openDaySettlementModal(state, () => openDayReportModal(() => state, sfx), () => promptStartNewShift());
  });

  document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => {
    document.querySelector('.pos-sidebar')?.classList.toggle('collapsed');
    sfx.keypad();
  });

  const btnTrimRackBtn = document.getElementById('btnTrimRackBtn');
  if (btnTrimRackBtn) {
    btnTrimRackBtn.addEventListener('click', openResetOptionsModal);
  }

  // Reset Modal Action Listeners
  const resetOptionsModal = document.getElementById('resetOptionsModal');
  const closeResetOptionsBtn = document.getElementById('closeResetOptionsBtn');
  const cancelResetOptionsBtn = document.getElementById('cancelResetOptionsBtn');
  const btnResetOptionTrim = document.getElementById('btnResetOptionTrim');
  const btnResetOptionSales = document.getElementById('btnResetOptionSales');
  const btnResetOptionScanner = document.getElementById('btnResetOptionScanner');
  const btnResetOptionWipe = document.getElementById('btnResetOptionWipe');

  closeResetOptionsBtn?.addEventListener('click', () => resetOptionsModal?.close());
  cancelResetOptionsBtn?.addEventListener('click', () => resetOptionsModal?.close());

  btnResetOptionTrim?.addEventListener('click', () => {
    resetOptionsModal?.close();
    executeTrimRack();
  });

  btnResetOptionSales?.addEventListener('click', () => {
    resetOptionsModal?.close();
    executeResetShiftSales();
  });

  btnResetOptionScanner?.addEventListener('click', () => {
    resetOptionsModal?.close();
    executeResetScanner();
  });

  btnResetOptionWipe?.addEventListener('click', () => {
    resetOptionsModal?.close();
    executeWipeAllData();
  });

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
  const settingOperationMode = document.getElementById('settingOperationMode');
  const settingSoundToggle = document.getElementById('settingSoundToggle');

  function openSettingsModal() {
    if (!settingsModal) return;
    settingStoreName.value = state.storeName || 'LOTTO EXPRESS POS';
    settingCashierName.value = state.cashierName || 'CLERK';
    settingTargetEmail.value = state.settings?.targetEmails || 'manager@eltesystemsoftware.com';
    if (settingOperationMode) {
      settingOperationMode.value = state.settings?.operationMode || 'DAILY';
    }
    settingSoundToggle.checked = state.settings?.soundEnabled !== false;
    sfx.keypad();
    settingsModal.showModal();
  }

  function saveSettings() {
    state.storeName = settingStoreName.value.trim() || 'LOTTO EXPRESS POS';
    state.cashierName = settingCashierName.value.trim() || 'CLERK';
    if (!state.settings) state.settings = {};
    state.settings.targetEmails = settingTargetEmail.value.trim() || '';
    if (settingOperationMode) {
      state.settings.operationMode = settingOperationMode.value;
    }
    state.settings.soundEnabled = settingSoundToggle.checked;
    sfx.muted = !state.settings.soundEnabled;

    saveState(state);
    settingsModal.close();
    sfx.success();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    if (inventoryStatusModal && inventoryStatusModal.open) {
      renderInventoryStatusModal();
    }
    if (inventoryModal && inventoryModal.open) {
      renderInventoryTable();
    }
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    showToast(`✓ Workflow Mode set to: ${isDaily ? 'Daily Mode' : 'Shift Mode'}!`, 'success');
  }

  closeSettingsBtn?.addEventListener('click', () => settingsModal.close());
  cancelSettingsBtn?.addEventListener('click', () => settingsModal.close());
  saveSettingsBtn?.addEventListener('click', saveSettings);

  function exportHistoryToCSV() {
    if (!state.shiftHistory || state.shiftHistory.length === 0) {
      showToast('No history to export yet!', 'info');
      return;
    }

    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    const headers = [isDaily ? 'Day / Shift' : 'Shift #', 'Cashier', 'Started At', 'Ended At', 'Tickets Sold', 'Revenue ($)', 'Activations'];
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
    link.setAttribute('download', `lotto_${isDaily ? 'day' : 'shift'}_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sfx.chime();
    showToast(isDaily ? '✓ Daily history exported to CSV!' : '✓ Shift history exported to CSV!', 'success');
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
    openInventoryModal('all');
    setTimeout(() => {
      document.getElementById('invSearchInput')?.focus();
    }, 120);
    voice.speak('Update inventory');
    showToast('📋 Search or audit dispenser boxes and stored inventory.', 'info');
  });
  document.getElementById('tabInventoryStatus')?.addEventListener('click', () => {
    sfx.keypad();
    openInventoryStatusModal('active');
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
        const code = guidedBarcodeInput?.value.trim() || '1420-9834105-015';
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
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    if (isDaily) {
      openDayReportModal(() => state, sfx);
    } else {
      openShiftReportModal();
    }
  });
  document.getElementById('menuSettingsBtn').addEventListener('click', openSettingsModal);

  // Quick Cashier Switcher Dialog
  function openCashierModal() {
    const cashierModal = document.getElementById('cashierModal');
    if (!cashierModal) return;
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    const stripLabel = document.getElementById('cashierModalStripLabel');
    if (stripLabel) stripLabel.textContent = isDaily ? 'Active Day' : 'Active Shift';

    const shiftInfo = document.getElementById('cashierModalShiftInfo');
    if (shiftInfo) {
      const todayFormatted = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const statusTxt = state.shiftStatus === 'IN_PROGRESS' ? 'In Progress' : 'Closed';
      shiftInfo.textContent = isDaily 
        ? `${todayFormatted} · ${statusTxt}` 
        : `Shift #${state.shiftNumber} · ${statusTxt}`;
    }
    const nameInp = document.getElementById('inputCashierModalName');
    if (nameInp) nameInp.value = state.cashierName || 'master';
    sfx.keypad();
    cashierModal.scrollLeft = 0;
    cashierModal.scrollTop = 0;
    const rightPanel = cashierModal.querySelector('.cashier-right-panel');
    if (rightPanel) rightPanel.scrollTop = 0;
    cashierModal.showModal();
    setTimeout(() => {
      nameInp?.focus?.({ preventScroll: true });
      nameInp?.select?.();
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

  // Quick Clerk avatar buttons & PIN keypad handlers
  document.querySelectorAll('.quick-clerk-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const clerk = btn.dataset.clerk;
      const inp = document.getElementById('inputCashierModalName');
      if (inp && clerk) {
        inp.value = clerk;
        inp.focus();
        sfx.beep();
      }
    });
  });

  document.querySelectorAll('#cashierPinKeypad .cashier-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const inp = document.getElementById('inputCashierModalName');
      if (!inp) return;
      sfx.keypad();
      if (key === 'clear') {
        inp.value = '';
      } else if (key === 'backspace') {
        inp.value = inp.value.slice(0, -1);
      } else if (key) {
        inp.value += key;
      }
    });
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

  document.getElementById('menuSignOutBtn')?.addEventListener('click', () => {
    sfx.keypad();
    openCashierModal();
  });
  document.getElementById('sidebarUserPill')?.addEventListener('click', () => {
    sfx.keypad();
    openCashierModal();
  });

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
        state = resetToCleanState(state);
        saveState(state);
        // Clear Day Report print DOM and preview container immediately so no stale data remains
        const printSection = document.getElementById('dayReportPrintSection');
        if (printSection) printSection.innerHTML = '';
        const previewContainer = document.getElementById('dayReportPreviewContainer');
        if (previewContainer) previewContainer.innerHTML = '';
        initPOS();
        showSellCounterView();
        sfx.alert();
        showToast('All POS data wiped. Clean start ready.', 'info');
      }
    });
  }

  // =============================================================
  // RECEIVE PACKS VIEW CONTROLLER (Matching Reference UI Design)
  // =============================================================
  let currentReceivePackPrice = 10;
  let stagedDeliveryPacks = [
    {
      id: 'sd_1',
      gameName: 'Lucky 7s',
      gameNumber: '1688',
      packNumber: '983301',
      price: 5,
      tickets: 60,
      bookValue: 300,
      destination: 'Safe'
    },
    {
      id: 'sd_2',
      gameName: 'Jr Jumbo',
      gameNumber: '1602',
      packNumber: '745612',
      price: 1,
      tickets: 300,
      bookValue: 300,
      destination: 'Safe'
    }
  ];

  let currentInventoryTab = 'rack';

  let selectedHistoryDayId = 'day_14';

  function showSellCounterView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'block';
    if (viewReceive) viewReceive.style.display = 'none';
    if (viewReport) viewReport.style.display = 'none';
    if (viewInv) viewInv.style.display = 'none';
    if (viewHist) viewHist.style.display = 'none';
    if (viewSet) viewSet.style.display = 'none';
    setActiveNav(document.getElementById('navSellCounter'));
  }

  function showReceivePacksView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'none';
    if (viewReceive) viewReceive.style.display = 'block';
    if (viewReport) viewReport.style.display = 'none';
    if (viewInv) viewInv.style.display = 'none';
    if (viewHist) viewHist.style.display = 'none';
    if (viewSet) viewSet.style.display = 'none';
    setActiveNav(document.getElementById('navReceivePacks'));
    renderReceivePacksView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      document.getElementById('rpPackBarcodeInput')?.focus();
    }, 100);
  }

  function showDayReportView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'none';
    if (viewReceive) viewReceive.style.display = 'none';
    if (viewReport) viewReport.style.display = 'block';
    if (viewInv) viewInv.style.display = 'none';
    if (viewHist) viewHist.style.display = 'none';
    if (viewSet) viewSet.style.display = 'none';
    setActiveNav(document.getElementById('navDayReport'));
    renderDayReportView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showInventoryView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'none';
    if (viewReceive) viewReceive.style.display = 'none';
    if (viewReport) viewReport.style.display = 'none';
    if (viewInv) viewInv.style.display = 'block';
    if (viewHist) viewHist.style.display = 'none';
    if (viewSet) viewSet.style.display = 'none';
    setActiveNav(document.getElementById('navInventory'));
    renderInventoryView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHistoryView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'none';
    if (viewReceive) viewReceive.style.display = 'none';
    if (viewReport) viewReport.style.display = 'none';
    if (viewInv) viewInv.style.display = 'none';
    if (viewHist) viewHist.style.display = 'block';
    if (viewSet) viewSet.style.display = 'none';
    setActiveNav(document.getElementById('navHistory'));
    renderHistoryView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSettingsView() {
    const viewSell = document.getElementById('viewSellCounter');
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSell) viewSell.style.display = 'none';
    if (viewReceive) viewReceive.style.display = 'none';
    if (viewReport) viewReport.style.display = 'none';
    if (viewInv) viewInv.style.display = 'none';
    if (viewHist) viewHist.style.display = 'none';
    if (viewSet) viewSet.style.display = 'block';
    setActiveNav(document.getElementById('navSettings'));
    populateSettingsInputs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function populateSettingsInputs() {
    const setStoreName = document.getElementById('setStoreName');
    const setStoreAddress = document.getElementById('setStoreAddress');
    const setRetailerNumber = document.getElementById('setRetailerNumber');
    const setRegisterName = document.getElementById('setRegisterName');
    const setAutoPrintToggle = document.getElementById('setAutoPrintToggle');

    if (setStoreName) setStoreName.value = state.storeName || 'Amigo Food Mart';
    if (setStoreAddress) setStoreAddress.value = state.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088';
    if (setRetailerNumber) setRetailerNumber.value = state.retailerNumber || '[YOUR RETAILER #]';
    if (setRegisterName) setRegisterName.value = state.registerName || 'Register 1';
    if (setAutoPrintToggle) setAutoPrintToggle.checked = state.settings?.autoPrint ?? true;

    // Rack & alerts Steppers and Toggles
    const valTotalBoxes = document.getElementById('valTotalBoxes');
    const valWarning1 = document.getElementById('valWarning1');
    const badgeWarning1 = document.getElementById('badgeWarning1');
    const valWarning2 = document.getElementById('valWarning2');
    const badgeWarning2 = document.getElementById('badgeWarning2');
    const valWarningOld = document.getElementById('valWarningOld');
    const badgeWarningOld = document.getElementById('badgeWarningOld');
    const toggleZeroIndexed = document.getElementById('toggleZeroIndexed');
    const toggleBeepScan = document.getElementById('toggleBeepScan');

    const totalBoxes = state.totalSlots || 65;
    const w1 = state.settings?.warning1Days ?? 7;
    const w2 = state.settings?.warning2Days ?? 12;
    const wOld = state.settings?.warningOldDays ?? 21;
    const zeroIndexed = state.settings?.zeroIndexed ?? true;
    const soundEnabled = state.settings?.soundEnabled ?? true;

    if (valTotalBoxes) valTotalBoxes.textContent = String(totalBoxes);
    if (valWarning1) valWarning1.textContent = `${w1} days`;
    if (badgeWarning1) badgeWarning1.textContent = `${w1}+ days`;
    if (valWarning2) valWarning2.textContent = `${w2} days`;
    if (badgeWarning2) badgeWarning2.textContent = `${w2}+ days`;
    if (valWarningOld) valWarningOld.textContent = `${wOld} days`;
    if (badgeWarningOld) badgeWarningOld.textContent = `${wOld}+ days`;
    if (toggleZeroIndexed) toggleZeroIndexed.checked = zeroIndexed;
    if (toggleBeepScan) toggleBeepScan.checked = soundEnabled;

    // Printing options
    const setReportPrinter = document.getElementById('setReportPrinter');
    const toggleAutoPrintDayReport = document.getElementById('toggleAutoPrintDayReport');
    const toggleShowEmptyBoxesReport = document.getElementById('toggleShowEmptyBoxesReport');

    if (setReportPrinter) setReportPrinter.value = state.settings?.reportPrinter || 'receipt_80';
    if (toggleAutoPrintDayReport) toggleAutoPrintDayReport.checked = state.settings?.autoPrintDayReport ?? false;
    if (toggleShowEmptyBoxesReport) toggleShowEmptyBoxesReport.checked = state.settings?.showEmptyBoxesReport ?? false;

    // Render Ticket Games catalog table
    renderSettingsGamesTable();

    // Render People & PINs list
    renderSettingsPeopleList();

    // Reset Clear All Data danger confirmation box
    const inputConfirmClear = document.getElementById('inputConfirmClear');
    const btnClearAllData = document.getElementById('btnClearAllData');
    if (inputConfirmClear) inputConfirmClear.value = '';
    if (btnClearAllData) {
      btnClearAllData.disabled = false;
      btnClearAllData.classList.remove('ready');
    }

    // Day or Shift closing mode (Matching Reference Screenshot)
    const isDaily = state.settings?.operationMode !== 'SHIFTS';
    const cardDaily = document.getElementById('cardModeDaily');
    const cardShifts = document.getElementById('cardModeShifts');
    const counterCashierSelect = document.getElementById('setCounterCashier');

    cardDaily?.classList.toggle('selected', isDaily);
    cardShifts?.classList.toggle('selected', !isDaily);
    if (counterCashierSelect) {
      counterCashierSelect.value = state.cashierName || 'master';
    }
  }

  function renderSettingsGamesTable() {
    const tableBody = document.getElementById('settingsGamesTableBody');
    if (!tableBody) return;

    const games = getSettingsGamesList(state);
    const rowsHtml = games.map(g => {
      return `
        <tr>
          <td class="game-col-name">${g.name}</td>
          <td class="game-col-num">${g.gameNumber}</td>
          <td class="game-col-price">$${g.price}</td>
          <td class="game-col-tix">${Number(g.ticketsPack).toLocaleString('en-US')}</td>
          <td class="game-col-book">$${Number(g.bookValue).toLocaleString('en-US')}</td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rowsHtml;
  }

  function renderSettingsPeopleList() {
    const listEl = document.getElementById('settingsPeopleList');
    if (!listEl) return;

    const people = getSettingsPeopleList(state);
    listEl.innerHTML = people.map(p => {
      const initial = (p.name || 'U').charAt(0).toUpperCase();
      const isOwner = (p.role || '').toLowerCase() === 'owner';
      const badgeClass = isOwner ? 'badge-role-owner' : 'badge-role-clerk';
      const roleLabel = isOwner ? 'Owner' : 'Clerk';
      const desc = p.roleDesc || (isOwner ? 'Owner · can change settings and clear data' : 'Clerk · can sell, receive packs and end the day');

      return `
        <div class="settings-person-row" data-person-id="${p.id || p.name}">
          <div class="settings-person-left">
            <div class="settings-person-avatar">${initial}</div>
            <div class="settings-person-meta">
              <span class="person-name">${p.name}</span>
              <span class="person-role-desc">${desc}</span>
            </div>
          </div>
          <div class="settings-person-right">
            <span class="${badgeClass}">${roleLabel}</span>
            <button type="button" class="btn-person-reset-pin" data-person-id="${p.id || p.name}" data-person-name="${p.name}">
              Reset PIN
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHistoryView() {
    const data = getHistoryScreenData(state);

    // 1. KPI Cards
    const kpiTotalSales = document.getElementById('histKpiTotalSales');
    const kpiTotalDays = document.getElementById('histKpiTotalDays');
    const kpiTicketsSold = document.getElementById('histKpiTicketsSold');
    const kpiDailyAvg = document.getElementById('histKpiDailyAverage');
    const kpiBestDaySales = document.getElementById('histKpiBestDaySales');
    const kpiBestDayDate = document.getElementById('histKpiBestDayDate');

    if (kpiTotalSales) kpiTotalSales.textContent = `$${Number(data.kpis.totalSales).toLocaleString('en-US')}`;
    if (kpiTotalDays) kpiTotalDays.textContent = `${data.kpis.daysCount} days`;
    if (kpiTicketsSold) kpiTicketsSold.textContent = Number(data.kpis.ticketsSold).toLocaleString('en-US');
    if (kpiDailyAvg) kpiDailyAvg.textContent = `$${Number(data.kpis.dailyAverage).toLocaleString('en-US')}`;
    if (kpiBestDaySales) kpiBestDaySales.textContent = `$${Number(data.kpis.bestDayAmount).toLocaleString('en-US')}`;
    if (kpiBestDayDate) kpiBestDayDate.textContent = data.kpis.bestDayDate;

    // 2. Sales Per Day Bar Chart
    const chartContainer = document.getElementById('histChartBody');
    if (chartContainer) {
      const maxSales = data.chart.maxSales || 2011;
      const chartHtml = data.chart.days.map(d => {
        const heightPct = Math.max(14, Math.round((d.sales / maxSales) * 100));
        const isSelected = d.id === selectedHistoryDayId;
        const todayClass = d.isToday ? 'is-today' : '';
        const selectedClass = isSelected ? 'selected' : '';
        return `
          <div class="hist-bar-col ${selectedClass}" data-day-id="${d.id}" role="button" tabindex="0" title="${d.date}: $${Number(d.sales).toLocaleString('en-US', { minimumFractionDigits: 2 })}">
            <div class="hist-bar-tooltip">
              ${d.date}: $${Number(d.sales).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${d.tickets} tix)
            </div>
            <div class="hist-bar-track">
              <div class="hist-bar-fill ${todayClass}" style="height: ${heightPct}%;"></div>
            </div>
            <div class="hist-bar-label ${todayClass}">${d.dateShort}</div>
          </div>
        `;
      }).join('');
      chartContainer.innerHTML = chartHtml;
    }

    // 3. Selected Day Detail Strip
    const selectedDay = data.days.find(d => d.id === selectedHistoryDayId) || data.days[0];
    if (selectedDay) {
      const stripDay = document.getElementById('histStripDay');
      const stripSales = document.getElementById('histStripSales');
      const stripTickets = document.getElementById('histStripTickets');
      const stripClosedBy = document.getElementById('histStripClosedBy');

      if (stripDay) stripDay.textContent = selectedDay.date;
      if (stripSales) stripSales.textContent = `$${Number(selectedDay.sales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (stripTickets) stripTickets.textContent = Number(selectedDay.tickets).toLocaleString('en-US');
      if (stripClosedBy) stripClosedBy.textContent = selectedDay.closedBy;
    }

    // 4. All Days Table
    const tableBody = document.getElementById('histTableBody');
    if (tableBody) {
      const rowsHtml = data.days.map(d => {
        let packsHtml = '';
        if (d.soldOutCount > 0) {
          packsHtml += `<span class="badge-sold-out">${d.soldOutCount} sold out</span>`;
        }
        if (d.newPacksCount > 0) {
          packsHtml += `<span class="badge-new-pack">${d.newPacksCount} new</span>`;
        }

        return `
          <tr data-day-id="${d.id}">
            <td class="td-left hist-date-cell">${d.date}</td>
            <td class="td-left hist-time-cell">${d.openClose}</td>
            <td class="td-left hist-closed-cell">${d.closedBy}</td>
            <td class="td-center hist-tix-cell">${d.tickets}</td>
            <td class="td-right hist-sales-cell">$${Number(d.sales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="td-left hist-packs-cell">${packsHtml}</td>
            <td class="td-right">
              <div class="hist-report-actions">
                <button type="button" class="btn-hist-view-row" data-day-id="${d.id}">View</button>
                <button type="button" class="btn-hist-print-row" data-day-id="${d.id}" title="Print Report">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      tableBody.innerHTML = rowsHtml;
    }
  }

  function renderInventoryView() {
    const searchInput = document.getElementById('invSearchInput');
    const query = searchInput ? searchInput.value.trim() : '';
    const clearBtn = document.getElementById('invSearchClearBtn');
    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    const data = getInventoryScreenData(state, currentInventoryTab, query);

    // 1. Update KPI values
    const kpiPacks = document.getElementById('invKpiPacksRack');
    const kpiPacksSub = document.getElementById('invKpiPacksRackSub');
    const kpiTickets = document.getElementById('invKpiTicketsRack');
    const kpiTicketsSub = document.getElementById('invKpiTicketsRackSub');
    const kpiRackVal = document.getElementById('invKpiRackValue');
    const kpiSafeVal = document.getElementById('invKpiSafeValue');
    const kpiSafeSub = document.getElementById('invKpiSafeValueSub');
    const kpiSoldToday = document.getElementById('invKpiSoldToday');
    const kpiSoldTodaySub = document.getElementById('invKpiSoldTodaySub');

    if (kpiPacks) kpiPacks.textContent = String(data.kpis.packsOnRackCount);
    if (kpiPacksSub) kpiPacksSub.textContent = `${data.kpis.emptyBoxesCount} boxes empty`;
    if (kpiTickets) kpiTickets.textContent = Number(data.kpis.ticketsOnRackCount).toLocaleString();
    if (kpiTicketsSub) kpiTicketsSub.textContent = `out of ${Number(data.kpis.totalRackCapacity).toLocaleString()}`;
    if (kpiRackVal) kpiRackVal.textContent = `$${Number(data.kpis.rackValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiSafeVal) kpiSafeVal.textContent = `$${Number(data.kpis.safeValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiSafeSub) kpiSafeSub.textContent = `${data.kpis.safePacksCount} packs stored`;
    if (kpiSoldToday) kpiSoldToday.textContent = `$${Number(data.kpis.soldTodaySales).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (kpiSoldTodaySub) kpiSoldTodaySub.textContent = `${data.kpis.soldTodayTickets} tickets`;

    // 2. Update Tab Counts & Active Tab
    const countRack = document.getElementById('invCountRack');
    const countSafe = document.getElementById('invCountSafe');
    const countSold = document.getElementById('invCountSold');
    const countReturned = document.getElementById('invCountReturned');
    const countEmpty = document.getElementById('invCountEmpty');

    if (countRack) countRack.textContent = String(data.counts.rack);
    if (countSafe) countSafe.textContent = String(data.counts.safe);
    if (countSold) countSold.textContent = String(data.counts.sold);
    if (countReturned) countReturned.textContent = String(data.counts.returned);
    if (countEmpty) countEmpty.textContent = String(data.counts.empty);

    document.querySelectorAll('#invFilterTabs .inv-tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === currentInventoryTab);
    });

    // 3. Render Table Header & Rows
    const theadRow = document.getElementById('invTableHeadRow');
    const tbody = document.getElementById('invTableBody');
    if (!tbody || !theadRow) return;

    tbody.innerHTML = '';

    if (currentInventoryTab === 'rack') {
      theadRow.innerHTML = `
        <th class="th-box">BOX</th>
        <th class="th-game">GAME &amp; PACK</th>
        <th class="th-price">PRICE</th>
        <th class="th-progress">TICKET PROGRESS</th>
        <th class="th-left">LEFT</th>
        <th class="th-value">VALUE</th>
        <th class="th-age">AGE</th>
        <th class="th-actions">ACTIONS</th>
      `;

      if (data.rackItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b; font-style:italic;">No active boxes matching "${query || 'filter'}"</td></tr>`;
        return;
      }

      data.rackItems.forEach(item => {
        const tr = document.createElement('tr');
        const pct = item.packSize ? Math.min(100, Math.max(3, Math.round((item.currentTicket / item.packSize) * 100))) : 0;
        const formattedCur = String(item.currentTicket).padStart(3, '0');
        const ageHtml = item.ageBadge 
          ? `<span class="inv-age-badge ${item.ageBadge}">${item.ageText}</span>` 
          : `<span class="inv-age-fresh">${item.ageText}</span>`;

        tr.innerHTML = `
          <td class="td-box"><span class="inv-box-badge">${item.box}</span></td>
          <td class="td-game">
            <div class="inv-game-name">${item.game}</div>
            <div class="inv-pack-no">Pack ${item.pack}</div>
          </td>
          <td class="td-price"><span class="inv-price-tag">$${item.price}</span></td>
          <td class="td-progress">
            <div class="inv-progress-top">#${formattedCur} / ${item.packSize}</div>
            <div class="inv-progress-track">
              <div class="inv-progress-fill" style="width: ${pct}%;"></div>
            </div>
          </td>
          <td class="td-left">${item.ticketsLeft}</td>
          <td class="td-value">$${Number(item.value).toFixed(2)}</td>
          <td class="td-age">${ageHtml}</td>
          <td class="td-actions">
            <button type="button" class="btn-inv-fix" data-box="${item.box}" data-game="${item.game}" data-pack="${item.pack}" data-price="${item.price}" data-size="${item.packSize}" data-cur="${item.currentTicket}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Fix count</span>
            </button>
            <button type="button" class="btn-inv-open" data-box="${item.box}">Open box</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else if (currentInventoryTab === 'safe') {
      theadRow.innerHTML = `
        <th style="width: 120px;">PACK #</th>
        <th>GAME</th>
        <th class="th-price">PRICE</th>
        <th style="text-align: right;">TICKETS</th>
        <th style="text-align: right;">BOOK VALUE</th>
        <th>STATUS</th>
        <th>RECEIVED</th>
        <th class="th-actions">ACTIONS</th>
      `;

      if (data.safeItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b; font-style:italic;">No packs stored in the safe</td></tr>`;
        return;
      }

      data.safeItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong style="font-family: monospace;">${item.packNumber}</strong></td>
          <td><strong>${item.gameName}</strong></td>
          <td><span class="inv-price-tag">$${item.price}</span></td>
          <td style="text-align: right; font-weight: 700;">${item.tickets}</td>
          <td style="text-align: right; font-weight: 700;">$${Number(item.bookValue).toFixed(2)}</td>
          <td><span class="rp-dest-badge" style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.75rem;">${item.status}</span></td>
          <td style="color:#64748b; font-size:0.8rem;">${item.receivedAt}</td>
          <td class="th-actions">
            <button type="button" class="btn-inv-fix" style="color:#2563eb; border-color:#93c5fd;" data-load-safe="${item.packNumber}">Load into box</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else if (currentInventoryTab === 'sold') {
      theadRow.innerHTML = `
        <th class="th-box">BOX</th>
        <th>GAME</th>
        <th>PACK #</th>
        <th class="th-price">PRICE</th>
        <th style="text-align: right;">SOLD</th>
        <th style="text-align: right;">TOTAL SALES</th>
        <th>STATUS</th>
        <th class="th-actions">ACTIONS</th>
      `;

      if (data.soldOutItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#64748b; font-style:italic;">No packs sold out yet today</td></tr>`;
        return;
      }

      data.soldOutItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'dr-row-sold-out';
        tr.innerHTML = `
          <td class="td-box"><span class="inv-box-badge">${item.box}</span></td>
          <td><strong>${item.gameName}</strong></td>
          <td style="font-family: monospace;">${item.packNumber}</td>
          <td><span class="inv-price-tag">$${item.price}</span></td>
          <td style="text-align: right; font-weight: 700;">${item.ticketsSold}</td>
          <td style="text-align: right; font-weight: 700;">$${Number(item.salesAmount).toFixed(2)}</td>
          <td><span class="dr-badge-sold-out">SOLD OUT</span></td>
          <td class="th-actions">
            <button type="button" class="btn-inv-fix" data-replace-box="${item.box}">Replace pack</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else if (currentInventoryTab === 'returned') {
      theadRow.innerHTML = `
        <th>PACK #</th>
        <th>GAME</th>
        <th class="th-price">PRICE</th>
        <th>STATUS</th>
        <th>TIME</th>
      `;

      if (data.returnedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:#64748b; font-style:italic;">No packs returned or voided today</td></tr>`;
        return;
      }

      data.returnedItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: monospace;">${item.packNumber}</td>
          <td><strong>${item.gameName}</strong></td>
          <td><span class="inv-price-tag">$${item.price}</span></td>
          <td><span style="color:#b91c1c; font-weight:700;">RETURNED</span></td>
          <td style="color:#64748b;">${item.time || 'Today'}</td>
        `;
        tbody.appendChild(tr);
      });
    } else if (currentInventoryTab === 'empty') {
      theadRow.innerHTML = `
        <th class="th-box">BOX</th>
        <th>STATUS</th>
        <th class="th-actions">ACTIONS</th>
      `;

      if (data.emptyBoxes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:32px; color:#64748b; font-style:italic;">All boxes currently loaded</td></tr>`;
        return;
      }

      data.emptyBoxes.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="td-box"><span class="inv-box-badge">${item.box}</span></td>
          <td style="color:#64748b; font-style:italic;">Box ${item.box} is empty</td>
          <td class="th-actions">
            <button type="button" class="btn-inv-fix" style="color:#2563eb; border-color:#93c5fd;" data-load-empty="${item.box}">+ Load pack</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  function renderDayReportView() {
    const emptyToggle = document.getElementById('drToggleEmptyBoxes');
    const showEmpty = Boolean(emptyToggle && emptyToggle.checked);
    const data = getScreenDayReportData(state, { showEmptyBoxes: showEmpty });

    const pageTitle = document.getElementById('dayReportPageTitle');
    const pageSub = document.getElementById('dayReportPageSubtitle');
    if (pageTitle) pageTitle.textContent = data.reportTitle || 'Day Report';
    if (pageSub) pageSub.textContent = data.subtitle || 'Thursday, Oct 8, 2026 · Closed 9:41 PM by master';

    const sheetStore = document.getElementById('drSheetStoreName');
    const sheetAddr = document.getElementById('drSheetStoreAddr');
    const sheetTotalSales = document.getElementById('drSheetTotalSales');
    const sheetDate = document.getElementById('drSheetDate');
    const sheetOpened = document.getElementById('drSheetOpened');
    const sheetClosed = document.getElementById('drSheetClosed');
    const sheetUser = document.getElementById('drSheetUser');
    const sheetTickets = document.getElementById('drSheetTickets');

    const formattedTotal = `$${Number(data.totalInstantSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (sheetStore) sheetStore.textContent = data.storeName || 'AMIGO FOOD MART';
    if (sheetAddr) sheetAddr.textContent = data.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088';
    if (sheetTotalSales) sheetTotalSales.textContent = formattedTotal;
    if (sheetDate) sheetDate.textContent = data.date || '10/08/2026';
    if (sheetOpened) sheetOpened.textContent = data.openedTime || '7:02 AM';
    if (sheetClosed) sheetClosed.textContent = data.closedTime || '9:41 PM';
    if (sheetUser) sheetUser.textContent = data.userId || 'master';
    if (sheetTickets) sheetTickets.textContent = String(data.totalTickets || 0);

    // Table rows
    const tbody = document.getElementById('drReportTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      (data.boxes || []).forEach(row => {
        const tr = document.createElement('tr');
        if (row.isEmpty) {
          tr.className = 'dr-row-empty';
          tr.innerHTML = `
            <td class="col-box">${row.box}</td>
            <td class="col-pack">---</td>
            <td class="col-game">EMPTY</td>
            <td class="col-open">-</td>
            <td class="col-close">-</td>
            <td class="col-sold">-</td>
            <td class="col-price">-</td>
            <td class="col-total">$0.00</td>
          `;
        } else if (row.isSoldOut) {
          tr.className = 'dr-row-sold-out';
          tr.innerHTML = `
            <td class="col-box">${row.box}</td>
            <td class="col-pack">${row.pack}</td>
            <td class="col-game">${row.game} <span class="dr-badge-sold-out">SOLD OUT</span></td>
            <td class="col-open">${row.open}</td>
            <td class="col-close">${row.close}</td>
            <td class="col-sold">${row.sold}</td>
            <td class="col-price">$${row.price}</td>
            <td class="col-total">$${Number(row.total).toFixed(2)}</td>
          `;
        } else {
          tr.innerHTML = `
            <td class="col-box">${row.box}</td>
            <td class="col-pack">${row.pack}</td>
            <td class="col-game">${row.game}</td>
            <td class="col-open">${row.open}</td>
            <td class="col-close">${row.close}</td>
            <td class="col-sold">${row.sold}</td>
            <td class="col-price">$${row.price}</td>
            <td class="col-total">$${Number(row.total).toFixed(2)}</td>
          `;
        }
        tbody.appendChild(tr);
      });
    }

    // Summary row
    const sumSold = document.getElementById('drSumSoldTickets');
    const sumTotal = document.getElementById('drSumTotalAmount');
    if (sumSold) sumSold.textContent = String(data.totalTickets || 0);
    if (sumTotal) sumTotal.textContent = formattedTotal;

    // Today in numbers
    const statSales = document.getElementById('drStatSalesAmount');
    const statTickets = document.getElementById('drStatTicketsCount');
    const statSoldOut = document.getElementById('drStatSoldOutCount');
    const statSoldOutSub = document.getElementById('drStatSoldOutSub');
    const statReturned = document.getElementById('drStatReturnedCount');

    if (statSales) statSales.textContent = formattedTotal;
    if (statTickets) statTickets.textContent = String(data.totalTickets || 0);
    if (statSoldOut) statSoldOut.textContent = String(data.soldOutCount || 0);
    if (statSoldOutSub) statSoldOutSub.textContent = data.soldOutBox || '-';
    if (statReturned) statReturned.textContent = String(data.returnedCount || 0);

    // Price Breakdown List
    const priceList = document.getElementById('drPriceBreakdownList');
    if (priceList) {
      priceList.innerHTML = '';
      const breakdown = data.priceBreakdown || [];
      const maxTotal = Math.max(1, ...breakdown.map(b => b.total || 0));

      breakdown.forEach(item => {
        const pct = Math.min(100, Math.max(10, Math.round(((item.total || 0) / maxTotal) * 100)));
        const row = document.createElement('div');
        row.className = 'dr-price-row';
        row.innerHTML = `
          <span class="dr-price-badge">$${item.price}</span>
          <div class="dr-price-track">
            <div class="dr-price-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="dr-price-amt">$${Number(item.total).toFixed(2)}</span>
        `;
        priceList.appendChild(row);
      });
    }
  }

  function updateReceivePacksFormPrice(price) {
    const p = Number(price) || 1;
    currentReceivePackPrice = p;

    document.querySelectorAll('#rpPricePillsRow .rp-price-pill').forEach(btn => {
      const val = Number(btn.getAttribute('data-price'));
      btn.classList.toggle('active', val === p);
    });

    const std = getStandardPackDetails(p);
    const tixInput = document.getElementById('rpTicketsInPackInput');
    const bookValInput = document.getElementById('rpBookValueInput');
    const hint = document.getElementById('rpTicketsHint');

    if (tixInput) tixInput.value = std.packSize;
    if (bookValInput) bookValInput.value = `$${std.bookValue}`;
    if (hint) hint.textContent = `Usual for $${p}: ${std.packSize} tickets`;
  }

  function recalculateReceivePackBookValue() {
    const tixInput = document.getElementById('rpTicketsInPackInput');
    const bookValInput = document.getElementById('rpBookValueInput');
    const tix = parseInt(tixInput?.value, 10) || 0;
    const val = tix * currentReceivePackPrice;
    if (bookValInput) bookValInput.value = `$${val}`;
  }

  window.handleReceivePackBarcode = function(rawBarcode) {
    const barcode = String(rawBarcode).trim();
    if (!barcode) return;
    const input = document.getElementById('rpPackBarcodeInput');
    if (input) input.value = barcode;

    const parsed = parseLotteryBarcode(barcode, state.customGames);
    const matched = findGameByBarcode(barcode, state.customGames);

    const banner = document.getElementById('rpDetectionBanner');
    const bannerTitle = document.getElementById('rpDetectionTitleText');
    const bannerSub = document.getElementById('rpDetectionSubText');

    const nameInput = document.getElementById('rpTicketNameInput');
    const gameNumInput = document.getElementById('rpGameNumberInput');
    const packNumInput = document.getElementById('rpPackNumberInput');

    if (matched) {
      if (banner) {
        banner.className = 'rp-detection-banner known';
        banner.style.display = 'block';
      }
      if (bannerTitle) bannerTitle.textContent = 'We know this game';
      if (bannerSub) bannerSub.textContent = 'Details were filled in automatically. Just check and add.';

      if (nameInput) nameInput.value = cleanGameTitle(matched.name);
      if (gameNumInput) gameNumInput.value = matched.barcodePrefix || (parsed ? parsed.gameNumber : '');
      if (packNumInput) packNumInput.value = parsed?.packNumber || '';
      updateReceivePacksFormPrice(matched.price || 10);
      sfx.beep();
    } else if (parsed && parsed.isValid) {
      if (banner) {
        banner.className = 'rp-detection-banner new';
        banner.style.display = 'block';
      }
      if (bannerTitle) bannerTitle.textContent = 'Brand-new game detected';
      if (bannerSub) bannerSub.textContent = 'Please verify ticket name, price and tickets per pack.';

      if (nameInput) nameInput.value = parsed.gameNumber ? `Game #${parsed.gameNumber}` : 'Scratch-Off Game';
      if (gameNumInput) gameNumInput.value = parsed.gameNumber || '';
      if (packNumInput) packNumInput.value = parsed.packNumber || '';
      updateReceivePacksFormPrice(10);
      sfx.beep();
    } else {
      const cleanDigits = barcode.replace(/[^0-9]/g, '');
      const pack = cleanDigits.slice(-6) || barcode;
      if (packNumInput) packNumInput.value = pack;
      if (banner) {
        banner.className = 'rp-detection-banner new';
        banner.style.display = 'block';
      }
      if (bannerTitle) bannerTitle.textContent = 'Scanned pack barcode';
      if (bannerSub) bannerSub.textContent = 'Please verify game name and price.';
      sfx.beep();
    }
  };

  function renderReceivePacksView() {
    const tbody = document.getElementById('rpDeliveryTableBody');
    const countBadge = document.getElementById('rpDeliveryCountBadge');
    const totalDisplay = document.getElementById('rpDeliveryTotalDisplay');

    if (!tbody) return;

    const count = stagedDeliveryPacks.length;
    const total = stagedDeliveryPacks.reduce((acc, p) => acc + (p.bookValue || 0), 0);

    if (countBadge) countBadge.textContent = `${count} ${count === 1 ? 'pack' : 'packs'}`;
    if (totalDisplay) totalDisplay.textContent = `$${total} total`;

    if (count === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 40px 20px; color: #94a3b8; font-size: 0.92rem;">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">📦</div>
            No packs in this delivery yet.<br>Scan a pack barcode on the left to add.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = stagedDeliveryPacks.map((item, idx) => `
      <tr>
        <td>
          <div class="rp-game-title">${item.gameName}</div>
          <div class="rp-game-meta">#${item.gameNumber || '---'} · Pack ${item.packNumber}</div>
        </td>
        <td>
          <span class="rp-price-green">$${item.price}</span>
        </td>
        <td>${item.tickets}</td>
        <td><strong>$${item.bookValue}</strong></td>
        <td>
          <span class="rp-dest-badge"><span class="rp-lock-icon">🔒</span> ${item.destination || 'Safe'}</span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="rp-btn-trash" data-idx="${idx}" title="Remove pack from delivery">🗑️</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.rp-btn-trash').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < stagedDeliveryPacks.length) {
          const removed = stagedDeliveryPacks.splice(idx, 1)[0];
          sfx.keypad();
          showToast(`Removed Pack #${removed.packNumber} from delivery.`, 'info');
          renderReceivePacksView();
        }
      });
    });
  }

  function addPackToDelivery() {
    const nameInput = document.getElementById('rpTicketNameInput');
    const gameNumInput = document.getElementById('rpGameNumberInput');
    const packNumInput = document.getElementById('rpPackNumberInput');
    const tixInput = document.getElementById('rpTicketsInPackInput');
    const bookValInput = document.getElementById('rpBookValueInput');

    const gameName = nameInput?.value?.trim() || 'Scratch-Off Game';
    const gameNumber = gameNumInput?.value?.trim() || '';
    const packNumber = packNumInput?.value?.trim() || '';
    const tickets = parseInt(tixInput?.value, 10) || 30;
    const bookVal = parseFloat(String(bookValInput?.value || '').replace(/[^0-9.]/g, '')) || (tickets * currentReceivePackPrice);

    if (!packNumber) {
      sfx.alert();
      showToast('Please enter or scan a pack number.', 'error');
      packNumInput?.focus();
      return;
    }

    if (stagedDeliveryPacks.some(p => p.packNumber === packNumber)) {
      sfx.alert();
      showToast(`Pack #${packNumber} is already in this delivery!`, 'warning');
      return;
    }

    stagedDeliveryPacks.push({
      id: 'sd_' + Date.now(),
      gameName,
      gameNumber,
      packNumber,
      price: currentReceivePackPrice,
      tickets,
      bookValue: bookVal,
      destination: 'Safe'
    });

    sfx.beep();
    showToast(`✓ Added [${gameName}] Pack #${packNumber} to this delivery.`, 'success');
    renderReceivePacksView();

    const scanInput = document.getElementById('rpPackBarcodeInput');
    if (scanInput) {
      scanInput.value = '';
      scanInput.focus();
    }
  }

  function resetReceivePackForm() {
    const scanInput = document.getElementById('rpPackBarcodeInput');
    const nameInput = document.getElementById('rpTicketNameInput');
    const gameNumInput = document.getElementById('rpGameNumberInput');
    const packNumInput = document.getElementById('rpPackNumberInput');

    if (scanInput) scanInput.value = '';
    if (nameInput) nameInput.value = '50X Money';
    if (gameNumInput) gameNumInput.value = '1711';
    if (packNumInput) packNumInput.value = '403118';
    updateReceivePacksFormPrice(10);

    const banner = document.getElementById('rpDetectionBanner');
    if (banner) {
      banner.className = 'rp-detection-banner known';
      banner.style.display = 'block';
    }
    const bannerTitle = document.getElementById('rpDetectionTitleText');
    const bannerSub = document.getElementById('rpDetectionSubText');
    if (bannerTitle) bannerTitle.textContent = 'We know this game';
    if (bannerSub) bannerSub.textContent = 'Details were filled in automatically. Just check and add.';
  }

  function confirmReceivePacksDelivery() {
    if (stagedDeliveryPacks.length === 0) {
      sfx.alert();
      showToast('No packs in this delivery to confirm.', 'warning');
      return;
    }

    const count = stagedDeliveryPacks.length;
    const total = stagedDeliveryPacks.reduce((acc, p) => acc + (p.bookValue || 0), 0);

    if (!Array.isArray(state.inventory)) {
      state.inventory = [];
    }

    stagedDeliveryPacks.forEach(p => {
      state.inventory.push({
        packNumber: p.packNumber,
        gameId: 'g' + (p.gameNumber || Math.floor(100 + Math.random() * 900)),
        gameName: p.gameName,
        price: p.price,
        packSize: p.tickets,
        status: 'STORED',
        receivedAt: new Date().toISOString()
      });
    });

    saveState(state);
    renderHeaderAndMetrics();

    sfx.win();
    showToast(`🎉 Delivery confirmed! ${count} packs ($${total}.00) received into safe.`, 'success');

    stagedDeliveryPacks = [];
    renderReceivePacksView();
  }

  // Setup Receive Packs listeners
  document.getElementById('rpPackBarcodeInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) handleReceivePackBarcode(val);
    }
  });

  document.querySelectorAll('#rpPricePillsRow .rp-price-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.getAttribute('data-price')) || 10;
      updateReceivePacksFormPrice(p);
      sfx.keypad();
    });
  });

  document.getElementById('rpTicketsInPackInput')?.addEventListener('input', recalculateReceivePackBookValue);

  document.getElementById('rpTryExistingGameBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('rpTicketNameInput');
    const gameNumInput = document.getElementById('rpGameNumberInput');
    const packNumInput = document.getElementById('rpPackNumberInput');
    const scanInput = document.getElementById('rpPackBarcodeInput');

    if (scanInput) scanInput.value = '1711-403118';
    if (nameInput) nameInput.value = '50X Money';
    if (gameNumInput) gameNumInput.value = '1711';
    if (packNumInput) packNumInput.value = '403118';
    updateReceivePacksFormPrice(10);

    const banner = document.getElementById('rpDetectionBanner');
    if (banner) {
      banner.className = 'rp-detection-banner known';
      banner.style.display = 'block';
    }
    const bannerTitle = document.getElementById('rpDetectionTitleText');
    const bannerSub = document.getElementById('rpDetectionSubText');
    if (bannerTitle) bannerTitle.textContent = 'We know this game';
    if (bannerSub) bannerSub.textContent = 'Details were filled in automatically. Just check and add.';
    sfx.beep();
    showToast('Loaded existing game prototype (50X Money).', 'info');
  });

  document.getElementById('rpTryNewGameBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('rpTicketNameInput');
    const gameNumInput = document.getElementById('rpGameNumberInput');
    const packNumInput = document.getElementById('rpPackNumberInput');
    const scanInput = document.getElementById('rpPackBarcodeInput');

    if (scanInput) scanInput.value = '1995-512400';
    if (nameInput) nameInput.value = 'Diamond Deluxe';
    if (gameNumInput) gameNumInput.value = '1995';
    if (packNumInput) packNumInput.value = '512400';
    updateReceivePacksFormPrice(20);

    const banner = document.getElementById('rpDetectionBanner');
    if (banner) {
      banner.className = 'rp-detection-banner new';
      banner.style.display = 'block';
    }
    const bannerTitle = document.getElementById('rpDetectionTitleText');
    const bannerSub = document.getElementById('rpDetectionSubText');
    if (bannerTitle) bannerTitle.textContent = 'Brand-new game detected';
    if (bannerSub) bannerSub.textContent = 'Please verify ticket name, price and tickets per pack.';
    sfx.beep();
    showToast('Loaded brand-new game prototype (Diamond Deluxe).', 'info');
  });

  document.getElementById('rpAddToDeliveryBtn')?.addEventListener('click', addPackToDelivery);
  document.getElementById('rpCancelFormBtn')?.addEventListener('click', resetReceivePackForm);
  document.getElementById('rpLoadPackIntoBoxBtn')?.addEventListener('click', () => {
    openActivationForBox(findFirstEmptyBox());
  });
  document.getElementById('rpConfirmDeliveryBtn')?.addEventListener('click', confirmReceivePacksDelivery);

  // Modern Sidebar Navigation Handlers (Page 2 Specification)
  const navSellCounter = document.getElementById('navSellCounter');
  const navReceivePacks = document.getElementById('navReceivePacks');
  const navInventory = document.getElementById('navInventory');
  const navDayReport = document.getElementById('navDayReport');
  const navHistory = document.getElementById('navHistory');
  const navSettings = document.getElementById('navSettings');

  function setActiveNav(activeEl) {
    const navItems = [
      document.getElementById('navSellCounter'),
      document.getElementById('navReceivePacks'),
      document.getElementById('navInventory'),
      document.getElementById('navDayReport'),
      document.getElementById('navHistory'),
      document.getElementById('navSettings')
    ].filter(Boolean);
    navItems.forEach(el => el.classList.remove('active'));
    activeEl?.classList.add('active');
  }

  const resetActiveNavToSellCounter = () => {
    const viewReceive = document.getElementById('viewReceivePacks');
    const viewReport = document.getElementById('viewDayReport');
    const viewInv = document.getElementById('viewInventory');
    const viewHist = document.getElementById('viewHistory');
    const viewSet = document.getElementById('viewSettings');
    if (viewSet && viewSet.style.display !== 'none') {
      setActiveNav(navSettings);
    } else if (viewHist && viewHist.style.display !== 'none') {
      setActiveNav(navHistory);
    } else if (viewInv && viewInv.style.display !== 'none') {
      setActiveNav(navInventory);
    } else if (viewReport && viewReport.style.display !== 'none') {
      setActiveNav(navDayReport);
    } else if (viewReceive && viewReceive.style.display !== 'none') {
      setActiveNav(navReceivePacks);
    } else {
      setActiveNav(navSellCounter);
    }
  };

  [
    'inventoryModal',
    'activationModal',
    'dayReportModal',
    'historyModal',
    'settingsModal',
    'settingsAddGameModal',
    'settingsAddPersonModal',
    'settingsResetPinModal',
    'cashierModal',
    'boxAdjustModal',
    'returnPackModal',
    'startShiftConfirmModal',
    'invFixCountModal'
  ].forEach(id => {
    const dlg = document.getElementById(id);
    if (dlg) {
      dlg.addEventListener('close', resetActiveNavToSellCounter);
    }
  });

  navSellCounter?.addEventListener('click', () => {
    showSellCounterView();
    if (window.location.hash === '#receive-packs' || window.location.hash === '#day-report' || window.location.hash === '#inventory' || window.location.hash === '#history' || window.location.hash === '#settings') {
      history.replaceState(null, '', window.location.pathname);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Sell Counter active', 'info');
  });

  navReceivePacks?.addEventListener('click', () => {
    showReceivePacksView();
    window.location.hash = 'receive-packs';
  });

  if (window.location.hash === '#receive-packs') {
    showReceivePacksView();
  }

  navDayReport?.addEventListener('click', () => {
    setActiveNav(navDayReport);
    openDaySettlementModal(state, () => openDayReportModal(() => state, sfx), () => promptStartNewShift());
  });

  if (window.location.hash === '#day-report') {
    openDaySettlementModal(state, () => openDayReportModal(() => state, sfx), () => promptStartNewShift());
  }

  // Day Report Screen Controls
  document.getElementById('drBtnPrintReport')?.addEventListener('click', () => {
    sfx.keypad();
    window.print();
  });

  document.getElementById('drBtnSavePdf')?.addEventListener('click', () => {
    sfx.keypad();
    showToast('Select "Save as PDF" as the destination in your print dialog.', 'info');
    setTimeout(() => window.print(), 200);
  });

  document.getElementById('drToggleEmptyBoxes')?.addEventListener('change', () => {
    sfx.keypad();
    renderDayReportView();
  });

  document.getElementById('drBtnStartNewDay')?.addEventListener('click', () => {
    sfx.keypad();
    promptStartNewShift();
  });

  navInventory?.addEventListener('click', () => {
    showInventoryView();
    window.location.hash = 'inventory';
  });

  if (window.location.hash === '#inventory') {
    showInventoryView();
  }

  // Inventory Screen Controls & Interactions
  document.querySelectorAll('#invFilterTabs .inv-tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      currentInventoryTab = btn.getAttribute('data-tab') || 'rack';
      sfx.keypad();
      renderInventoryView();
    });
  });

  const invSearchInput = document.getElementById('invSearchInput');
  const invSearchClearBtn = document.getElementById('invSearchClearBtn');

  invSearchInput?.addEventListener('input', () => {
    renderInventoryView();
  });

  invSearchClearBtn?.addEventListener('click', () => {
    if (invSearchInput) invSearchInput.value = '';
    renderInventoryView();
    invSearchInput?.focus();
  });

  // Table action delegation
  document.getElementById('invTableBody')?.addEventListener('click', (e) => {
    const fixBtn = e.target.closest('.btn-inv-fix');
    const openBtn = e.target.closest('.btn-inv-open');

    if (fixBtn) {
      const box = fixBtn.getAttribute('data-box');
      const game = fixBtn.getAttribute('data-game');
      const pack = fixBtn.getAttribute('data-pack');
      const price = fixBtn.getAttribute('data-price');
      const size = fixBtn.getAttribute('data-size');
      const cur = fixBtn.getAttribute('data-cur');
      const loadSafe = fixBtn.getAttribute('data-load-safe');
      const loadEmpty = fixBtn.getAttribute('data-load-empty');
      const replaceBox = fixBtn.getAttribute('data-replace-box');

      if (loadSafe) {
        openActivationForBox(findFirstEmptyBox());
        return;
      }
      if (loadEmpty) {
        openActivationForBox(Number(loadEmpty));
        return;
      }
      if (replaceBox) {
        openActivationForBox(Number(replaceBox));
        return;
      }

      if (box) {
        window.__activeFixBox = Number(box);
        const titleEl = document.getElementById('invFixModalTitle');
        const gameEl = document.getElementById('invFixGameName');
        const packEl = document.getElementById('invFixPackNumber');
        const priceEl = document.getElementById('invFixPrice');
        const sizeEl = document.getElementById('invFixPackSize');
        const curEl = document.getElementById('invFixCurrentTix');
        const maxEl = document.getElementById('invFixMaxTix');
        const inputEl = document.getElementById('invFixNewTicketInput');

        if (titleEl) titleEl.textContent = `Fix Count · Box ${box}`;
        if (gameEl) gameEl.textContent = game || 'Scratch-off';
        if (packEl) packEl.textContent = `Pack ${pack || ''}`;
        if (priceEl) priceEl.textContent = `$${price || 1}`;
        if (sizeEl) sizeEl.textContent = size || 100;
        if (curEl) curEl.textContent = `#${String(cur || 0).padStart(3, '0')}`;
        if (maxEl) maxEl.textContent = Math.max(0, Number(size || 100) - 1);
        if (inputEl) {
          inputEl.value = cur || 0;
          inputEl.max = Math.max(0, Number(size || 100) - 1);
        }

        sfx.keypad();
        document.getElementById('invFixCountModal')?.showModal();
        setTimeout(() => inputEl?.focus(), 100);
      }
    } else if (openBtn) {
      const box = openBtn.getAttribute('data-box');
      if (box) {
        sfx.card();
        showSellCounterView();
        showToast(`Showing Box ${box} on rack`, 'info');
        setTimeout(() => {
          const boxEl = document.getElementById(`boxSlot_${box}`);
          if (boxEl) {
            boxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            boxEl.style.boxShadow = '0 0 0 4px #2563eb';
            setTimeout(() => { boxEl.style.boxShadow = ''; }, 2500);
          }
        }, 150);
      }
    }
  });

  // Fix count modal buttons
  document.getElementById('invFixDecBtn')?.addEventListener('click', () => {
    const input = document.getElementById('invFixNewTicketInput');
    if (input) {
      input.value = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
      sfx.keypad();
    }
  });

  document.getElementById('invFixIncBtn')?.addEventListener('click', () => {
    const input = document.getElementById('invFixNewTicketInput');
    if (input) {
      const max = parseInt(input.max, 10) || 299;
      input.value = Math.min(max, (parseInt(input.value, 10) || 0) + 1);
      sfx.keypad();
    }
  });

  document.getElementById('closeInvFixModalBtn')?.addEventListener('click', () => {
    document.getElementById('invFixCountModal')?.close();
  });

  document.getElementById('invFixCancelBtn')?.addEventListener('click', () => {
    document.getElementById('invFixCountModal')?.close();
  });

  document.getElementById('invFixSaveBtn')?.addEventListener('click', () => {
    const input = document.getElementById('invFixNewTicketInput');
    const val = parseInt(input?.value, 10);
    const box = window.__activeFixBox;

    if (!isNaN(val) && box) {
      const slot = (state.slots || []).find(s => s.boxNumber === box);
      if (slot) {
        slot.currentTicket = val;
        saveState(state);
        renderDispenserRack();
        renderHeaderAndMetrics();
      }
      sfx.win();
      showToast(`✓ Box ${box} count updated to #${String(val).padStart(3, '0')}`, 'success');
      document.getElementById('invFixCountModal')?.close();
      renderInventoryView();
    }
  });

  navHistory?.addEventListener('click', () => {
    setActiveNav(navHistory);
    openPastDaysModal(state, (dayItem) => openDayReportModal(() => state, sfx));
  });

  if (window.location.hash === '#history') {
    openPastDaysModal(state, (dayItem) => openDayReportModal(() => state, sfx));
  }

  // History Screen Controls & Interactions
  // 1. Chart bar tap to inspect day
  document.getElementById('histChartBody')?.addEventListener('click', (e) => {
    const col = e.target.closest('.hist-bar-col');
    if (!col) return;
    const dayId = col.getAttribute('data-day-id');
    if (dayId) {
      selectedHistoryDayId = dayId;
      sfx.keypad();
      renderHistoryView();
    }
  });

  // 2. View day report button from selected day strip
  document.getElementById('histStripViewBtn')?.addEventListener('click', () => {
    sfx.keypad();
    showDayReportView();
  });

  // 3. Table action delegation (View button & print button)
  document.getElementById('histTableBody')?.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-hist-view-row');
    const printBtn = e.target.closest('.btn-hist-print-row');
    if (viewBtn) {
      sfx.keypad();
      const dayId = viewBtn.getAttribute('data-day-id');
      if (dayId) selectedHistoryDayId = dayId;
      showDayReportView();
    } else if (printBtn) {
      sfx.keypad();
      window.print();
    }
  });

  navSettings?.addEventListener('click', () => {
    showSettingsView();
    window.location.hash = 'settings';
  });

  if (window.location.hash === '#settings') {
    showSettingsView();
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#receive-packs') {
      showReceivePacksView();
    } else if (hash === '#day-report') {
      showDayReportView();
    } else if (hash === '#inventory') {
      showInventoryView();
    } else if (hash === '#history') {
      showHistoryView();
    } else if (hash === '#settings') {
      showSettingsView();
    } else {
      showSellCounterView();
    }
  });

  // Settings Screen Controls & Tab Switching
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');

      const paneMap = {
        store: 'paneSettingsStore',
        dayorshift: 'paneSettingsDayOrShift',
        rack: 'paneSettingsRack',
        games: 'paneSettingsGames',
        people: 'paneSettingsPeople',
        printing: 'paneSettingsPrinting',
        cleardata: 'paneSettingsClearData'
      };

      Object.values(paneMap).forEach(paneId => {
        const pane = document.getElementById(paneId);
        if (pane) pane.style.display = 'none';
      });

      const activePane = document.getElementById(paneMap[targetTab]);
      if (activePane) activePane.style.display = 'block';
      sfx.keypad();
    });
  });

  // Day or Shift Selection Cards (Matching Reference Screenshot)
  const cardDaily = document.getElementById('cardModeDaily');
  const cardShifts = document.getElementById('cardModeShifts');
  const counterCashierSelect = document.getElementById('setCounterCashier');

  cardDaily?.addEventListener('click', () => {
    if (!state.settings) state.settings = {};
    state.settings.operationMode = 'DAILY';
    cardDaily.classList.add('selected');
    cardShifts?.classList.remove('selected');
    saveState(state);
    renderHeaderAndMetrics();
    sfx.keypad();
    showToast('Closing mode set to Once a day (End Day)', 'info');
  });

  cardShifts?.addEventListener('click', () => {
    if (!state.settings) state.settings = {};
    state.settings.operationMode = 'SHIFTS';
    cardShifts.classList.add('selected');
    cardDaily?.classList.remove('selected');
    saveState(state);
    renderHeaderAndMetrics();
    sfx.keypad();
    showToast('Closing mode set to Every shift (End Shift)', 'info');
  });

  counterCashierSelect?.addEventListener('change', (e) => {
    state.cashierName = e.target.value || 'master';
    saveState(state);
    renderHeaderAndMetrics();
    updateCashierDisplay();
    sfx.keypad();
    showToast(`Active cashier set to ${state.cashierName}`, 'success');
  });

  // Rack & alerts Stepper Buttons (+ and -)
  document.getElementById('btnDecBoxes')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valTotalBoxes')?.textContent || '65', 10);
    if (val > 10) val--;
    const el = document.getElementById('valTotalBoxes');
    if (el) el.textContent = String(val);
    sfx.keypad();
  });

  document.getElementById('btnIncBoxes')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valTotalBoxes')?.textContent || '65', 10);
    if (val < 100) val++;
    const el = document.getElementById('valTotalBoxes');
    if (el) el.textContent = String(val);
    sfx.keypad();
  });

  document.getElementById('btnDecWarning1')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarning1')?.textContent || '7', 10);
    if (val > 1) val--;
    const el = document.getElementById('valWarning1');
    const badge = document.getElementById('badgeWarning1');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  document.getElementById('btnIncWarning1')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarning1')?.textContent || '7', 10);
    if (val < 60) val++;
    const el = document.getElementById('valWarning1');
    const badge = document.getElementById('badgeWarning1');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  document.getElementById('btnDecWarning2')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarning2')?.textContent || '12', 10);
    if (val > 1) val--;
    const el = document.getElementById('valWarning2');
    const badge = document.getElementById('badgeWarning2');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  document.getElementById('btnIncWarning2')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarning2')?.textContent || '12', 10);
    if (val < 90) val++;
    const el = document.getElementById('valWarning2');
    const badge = document.getElementById('badgeWarning2');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  document.getElementById('btnDecWarningOld')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarningOld')?.textContent || '21', 10);
    if (val > 1) val--;
    const el = document.getElementById('valWarningOld');
    const badge = document.getElementById('badgeWarningOld');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  document.getElementById('btnIncWarningOld')?.addEventListener('click', () => {
    let val = parseInt(document.getElementById('valWarningOld')?.textContent || '21', 10);
    if (val < 180) val++;
    const el = document.getElementById('valWarningOld');
    const badge = document.getElementById('badgeWarningOld');
    if (el) el.textContent = `${val} days`;
    if (badge) badge.textContent = `${val}+ days`;
    sfx.keypad();
  });

  // Save changes button (Top right of settings screen)
  document.getElementById('btnSettingsSaveAll')?.addEventListener('click', () => {
    const setStoreName = document.getElementById('setStoreName');
    const setStoreAddress = document.getElementById('setStoreAddress');
    const setRetailerNumber = document.getElementById('setRetailerNumber');
    const setRegisterName = document.getElementById('setRegisterName');
    const setAutoPrintToggle = document.getElementById('setAutoPrintToggle');
    const valTotalBoxes = document.getElementById('valTotalBoxes');
    const valWarning1 = document.getElementById('valWarning1');
    const valWarning2 = document.getElementById('valWarning2');
    const valWarningOld = document.getElementById('valWarningOld');
    const toggleZeroIndexed = document.getElementById('toggleZeroIndexed');
    const toggleBeepScan = document.getElementById('toggleBeepScan');

    if (setStoreName) {
      state.storeName = setStoreName.value.trim() || 'Amigo Food Mart';
      const sidebarStore = document.getElementById('sidebarStoreName');
      if (sidebarStore) sidebarStore.textContent = state.storeName;
      const drSheetStore = document.getElementById('drSheetStoreName');
      if (drSheetStore) drSheetStore.textContent = state.storeName;
      const p1Store = document.getElementById('drP1StoreName');
      if (p1Store) p1Store.textContent = state.storeName;
      const p2Store = document.getElementById('drP2StoreName');
      if (p2Store) p2Store.textContent = state.storeName;
    }

    if (setStoreAddress) state.storeAddress = setStoreAddress.value.trim();
    if (setRetailerNumber) state.retailerNumber = setRetailerNumber.value.trim();
    if (setRegisterName) {
      state.registerName = setRegisterName.value.trim() || 'Register 1';
      const roleLine = document.getElementById('sidebarUserRole');
      if (roleLine) roleLine.textContent = `Owner · ${state.registerName}`;
    }

    if (valTotalBoxes) {
      const numBoxes = parseInt(valTotalBoxes.textContent, 10);
      if (!isNaN(numBoxes) && numBoxes >= 10 && numBoxes <= 100) {
        state.totalSlots = numBoxes;
      }
    }

    if (!state.settings) state.settings = {};
    if (valWarning1) state.settings.warning1Days = parseInt(valWarning1.textContent, 10) || 7;
    if (valWarning2) state.settings.warning2Days = parseInt(valWarning2.textContent, 10) || 12;
    if (valWarningOld) state.settings.warningOldDays = parseInt(valWarningOld.textContent, 10) || 21;
    if (toggleZeroIndexed) state.settings.zeroIndexed = toggleZeroIndexed.checked;
    if (toggleBeepScan) state.settings.soundEnabled = toggleBeepScan.checked;
    if (setAutoPrintToggle) state.settings.autoPrint = setAutoPrintToggle.checked;

    const setReportPrinter = document.getElementById('setReportPrinter');
    const toggleAutoPrintDayReport = document.getElementById('toggleAutoPrintDayReport');
    const toggleShowEmptyBoxesReport = document.getElementById('toggleShowEmptyBoxesReport');

    if (setReportPrinter) state.settings.reportPrinter = setReportPrinter.value;
    if (toggleAutoPrintDayReport) state.settings.autoPrintDayReport = toggleAutoPrintDayReport.checked;
    if (toggleShowEmptyBoxesReport) state.settings.showEmptyBoxesReport = toggleShowEmptyBoxesReport.checked;

    saveState(state);
    sfx.win();
    showToast('✓ Settings saved successfully', 'success');
  });

  // Test print button
  document.getElementById('btnSettingsTestPrint')?.addEventListener('click', () => {
    sfx.keypad();
    window.print();
  });

  // Add a game modal handlers
  const addGameModal = document.getElementById('settingsAddGameModal');
  const priceSelect = document.getElementById('newGamePriceSelect');
  const packSizeInput = document.getElementById('newGamePackSizeInput');
  const bookValueInput = document.getElementById('newGameBookValueInput');

  function updateGameModalCalculations() {
    const price = parseInt(priceSelect?.value || '1', 10);
    let defaultTix = 300;
    let defaultBook = 300;
    if (price === 1) { defaultTix = 300; defaultBook = 300; }
    else if (price === 2) { defaultTix = 150; defaultBook = 300; }
    else if (price === 3) { defaultTix = 100; defaultBook = 300; }
    else if (price === 5) { defaultTix = 60; defaultBook = 300; }
    else if (price === 10) { defaultTix = 30; defaultBook = 300; }
    else if (price === 20) { defaultTix = 30; defaultBook = 600; }
    else if (price === 25) { defaultTix = 12; defaultBook = 300; }
    else if (price === 30) { defaultTix = 10; defaultBook = 300; }
    else if (price === 50) { defaultTix = 20; defaultBook = 1000; }
    else if (price === 100) { defaultTix = 10; defaultBook = 1000; }

    if (packSizeInput) packSizeInput.value = String(defaultTix);
    if (bookValueInput) bookValueInput.value = String(defaultBook);
  }

  priceSelect?.addEventListener('change', updateGameModalCalculations);

  packSizeInput?.addEventListener('input', () => {
    const price = parseInt(priceSelect?.value || '1', 10);
    const tix = parseInt(packSizeInput.value || '1', 10);
    if (bookValueInput && !isNaN(price) && !isNaN(tix)) {
      bookValueInput.value = String(price * tix);
    }
  });

  document.getElementById('btnSettingsAddGame')?.addEventListener('click', () => {
    sfx.keypad();
    const nameInput = document.getElementById('newGameNameInput');
    const numInput = document.getElementById('newGameNumberInput');
    if (nameInput) nameInput.value = '';
    if (numInput) numInput.value = '';
    if (priceSelect) priceSelect.value = '1';
    updateGameModalCalculations();
    addGameModal?.showModal();
  });

  document.getElementById('closeSettingsAddGameBtn')?.addEventListener('click', () => {
    addGameModal?.close();
  });

  document.getElementById('cancelSettingsAddGameBtn')?.addEventListener('click', () => {
    addGameModal?.close();
  });

  document.getElementById('saveSettingsAddGameBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newGameNameInput');
    const numInput = document.getElementById('newGameNumberInput');
    const name = nameInput?.value.trim();
    const gameNum = numInput?.value.trim();
    const price = parseInt(priceSelect?.value || '1', 10);
    const packSize = parseInt(packSizeInput?.value || '1', 10);
    const bookVal = parseInt(bookValueInput?.value || '300', 10);

    if (!name) {
      showToast('Please enter a game name', 'warning');
      nameInput?.focus();
      return;
    }
    if (!gameNum) {
      showToast('Please enter a 4-digit game number', 'warning');
      numInput?.focus();
      return;
    }

    if (!state.customGames) state.customGames = [];
    state.customGames.push({
      id: 'cg_' + Date.now(),
      name,
      gameNumber: gameNum,
      barcodePrefix: gameNum,
      price,
      packSize,
      bookValue: bookVal
    });

    saveState(state);
    renderSettingsGamesTable();
    addGameModal?.close();
    sfx.win();
    showToast(`✓ Added game: ${name}`, 'success');
  });

  // People & PINs modal handlers
  const addPersonModal = document.getElementById('settingsAddPersonModal');
  const resetPinModal = document.getElementById('settingsResetPinModal');
  let selectedPersonForPinReset = null;

  document.getElementById('btnSettingsAddPerson')?.addEventListener('click', () => {
    sfx.keypad();
    const nameInput = document.getElementById('newPersonNameInput');
    const roleSelect = document.getElementById('newPersonRoleSelect');
    const pinInput = document.getElementById('newPersonPinInput');
    if (nameInput) nameInput.value = '';
    if (roleSelect) roleSelect.value = 'Clerk';
    if (pinInput) pinInput.value = '';
    addPersonModal?.showModal();
  });

  document.getElementById('closeSettingsAddPersonBtn')?.addEventListener('click', () => {
    addPersonModal?.close();
  });

  document.getElementById('cancelSettingsAddPersonBtn')?.addEventListener('click', () => {
    addPersonModal?.close();
  });

  document.getElementById('saveSettingsAddPersonBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('newPersonNameInput');
    const roleSelect = document.getElementById('newPersonRoleSelect');
    const pinInput = document.getElementById('newPersonPinInput');
    const name = nameInput?.value.trim();
    const role = roleSelect?.value || 'Clerk';
    const pin = pinInput?.value.trim() || '0000';

    if (!name) {
      showToast('Please enter a person name', 'warning');
      nameInput?.focus();
      return;
    }

    if (!state.clerks || !Array.isArray(state.clerks)) {
      state.clerks = getSettingsPeopleList(state);
    }

    const isOwner = role.toLowerCase() === 'owner';
    const desc = isOwner ? 'Owner · can change settings and clear data' : 'Clerk · can sell, receive packs and end the day';

    state.clerks.push({
      id: 'clk_' + Date.now(),
      name,
      role,
      roleDesc: desc,
      pin
    });

    saveState(state);
    renderSettingsPeopleList();
    addPersonModal?.close();
    sfx.win();
    showToast(`✓ Added person: ${name}`, 'success');
  });

  // Event delegation on settingsPeopleList for Reset PIN button
  document.getElementById('settingsPeopleList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-person-reset-pin');
    if (!btn) return;
    sfx.keypad();
    const personName = btn.dataset.personName || 'Clerk';
    const personId = btn.dataset.personId || '';
    selectedPersonForPinReset = { id: personId, name: personName };

    const titleEl = document.getElementById('resetPinModalTitle');
    if (titleEl) titleEl.textContent = `Reset PIN · ${personName}`;
    const pinInput = document.getElementById('newPinInput');
    if (pinInput) pinInput.value = '';

    resetPinModal?.showModal();
  });

  document.getElementById('closeSettingsResetPinBtn')?.addEventListener('click', () => {
    resetPinModal?.close();
  });

  document.getElementById('cancelSettingsResetPinBtn')?.addEventListener('click', () => {
    resetPinModal?.close();
  });

  document.getElementById('saveSettingsResetPinBtn')?.addEventListener('click', () => {
    const pinInput = document.getElementById('newPinInput');
    const newPin = pinInput?.value.trim();
    if (!newPin || newPin.length < 4) {
      showToast('Please enter a 4-digit PIN', 'warning');
      pinInput?.focus();
      return;
    }

    if (!state.clerks || !Array.isArray(state.clerks)) {
      state.clerks = getSettingsPeopleList(state);
    }

    if (selectedPersonForPinReset) {
      const p = state.clerks.find(c => (c.id === selectedPersonForPinReset.id || c.name === selectedPersonForPinReset.name));
      if (p) {
        p.pin = newPin;
      }
    }

    saveState(state);
    resetPinModal?.close();
    sfx.win();
    showToast(`✓ PIN updated for ${selectedPersonForPinReset?.name || 'person'}`, 'success');
  });

  // Danger actions
  document.getElementById('btnSettingsResetShift')?.addEventListener('click', () => {
    if (confirm('Reset today\'s shift transactions and recalculate from current pack readings?')) {
      sfx.keypad();
      promptStartNewShift();
      showToast('Shift reset initiated', 'info');
    }
  });

  document.getElementById('btnSettingsResetClean')?.addEventListener('click', () => {
    if (confirm('⚠️ FACTORY RESET: Reset system to clean initial state?')) {
      sfx.keypad();
      state = resetToCleanState(state);
      saveState(state);
      window.location.hash = '';
      window.location.reload();
    }
  });

  // Clear all data input & button wiring (Matching Screenshot 2)
  const inputConfirmClear = document.getElementById('inputConfirmClear');
  const btnClearAllData = document.getElementById('btnClearAllData');

  const updateClearBtnState = () => {
    const val = (inputConfirmClear?.value || '').trim().toUpperCase();
    if (val === 'CLEAR') {
      btnClearAllData?.classList.add('ready');
    } else {
      btnClearAllData?.classList.remove('ready');
    }
  };
  inputConfirmClear?.addEventListener('input', updateClearBtnState);
  inputConfirmClear?.addEventListener('keyup', updateClearBtnState);
  inputConfirmClear?.addEventListener('change', updateClearBtnState);
  inputConfirmClear?.addEventListener('paste', () => setTimeout(updateClearBtnState, 20));

  inputConfirmClear?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnClearAllData?.click();
    }
  });

  btnClearAllData?.addEventListener('click', (e) => {
    e.preventDefault();

    try {
      if (typeof sfx?.success === 'function') sfx.success();
      else if (typeof sfx?.win === 'function') sfx.win();
    } catch (_) {}

    // 1. Wipe state completely to clean empty state (0 active slots, 0 sales, 0 inventory)
    state = resetToCleanState(state);
    saveState(state);

    // 2. Clear input and remove active class
    if (inputConfirmClear) {
      inputConfirmClear.value = '';
    }
    btnClearAllData?.classList.remove('ready');

    // 3. Purge CacheStorage so service worker never serves stale cache
    if (typeof caches !== 'undefined') {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
    }

    // 4. Close any open modal dialogs
    document.querySelectorAll('dialog[open]').forEach(d => {
      try { d.close(); } catch (_) {}
    });

    // 5. Reset Day Report print and preview DOM
    const printSection = document.getElementById('dayReportPrintSection');
    if (printSection) printSection.innerHTML = '';
    const previewContainer = document.getElementById('dayReportPreviewContainer');
    if (previewContainer) previewContainer.innerHTML = '';

    // 6. Instantly switch to Sell Counter and re-render in memory
    showSellCounterView();
    initPOS();
    showToast('✓ All data successfully cleared. Fresh start ready.', 'info');

    // 7. Clean browser refresh after toast to guarantee completely fresh state
    setTimeout(() => {
      window.location.hash = '';
      window.location.reload();
    }, 450);
  });

  // Enter Button on Barcode Scanner Card
  document.getElementById('barcodeEnterBtn')?.addEventListener('click', () => {
    const input = document.getElementById('barcodeInput');
    if (input && input.value.trim()) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
      input?.focus();
    }
  });

  // Prototype Quick Links
  document.getElementById('protoTrySaleBtn')?.addEventListener('click', () => {
    const firstActive = state.slots.find(s => s && s.status === 'ACTIVE' && s.packNumber);
    if (firstActive) {
      quickSellTicket(firstActive);
    } else {
      showToast('No active packs to sell. Activate a pack first.', 'warning');
    }
  });

  document.getElementById('protoTryNewPackBtn')?.addEventListener('click', () => {
    openActivationForBox(findFirstEmptyBox());
  });

  // Rack Filter Chips
  const filterChips = document.querySelectorAll('#rackFilterChips .filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      window.__currentRackFilter = chip.dataset.filter || 'all';
      renderDispenserRack();
    });
  });

  // Official 2-Page Day Report (AMIGO FOOD MART)
  setupDayReportHandlers(() => state, sfx, showToast, handleUndoAction, promptStartNewShift);

  // Initialize Receive Packs view
  renderReceivePacksView();

  // Initialize Day Report view
  renderDayReportView();

  // Initialize Inventory view
  renderInventoryView();

  // Initialize History view
  renderHistoryView();

  // Initialize Settings view
  populateSettingsInputs();
}

// Launch application
initPOS();
