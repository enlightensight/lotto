// Modern Lottery POS & Tracking System - Application Controller
import { loadState, saveState, resetToDefaults, resetToCleanState, SAMPLE_GAMES } from './data.js';
import { sfx } from './audio.js';

let state = loadState();

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

// Sanitize & migrate existing state:
// 1. If an active box was activated with count 0 (due to prior bug), update to 1 (01)
// 2. If a box has status EMPTY or SOLD_OUT, or has count 0 without a pack, ensure it renders as empty
function sanitizeAndMigrateSlots() {
  let modified = false;
  state.slots.forEach(slot => {
    if (slot.status === 'ACTIVE' && (slot.currentTicket === 0 || slot.currentTicket === null || slot.currentTicket === undefined)) {
      if (slot.gameName) {
        // Fix activation count from 0 to 1 so it shows 01
        slot.startTicket = 1;
        slot.currentTicket = 1;
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
  if (modified) {
    saveState(state);
  }
}

// Initialize System
function initPOS() {
  initTheme();
  sanitizeAndMigrateSlots();
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();
  setupEventListeners();
  setupKeypad();
  setupHardwareScannerListener();
}

// -------------------------------------------------------------
// Rendering Functions
// -------------------------------------------------------------

function renderHeaderAndMetrics() {
  currentShiftNumberEl.textContent = state.shiftNumber;
  currentCashierEl.textContent = `[${state.cashierName}]`;

  // Status Badge and Action Button
  if (state.shiftStatus === 'IN_PROGRESS') {
    shiftStatusBadge.className = 'shift-status-pill';
    shiftStatusText.textContent = 'Shift in Progress';
    mainShiftActionBtn.className = 'btn btn-end-shift';
    mainShiftActionBtn.textContent = 'End Shift';
    scanActionTitle.textContent = 'Scanning... Shift in Progress';
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    shiftStatusBadge.className = 'shift-status-pill scanning';
    shiftStatusText.textContent = 'Scanning... End Shift';
    mainShiftActionBtn.className = 'btn btn-get-report';
    mainShiftActionBtn.textContent = 'Get Report';
    scanActionTitle.textContent = 'Scanning... End Shift (Verify Active Boxes)';
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    shiftStatusBadge.className = 'shift-status-pill ended';
    shiftStatusText.textContent = 'Shift Closed';
    mainShiftActionBtn.className = 'btn btn-start-shift';
    mainShiftActionBtn.textContent = 'Start New Shift';
    scanActionTitle.textContent = 'Shift Closed · Ready for New Shift';
  }

  lastScanDisplay.textContent = state.lastScannedBarcode ? `Last Scan: ${state.lastScannedBarcode}` : 'Last Scan: Ready for scan';

  // Count active vs empty: any box with count 0 or non-active is considered empty (Box 5 style)
  const isBoxActive = s => s.status === 'ACTIVE' && s.currentTicket > 0;
  const activeCount = state.slots.filter(isBoxActive).length;
  const emptyCount = state.totalSlots - activeCount;

  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    const verifiedCount = state.slots.filter(s => isBoxActive(s) && s.scannedInEndShift).length;
    largeStatReadout.textContent = `${verifiedCount}/${activeCount}`;
    largeStatLabel.textContent = 'Boxes Verified';
  } else {
    largeStatReadout.textContent = state.lastScannedSlot || activeCount;
    largeStatLabel.textContent = state.lastScannedSlot ? `Box #${state.lastScannedSlot}` : 'Active Slots';
  }

  // Calculate current sales today
  let todaySales = 0;
  let todayTickets = 0;
  state.slots.forEach(s => {
    if (isBoxActive(s)) {
      const sold = Math.max(0, s.currentTicket - s.startTicket);
      todayTickets += sold;
      todaySales += sold * (s.price || 0);
    }
  });

  const pastShiftTickets = (state.shiftHistory || []).reduce((acc, h) => acc + (h.totalTicketsSold || 0), 0);

  metricSettlement.textContent = `$${todaySales.toFixed(2)}`;
  metricToday.textContent = todayTickets;
  metricThisWeek.textContent = pastShiftTickets + todayTickets;
  metricThisMonth.textContent = pastShiftTickets + todayTickets;
  metricInactive.textContent = emptyCount;
  metricInventoryCount.textContent = `${state.inventory.length} Packs`;

  ribbonActiveCount.textContent = activeCount;
  ribbonEmptyCount.textContent = emptyCount;

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

    // A box is empty (Box 5 style) when count is 0 or status is not ACTIVE
    const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.currentTicket || slot.currentTicket <= 0;

    if (!isBoxEmpty) {
      card.className = `box-card active ${isScanning ? (slot.scannedInEndShift ? 'scanned-done' : 'scanning-target') : ''}`;
      
      const priceClass = `p${slot.price}`;
      const ageClass = slot.daysActive >= 21 ? 'age-21' : (slot.daysActive >= 7 ? 'age-7' : 'age-1');

      card.innerHTML = `
        <div class="card-header-row">
          <span class="price-tag ${priceClass}">$${slot.price}</span>
          <span class="slot-tag">BOX ${slot.boxNumber}</span>
        </div>
        <div class="card-center-body">
          <div class="box-main-number">${slot.boxNumber}</div>
          <div class="game-title-strip" title="${slot.gameName}">${slot.gameName}</div>
        </div>
        <div class="card-footer-row">
          <span class="ticket-number-display">${String(slot.currentTicket).padStart(2, '0')}</span>
          ${slot.activatedThisShift ? '<span class="new-activation-pill">New Activation</span>' : ''}
          ${isScanning ? (slot.scannedInEndShift ? '<span style="color:var(--color-success); font-weight:800; font-size:0.8rem;">✓ SCANNED</span>' : '<span style="color:var(--color-primary); font-size:0.75rem; font-weight:700;">SCAN TICKET</span>') : ''}
        </div>
        <div class="age-indicator-bar ${ageClass}"></div>
      `;

      card.addEventListener('click', () => {
        handleBoxCardClick(slot);
      });
    } else {
      // Empty slot (or count is 0): rendered identically to Box 5
      card.className = 'box-card empty-slot';
      card.innerHTML = `
        <div class="empty-slot-plus">+</div>
        <div class="empty-slot-title">Box ${slot.boxNumber} · Empty</div>
        <span style="font-size:0.75rem; color:#94a3b8;">Tap to Activate</span>
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
    <span style="font-size:0.75rem; color:var(--text-muted);">Expand Store Rack</span>
  `;
  addCard.addEventListener('click', () => {
    addNewBox();
  });
  dispensersGrid.appendChild(addCard);
}

function renderSlotsRibbon() {
  slotsRibbon.innerHTML = '';
  slotsRibbon.style.gridTemplateColumns = `repeat(${state.totalSlots}, 1fr)`;

  state.slots.forEach(slot => {
    const cell = document.createElement('div');
    const isScanning = state.shiftStatus === 'SCANNING_END_SHIFT';
    const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.currentTicket || slot.currentTicket <= 0;

    if (!isBoxEmpty) {
      if (isScanning && slot.scannedInEndShift) {
        cell.className = 'ribbon-cell scanned-slot';
      } else {
        cell.className = 'ribbon-cell active-slot';
      }
    } else {
      cell.className = 'ribbon-cell empty-slot';
    }

    cell.textContent = slot.boxNumber;
    cell.title = `Box #${slot.boxNumber}: ${!isBoxEmpty ? slot.gameName : 'Empty'}`;
    
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
  const isBoxEmpty = slot.status !== 'ACTIVE' || !slot.currentTicket || slot.currentTicket <= 0;

  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    if (!isBoxEmpty) {
      slot.scannedInEndShift = true;
      state.lastScannedSlot = slot.boxNumber;
      state.lastScannedBarcode = `$${slot.price} ${slot.gameName} (#${String(slot.currentTicket).padStart(2, '0')})`;
      sfx.beep();
      showToast(`Verified Box #${slot.boxNumber} (${slot.gameName})`, 'info');
      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
    }
  } else if (state.shiftStatus === 'IN_PROGRESS') {
    if (!isBoxEmpty) {
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
    currentAdjustingSlot.currentTicket = 0;
    currentAdjustingSlot.status = 'EMPTY';
    currentAdjustingSlot.activatedThisShift = false;
    saveState(state);
    boxAdjustModal.close();
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast(`📦 Box #${currentAdjustingSlot.boxNumber} count set to 0: now rendered as Box 5 (Empty)!`, 'info');
  });

  saveBoxAdjustBtn?.addEventListener('click', () => {
    if (!currentAdjustingSlot) return;
    const newCount = parseInt(inputAdjustCount.value, 10);
    if (isNaN(newCount) || newCount < 0) {
      showToast('Please enter a valid ticket count (0 or higher).', 'error');
      return;
    }

    if (newCount === 0) {
      currentAdjustingSlot.currentTicket = 0;
      currentAdjustingSlot.status = 'EMPTY';
      currentAdjustingSlot.activatedThisShift = false;
      showToast(`📦 Box #${currentAdjustingSlot.boxNumber} count set to 0: now rendered as Box 5 (Empty)!`, 'info');
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

function openActivationForBox(boxNumber, preselectedPack = null) {
  const pack = preselectedPack || (state.inventory && state.inventory.length > 0 ? state.inventory[0] : {
    packNumber: '',
    gameId: 'g105',
    gameName: '$5 Cash Blast',
    price: 5,
    packSize: 100
  });

  pendingActivationPack = pack;
  activationGameTitle.textContent = pack.packNumber 
    ? `$${pack.price} ${pack.gameName} (Pack #${pack.packNumber})`
    : `$${pack.price} ${pack.gameName} · Ready to Activate`;
  keypadBoxInput.value = boxNumber || findFirstEmptyBox();

  const boxInputHint = document.getElementById('boxInputHint');
  if (boxInputHint) {
    boxInputHint.textContent = `Assign to box number (1-${state.totalSlots} or type a higher number to add new box).`;
  }

  sfx.keypad();
  activationModal.showModal();
}

function findFirstEmptyBox() {
  const empty = state.slots.find(s => s.status !== 'ACTIVE' || !s.currentTicket || s.currentTicket <= 0);
  return empty ? empty.boxNumber : 1;
}

function setupKeypad() {
  // Numeric keypad buttons: support up to 3-digit box numbers (1-999)
  document.querySelectorAll('.key-num').forEach(btn => {
    btn.addEventListener('click', () => {
      sfx.keypad();
      const val = btn.getAttribute('data-val');
      if (val === '.') return; // Whole box numbers
      const current = keypadBoxInput.value;
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
    keypadBoxInput.value = keypadBoxInput.value.slice(0, -1);
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
    packSize: 100
  };

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

  // Remove from warehouse inventory if it was there
  state.inventory = state.inventory.filter(p => p.packNumber !== pack.packNumber);

  // Assign to slot: starting ticket is 1, so count displays as '01'
  targetSlot.status = 'ACTIVE';
  targetSlot.gameId = pack.gameId;
  targetSlot.gameName = pack.gameName;
  targetSlot.price = pack.price;
  targetSlot.packNumber = pack.packNumber;
  targetSlot.packSize = pack.packSize;
  targetSlot.startTicket = 1;
  targetSlot.currentTicket = 1; // Displays 01!
  targetSlot.activatedThisShift = true;
  targetSlot.daysActive = 1;
  targetSlot.scannedInEndShift = false;

  state.lastScannedSlot = boxNum;
  state.lastScannedBarcode = `$${pack.price} ${pack.gameName}`;

  saveState(state);
  sfx.success();
  activationModal.close();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`✓ Box #${boxNum} activated with ${pack.gameName}! Starting count: 01`, 'success');
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
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    showToast('End Shift mode started! Scan or tap each active dispenser box.', 'info');
  } else if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    // Open Confirmation Dialog
    openEndShiftConfirmation();
  } else if (state.shiftStatus === 'SHIFT_ENDED') {
    startNewShift();
  }
}

function openEndShiftConfirmation() {
  const isBoxActive = s => s.status === 'ACTIVE' && s.currentTicket > 0;
  const activations = state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length;
  const emptySlots = state.slots.filter(s => !isBoxActive(s)).length;
  const soldOuts = state.slots.filter(s => s.status === 'SOLD_OUT' || (s.status === 'ACTIVE' && s.currentTicket <= 0));

  confActivationCount.textContent = activations;
  confEmptySlotsCount.textContent = emptySlots;
  confTotalSlots.textContent = state.totalSlots;

  soldOutListContainer.innerHTML = '';
  if (soldOuts.length > 0) {
    soldOuts.forEach(s => {
      const item = document.createElement('div');
      item.textContent = `Box #${s.boxNumber}: ${s.gameName}`;
      soldOutListContainer.appendChild(item);
    });
  } else {
    soldOutListContainer.innerHTML = '<div style="font-style:italic; color:#64748b;">None</div>';
  }

  sfx.keypad();
  endShiftConfirmModal.showModal();
}

function confirmEndShift() {
  endShiftConfirmModal.close();
  openShiftReportModal();
}

function openShiftReportModal() {
  repShiftNum.textContent = `Shift #${state.shiftNumber}`;
  repCashier.textContent = state.cashierName;

  reportBodyRows.innerHTML = '';
  let totalSold = 0;
  let totalRevenue = 0;

  state.slots.forEach(s => {
    if (s.status === 'ACTIVE' && s.currentTicket > 0) {
      const sold = Math.max(0, s.currentTicket - s.startTicket);
      const amount = sold * (s.price || 0);
      totalSold += sold;
      totalRevenue += amount;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight:700; color:var(--color-primary);">Box ${s.boxNumber}</td>
        <td>${s.gameName}</td>
        <td>$${s.price}</td>
        <td>${String(s.startTicket).padStart(2, '0')}</td>
        <td style="font-weight:700;">${String(s.currentTicket).padStart(2, '0')}</td>
        <td style="color:var(--text-primary); font-weight:700;">${sold}</td>
        <td style="color:var(--color-success); font-weight:700;">$${amount.toFixed(2)}</td>
      `;
      reportBodyRows.appendChild(row);
    }
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

  const activeCount = state.slots.filter(s => s.status === 'ACTIVE' && s.currentTicket > 0).length;
  const emptyCount = state.slots.filter(s => s.status !== 'ACTIVE' || s.currentTicket === 0).length;
  const activationCount = state.slots.filter(s => s.activatedThisShift).length;

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
    const activeSlots = state.slots
      .filter(s => s.status === 'ACTIVE' && s.currentTicket > 0)
      .sort((a, b) => a.boxNumber - b.boxNumber);

    activeSlots.forEach(s => {
      const sold = Math.max(0, s.currentTicket - s.startTicket);
      const amt = sold * (s.price || 0);
      const row = document.createElement('div');
      row.className = `receipt-row ${sold > 0 ? 'has-sales' : ''}`;
      
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
  }

  sfx.chime();
  shiftReportModal.showModal();
}

function startNewShift() {
  shiftReportModal.close();

  // Compute shift summary before closing
  let totalSold = 0;
  let totalRevenue = 0;
  state.slots.forEach(s => {
    if (s.status === 'ACTIVE' && s.currentTicket > 0) {
      const sold = Math.max(0, s.currentTicket - s.startTicket);
      totalSold += sold;
      totalRevenue += sold * (s.price || 0);

      // Previous closing numbers become new open numbers!
      s.startTicket = s.currentTicket;
      s.activatedThisShift = false;
      s.scannedInEndShift = false;
      s.daysActive += 1;
    } else {
      s.status = 'EMPTY';
      s.currentTicket = 0;
      s.startTicket = 0;
      s.activatedThisShift = false;
      s.scannedInEndShift = false;
    }
  });

  const isBoxActive = s => s.status === 'ACTIVE' && s.currentTicket > 0;
  // Record history
  state.shiftHistory.unshift({
    shiftNumber: state.shiftNumber,
    cashier: state.cashierName,
    startedAt: state.shiftStartedAt,
    endedAt: new Date().toISOString(),
    totalTicketsSold: totalSold,
    totalSalesRevenue: totalRevenue,
    activationsCount: state.slots.filter(s => isBoxActive(s) && s.activatedThisShift).length,
    emptySlotsCount: state.slots.filter(s => !isBoxActive(s)).length
  });

  // Advance shift number
  state.shiftNumber += 1;
  state.shiftStatus = 'IN_PROGRESS';
  state.shiftStartedAt = new Date().toISOString();

  saveState(state);
  sfx.success();

  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`🚀 Shift #${state.shiftNumber} started! Opening numbers set to previous closing numbers.`, 'success');
}

// -------------------------------------------------------------
// Update Inventory (Pack Intake) Workflow
// -------------------------------------------------------------

function openInventoryModal() {
  renderInventoryTable();
  inventoryBarcodeInput.value = '';
  sfx.keypad();
  inventoryModal.showModal();
  setTimeout(() => inventoryBarcodeInput.focus(), 100);
}

function renderInventoryTable() {
  inventoryTableBody.innerHTML = '';
  state.inventory.forEach(pack => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:var(--color-primary);">#${pack.packNumber}</td>
      <td>${pack.gameName}</td>
      <td>$${pack.price}</td>
      <td>${pack.packSize} pk</td>
      <td><span style="color:var(--color-success); font-weight:700;">IN SAFE</span></td>
      <td>
        <button class="btn btn-primary" style="padding:5px 12px; font-size:0.75rem;" data-pack="${pack.packNumber}">
          Activate
        </button>
      </td>
    `;

    row.querySelector('button').addEventListener('click', () => {
      inventoryModal.close();
      openActivationForBox(findFirstEmptyBox(), pack);
    });

    inventoryTableBody.appendChild(row);
  });
}

function handleInventoryPackIntake() {
  const code = inventoryBarcodeInput.value.trim() || '88' + Math.floor(1000 + Math.random() * 9000);
  // Pick random game
  const randomGame = SAMPLE_GAMES[Math.floor(Math.random() * SAMPLE_GAMES.length)];
  const newPack = {
    packNumber: code.replace(/[^0-9]/g, '').slice(-6) || String(Math.floor(100000 + Math.random() * 900000)),
    gameId: randomGame.id,
    gameName: randomGame.name,
    price: randomGame.price,
    packSize: randomGame.packSize,
    dateReceived: new Date().toISOString().split('T')[0],
    status: 'IN_SAFE'
  };

  state.inventory.unshift(newPack);
  saveState(state);
  sfx.success();
  inventoryBarcodeInput.value = '';
  renderInventoryTable();
  renderHeaderAndMetrics();
  showToast(`Intake: ${newPack.gameName} (Pack #${newPack.packNumber}) registered in safe!`, 'success');
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
      pendingActivationPack = {
        packNumber: rawBarcode.replace(/[^0-9]/g, '').slice(-6) || '889901',
        gameId: 'g' + Math.floor(100 + Math.random() * 900),
        gameName: '$20 100X THE MONEY',
        price: 20,
        packSize: 30
      };
      activationGameTitle.textContent = `$${pendingActivationPack.price} ${pendingActivationPack.gameName}`;
      showToast(`Pack #${pendingActivationPack.packNumber} scanned!`, 'info');
      return;
    }
  }

  // Scenario 3: End Shift Scanning (Verify Active Boxes)
  if (state.shiftStatus === 'SCANNING_END_SHIFT') {
    const parsedBoxNum = parseBoxBarcode(rawBarcode);
    let targetSlot = null;

    if (parsedBoxNum) {
      targetSlot = state.slots.find(s => s.boxNumber === parsedBoxNum && s.status === 'ACTIVE' && s.currentTicket > 0);
    }

    // Also check if barcode matches packNumber of any active box
    if (!targetSlot) {
      targetSlot = state.slots.find(s => s.status === 'ACTIVE' && s.currentTicket > 0 && s.packNumber && rawBarcode.includes(s.packNumber));
    }

    // If no specific match, scan next unscanned active box
    if (!targetSlot || targetSlot.scannedInEndShift) {
      targetSlot = state.slots.find(s => s.status === 'ACTIVE' && s.currentTicket > 0 && !s.scannedInEndShift);
    }

    if (targetSlot) {
      targetSlot.scannedInEndShift = true;
      state.lastScannedSlot = targetSlot.boxNumber;
      showToast(`✓ Scanned Box #${targetSlot.boxNumber} (${targetSlot.gameName})`, 'success');
    } else {
      showToast('All active dispenser boxes have already been verified!', 'info');
    }
  } else {
    // Scenario 4: Normal Shift in Progress
    // Check if a box barcode was scanned directly (e.g. "BOX-05", "B5", "5")
    const scannedBoxNum = parseBoxBarcode(rawBarcode);
    if (scannedBoxNum) {
      const slot = state.slots.find(s => s.boxNumber === scannedBoxNum);
      const isBoxEmpty = !slot || slot.status !== 'ACTIVE' || !slot.currentTicket || slot.currentTicket <= 0;

      if (isBoxEmpty) {
        // Empty box: immediately open activation targeting this specific box!
        openActivationForBox(scannedBoxNum);
        showToast(`✓ Box #${scannedBoxNum} barcode scanned: Ready to activate pack into Box #${scannedBoxNum}!`, 'info');
      } else {
        // Active box: open details & count adjustment modal!
        openBoxAdjustModal(slot);
        showToast(`✓ Box #${scannedBoxNum} barcode scanned: ${slot.gameName} (Ticket #${String(slot.currentTicket).padStart(2, '0')})`, 'info');
      }
      saveState(state);
      renderHeaderAndMetrics();
      renderDispenserRack();
      renderSlotsRibbon();
      return;
    }

    // Otherwise, a lottery ticket pack barcode was scanned -> trigger Ticket Activation
    let packInfo = null;
    const cleanNum = rawBarcode.replace(/[^0-9]/g, '');

    // Check if it matches an existing inventory pack in safe
    const invIndex = state.inventory.findIndex(p => p.packNumber === cleanNum || (cleanNum.length >= 6 && cleanNum.endsWith(p.packNumber)));
    if (invIndex !== -1) {
      packInfo = state.inventory.splice(invIndex, 1)[0];
    } else {
      // Create pack from scan
      const randomGame = SAMPLE_GAMES[Math.floor(Math.random() * SAMPLE_GAMES.length)];
      packInfo = {
        packNumber: cleanNum.slice(-6) || String(Math.floor(100000 + Math.random() * 900000)),
        gameId: randomGame.id,
        gameName: randomGame.name,
        price: randomGame.price,
        packSize: randomGame.packSize
      };
    }

    const emptyBox = findFirstEmptyBox();
    openActivationForBox(emptyBox, packInfo);
    showToast(`Pack #${packInfo.packNumber} scanned! Assign to Box #${emptyBox} or scan box barcode`, 'info');
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
  const activeSlots = state.slots.filter(s => s.status === 'ACTIVE' && s.currentTicket > 0);
  if (activeSlots.length === 0) {
    showToast('No active dispenser boxes with tickets to sell from!', 'error');
    return;
  }

  // Pick random active box
  const target = activeSlots[Math.floor(Math.random() * activeSlots.length)];
  const count = Math.floor(1 + Math.random() * 3);
  target.currentTicket += count;
  state.lastScannedSlot = target.boxNumber;
  state.lastScannedBarcode = `$${target.price} ${target.gameName} (Sold ${count})`;

  sfx.keypad();
  saveState(state);
  renderHeaderAndMetrics();
  renderDispenserRack();
  renderSlotsRibbon();

  showToast(`🛒 Customer purchased ${count}x ${target.gameName} from Box #${target.boxNumber}! (Now #${String(target.currentTicket).padStart(2, '0')})`, 'success');
}

function simulateEndShiftScanAll() {
  if (state.shiftStatus !== 'SCANNING_END_SHIFT') {
    handleMainShiftAction(); // Switch to End Shift scanning first
  }

  state.slots.forEach(s => {
    if (s.status === 'ACTIVE' && s.currentTicket > 0) {
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

  undoActionBtn.addEventListener('click', () => {
    sfx.alert();
    showToast('Undo last action: completed.', 'info');
  });

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
  });

  // Shift Report Modal buttons
  closeReportBtn.addEventListener('click', () => shiftReportModal.close());
  reportPrintBtn.addEventListener('click', () => {
    printReceiptSlip();
  });
  if (reportPrintFullBtn) {
    reportPrintFullBtn.addEventListener('click', () => {
      printFullPageReport();
    });
  }
  reportEmailBtn.addEventListener('click', () => {
    sfx.success();
    showToast(`✓ Shift Report emailed to: ${state.settings.targetEmails}`, 'success');
  });
  reportNewShiftBtn.addEventListener('click', startNewShift);

  // Inventory Modal buttons
  tabUpdateInventory.addEventListener('click', openInventoryModal);
  closeInventoryBtn.addEventListener('click', () => inventoryModal.close());
  inventoryDoneBtn.addEventListener('click', () => inventoryModal.close());
  inventoryAddManualBtn.addEventListener('click', handleInventoryPackIntake);
  inventoryBarcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleInventoryPackIntake();
  });

  // Menu items
  menuHistoryBtn.addEventListener('click', openHistoryModal);
  closeHistoryBtn.addEventListener('click', () => historyModal.close());
  closeHistoryBottomBtn.addEventListener('click', () => historyModal.close());
  document.getElementById('menuPrintBtn').addEventListener('click', () => {
    openShiftReportModal();
  });
  document.getElementById('menuSettingsBtn').addEventListener('click', () => {
    showToast('Settings: LottoTrack Pro v2.4 (Store #402)', 'info');
  });
  document.getElementById('menuSignOutBtn').addEventListener('click', () => {
    showToast('Master Cashier logged out.', 'info');
  });

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
      const target = state.slots.find(s => s.boxNumber === 19 && s.status === 'ACTIVE' && s.currentTicket > 0)
        || state.slots.find(s => s.boxNumber === 20 && s.status === 'ACTIVE' && s.currentTicket > 0)
        || state.slots.find(s => s.status === 'ACTIVE' && s.currentTicket > 0);

      if (target) {
        target.currentTicket = 0;
        target.status = 'EMPTY';
        target.activatedThisShift = false;
        saveState(state);
        sfx.alert();
        renderHeaderAndMetrics();
        renderDispenserRack();
        renderSlotsRibbon();
        showToast(`📦 Box #${target.boxNumber} count set to 0: now rendered as Box 5 (Empty)!`, 'info');
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

  simResetStateBtn.addEventListener('click', () => {
    if (confirm('Erase all mock data and reset the POS to a clean slate?')) {
      state = resetToCleanState();
      initPOS();
      sfx.alert();
      showToast('All fake data erased! Clean POS ready.', 'info');
    }
  });

  const menuClearDataBtn = document.getElementById('menuClearDataBtn');
  if (menuClearDataBtn) {
    menuClearDataBtn.addEventListener('click', () => {
      if (confirm('Erase all POS lottery data and reset to a fresh blank start?')) {
        state = resetToCleanState();
        initPOS();
        sfx.alert();
        showToast('All POS data wiped. Clean start ready.', 'info');
      }
    });
  }
}

// Launch application
initPOS();
