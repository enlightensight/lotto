// =============================================================
// MySQL Database Synchronization Client
// Communicates with local Node.js Express backend (server.js)
// =============================================================

let isConnected = false;
let dbInfo = { database: 'lotto_pos', host: 'localhost', port: 3306 };
let statusListeners = [];

export function onDbStatusChange(callback) {
  if (typeof callback === 'function') {
    statusListeners.push(callback);
    // Call immediately with current status
    callback(isConnected, dbInfo);
  }
}

function notifyListeners() {
  statusListeners.forEach(cb => {
    try {
      cb(isConnected, dbInfo);
    } catch (e) {
      console.error('Error in DB status listener:', e);
    }
  });
}

/**
 * Check if the MySQL backend is reachable and connected to MySQL
 */
export async function checkMySQLStatus() {
  try {
    const res = await fetch('/api/db-status', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      isConnected = Boolean(data.connected);
      dbInfo = {
        database: data.database || 'lotto_pos',
        host: data.host || 'localhost',
        port: data.port || 3306,
        error: data.error || null
      };
    } else {
      isConnected = false;
    }
  } catch (err) {
    isConnected = false;
  }
  notifyListeners();
  return isConnected;
}

/**
 * Save Daily Report to MySQL database
 */
export async function saveDayReportToDB(reportData) {
  if (!reportData) return false;
  try {
    const res = await fetch('/api/save-day-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const result = await res.json();
      console.log('✅ [MySQL] Daily report saved successfully to MySQL (ID: ' + (result.insertId || 'OK') + ')');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [MySQL] Could not save daily report to MySQL (Backend or DB offline). Data remains safe in local storage.');
  }
  return false;
}

/**
 * Save Shift Report to MySQL database
 */
export async function saveShiftReportToDB(shiftData) {
  if (!shiftData) return false;
  try {
    const res = await fetch('/api/save-shift-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shiftData),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const result = await res.json();
      console.log('✅ [MySQL] Shift #' + shiftData.shiftNumber + ' saved to MySQL database!');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ [MySQL] Could not save shift to MySQL:', err.message);
  }
  return false;
}

/**
 * Full POS state backup sync to MySQL
 */
let syncDebounceTimer = null;
export function syncPOSStateToDB(state) {
  if (!state) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

  syncDebounceTimer = setTimeout(async () => {
    try {
      await fetch('/api/sync-pos-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        signal: AbortSignal.timeout(4000)
      });
    } catch (e) {
      // Silently fail if DB offline
    }
  }, 1000);
}

/**
 * Sync all past shifts from local storage to MySQL if not already present
 */
export async function syncHistoricalShiftsToDB(shiftHistory = []) {
  if (!Array.isArray(shiftHistory) || shiftHistory.length === 0) return;
  try {
    const res = await fetch('/api/shift-reports', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return;
    const data = await res.json();
    const existingShifts = data.shifts || [];
    const existingShiftNums = new Set(existingShifts.map(s => s.shift_number));

    for (const h of shiftHistory) {
      if (h && h.shiftNumber && !existingShiftNums.has(h.shiftNumber)) {
        await saveShiftReportToDB(h);
      }
    }
  } catch (err) {
    // Silently continue if DB temporarily unavailable
  }
}

/**
 * Periodically monitor database status
 */
export function initDatabaseSync(onStatus) {
  if (onStatus) onDbStatusChange(onStatus);
  checkMySQLStatus();
  setInterval(checkMySQLStatus, 10000);
}
