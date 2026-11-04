// Official Georgia Lottery Retailer Day Report Data Model
// Exact Match to LT System Software Georgia Lottery Specification

export const AMIGO_DAY_REPORT_REFERENCE = {
  isLive: false,
  storeName: 'AMIGO FOOD MART',
  storeAddress: '2300 MOODY RD WARNER ROBINS, GA, 31088',
  userId: 'master',
  reportDate: '08/04/2026',
  reportTime: '10:10 AM',
  totalScratcherSales: 1078.00,
  cashes: 316.00,
  onlineSales: 167.00,
  onlineCashes: 330.00,
  totalSales: 1245.00,
  totalCashes: 646.00,
  inventoryStats: {
    openingCount: 66,
    endingCount: 63,
    activations: 1,
    sold: 3,
    discontinued: 0,
    removed: '-',
    backInventory: 89,
    totalInventory: 152,
    activeValue: 12898.00
  },
  activations: [
    { box: 6, time: '11:27 PM', packNumber: '1322-0796097', price: 2, name: 'LOTERIA.......' }
  ],
  soldOut: [
    { box: 6, packNumber: '1322-0795142', price: 2, name: 'LOTERIA.......' },
    { box: 38, packNumber: '1422-4358988', price: 10, name: '50X MONEY.....' },
    { box: 43, packNumber: '1893-0059721', price: 10, name: 'HIT 500.......' }
  ],
  // 70 Boxes total matching the official Day Report PDF
  boxes: [
    { box: 1, pack: '1417-0618145', name: '5X MONEY......', open: 215, close: 219, price: 1, total: 4 },
    { box: 2, pack: '1410-0759558', name: 'JR JUMBO......', open: 141, close: 145, price: 1, total: 4 },
    { box: 3, pack: '1891-0009799', name: 'HIT 100.......', open: 127, close: 137, price: 2, total: 20 },
    { box: 4, pack: '1853-0016571', name: 'SPICY HOT CASH', open: 52, close: 52, price: 2, total: 0 },
    { box: 5, pack: '1883-0015129', name: 'JACKPOTS......', open: 73, close: 73, price: 2, total: 0 },
    // Box 6: Has 2 packs (Pack A activated + Pack B sold out)
    {
      box: 6,
      isMultiPack: true,
      subRows: [
        { pack: '1322-0796097', name: 'LOTERIA.......', open: 0, close: 30, price: 2, total: 60, highlight: 'green' },
        { pack: '1322-0795142', name: 'LOTERIA.......', open: 135, close: 150, price: 2, total: 30, highlight: 'red' }
      ]
    },
    { box: 7, pack: '1418-0996564', name: '10X MONEY.....', open: 11, close: 17, price: 2, total: 12 },
    { box: 8, pack: '1411-1834806', name: 'JUMBO BUCKS...', open: 63, close: 76, price: 2, total: 26 },
    { box: 9, pack: '1877-0011999', name: 'LUCKY LOVE....', open: 112, close: 114, price: 2, total: 4 },
    { box: 10, pack: '1902-0011837', name: 'KICKN CASH....', open: 123, close: 127, price: 2, total: 8 },
    { box: 11, pack: '1856-0024330', name: 'JUMBO BOO BUCK', open: 61, close: 66, price: 2, total: 10 },
    { box: 12, pack: '1828-0038562', name: 'XTREME BUCKS..', open: 82, close: 83, price: 2, total: 2 },
    { box: 13, pack: '1904-0011707', name: '15 X TRA....', open: 45, close: 45, price: 2, total: 0 },
    { box: 14, pack: '1857-0024257', name: '10X BONUS.....', open: 107, close: 107, price: 2, total: 0 },
    { box: 15, pack: '1904-0025565', name: '15 X TRA....', open: 7, close: 8, price: 2, total: 2 },
    { box: 16, pack: '1898-0004627', name: 'CROSS WORD....', open: 60, close: 60, price: 3, total: 0 },
    { box: 17, pack: '1898-0019425', name: 'CROSS WORD....', open: 45, close: 46, price: 3, total: 3 },
    { box: 18, isEmpty: true },
    { box: 19, pack: '1874-0015175', name: '2026 HAPPY NEW', open: 49, close: 50, price: 3, total: 3 },
    { box: 20, isEmpty: true },
    { box: 21, isEmpty: true },
    { box: 22, pack: '1899-0023797', name: 'LUCKY 7S......', open: 38, close: 40, price: 5, total: 10 },
    { box: 23, pack: '1905-0021962', name: '25X TRA.......', open: 12, close: 19, price: 5, total: 35 },
    { box: 24, pack: '1892-0033027', name: 'HIT 250.......', open: 15, close: 16, price: 5, total: 5 },
    { box: 25, pack: '1870-0033700', name: 'GOLD $500000..', open: 40, close: 44, price: 5, total: 20 },
    { box: 26, pack: '1899-0041770', name: 'LUCKY 7S......', open: 25, close: 26, price: 5, total: 5 },
    { box: 27, pack: '1905-0039276', name: '25X TRA.......', open: 12, close: 12, price: 5, total: 0 },
    { box: 28, isEmpty: true },
    { box: 29, pack: '1848-0016857', name: 'JUCKY 7 DOUBLE', open: 20, close: 22, price: 5, total: 10 },
    { box: 30, pack: '1833-0037659', name: 'FROGGER.......', open: 0, close: 0, price: 5, total: 0 },
    { box: 31, isEmpty: true },
    { box: 32, pack: '1833-0018784', name: 'FROGGER.......', open: 36, close: 37, price: 5, total: 5 },
    { box: 33, pack: '1841-0032676', name: 'LUCKY ROLL....', open: 48, close: 49, price: 5, total: 5 },
    { box: 34, pack: '1421-1992159', name: '20X MONEY.....', open: 33, close: 40, price: 5, total: 35 },
    { box: 35, pack: '1826-0147929', name: 'VIP PLATINUM..', open: 17, close: 17, price: 10, total: 0 },
    { box: 36, pack: '1876-0058427', name: '1500000 MAX...', open: 10, close: 10, price: 10, total: 0 },
    { box: 37, pack: '1799-0462392', name: '$50 OR $100...', open: 2, close: 3, price: 10, total: 10 },
    { box: 38, pack: '1422-4358988', name: '50X MONEY.....', open: 28, close: 30, price: 10, total: 20 },
    { box: 39, pack: '1759-0552440', name: 'JUMBO JU BUCKS', open: 19, close: 21, price: 10, total: 20 },
    { box: 40, pack: '1855-0140860', name: 'TRIPLE MATCH..', open: 22, close: 22, price: 10, total: 0 },
    { box: 41, pack: '1897-0027822', name: 'BONUS STAR MIL', open: 28, close: 28, price: 10, total: 0 },
    { box: 42, pack: '1906-0055484', name: '50 X TRA......', open: 9, close: 9, price: 10, total: 0 },
    { box: 43, pack: '1893-0059721', name: 'HIT 500.......', open: 28, close: 30, price: 10, total: 20 },
    { box: 44, pack: '1900-0052268', name: 'MYSTERY BOX GI', open: 13, close: 13, price: 10, total: 0 },
    { box: 45, pack: '1871-0155971', name: 'PLATINUM......', open: 17, close: 23, price: 10, total: 60 },
    { box: 46, pack: '1906-0032389', name: '50 X TRA......', open: 2, close: 2, price: 10, total: 0 },
    { box: 47, pack: '1886-0035940', name: 'JACJPOTS $10..', open: 26, close: 26, price: 10, total: 0 },
    { box: 48, pack: '1876-0058428', name: '1500000 MAX...', open: 15, close: 15, price: 10, total: 0 },
    { box: 49, pack: '1838-0138571', name: '$2000 OVERLOAD', open: 25, close: 25, price: 10, total: 0 },
    { box: 50, pack: '1423-4203608', name: '100X MONEY....', open: 8, close: 9, price: 20, total: 20 },
    { box: 51, pack: '1894-0053773', name: 'HIT 1000......', open: 8, close: 9, price: 20, total: 20 },
    { box: 52, pack: '1839-0041121', name: '$3000 OVERLOAD', open: 4, close: 4, price: 20, total: 0 },
    { box: 53, pack: '1888-0181660', name: 'MILLIONAIRE JU', open: 11, close: 11, price: 20, total: 0 },
    // Page 2 Boxes
    { box: 54, pack: '1850-0040596', name: 'LUCKY 7 TRIPLE', open: 3, close: 4, price: 20, total: 20 },
    { box: 55, pack: '1715-0047272', name: '$2MILLION DOLL', open: 12, close: 12, price: 20, total: 0 },
    { box: 56, pack: '1831-0265711', name: 'XTREAM MONER 2', open: 12, close: 12, price: 20, total: 0 },
    { box: 57, pack: '1822-0045389', name: 'CASH $100$200.', open: 8, close: 8, price: 20, total: 0 },
    { box: 58, pack: '1901-0053391', name: 'DOUBLE LUCK...', open: 4, close: 5, price: 20, total: 20 },
    { box: 59, pack: '1907-0045935', name: '100 X TRA.....', open: 5, close: 5, price: 20, total: 0 },
    { box: 60, pack: '1780-0237355', name: '2000 CASH CRAZ', open: 4, close: 4, price: 20, total: 0 },
    { box: 61, pack: '1860-0361352', name: '200X MONEY....', open: 1, close: 1, price: 25, total: 0 },
    { box: 62, pack: '1881-0161461', name: 'GRANT 50......', open: 4, close: 4, price: 30, total: 0 },
    { box: 63, pack: '1843-0510699', name: 'MILLIONAIRE MA', open: 2, close: 2, price: 30, total: 0 },
    { box: 64, pack: '1890-0169038', name: 'CASH 500000 $.', open: 2, close: 2, price: 50, total: 0 },
    { box: 65, pack: '1890-0169040', name: 'CASH 500000 $.', open: 1, close: 10, price: 50, total: 450 },
    { box: 66, pack: '1812-0547856', name: '$3000 FESTIVE.', open: 9, close: 9, price: 30, total: 0 },
    { box: 67, pack: '1770-1056896', name: '500X THE MONEY', open: 2, close: 3, price: 50, total: 50 },
    { box: 68, pack: '1770-1056897', name: '500X THE MONEY', open: 1, close: 1, price: 50, total: 0 },
    { box: 69, pack: '1835-0464079', name: 'JUMBO BUCK EXT', open: 3, close: 4, price: 50, total: 50 },
    { box: 70, pack: '1835-0464078', name: 'JUMBO BUCK EXT', open: 2, close: 2, price: 50, total: 0 }
  ]
};

/**
 * Format game name with dots padding up to 14 chars, matching the Georgia Lottery layout
 */
export function formatReportGameName(name) {
  if (!name) return 'SCRATCH.......';
  let s = String(name).trim();
  // Strip any leading dollar price or duplicate dollar signs (e.g. "$1 $1 5X MONEY" -> "5X MONEY")
  s = s.replace(/^(\$\s*\d*\s*)+/i, '').trim();
  s = s.replace(/^\$+/i, '').trim();
  const raw = s.toUpperCase();
  if (raw.length >= 14) return raw.substring(0, 14);
  return raw.padEnd(14, '.');
}

/**
 * Parses flexible date inputs (e.g. 'Oct 17', 'Sat, Oct 17', '10/17/2026', '2026-10-17', 'Today')
 */
export function parseFlexibleDate(val, refYear = new Date().getFullYear()) {
  if (!val) return null;
  if (typeof val === 'string' && val.toLowerCase() === 'today') {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
  const s = String(val).trim();
  const cleaned = s.replace(/^[A-Za-z]+,\s*/, '').trim();
  const parts = cleaned.split(/[\s,]+/);
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  if (parts.length >= 2) {
    const mStr = parts[0].toLowerCase().slice(0, 3);
    if (mStr in months) {
      const day = parseInt(parts[1], 10);
      const year = parts[2] ? parseInt(parts[2], 10) : refYear;
      if (!isNaN(day)) return new Date(Date.UTC(year, months[mStr], day));
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    if (s.includes('T') && s.endsWith('Z')) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

/**
 * Checks whether two date representations match the same calendar business day.
 */
export function isSameBusinessDay(valA, valB) {
  if (!valA || !valB) return false;
  const dA = parseFlexibleDate(valA);
  const refYear = dA ? dA.getUTCFullYear() : new Date().getFullYear();
  const dB = parseFlexibleDate(valB, refYear);
  if (!dA || !dB) {
    return String(valA).toLowerCase().includes(String(valB).toLowerCase()) || String(valB).toLowerCase().includes(String(valA).toLowerCase());
  }
  return dA.getUTCFullYear() === dB.getUTCFullYear() &&
         dA.getUTCMonth() === dB.getUTCMonth() &&
         dA.getUTCDate() === dB.getUTCDate();
}

/**
 * Generates a 100% dynamic, mathematically reconciled Georgia Lottery Day Report
 * directly from the POS store state or historical shift history.
 */
export function generateLiveDayReport(state, options = {}) {
  const targetDate = options.targetDate || options.date || null;
  return getScreenDayReportData(state, { ...options, targetDate });
}
/**
 * Returns dynamic live store Georgia Lottery Day Report.
 * @param {Object} state Live application state
 */
export function getDayReportData(state) {
  return generateLiveDayReport(state);
}

export const REFERENCE_CLOSED_SHIFTS = [
  {
    id: 'shift_13',
    shift: '#13',
    shiftNumber: 13,
    date: 'Sat, Oct 18',
    day: 'Sat, Oct 18',
    salesperson: 'Rosa',
    employee: 'Rosa',
    started: '7:02 AM',
    closed: '3:00 PM',
    openClose: '7:02 AM — 3:00 PM',
    tickets: 214,
    sales: 1284.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_12',
    shift: '#12',
    shiftNumber: 12,
    date: 'Fri, Oct 17',
    day: 'Fri, Oct 17',
    salesperson: 'Daniel',
    employee: 'Daniel',
    started: '3:04 PM',
    closed: '10:05 PM',
    openClose: '3:04 PM — 10:05 PM',
    tickets: 251,
    sales: 1512.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_11',
    shift: '#11',
    shiftNumber: 11,
    date: 'Fri, Oct 17',
    day: 'Fri, Oct 17',
    salesperson: 'Rosa',
    employee: 'Rosa',
    started: '7:00 AM',
    closed: '3:01 PM',
    openClose: '7:00 AM — 3:01 PM',
    tickets: 198,
    sales: 1173.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_10',
    shift: '#10',
    shiftNumber: 10,
    date: 'Thu, Oct 16',
    day: 'Thu, Oct 16',
    salesperson: 'Daniel',
    employee: 'Daniel',
    started: '3:02 PM',
    closed: '10:02 PM',
    openClose: '3:02 PM — 10:02 PM',
    tickets: 233,
    sales: 1396.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_9',
    shift: '#9',
    shiftNumber: 9,
    date: 'Thu, Oct 16',
    day: 'Thu, Oct 16',
    salesperson: 'Rosa',
    employee: 'Rosa',
    started: '7:05 AM',
    closed: '3:00 PM',
    openClose: '7:05 AM — 3:00 PM',
    tickets: 176,
    sales: 1045.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_8',
    shift: '#8',
    shiftNumber: 8,
    date: 'Wed, Oct 15',
    day: 'Wed, Oct 15',
    salesperson: 'Daniel',
    employee: 'Daniel',
    started: '3:00 PM',
    closed: '10:04 PM',
    openClose: '3:00 PM — 10:04 PM',
    tickets: 240,
    sales: 1420.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_7',
    shift: '#7',
    shiftNumber: 7,
    date: 'Wed, Oct 15',
    day: 'Wed, Oct 15',
    salesperson: 'Rosa',
    employee: 'Rosa',
    started: '7:01 AM',
    closed: '3:02 PM',
    openClose: '7:01 AM — 3:02 PM',
    tickets: 187,
    sales: 1098.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_6',
    shift: '#6',
    shiftNumber: 6,
    date: 'Tue, Oct 14',
    day: 'Tue, Oct 14',
    salesperson: 'Daniel',
    employee: 'Daniel',
    started: '3:03 PM',
    closed: '10:00 PM',
    openClose: '3:03 PM — 10:00 PM',
    tickets: 228,
    sales: 1331.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  },
  {
    id: 'shift_5',
    shift: '#5',
    shiftNumber: 5,
    date: 'Tue, Oct 14',
    day: 'Tue, Oct 14',
    salesperson: 'Rosa',
    employee: 'Rosa',
    started: '7:00 AM',
    closed: '3:01 PM',
    openClose: '7:00 AM — 3:01 PM',
    tickets: 185,
    sales: 1105.00,
    email: 'Sent',
    emailStatus: 'sent',
    version: 'Final v1',
    versionBadge: 'final'
  }
];

/**
 * Reference Day Report specification directly matching the UI Screenshot
 * Store: AMIGO FOOD MART · Total Sales: $1,237.00 · Tickets: 248
 */
export const AMIGO_SCREENSHOT_DAY_REPORT = {
  isLive: false,
  reportTitle: 'Day Report',
  storeName: 'AMIGO FOOD MART',
  storeAddress: '2300 Moody Rd, Warner Robins, GA 31088',
  subtitle: 'Thursday, Oct 8, 2026 · Closed 9:41 PM by master',
  date: '10/08/2026',
  openedTime: '7:02 AM',
  closedTime: '9:41 PM',
  userId: 'master',
  totalInstantSales: 1237.00,
  totalTickets: 248,
  soldOutCount: 1,
  soldOutBox: 'Box 16',
  returnedCount: 0,
  shifts: [
    { id: 1, name: 'Shift #1 · Priya', cashier: 'Priya', time: '7:02 AM – 3:30 PM', total: 731.00 },
    { id: 2, name: 'Shift #2 · Carlos', cashier: 'Carlos', time: '3:30 PM – 9:41 PM', total: 506.00 }
  ],
  priceBreakdown: [
    { price: 1, count: 22, total: 22.00 },
    { price: 2, count: 53, total: 106.00 },
    { price: 3, count: 108, total: 324.00 },
    { price: 5, count: 35, total: 175.00 },
    { price: 10, count: 14, total: 140.00 },
    { price: 20, count: 11, total: 220.00 },
    { price: 50, count: 5, total: 250.00 }
  ],
  boxes: [
    { box: 1, pack: '128842', game: '5X Money', open: '000', close: '013', sold: 13, price: 1, total: 13.00 },
    { box: 2, pack: '745508', game: 'Jr Jumbo', open: '000', close: '009', sold: 9, price: 1, total: 9.00 },
    { box: 3, pack: '933093', game: 'Loteria', open: '000', close: '003', sold: 3, price: 2, total: 6.00 },
    { box: 4, pack: '558845', game: 'Hit 100', open: '000', close: '011', sold: 11, price: 2, total: 22.00 },
    { box: 6, pack: '935561', game: 'Cross Word', open: '000', close: '004', sold: 4, price: 3, total: 12.00 },
    { box: 7, pack: '558848', game: '2026 Happy New', open: '000', close: '004', sold: 4, price: 3, total: 12.00 },
    { box: 14, pack: '493848', game: '50X Money', open: '000', close: '011', sold: 11, price: 10, total: 110.00 },
    { box: 16, pack: '130508', game: 'Treasure Hunt', open: '000', close: '100', sold: 100, price: 3, total: 300.00, isSoldOut: true },
    { box: 17, pack: '176917', game: 'Gold $500,000', open: '000', close: '012', sold: 12, price: 5, total: 60.00 },
    { box: 18, pack: '196515', game: '25X Tra', open: '000', close: '008', sold: 8, price: 5, total: 40.00 },
    { box: 21, pack: '903287', game: 'Lucky 7s', open: '000', close: '007', sold: 7, price: 5, total: 35.00 },
    { box: 22, pack: '500022', game: 'Epic Riches', open: '000', close: '003', sold: 3, price: 10, total: 30.00 },
    { box: 25, pack: '593958', game: 'Jumbo Bucks Ext', open: '000', close: '001', sold: 1, price: 50, total: 50.00 },
    { box: 27, pack: '277184', game: 'Cash 500,000', open: '000', close: '004', sold: 4, price: 50, total: 200.00 },
    { box: 56, pack: '568218', game: 'Hit 1000', open: '000', close: '011', sold: 11, price: 20, total: 220.00 },
    { box: 57, pack: '572198', game: 'Frogger', open: '000', close: '008', sold: 8, price: 5, total: 40.00 },
    { box: 60, pack: '600871', game: 'Jumbo Bucks', open: '000', close: '008', sold: 8, price: 2, total: 16.00 },
    { box: 61, pack: '610455', game: '10X Money', open: '000', close: '010', sold: 10, price: 2, total: 20.00 },
    { box: 62, pack: '620913', game: 'Spicy Hot Cash', open: '000', close: '009', sold: 9, price: 2, total: 18.00 },
    { box: 63, pack: '631482', game: 'Jackpots', open: '040', close: '052', sold: 12, price: 2, total: 24.00 }
  ]
};

/**
 * Reconciles and returns Day Report Screen data.
 * If live sales exist in state, calculates dynamic sales; otherwise renders the reference dataset.
 * Supports toggling empty boxes visibility.
 */
export function getScreenDayReportData(state, options = {}) {
  const { showEmptyBoxes = false, forceSample = false } = options;

  if (!state || forceSample) {
    // Return sample matching user screenshot exactly
    const ref = JSON.parse(JSON.stringify(AMIGO_SCREENSHOT_DAY_REPORT));
    if (state?.storeName) ref.storeName = state.storeName;
    if (state?.storeAddress) ref.storeAddress = state.storeAddress;
    if (state?.cashierName) ref.userId = state.cashierName;

    if (showEmptyBoxes) {
      const existingBoxNums = new Set(ref.boxes.map(b => b.box));
      const maxBox = 65;
      const allRows = [...ref.boxes];
      for (let i = 1; i <= maxBox; i++) {
        if (!existingBoxNums.has(i)) {
          allRows.push({
            box: i,
            pack: '---',
            game: 'EMPTY',
            open: '-',
            close: '-',
            sold: '-',
            price: '-',
            total: 0,
            isEmpty: true
          });
        }
      }
      allRows.sort((a, b) => a.box - b.box);
      ref.boxes = allRows;
    }

    return ref;
  }

  const targetDate = options.targetDate || options.date || null;
  const now = new Date();
  const isTargetToday = !targetDate || isSameBusinessDay(targetDate, now);

  // =========================================================================
  // 1. HISTORICAL DATE CALCULATION (when targetDate is not today)
  // =========================================================================
  if (!isTargetToday) {
    const shiftsOnDate = (Array.isArray(state?.shiftHistory) ? state.shiftHistory : [])
      .filter(h => isSameBusinessDay(h.endedAt || h.startedAt || h.date, targetDate))
      .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0));

    if (shiftsOnDate.length > 0) {
      const earliestShift = shiftsOnDate[0];
      const latestShift = shiftsOnDate[shiftsOnDate.length - 1];

      const dObj = parseFlexibleDate(targetDate) || new Date(earliestShift.endedAt || earliestShift.startedAt || Date.now());
      const dateStr = dObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
      const monthName = dObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dObj.getDate();
      const yearNum = dObj.getFullYear();

      const openTime = earliestShift.startedAt
        ? new Date(earliestShift.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : (earliestShift.openedTime || '7:00 AM');
      const closeTime = latestShift.endedAt
        ? new Date(latestShift.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : (latestShift.closedTime || '10:00 PM');

      const user = latestShift.cashier || latestShift.cashierName || earliestShift.cashier || 'Clerk';

      let totalTickets = 0;
      let totalInstantSales = 0;
      const priceMap = new Map();
      const boxes = [];

      // Collect all sold-out packs that occurred in any shift on this historical date
      const allSoldOutOnDate = [];
      shiftsOnDate.forEach(h => {
        (h.soldOutSnapshot || []).forEach(so => allSoldOutOnDate.push(so));
      });

      const soldOutList = allSoldOutOnDate.filter(sp => {
        const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
        return sSold > 0;
      });
      const soldOutCount = soldOutList.length;
      const soldOutBox = soldOutList.length > 0 ? `Box ${soldOutList[0].boxNumber || ''}` : '-';

      // Calculate max box
      let maxBox = 65;
      shiftsOnDate.forEach(h => {
        (h.slotsSnapshot || []).forEach(s => {
          if (s.boxNumber > maxBox) maxBox = s.boxNumber;
        });
      });
      soldOutList.forEach(s => {
        if (s.boxNumber > maxBox) maxBox = s.boxNumber;
      });

      for (let b = 1; b <= maxBox; b++) {
        const soldPacks = soldOutList.filter(so => so.boxNumber === b);
        let boxHasRows = false;

        // 1. Sold-out packs in this box on this date
        soldPacks.forEach(sp => {
          const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
          const price = Number(sp.price) || 1;
          const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * price);

          totalTickets += sSold;
          totalInstantSales += sTotal;

          const pEntry = priceMap.get(price) || { count: 0, total: 0 };
          pEntry.count += sSold;
          pEntry.total += sTotal;
          priceMap.set(price, pEntry);

          boxes.push({
            box: b,
            pack: sp.packNumber,
            game: sp.gameName || 'Scratch-off',
            open: String(sp.startTicket || 0).padStart(3, '0'),
            close: String(sp.closeTicket || (sp.startTicket || 0) + sSold).padStart(3, '0'),
            sold: sSold,
            price,
            total: sTotal,
            isSoldOut: true
          });
          boxHasRows = true;
        });

        // 2. Active pack in this box at the end of the day
        const lastSlot = (latestShift.slotsSnapshot || []).find(s => s.boxNumber === b && s.status === 'ACTIVE' && s.packNumber);
        if (lastSlot) {
          // Find opening ticket from earliest shift that had this same pack
          const firstShiftWithPack = shiftsOnDate.find(h => (h.slotsSnapshot || []).some(s => s.boxNumber === b && s.packNumber === lastSlot.packNumber));
          const firstSlot = firstShiftWithPack ? (firstShiftWithPack.slotsSnapshot || []).find(s => s.boxNumber === b && s.packNumber === lastSlot.packNumber) : null;
          const openTix = (firstSlot && typeof firstSlot.startTicket === 'number')
            ? firstSlot.startTicket
            : (typeof lastSlot.packStartTicket === 'number' ? lastSlot.packStartTicket : (typeof lastSlot.startTicket === 'number' ? lastSlot.startTicket : 0));
          const closeTix = typeof lastSlot.currentTicket === 'number' ? lastSlot.currentTicket : openTix;
          const sold = Math.max(0, closeTix - openTix);
          const price = Number(lastSlot.price) || 1;
          const rowTotal = sold * price;

          totalTickets += sold;
          totalInstantSales += rowTotal;

          const pEntry = priceMap.get(price) || { count: 0, total: 0 };
          pEntry.count += sold;
          pEntry.total += rowTotal;
          priceMap.set(price, pEntry);

          boxes.push({
            box: b,
            pack: lastSlot.packNumber,
            game: lastSlot.gameName || 'Scratch-off',
            open: String(openTix).padStart(3, '0'),
            close: String(closeTix).padStart(3, '0'),
            sold,
            price,
            total: rowTotal,
            isSoldOut: false
          });
          boxHasRows = true;
        } else if (!boxHasRows && showEmptyBoxes) {
          boxes.push({
            box: b,
            pack: '---',
            game: 'EMPTY',
            open: '-',
            close: '-',
            sold: '-',
            price: '-',
            total: 0,
            isEmpty: true
          });
        }
      }

      const priceBreakdown = Array.from(priceMap.entries())
        .map(([price, data]) => ({ price, count: data.count, total: data.total }))
        .sort((a, b) => a.price - b.price);

      const shifts = shiftsOnDate.map((h, idx) => {
        const sNum = h.shiftNumber || (idx + 1);
        const cName = h.cashier || h.cashierName || 'Cashier';
        const sStart = h.startedAt ? new Date(h.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '7:00 AM';
        const sEnd = h.endedAt ? new Date(h.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '3:00 PM';
        return {
          id: sNum,
          name: `Shift #${sNum} · ${cName}`,
          cashier: cName,
          time: `${sStart} – ${sEnd}`,
          total: Number(h.totalSalesRevenue || 0),
          tickets: Number(h.totalTicketsSold || 0),
          isOpen: false
        };
      });

      const shiftsSummary = shifts.map(s => `${s.name.replace('Shift #', '#')} (${s.time})`).join(' · ');
      const shiftsCount = `${shifts.length} shift${shifts.length === 1 ? '' : 's'}`;
      const subtitle = `${dayName}, ${monthName} ${dayNum}, ${yearNum} · ${shiftsCount} · Closed ${closeTime} by ${user}`;

      return {
        isLive: true,
        isDailyMode: true,
        reportHeading: 'Day Report',
        reportTitle: 'Day Report',
        storeName: state?.storeName || earliestShift.storeName || 'AMIGO FOOD MART',
        storeAddress: state?.storeAddress || earliestShift.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088',
        subtitle,
        date: dateStr,
        dateRange: dateStr,
        generatedTime: `${monthName} ${dayNum}, ${closeTime}`,
        openedTime: openTime,
        closedTime: closeTime,
        userId: user,
        shifts,
        shiftsCount,
        shiftsSummary,
        totalInstantSales,
        totalTickets,
        soldOutCount,
        soldOutBox,
        returnedCount: 0,
        priceBreakdown,
        boxes
      };
    }

    // Fallback for sample reference dates (e.g. Oct 17, Oct 16, etc.) when state.shiftHistory has no records for that date
    const refShifts = REFERENCE_CLOSED_SHIFTS.filter(s => isSameBusinessDay(s.date || s.day, targetDate));
    if (refShifts.length > 0) {
      const totalRefSales = refShifts.reduce((acc, s) => acc + s.sales, 0);
      const totalRefTickets = refShifts.reduce((acc, s) => acc + s.tickets, 0);
      const dObj = parseFlexibleDate(targetDate) || new Date();
      const dateStr = dObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
      const monthName = dObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dObj.getDate();
      const yearNum = dObj.getFullYear();
      const shifts = refShifts.map((s, idx) => ({
        id: s.shiftNumber || (idx + 1),
        name: `Shift #${s.shiftNumber} · ${s.salesperson}`,
        cashier: s.salesperson,
        time: s.openClose || `${s.started} – ${s.closed}`,
        total: s.sales,
        tickets: s.tickets,
        isOpen: false
      }));
      return {
        isLive: false,
        isDailyMode: true,
        reportHeading: 'Day Report',
        reportTitle: 'Day Report',
        storeName: state?.storeName || 'AMIGO FOOD MART',
        storeAddress: state?.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088',
        subtitle: `${dayName}, ${monthName} ${dayNum}, ${yearNum} · ${shifts.length} shifts · Closed by ${refShifts[0]?.salesperson || 'master'}`,
        date: dateStr,
        dateRange: dateStr,
        generatedTime: `${monthName} ${dayNum}, 10:00 PM`,
        openedTime: refShifts[refShifts.length - 1]?.started || '7:00 AM',
        closedTime: refShifts[0]?.closed || '10:00 PM',
        userId: refShifts[0]?.salesperson || 'master',
        shifts,
        shiftsCount: `${shifts.length} shifts`,
        shiftsSummary: shifts.map(s => `${s.name} (${s.time})`).join(' · '),
        totalInstantSales: totalRefSales,
        totalTickets: totalRefTickets,
        soldOutCount: 0,
        soldOutBox: '-',
        returnedCount: 0,
        priceBreakdown: [],
        boxes: showEmptyBoxes ? Array.from({ length: 65 }, (_, i) => ({
          box: i + 1,
          pack: '---',
          game: 'EMPTY',
          open: '-',
          close: '-',
          sold: '-',
          price: '-',
          total: 0,
          isEmpty: true
        })) : []
      };
    }

    // No shifts on this date
    const dObj = parseFlexibleDate(targetDate) || new Date();
    const dateStr = dObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    return {
      isLive: true,
      isDailyMode: true,
      reportHeading: 'Day Report',
      reportTitle: 'Day Report',
      storeName: state?.storeName || 'AMIGO FOOD MART',
      storeAddress: state?.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088',
      subtitle: `${dateStr} · 0 shifts`,
      date: dateStr,
      dateRange: dateStr,
      generatedTime: dateStr,
      openedTime: '-',
      closedTime: '-',
      userId: state?.cashierName || 'Clerk',
      shifts: [],
      shiftsCount: '0 shifts',
      shiftsSummary: 'No shifts recorded',
      totalInstantSales: 0,
      totalTickets: 0,
      soldOutCount: 0,
      soldOutBox: '-',
      returnedCount: 0,
      priceBreakdown: [],
      boxes: showEmptyBoxes ? Array.from({ length: 65 }, (_, i) => ({
        box: i + 1,
        pack: '---',
        game: 'EMPTY',
        open: '-',
        close: '-',
        sold: '-',
        price: '-',
        total: 0,
        isEmpty: true
      })) : []
    };
  }

  // =========================================================================
  // 2. LIVE TODAY CALCULATION (current business day: closed shifts + live shift)
  // =========================================================================
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = now.getDate();
  const yearNum = now.getFullYear();

  const openTime = state?.shiftStartedAt 
    ? new Date(state.shiftStartedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '7:02 AM';

  const user = state?.cashierName || 'Carlos';
  const isDailyMode = state?.settings?.operationMode !== 'SHIFTS';

  let totalTickets = 0;
  let totalInstantSales = 0;
  const priceMap = new Map();
  const boxes = [];

  // Find all past shifts that completed today
  const todayPastShifts = (Array.isArray(state?.shiftHistory) ? state.shiftHistory : [])
    .filter(h => isSameBusinessDay(h.endedAt || h.startedAt || h.date, now))
    .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0));

  const earliestTodayShift = todayPastShifts.length > 0 ? todayPastShifts[0] : null;

  // Day's opening ticket for this pack (from earliest shift of today or activation ticket)
  const getDayOpenTicket = (slot) => {
    if (earliestTodayShift && Array.isArray(earliestTodayShift.slotsSnapshot)) {
      const pastSlot = earliestTodayShift.slotsSnapshot.find(s => s.boxNumber === slot.boxNumber && s.packNumber === slot.packNumber);
      if (pastSlot && typeof pastSlot.startTicket === 'number') {
        return pastSlot.startTicket;
      }
    }
    return (slot && typeof slot.packStartTicket === 'number') ? slot.packStartTicket : ((slot && typeof slot.startTicket === 'number') ? slot.startTicket : 0);
  };

  // Aggregate sold out packs belonging to today (both past shifts and current shift)
  const allSoldOutToday = [];
  todayPastShifts.forEach(h => {
    (h.soldOutSnapshot || []).forEach(so => allSoldOutToday.push(so));
  });
  (state?.soldOutThisShift || []).forEach(so => allSoldOutToday.push(so));

  // Only count sold-out packs that had actual sales
  const soldOutList = allSoldOutToday.filter(sp => {
    const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
    return sSold > 0;
  });
  let soldOutCount = soldOutList.length;
  let soldOutBox = soldOutList.length > 0 ? `Box ${soldOutList[0].boxNumber || ''}` : '-';

  const maxBox = Math.max(65, ...(state.slots || []).map(s => s.boxNumber || 0));

  for (let b = 1; b <= maxBox; b++) {
    const slot = (state.slots || []).find(s => s.boxNumber === b);
    const soldPacks = soldOutList.filter(so => so.boxNumber === b);
    let boxHasRows = false;

    // 1. Include any packs that sold out in this box today
    if (soldPacks.length > 0) {
      soldPacks.forEach(sp => {
        const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
        const price = Number(sp.price) || 1;
        const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * price);

        totalTickets += sSold;
        totalInstantSales += sTotal;

        const pEntry = priceMap.get(price) || { count: 0, total: 0 };
        pEntry.count += sSold;
        pEntry.total += sTotal;
        priceMap.set(price, pEntry);

        boxes.push({
          box: b,
          pack: sp.packNumber,
          game: sp.gameName || 'Scratch-off',
          open: String(sp.startTicket || 0).padStart(3, '0'),
          close: String(sp.closeTicket || (sp.startTicket || 0) + sSold).padStart(3, '0'),
          sold: sSold,
          price,
          total: sTotal,
          isSoldOut: true
        });
        boxHasRows = true;
      });
    }

    // 2. Include the currently active pack in this box (if any)
    if (slot && slot.status === 'ACTIVE' && slot.packNumber) {
      const openTix = getDayOpenTicket(slot);
      const closeTix = typeof slot.currentTicket === 'number' ? slot.currentTicket : openTix;
      const sold = Math.max(0, closeTix - openTix);
      const price = Number(slot.price) || 1;
      const rowTotal = sold * price;

      totalTickets += sold;
      totalInstantSales += rowTotal;

      const pEntry = priceMap.get(price) || { count: 0, total: 0 };
      pEntry.count += sold;
      pEntry.total += rowTotal;
      priceMap.set(price, pEntry);

      boxes.push({
        box: b,
        pack: slot.packNumber,
        game: slot.gameName || 'Scratch-off',
        open: String(openTix).padStart(3, '0'),
        close: String(closeTix).padStart(3, '0'),
        sold,
        price,
        total: rowTotal,
        isSoldOut: false
      });
      boxHasRows = true;
    } else if (!boxHasRows && showEmptyBoxes) {
      boxes.push({
        box: b,
        pack: '---',
        game: 'EMPTY',
        open: '-',
        close: '-',
        sold: '-',
        price: '-',
        total: 0,
        isEmpty: true
      });
    }
  }

  // Price breakdown sorted by price ascending
  const priceBreakdown = Array.from(priceMap.entries())
    .map(([price, data]) => ({ price, count: data.count, total: data.total }))
    .sort((a, b) => a.price - b.price);

  // Shift breakdown
  const shifts = [];

  if (Array.isArray(state?.shiftHistory)) {
    state.shiftHistory.filter(h => isSameBusinessDay(h.endedAt || h.startedAt || h.date, now)).forEach((h, idx) => {
      const sNum = h.shiftNumber || (idx + 1);
      const cName = h.cashier || h.cashierName || 'Cashier';
      const sStart = h.startedAt ? new Date(h.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '7:02 AM';
      const sEnd = h.endedAt ? new Date(h.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '3:30 PM';
      shifts.push({
        id: sNum,
        name: `Shift #${sNum} · ${cName}`,
        cashier: cName,
        time: `${sStart} – ${sEnd}`,
        total: Number(h.totalSalesRevenue || 0),
        tickets: Number(h.totalTicketsSold || 0),
        isOpen: false
      });
    });
  }

  // Current open shift
  const currentShiftNum = state?.shiftNumber || (shifts.length + 1);
  const currentShiftName = isDailyMode 
    ? `Day · ${user}`
    : `Shift #${currentShiftNum} · ${user}`;
  const currentShiftTime = `${openTime} – Present`;
  const pastShiftsSales = shifts.reduce((acc, s) => acc + (s.total || 0), 0);
  const pastShiftsTickets = shifts.reduce((acc, s) => acc + (s.tickets || 0), 0);
  shifts.push({
    id: currentShiftNum,
    name: currentShiftName,
    cashier: user,
    time: currentShiftTime,
    total: Math.max(0, totalInstantSales - pastShiftsSales),
    tickets: Math.max(0, totalTickets - pastShiftsTickets),
    isOpen: true
  });

  const shiftsSummary = shifts.map(s => `${s.name.replace('Shift #', '#')} (${s.time})`).join(' · ');
  const shiftsCount = isDailyMode ? '1 day' : `${shifts.length} shift${shifts.length === 1 ? '' : 's'}`;
  const reportHeading = 'Day Report';
  const reportTitle = 'Day Report';
  const subtitle = `${dayName}, ${monthName} ${dayNum}, ${yearNum} · ${shiftsCount} · open since ${openTime} by ${user}`;

  return {
    isLive: true,
    isDailyMode,
    reportHeading,
    reportTitle,
    storeName: state?.storeName || 'AMIGO FOOD MART',
    storeAddress: state?.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088',
    subtitle,
    date: dateStr,
    dateRange: dateStr,
    generatedTime: `${monthName} ${dayNum}, ${timeStr}`,
    openedTime: openTime,
    closedTime: timeStr,
    userId: user,
    shifts,
    shiftsCount,
    shiftsSummary,
    totalInstantSales,
    totalTickets,
    soldOutCount,
    soldOutBox,
    returnedCount: 0,
    priceBreakdown,
    boxes
  };
}

/**
 * Computes a side-by-side comparison between Today's complete daily report and
 * Yesterday's complete daily report using the exact same calculation rules and
 * accounting fields.
 */
export function getTodayVsYesterdayComparison(state) {
  const now = new Date();
  const isToday = (dStr) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };
  const isYesterday = (dStr) => {
    if (!dStr) return false;
    const d = new Date(dStr);
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return d.getFullYear() === y.getFullYear() &&
           d.getMonth() === y.getMonth() &&
           d.getDate() === y.getDate();
  };

  const todayDateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const yDate = new Date(now);
  yDate.setDate(now.getDate() - 1);
  const yesterdayDateStr = yDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

  // 1. TODAY'S TOTALS (past closed shifts of today + current shift)
  const todayPastShifts = (state?.shiftHistory || []).filter(h => isToday(h.endedAt || h.startedAt));
  const todayPastTickets = todayPastShifts.reduce((acc, h) => acc + Number(h.totalTicketsSold || 0), 0);
  const todayPastRevenue = todayPastShifts.reduce((acc, h) => acc + Number(h.totalSalesRevenue || 0), 0);
  const todayPastCashes = todayPastShifts.reduce((acc, h) => acc + Number(h.cashes || 0), 0);
  const todayPastOnline = todayPastShifts.reduce((acc, h) => acc + Number(h.onlineSales || 0), 0);
  const todayPastOnlineCashes = todayPastShifts.reduce((acc, h) => acc + Number(h.onlineCashes || 0), 0);
  const todayPastActivations = todayPastShifts.reduce((acc, h) => acc + Number(h.activationsCount || 0), 0);
  const todayPastSoldOuts = todayPastShifts.reduce((acc, h) => acc + (Array.isArray(h.soldOutSnapshot) ? h.soldOutSnapshot.length : 0), 0);

  // Current shift in-progress sales
  let currentShiftTickets = 0;
  let currentShiftRevenue = 0;
  (state?.slots || []).forEach(s => {
    if (s && s.status === 'ACTIVE' && s.packNumber) {
      const openT = typeof s.startTicket === 'number' ? s.startTicket : 0;
      const currT = typeof s.currentTicket === 'number' ? s.currentTicket : openT;
      const sSold = Math.abs(currT - openT);
      currentShiftTickets += sSold;
      currentShiftRevenue += sSold * (s.price || 0);
    }
  });
  (state?.soldOutThisShift || []).forEach(so => {
    const sSold = so.ticketsSold !== undefined ? so.ticketsSold : Math.abs((so.closeTicket || 0) - (so.startTicket || 0));
    currentShiftTickets += sSold;
    currentShiftRevenue += so.salesAmount !== undefined ? so.salesAmount : (sSold * (so.price || 0));
  });

  const currentCashes = Number(state?.cashes || 0);
  const currentOnline = Number(state?.onlineSales || 0);
  const currentOnlineCashes = Number(state?.onlineCashes || 0);
  const currentActivations = (state?.slots || []).filter(s => s && s.status === 'ACTIVE' && s.activatedThisShift).length;
  const currentSoldOuts = (state?.soldOutThisShift || []).length;

  const todayTotalTickets = todayPastTickets + currentShiftTickets;
  const todayTotalSales = todayPastRevenue + currentShiftRevenue;
  const todayTotalCashes = todayPastCashes + currentCashes;
  const todayTotalOnline = todayPastOnline + currentOnline;
  const todayTotalOnlineCashes = todayPastOnlineCashes + currentOnlineCashes;
  const todayNetSettlement = (todayTotalSales + todayTotalOnline) - (todayTotalCashes + todayTotalOnlineCashes);
  const todayActivations = todayPastActivations + currentActivations;
  const todaySoldOuts = todayPastSoldOuts + currentSoldOuts;

  const todayReport = {
    date: todayDateStr,
    totalTickets: todayTotalTickets,
    totalSales: todayTotalSales,
    cashCollected: todayTotalCashes,
    onlineSales: todayTotalOnline,
    onlineCashes: todayTotalOnlineCashes,
    netSettlement: todayNetSettlement,
    packsActivated: todayActivations,
    packsSoldOut: todaySoldOuts,
    shiftsCount: todayPastShifts.length + ((state?.shiftStatus === 'IN_PROGRESS' || state?.shiftStatus === 'SCANNING_END_SHIFT') ? 1 : 0),
    discrepancies: state?.dayReportAdjustments || null
  };

  // 2. YESTERDAY'S TOTALS (from actual recorded shift history of yesterday)
  const yesterdayShifts = (state?.shiftHistory || []).filter(h => isYesterday(h.endedAt || h.startedAt));
  const yesterdayTickets = yesterdayShifts.reduce((acc, h) => acc + Number(h.totalTicketsSold || 0), 0);
  const yesterdayRevenue = yesterdayShifts.reduce((acc, h) => acc + Number(h.totalSalesRevenue || 0), 0);
  const yesterdayCashes = yesterdayShifts.reduce((acc, h) => acc + Number(h.cashes || 0), 0);
  const yesterdayOnline = yesterdayShifts.reduce((acc, h) => acc + Number(h.onlineSales || 0), 0);
  const yesterdayOnlineCashes = yesterdayShifts.reduce((acc, h) => acc + Number(h.onlineCashes || 0), 0);
  const yesterdayNetSettlement = (yesterdayRevenue + yesterdayOnline) - (yesterdayCashes + yesterdayOnlineCashes);
  const yesterdayActivations = yesterdayShifts.reduce((acc, h) => acc + Number(h.activationsCount || 0), 0);
  const yesterdaySoldOuts = yesterdayShifts.reduce((acc, h) => acc + (Array.isArray(h.soldOutSnapshot) ? h.soldOutSnapshot.length : 0), 0);

  const yesterdayReport = {
    date: yesterdayDateStr,
    totalTickets: yesterdayTickets,
    totalSales: yesterdayRevenue,
    cashCollected: yesterdayCashes,
    onlineSales: yesterdayOnline,
    onlineCashes: yesterdayOnlineCashes,
    netSettlement: yesterdayNetSettlement,
    packsActivated: yesterdayActivations,
    packsSoldOut: yesterdaySoldOuts,
    shiftsCount: yesterdayShifts.length,
    discrepancies: null
  };

  return {
    today: todayReport,
    yesterday: yesterdayReport,
    differences: {
      ticketsDelta: todayTotalTickets - yesterdayTickets,
      salesDelta: todayTotalSales - yesterdayRevenue,
      cashDelta: todayTotalCashes - yesterdayCashes,
      netSettlementDelta: todayNetSettlement - yesterdayNetSettlement
    }
  };
}

if (typeof window !== 'undefined') {
  window.getTodayVsYesterdayComparison = getTodayVsYesterdayComparison;
}
