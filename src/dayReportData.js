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

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const isDaily = state?.settings?.operationMode !== 'SHIFTS';

  // In Daily Mode: Find all past shifts that completed today (if any)
  // In Shift Mode: Only report data for the current active shift
  const todayPastShifts = isDaily
    ? (state?.shiftHistory || [])
        .filter(h => isToday(h.endedAt || h.startedAt))
        .sort((a, b) => new Date(a.startedAt || a.endedAt || 0) - new Date(b.startedAt || b.endedAt || 0))
    : [];

  const earliestTodayShift = isDaily && todayPastShifts.length > 0 ? todayPastShifts[0] : null;

  // Determine true opening ticket (day's opening in Daily Mode, shift's opening in Shift Mode)
  const getDayOpenTicket = (slot) => {
    if (isDaily && earliestTodayShift && Array.isArray(earliestTodayShift.slotsSnapshot)) {
      const pastSlot = earliestTodayShift.slotsSnapshot.find(s => s.boxNumber === slot.boxNumber);
      if (pastSlot && pastSlot.packNumber === slot.packNumber && typeof pastSlot.startTicket === 'number') {
        return pastSlot.startTicket;
      }
    }
    return slot.startTicket || 0;
  };

  // Map any sold out packs across all today's shifts (Daily Mode) or current session (Shift Mode)
  const soldOutMap = new Map();
  const allSoldOutToday = [];
  if (isDaily) {
    todayPastShifts.forEach(h => {
      (h.soldOutSnapshot || []).forEach(so => allSoldOutToday.push(so));
    });
  }
  (state?.soldOutThisShift || []).forEach(so => allSoldOutToday.push(so));

  allSoldOutToday.forEach(so => {
    if (so && so.boxNumber) {
      if (!soldOutMap.has(so.boxNumber)) {
        soldOutMap.set(so.boxNumber, []);
      }
      const existing = soldOutMap.get(so.boxNumber);
      if (!existing.some(x => x.packNumber === so.packNumber)) {
        existing.push(so);
      }
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
      const openTicket = getDayOpenTicket(slot);
      const activeSold = Math.max(0, (slot.currentTicket || 0) - openTicket);
      const activeTotal = activeSold * (slot.price || 0);
      totalScratcherSales += activeTotal;

      const subRows = [
        {
          pack: slot.packNumber,
          name: formatReportGameName(slot.gameName),
          open: openTicket,
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
        const retSuffix = sp.isReturned ? ` (Ret ${sp.ticketsReturned || 0})` : '';
        subRows.push({
          pack: sp.packNumber,
          name: formatReportGameName(sp.gameName) + (sp.isReturned ? ' [RETURNED]' : ''),
          open: sp.startTicket || 0,
          close: (sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold) + retSuffix,
          price: sp.price || 0,
          total: sTotal,
          highlight: sp.isReturned ? 'purple' : 'red'
        });
      });

      boxes.push({
        box: boxNum,
        isMultiPack: true,
        subRows
      });
    } else if (isSlotActive) {
      // Single active pack in dispenser
      const openTicket = getDayOpenTicket(slot);
      const sold = Math.max(0, (slot.currentTicket || 0) - openTicket);
      const total = sold * (slot.price || 0);
      totalScratcherSales += total;

      boxes.push({
        box: boxNum,
        pack: slot.packNumber,
        name: formatReportGameName(slot.gameName),
        open: openTicket,
        close: slot.currentTicket || 0,
        price: slot.price || 0,
        total,
        highlight: slot.activatedThisShift ? 'green' : null
      });
    } else if (soldPacks.length > 0) {
      // Slot is currently inactive/empty, but sold out or returned a pack during this shift
      if (soldPacks.length === 1) {
        const sp = soldPacks[0];
        const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
        const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * (sp.price || 0));
        totalScratcherSales += sTotal;
        const retSuffix = sp.isReturned ? ` (Ret ${sp.ticketsReturned || 0})` : '';

        boxes.push({
          box: boxNum,
          pack: sp.packNumber,
          name: formatReportGameName(sp.gameName) + (sp.isReturned ? ' [RETURNED]' : ''),
          open: sp.startTicket || 0,
          close: (sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold) + retSuffix,
          price: sp.price || 0,
          total: sTotal,
          highlight: sp.isReturned ? 'purple' : 'red'
        });
      } else {
        const subRows = soldPacks.map(sp => {
          const sSold = sp.ticketsSold !== undefined ? sp.ticketsSold : Math.max(0, (sp.closeTicket || 0) - (sp.startTicket || 0));
          const sTotal = sp.salesAmount !== undefined ? sp.salesAmount : (sSold * (sp.price || 0));
          totalScratcherSales += sTotal;
          const retSuffix = sp.isReturned ? ` (Ret ${sp.ticketsReturned || 0})` : '';
          return {
            pack: sp.packNumber,
            name: formatReportGameName(sp.gameName) + (sp.isReturned ? ' [RETURNED]' : ''),
            open: sp.startTicket || 0,
            close: (sp.closeTicket !== undefined ? sp.closeTicket : (sp.startTicket || 0) + sSold) + retSuffix,
            price: sp.price || 0,
            total: sTotal,
            highlight: sp.isReturned ? 'purple' : 'red'
          };
        });

        boxes.push({
          box: boxNum,
          isMultiPack: true,
          subRows
        });
      }
    } else {
      // Empty slot — explicitly included per user request
      boxes.push({
        box: boxNum,
        pack: '---',
        name: 'EMPTY',
        open: '-',
        close: '-',
        price: '-',
        total: 0,
        isEmpty: true
      });
    }
  }

  // Financial Summary & Reconciled Totals (includes past today shifts + current)
  const pastCashes = todayPastShifts.reduce((sum, h) => sum + Number(h.cashes || 0), 0);
  const pastOnlineSales = todayPastShifts.reduce((sum, h) => sum + Number(h.onlineSales || 0), 0);
  const pastOnlineCashes = todayPastShifts.reduce((sum, h) => sum + Number(h.onlineCashes || 0), 0);

  const cashes = Number(state?.cashes || 0) + pastCashes;
  const onlineSales = Number(state?.onlineSales || 0) + pastOnlineSales;
  const onlineCashes = Number(state?.onlineCashes || 0) + pastOnlineCashes;
  const totalSales = totalScratcherSales + onlineSales;
  const totalCashes = cashes + onlineCashes;

  // Dynamic Inventory Statistics
  const activeSlots = (state?.slots || []).filter(s => s.status === 'ACTIVE' && s.packNumber);
  const endingCount = activeSlots.length;
  const activationsCount = activeSlots.filter(s => s.activatedThisShift).length;
  const soldCount = allSoldOutToday.filter(so => !so.isReturned).length;
  const returnedCount = allSoldOutToday.filter(so => so.isReturned).length;
  const discontinuedCount = Math.max(Number(state?.discontinuedCount || 0), returnedCount);

  // Exact Opening Count formula from Georgia Lottery manual:
  // Opening Active Count + Activations - Sold - Discontinued = Ending Active Count
  let openingCount = endingCount - activationsCount + soldCount + discontinuedCount;
  if (earliestTodayShift && typeof earliestTodayShift.emptySlotsCount === 'number') {
    openingCount = (state?.totalSlots || 70) - earliestTodayShift.emptySlotsCount;
  } else if (typeof state?.shiftOpeningActiveCount === 'number' && state.shiftOpeningActiveCount > 0) {
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

  // Activations Subtable (Page 2) - includes today's past shifts activations + current
  const activationsList = [];
  todayPastShifts.forEach(h => {
    (h.slotsSnapshot || []).forEach(s => {
      if (s.activatedThisShift && !activationsList.some(a => a.packNumber === s.packNumber)) {
        activationsList.push({
          box: s.boxNumber,
          time: s.activatedAt || reportTime,
          packNumber: s.packNumber,
          price: s.price || 0,
          name: formatReportGameName(s.gameName)
        });
      }
    });
  });
  activeSlots.forEach(s => {
    if (s.activatedThisShift && !activationsList.some(a => a.packNumber === s.packNumber)) {
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
  allSoldOutToday.forEach(so => {
    if (!soldOutList.some(x => x.packNumber === so.packNumber)) {
      soldOutList.push({
        box: so.boxNumber,
        packNumber: so.packNumber,
        price: so.price || 0,
        name: formatReportGameName(so.gameName) + (so.isReturned ? ` [RET: ${so.ticketsReturned || 0} tix]` : '')
      });
    }
  });

  return {
    isLive: true,
    isDailyMode: isDaily,
    reportHeading: isDaily ? 'Day Report' : `Shift #${state?.shiftNumber || 1} Report`,
    shiftNumber: state?.shiftNumber || 1,
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

  // Check if store state has any actual ticket sales
  const hasLiveSales = !forceSample && state && Array.isArray(state.slots) && state.slots.some(s => {
    return s && s.status === 'ACTIVE' && typeof s.startTicket === 'number' && typeof s.currentTicket === 'number' && s.currentTicket > s.startTicket;
  });

  if (!hasLiveSales) {
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

  // Calculate live report data from state
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = now.getDate();
  const yearNum = now.getFullYear();

  const openTime = state?.shiftStartedAt 
    ? new Date(state.shiftStartedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '7:02 AM';

  const user = state?.cashierName || 'master';
  const subtitle = `${dayName}, ${monthName} ${dayNum}, ${yearNum} · ${state?.shiftEndedAt ? 'Closed' : 'Open'} ${timeStr} by ${user}`;

  let totalTickets = 0;
  let totalInstantSales = 0;
  const priceMap = new Map();
  const boxes = [];
  const soldOutList = state?.soldOutThisShift || [];
  let soldOutCount = soldOutList.length;
  let soldOutBox = soldOutList.length > 0 ? `Box ${soldOutList[0].boxNumber || ''}` : '-';

  const maxBox = Math.max(65, ...(state.slots || []).map(s => s.boxNumber || 0));

  for (let b = 1; b <= maxBox; b++) {
    const slot = (state.slots || []).find(s => s.boxNumber === b);
    const soldPacks = soldOutList.filter(so => so.boxNumber === b);

    if (slot && slot.status === 'ACTIVE' && slot.packNumber) {
      const openTix = typeof slot.startTicket === 'number' ? slot.startTicket : 0;
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
    } else if (soldPacks.length > 0) {
      const sp = soldPacks[0];
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
    } else if (showEmptyBoxes) {
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

  return {
    isLive: true,
    reportTitle: 'Day Report',
    storeName: state?.storeName || 'AMIGO FOOD MART',
    storeAddress: state?.storeAddress || '2300 Moody Rd, Warner Robins, GA 31088',
    subtitle,
    date: dateStr,
    openedTime: openTime,
    closedTime: timeStr,
    userId: user,
    totalInstantSales,
    totalTickets,
    soldOutCount,
    soldOutBox,
    returnedCount: 0,
    priceBreakdown,
    boxes
  };
}
