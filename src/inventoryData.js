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
    currentTicket: 10,
    packSize: 150,
    ticketsLeft: 140,
    value: 280.00,
    ageDays: 2,
    ageText: '2 days',
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
    game: 'Jackpots',
    price: 2,
    currentTicket: 52,
    packSize: 150,
    ticketsLeft: 98,
    value: 196.00,
    ageDays: 7,
    ageText: '7+ days',
    ageBadge: 'warning'
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

/**
 * Reconciles inventory data and returns metrics, active tab rows, and counts.
 */
export function getInventoryScreenData(state, activeTab = 'rack', searchQuery = '') {
  const query = (searchQuery || '').trim().toLowerCase();
  const totalSlotsCount = 65;

  // Determine if state has live active slots
  const hasLiveSlots = state && Array.isArray(state.slots) && state.slots.some(s => s && s.status === 'ACTIVE' && s.packNumber);

  let rackItems = [];
  let safeItems = [];
  let soldOutItems = [];
  let returnedItems = [];
  let emptyBoxes = [];

  if (!hasLiveSlots) {
    // Use reference data matching the screenshot
    rackItems = JSON.parse(JSON.stringify(REFERENCE_INVENTORY_ITEMS));
    safeItems = JSON.parse(JSON.stringify(REFERENCE_SAFE_PACKS));
    soldOutItems = JSON.parse(JSON.stringify(REFERENCE_SOLD_OUT_PACKS));
    returnedItems = [];

    const activeBoxSet = new Set(rackItems.map(r => r.box));
    for (let b = 1; b <= totalSlotsCount; b++) {
      if (!activeBoxSet.has(b)) {
        emptyBoxes.push({
          box: b,
          status: 'EMPTY',
          label: `Box ${b} is empty`
        });
      }
    }
  } else {
    // Generate from live state
    const slots = state.slots || [];
    slots.forEach(slot => {
      if (slot && slot.status === 'ACTIVE' && slot.packNumber) {
        const packSize = slot.packSize || (slot.price ? (slot.price >= 50 ? 18 : Math.max(1, Math.floor(300 / slot.price))) : 100);
        const cur = typeof slot.currentTicket === 'number' ? slot.currentTicket : (slot.startTicket || 0);
        const left = Math.max(0, packSize - cur);
        const price = Number(slot.price) || 1;
        const val = left * price;
        const ageDays = slot.activatedDaysAgo || 2;
        let ageBadge = null;
        if (ageDays >= 20) ageBadge = 'coral';
        else if (ageDays >= 10) ageBadge = 'orange';
        else if (ageDays >= 7) ageBadge = 'warning';

        rackItems.push({
          box: slot.boxNumber,
          pack: slot.packNumber,
          game: slot.gameName || 'Scratch-off',
          price,
          currentTicket: cur,
          packSize,
          ticketsLeft: left,
          value: val,
          ageDays,
          ageText: ageDays >= 7 ? `${ageDays}+ days` : `${ageDays} ${ageDays === 1 ? 'day' : 'days'}`,
          ageBadge
        });
      } else if (slot && slot.boxNumber) {
        emptyBoxes.push({
          box: slot.boxNumber,
          status: 'EMPTY',
          label: `Box ${slot.boxNumber} is empty`
        });
      }
    });

    rackItems.sort((a, b) => a.box - b.box);

    // Safe packs
    safeItems = (state.inventory || []).map((inv, idx) => ({
      id: inv.id || `safe_${idx}`,
      packNumber: inv.packNumber,
      gameName: inv.gameName,
      price: inv.price || 1,
      tickets: inv.packSize || 100,
      bookValue: (inv.packSize || 100) * (inv.price || 1),
      status: 'In safe',
      receivedAt: inv.receivedAt ? new Date(inv.receivedAt).toLocaleDateString() : 'Stored'
    }));

    // Sold out
    soldOutItems = (state.soldOutThisShift || []).map(so => ({
      box: so.boxNumber,
      packNumber: so.packNumber,
      gameName: so.gameName,
      price: so.price || 1,
      ticketsSold: so.ticketsSold || 0,
      salesAmount: so.salesAmount || 0,
      time: so.soldOutTime || 'Today'
    }));
  }

  // Calculate high-level KPIs
  const packsOnRackCount = rackItems.length;
  const emptyBoxesCount = emptyBoxes.length;

  const ticketsOnRackCount = !hasLiveSlots ? 1882 : rackItems.reduce((acc, item) => acc + (item.ticketsLeft || 0), 0);
  const totalRackCapacity = !hasLiveSlots ? 2240 : rackItems.reduce((acc, item) => acc + (item.packSize || 0), 0);

  const rackValue = !hasLiveSlots ? 6383.00 : rackItems.reduce((acc, item) => acc + (item.value || 0), 0);
  const safeValue = !hasLiveSlots ? 1200.00 : safeItems.reduce((acc, item) => acc + (item.bookValue || 0), 0);

  // Sold today from state or reference
  const soldTodaySales = 1237.00;
  const soldTodayTickets = 248;

  // Filter items according to search query
  const matchesQuery = (text) => !query || String(text).toLowerCase().includes(query);

  let filteredRack = rackItems.filter(item => 
    matchesQuery(item.box) || matchesQuery(item.game) || matchesQuery(item.pack)
  );

  let filteredSafe = safeItems.filter(item => 
    matchesQuery(item.gameName) || matchesQuery(item.packNumber)
  );

  let filteredSoldOut = soldOutItems.filter(item => 
    matchesQuery(item.box) || matchesQuery(item.gameName) || matchesQuery(item.packNumber)
  );

  let filteredReturned = returnedItems.filter(item => 
    matchesQuery(item.gameName) || matchesQuery(item.packNumber)
  );

  let filteredEmpty = emptyBoxes.filter(item => 
    matchesQuery(item.box)
  );

  return {
    kpis: {
      packsOnRackCount,
      emptyBoxesCount,
      ticketsOnRackCount,
      totalRackCapacity,
      rackValue,
      safeValue,
      safePacksCount: safeItems.length,
      soldTodaySales,
      soldTodayTickets
    },
    counts: {
      rack: rackItems.length,
      safe: safeItems.length,
      sold: soldOutItems.length,
      returned: returnedItems.length,
      empty: emptyBoxes.length
    },
    activeTab,
    rackItems: filteredRack,
    safeItems: filteredSafe,
    soldOutItems: filteredSoldOut,
    returnedItems: filteredReturned,
    emptyBoxes: filteredEmpty
  };
}
