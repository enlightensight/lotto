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
 * Full POS state backup sync to MySQL (Isolated per storeId)
 */
let syncDebounceTimer = null;
export async function syncPOSStateToDB(state, immediate = false) {
  if (!state) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

  const storeId = state.storeId || (typeof window !== 'undefined' && window.getCurrentStoreId ? window.getCurrentStoreId() : 'store_amigo');

  const doSync = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('lotto_store_token') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('lotto_store_token') : null);
        if (token) headers['x-store-token'] = token;
        headers['x-store-id'] = storeId;
      }
      await fetch(`/api/sync-pos-state?storeId=${encodeURIComponent(storeId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ storeId, state }),
        signal: AbortSignal.timeout(4000)
      });
    } catch (e) {
      // Silently fail if DB offline
    }
  };

  if (immediate || state.dataCleared) {
    syncDebounceTimer = null;
    return doSync();
  }

  syncDebounceTimer = setTimeout(doSync, 1000);
}

/**
 * Permanently wipe server POS state file and DB tables for this store
 */
export async function clearPOSStateOnDB(targetStoreId = null) {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
  const storeId = targetStoreId || (typeof window !== 'undefined' && window.getCurrentStoreId ? window.getCurrentStoreId() : 'store_amigo');
  try {
    const res = await fetch(`/api/clear-pos-state?storeId=${encodeURIComponent(storeId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
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
 * Log an individual ticket scan / sale event to MySQL
 */
export async function logTicketScanToDB(scanData) {
  if (!scanData || !scanData.barcode) return;
  try {
    await fetch('/api/log-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scanData),
      signal: AbortSignal.timeout(3000)
    });
  } catch (err) {
    // Silently continue if DB offline
  }
}

export async function loadPOSStateFromDB(targetStoreId = null) {
  const storeId = targetStoreId || (typeof window !== 'undefined' && window.getCurrentStoreId ? window.getCurrentStoreId() : 'store_amigo');
  try {
    const headers = {};
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('lotto_store_token') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('lotto_store_token') : null);
      if (token) headers['x-store-token'] = token;
      headers['x-store-id'] = storeId;
    }
    const res = await fetch(`/api/load-pos-state?storeId=${encodeURIComponent(storeId)}`, { headers, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.state) {
        // Strict guard: ensure data belongs to the requested store
        if (!data.storeId || data.storeId === storeId) {
          return data.state;
        }
      }
    }
  } catch (err) {
    // Silently continue
  }
  return null;
}

/**
 * Periodically monitor database status
 */
export function initDatabaseSync(onStatus) {
  if (onStatus) onDbStatusChange(onStatus);
  checkMySQLStatus();
  setInterval(checkMySQLStatus, 10000);
}

