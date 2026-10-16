// State Management & Lottery POS Data Model
import { syncPOSStateToDB } from './dbSync.js';

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
  { id: 'g125', name: 'JUMBO BUCK EXT', price: 50, bookValue: 900, packSize: 18, barcodePrefix: '1835' },
  { id: 'g1648', name: 'EPIC RICHES', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1648' },
  { id: 'g1672', name: 'TREASURE HUNT', price: 3, bookValue: 300, packSize: 100, barcodePrefix: '1672' }
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
    if (tix > 150) packSize = 300;
    else if (tix > 100) packSize = 150;
    else if (tix > 60) packSize = 100;
    else if (tix > 30) packSize = 60;
    else packSize = 30;
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

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || '000';
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
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
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

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || '000';
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
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
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

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || '000';
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
      standardBarcode: `${gameNumber}${packNumber}${checkCode || '0'}${ticketString}`,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
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
    const packNumber = parenthesizedTixMatch[2];
    const ticketNumber = parseInt(parenthesizedTixMatch[3], 10);
    const ticketString = String(parenthesizedTixMatch[3]).padStart(3, '0');

    if (!isLotteryGame || isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = '000';
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
      standardBarcode: `${gameNumber}${packNumber}0${ticketString}`,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packNumber}-${ticketString} (${sec})`,
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
        canonicalId: `${gameNumber}-${packNumber}`,
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

    if (isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || '000';
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
      standardBarcode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
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

    if (isNaN(ticketNumber) || ticketNumber > 299) {
      return {
        isValid: false,
        isNonLotteryBarcode: true,
        raw
      };
    }

    const sec = securityCode || '000';
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
      standardBarcode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packNumber}-${ticketString} (${sec})`,
      raw
    };
  }

  // 14 digits: Standard Interleaved 2 of 5 / Code 128 barcode on Georgia Lottery & US scratch tickets:
  // Format: [4 Game][6 Pack][1 Check][3 Ticket]
  // e.g. 16480183788029 -> Game 1648, Pack 018378, Check 8, Ticket 029
  // e.g. 14170670170009 -> Game 1417, Pack 067017, Check 0, Ticket 009
  // e.g. 16480183780001 -> Game 1648, Pack 018378, Check 0, Ticket 001
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

    const packNumber = digits.slice(4, 10); // 6-digit pack (018378, 067017)

    // In Georgia Lottery & Scientific Games scratch tickets, the 11th digit (index 10) is check code,
    // and the last 3 digits (indices 11..14) are the ticket number (000..299).
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const checkCode = digits.slice(10, 11);

    if (isNaN(ticketNumber) || ticketNumber > 299) {
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
      securityCode: sec,
      standardBarcode: digits,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packCombined}-${ticketString}(${sec})`,
      displayBarcode: `${gameNumber}-${packCombined}-${ticketString} (${sec})`,
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
      if (!isNaN(ticketNumber) && ticketNumber <= 299) {
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
          standardBarcode,
          canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
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

    if (isNaN(ticketNumber) || ticketNumber > 299) {
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
      standardBarcode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
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
      if (!isNaN(ticketNumber) && ticketNumber <= 299) {
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
      if (!isNaN(ticketNumber) && ticketNumber <= 299) {
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
        canonicalId: `${gameNumber}-${packNumber}`,
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
        if (tix === null || (!isNaN(tix) && tix <= 299)) {
          return {
            isValid: true,
            isPackBarcode: tix === null,
            gameNumber: g.barcodePrefix,
            packNumber: pack,
            packClean: pack.replace(/^0+/, '') || pack,
            ticketNumber: (tix !== null && !isNaN(tix)) ? tix : null,
            ticketString: tixStr,
            checkCode: check,
            canonicalId: tixStr ? `${g.barcodePrefix}-${pack}-${tixStr}` : `${g.barcodePrefix}-${pack}`,
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
      soldBarcodes: [],
      activatedThisShift: false,
      daysActive: 0,
      scannedInEndShift: false
    });
  }

  const refBoxes = [
    { boxNumber: 1, gameName: '5X Money', price: 1, packNumber: '128842', packSize: 300, currentTicket: 13, startTicket: 0, daysActive: 2 },
    { boxNumber: 2, gameName: 'Jr Jumbo', price: 1, packNumber: '745508', packSize: 300, currentTicket: 9, startTicket: 0, daysActive: 2 },
    { boxNumber: 3, gameName: 'Loteria', price: 2, packNumber: '933093', packSize: 150, currentTicket: 3, startTicket: 0, daysActive: 7 },
    { boxNumber: 4, gameName: 'Hit 100', price: 2, packNumber: '558845', packSize: 150, currentTicket: 11, startTicket: 0, daysActive: 4 },
    { boxNumber: 6, gameName: 'Cross Word', price: 3, packNumber: '935561', packSize: 100, currentTicket: 4, startTicket: 0, daysActive: 3 },
    { boxNumber: 7, gameName: '2026 Happy New', price: 3, packNumber: '558848', packSize: 100, currentTicket: 4, startTicket: 0, daysActive: 12 },
    { boxNumber: 14, gameName: '50X Money', price: 10, packNumber: '493848', packSize: 30, currentTicket: 11, startTicket: 0, daysActive: 3 },
    { boxNumber: 15, gameName: '500X The Money', price: 50, packNumber: '159981', packSize: 20, currentTicket: 2, startTicket: 0, daysActive: 3 },
    { boxNumber: 17, gameName: 'Gold $500,000', price: 5, packNumber: '176917', packSize: 60, currentTicket: 12, startTicket: 0, daysActive: 2 },
    { boxNumber: 18, gameName: '25X Tra', price: 5, packNumber: '196515', packSize: 60, currentTicket: 8, startTicket: 0, daysActive: 2 },
    { boxNumber: 21, gameName: 'Lucky 7s', price: 5, packNumber: '903287', packSize: 60, currentTicket: 7, startTicket: 0, daysActive: 7 },
    { boxNumber: 22, gameName: 'Epic Riches', price: 10, packNumber: '500022', packSize: 30, currentTicket: 3, startTicket: 0, daysActive: 1 },
    { boxNumber: 25, gameName: 'Jumbo Bucks Ext', price: 50, packNumber: '593958', packSize: 18, currentTicket: 1, startTicket: 0, daysActive: 2 },
    { boxNumber: 27, gameName: 'Cash 500,000', price: 50, packNumber: '277184', packSize: 20, currentTicket: 4, startTicket: 0, daysActive: 21 },
    { boxNumber: 56, gameName: 'Hit 1000', price: 20, packNumber: '568218', packSize: 15, currentTicket: 11, startTicket: 0, daysActive: 4 },
    { boxNumber: 57, gameName: 'Frogger', price: 5, packNumber: '572198', packSize: 60, currentTicket: 8, startTicket: 0, daysActive: 2 },
    { boxNumber: 60, gameName: 'Jumbo Bucks', price: 2, packNumber: '600871', packSize: 150, currentTicket: 8, startTicket: 0, daysActive: 12 },
    { boxNumber: 61, gameName: '10X Money', price: 2, packNumber: '610455', packSize: 150, currentTicket: 10, startTicket: 0, daysActive: 2 },
    { boxNumber: 62, gameName: 'Spicy Hot Cash', price: 2, packNumber: '620913', packSize: 150, currentTicket: 9, startTicket: 0, daysActive: 7 },
    { boxNumber: 63, gameName: 'Jackpots', price: 2, packNumber: '631482', packSize: 150, currentTicket: 54, startTicket: 40, daysActive: 21 }
  ];

  refBoxes.forEach(rb => {
    const s = slots.find(x => x.boxNumber === rb.boxNumber);
    if (s) {
      s.status = 'ACTIVE';
      s.gameName = rb.gameName;
      s.price = rb.price;
      s.packNumber = rb.packNumber;
      s.packSize = rb.packSize;
      s.currentTicket = rb.currentTicket;
      s.startTicket = rb.startTicket;
      s.ticketsInBox = Math.max(0, rb.packSize - rb.currentTicket);
      s.daysActive = rb.daysActive;
    }
  });

  return {
    storeName: 'AMIGO FOOD MART',
    storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
    shiftNumber: 1,
    cashierName: 'master',
    shiftStatus: 'IN_PROGRESS', // 'IN_PROGRESS' | 'SCANNING_END_SHIFT' | 'SHIFT_ENDED'
    shiftStartedAt: new Date().toISOString(),
    totalSlots: TOTAL_SLOTS,
    slots,
    visibleBoxNumbers: [3, 7, 21, 27, 60, 62, 63, 1, 2, 4, 6, 14, 15, 17, 18, 22, 25, 56, 57, 61],
    boxAccessTimes: {},
    inventory: [
      { packNumber: '600994', gameName: 'Jumbo Bucks', price: 2, packSize: 150, bookValue: 300, status: 'STORED', scannedAt: new Date().toISOString() },
      { packNumber: '903342', gameName: 'Lucky 7s', price: 5, packSize: 60, bookValue: 300, status: 'STORED', scannedAt: new Date().toISOString() }
    ],
    inventoryBarcodes: {},
    customGames: [],
    onlineSales: 0,
    cashes: 0,
    onlineCashes: 0,
    discontinuedCount: 0,
    shiftOpeningActiveCount: 20,
    soldOutThisShift: [
      { boxNumber: 16, packNumber: '130508', gameName: 'Treasure Hunt', price: 3, packSize: 100 }
    ],
    partialTakeOuts: [],
    shiftHistory: [],
    lastScannedBarcode: '',
    lastScannedSlot: 6,
    soldBarcodes: [],
    dataCleared: false,
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
      if (!parsed.partialTakeOuts) parsed.partialTakeOuts = [];
      if (!parsed.inventoryBarcodes) parsed.inventoryBarcodes = {};
      if (parsed.onlineSales === undefined) parsed.onlineSales = 0;
      if (parsed.cashes === undefined) parsed.cashes = 0;
      if (parsed.onlineCashes === undefined) parsed.onlineCashes = 0;
      if (parsed.discontinuedCount === undefined) parsed.discontinuedCount = 0;
      if (typeof parsed.shiftOpeningActiveCount !== 'number') {
        parsed.shiftOpeningActiveCount = (parsed.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber).length;
      }

      // Auto-sanitize any active slots or storage packs that were saved with 7 digits (trailing check digit from old parser bug)
      if (parsed.slots && Array.isArray(parsed.slots)) {
        parsed.slots.forEach(s => {
          if (s.packNumber && /^\d{7}$/.test(String(s.packNumber).trim())) {
            s.packNumber = String(s.packNumber).trim().slice(0, 6);
          }
        });
      }
      if (parsed.partialTakeOuts && Array.isArray(parsed.partialTakeOuts)) {
        parsed.partialTakeOuts.forEach(pto => {
          if (pto.packNumber && /^\d{7}$/.test(String(pto.packNumber).trim())) {
            pto.packNumber = String(pto.packNumber).trim().slice(0, 6);
          }
        });
      }
      if (parsed.soldOutThisShift && Array.isArray(parsed.soldOutThisShift)) {
        parsed.soldOutThisShift.forEach(so => {
          if (so.packNumber && /^\d{7}$/.test(String(so.packNumber).trim())) {
            so.packNumber = String(so.packNumber).trim().slice(0, 6);
          }
        });
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
    // Asynchronously synchronize state backup to MySQL
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

  const storeName = existingState?.storeName || 'AMIGO FOOD MART';
  const storeAddress = existingState?.storeAddress || '2300 MOODY RD WARNER ROBINS, GA, 31088';
  const retailerNumber = existingState?.retailerNumber || '[YOUR RETAILER #]';
  const registerName = existingState?.registerName || 'Register 1';
  const cashierName = existingState?.cashierName || 'master';
  const settings = existingState?.settings ? { ...existingState.settings } : {
    soundEnabled: true,
    voiceEnabled: true,
    autoPrint: true,
    autoEmail: false,
    targetEmails: 'manager@amigofoodmart.com',
    operationMode: 'DAILY',
    warning1Days: 7,
    warning2Days: 12,
    warningOldDays: 21,
    zeroIndexed: true
  };

  return {
    storeName,
    storeAddress,
    retailerNumber,
    registerName,
    shiftNumber: 1,
    cashierName,
    shiftStatus: 'IN_PROGRESS',
    shiftStartedAt: new Date().toISOString(),
    totalSlots: TOTAL_SLOTS,
    slots,
    visibleBoxNumbers: [],
    boxAccessTimes: {},
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
    dataCleared: true,
    settings
  };
}

export function resetToDefaults() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('lotto_track_pos_data_v1');
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
  const seeded = getInitialState();
  saveState(seeded);
  return seeded;
}

export function resetToCleanState(existingState = null) {
  const empty = getCleanEmptyState(existingState);
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('lotto_track_pos_data_v1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  } catch (e) {
    console.error('Failed to clear storage:', e);
  }
  syncPOSStateToDB(empty);
  return empty;
}


