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
 * Generates a 100% dynamic, mathematically reconciled Georgia Lottery Day Report
 * directly from the live POS store state.
 */
export function generateLiveDayReport(state) {
  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Map any sold out packs by box number
  const soldOutMap = new Map();
  (state?.soldOutThisShift || []).forEach(so => {
    if (so && so.boxNumber) {
      if (!soldOutMap.has(so.boxNumber)) {
        soldOutMap.set(so.boxNumber, []);
      }
      soldOutMap.get(so.boxNumber).push(so);
    }
  });

  const boxes = [];
  let totalScratcherSales = 0;

  // Georgia Lottery Dispenser standard rack capacity: at least 70 boxes (Boxes 1 to 70+)
  const maxBoxNum = Math.max(70, ...(state?.slots || []).map(s => s.boxNumber || 0));
  for (let boxNum = 1; boxNum <= maxBoxNum; boxNum++) {
    const slot = (state?.slots || []).find(s => s.boxNumber === boxNum);
    const soldPacks = soldOutMap.get(boxNum) || [];
    const isSlotActive = Boolean(slot && slot.status === 'ACTIVE' && slot.packNumber);

    if (isSlotActive && soldPacks.length > 0) {
      // Multi-Pack Box: e.g. Box 6 in the official PDF where a pack finished and a new pack was activated
      const activeSold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
      const activeTotal = activeSold * (slot.price || 0);
      totalScratcherSales += activeTotal;

      const subRows = [
        {
          pack: slot.packNumber,
          name: formatReportGameName(slot.gameName),
          open: slot.startTicket || 0,
          close: slot.currentTicket || 0,
          price: slot.price || 0,
          total: activeTotal,
          highlight: slot.activatedThisShift ? 'green' : null
        }
      ];

      soldPacks.forEach(sp => {
        const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
        const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * (sp.price || 0));
        totalScratcherSales += sTotal;
        subRows.push({
          pack: sp.packNumber,
          name: formatReportGameName(sp.gameName),
          open: sp.startTicket || 0,
          close: sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold,
          price: sp.price || 0,
          total: sTotal,
          highlight: 'red'
        });
      });

      boxes.push({
        box: boxNum,
        isMultiPack: true,
        subRows
      });
    } else if (isSlotActive) {
      // Single active pack in dispenser
      const sold = Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
      const total = sold * (slot.price || 0);
      totalScratcherSales += total;

      boxes.push({
        box: boxNum,
        pack: slot.packNumber,
        name: formatReportGameName(slot.gameName),
        open: slot.startTicket || 0,
        close: slot.currentTicket || 0,
        price: slot.price || 0,
        total,
        highlight: slot.activatedThisShift ? 'green' : null
      });
    } else if (soldPacks.length > 0) {
      // Slot is currently inactive/empty, but sold out a pack during this shift
      if (soldPacks.length === 1) {
        const sp = soldPacks[0];
        const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
        const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * (sp.price || 0));
        totalScratcherSales += sTotal;

        boxes.push({
          box: boxNum,
          pack: sp.packNumber,
          name: formatReportGameName(sp.gameName),
          open: sp.startTicket || 0,
          close: sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold,
          price: sp.price || 0,
          total: sTotal,
          highlight: 'red'
        });
      } else {
        const subRows = soldPacks.map(sp => {
          const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
          const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * (sp.price || 0));
          totalScratcherSales += sTotal;
          return {
            pack: sp.packNumber,
            name: formatReportGameName(sp.gameName),
            open: sp.startTicket || 0,
            close: sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold,
            price: sp.price || 0,
            total: sTotal,
            highlight: 'red'
          };
        });

        boxes.push({
          box: boxNum,
          isMultiPack: true,
          subRows
        });
      }
    }
    // Empty boxes are completely omitted from receipts and reports!
  }

  // Financial Summary & Reconciled Totals
  const cashes = Number(state?.cashes || 0);
  const onlineSales = Number(state?.onlineSales || 0);
  const onlineCashes = Number(state?.onlineCashes || 0);
  const totalSales = totalScratcherSales + onlineSales;
  const totalCashes = cashes + onlineCashes;

  // Dynamic Inventory Statistics
  const activeSlots = (state?.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber);
  const endingCount = activeSlots.length;
  const activationsCount = activeSlots.filter(s => s.activatedThisShift).length;
  const soldCount = (state?.soldOutThisShift || []).length;
  const discontinuedCount = Number(state?.discontinuedCount || 0);

  // Exact Opening Count formula from Georgia Lottery manual
  let openingCount = endingCount - activationsCount + soldCount + discontinuedCount;
  if (typeof state?.shiftOpeningActiveCount === 'number' && state.shiftOpeningActiveCount > 0) {
    openingCount = state.shiftOpeningActiveCount;
  } else {
    openingCount = Math.max(0, openingCount);
  }

  const backInventory = (state?.inventory || []).length;
  const totalInventory = endingCount + backInventory;

  // Active Retail Value: Total dollar value of unsold tickets inside all active dispensers
  const activeValue = activeSlots.reduce((sum, s) => {
    const packSize = s.packSize || (s.price ? (s.price >= 50 ? 18 : Math.max(1, Math.floor(300 / s.price))) : 100);
    const remaining = Math.max(0, packSize - (s.currentTicket || 0));
    return sum + (remaining * (s.price || 0));
  }, 0);

  // Activations Subtable (Page 2)
  const activationsList = [];
  activeSlots.forEach(s => {
    if (s.activatedThisShift) {
      activationsList.push({
        box: s.boxNumber,
        time: s.activatedAt || reportTime,
        packNumber: s.packNumber,
        price: s.price || 0,
        name: formatReportGameName(s.gameName)
      });
    }
  });

  // Sold Out Subtable (Page 2)
  const soldOutList = [];
  (state?.soldOutThisShift || []).forEach(so => {
    soldOutList.push({
      box: so.boxNumber,
      packNumber: so.packNumber,
      price: so.price || 0,
      name: formatReportGameName(so.gameName)
    });
  });

  return {
    isLive: true,
    storeName: state?.storeName || 'AMIGO FOOD MART',
    storeAddress: state?.storeAddress || '2300 MOODY RD WARNER ROBINS, GA, 31088',
    userId: state?.cashierName || 'master',
    reportDate,
    reportTime,
    totalScratcherSales,
    cashes,
    onlineSales,
    onlineCashes,
    totalSales,
    totalCashes,
    inventoryStats: {
      openingCount,
      endingCount,
      activations: activationsCount,
      sold: soldCount,
      discontinued: discontinuedCount,
      removed: '-',
      backInventory,
      totalInventory,
      activeValue
    },
    activations: activationsList,
    soldOut: soldOutList,
    boxes
  };
}

/**
 * Returns dynamic live store Georgia Lottery Day Report.
 * @param {Object} state Live application state
 */
export function getDayReportData(state) {
  return generateLiveDayReport(state);
}
