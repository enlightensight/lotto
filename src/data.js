// State Management & Lottery POS Data Model

// State Management & Lottery POS Data Model

const STORAGE_KEY = 'lotto_track_pos_data_v2';

export const SAMPLE_GAMES = [
  { id: 'g101', name: '$1 Lucky 7s', price: 1, packSize: 300, barcodePrefix: '101' },
  { id: 'g102', name: '$2 HIT $200', price: 2, packSize: 150, barcodePrefix: '102' },
  { id: 'g103', name: '$3 Bingo Craze', price: 3, packSize: 100, barcodePrefix: '103' },
  { id: 'g105', name: '$5 Cash Blast', price: 5, packSize: 100, barcodePrefix: '105' },
  { id: 'g110', name: '$10 Mega Bucks', price: 10, packSize: 60, barcodePrefix: '110' },
  { id: 'g120', name: '$20 100X The Money', price: 20, packSize: 30, barcodePrefix: '120' },
  { id: 'g130', name: '$30 Diamond Millions', price: 30, packSize: 30, barcodePrefix: '130' },
  { id: 'g150', name: '$50 VIP Club', price: 50, packSize: 20, barcodePrefix: '150' }
];

export function getInitialState() {
  const slots = [];
  const TOTAL_SLOTS = 20;

  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    slots.push({
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

  return {
    storeName: 'LOTTO EXPRESS POS',
    shiftNumber: 1,
    cashierName: 'CLERK',
    shiftStatus: 'IN_PROGRESS', // 'IN_PROGRESS' | 'SCANNING_END_SHIFT' | 'SHIFT_ENDED'
    shiftStartedAt: new Date().toISOString(),
    totalSlots: TOTAL_SLOTS,
    slots,
    inventory: [], // Clean inventory in safe
    shiftHistory: [], // Clean audit history
    lastScannedBarcode: '',
    lastScannedSlot: null,
    settings: {
      soundEnabled: true,
      autoPrint: true,
      autoEmail: false,
      targetEmails: ''
    }
  };
}

export function loadState() {
  try {
    // Purge old v1 mock data if present
    if (localStorage.getItem('lotto_track_pos_data_v1')) {
      localStorage.removeItem('lotto_track_pos_data_v1');
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse local storage state:', e);
  }
  const fresh = getInitialState();
  saveState(fresh);
  return fresh;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage:', e);
  }
}

export function resetToDefaults() {
  return resetToCleanState();
}

export function resetToCleanState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('lotto_track_pos_data_v1');
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
  const fresh = getInitialState();
  saveState(fresh);
  return fresh;
}

