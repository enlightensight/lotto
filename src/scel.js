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

  // Strict match for 4-segment delimited printed number:
  // GGGG (4 digits) - PPPPPP (6 digits) - C (1 digit) - TTT (3 digits)
  // Followed by optional raw suffix in parentheses/brackets, e.g. "(080)"
  const match = trimmed.match(/^(\d{4})[-_\s]+(\d{6})[-_\s]+(\d{1})[-_\s]+(\d{3})(?:\s*([([{]\d+[)\]}]))?$/);

  if (!match) {
    return {
      isValid: false,
      jurisdiction: 'SCEL',
      error: 'Invalid SCEL printed ticket format (expected GGGG-PPPPPP-C-TTT)',
      raw: input
    };
  }

  const gameNumber = match[1];
  const packNumber = match[2]; // Preserves leading zeros exactly as 6 characters
  const checkDigit = match[3];
  const ticketNumber = match[4];
  const rawSuffix = match[5] || null;

  const game = findScelGame(gameNumber);

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
      ? `${gameNumber}-${packNumber}-${checkDigit}-${ticketNumber} ${rawSuffix}`
      : `${gameNumber}-${packNumber}-${checkDigit}-${ticketNumber}`,
    game,
    raw: input
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

