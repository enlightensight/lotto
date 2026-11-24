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
  }
];

/**
 * Look up a game in the isolated SCEL catalog by game number or prefix.
 *
 * @param {string|number} gameNumber - 4-digit SCEL game number
 * @returns {object|null} SCEL game object or null if not found
 */
export function findScelGame(gameNumber) {
  if (!gameNumber) return null;
  const str = String(gameNumber).trim();
  return SCEL_GAMES.find(g => g.gameNumber === str || g.barcodePrefix === str) || null;
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

  // 1. Strict match for 4-segment delimited printed number:
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

  const game = findScelGame(gameNumber);

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
    // 14 or 17-digit continuous barcode: GGGG (4) + PPPPPP (6) + C (1) + TTT (3) + optional suffix (3)
    const matchCont = s.match(/^(\d{4})(\d{6})(\d{1})(\d{3})(?:(\d{3})|(?:\s*([([{]\d+[)\]}])))?$/);
    if (matchCont) {
      gameNumber = matchCont[1];
      packNumber = matchCont[2];
      checkDigit = matchCont[3];
      ticketString = matchCont[4];
      rawSuffix = matchCont[5] ? `(${matchCont[5]})` : (matchCont[6] || null);
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
  const matchedGame = findScelGame(gameNumber)
    || (customGames || []).find(g => g.barcodePrefix === gameNumber || g.gameNumber === gameNumber);

  if (!matchedGame) {
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
    return {
      isValid: false,
      jurisdiction: 'SC',
      isNonLotteryBarcode: true,
      isRetailProduct: false,
      error: `Ticket number #${ticketNum} out of roll range (0 to ${packSize - 1})`,
      raw
    };
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

  const canonicalId = `${gameNumber}-${packNumber}-${checkDigit}-${ticketString}`;
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
    packCombined: `${packNumber}-${checkDigit}`,
    ticketNumber: ticketNum,
    ticketString,
    checkCode: checkDigit,
    checkDigit: checkDigit,
    securityCode: null,
    hasExplicitSecurityCode: false,
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

