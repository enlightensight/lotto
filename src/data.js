// State Management & Lottery POS Data Model
import { syncPOSStateToDB, clearPOSStateOnDB } from './dbSync.js';

const STORAGE_KEY = 'lotto_track_pos_data_v3';

export const DEFAULT_STORES = [
  {
    id: 'store_amigo',
    name: 'AMIGO FOOD MART',
    address: '2300 MOODY RD WARNER ROBINS, GA, 31088',
    retailerNumber: 'GA-89412',
    phone: '(478) 923-4567',
    totalBoxes: 65,
    status: 'ACTIVE'
  },
  {
    id: 'store_downtown',
    name: 'DOWNTOWN QUICK MART',
    address: '104 N COMMERCIAL BLVD, WARNER ROBINS, GA, 31088',
    retailerNumber: 'GA-94103',
    phone: '(478) 953-8821',
    totalBoxes: 60,
    status: 'ACTIVE'
  },
  {
    id: 'store_anish',
    name: 'ANISH STORE',
    address: 'Georgia, USA',
    retailerNumber: 'GA-ANISH01',
    phone: '(478) 555-0199',
    totalBoxes: 65,
    status: 'ACTIVE'
  }
];

export function getStoresList() {
  try {
    const raw = localStorage.getItem('lotto_stores_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STORES));
}

export function saveStoresList(stores) {
  try {
    localStorage.setItem('lotto_stores_list', JSON.stringify(stores));
  } catch (e) {}
}

export function getCurrentStoreId() {
  return localStorage.getItem('lotto_current_store_id') || 'store_amigo';
}

export function setCurrentStoreId(storeId) {
  localStorage.setItem('lotto_current_store_id', storeId);
}

export function getStoreStorageKey(storeId = null) {
  const sid = storeId || getCurrentStoreId();
  return `lotto_track_pos_data_v3_${sid}`;
}

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
  { id: 'g125', name: 'JUMBO BUCK EXT', price: 50, bookValue: 900, packSize: 18, barcodePrefix: '1835' },
  { id: 'g1648', name: 'EPIC RICHES', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1648' },
  { id: 'g1672', name: 'TREASURE HUNT', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1672' },
  { id: 'g1465', name: '1M CASH VAULT.', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1465' },
  { id: 'g1466', name: 'LIMITED RELS', price: 30, bookValue: 300, packSize: 10, barcodePrefix: '1466' },
  { id: 'g1153', name: 'HIT 100', price: 1, bookValue: 300, packSize: 300, barcodePrefix: '1153' },
  { id: 'g1451', name: '50K EXTREME', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1451' },
  { id: 'g1409', name: 'GOLD $500,000', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1409' },
  { id: 'g1917', name: '50X MERRY MONEY', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1917' },
  { id: 'g1910', name: 'JUMBO BREW BUCKS', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1910' },
  { id: 'g1658', name: 'PLAYERS CLUB', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1658' },
  { id: 'g1904', name: '15XTRA', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1904' },
  { id: 'g1906', name: '50XTRA', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1906' },
  { id: 'g1907', name: '100XTRA', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1907' },
  { id: 'g1908', name: 'BULLDOG BUCKS', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1908' },
  { id: 'g1911', name: '30X BINGO MULTIPLIER', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1911' },
  { id: 'g1914', name: 'HOLIDAY $100S', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1914' },
  { id: 'g1915', name: 'CHRISTMAS VACATION', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1915' },
  { id: 'g1916', name: 'HOLIDAY $500S', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1916' },
  { id: 'g1900', name: 'MYSTERY BOX GIVEAWAY', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1900' },
  { id: 'g1901', name: 'DOUBLE YOUR LUCK', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1901' },
  { id: 'g1902', name: 'KICK \'N CASH', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1902' },
  { id: 'g1903', name: '$600 CASH IN HAND', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1903' }
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

export function calculateSlotSoldTickets(slot, closingTicket = null, closingSecurityCode = null) {
  if (!slot) return 0;
  const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? Number(slot.startTicket) : 0;
  const current = (closingTicket !== null && closingTicket !== undefined)
    ? Number(closingTicket)
    : ((slot.currentTicket !== undefined && slot.currentTicket !== null) ? Number(slot.currentTicket) : start);

  const std = getStandardPackDetails(slot.price || 1);
  const packSize = slot.packSize || std.packSize || 100;

  // 1. If start equals current, ticket position did not change (0 sales)
  if (start === current) {
    const startSec = slot.startSecurityCode || slot.securityCode;
    const currSec = closingSecurityCode || slot.currentSecurityCode;
    if (startSec && currSec && String(startSec).trim() !== String(currSec).trim()) {
      const numStart = parseInt(String(startSec).replace(/[^0-9]/g, ''), 10);
      const numCurr = parseInt(String(currSec).replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numStart) && !isNaN(numCurr)) {
        const pinDelta = Math.abs(numCurr - numStart);
        if (pinDelta > 0 && pinDelta <= 5) {
          return pinDelta;
        }
      }
    }
    return 0;
  }

  // 2. Fresh countdown pack started at 0, top ticket scanned at end is packSize - 1 (0 sales)
  if (start === 0 && (current === packSize - 1 || current === 299 || current === 199 || current === 149 || current === 99 || current === 59 || current === 29)) {
    return 0;
  }

  // 3. Fresh countdown pack started at 0, top ticket is in upper half of roll
  if (start === 0 && current > (packSize / 2)) {
    return Math.max(0, (packSize - 1) - current);
  }

  return Math.abs(start - current);
}

export function cleanGameTitle(name) {
  if (!name) return '';
  let s = String(name).trim();
  s = s.replace(/\.+$/g, '').trim();
  s = s.replace(/^(\$\s*\d*\s*)+/i, '').trim();
  s = s.replace(/^\$+/i, '').trim();
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

export function isKnownGamePrefix(prefix, customGames = []) {
  if (!prefix) return false;
  const pStr = String(prefix).trim();
  if (SAMPLE_GAMES.some(g => g.barcodePrefix === pStr || String(g.id).replace(/[^0-9]/g, '') === pStr)) {
    return true;
  }
  if (customGames && Array.isArray(customGames) && customGames.some(g => g.barcodePrefix === pStr)) {
    return true;
  }
  return false;
}

/**
 * Computes the accurate series / countdown index printed on lottery tickets in parentheses
 * based on standard pack sizing: (packSize - 1) - ticketNumber.
 * e.g. For Game 1418 ($2 10X Money, 150 tickets in pack), Ticket #081: (150 - 1) - 81 = 68 -> "068"
 * e.g. For Game 1648 ($10 Epic Riches, 30 tickets in pack), Ticket #029: (30 - 1) - 29 = 0 -> "000"
 * e.g. For Game 1672 ($3 Treasure Hunt, 100 tickets in pack), Ticket #000: (100 - 1) - 0 = 99 -> "099"
 * e.g. For Game 1417 ($1 5X Money, 300 tickets in pack), Ticket #009: (300 - 1) - 9 = 290 -> "290"
 */
export function computeLotterySeriesCode(gamePrefixOrNumber, ticketNumber, customGames = [], customPackSize = null) {
  if (ticketNumber === null || ticketNumber === undefined || isNaN(ticketNumber)) {
    return '000';
  }
  const tix = parseInt(ticketNumber, 10);
  const pStr = String(gamePrefixOrNumber || '').trim();
  
  let packSize = customPackSize;
  if (!packSize) {
    const matched = SAMPLE_GAMES.find(g => g.barcodePrefix === pStr || String(g.id).replace(/[^0-9]/g, '') === pStr)
      || (customGames || []).find(g => g.barcodePrefix === pStr || String(g.id).replace(/[^0-9]/g, '') === pStr);
    if (matched && matched.packSize) {
      packSize = matched.packSize;
    } else if (matched && matched.price) {
      const std = getStandardPackDetails(matched.price);
      packSize = std.packSize;
    }
  }

  if (!packSize) {
    if (tix >= 150) packSize = 300;
    else if (tix >= 100) packSize = 150;
    else if (tix >= 60) packSize = 100;
    else if (tix >= 30) packSize = 60;
    else packSize = 150;
  }

  const maxIndex = Math.max(0, packSize - 1);
  const computed = Math.max(0, maxIndex - tix);
  return String(computed).padStart(3, '0');
}

// Robust Lottery Barcode Parser (SCEL, Georgia Lottery, Scientific Games / IGT)
// Correctly parses standard 6-digit packs with 1-digit check and 3-digit ticket:
// - 4-segment printed text: "1648-018378-8-000(029)", "1672-007252-3-000(099)"
// - 14-digit continuous barcode: "16480183788000" (tix 000), "16480183780001" (tix 001), "16720072520007" (tix 007)
// - 17-digit barcode: "16480183788000029"
// - 11-digit pack manifest: "16480183788"
export function parseLotteryBarcode(raw, customGames = []) {
  if (!raw) return null;
  let s = String(raw).replace(/[\r\n\t]/g, '').trim();
  if (!s) return null;

  // Strip standard AIM / Keyence scanner symbology prefix (e.g. "]C1", "]I0", "]e0", "]C0", "]A0")
  s = s.replace(/^\][a-zA-Z0-9]{2,3}/, '').trim();

  // Strip Code 39 start/stop asterisks if present
  s = s.replace(/^\*+|\*+$/g, '').trim();

  // If the scanned string is a URL (e.g. from 2D QR code on back of ticket), extract the lottery barcode digits
  if (s.includes('http://') || s.includes('https://') || s.includes('www.') || s.includes('scel.net') || s.includes('galottery.com')) {
    const urlDigitsMatch = s.match(/(?:code|ticket|barcode|entry|t|b)=?(\d{10,24})/i) || s.match(/(\d{11,17})/);
    if (urlDigitsMatch) {
      s = urlDigitsMatch[1];
    }
  }

  // Reject barcodes containing letters (electronics serial numbers, asset tags, laptop model numbers, etc.)
  // Real scratch-off lottery ticket barcodes are 100% numeric!
  if (/[a-zA-Z]/.test(s)) {
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      raw
    };
  }

  // Pattern 0: 4-segment format: Game - Pack - Check - Ticket (Security)
  // Matches printed ticket text: "1648-018378-8-029(000)", "1672-007252-3-000[099]", "1648-018378-8-000", "1648-018378-0-001"
  const fourPartMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]+(\d{1,2})[-_\s]+(\d{1,4})(?:[-_\s]*[([{]?(\d{1,4})[)\]}]?)?$/);
  if (fourPartMatch) {
    const gameNumber = fourPartMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    const packNumber = fourPartMatch[2];
    const checkCode = fourPartMatch[3];
    const ticketNumber = parseInt(fourPartMatch[4], 10);
    const ticketString = String(fourPartMatch[4]).padStart(3, '0');
    const securityCode = fourPartMatch[5] || null;

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: (checkCode ? `${gameNumber}-${packNumber}-${checkCode}-${ticketString} (${sec})` : `${gameNumber}-${packCombined}-${ticketString} (${sec})`),
      raw
    };
  }

  // Pattern 0b: Continuous 13 or 14 digits with trailing security PIN in parentheses/brackets
  // e.g. "14170670170009(290)", "16480183788002(000)", "14180996564082[067]", "1418099656082(000)"
  const parenContinuousMatch = s.match(/^(\d{4})(\d{6})(\d{1})?(\d{3})\s*[([{](\d{1,4})[)\]}]$/);
  if (parenContinuousMatch) {
    const gameNumber = parenContinuousMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    const packNumber = parenContinuousMatch[2];
    const checkCode = parenContinuousMatch[3] !== undefined ? parenContinuousMatch[3] : null;
    const ticketString = parenContinuousMatch[4];
    const ticketNumber = parseInt(ticketString, 10);
    const securityCode = parenContinuousMatch[5];

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // Pattern 1: 3-segment format: Game - Pack - Ticket (Check/Security)
  // e.g. "1898-0019425-084(015)", "1234-567890-001[023]", "1648-018378-000", "1417-0670170-009(290)"
  const delimitedMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]+(\d{1,3})(?:[-_\s]*[([{]?(\d{1,4})[)\]}]?)?$/);
  if (delimitedMatch) {
    const gameNumber = delimitedMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    let packNumber = delimitedMatch[2];
    const seg3Num = parseInt(delimitedMatch[3], 10);
    const seg3Str = String(delimitedMatch[3]).padStart(3, '0');
    const parenStr = delimitedMatch[4] || null;
    const parenNum = delimitedMatch[4] ? parseInt(delimitedMatch[4], 10) : null;

    let ticketNumber = isNaN(seg3Num) ? 0 : seg3Num;
    let ticketString = seg3Str;
    let checkCode = null;
    let securityCode = null;

    if (delimitedMatch[3].length === 1 && parenNum !== null) {
      checkCode = delimitedMatch[3];
      ticketNumber = parenNum;
      ticketString = parenStr.padStart(3, '0');
    } else if (parenStr) {
      securityCode = parenStr;
    }

    // In US / Georgia Lottery scratch tickets, standard pack numbers are 6 digits.
    // If the pack segment has 7 digits (e.g. "0670170" or "0183788"), the 7th digit is the check code.
    // Split into 6-digit pack ("067017") and 1-digit check ("0") to guarantee exact 14-digit standard barcode.
    if (packNumber.length === 7 && checkCode === null) {
      checkCode = packNumber.slice(6, 7);
      packNumber = packNumber.slice(0, 6);
    }

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // Pattern 1b: Game - Pack - (Ticket) where ticket number is in parentheses or brackets
  const parenthesizedTixMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]*[([{](\d{1,4})[)\]}]$/);
  if (parenthesizedTixMatch) {
    const gameNumber = parenthesizedTixMatch[1];
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    let packNumber = parenthesizedTixMatch[2];
    let checkCode = null;
    let packCombined = packNumber;
    if (packNumber.length === 7) {
      checkCode = packNumber.slice(6, 7);
      packNumber = packNumber.slice(0, 6);
    }
    const ticketNumber = parseInt(parenthesizedTixMatch[3], 10);
    const ticketString = String(parenthesizedTixMatch[3]).padStart(3, '0');

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // Pattern 2a: Delimited Game - Pack (e.g. "1648-018378", "1672-007252")
  // Valid only if gameNumber matches registered lottery game or lottery game range (100-9999).
  // Electronic items, store products, and non-lottery SKUs (e.g. "2731-590419") are strictly rejected!
  const gamePackMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})$/);
  if (gamePackMatch) {
    const gameNumber = gamePackMatch[1];
    let packNumber = gamePackMatch[2];
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999)) {
      let checkCode = null;
      let packCombined = packNumber;
      if (packNumber.length === 7) {
        checkCode = packNumber.slice(6, 7);
        packNumber = packNumber.slice(0, 6);
      }
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined,
        ticketNumber: null,
        ticketString: null,
        checkCode,
        standardBarcode: `${gameNumber}${packCombined}`,
        canonicalId: `${gameNumber}-${packCombined || packNumber}`,
        fullId: `${gameNumber}-${packNumber}${checkCode ? '-' + checkCode : ''}`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // Pattern 3: Pure continuous digits
  let digits = s.replace(/[^0-9]/g, '');

  // Strip scanner leading zeroes (e.g. 15 or 16-digit output from scanners configured with leading 0 padding)
  if (digits.length === 15 && digits.startsWith('0')) {
    digits = digits.slice(1);
  } else if (digits.length === 16 && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // 17 digits: 4 game + 6 pack + 1 check + 3 ticket + 3 security (e.g. 16480183788029000, 14170670170009290, 14180996564082067)
  if (digits.length === 17) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack (018378)
    const checkCode = digits.slice(10, 11); // 1-digit check (8)
    const ticketNumber = parseInt(digits.slice(11, 14), 10); // 3-digit ticket (029)
    const ticketString = digits.slice(11, 14);
    const parenMatch = s.match(/[([{](\d{1,4})[)\]}]/);
    const securityCode = parenMatch ? parenMatch[1] : digits.slice(14, 17);
    const standardBarcode = digits.slice(0, 14);

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // 16 digits: 4 game + 6 pack + 3 ticket + 3 security (13 core ticket digits without check digit + 3 PIN digits)
  // e.g. 1418099656082000, 1418099656082067
  if (digits.length === 16) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack
    const ticketNumber = parseInt(digits.slice(10, 13), 10); // 3-digit ticket
    const ticketString = digits.slice(10, 13);
    const parenMatch = s.match(/[([{](\d{1,4})[)\]}]/);
    const securityCode = parenMatch ? parenMatch[1] : digits.slice(13, 16);
    const standardBarcode = `${gameNumber}${packNumber}0${ticketString}`;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined: packNumber,
      ticketNumber,
      ticketString,
      checkCode: null,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packNumber}-${ticketString} (${sec})`,
      raw
    };
  }

  // 14 digits: Standard Interleaved 2 of 5 / Code 128 barcode on Georgia Lottery & US scratch tickets:
  // Dual standards:
  // Layout A (e.g. GA Lottery / IGT): [4 Game][6 Pack][1 Check][3 Ticket] (e.g. 16480183788029 -> Game 1648, Pack 018378, Check 8, Ticket 029)
  // Layout B (e.g. SCEL / Scientific Games): [4 Game][6 Pack][3 Ticket][1 Trailer] (e.g. 16583508770290 -> Game 1658, Pack 350877, Ticket 029, Trailer 0)
  if (digits.length === 14) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isRetailProduct: true,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const packNumber = digits.slice(4, 10); // 6-digit pack (018378, 350877)

    // Layout A: [Game 4][Pack 6][Check 1][Ticket 3]
    const checkA = digits.slice(10, 11);
    const tixStrA = digits.slice(11, 14);
    const tixNumA = parseInt(tixStrA, 10);

    // Layout B: [Game 4][Pack 6][Ticket 3][Trailer 1]
    const tixStrB = digits.slice(10, 13);
    const tixNumB = parseInt(tixStrB, 10);
    const trailerB = digits.slice(13, 14);

    const matched = SAMPLE_GAMES.find(g => g.barcodePrefix === gameNumber || String(g.id).replace(/[^0-9]/g, '') === gameNumber)
      || (customGames || []).find(g => g.barcodePrefix === gameNumber || String(g.id).replace(/[^0-9]/g, '') === gameNumber);
    const knownPackSize = matched?.packSize || (matched?.price ? getStandardPackDetails(matched.price).packSize : null);

    let isLayoutB = false;
    if (tixNumB > 299) {
      isLayoutB = false;
    } else if (tixNumA > 299) {
      isLayoutB = true;
    } else if (knownPackSize && tixNumA >= knownPackSize && tixNumB < knownPackSize) {
      isLayoutB = true;
    } else if (knownPackSize && tixNumB >= knownPackSize && tixNumA < knownPackSize) {
      isLayoutB = false;
    } else if (tixNumA >= 100 && tixNumB < 100 && trailerB === '0') {
      isLayoutB = true;
    }

    const ticketNumber = isLayoutB ? tixNumB : tixNumA;
    const ticketString = isLayoutB ? tixStrB : tixStrA;
    const checkCode = isLayoutB ? null : checkA;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isRetailProduct: true,
        isNonLotteryBarcode: true,
        gameNumber: null,
        packNumber: null,
        packClean: null,
        ticketNumber: null,
        raw
      };
    }

    const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      trailer: isLayoutB ? trailerB : null,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode: digits,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: (isLayoutB || !checkCode)
        ? `${gameNumber}-${packNumber}-${ticketString} (${sec})`
        : `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // 15 digits: 4 game + 6 pack + 1 check + 3 ticket + 1 trailer/check (e.g. 164801837880005)
  if (digits.length === 15) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const checkCode = digits.slice(10, 11);
      const ticketNumber = parseInt(digits.slice(11, 14), 10);
      const ticketString = digits.slice(11, 14);
      const standardBarcode = digits.slice(0, 14);
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined,
          ticketNumber,
          ticketString,
          checkCode,
          securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
          standardBarcode,
          canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
          fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
          displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
          raw
        };
      }
    }
  }

  // 18 to 26 digits: Continuous barcode with trailing validation digits (2D/PDF417 scratch barcode)
  // Format: [4 Game][6 Pack][1 Check][3 Ticket][10 Validation Payload]
  // e.g. 141706701700098494869032 -> Core 14-digit ticket barcode is 14170670170009
  // The trailing 10 digits (8494869032) are internal validation payload, NOT the security PIN.
  if (digits.length >= 18 && digits.length <= 26) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (!isLotteryGame) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        raw
      };
    }
    const packNumber = digits.slice(4, 10); // 6-digit pack
    const checkCode = digits.slice(10, 11); // 1-digit check
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const standardBarcode = digits.slice(0, 14); // Exactly the core 14-digit lottery ticket barcode

    // Only set security code if the raw input string explicitly contained parentheses (e.g. "(290)")
    const parenMatch = s.match(/\((\d{1,4})\)/);
    const securityCode = parenMatch ? parenMatch[1] : null;

    if (isNaN(ticketNumber) || ticketNumber > 999) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
    const packCombined = (packNumber.length === 6 && checkCode) ? `${packNumber}${checkCode}` : packNumber;
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      packCombined,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
      standardBarcode,
      canonicalId: `${gameNumber}-${packCombined}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
      raw
    };
  }

  // 13 digits: Can be 4 game + 6 pack + 3 ticket (Lottery ticket with stripped check digit)
  // OR retail store merchandise (EAN-13)
  if (digits.length === 13) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const ticketNumber = parseInt(digits.slice(10, 13), 10);
      const ticketString = digits.slice(10, 13);
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined: packNumber,
          ticketNumber,
          ticketString,
          checkCode: null,
          securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
          standardBarcode: `${gameNumber}${packNumber}0${ticketString}`,
          canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
          fullId: `${gameNumber}-${packNumber}-${ticketString}(${sec})`,
          displayBarcode: `${gameNumber}-${packNumber}-${ticketString} (${sec})`,
          raw
        };
      }
    }
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // 12 digits: Check if it's a 12-digit lottery barcode (4 game + 6 pack + 2 ticket) OR standard retail merchandise (UPC-A)
  if (digits.length === 12) {
    const gameNumber = digits.slice(0, 4);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const ticketNumber = parseInt(digits.slice(10, 12), 10);
      const ticketString = digits.slice(10, 12).padStart(3, '0');
      if (!isNaN(ticketNumber) && ticketNumber <= 999) {
        const sec = computeLotterySeriesCode(gameNumber, ticketNumber, customGames);
        return {
          isValid: true,
          gameNumber,
          packNumber,
          packClean: packNumber.replace(/^0+/, '') || packNumber,
          packCombined: packNumber,
          ticketNumber,
          ticketString,
          checkCode: null,
          securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
          standardBarcode: `${gameNumber}${packNumber}0${ticketString}`,
          canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
          fullId: `${gameNumber}-${packNumber}-${ticketString}(${sec})`,
          displayBarcode: `${gameNumber}-${packNumber}-${ticketString} (${sec})`,
          raw
        };
      }
    }
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // 8 digits: Standard retail merchandise (EAN-8)
  if (digits.length === 8) {
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // 11 digits: 4 game + 6 pack + 1 check (Pack Barcode / Book Manifest Barcode, e.g. 16480183788, 14180996564)
  if (digits.length === 11) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10); // 6-digit pack
      const checkCode = digits.slice(10, 11);
      const sec = computeLotterySeriesCode(gameNumber, 0, customGames);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined: digits.slice(4, 11),
        ticketNumber: 0,
        ticketString: '000',
        checkCode,
        securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
        canonicalId: `${gameNumber}-${digits.slice(4, 11)}`,
        fullId: `${gameNumber}-${packNumber}-${checkCode}`,
        standardBarcode: digits,
        displayBarcode: `${gameNumber}-${digits.slice(4, 11)}-000 (${sec})`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // 10 digits: 4 game + 6 pack (Pack Barcode, e.g. 1648018378)
  if (digits.length === 10) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    const isLotteryGame = isKnownGamePrefix(gameNumber, customGames) || (gNum >= 100 && gNum <= 9999);
    if (isLotteryGame) {
      const packNumber = digits.slice(4, 10);
      const sec = computeLotterySeriesCode(gameNumber, 0, customGames);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        packCombined: packNumber,
        ticketNumber: 0,
        ticketString: '000',
        checkCode: null,
        securityCode: sec,
      hasExplicitSecurityCode: Boolean(typeof securityCode !== 'undefined' && securityCode),
        canonicalId: `${gameNumber}-${packNumber}`,
        fullId: `${gameNumber}-${packNumber}`,
        standardBarcode: digits,
        displayBarcode: `${gameNumber}-${packNumber}-000 (${sec})`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      isRetailProduct: true,
      raw
    };
  }

  // Check against known game barcode prefixes in SAMPLE_GAMES
  for (const g of SAMPLE_GAMES) {
    if (g.barcodePrefix && digits.startsWith(g.barcodePrefix)) {
      const rest = digits.slice(g.barcodePrefix.length);
      if (rest.length >= 6) {
        const pack = rest.slice(0, 6);
        const check = rest.length >= 7 ? rest.slice(6, 7) : null;
        const tixStr = rest.length >= 10 ? rest.slice(7, 10) : (rest.length >= 9 ? rest.slice(6, 9) : null);
        const tix = tixStr ? parseInt(tixStr, 10) : null;
        if (tix === null || (!isNaN(tix) && tix <= 999)) {
          return {
            isValid: true,
            isPackBarcode: tix === null,
            gameNumber: g.barcodePrefix,
            packNumber: pack,
            packClean: pack.replace(/^0+/, '') || pack,
            ticketNumber: (tix !== null && !isNaN(tix)) ? tix : null,
            ticketString: tixStr,
            checkCode: check,
            canonicalId: tixStr ? `${g.barcodePrefix}-${(pack && check) ? pack + check : pack}-${tixStr}` : `${g.barcodePrefix}-${(pack && check) ? pack + check : pack}`,
            fullId: check && tixStr ? `${g.barcodePrefix}-${pack}-${check}-${tixStr}` : `${g.barcodePrefix}-${pack}`,
            standardBarcode: tixStr ? `${g.barcodePrefix}${pack}${check || '0'}${tixStr}` : `${g.barcodePrefix}${pack}`,
            raw
          };
        }
      }
    }
  }

  return {
    isValid: false,
    isNonLotteryBarcode: true,
    gameNumber: digits.length >= 4 ? digits.slice(0, 4) : null,
    packNumber: digits.length >= 6 ? digits.slice(4, 10) : (digits || null),
    packClean: digits.replace(/^0+/, '') || digits,
    ticketNumber: null,
    checkCode: null,
    raw
  };
}

/**
 * Formats any raw lottery barcode into the authentic Georgia Lottery / SCEL physical ticket structure
 * matching the printed text on scratch tickets (e.g. "1418-0996564-081 (068)" or "1418-0996564-081 (000)").
 * 
 * Structure: [4 Game]-[7 Pack+Check]-[3 Ticket] ([3 Series PIN])
 */
export function formatTicketDisplayBarcode(rawOrParsed, customGames = [], overrideSecurityCode = null) {
  if (!rawOrParsed) return '---';
  const parsed = (rawOrParsed && typeof rawOrParsed === 'object' && rawOrParsed.isValid !== undefined)
    ? rawOrParsed
    : parseLotteryBarcode(rawOrParsed, customGames);

  if (!parsed || !parsed.isValid) {
    return String(rawOrParsed || '');
  }

  const rawStr = typeof rawOrParsed === 'string' ? rawOrParsed : (parsed.raw || '');
  const hasThreeHyphens = rawStr.split('-').length >= 4;

  // Pack barcode manifest (no individual ticket number)
  if (parsed.isPackBarcode || parsed.ticketNumber === null) {
    const game = parsed.gameNumber || '1000';
    let pack = parsed.packNumber || '000000';
    const check = (parsed.checkCode !== null && parsed.checkCode !== undefined) ? String(parsed.checkCode) : '';
    if (rawStr.includes('-') && check) {
      return `${game}-${pack}-${check}`;
    }
    const packSegment = (pack.length === 6 && check) ? `${pack}${check}` : pack;
    return `${game}-${packSegment}`;
  }

  const game = parsed.gameNumber || '1000';
  let pack = parsed.packNumber || '000000';
  const check = (parsed.checkCode !== null && parsed.checkCode !== undefined) ? String(parsed.checkCode) : '';
  
  // Combine 6-digit pack and 1-digit check code into 7-digit block (e.g. "099656" + "4" -> "0996564")
  // or preserve 4-segment hyphenation (e.g. "1648-018378-8-000")
  let packSegment = pack;
  if (pack.length === 6 && check) {
    packSegment = `${pack}${check}`;
  }

  const ticket = parsed.ticketString || (parsed.ticketNumber !== null ? String(parsed.ticketNumber).padStart(3, '0') : '000');
  const sec = (overrideSecurityCode !== null && overrideSecurityCode !== undefined && String(overrideSecurityCode).trim() !== '')
    ? String(overrideSecurityCode).trim()
    : (parsed.securityCode || computeLotterySeriesCode(game, parsed.ticketNumber, customGames));

  if (hasThreeHyphens && check) {
    return `${game}-${pack}-${check}-${ticket} (${sec})`;
  }

  return `${game}-${packSegment}-${ticket} (${sec})`;
}

export function formatLotteryBarcode(rawCode, customGames = [], overrideSecurityCode = null) {
  return formatTicketDisplayBarcode(rawCode, customGames, overrideSecurityCode);
}

/**
 * Normalizes a pack number string to its canonical numeric sequence (digits stripped of leading zeros).
 * Handles plain 6-digit packs ("018378" -> "18378"), hyphenated game-pack ("1648-018378" -> "18378"),
 * 14-digit continuous ("16480183788000" -> "18378"), and 11-digit manifest ("16480183788" -> "18378").
 */
export function normalizePackNumber(packStr) {
  if (!packStr) return '';
  let s = String(packStr).replace(/[\r\n\t]/g, '').replace(/^\][a-zA-Z0-9]{2,3}/, '').trim();
  const parts = s.split(/[-_\s]+/);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    if (parts[0].length <= 5 && parts[1].length >= 4) {
      s = parts[1];
    }
  } else {
    const rawDigits = s.replace(/[^0-9]/g, '');
    if (rawDigits.length >= 10) {
      // Any continuous lottery barcode (10, 11, 13, 14, 17, 24 digits): indices 4..10 are the 6-digit pack number
      s = rawDigits.slice(4, 10);
    }
  }
  const digits = s.replace(/[^0-9]/g, '');
  return digits.replace(/^0+/, '') || digits;
}

/**
 * High-precision pack number matching that ensures all tickets from the same pack match,
 * while maintaining backward compatibility with previously stored packs.
 */
export function isPackNumberMatch(packA, packB) {
  if (!packA || !packB) return false;
  const normA = normalizePackNumber(packA);
  const normB = normalizePackNumber(packB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Backward compatibility with previously saved 7-digit corruptions (trailing check digit appended by old bug)
  if (normA.length >= 5 && normB.length >= 5) {
    if (normA.length === normB.length + 1 && normA.startsWith(normB)) return true;
    if (normB.length === normA.length + 1 && normB.startsWith(normA)) return true;
  }
  return false;
}

export function findGameByBarcode(rawCode, customGames = []) {
  if (!rawCode) return null;
  const s = String(rawCode).trim();
  const digits = s.replace(/[^0-9]/g, '');
  const parsed = parseLotteryBarcode(rawCode, customGames);

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
  return getCleanEmptyState({
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
    retailerNumber: 'GA-89412',
    totalSlots: 65
  });
}

export function loadState(targetStoreId = null) {
  const storeId = targetStoreId || getCurrentStoreId();
  const key = getStoreStorageKey(storeId);
  try {
    // Purge old v1 and v2 mock data if present
    if (localStorage.getItem('lotto_track_pos_data_v1')) {
      localStorage.removeItem('lotto_track_pos_data_v1');
    }
    if (localStorage.getItem('lotto_track_pos_data_v2')) {
      localStorage.removeItem('lotto_track_pos_data_v2');
    }
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.customGames) parsed.customGames = [];
      if (!parsed.soldOutThisShift) parsed.soldOutThisShift = [];
      if (!parsed.partialTakeOuts) parsed.partialTakeOuts = [];
      if (!parsed.inventoryBarcodes) parsed.inventoryBarcodes = {};
      if (parsed.onlineSales === undefined) parsed.onlineSales = 0;
      if (parsed.cashes === undefined) parsed.cashes = 0;
      if (parsed.onlineCashes === undefined) parsed.onlineCashes = 0;
      if (parsed.discontinuedCount === undefined) parsed.discontinuedCount = 0;
      if (typeof parsed.shiftOpeningActiveCount !== 'number') {
        parsed.shiftOpeningActiveCount = (parsed.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber).length;
      }

      // Auto-sanitize and repair slots from original scannedBarcodes records
      if (parsed.slots && Array.isArray(parsed.slots)) {
        parsed.slots.forEach(s => {
          // Remove human-readable header display strings that leaked into scannedBarcodes
          if (Array.isArray(s.scannedBarcodes)) {
            s.scannedBarcodes = s.scannedBarcodes.filter(b => {
              const bStr = typeof b === 'string' ? b : b?.barcode;
              return bStr && !bStr.includes('Box #') && !bStr.includes('·') && !bStr.includes('(');
            });
            s.ticketsInBox = s.scannedBarcodes.length;
          }

          // If packNumber was corrupted (e.g. into trailer digits "515284", "081068"), restore from scannedBarcodes
          if (Array.isArray(s.scannedBarcodes) && s.scannedBarcodes.length > 0) {
            const firstValid = s.scannedBarcodes.find(b => {
              const bStr = typeof b === 'string' ? b : b?.barcode;
              const p = parseLotteryBarcode(bStr, parsed.customGames);
              return p && p.isValid && p.packNumber;
            });
            if (firstValid) {
              const bStr = typeof firstValid === 'string' ? firstValid : firstValid.barcode;
              const p = parseLotteryBarcode(bStr, parsed.customGames);
              if (p && p.isValid) {
                if (!s.packNumber || !isPackNumberMatch(s.packNumber, p.packNumber)) {
                  const accuratePack = p.packNumber || p.packCombined;
                  s.packNumber = accuratePack;
                }
                if ((s.startTicket === 0 || s.startTicket === null || s.startTicket === undefined) && p.ticketNumber !== null && p.ticketNumber !== undefined) {
                  s.startTicket = p.ticketNumber;
                  s.currentTicket = p.ticketNumber;
                }
                const sec = p.securityCode || (firstValid && firstValid.securityCode);
                if (sec && (!s.startSecurityCode || s.startSecurityCode === '000')) {
                  s.startSecurityCode = sec;
                  s.securityCode = sec;
                  s.currentSecurityCode = sec;
                }
              }
            }
          }

          // If active box has uninitialized or 0 startTicket while currentTicket > 0, align them to avoid phantom sales
          if (s.status === 'ACTIVE' && s.packNumber) {
            if ((s.startTicket === undefined || s.startTicket === null || s.startTicket === 0) && typeof s.currentTicket === 'number' && s.currentTicket > 0) {
              s.startTicket = s.currentTicket;
            }
          }

          // Auto-link barcodePrefix and gameId if missing from legacy saves
          if (!s.barcodePrefix && s.gameName) {
            const cleanName = cleanGameTitle(s.gameName).toLowerCase();
            const matched = SAMPLE_GAMES.find(g => cleanGameTitle(g.name).toLowerCase() === cleanName) ||
                            (parsed.customGames || []).find(cg => cleanGameTitle(cg.name).toLowerCase() === cleanName);
            if (matched && matched.barcodePrefix) {
              s.barcodePrefix = matched.barcodePrefix;
              if (!s.gameId) s.gameId = matched.id;
            }
          }
        });
      }
      if (parsed.partialTakeOuts && Array.isArray(parsed.partialTakeOuts)) {
        parsed.partialTakeOuts.forEach(pto => {
          if (pto.packNumber) {
            pto.packNumber = String(pto.packNumber).trim();
          }
        });
      }
      if (parsed.soldOutThisShift && Array.isArray(parsed.soldOutThisShift)) {
        parsed.soldOutThisShift.forEach(so => {
          if (so.packNumber) {
            so.packNumber = String(so.packNumber).trim();
          }
        });
      }

      if (parsed.dataCleared) {
        if (!Array.isArray(parsed.shiftHistory)) parsed.shiftHistory = [];
        if (!parsed.shiftStatus) parsed.shiftStatus = 'SHIFT_ENDED';
      }

      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse local storage state:', e);
  }

  // If this store doesn't have state yet:
  const stores = getStoresList();
  const cleanId = String(storeId).replace(/^store_/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const dispName = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
  const storeMeta = stores.find(st => st.id === storeId) || {
    id: storeId,
    name: (storeId === 'store_amigo') ? 'AMIGO FOOD MART' : `${dispName.toUpperCase()} STORE`,
    address: (storeId === 'store_amigo') ? '2300 MOODY RD WARNER ROBINS, GA, 31088' : `${dispName} Location`,
    retailerNumber: (storeId === 'store_amigo') ? 'GA-89412' : `GA-${Math.floor(10000 + Math.random() * 90000)}`,
    phone: (storeId === 'store_amigo') ? '(478) 923-4567' : '(555) 000-0000',
    totalBoxes: 65,
    status: 'ACTIVE'
  };
  const fresh = getCleanEmptyState({
    storeId: storeId,
    storeName: storeMeta.name,
    storeAddress: storeMeta.address,
    retailerNumber: storeMeta.retailerNumber,
    totalSlots: storeMeta.totalBoxes || 65
  });
  fresh.storeId = storeId;
  fresh.dataCleared = false;
  try {
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch (_) {}
  return fresh;
}

export function saveState(state, targetStoreId = null) {
  const storeId = targetStoreId || (state && state.storeId) || getCurrentStoreId();
  if (state) {
    state.storeId = storeId;
    const hasActiveBoxes = Array.isArray(state.slots) && state.slots.some(s => s && s.status === 'ACTIVE' && s.packNumber);
    if (hasActiveBoxes) {
      state.dataCleared = false;
    }
  }
  const key = getStoreStorageKey(storeId);
  try {
    localStorage.setItem(key, JSON.stringify(state));
    // Asynchronously synchronize state backup to backend
    syncPOSStateToDB(state);
  } catch (e) {
    console.error('Failed to save state to localStorage:', e);
  }
}

export function getCleanEmptyState(existingState = null) {
  const slots = [];
  const TOTAL_SLOTS = (existingState && existingState.totalSlots) ? existingState.totalSlots : 65;

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
      soldBarcodes: [],
      activatedThisShift: false,
      daysActive: 0,
      scannedInEndShift: false
    });
  }

  const storeId = existingState?.storeId || 'store_amigo';
  const cleanId = String(storeId).replace(/^store_/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const dispName = cleanId.charAt(0).toUpperCase() + cleanId.slice(1);
  const storeName = existingState?.storeName || ((storeId === 'store_amigo') ? 'AMIGO FOOD MART' : `${dispName.toUpperCase()} STORE`);
  const storeAddress = existingState?.storeAddress || ((storeId === 'store_amigo') ? '2300 MOODY RD WARNER ROBINS, GA, 31088' : `${dispName} Location`);
  const retailerNumber = existingState?.retailerNumber || ((storeId === 'store_amigo') ? 'GA-89412' : `GA-${Math.floor(10000 + Math.random() * 90000)}`);
  const registerName = existingState?.registerName || 'Register 1';
  const cashierName = existingState?.cashierName || 'master';
  const settings = existingState?.settings ? { ...existingState.settings } : {
    soundEnabled: true,
    voiceEnabled: true,
    autoPrint: true,
    autoEmail: false,
    targetEmails: 'amigofoodmart2300@gmail.com',
    operationMode: 'DAILY',
    warning1Days: 7,
    warning2Days: 12,
    warningOldDays: 21,
    zeroIndexed: true
  };

  return {
    storeId,
    storeName,
    storeAddress,
    retailerNumber,
    registerName,
    shiftNumber: 1,
    cashierName,
    shiftStatus: 'SHIFT_ENDED',
    shiftStartedAt: null,
    totalSlots: TOTAL_SLOTS,
    slots,
    visibleBoxNumbers: [],
    boxAccessTimes: {},
    inStockInventory: [],
    inventory: [],
    inventoryBarcodes: {},
    customGames: [],
    onlineSales: 0,
    cashes: 0,
    onlineCashes: 0,
    discontinuedCount: 0,
    shiftOpeningActiveCount: 0,
    soldOutThisShift: [],
    partialTakeOuts: [],
    shiftHistory: [],
    lastScannedBarcode: '',
    lastScannedSlot: null,
    lastScanData: null,
    soldBarcodes: [],
    dataCleared: false,
    settings
  };
}

export function resetToDefaults() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('lotto_track_pos_data_v3_store_amigo');
    localStorage.removeItem('lotto_track_pos_data_v1');
    localStorage.removeItem('lotto_track_pos_data_v2');
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
  const seeded = getCleanEmptyState({
    storeId: 'store_amigo',
    storeName: 'AMIGO FOOD MART',
    storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
    retailerNumber: 'GA-89412',
    totalSlots: 65
  });
  saveState(seeded, 'store_amigo');
  return seeded;
}

export function resetToCleanState(existingState = null) {
  const storeId = (existingState && existingState.storeId) ? existingState.storeId : getCurrentStoreId();
  const empty = getCleanEmptyState(existingState);
  empty.storeId = storeId;
  empty.dataCleared = true;
  empty.shiftStatus = 'SHIFT_ENDED';
  empty.shiftHistory = [];
  empty.inStockInventory = [];
  empty.inventory = [];
  empty.inventoryBarcodes = {};
  empty.soldOutThisShift = [];
  empty.partialTakeOuts = [];
  empty.soldBarcodes = [];
  empty.shiftNumber = 1;
  const storeKey = getStoreStorageKey(storeId);
  try {
    localStorage.removeItem(storeKey);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('lotto_track_pos_data_v1');
    localStorage.removeItem('lotto_track_pos_data_v2');
    localStorage.setItem(storeKey, JSON.stringify(empty));
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
  try {
    clearPOSStateOnDB(storeId);
  } catch (_) {}
  syncPOSStateToDB(empty, true);
  return empty;
}


