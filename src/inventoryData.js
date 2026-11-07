// Inventory & Audit Screen Data Model & Reconciler
// Matches LottoTrack Reference UI Specification

export const REFERENCE_INVENTORY_ITEMS = [
  {
    box: 1,
    pack: '128842',
    game: '5X Money',
    price: 1,
    currentTicket: 13,
    packSize: 300,
    ticketsLeft: 287,
    value: 287.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 2,
    pack: '745508',
    game: 'Jr Jumbo',
    price: 1,
    currentTicket: 9,
    packSize: 300,
    ticketsLeft: 291,
    value: 291.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 3,
    pack: '933093',
    game: 'Loteria',
    price: 2,
    currentTicket: 3,
    packSize: 150,
    ticketsLeft: 147,
    value: 294.00,
    ageDays: 7,
    ageText: '7+ days',
    ageBadge: 'warning'
  },
  {
    box: 4,
    pack: '558845',
    game: 'Hit 100',
    price: 2,
    currentTicket: 11,
    packSize: 150,
    ticketsLeft: 139,
    value: 278.00,
    ageDays: 4,
    ageText: '4 days',
    ageBadge: null
  },
  {
    box: 6,
    pack: '935561',
    game: 'Cross Word',
    price: 3,
    currentTicket: 4,
    packSize: 100,
    ticketsLeft: 96,
    value: 288.00,
    ageDays: 1,
    ageText: '1 day',
    ageBadge: null
  },
  {
    box: 7,
    pack: '558848',
    game: '2026 Happy New',
    price: 3,
    currentTicket: 4,
    packSize: 100,
    ticketsLeft: 96,
    value: 288.00,
    ageDays: 10,
    ageText: '10+ days',
    ageBadge: 'orange'
  },
  {
    box: 14,
    pack: '493848',
    game: '50X Money',
    price: 10,
    currentTicket: 11,
    packSize: 30,
    ticketsLeft: 19,
    value: 190.00,
    ageDays: 3,
    ageText: '3 days',
    ageBadge: null
  },
  {
    box: 17,
    pack: '176917',
    game: 'Gold $500,000',
    price: 5,
    currentTicket: 12,
    packSize: 60,
    ticketsLeft: 48,
    value: 240.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 18,
    pack: '196515',
    game: '25X Tra',
    price: 5,
    currentTicket: 8,
    packSize: 60,
    ticketsLeft: 52,
    value: 260.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 21,
    pack: '903287',
    game: 'Lucky 7s',
    price: 5,
    currentTicket: 7,
    packSize: 60,
    ticketsLeft: 53,
    value: 265.00,
    ageDays: 7,
    ageText: '7+ days',
    ageBadge: 'warning'
  },
  {
    box: 22,
    pack: '500022',
    game: 'Epic Riches',
    price: 10,
    currentTicket: 3,
    packSize: 30,
    ticketsLeft: 27,
    value: 270.00,
    ageDays: 1,
    ageText: '1 day',
    ageBadge: null
  },
  {
    box: 25,
    pack: '593958',
    game: 'Jumbo Bucks Ext',
    price: 50,
    currentTicket: 1,
    packSize: 18,
    ticketsLeft: 17,
    value: 850.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 27,
    pack: '277184',
    game: 'Cash 500,000',
    price: 50,
    currentTicket: 4,
    packSize: 18,
    ticketsLeft: 14,
    value: 700.00,
    ageDays: 21,
    ageText: '21+ days',
    ageBadge: 'coral'
  },
  {
    box: 56,
    pack: '568218',
    game: 'Hit 1000',
    price: 20,
    currentTicket: 11,
    packSize: 15,
    ticketsLeft: 4,
    value: 80.00,
    ageDays: 4,
    ageText: '4 days',
    ageBadge: null
  },
  {
    box: 57,
    pack: '572198',
    game: 'Frogger',
    price: 5,
    currentTicket: 8,
    packSize: 60,
    ticketsLeft: 52,
    value: 260.00,
    ageDays: 2,
    ageText: '2 days',
    ageBadge: null
  },
  {
    box: 60,
    pack: '600871',
    game: 'Jumbo Bucks',
    price: 2,
    currentTicket: 8,
    packSize: 150,
    ticketsLeft: 142,
    value: 284.00,
    ageDays: 12,
    ageText: '12+ days',
    ageBadge: 'orange'
  },
  {
    box: 61,
    pack: '610455',
    game: '10X Money',
    price: 2,
    currentTicket: 2,
    packSize: 150,
    ticketsLeft: 148,
    value: 296.00,
    ageDays: 3,
    ageText: '3 days',
    ageBadge: null
  },
  {
    box: 62,
    pack: '620913',
    game: 'Spicy Hot Cash',
    price: 2,
    currentTicket: 9,
    packSize: 150,
    ticketsLeft: 141,
    value: 282.00,
    ageDays: 7,
    ageText: '7+ days',
    ageBadge: 'warning'
  },
  {
    box: 63,
    pack: '631482',
    game: 'Jackpot',
    price: 2,
    currentTicket: 2,
    packSize: 100,
    ticketsLeft: 98,
    value: 196.00,
    ageDays: 27,
    ageText: '27+ days',
    ageBadge: 'coral'
  }
];

export const REFERENCE_SAFE_PACKS = [
  {
    id: 'safe_1',
    packNumber: '983301',
    gameName: 'Lucky 7s',
    price: 5,
    tickets: 60,
    bookValue: 300.00,
    status: 'In safe',
    receivedAt: '2 days ago'
  },
  {
    id: 'safe_2',
    packNumber: '745612',
    gameName: 'Jr Jumbo',
    price: 1,
    tickets: 300,
    bookValue: 300.00,
    status: 'In safe',
    receivedAt: '1 day ago'
  },
  {
    id: 'safe_3',
    packNumber: '171140',
    gameName: '50X Money',
    price: 10,
    tickets: 30,
    bookValue: 300.00,
    status: 'In safe',
    receivedAt: '3 days ago'
  },
  {
    id: 'safe_4',
    packNumber: '142342',
    gameName: '100X Money',
    price: 20,
    tickets: 15,
    bookValue: 300.00,
    status: 'In safe',
    receivedAt: 'Today'
  }
];

export const REFERENCE_SOLD_OUT_PACKS = [
  {
    box: 16,
    packNumber: '130508',
    gameName: 'Treasure Hunt',
    price: 3,
    ticketsSold: 100,
    salesAmount: 300.00,
    time: '8:45 PM'
  }
];

// ============================================================================
// REFERENCE DATA MATCHING USER'S NEW INVENTORY SPECIFICATION (Image 1 & Image 2)
// ============================================================================
export const REFERENCE_IN_STOCK_PACKS = [
  {
    id: 'stock_1',
    gameName: '5X Money',
    gameNumber: 'Game 1417',
    packNumber: '0670170',
    price: 1,
    packSize: '300 tickets',
    packSizeNum: 300,
    status: 'IN_STOCK',
    statusLabel: 'In stock',
    statusBadgeClass: 'badge-in-stock',
    boxNumber: null,
    position: '000',
    receivedDate: 'Oct 17'
  },
  {
    id: 'stock_2',
    gameName: '500X The Money',
    gameNumber: 'Game 1770',
    packNumber: '1036463',
    price: 50,
    packSize: '18 tickets',
    packSizeNum: 18,
    status: 'IN_STOCK',
    statusLabel: 'In stock',
    statusBadgeClass: 'badge-in-stock',
    boxNumber: null,
    position: '000',
    receivedDate: 'Oct 17'
  },
  {
    id: 'stock_3',
    gameName: 'Win 50 or 100',
    gameNumber: 'Game 1799',
    packNumber: '0412288',
    price: 10,
    packSize: '30 tickets',
    packSizeNum: 30,
    status: 'IN_STOCK',
    statusLabel: 'In stock',
    statusBadgeClass: 'badge-in-stock',
    boxNumber: null,
    position: '000',
    receivedDate: 'Oct 16'
  },
  {
    id: 'stock_4',
    gameName: 'Treasure Hunt',
    gameNumber: 'Game 1611',
    packNumber: '0180611',
    price: 3,
    packSize: '100 tickets',
    packSizeNum: 100,
    status: 'IN_STOCK',
    statusLabel: 'In stock',
    statusBadgeClass: 'badge-in-stock',
    boxNumber: null,
    position: '000',
    receivedDate: 'Oct 15'
  }
];

export const REFERENCE_COMPLETED_PACKS = [
  {
    id: 'comp_1',
    gameName: 'Treasure Hunt',
    gameNumber: 'Game 1611',
    packNumber: '130508',
    price: 3,
    packSize: '100 tickets',
    packSizeNum: 100,
    status: 'COMPLETED',
    statusLabel: 'Completed',
    statusBadgeClass: 'badge-completed',
    boxNumber: 16,
    position: '100',
    receivedDate: 'Sep 25'
  },
  {
    id: 'comp_2',
    gameName: 'Jumbo Jumbo',
    gameNumber: 'Game 1420',
    packNumber: '881203',
    price: 2,
    packSize: '150 tickets',
    packSizeNum: 150,
    status: 'COMPLETED',
    statusLabel: 'Completed',
    statusBadgeClass: 'badge-completed',
    boxNumber: null,
    position: '150',
    receivedDate: 'Sep 20'
  },
  {
    id: 'comp_3',
    gameName: 'Mega 7s',
    gameNumber: 'Game 1565',
    packNumber: '440912',
    price: 5,
    packSize: '60 tickets',
    packSizeNum: 60,
    status: 'COMPLETED',
    statusLabel: 'Completed',
    statusBadgeClass: 'badge-completed',
    boxNumber: null,
    position: '060',
    receivedDate: 'Sep 18'
  }
];

export const REFERENCE_REMOVED_PACKS = [
  {
    id: 'rem_1',
    gameName: '10X The Cash',
    gameNumber: 'Game 1502',
    packNumber: '229104',
    price: 2,
    packSize: '150 tickets',
    packSizeNum: 150,
    status: 'REMOVED',
    statusLabel: 'Removed',
    statusBadgeClass: 'badge-removed',
    boxNumber: null,
    position: '045',
    receivedDate: 'Sep 10'
  }
];

/**
 * Reconciles inventory data and returns metrics, active tab rows, and counts.
 */
export function getInventoryScreenData(state, activeTab = 'in_stock', searchQuery = '') {
  const isDataCleared = Boolean(state?.dataCleared);
  const query = (searchQuery || '').trim().toLowerCase();
  const totalSlotsCount = 65;
  const isAmigo = (!state?.storeId || state?.storeId === 'store_amigo');

  // 1. In Stock Items (strictly from real state, zero mock leakage)
  let inStockItems = [];
  if (Array.isArray(state?.inStockInventory)) {
    inStockItems = JSON.parse(JSON.stringify(state.inStockInventory));
  }

  // 1b. Pending Setup / Unconfigured Items from automatic new barcode detection
  let pendingItems = [];
  if (Array.isArray(state?.pendingTickets)) {
    state.pendingTickets.filter(pt => pt && pt.status === 'PENDING_SETUP').forEach((pt, idx) => {
      pendingItems.push({
        id: `pending_${idx}_${pt.barcode}`,
        gameName: pt.gameName || 'New Unconfigured Ticket',
        gameNumber: pt.gameNumber ? `Game ${pt.gameNumber}` : `Barcode ${pt.barcode ? pt.barcode.slice(-4) : ''}`,
        packNumber: String(pt.packNumber || pt.barcode),
        price: (pt.ticketPrice !== undefined && pt.ticketPrice !== null && !isNaN(pt.ticketPrice)) ? Number(pt.ticketPrice) : '—',
        packSize: 'Pending setup',
        packSizeNum: 0,
        status: 'PENDING_SETUP',
        statusLabel: 'Pending Setup',
        statusBadgeClass: 'badge-removed',
        boxNumber: null,
        position: '—',
        receivedDate: pt.discoveredAt ? new Date(pt.discoveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today',
        barcode: pt.barcode
      });
    });
    // Add pending items to In Stock view so cashiers see unconfigured tickets in inventory
    inStockItems.push(...pendingItems);
  }

  // 2. Active Items on the Rack (from state.slots or reference for store_amigo)
  let activeItems = [];
  const liveSlots = (state && Array.isArray(state.slots))
    ? state.slots.filter(s => s && s.status === 'ACTIVE' && s.packNumber)
    : [];

  if (liveSlots.length > 0) {
    liveSlots.forEach(s => {
      const sizeNum = s.packSize || (s.price ? (s.price >= 50 ? 18 : Math.max(1, Math.floor(300 / s.price))) : 100);
      const cur = typeof s.currentTicket === 'number' ? s.currentTicket : (s.startTicket || 0);
      const isPending = Boolean(s.needsActivation);
      activeItems.push({
        id: `active_slot_${s.boxNumber}`,
        gameName: s.gameName || 'Scratch-off',
        gameNumber: `Game ${s.gameCode || (1400 + Number(s.boxNumber))}`,
        packNumber: String(s.packNumber),
        price: Number(s.price) || 1,
        packSize: `${sizeNum} tickets`,
        packSizeNum: sizeNum,
        status: isPending ? 'PENDING_ACTIVATION' : 'ACTIVE',
        statusLabel: isPending ? 'Pending Activation' : 'Active',
        statusBadgeClass: isPending ? 'badge-pending' : 'badge-active',
        boxNumber: s.boxNumber,
        position: String(cur).padStart(3, '0'),
        receivedDate: s.activatedDateStr || 'Today',
        currentTicket: cur,
        ticketsLeft: Math.max(0, sizeNum - cur),
        value: Math.max(0, sizeNum - cur) * (Number(s.price) || 1),
        box: s.boxNumber,
        pack: s.packNumber,
        game: s.gameName
      });
    });
  }
  activeItems.sort((a, b) => (Number(a.boxNumber) || 0) - (Number(b.boxNumber) || 0));

  // 3. Completed Items (strictly real, zero mock leakage)
  let completedItems = [];
  if (state?.soldOutThisShift && state.soldOutThisShift.length > 0) {
    state.soldOutThisShift.forEach((so, idx) => {
      completedItems.push({
        id: `comp_live_${idx}`,
        gameName: so.gameName || 'Scratch-off',
        gameNumber: `Game ${so.gameCode || 1611}`,
        packNumber: String(so.packNumber),
        price: so.price || 3,
        packSize: '100 tickets',
        packSizeNum: 100,
        status: 'COMPLETED',
        statusLabel: 'Completed',
        statusBadgeClass: 'badge-completed',
        boxNumber: so.boxNumber || null,
        position: '100',
        receivedDate: 'Today'
      });
    });
  }

  // 4. Removed Items (strictly real, zero mock leakage)
  let removedItems = [];
  if (state?.partialTakeOuts && state.partialTakeOuts.length > 0) {
    state.partialTakeOuts
      .filter(pto => pto && pto.reason !== 'Returned' && pto.status !== 'RETURNED')
      .forEach((pto, idx) => {
        removedItems.push({
          id: `rem_live_${idx}`,
          gameName: pto.gameName || 'Scratch-off',
          gameNumber: `Game ${pto.gameCode || 1500}`,
          packNumber: String(pto.packNumber),
          price: pto.price || 5,
          packSize: '60 tickets',
          packSizeNum: 60,
          status: 'REMOVED',
          statusLabel: 'Removed',
          statusBadgeClass: 'badge-removed',
          boxNumber: pto.boxNumber || null,
          position: String(pto.ticket || 0).padStart(3, '0'),
          receivedDate: 'Today'
        });
      });
  }

  // 5. All Items (Sum of inStock + active + completed + removed = 27)
  let allItems = [
    ...inStockItems,
    ...activeItems,
    ...completedItems,
    ...removedItems
  ];

  // Helper filter for query
  const matches = (item) => {
    if (!query) return true;
    return (
      (item.gameName && item.gameName.toLowerCase().includes(query)) ||
      (item.gameNumber && item.gameNumber.toLowerCase().includes(query)) ||
      (item.packNumber && String(item.packNumber).toLowerCase().includes(query)) ||
      (item.boxNumber && String(item.boxNumber).toLowerCase().includes(query)) ||
      (item.statusLabel && item.statusLabel.toLowerCase().includes(query)) ||
      (item.position && String(item.position).toLowerCase().includes(query)) ||
      (item.receivedDate && item.receivedDate.toLowerCase().includes(query))
    );
  };

  const filteredInStock = inStockItems.filter(matches);
  const filteredActive = activeItems.filter(matches);
  const filteredCompleted = completedItems.filter(matches);
  const filteredRemoved = removedItems.filter(matches);
  const filteredAll = allItems.filter(matches);

  // Normalize active tab (support both new Image 1 tabs and legacy names)
  let normalizedTab = activeTab;
  if (normalizedTab === 'rack') normalizedTab = 'active';
  else if (normalizedTab === 'safe') normalizedTab = 'in_stock';
  else if (normalizedTab === 'sold') normalizedTab = 'completed';
  else if (normalizedTab === 'returned') normalizedTab = 'removed';
  else if (normalizedTab === 'empty') normalizedTab = 'all';

  let currentItems = filteredInStock;
  if (normalizedTab === 'active') currentItems = filteredActive;
  else if (normalizedTab === 'completed') currentItems = filteredCompleted;
  else if (normalizedTab === 'removed') currentItems = filteredRemoved;
  else if (normalizedTab === 'all') currentItems = filteredAll;

  // Backward compatibility object structures
  const isDemoAmigo = isAmigo && !isDataCleared && liveSlots.length === 0;
  const safeItems = isDemoAmigo ? JSON.parse(JSON.stringify(REFERENCE_SAFE_PACKS)) : inStockItems;
  const soldOutItems = isDemoAmigo ? JSON.parse(JSON.stringify(REFERENCE_SOLD_OUT_PACKS)) : completedItems;
  let emptyBoxes = [];
  const activeBoxSet = new Set(activeItems.map(r => r.boxNumber));
  for (let b = 1; b <= totalSlotsCount; b++) {
    if (!activeBoxSet.has(b)) {
      emptyBoxes.push({ box: b, status: 'EMPTY', label: `Box ${b} is empty` });
    }
  }

  const ticketsOnRack = activeItems.reduce((acc, it) => acc + (Number(it.ticketsLeft) || 0), 0);
  const rackVal = activeItems.reduce((acc, it) => acc + (Number(it.value) || 0), 0);
  const safeVal = inStockItems.reduce((acc, it) => {
    const p = Number(it.price) || 0;
    const sz = Number(it.packSizeNum) || 100;
    return acc + (p * sz);
  }, 0);
  const rackCap = activeItems.reduce((acc, it) => acc + (Number(it.packSizeNum) || 100), 0);

  return {
    kpis: {
      packsOnRackCount: activeItems.length,
      emptyBoxesCount: emptyBoxes.length,
      ticketsOnRackCount: isDemoAmigo ? 1882 : ticketsOnRack,
      totalRackCapacity: isDemoAmigo ? 2240 : (rackCap || (totalSlotsCount * 100)),
      rackValue: isDemoAmigo ? 6383.00 : rackVal,
      safeValue: isDemoAmigo ? 1200.00 : safeVal,
      safePacksCount: inStockItems.length,
      soldTodaySales: isDemoAmigo ? 1237.00 : (Number(state?.todaySales) || 0),
      soldTodayTickets: isDemoAmigo ? 248 : (Number(state?.todayTickets) || 0)
    },
    counts: {
      inStock: inStockItems.length,
      active: activeItems.length,
      completed: completedItems.length,
      removed: removedItems.length,
      all: allItems.length,
      // Legacy aliases
      rack: activeItems.length,
      safe: inStockItems.length,
      sold: completedItems.length,
      returned: removedItems.length,
      empty: emptyBoxes.length
    },
    activeTab: normalizedTab,
    items: currentItems,
    inStockItems: filteredInStock,
    activeItems: filteredActive,
    completedItems: filteredCompleted,
    removedItems: filteredRemoved,
    allItems: filteredAll,
    // Legacy properties
    rackItems: filteredActive,
    safeItems: safeItems,
    soldOutItems: soldOutItems,
    returnedItems: filteredRemoved,
    emptyBoxes
  };
}
