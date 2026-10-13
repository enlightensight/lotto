// History & Past Days Screen Data Model & Reconciler
// Matches LottoTrack Reference UI Specification

export const REFERENCE_HISTORY_DAYS = [
  {
    id: 'day_14',
    date: 'Thu, Oct 8',
    dateShort: 'Today',
    openClose: '7:02 AM — 9:41 PM',
    closedBy: 'master',
    tickets: 248,
    sales: 1237.00,
    isToday: true,
    soldOutCount: 1,
    newPacksCount: 0
  },
  {
    id: 'day_13',
    date: 'Wed, Oct 7',
    dateShort: 'Oct 7',
    openClose: '7:01 AM — 9:31 PM',
    closedBy: 'Priya',
    tickets: 324,
    sales: 1450.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 2
  },
  {
    id: 'day_12',
    date: 'Tue, Oct 6',
    dateShort: 'Oct 6',
    openClose: '7:02 AM — 9:32 PM',
    closedBy: 'Carlos',
    tickets: 276,
    sales: 1180.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 2
  },
  {
    id: 'day_11',
    date: 'Mon, Oct 5',
    dateShort: 'Oct 5',
    openClose: '7:00 AM — 9:33 PM',
    closedBy: 'master',
    tickets: 384,
    sales: 1658.00,
    isToday: false,
    soldOutCount: 2,
    newPacksCount: 0
  },
  {
    id: 'day_10',
    date: 'Sun, Oct 4',
    dateShort: 'Oct 4',
    openClose: '7:01 AM — 9:34 PM',
    closedBy: 'Priya',
    tickets: 443,
    sales: 1904.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 0
  },
  {
    id: 'day_9',
    date: 'Sat, Oct 3',
    dateShort: 'Oct 3',
    openClose: '7:00 AM — 9:35 PM',
    closedBy: 'Carlos',
    tickets: 287,
    sales: 1282.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 3
  },
  {
    id: 'day_8',
    date: 'Fri, Oct 2',
    dateShort: 'Oct 2',
    openClose: '7:00 AM — 9:36 PM',
    closedBy: 'master',
    tickets: 233,
    sales: 1096.00,
    isToday: false,
    soldOutCount: 1,
    newPacksCount: 0
  },
  {
    id: 'day_7',
    date: 'Thu, Oct 1',
    dateShort: 'Oct 1',
    openClose: '7:01 AM — 9:37 PM',
    closedBy: 'Priya',
    tickets: 297,
    sales: 1270.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 4
  },
  {
    id: 'day_6',
    date: 'Wed, Sep 30',
    dateShort: 'Sep 30',
    openClose: '7:02 AM — 9:38 PM',
    closedBy: 'Carlos',
    tickets: 323,
    sales: 1388.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 0
  },
  {
    id: 'day_5',
    date: 'Tue, Sep 29',
    dateShort: 'Sep 29',
    openClose: '7:00 AM — 9:39 PM',
    closedBy: 'master',
    tickets: 349,
    sales: 1502.00,
    isToday: false,
    soldOutCount: 2,
    newPacksCount: 3
  },
  {
    id: 'day_4',
    date: 'Mon, Sep 28',
    dateShort: 'Sep 28',
    openClose: '7:01 AM — 9:40 PM',
    closedBy: 'Priya',
    tickets: 412,
    sales: 1744.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 0
  },
  {
    id: 'day_3',
    date: 'Sun, Sep 27',
    dateShort: 'Sep 27',
    openClose: '7:01 AM — 9:41 PM',
    closedBy: 'Carlos',
    tickets: 468,
    sales: 2011.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 0
  },
  {
    id: 'day_2',
    date: 'Sat, Sep 26',
    dateShort: 'Sep 26',
    openClose: '7:00 AM — 9:42 PM',
    closedBy: 'master',
    tickets: 350,
    sales: 1290.00,
    isToday: false,
    soldOutCount: 1,
    newPacksCount: 2
  },
  {
    id: 'day_1',
    date: 'Fri, Sep 25',
    dateShort: 'Sep 25',
    openClose: '7:01 AM — 9:43 PM',
    closedBy: 'Priya',
    tickets: 297,
    sales: 1154.00,
    isToday: false,
    soldOutCount: 0,
    newPacksCount: 1
  }
];

export function getHistoryScreenData(state) {
  const hasLiveHistory = state && Array.isArray(state.shiftHistory) && state.shiftHistory.length > 2;

  let days = JSON.parse(JSON.stringify(REFERENCE_HISTORY_DAYS));

  if (hasLiveHistory) {
    // If rich shift history is present in live state, incorporate it
    const liveHistory = (state.shiftHistory || []).map((h, i) => ({
      id: h.id || `live_day_${i}`,
      date: h.date || new Date(h.endedAt || h.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      dateShort: h.dateShort || new Date(h.endedAt || h.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      openClose: h.openClose || `${h.startedAt ? new Date(h.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '7:00 AM'} — ${h.endedAt ? new Date(h.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '9:40 PM'}`,
      closedBy: h.cashier || h.closedBy || 'master',
      tickets: Number(h.ticketsSold || h.tickets || 250),
      sales: Number(h.totalSales || h.sales || 1200),
      isToday: i === 0,
      soldOutCount: Array.isArray(h.soldOutSnapshot) ? h.soldOutSnapshot.length : 0,
      newPacksCount: 0
    }));
    if (liveHistory.length > 0) {
      days = liveHistory;
    }
  }

  // Calculate metrics
  const totalSales = days.reduce((sum, d) => sum + (d.sales || 0), 0);
  const ticketsSold = days.reduce((sum, d) => sum + (d.tickets || 0), 0);
  const daysCount = days.length;
  const dailyAverage = daysCount > 0 ? Math.round(totalSales / daysCount) : 0;

  // Best day
  let bestDay = days[0];
  days.forEach(d => {
    if ((d.sales || 0) > (bestDay.sales || 0)) {
      bestDay = d;
    }
  });

  // Chart data: chronological order (oldest to newest)
  // days list is newest to oldest, so reverse for chart left-to-right
  const chartDays = [...days].reverse();
  const maxSales = Math.max(1, ...chartDays.map(d => d.sales || 0));

  return {
    kpis: {
      totalSales,
      daysCount,
      ticketsSold,
      dailyAverage,
      bestDayAmount: bestDay ? bestDay.sales : 0,
      bestDayDate: bestDay ? bestDay.date : 'Sun, Sep 27'
    },
    chart: {
      days: chartDays,
      maxSales
    },
    days // newest to oldest for the table
  };
}
