// State Management & Lottery POS Data Model

// State Management & Lottery POS Data Model

const STORAGE_KEY = 'lotto_track_pos_data_v2';

export const SAMPLE_GAMES = [
  { id: 'g101', name: '5X MONEY', price: 1, bookValue: 300, packSize: 300, barcodePrefix: '1417' },
  { id: 'g102', name: 'JR JUMBO', price: 1, bookValue: 300, packSize: 300, barcodePrefix: '1410' },
  { id: 'g103', name: 'LOTERIA', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1322' },
  { id: 'g104', name: 'HIT 100', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1891' },
  { id: 'g105', name: 'SPICY HOT CASH', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1853' },
  { id: 'g106', name: 'JACKPOTS', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1883' },
  { id: 'g107', name: '10X MONEY', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1418' },
  { id: 'g108', name: 'JUMBO BUCKS', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1411' },
  { id: 'g109', name: 'CROSS WORD', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1898' },
  { id: 'g110', name: '2026 HAPPY NEW', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1874' },
  { id: 'g111', name: 'LUCKY 7S', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1899' },
  { id: 'g112', name: '25X TRA', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1905' },
  { id: 'g113', name: 'GOLD $500000', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1870' },
  { id: 'g114', name: 'FROGGER', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1833' },
  { id: 'g115', name: '50X MONEY', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1422' },
  { id: 'g116', name: 'HIT 500', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1893' },
  { id: 'g117', name: 'PLATINUM', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1871' },
  { id: 'g118', name: '100X MONEY', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1423' },
  { id: 'g119', name: 'HIT 1000', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1894' },
  { id: 'g120', name: '200X MONEY', price: 25, bookValue: 300, packSize: 12, barcodePrefix: '1860' },
  { id: 'g121', name: 'GRANT 50', price: 30, bookValue: 300, packSize: 10, barcodePrefix: '1881' },
  { id: 'g122', name: 'MILLIONAIRE MA', price: 30, bookValue: 300, packSize: 10, barcodePrefix: '1843' },
  { id: 'g123', name: '500X THE MONEY', price: 50, bookValue: 900, packSize: 18, barcodePrefix: '1770' },
  { id: 'g124', name: 'CASH 500000 $', price: 50, bookValue: 900, packSize: 18, barcodePrefix: '1890' },
  { id: 'g125', name: 'JUMBO BUCK EXT', price: 50, bookValue: 900, packSize: 18, barcodePrefix: '1835' }
];

export function getStandardPackDetails(price) {
  const p = Number(price) || 1;
  if (p >= 50) {
    return { bookValue: 900, packSize: 18 };
  }
  const bookValue = 300;
  const packSize = Math.max(1, Math.floor(bookValue / p));
  return { bookValue, packSize };
}

export function findGameByBarcode(rawCode, customGames = []) {
  if (!rawCode) return null;
  const s = String(rawCode).trim();
  const digits = s.replace(/[^0-9]/g, '');

  // 1. Check custom games first
  if (customGames && customGames.length > 0) {
    for (const g of customGames) {
      if (g.barcodePrefix && (s.startsWith(g.barcodePrefix) || digits.startsWith(g.barcodePrefix))) {
        return g;
      }
      if (g.name && s.toLowerCase().includes(g.name.toLowerCase())) {
        return g;
      }
    }
  }

  // 2. Match against SAMPLE_GAMES by barcodePrefix (e.g. 1417, 1322, 1843...)
  for (const g of SAMPLE_GAMES) {
    if (g.barcodePrefix && (s.startsWith(g.barcodePrefix) || digits.startsWith(g.barcodePrefix))) {
      return g;
    }
  }

  // 3. Check if name is in the code
  for (const g of SAMPLE_GAMES) {
    if (s.toLowerCase().includes(g.name.toLowerCase())) {
      return g;
    }
  }

  return null;
}

export function getInitialState() {
  const slots = [];
  const TOTAL_SLOTS = 65; // Matches full Georgia Lottery store rack (Boxes 1-65)

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
      ticketsInBox: 0,
      scannedBarcodes: [],
      activatedThisShift: false,
      daysActive: 0,
      scannedInEndShift: false
    });
  }

  return {
    storeName: 'AMIGO FOOD MART',
    storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
    shiftNumber: 1,
    cashierName: 'master',
    shiftStatus: 'IN_PROGRESS', // 'IN_PROGRESS' | 'SCANNING_END_SHIFT' | 'SHIFT_ENDED'
    shiftStartedAt: new Date().toISOString(),
    totalSlots: TOTAL_SLOTS,
    slots,
    visibleBoxNumbers: [], // Stays empty until tickets are scanned/activated
    boxAccessTimes: {},
    inventory: [], // Clean inventory in safe
    inventoryBarcodes: {}, // Map of barcode -> { boxNumber, scannedAt, gameName, price }
    customGames: [], // Registered brand new games
    onlineSales: 0, // Georgia Lottery online terminal sales (Powerball, Mega Millions, Cash 3, Cash 4)
    cashes: 0, // Retailer winning ticket customer cash payouts
    onlineCashes: 0, // Online lottery winning ticket payouts
    discontinuedCount: 0, // Georgia Lottery discontinued packs
    shiftOpeningActiveCount: 0, // Opening dispenser pack count at shift start
    soldOutThisShift: [], // Packs/boxes sold out or emptied this shift
    shiftHistory: [], // Clean audit history
    lastScannedBarcode: '',
    lastScannedSlot: null,
    dataCleared: true,
    settings: {
      soundEnabled: true,
      voiceEnabled: true,
      autoPrint: true,
      autoEmail: false,
      targetEmails: 'manager@amigofoodmart.com'
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
      const parsed = JSON.parse(raw);
      if (!parsed.customGames) parsed.customGames = [];
      if (!parsed.soldOutThisShift) parsed.soldOutThisShift = [];
      if (!parsed.inventoryBarcodes) parsed.inventoryBarcodes = {};
      if (parsed.onlineSales === undefined) parsed.onlineSales = 0;
      if (parsed.cashes === undefined) parsed.cashes = 0;
      if (parsed.onlineCashes === undefined) parsed.onlineCashes = 0;
      if (parsed.discontinuedCount === undefined) parsed.discontinuedCount = 0;
      if (typeof parsed.shiftOpeningActiveCount !== 'number') {
        parsed.shiftOpeningActiveCount = (parsed.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber).length;
      }
      return parsed;
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
  fresh.dataCleared = true;
  saveState(fresh);
  return fresh;
}

