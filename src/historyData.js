// History & Past Days Screen Data Model & Reconciler
// Matches LottoTrack Reference UI Specification

import { isSameBusinessDay } from './dayReportData.js';

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

export function getHistoryScreenData(state) {
  const rawHistory = Array.isArray(state?.shiftHistory) ? state.shiftHistory : [];

  if (rawHistory.length === 0) {
    return {
      kpis: {
        totalSales: 0,
        daysCount: 0,
        ticketsSold: 0,
        dailyAverage: 0,
        bestDayAmount: 0,
        bestDayDate: '—',
        closedShiftsCount: 0,
        closedShiftsDays: '0 days',
        correctedReportsCount: 0,
        correctedReportsSub: 'none'
      },
      chart: {
        days: [],
        maxSales: 0
      },
      days: [],
      shifts: []
    };
  }

  // Map real shift history records
  const shifts = rawHistory.map((h, i) => {
    const shiftNum = h.shiftNumber !== undefined ? h.shiftNumber : (rawHistory.length - i);
    const d = new Date(h.endedAt || h.startedAt || Date.now());
    const dateStr = h.date || d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startStr = h.startedAt ? new Date(h.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '7:00 AM';
    const closeStr = h.endedAt ? new Date(h.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '3:00 PM';
    const person = h.cashier || h.employee || state?.cashierName || 'Clerk';
    const tickets = Number(h.totalTicketsSold !== undefined ? h.totalTicketsSold : (h.tickets || 0));
    const sales = Number(h.totalSalesRevenue !== undefined ? h.totalSalesRevenue : (h.sales || 0));

    return {
      id: h.id || `live_shift_${shiftNum}`,
      shift: `#${shiftNum}`,
      shiftNumber: shiftNum,
      date: dateStr,
      day: dateStr,
      salesperson: person,
      employee: person,
      started: startStr,
      closed: closeStr,
      openClose: h.openClose || `${startStr} — ${closeStr}`,
      tickets,
      sales,
      email: h.emailStatus === 'pending' ? 'Pending' : 'Sent',
      emailStatus: h.emailStatus || 'sent',
      version: h.version || 'Final v1',
      versionBadge: h.versionBadge || 'final'
    };
  });

  const totalSales = shifts.reduce((acc, s) => acc + (Number(s.sales) || 0), 0);
  const ticketsSold = shifts.reduce((acc, s) => acc + (Number(s.tickets) || 0), 0);
  const closedShiftsCount = shifts.length;

  // Group by day for charts and day metrics
  const dayMap = new Map();
  shifts.forEach(s => {
    const dKey = s.date || s.day;
    if (!dayMap.has(dKey)) {
      dayMap.set(dKey, {
        id: `day_${dKey}`,
        date: dKey,
        dateShort: dKey,
        openClose: s.openClose || `${s.started} — ${s.closed}`,
        closedBy: s.salesperson,
        tickets: 0,
        sales: 0,
        isToday: false,
        soldOutCount: 0,
        newPacksCount: 0
      });
    }
    const dayObj = dayMap.get(dKey);
    dayObj.tickets += s.tickets;
    dayObj.sales += s.sales;
  });

  const days = Array.from(dayMap.values());
  const daysCount = days.length;
  const dailyAverage = daysCount > 0 ? (totalSales / daysCount) : 0;

  let bestDayAmount = 0;
  let bestDayDate = '—';
  days.forEach(d => {
    if (d.sales > bestDayAmount) {
      bestDayAmount = d.sales;
      bestDayDate = d.date;
    }
  });

  const chartDays = [...days].reverse();
  const maxSales = Math.max(1, ...chartDays.map(d => d.sales || 0));

  return {
    kpis: {
      totalSales,
      daysCount,
      ticketsSold,
      dailyAverage: Math.round(dailyAverage),
      bestDayAmount,
      bestDayDate,
      closedShiftsCount,
      closedShiftsDays: `${daysCount} day${daysCount === 1 ? '' : 's'}`,
      correctedReportsCount: 0,
      correctedReportsSub: 'none'
    },
    chart: {
      days: chartDays,
      maxSales
    },
    days,
    shifts
  };
}

export function getDailyReportData(state, selectedDate = 'Today') {
  const { shifts } = getHistoryScreenData(state);
  const normDate = (selectedDate || 'Today').trim();

  const isMatching = (s) => {
    const sDate = s.date || s.day || '';
    if (normDate.toLowerCase() === 'today') {
      return isSameBusinessDay(sDate, new Date()) || sDate.toLowerCase().includes('today') || (s.id && String(s.id).startsWith('live_'));
    }
    return isSameBusinessDay(sDate, normDate);
  };

  const filtered = shifts.filter(isMatching);

  const totalTickets = filtered.reduce((acc, s) => acc + (Number(s.tickets) || 0), 0);
  const totalSales = filtered.reduce((acc, s) => acc + (Number(s.sales) || 0), 0);
  const closedCount = filtered.length;

  return {
    date: selectedDate,
    dateLabel: selectedDate,
    totalSales,
    totalTickets,
    closedCount,
    shifts: filtered
  };
}

