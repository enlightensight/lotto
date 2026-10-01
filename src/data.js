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
  // Matches printed ticket text: "1648-018378-8-029(000)", "1672-007252-3-000(099)", "1648-018378-8-000", "1648-018378-0-001"
  const fourPartMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]+(\d{1,2})[-_\s]+(\d{1,4})(?:[-_\s]*\(?(\d{1,4})\)?)?$/);
  if (fourPartMatch) {
    const gameNumber = fourPartMatch[1];
    const packNumber = fourPartMatch[2];
    const checkCode = fourPartMatch[3];
    const ticketNumber = parseInt(fourPartMatch[4], 10);
    const ticketString = String(fourPartMatch[4]).padStart(3, '0');
    const securityCode = fourPartMatch[5] || null;

    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber: isNaN(ticketNumber) ? 0 : ticketNumber,
      ticketString,
      checkCode,
      securityCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${checkCode}-${ticketString}${securityCode ? '(' + securityCode + ')' : ''}`,
      raw
    };
  }

  // Pattern 1: 3-segment format: Game - Pack - Ticket (Check/Security)
  // e.g. "1898-0019425-084(015)", "1234-567890-001(023)", "1648-018378-000"
  const delimitedMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]+(\d{1,3})(?:[-_\s]*\(?(\d{1,4})\)?)?$/);
  if (delimitedMatch) {
    const gameNumber = delimitedMatch[1];
    let packNumber = delimitedMatch[2];
    const seg3Num = parseInt(delimitedMatch[3], 10);
    const seg3Str = String(delimitedMatch[3]).padStart(3, '0');
    const parenStr = delimitedMatch[4] || null;
    const parenNum = delimitedMatch[4] ? parseInt(delimitedMatch[4], 10) : null;

    let ticketNumber = isNaN(seg3Num) ? 0 : seg3Num;
    let ticketString = seg3Str;
    let checkCode = null;

    if (delimitedMatch[3].length === 1 && parenNum !== null) {
      checkCode = delimitedMatch[3];
      ticketNumber = parenNum;
      ticketString = parenStr.padStart(3, '0');
    }

    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: parenStr ? `${gameNumber}-${packNumber}-${ticketString}(${parenStr})` : `${gameNumber}-${packNumber}-${ticketString}`,
      raw
    };
  }

  // Pattern 1b: Game - Pack - (Ticket) where ticket number is in parentheses
  const parenthesizedTixMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})[-_\s]*\((\d{1,4})\)$/);
  if (parenthesizedTixMatch) {
    const gameNumber = parenthesizedTixMatch[1];
    const packNumber = parenthesizedTixMatch[2];
    const ticketNumber = parseInt(parenthesizedTixMatch[3], 10);
    const ticketString = String(parenthesizedTixMatch[3]).padStart(3, '0');
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber: isNaN(ticketNumber) ? 0 : ticketNumber,
      ticketString,
      checkCode: null,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}`,
      raw
    };
  }

  // Pattern 2a: Delimited Game - Pack (e.g. "1648-018378", "1672-007252")
  // Valid if gameNumber matches registered lottery game or standard lottery game range (1000-2999)
  const gamePackMatch = s.match(/^(\d{3,5})[-_\s]+(\d{5,8})$/);
  if (gamePackMatch) {
    const gameNumber = gamePackMatch[1];
    const packNumber = gamePackMatch[2];
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 1000 && gNum <= 2999)) {
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode: null,
        canonicalId: `${gameNumber}-${packNumber}`,
        fullId: `${gameNumber}-${packNumber}`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
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

  // 17 digits: 4 game + 6 pack + 1 check + 3 ticket + 3 security (e.g. 16480183788029000)
  if (digits.length === 17) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 10); // 6-digit pack (018378)
    const checkCode = digits.slice(10, 11); // 1-digit check (8)
    const ticketNumber = parseInt(digits.slice(11, 14), 10); // 3-digit ticket (029)
    const ticketString = digits.slice(11, 14);
    const securityCode = digits.slice(14, 17); // 3-digit security (000)
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${checkCode}-${ticketString}(${securityCode})`,
      raw
    };
  }

  // 14 digits: 4 game + 6 pack + 3 ticket + 1 check (Standard Interleaved 2 of 5 / ITF-14 barcode on SCEL & US lottery tickets)
  // e.g. 16480183780290 -> Game 1648, Pack 018378, Ticket 029, Check 0
  // e.g. 16720072520007 -> Game 1672, Pack 007252, Ticket 000, Check 7
  if (digits.length === 14) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 10); // 6-digit pack (018378, 007252)

    const candTicket1 = parseInt(digits.slice(10, 13), 10);
    const candTicket2 = parseInt(digits.slice(11, 14), 10);

    let ticketNumber;
    let ticketString;
    let checkCode;

    // Scratch ticket rolls never have ticket numbers above 300 (standard packs are 000-029, 000-059, 000-099, 000-149, 000-199, 000-249).
    // Primary: candTicket1 (indices 10..13: [3 Ticket][1 Check]).
    // Fallback: If candTicket1 > 300 and candTicket2 <= 300, use candTicket2 ([1 Check][3 Ticket]).
    if (candTicket1 <= 300) {
      ticketNumber = candTicket1;
      ticketString = digits.slice(10, 13);
      checkCode = digits.slice(13, 14);
    } else if (candTicket2 <= 300) {
      ticketNumber = candTicket2;
      ticketString = digits.slice(11, 14);
      checkCode = digits.slice(10, 11);
    } else {
      return {
        isValid: false,
        isRetailProduct: true,
        gameNumber: null,
        packNumber: null,
        packClean: null,
        ticketNumber: null,
        raw
      };
    }

    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${ticketString}`,
      raw
    };
  }

  // 18 to 26 digits: Continuous barcode with trailing check / security digits (2D/PDF417 scratch barcode)
  if (digits.length >= 18 && digits.length <= 26) {
    const gameNumber = digits.slice(0, 4);
    const packNumber = digits.slice(4, 10); // 6-digit pack
    const checkCode = digits.slice(10, 11); // 1-digit check
    const ticketNumber = parseInt(digits.slice(11, 14), 10);
    const ticketString = digits.slice(11, 14);
    const securityCode = digits.slice(14, 17);
    return {
      isValid: true,
      gameNumber,
      packNumber,
      packClean: packNumber.replace(/^0+/, '') || packNumber,
      ticketNumber,
      ticketString,
      checkCode,
      securityCode,
      canonicalId: `${gameNumber}-${packNumber}-${ticketString}`,
      fullId: `${gameNumber}-${packNumber}-${checkCode}-${ticketString}(${securityCode})`,
      raw
    };
  }

  // 13 digits: Can be 4 game + 6 pack + 3 ticket (Lottery ticket with stripped check digit)
  // OR retail store merchandise (EAN-13)
  if (digits.length === 13) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 1000 && gNum <= 2999)) {
      const packNumber = digits.slice(4, 10);
      const ticketNumber = parseInt(digits.slice(10, 13), 10);
      const ticketString = digits.slice(10, 13);
      if (!isNaN(ticketNumber) && ticketNumber <= 300) {
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
    }
    return {
      isValid: false,
      isRetailProduct: true,
      raw
    };
  }

  // Detect standard retail store merchandise barcodes (UPC-A 12-digits, EAN-8 8-digits)
  // These are grocery, food, snack, beverage, or convenience store merchandise — NEVER lottery scratch tickets!
  if (digits.length === 12 || digits.length === 8) {
    return {
      isValid: false,
      isRetailProduct: true,
      gameNumber: null,
      packNumber: null,
      packClean: null,
      ticketNumber: null,
      ticketString: null,
      checkCode: null,
      canonicalId: null,
      fullId: null,
      raw
    };
  }

  // 11 digits: 4 game + 6 pack + 1 check (Pack Barcode / Book Manifest Barcode, e.g. 16480183788)
  if (digits.length === 11) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 1000 && gNum <= 2999)) {
      const packNumber = digits.slice(4, 10); // 6-digit pack
      const checkCode = digits.slice(10, 11);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode,
        canonicalId: `${gameNumber}-${packNumber}`,
        fullId: `${gameNumber}-${packNumber}-${checkCode}`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
      raw
    };
  }

  // 10 digits: 4 game + 6 pack (Pack Barcode, e.g. 1648018378)
  if (digits.length === 10) {
    const gameNumber = digits.slice(0, 4);
    const gNum = parseInt(gameNumber, 10);
    if (isKnownGamePrefix(gameNumber, customGames) || (gNum >= 1000 && gNum <= 2999)) {
      const packNumber = digits.slice(4, 10);
      return {
        isValid: true,
        isPackBarcode: true,
        gameNumber,
        packNumber,
        packClean: packNumber.replace(/^0+/, '') || packNumber,
        ticketNumber: null,
        ticketString: null,
        checkCode: null,
        canonicalId: `${gameNumber}-${packNumber}`,
        fullId: `${gameNumber}-${packNumber}`,
        raw
      };
    }
    return {
      isValid: false,
      isNonLotteryBarcode: true,
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
        return {
          isValid: true,
          gameNumber: g.barcodePrefix,
          packNumber: pack,
          packClean: pack.replace(/^0+/, '') || pack,
          ticketNumber: (tix !== null && !isNaN(tix)) ? tix : null,
          ticketString: tixStr,
          checkCode: check,
          canonicalId: tixStr ? `${g.barcodePrefix}-${pack}-${tixStr}` : `${g.barcodePrefix}-${pack}`,
          fullId: check && tixStr ? `${g.barcodePrefix}-${pack}-${check}-${tixStr}` : `${g.barcodePrefix}-${pack}`,
          raw
        };
      }
    }
  }

  return {
    isValid: false,
    gameNumber: digits.length >= 4 ? digits.slice(0, 4) : null,
    packNumber: digits.length >= 6 ? digits.slice(4, 10) : (digits || null),
    packClean: digits.replace(/^0+/, '') || digits,
    ticketNumber: null,
    checkCode: null,
    raw
  };
}

/**
 * Formats any raw lottery barcode into authentic SCEL / Georgia Lottery hyphenated format
 * e.g. "1648-018378-8-000(029)", "1648-018378-029", "1672-007252-000"
 */
export function formatLotteryBarcode(rawCode, customGames = []) {
  if (!rawCode) return '---';
  const str = String(rawCode).replace(/[\r\n\t]/g, '').replace(/^\][a-zA-Z0-9]{2,3}/, '').trim();
  const parsed = parseLotteryBarcode(str, customGames);
  if (parsed && parsed.isValid && (parsed.fullId || parsed.canonicalId)) {
    return parsed.fullId || parsed.canonicalId;
  }
  return str;
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
  } else if (/^\d{14}$/.test(s)) {
    // 14 digits continuous = 4 game prefix + 6 pack digits (indices 4..10) + 3 ticket + 1 check
    s = s.slice(4, 10);
  } else if (/^\d{13}$/.test(s)) {
    // 13 digits continuous = 4 game prefix + 6 pack digits (indices 4..10) + 3 ticket
    s = s.slice(4, 10);
  } else if (/^\d{11}$/.test(s)) {
    // 11 digits continuous = 4 game prefix + 6 pack digits (indices 4..10) + 1 check
    s = s.slice(4, 10);
  } else if (/^\d{10}$/.test(s)) {
    // 10 digits continuous = 4 game prefix + 6 pack digits (indices 4..10)
    s = s.slice(4, 10);
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
    partialTakeOuts: [], // Packs taken out of dispensers to inventory (not for sale)
    shiftHistory: [], // Clean audit history
    lastScannedBarcode: '',
    lastScannedSlot: null,
    soldBarcodes: [],
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

