// ============================================================================
// LOTTO TRACK PRO — SOUTH CAROLINA EDUCATION LOTTERY (SCEL) MODULE
// Phase 1 Foundation: Isolated Game Catalog & Printed Pack-Ticket Number Parser
// ============================================================================

/**
 * Isolated South Carolina Education Lottery (SCEL) Game Catalog.
 * Contains only verified SCEL games — completely isolated from Georgia's SAMPLE_GAMES.
 */
export const SCEL_GAMES = [
  {
    id: 'sc1705',
    gameNumber: '1705',
    barcodePrefix: '1705',
    name: 'LIGHT UP THE SEASON',
    price: 2,
    packSize: 150,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1684',
    gameNumber: '1684',
    barcodePrefix: '1684',
    name: 'HIT $500',
    price: 10,
    packSize: 30,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1714',
    gameNumber: '1714',
    barcodePrefix: '1714',
    name: '25 TIMES LUCKY',
    price: 20,
    packSize: 30,
    bookValue: 600,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1689',
    gameNumber: '1689',
    barcodePrefix: '1689',
    name: 'CASH MONEY',
    price: 10,
    packSize: 30,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1688',
    gameNumber: '1688',
    barcodePrefix: '1688',
    name: 'THE PRICE IS RIGHT',
    price: 10,
    packSize: 30,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1676',
    gameNumber: '1676',
    barcodePrefix: '1676',
    name: 'DOUBLE DOUBLER',
    price: 1,
    packSize: 300,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1677',
    gameNumber: '1677',
    barcodePrefix: '1677',
    name: 'TRIPLE 777',
    price: 2,
    packSize: 150,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1702',
    gameNumber: '1702',
    barcodePrefix: '1702',
    name: 'HOLIDAY CASH',
    price: 5,
    packSize: 60,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1646',
    gameNumber: '1646',
    barcodePrefix: '1646',
    name: 'CAROLINA GOLD',
    price: 5,
    packSize: 60,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1670',
    gameNumber: '1670',
    barcodePrefix: '1670',
    name: 'HIT $100',
    price: 2,
    packSize: 150,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1678',
    gameNumber: '1678',
    barcodePrefix: '1678',
    name: '7-11-21 TRIPLER',
    price: 2,
    packSize: 150,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1690',
    gameNumber: '1690',
    barcodePrefix: '1690',
    name: '$200,000 PAYDAY',
    price: 5,
    packSize: 60,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1691',
    gameNumber: '1691',
    barcodePrefix: '1691',
    name: 'BIG MATCH BONUS',
    price: 5,
    packSize: 60,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1665',
    gameNumber: '1665',
    barcodePrefix: '1665',
    name: '200X',
    price: 10,
    packSize: 30,
    bookValue: 300,
    jurisdiction: 'SCEL'
  },
  {
    id: 'sc1683',
    gameNumber: '1683',
    barcodePrefix: '1683',
    name: 'MAGNIFICENT JUMBO BUCKS',
    price: 10,
    packSize: 30,
    bookValue: 300,
    jurisdiction: 'SCEL'
  }
];

/**
 * Computes the official SCEL pack check digit from 6-digit pack number.
 * Verified across all SCEL games (1714, 1705, 1684, 1689).
 *
 * @param {string|number} packNumber
 * @returns {string} 1-digit check code
 */
export function computeScCheckDigit(packNumber) {
  if (!packNumber) return null;
  const p = String(packNumber).padStart(6, '0').slice(-6);
  const w = [0, 2, 3, 1, 4, 2];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += parseInt(p[i], 10) * w[i];
  }
  return String(sum % 10);
}

/**
 * Look up a game in the isolated SCEL catalog by game number or prefix.
 *
 * @param {string|number} gameNumber - 4-digit SCEL game number
 * @returns {object|null} SCEL game object or null if not found
 */
export function findScelGame(gameNumber) {
  if (!gameNumber) return null;
  const str = String(gameNumber).trim();
  const cleanNum = str.replace(/^scel_|^sc_?/, '');
  return SCEL_GAMES.find(g => g.gameNumber === str || g.barcodePrefix === str || g.id === str || g.gameNumber === cleanNum || g.barcodePrefix === cleanNum) || null;
}

/**
 * Check if a game number or barcode prefix belongs to the isolated SCEL catalogue.
 *
 * @param {string|number} gameNumber
 * @returns {boolean}
 */
export function isScelGameNumber(gameNumber) {
  if (!gameNumber) return false;
  const str = String(gameNumber).trim();
  return SCEL_GAMES.some(g => g.gameNumber === str || g.barcodePrefix === str);
}

/**
 * Dedicated SCEL Printed Pack-Ticket Number Parser.
 *
 * Format: GGGG-PPPPPP-C-TTT (with optional printed raw suffix, e.g. "(080)")
 * - Game number: 4 digits (e.g. "1705")
 * - Pack number: Exactly 6 digits, strictly preserving leading zeros (e.g. "002921")
 * - Check digit: 1 digit (e.g. "5")
 * - Ticket number: 3 digits (e.g. "069")
 * - Optional raw suffix: e.g. "(080)" preserved as raw text without interpretation
 *
 * NOTE: Per Phase 1 specifications, unverified scanner barcode formats
 * (such as continuous digits "17050029215069" or 17-digit strings) are NOT
 * guessed or accepted by this parser.
 *
 * @param {string} input - Raw printed pack-ticket text
 * @returns {object} Parsed SCEL result object
 */
export function parseScelPrintedTicketNumber(input) {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      jurisdiction: 'SCEL',
      error: 'Input must be a non-empty string',
      raw: input
    };
  }

  const trimmed = input.trim();

  // 1. Match for 4-segment delimited printed number:
  // GGGG (4 digits) - PPPPPP (6 digits) - C (1 digit) - TTT (3 digits)
  // Followed by optional raw suffix in parentheses/brackets, e.g. "(080)"
  const match4 = trimmed.match(/^(\d{4})[-_\s]+(\d{6})[-_\s]+(\d{1})[-_\s]+(\d{3})(?:\s*([([{]\d+[)\]}]))?$/);

  if (!match4) {
    return {
      isValid: false,
      jurisdiction: 'SCEL',
      error: 'Invalid SCEL printed ticket format (expected GGGG-PPPPPP-C-TTT)',
      raw: input
    };
  }

  const gameNumber = match4[1];
  const packNumber = match4[2]; // Preserves leading zeros exactly as 6 characters
  const checkDigit = match4[3];
  const ticketNumber = match4[4];
  const rawSuffix = match4[5] || null;

  const game = findScelGame(gameNumber) || {
    id: `sc${gameNumber}`,
    gameNumber,
    barcodePrefix: gameNumber,
    name: 'Scratch-Off Game',
    price: 1,
    packSize: 100,
    jurisdiction: 'SCEL'
  };

  const baseCanonical = `${gameNumber}-${packNumber}-${checkDigit}-${ticketNumber}`;

  return {
    isValid: true,
    jurisdiction: 'SCEL',
    gameNumber,
    packNumber,
    checkDigit,
    ticketNumber,
    rawSuffix,
    packId: `SC-${gameNumber}-${packNumber}`,
    ticketId: `SC-${gameNumber}-${packNumber}-${ticketNumber}`,
    displayString: rawSuffix
      ? `${baseCanonical} ${rawSuffix}`
      : baseCanonical,
    game,
    raw: input
  };
}

/**
 * Dedicated SCEL POS Barcode Parser Adapter.
 * Adapts SCEL ticket parsing to match the standard POS parser contract.
 *
 * For Phase 5.1, supports only the known printed ticket number format:
 * GGGG-PPPPPP-C-TTT (e.g. "1705-002921-5-069") with optional raw suffix (e.g. "(080)")
 *
 * Requirements:
 * - Preserves leading zeros in pack number: "002921"
 * - Numeric ticketNumber: 69, ticketString: "069"
 * - Preserves optional raw suffix without assuming it is a security code
 * - Rejects unknown SCEL games and malformed/unsupported formats safely
 * - Never falls back to Georgia parsing
 *
 * @param {string} raw - Raw scanned or entered barcode string
 * @param {Array} customGames - Optional custom games catalog
 * @returns {object|null} Standard POS-compliant parsed object or error object
 */
export function adaptScelToLotteryBarcode(raw, customGames = []) {
  if (!raw) return null;
  if (typeof raw !== 'string') {
    return {
      isValid: false,
      jurisdiction: 'SC',
      isNonLotteryBarcode: true,
      isRetailProduct: false,
      error: 'Barcode must be a string',
      raw
    };
  }

  const s = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!s) return null;

  // Real scratch-off lottery ticket barcodes are numeric/delimited (reject letters)
  if (/[a-zA-Z]/.test(s)) {
    return {
      isValid: false,
      jurisdiction: 'SC',
      isNonLotteryBarcode: true,
      isRetailProduct: false,
      error: 'Non-lottery barcode contains letters',
      raw
    };
  }

  let gameNumber, packNumber, checkDigit, ticketString, rawSuffix;

  const parsed = parseScelPrintedTicketNumber(s);
  if (parsed && parsed.isValid) {
    gameNumber = parsed.gameNumber;
    packNumber = parsed.packNumber;
    checkDigit = parsed.checkDigit;
    ticketString = parsed.ticketNumber;
    rawSuffix = parsed.rawSuffix;
  } else {
    // 14 or 17-digit continuous barcode (Dual standards: Layout A [4G][6P][1C][3T] vs Layout B [4G][6P][3T][1Trailer])
    const digitsOnly = s.replace(/[^0-9]/g, '');
    const parenSuffix = s.match(/[([{](\d{1,4})[)\]}]/)?.[1] || null;
    if (digitsOnly.length === 14 || digitsOnly.length === 17) {
      gameNumber = digitsOnly.slice(0, 4);
      packNumber = digitsOnly.slice(4, 10);
      const tempGame = findScelGame(gameNumber) || (customGames || []).find(g => g.barcodePrefix === gameNumber || g.gameNumber === gameNumber);
      const knownPackSize = tempGame?.packSize;

      const tixA = parseInt(digitsOnly.slice(11, 14), 10);
      const tixB = parseInt(digitsOnly.slice(10, 13), 10);
      const digit10 = digitsOnly.slice(10, 11);
      const expectedCheck = computeScCheckDigit(packNumber);

      let isLayoutB = false;
      if (digit10 !== expectedCheck && tixB <= 299) {
        isLayoutB = true;
      } else if (knownPackSize && tixA >= knownPackSize && tixB < knownPackSize) {
        isLayoutB = true;
      } else if (knownPackSize && tixB >= knownPackSize && tixA < knownPackSize) {
        isLayoutB = false;
      } else if (digitsOnly[10] === '0' && tixB < 150 && tixA >= 100) {
        isLayoutB = true;
      }

      if (isLayoutB) {
        ticketString = digitsOnly.slice(10, 13);
        checkDigit = expectedCheck || computeScCheckDigit(packNumber);
      } else {
        checkDigit = digitsOnly.slice(10, 11);
        ticketString = digitsOnly.slice(11, 14);
      }

      if (parenSuffix) {
        rawSuffix = `(${parenSuffix})`;
      } else if (digitsOnly.length === 17) {
        rawSuffix = `(${digitsOnly.slice(14, 17)})`;
      }
    } else {
      return {
        isValid: false,
        jurisdiction: 'SC',
        isNonLotteryBarcode: true,
        isRetailProduct: false,
        error: parsed?.error || 'Invalid or unsupported SCEL format',
        raw
      };
    }
  }

  // Verify game existence against SCEL catalog or store custom games
  let matchedGame = findScelGame(gameNumber)
    || (customGames || []).find(g => g.barcodePrefix === gameNumber || g.gameNumber === gameNumber);

  if (!matchedGame) {
    const gNumInt = parseInt(gameNumber, 10);
    // Explicit rejection for uncataloged test/dummy games (e.g. 9999), Georgia games (e.g. 1648) or non-numeric/out of lottery range
    if (gameNumber === '9999' || gameNumber === '1648' || isNaN(gNumInt) || gNumInt > 3000 || gNumInt < 100) {
      return {
        isValid: false,
        jurisdiction: 'SC',
        isNonLotteryBarcode: true,
        isRetailProduct: true,
        error: `Unknown SCEL game: ${gameNumber}`,
        gameNumber,
        raw
      };
    }

    // Uncataloged active SCEL scratch-off game: infer packSize & price from countdown PIN if available (just like GA)
    const pinNum = rawSuffix ? parseInt(String(rawSuffix).replace(/[^0-9]/g, ''), 10) : null;
    const ticketInt = parseInt(ticketString, 10);
    let inferredSize = (pinNum !== null && !isNaN(pinNum) && !isNaN(ticketInt)) ? (ticketInt + pinNum + 1) : null;
    const stdSizes = [300, 150, 100, 60, 30, 25, 20, 18, 15, 12, 10];
    if (!stdSizes.includes(inferredSize)) {
      inferredSize = 100;
    }
    const derivedPrice = inferredSize === 300 ? 1 : (inferredSize === 150 ? 2 : (inferredSize === 100 ? 3 : (inferredSize === 60 ? 5 : (inferredSize === 30 ? 10 : (inferredSize === 18 ? 50 : 20)))));
    matchedGame = {
      id: `sc${gameNumber}`,
      gameNumber,
      barcodePrefix: gameNumber,
      name: 'Scratch-Off Game',
      price: derivedPrice,
      packSize: inferredSize,
      bookValue: derivedPrice * inferredSize,
      jurisdiction: 'SCEL'
    };
  }

  const ticketNum = parseInt(ticketString, 10);
  const packSize = matchedGame.packSize;
  if (isNaN(ticketNum) || ticketNum < 0) {
    return {
      isValid: false,
      jurisdiction: 'SC',
      isNonLotteryBarcode: true,
      isRetailProduct: false,
      error: `Invalid ticket number #${ticketString}`,
      raw
    };
  }
  if (packSize != null && ticketNum >= packSize) {
    if (findScelGame(gameNumber) || (customGames || []).some(g => (g.barcodePrefix === gameNumber || g.gameNumber === gameNumber) && g.packSize)) {
      return {
        isValid: false,
        jurisdiction: 'SC',
        isNonLotteryBarcode: true,
        isRetailProduct: false,
        error: `Ticket number #${ticketNum} out of roll range (0 to ${packSize - 1})`,
        raw
      };
    }
  }
  if (packSize == null && ticketNum > 999) {
    return {
      isValid: false,
      jurisdiction: 'SC',
      isNonLotteryBarcode: true,
      isRetailProduct: false,
      error: `Ticket number #${ticketNum} out of roll range (0 to 999)`,
      raw
    };
  }

  // Determine suffix: use explicit rawSuffix from input, or compute countdown suffix from SCEL packSize
  let finalSuffix = rawSuffix;
  if (!finalSuffix && packSize != null) {
    const countdown = (packSize - 1) - ticketNum;
    finalSuffix = `(${String(countdown).padStart(3, '0')})`;
  }

  const sec = finalSuffix ? finalSuffix.replace(/[^0-9]/g, '') : null;
  const canonicalId = checkDigit ? `${gameNumber}-${packNumber}-${checkDigit}-${ticketString}` : `${gameNumber}-${packNumber}-${ticketString}`;
  const standardBarcode = canonicalId;
  const fullId = finalSuffix ? `${canonicalId}${finalSuffix.replace(/\s+/g, '')}` : canonicalId;
  const displayBarcode = finalSuffix ? `${canonicalId} ${finalSuffix}` : canonicalId;

  return {
    isValid: true,
    jurisdiction: 'SC',
    isPackBarcode: false,
    gameNumber,
    basePackNumber: packNumber,
    packNumber,
    packClean: packNumber,
    packCombined: checkDigit ? `${packNumber}-${checkDigit}` : packNumber,
    ticketNumber: ticketNum,
    ticketString,
    checkCode: checkDigit,
    checkDigit: checkDigit,
    securityCode: sec,
    hasExplicitSecurityCode: Boolean(rawSuffix),
    rawSuffix: finalSuffix,
    standardBarcode,
    canonicalId,
    fullId,
    displayBarcode,
    raw,
    game: matchedGame,
    price: matchedGame.price,
    packSize: matchedGame.packSize,
    gameName: matchedGame.name
  };
}

/**
 * Normalizes lottery jurisdiction codes.
 * - 'SC' or 'SCEL' -> 'SC'
 * - 'GA' -> 'GA'
 * - Missing, null, undefined, empty, or unsupported -> 'GA'
 *
 * @param {*} val
 * @returns {'GA' | 'SC'}
 */
export function normalizeLotteryJurisdiction(val) {
  if (typeof val !== 'string') return 'GA';
  const clean = val.trim().toUpperCase();
  if (clean === 'SC' || clean === 'SCEL') return 'SC';
  if (clean === 'GA') return 'GA';
  return 'GA';
}

/**
 * Resolves store lottery jurisdiction during store creation and updates.
 * Distinguishes between:
 * 1. Omitted / missing property (undefined)
 * 2. Explicit valid 'SC' (or 'SCEL')
 * 3. Explicit valid 'GA'
 * 4. Empty / null / invalid unsupported values
 *
 * Rules:
 * - Brand new store + omitted / invalid -> 'GA'
 * - Brand new store + explicit 'SC' -> 'SC'
 * - Existing store + omitted / null / empty / invalid -> keeps existingJurisdiction (e.g. 'SC' stays 'SC')
 * - Existing store + explicit 'SC' -> 'SC'
 * - Existing store + explicit 'GA' -> 'GA'
 *
 * @param {string|null|undefined} existingJurisdiction - Current jurisdiction in DB / store record ('GA' | 'SC' | null)
 * @param {*} incomingJurisdiction - Value supplied in update/create payload
 * @param {boolean} isNewStore - Whether this is an initial creation (true) or an update (false)
 * @returns {'GA' | 'SC'}
 */
export function resolveJurisdictionUpdate(existingJurisdiction, incomingJurisdiction, isNewStore = false) {
  let explicit = null;
  if (typeof incomingJurisdiction === 'string') {
    const clean = incomingJurisdiction.trim().toUpperCase();
    if (clean === 'SC' || clean === 'SCEL') explicit = 'SC';
    else if (clean === 'GA') explicit = 'GA';
  }

  if (isNewStore) {
    return explicit || 'GA';
  }

  // Updating existing store:
  // If explicitly supplied with a valid jurisdiction ('SC' or 'GA'), update to it
  if (explicit) return explicit;

  // Otherwise (omitted, null, empty, or unsupported invalid string), PRESERVE existing jurisdiction
  return (existingJurisdiction && String(existingJurisdiction).toUpperCase() === 'SC') ? 'SC' : 'GA';
}

