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
    const bookValue = 900;
    const packSize = Math.max(1, Math.floor(bookValue / p));
    return { bookValue, packSize };
  }
  const bookValue = 300;
  const packSize = Math.max(1, Math.floor(bookValue / p));
  return { bookValue, packSize };
}

// Robust Georgia Lottery Barcode Parser
// Parses standard Georgia / Scientific Games scratch-off barcodes:
// e.g. "1898-0019425-068(041)", "1898-0019425-068", "18980019425068041", "18980019425068"
export function parseLotteryBarcode(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Strip scanner symbology prefix (e.g. "]C1", "]I0", "]e0")
  s = s.replace(/^\][a-zA-Z0-9]{2}/, '').trim();

  // Pattern 1: Delimited format: Game - Pack - Ticket (Check)
  // e.g. "1898-0019425-084(015)", "1898-0004627-097(002)", "1898-0019425-084 (015)", "1898-0019425-084-015"
  const delimitedMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]+(\d{1,3})(?:[-_\s]*\(?(\d{1,4})\)?)?$/);
  if (delimitedMatch) {
    const gameNumber = delimitedMatch[1];
    const packNumber = delimitedMatch[2];
    const ticketNumber = parseInt(delimitedMatch[3], 10);
    const ticketString = String(delimitedMatch[3]).padStart(3, '0');
    const checkCode = delimitedMatch[4] || null;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber: isNaN(ticketNumber) ? 0 : ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}${checkCode ? '(' + checkCode + ')' : ''}`,
      raw
    };
  }

  // Pattern 2: Delimited with only two segments (e.g. Pack - Ticket or Game - Pack)
  const twoPartMatch = s.match(/^(\d{3,8})[-_\s]+(\d{1,3})(?:[-_\s]*\(?(\d{1,4})\)?)?$/);
  if (twoPartMatch) {
    const firstPart = twoPartMatch[1];
    const tix = parseInt(twoPartMatch[2], 10);
    const ticketString = String(twoPartMatch[2]).padStart(3, '0');
    const check = twoPartMatch[3] || null;
    const isGame = firstPart.length <= 4;
    return {
      isValid: true,
      gameNumber: isGame ? firstPart : null,
      packNumber: !isGame ? firstPart : null,
      packClean: firstPart.replace(/^0+/, '') || firstPart,
      ticketNumber: isNaN(tix) ? 0 : tix,
      ticketString,
      checkCode: check,
      canonicalId: `${firstPart}-${ticketString}`,
      fullId: `${firstPart}-${ticketString}${check ? '(' + check + ')' : ''}`,
      raw
    };
  }

  // Pattern 3: Pure continuous digits
  const digits = s.replace(/[^0-9]/g, '');

  // 17 digits: 4 game + 7 pack + 3 ticket + 3 check (Georgia Lottery 17-digit)
  if (digits.length === 17) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 11);
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const checkCode = digits.slice(14, 17);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${checkCode})`,
      raw
    };
  }

  // 14 digits: 4 game + 7 pack + 3 ticket (Georgia Lottery 14-digit)
  if (digits.length === 14) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 11);
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode: null,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}`,
      raw
    };
  }

  // 18 to 26 digits: Continuous barcode with trailing check / security digits (e.g. 24-digit scratch barcode)
  if (digits.length >= 18 && digits.length <= 26) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 11);
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const checkCode = digits.slice(14, 17);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${checkCode})`,
      raw
    };
  }

  // 16 digits: 3 game + 7 pack + 3 ticket + 3 check
  if (digits.length === 16) {
    const gameNumber = digits.slice(0, 3);
    const packNumber = digits.slice(3, 10);
    const ticketNumber = parseInt(digits.slice(10, 13), 10);
    const ticketString = digits.slice(10, 13);
    const checkCode = digits.slice(13, 16);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${checkCode})`,
      raw
    };
  }

  // 13 digits: 3 game + 7 pack + 3 ticket
  if (digits.length === 13) {
    const gameNumber = digits.slice(0, 3);
    const packNumber = digits.slice(3, 10);
    const ticketNumber = parseInt(digits.slice(10, 13), 10);
    const ticketString = digits.slice(10, 13);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode: null,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}`,
      raw
    };
  }

  // Check against known game barcode prefixes in SAMPLE_GAMES
  for (const g of SAMPLE_GAMES) {
    if (g.barcodePrefix && digits.startsWith(g.barcodePrefix)) {
      const rest = digits.slice(g.barcodePrefix.length);
      if (rest.length >= 7) {
        const pack = rest.slice(0, 7);
        const tixStr = rest.slice(7, 10);
        const tix = tixStr ? parseInt(tixStr, 10) : 0;
        return {
          isValid: true,
          gameNumber: g.barcodePrefix,
          packNumber: pack,
          packClean: pack.replace(/^0+/, '') || pack,
          ticketNumber: isNaN(tix) ? 0 : tix,
          checkCode: rest.slice(10, 13) || null,
          raw
        };
      }
    }
  }

  return {
    isValid: false,
    gameNumber: digits.length >= 4 ? digits.slice(0, 4) : null,
    packNumber: digits.length >= 7 ? digits.slice(-7) : (digits || null),
    packClean: digits.replace(/^0+/, '') || digits,
    ticketNumber: null,
    checkCode: null,
    raw
  };
}

/**
 * Normalizes a pack number string to its canonical numeric sequence (digits stripped of leading zeros).
 * Handles plain pack numbers ("0796097" -> "796097"), hyphenated game-pack ("1322-0796097" -> "796097"),
 * and standard numeric pack serials ("882901" -> "882901").
 */
export function normalizePackNumber(packStr) {
  if (!packStr) return '';
  let s = String(packStr).trim();
  const parts = s.split(/[-_\s]+/);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    if (parts[0].length <= 5 && parts[1].length >= 4) {
      s = parts[1];
    }
  }
  const digits = s.replace(/[^0-9]/g, '');
  return digits.replace(/^0+/, '') || digits;
}

export function findGameByBarcode(rawCode, customGames = []) {
  if (!rawCode) return null;
  const s = String(rawCode).trim();
  const digits = s.replace(/[^0-9]/g, '');
  const parsed = parseLotteryBarcode(rawCode);

  // 1. Check if parsed gameNumber matches custom games
  if (parsed && parsed.gameNumber && customGames && customGames.length > 0) {
    const matchCG = customGames.find(g => g.barcodePrefix === parsed.gameNumber);
    if (matchCG) return matchCG;
  }

  // 2. Check if parsed gameNumber matches SAMPLE_GAMES
  if (parsed && parsed.gameNumber) {
    const matchSG = SAMPLE_GAMES.find(g => g.barcodePrefix === parsed.gameNumber);
    if (matchSG) return matchSG;
  }

  // 3. Check custom games first by prefix or name
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

  // 4. Match against SAMPLE_GAMES by barcodePrefix (e.g. 1417, 1322, 1898...)
  for (const g of SAMPLE_GAMES) {
    if (g.barcodePrefix && (s.startsWith(g.barcodePrefix) || digits.startsWith(g.barcodePrefix))) {
      return g;
    }
  }

  // 5. Check if name is in the code
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

