// ============================================================================
// JACKPOTLO ENTERPRISE LOTTERY INVENTORY SERVICE
// Authoritative Two-Level Lottery Inventory Management Engine
// Pack-Level (physical lifecycle) & Ticket-Level (position/remaining)
// ============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';

const lockStorage = new AsyncLocalStorage();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'server_data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

const INVENTORY_FILE = path.join(DATA_DIR, 'inventory_state.json');
const LEDGER_FILE = path.join(DATA_DIR, 'inventory_ledger.json');
const LOCK_FILE = path.join(DATA_DIR, 'inventory.lock');
const OUTBOX_FILE = path.join(DATA_DIR, 'inventory_outbox.json');

let dbPool = null;
let isDbConnected = false;

// Default In-Memory Storage Cache
let inventoryState = {
  centralWarehouse: [],    // Central warehouse physical packs
  storePacks: [],          // Authoritative store packs (lottery_pack_inventory)
  discrepancies: [],       // Reconciliation discrepancy records
  transfers: [],           // Store-to-store transfers
  reconciliations: []      // Shift reconciliations
};

let transactionLedger = []; // Append-only immutable ledger
let outboxQueue = [];       // Durable outbox queue for POS sales & retries

// ============================================================================
// CONCURRENCY & ATOMIC PERSISTENCE STRATEGY
// ============================================================================

let heartbeatTimer = null;

function startLockHeartbeat() {
  stopLockHeartbeat();
  heartbeatTimer = setInterval(() => {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const now = new Date();
        fs.utimesSync(LOCK_FILE, now, now);
      }
    } catch (_) {}
  }, 1000);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

function stopLockHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// Inter-process file locking for JSON fallback with PID liveness check & heartbeat
function acquireFileLock(maxRetries = 200, delayMs = 25) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
      fs.closeSync(fd);
      return true;
    } catch (e) {
      try {
        if (fs.existsSync(LOCK_FILE)) {
          const stats = fs.statSync(LOCK_FILE);
          // Only evaluate staleness if lock is older than 5000ms
          if (Date.now() - stats.mtimeMs > 5000) {
            let lockPid = null;
            try {
              const content = fs.readFileSync(LOCK_FILE, 'utf8');
              lockPid = parseInt(content.split('\n')[0], 10);
            } catch (_) {}

            let isPidAlive = false;
            if (lockPid && !isNaN(lockPid)) {
              try {
                process.kill(lockPid, 0); // Check if process is alive
                isPidAlive = true;
              } catch (killErr) {
                if (killErr.code === 'ESRCH') {
                  isPidAlive = false; // Process is dead/crashed
                } else {
                  isPidAlive = true; // Permission error means process is alive
                }
              }
            }

            // CRITICAL: NEVER break a lock if the process is still running!
            // Only unlink if the process is confirmed dead!
            if (!isPidAlive) {
              try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
            }
          }
        }
      } catch (_) {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
  return false;
}

function releaseFileLock() {
  stopLockHeartbeat();
  try {
    if (fs.existsSync(LOCK_FILE)) {
      // Verify we own the lock before unlinking
      try {
        const content = fs.readFileSync(LOCK_FILE, 'utf8');
        const lockPid = parseInt(content.split('\n')[0], 10);
        if (lockPid === process.pid) {
          fs.unlinkSync(LOCK_FILE);
        }
      } catch (_) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch (_) {}
}

// Atomic file write using temporary file + rename with Windows retry and fallback
function atomicWriteFileSync(filePath, content) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    let replaced = false;
    for (let i = 0; i < 15; i++) {
      try {
        fs.renameSync(tmpPath, filePath);
        replaced = true;
        break;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
          // Micro-sleep to allow Windows file locks / OneDrive sync to release
          const waitTill = Date.now() + 15;
          while (Date.now() < waitTill) {}
        } else {
          throw err;
        }
      }
    }
    if (!replaced) {
      // Windows / OneDrive fallback: copyFileSync directly overwrites destination safely
      fs.copyFileSync(tmpPath, filePath);
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    throw err;
  }
}

// In-process sequential queue with re-entrant support to prevent event loop race conditions
let mutexQueue = Promise.resolve();
export function withInventoryLock(fn) {
  if (lockStorage.getStore()) {
    return fn();
  }

  const execute = async () => {
    return lockStorage.run(true, async () => {
      const gotLock = acquireFileLock();
      if (gotLock) startLockHeartbeat();
      try {
        // Reload latest state from disk after acquiring lock to guarantee zero lost updates across processes
        loadFromDisk();
        return await fn();
      } finally {
        stopLockHeartbeat();
        if (gotLock) releaseFileLock();
      }
    });
  };
  const next = mutexQueue.then(execute, execute);
  mutexQueue = next;
  return next;
}

// Production safety verification: Prevents silent unsafe file fallback in production
export function assertProductionSafety() {
  if (process.env.NODE_ENV === 'production' && !isDbConnected && process.env.ALLOW_UNSAFE_FILE_STORAGE !== 'true') {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Database connection (DATABASE_URL or DB_*) is required in production mode. ' +
      'Silently falling back to shared JSON files is unsafe in multi-node production clusters. ' +
      'To allow single-node file storage for staging/local development, set ALLOW_UNSAFE_FILE_STORAGE=true.'
    );
  }
}

// Helper: Generate Unique ID
function generateId(prefix = 'inv') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Helper: Normalize pack number
export function cleanPackNum(p) {
  if (!p) return '';
  return String(p).trim().replace(/^0+/, '') || String(p).trim();
}

// Load State from JSON disk
function loadFromDisk() {
  try {
    if (fs.existsSync(INVENTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'));
      inventoryState = {
        centralWarehouse: Array.isArray(data.centralWarehouse) ? data.centralWarehouse : [],
        storePacks: Array.isArray(data.storePacks) ? data.storePacks : [],
        discrepancies: Array.isArray(data.discrepancies) ? data.discrepancies : [],
        transfers: Array.isArray(data.transfers) ? data.transfers : [],
        reconciliations: Array.isArray(data.reconciliations) ? data.reconciliations : []
      };
    }
    if (fs.existsSync(LEDGER_FILE)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
      transactionLedger = Array.isArray(ledger) ? ledger : [];
    }
    if (fs.existsSync(OUTBOX_FILE)) {
      const ob = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf8'));
      outboxQueue = Array.isArray(ob) ? ob : [];
    }
  } catch (err) {
    console.warn('⚠️ Warning loading inventory state from disk:', err.message);
  }
}

// Save State to JSON disk using atomic writes
function persistToDisk() {
  try {
    atomicWriteFileSync(INVENTORY_FILE, JSON.stringify(inventoryState, null, 2));
    atomicWriteFileSync(LEDGER_FILE, JSON.stringify(transactionLedger, null, 2));
    atomicWriteFileSync(OUTBOX_FILE, JSON.stringify(outboxQueue, null, 2));
  } catch (err) {
    console.warn('⚠️ Warning persisting inventory state to disk:', err.message);
  }
}

// Initialize on load
loadFromDisk();

// Initialize DB pool reference
export function initInventoryService(pool, connected = false) {
  dbPool = pool;
  isDbConnected = connected;
  console.log(`📦 [InventoryService] Initialized with DB connected: ${isDbConnected}`);
  if (process.env.NODE_ENV === 'production' && !isDbConnected) {
    console.warn('⚠️ [INVENTORY WARNING] Running in production mode without database connection. File fallback active with atomic locks.');
  }
}

// Reset state (useful for test isolation)
export function resetInventoryForTesting() {
  inventoryState = {
    centralWarehouse: [],
    storePacks: [],
    discrepancies: [],
    transfers: [],
    reconciliations: []
  };
  transactionLedger = [];
  outboxQueue = [];
  persistToDisk();
}

// ============================================================================
// 1. APPEND-ONLY TRANSACTION LEDGER
// ============================================================================

export async function appendLedgerEntry(entry) {
  const transaction = {
    transaction_id: entry.transaction_id || generateId('tx'),
    pack_id: String(entry.pack_id || ''),
    game_id: String(entry.game_id || ''),
    store_id: entry.store_id || null,
    previous_status: entry.previous_status || null,
    new_status: entry.new_status,
    previous_location: entry.previous_location || null,
    new_location: entry.new_location,
    previous_position: entry.previous_position !== undefined ? entry.previous_position : null,
    new_position: entry.new_position !== undefined ? entry.new_position : null,
    quantity_before: Number(entry.quantity_before) || 0,
    quantity_changed: Number(entry.quantity_changed) || 0,
    quantity_after: Number(entry.quantity_after) || 0,
    transaction_type: entry.transaction_type,
    source_ref_id: entry.source_ref_id || null,
    user_id: entry.user_id || 'system',
    reason: entry.reason || '',
    timestamp: new Date().toISOString()
  };

  transactionLedger.push(transaction);

  if (isDbConnected && dbPool) {
    try {
      await dbPool.query(
        `INSERT INTO inventory_transactions 
         (transaction_id, pack_id, game_id, store_id, previous_status, new_status, 
          previous_location, new_location, previous_position, new_position, 
          quantity_before, quantity_changed, quantity_after, transaction_type, 
          source_ref_id, user_id, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.transaction_id, transaction.pack_id, transaction.game_id, transaction.store_id,
          transaction.previous_status, transaction.new_status, transaction.previous_location, transaction.new_location,
          transaction.previous_position, transaction.new_position, transaction.quantity_before,
          transaction.quantity_changed, transaction.quantity_after, transaction.transaction_type,
          transaction.source_ref_id, transaction.user_id, transaction.reason
        ]
      );
    } catch (dbErr) {
      console.warn('MySQL ledger append warning:', dbErr.message);
    }
  }

  persistToDisk();
  return transaction;
}

export function getInventoryLedger(filters = {}) {
  loadFromDisk();
  let list = [...transactionLedger];
  if (filters.storeId) {
    list = list.filter(t => t.store_id === filters.storeId);
  }
  if (filters.packId) {
    list = list.filter(t => t.pack_id === filters.packId);
  }
  if (filters.gameId) {
    list = list.filter(t => t.game_id === filters.gameId);
  }
  if (filters.transactionType) {
    list = list.filter(t => t.transaction_type === filters.transactionType);
  }
  return list;
}

// ============================================================================
// 2. CENTRAL WAREHOUSE INVENTORY
// ============================================================================

export async function intakeWarehousePack({
  gameId,
  gameName,
  packNumber,
  barcode = null,
  ticketPrice = 1.00,
  packSize = 100,
  startTicket = 0,
  endTicket = null,
  intakeUser = 'warehouse_admin'
}) {
  return withInventoryLock(async () => {
    const cleanPack = String(packNumber).trim();
    if (!cleanPack || !gameId) {
      throw new Error('Game ID and Pack Number are required for warehouse intake.');
    }

    // Prevent duplicate physical pack in warehouse
    const exists = inventoryState.centralWarehouse.find(
      p => p.game_id === String(gameId) && cleanPackNum(p.pack_number) === cleanPackNum(cleanPack)
    );
    if (exists) {
      throw new Error(`Pack #${cleanPack} for Game #${gameId} already exists in Central Warehouse.`);
    }

    const size = Number(packSize) || 100;
    const start = startTicket !== undefined && startTicket !== null ? Number(startTicket) : 0;
    const end = endTicket !== undefined && endTicket !== null ? Number(endTicket) : (start + size - 1);
    const packId = `pack_${gameId}_${cleanPack}`;

    const warehousePack = {
      id: generateId('cwp'),
      pack_id: packId,
      game_id: String(gameId),
      game_name: gameName || `Game #${gameId}`,
      pack_number: cleanPack,
      barcode: barcode || `${gameId}${cleanPack}0000`,
      ticket_price: Number(ticketPrice) || 1.00,
      pack_size: size,
      start_ticket: start,
      end_ticket: end,
      status: 'AVAILABLE', // AVAILABLE, RESERVED, DISPATCHED, RECEIVED_BY_STORE, RETURNED
      reserved_store_id: null,
      allocation_reference: null,
      dispatched_at: null,
      received_at: null,
      created_at: new Date().toISOString()
    };

    inventoryState.centralWarehouse.push(warehousePack);

    await appendLedgerEntry({
      pack_id: packId,
      game_id: String(gameId),
      store_id: null,
      previous_status: null,
      new_status: 'AVAILABLE',
      previous_location: null,
      new_location: 'CENTRAL_WAREHOUSE',
      previous_position: start,
      new_position: start,
      quantity_before: 0,
      quantity_changed: size,
      quantity_after: size,
      transaction_type: 'PACK_RECEIVED',
      user_id: intakeUser,
      reason: `Intake of new physical pack #${cleanPack} into central warehouse`
    });

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `INSERT INTO central_warehouse_inventory
           (pack_id, game_id, game_name, pack_number, barcode, ticket_price, pack_size, start_ticket, end_ticket, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
          [warehousePack.pack_id, warehousePack.game_id, warehousePack.game_name, warehousePack.pack_number,
           warehousePack.barcode, warehousePack.ticket_price, warehousePack.pack_size, warehousePack.start_ticket,
           warehousePack.end_ticket]
        );
      } catch (dbErr) {
        console.warn('MySQL warehouse pack insert warning:', dbErr.message);
      }
    }

    persistToDisk();
    return warehousePack;
  });
}

export function getWarehouseInventory(filters = {}) {
  loadFromDisk();
  let list = [...inventoryState.centralWarehouse];
  if (filters.gameId) {
    list = list.filter(p => p.game_id === String(filters.gameId));
  }
  if (filters.status) {
    list = list.filter(p => p.status === filters.status);
  }
  return list;
}

export function getWarehouseSummary() {
  loadFromDisk();
  const totalPacks = inventoryState.centralWarehouse.length;
  const availablePacks = inventoryState.centralWarehouse.filter(p => p.status === 'AVAILABLE').length;
  const reservedPacks = inventoryState.centralWarehouse.filter(p => p.status === 'RESERVED').length;
  const dispatchedPacks = inventoryState.centralWarehouse.filter(p => p.status === 'DISPATCHED').length;
  const returnedPacks = inventoryState.centralWarehouse.filter(p => p.status === 'RETURNED').length;

  const unopenedTicketCapacity = inventoryState.centralWarehouse
    .filter(p => p.status === 'AVAILABLE' || p.status === 'RESERVED')
    .reduce((sum, p) => sum + (p.pack_size || 0), 0);

  return {
    totalPhysicalPacks: totalPacks,
    availablePacks,
    reservedPacks,
    dispatchedPacks,
    returnedPacks,
    unopenedTicketCapacity
  };
}

// ============================================================================
// 3. STORE REQUEST & ALLOCATION WORKFLOW
// ============================================================================

export async function allocatePacksFromWarehouse({
  allocationReference,
  storeId,
  storeName,
  gameId,
  requestedQuantity = 1,
  packNumbers = [],
  allocatedBy = 'admin'
}) {
  return withInventoryLock(async () => {
    if (!storeId || !gameId) {
      throw new Error('Store ID and Game ID are required for allocation.');
    }

    let availableWarehousePacks = inventoryState.centralWarehouse.filter(
      p => p.game_id === String(gameId) && p.status === 'AVAILABLE'
    );

    if (Array.isArray(packNumbers) && packNumbers.length > 0) {
      const cleanNumbers = packNumbers.map(cleanPackNum);
      availableWarehousePacks = availableWarehousePacks.filter(p => cleanNumbers.includes(cleanPackNum(p.pack_number)));
    }

    const requestedCount = Number(requestedQuantity) || 1;
    const allocRef = allocationReference || `ALC-${Date.now().toString().slice(-6)}`;

    // Partial allocation: allocate available without exceeding warehouse inventory
    const countToAllocate = Math.min(requestedCount, availableWarehousePacks.length);
    const packsToDispatch = availableWarehousePacks.slice(0, countToAllocate);
    const outstandingCount = Math.max(0, requestedCount - countToAllocate);

    const allocatedPacks = [];

    for (const pack of packsToDispatch) {
      pack.status = 'DISPATCHED';
      pack.reserved_store_id = storeId;
      pack.allocation_reference = allocRef;
      pack.dispatched_at = new Date().toISOString();

      await appendLedgerEntry({
        pack_id: pack.pack_id,
        game_id: pack.game_id,
        store_id: storeId,
        previous_status: 'AVAILABLE',
        new_status: 'DISPATCHED',
        previous_location: 'CENTRAL_WAREHOUSE',
        new_location: 'IN_TRANSIT',
        previous_position: pack.start_ticket,
        new_position: pack.start_ticket,
        quantity_before: pack.pack_size,
        quantity_changed: 0,
        quantity_after: pack.pack_size,
        transaction_type: 'PACK_DISPATCHED',
        source_ref_id: allocRef,
        user_id: allocatedBy,
        reason: `Allocated & dispatched pack #${pack.pack_number} to ${storeName || storeId}`
      });

      allocatedPacks.push(pack);
    }

    persistToDisk();

    return {
      success: true,
      allocationReference: allocRef,
      storeId,
      gameId,
      requestedCount,
      allocatedCount: countToAllocate,
      outstandingCount,
      allocatedPacks
    };
  });
}

// ============================================================================
// 4. STORE RECEIPT CONFIRMATION & PHYSICAL PACK IDENTITY
// ============================================================================

export async function confirmStoreReceipt({
  storeId,
  packNumber,
  packId = null,
  gameId = null,
  receivedBy = 'cashier'
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required to confirm store receipt.');
    }

    const cleanNum = cleanPackNum(packNumber);

    // Locate warehouse pack if present
    const warehousePack = inventoryState.centralWarehouse.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    const effectiveGameId = String(warehousePack ? warehousePack.game_id : (gameId || '1001'));
    const authoritativePackId = `pack_${effectiveGameId}_${cleanNum}`;
    const actualPackNumber = warehousePack ? warehousePack.pack_number : String(packNumber).trim();
    const packSize = warehousePack ? warehousePack.pack_size : 100;
    const ticketPrice = warehousePack ? warehousePack.ticket_price : 1.00;
    const startTicket = warehousePack ? warehousePack.start_ticket : 0;
    const endTicket = warehousePack ? warehousePack.end_ticket : (startTicket + packSize - 1);
    const gameName = warehousePack ? warehousePack.game_name : `Game #${effectiveGameId}`;

    // PHYSICAL PACK IDENTITY ENFORCEMENT:
    // Check if a pack with the same (game_id, pack_number) already exists in ANY store!
    const existingPackInSystem = inventoryState.storePacks.find(
      p => p.game_id === effectiveGameId && cleanPackNum(p.pack_number) === cleanNum
    );

    if (existingPackInSystem) {
      // If already belongs to this store
      if (existingPackInSystem.store_id === storeId) {
        if (existingPackInSystem.physical_location === 'IN_TRANSIT') {
          // Store completing receipt after transfer
          existingPackInSystem.physical_location = 'STORE';
          existingPackInSystem.lifecycle_status = 'UNACTIVATED';
          existingPackInSystem.updated_at = new Date().toISOString();
          persistToDisk();
          return { success: true, transferred: true, pack: existingPackInSystem };
        }
        return {
          success: true,
          alreadyReceived: true,
          message: `Pack #${actualPackNumber} is already received in store inventory.`,
          pack: existingPackInSystem
        };
      }

      // If registered to another store and NOT in transit to this store: REJECT!
      if (existingPackInSystem.physical_location !== 'IN_TRANSIT') {
        throw new Error(
          `Conflict: Physical pack #${actualPackNumber} for Game #${effectiveGameId} already belongs to store "${existingPackInSystem.store_id}". The same physical pack cannot exist in two stores simultaneously.`
        );
      }
    }

    // Create authoritative Store Pack Record
    const storePack = {
      id: generateId('spk'),
      pack_id: authoritativePackId,
      store_id: storeId,
      game_id: effectiveGameId,
      game_name: gameName,
      pack_number: actualPackNumber,
      barcode: warehousePack ? warehousePack.barcode : `${effectiveGameId}${actualPackNumber}0000`,
      ticket_price: ticketPrice,
      total_tickets: packSize,
      start_ticket: startTicket,
      end_ticket: endTicket,
      next_ticket_to_sell: startTicket,
      remaining_tickets: packSize,
      tickets_sold: 0,
      lifecycle_status: 'UNACTIVATED',
      physical_location: 'STORE',
      box_number: null,
      activated_at: null,
      activated_by: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inventoryState.storePacks.push(storePack);

    if (warehousePack) {
      warehousePack.status = 'RECEIVED_BY_STORE';
      warehousePack.received_at = new Date().toISOString();
    }

    await appendLedgerEntry({
      pack_id: storePack.pack_id,
      game_id: storePack.game_id,
      store_id: storeId,
      previous_status: warehousePack ? 'DISPATCHED' : null,
      new_status: 'UNACTIVATED',
      previous_location: 'IN_TRANSIT',
      new_location: 'STORE',
      previous_position: startTicket,
      new_position: startTicket,
      quantity_before: packSize,
      quantity_changed: 0,
      quantity_after: packSize,
      transaction_type: 'PACK_RECEIVED_BY_STORE',
      user_id: receivedBy,
      reason: `Store confirmed receipt of physical pack #${actualPackNumber} (${packSize} unopened tickets)`
    });

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `INSERT INTO lottery_pack_inventory
           (pack_id, store_id, game_id, game_name, pack_number, barcode, ticket_price, total_tickets,
            start_ticket, end_ticket, next_ticket_to_sell, remaining_tickets, tickets_sold,
            lifecycle_status, physical_location)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'UNACTIVATED', 'STORE')
           ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
          [storePack.pack_id, storePack.store_id, storePack.game_id, storePack.game_name, storePack.pack_number,
           storePack.barcode, storePack.ticket_price, storePack.total_tickets, storePack.start_ticket,
           storePack.end_ticket, storePack.next_ticket_to_sell, storePack.remaining_tickets]
        );
      } catch (dbErr) {
        console.warn('MySQL store pack insert warning:', dbErr.message);
      }
    }

    persistToDisk();
    return { success: true, pack: storePack };
  });
}

// ============================================================================
// 5. PACK ACTIVATION LOGIC
// ============================================================================

export async function activatePack({
  storeId,
  packNumber,
  packId = null,
  boxNumber = null,
  activatedBy = 'cashier'
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required for activation.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found in store inventory. Must be received first.`);
    }

    if (pack.store_id !== storeId) {
      throw new Error(`Access Denied: Pack #${packNumber} belongs to another store.`);
    }

    if (pack.lifecycle_status === 'ACTIVE') {
      throw new Error(`Pack #${pack.pack_number} is already active.`);
    }
    if (pack.lifecycle_status === 'DEPLETED') {
      throw new Error(`Pack #${pack.pack_number} is completed/depleted and cannot be activated.`);
    }
    if (pack.lifecycle_status === 'DISCONTINUED') {
      throw new Error(`Pack #${pack.pack_number} is discontinued and cannot be activated.`);
    }

    const previousStatus = pack.lifecycle_status;
    pack.lifecycle_status = 'ACTIVE';
    pack.box_number = boxNumber !== null && boxNumber !== undefined ? Number(boxNumber) : pack.box_number;
    pack.activated_at = new Date().toISOString();
    pack.activated_by = activatedBy;
    pack.updated_at = new Date().toISOString();

    // Activating a pack does NOT deduct tickets or create duplicates!
    pack.remaining_tickets = pack.total_tickets;
    pack.tickets_sold = 0;
    pack.next_ticket_to_sell = pack.start_ticket;

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: storeId,
      previous_status: previousStatus,
      new_status: 'ACTIVE',
      previous_location: 'STORE',
      new_location: 'STORE',
      previous_position: pack.start_ticket,
      new_position: pack.start_ticket,
      quantity_before: pack.total_tickets,
      quantity_changed: 0,
      quantity_after: pack.total_tickets,
      transaction_type: 'PACK_ACTIVATED',
      user_id: activatedBy,
      reason: `Activated pack #${pack.pack_number} in Box ${pack.box_number || 'unassigned'} (Remaining: ${pack.remaining_tickets}, Sold: 0)`
    });

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `UPDATE lottery_pack_inventory
           SET lifecycle_status = 'ACTIVE', box_number = ?, activated_at = NOW(), activated_by = ?,
               remaining_tickets = total_tickets, tickets_sold = 0, next_ticket_to_sell = start_ticket
           WHERE pack_id = ? AND store_id = ?`,
          [pack.box_number, activatedBy, pack.pack_id, storeId]
        );
      } catch (dbErr) {
        console.warn('MySQL pack activation update warning:', dbErr.message);
      }
    }

    persistToDisk();
    return { success: true, pack };
  });
}

// ============================================================================
// 6. ATOMIC TICKET SALES & QUANTITY DEDUCTION
// ============================================================================

export async function recordTicketSale({
  storeId,
  packNumber,
  packId = null,
  quantity = 1,
  sourceRefId = null,
  cashier = 'master',
  barcode = null
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required for sale.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found.`);
    }

    if (pack.store_id !== storeId) {
      throw new Error(`Access Denied: Pack does not belong to store "${storeId}".`);
    }

    if (pack.lifecycle_status !== 'ACTIVE') {
      throw new Error(`Cannot sell tickets: Pack #${pack.pack_number} is ${pack.lifecycle_status}.`);
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Invalid sale quantity: ${quantity}`);
    }

    // Idempotency Check: Prevent duplicate deductions if same transaction event submitted twice
    if (sourceRefId) {
      const existingTx = transactionLedger.find(
        t => t.source_ref_id === sourceRefId && t.pack_id === pack.pack_id && t.transaction_type === 'TICKET_SOLD'
      );
      if (existingTx) {
        return {
          success: true,
          duplicate: true,
          message: 'Duplicate sales transaction detected. Already processed.',
          pack,
          ticketsSold: 0,
          remainingTickets: pack.remaining_tickets,
          nextTicketToSell: pack.next_ticket_to_sell
        };
      }
    }

    // Overselling protection: Never sell more tickets than remain
    if (pack.remaining_tickets < qty) {
      throw new Error(`Insufficient tickets remaining in pack #${pack.pack_number}. Overselling prevented. (Remaining: ${pack.remaining_tickets}, Requested: ${qty})`);
    }

    const prevPosition = pack.next_ticket_to_sell;
    const prevRemaining = pack.remaining_tickets;

    // Advance position and update stock atomically
    pack.next_ticket_to_sell += qty;
    pack.remaining_tickets -= qty;
    pack.tickets_sold += qty;
    pack.updated_at = new Date().toISOString();

    let completed = false;
    if (pack.remaining_tickets === 0) {
      pack.lifecycle_status = 'DEPLETED';
      pack.completed_at = new Date().toISOString();
      completed = true;
    }

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: storeId,
      previous_status: 'ACTIVE',
      new_status: completed ? 'DEPLETED' : 'ACTIVE',
      previous_location: 'STORE',
      new_location: 'STORE',
      previous_position: prevPosition,
      new_position: pack.next_ticket_to_sell,
      quantity_before: prevRemaining,
      quantity_changed: -qty,
      quantity_after: pack.remaining_tickets,
      transaction_type: 'TICKET_SOLD',
      source_ref_id: sourceRefId,
      user_id: cashier,
      reason: `Sold ${qty} ticket(s) (Position: ${prevPosition} -> ${pack.next_ticket_to_sell})`
    });

    if (completed) {
      await appendLedgerEntry({
        pack_id: pack.pack_id,
        game_id: pack.game_id,
        store_id: storeId,
        previous_status: 'ACTIVE',
        new_status: 'DEPLETED',
        previous_location: 'STORE',
        new_location: 'STORE',
        previous_position: pack.next_ticket_to_sell,
        new_position: pack.next_ticket_to_sell,
        quantity_before: 0,
        quantity_changed: 0,
        quantity_after: 0,
        transaction_type: 'PACK_COMPLETED',
        source_ref_id: sourceRefId,
        user_id: cashier,
        reason: `Pack #${pack.pack_number} depleted. All ${pack.total_tickets} tickets sold.`
      });
    }

    if (isDbConnected && dbPool) {
      try {
        await dbPool.query(
          `UPDATE lottery_pack_inventory
           SET next_ticket_to_sell = ?, remaining_tickets = ?, tickets_sold = ?,
               lifecycle_status = ?, completed_at = ?
           WHERE pack_id = ? AND store_id = ?`,
          [pack.next_ticket_to_sell, pack.remaining_tickets, pack.tickets_sold,
           pack.lifecycle_status, pack.completed_at || null, pack.pack_id, storeId]
        );
      } catch (dbErr) {
        console.warn('MySQL sale update warning:', dbErr.message);
      }
    }

    persistToDisk();

    return {
      success: true,
      pack,
      ticketsSold: qty,
      remainingTickets: pack.remaining_tickets,
      nextTicketToSell: pack.next_ticket_to_sell,
      isCompleted: completed
    };
  });
}

// ============================================================================
// 7. SHIFT RECONCILIATION FORMULA & ACCURACY
// Formula: Expected Closing Position = Opening Position + POS Tickets Sold
// ============================================================================

export async function reconcileShift({
  storeId,
  shiftId,
  closingScans = [], // Array of { packNumber, closingPosition, barcode }
  closedBy = 'cashier',
  posLoggedSalesByPack = {}, // { [packNumber]: soldCount }
  openingPositionsByPack = {} // Optional { [packNumber]: openingPosition }
}) {
  return withInventoryLock(async () => {
    if (!storeId || !shiftId) {
      throw new Error('Store ID and Shift ID are required for reconciliation.');
    }

    // Idempotency: Duplicate shift close check
    const existingReconciliation = inventoryState.reconciliations.find(
      r => r.shift_id === shiftId && r.store_id === storeId
    );
    if (existingReconciliation) {
      return {
        success: true,
        duplicate: true,
        message: `Shift #${shiftId} has already been reconciled. Returning original record.`,
        reconciliation: existingReconciliation
      };
    }

    const activePacks = inventoryState.storePacks.filter(
      p => p.store_id === storeId && p.lifecycle_status === 'ACTIVE'
    );

    const results = [];
    const discrepancies = [];
    let totalShiftSales = 0;

    for (const pack of activePacks) {
      const scan = closingScans.find(s => cleanPackNum(s.packNumber) === cleanPackNum(pack.pack_number));

      // Determine if shift uses POS-logged sales comparison (Method A) or Scan-derived sales (Method B)
      const hasPosRecordedSales = posLoggedSalesByPack && (posLoggedSalesByPack[pack.pack_number] !== undefined);
      const posSold = hasPosRecordedSales ? Number(posLoggedSalesByPack[pack.pack_number]) : null;

      // Opening next-ticket position for this shift
      const openingPos = (openingPositionsByPack[pack.pack_number] !== undefined && openingPositionsByPack[pack.pack_number] !== null)
        ? Number(openingPositionsByPack[pack.pack_number])
        : (pack.next_ticket_to_sell - (posSold || 0));

      const expectedClosingPos = hasPosRecordedSales ? (openingPos + posSold) : openingPos;

      if (!scan) {
        // Missing pack scan: flag as discrepancy, DO NOT mark empty or delete!
        const disc = {
          discrepancy_id: generateId('disc'),
          pack_id: pack.pack_id,
          pack_number: pack.pack_number,
          store_id: storeId,
          shift_id: shiftId,
          opening_position: openingPos,
          expected_position: expectedClosingPos,
          scanned_position: null,
          difference: 0,
          discrepancy_type: 'PACK_NOT_SCANNED',
          reason: `Active pack #${pack.pack_number} was not scanned at shift close. Position preserved.`,
          status: 'OPEN',
          created_at: new Date().toISOString()
        };
        inventoryState.discrepancies.push(disc);
        discrepancies.push(disc);

        results.push({
          packNumber: pack.pack_number,
          openingPosition: openingPos,
          posSold: posSold || 0,
          expectedClosingPosition: expectedClosingPos,
          closingPosition: null,
          difference: 0,
          reconciled: false,
          discrepancyType: 'PACK_NOT_SCANNED',
          remainingTickets: pack.remaining_tickets,
          status: pack.lifecycle_status
        });
        continue;
      }

      const closingPos = parseInt(scan.closingPosition, 10);

      // Validate closing position is not earlier than opening position
      if (isNaN(closingPos) || closingPos < openingPos) {
        const disc = {
          discrepancy_id: generateId('disc'),
          pack_id: pack.pack_id,
          pack_number: pack.pack_number,
          store_id: storeId,
          shift_id: shiftId,
          opening_position: openingPos,
          expected_position: expectedClosingPos,
          scanned_position: isNaN(closingPos) ? null : closingPos,
          difference: isNaN(closingPos) ? 0 : (closingPos - openingPos),
          discrepancy_type: 'CLOSING_BEFORE_OPENING',
          reason: `Invalid position: Closing position (${closingPos}) is earlier than opening position (${openingPos}). Automatic deduction blocked.`,
          status: 'OPEN',
          created_at: new Date().toISOString()
        };
        inventoryState.discrepancies.push(disc);
        discrepancies.push(disc);

        results.push({
          packNumber: pack.pack_number,
          openingPosition: openingPos,
          posSold: posSold || 0,
          expectedClosingPosition: expectedClosingPos,
          closingPosition: closingPos,
          difference: closingPos - expectedClosingPos,
          reconciled: false,
          discrepancyType: 'CLOSING_BEFORE_OPENING',
          remainingTickets: pack.remaining_tickets,
          status: pack.lifecycle_status
        });
        continue;
      }

      // Validate position does not exceed pack boundary
      const maxAllowedPos = pack.end_ticket + 1;
      if (closingPos > maxAllowedPos) {
        const disc = {
          discrepancy_id: generateId('disc'),
          pack_id: pack.pack_id,
          pack_number: pack.pack_number,
          store_id: storeId,
          shift_id: shiftId,
          opening_position: openingPos,
          expected_position: expectedClosingPos,
          scanned_position: closingPos,
          difference: closingPos - maxAllowedPos,
          discrepancy_type: 'POSITION_EXCEEDS_PACK',
          reason: `Closing position (${closingPos}) exceeds maximum pack ticket boundary (${maxAllowedPos}).`,
          status: 'OPEN',
          created_at: new Date().toISOString()
        };
        inventoryState.discrepancies.push(disc);
        discrepancies.push(disc);

        results.push({
          packNumber: pack.pack_number,
          openingPosition: openingPos,
          posSold: posSold || 0,
          expectedClosingPosition: expectedClosingPos,
          closingPosition: closingPos,
          difference: closingPos - expectedClosingPos,
          reconciled: false,
          discrepancyType: 'POSITION_EXCEEDS_PACK',
          remainingTickets: pack.remaining_tickets,
          status: pack.lifecycle_status
        });
        continue;
      }

      if (hasPosRecordedSales) {
        // Method A: Compare expected closing position with physically scanned position
        const expectedClosingPos = openingPos + posSold;

        if (closingPos === expectedClosingPos) {
          // Reconciled successfully! POS already deducted during sales -> 0 additional deduction
          results.push({
            packNumber: pack.pack_number,
            openingPosition: openingPos,
            posSold,
            expectedClosingPosition: expectedClosingPos,
            closingPosition: closingPos,
            difference: 0,
            reconciled: true,
            remainingTickets: pack.remaining_tickets,
            status: pack.lifecycle_status
          });
        } else {
          // Mismatch! e.g. Expected 61, Scan 60.
          // Flag discrepancy. DO NOT deduct another ticket or overwrite either record!
          const diff = closingPos - expectedClosingPos;
          const disc = {
            discrepancy_id: generateId('disc'),
            pack_id: pack.pack_id,
            pack_number: pack.pack_number,
            store_id: storeId,
            shift_id: shiftId,
            opening_position: openingPos,
            pos_sold: posSold,
            expected_position: expectedClosingPos,
            scanned_position: closingPos,
            difference: diff,
            discrepancy_type: 'RECONCILIATION_MISMATCH',
            reason: `Position mismatch: Expected closing position ${expectedClosingPos} (opening ${openingPos} + POS sold ${posSold}), but physically scanned ${closingPos}. Discrepancy of ${diff} ticket(s). Records preserved without automatic deduction.`,
            status: 'OPEN',
            created_at: new Date().toISOString()
          };
          inventoryState.discrepancies.push(disc);
          discrepancies.push(disc);

          results.push({
            packNumber: pack.pack_number,
            openingPosition: openingPos,
            posSold,
            expectedClosingPosition: expectedClosingPos,
            closingPosition: closingPos,
            difference: diff,
            reconciled: false,
            discrepancyType: 'RECONCILIATION_MISMATCH',
            discrepancyId: disc.discrepancy_id,
            remainingTickets: pack.remaining_tickets,
            status: pack.lifecycle_status
          });
        }
      } else {
        // Method B: Shift sales derived from physical opening & closing positions
        const shiftSold = closingPos - openingPos;
        if (shiftSold > pack.remaining_tickets) {
          const disc = {
            discrepancy_id: generateId('disc'),
            pack_id: pack.pack_id,
            pack_number: pack.pack_number,
            store_id: storeId,
            shift_id: shiftId,
            opening_position: openingPos,
            expected_position: openingPos,
            scanned_position: closingPos,
            difference: shiftSold - pack.remaining_tickets,
            discrepancy_type: 'OVERSELL_DISCREPANCY',
            reason: `Calculated shift sale (${shiftSold}) exceeds remaining tickets (${pack.remaining_tickets}).`,
            status: 'OPEN',
            created_at: new Date().toISOString()
          };
          inventoryState.discrepancies.push(disc);
          discrepancies.push(disc);
        } else {
          pack.next_ticket_to_sell = closingPos;
          pack.remaining_tickets -= shiftSold;
          pack.tickets_sold += shiftSold;
          totalShiftSales += shiftSold;

          if (pack.remaining_tickets === 0) {
            pack.lifecycle_status = 'DEPLETED';
            pack.completed_at = new Date().toISOString();
          }

          await appendLedgerEntry({
            pack_id: pack.pack_id,
            game_id: pack.game_id,
            store_id: storeId,
            previous_status: 'ACTIVE',
            new_status: pack.lifecycle_status,
            previous_location: 'STORE',
            new_location: 'STORE',
            previous_position: openingPos,
            new_position: closingPos,
            quantity_before: pack.remaining_tickets + shiftSold,
            quantity_changed: -shiftSold,
            quantity_after: pack.remaining_tickets,
            transaction_type: 'SHIFT_RECONCILIATION',
            source_ref_id: shiftId,
            user_id: closedBy,
            reason: `Shift #${shiftId} reconciliation: position ${openingPos} -> ${closingPos} (${shiftSold} tickets)`
          });

          results.push({
            packNumber: pack.pack_number,
            openingPosition: openingPos,
            closingPosition: closingPos,
            soldCount: shiftSold,
            reconciled: true,
            remainingTickets: pack.remaining_tickets,
            status: pack.lifecycle_status
          });
        }
      }
    }

    const reconciliationRecord = {
      reconciliation_id: generateId('recon'),
      shift_id: shiftId,
      store_id: storeId,
      totalShiftSales,
      discrepancyCount: discrepancies.length,
      results,
      discrepancies,
      closed_by: closedBy,
      timestamp: new Date().toISOString()
    };

    inventoryState.reconciliations.push(reconciliationRecord);
    persistToDisk();

    return {
      success: true,
      reconciliation: reconciliationRecord
    };
  });
}

// ============================================================================
// 8. MANUAL ADJUSTMENTS & INVENTORY CORRECTIONS
// ============================================================================

export async function adjustPackInventory({
  storeId,
  packNumber,
  packId = null,
  newNextTicket,
  newRemaining,
  reason,
  adjustedBy = 'admin'
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required.');
    }
    if (!reason || !String(reason).trim()) {
      throw new Error('An authorized reason is required for manual inventory adjustments.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found.`);
    }
    if (pack.store_id !== storeId) {
      throw new Error('Unauthorized store modification.');
    }

    const prevPos = pack.next_ticket_to_sell;
    const prevRemaining = pack.remaining_tickets;

    const targetNextTicket = newNextTicket !== undefined && newNextTicket !== null ? Number(newNextTicket) : prevPos;
    const targetRemaining = newRemaining !== undefined && newRemaining !== null ? Number(newRemaining) : (pack.total_tickets - (targetNextTicket - pack.start_ticket));

    if (targetRemaining < 0 || targetRemaining > pack.total_tickets) {
      throw new Error(`Invalid remaining tickets: ${targetRemaining}. Must be between 0 and ${pack.total_tickets}.`);
    }

    pack.next_ticket_to_sell = targetNextTicket;
    pack.remaining_tickets = targetRemaining;
    pack.tickets_sold = pack.total_tickets - targetRemaining;
    if (pack.remaining_tickets === 0 && pack.lifecycle_status === 'ACTIVE') {
      pack.lifecycle_status = 'DEPLETED';
      pack.completed_at = new Date().toISOString();
    }
    pack.updated_at = new Date().toISOString();

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: storeId,
      previous_status: pack.lifecycle_status,
      new_status: pack.lifecycle_status,
      previous_location: 'STORE',
      new_location: 'STORE',
      previous_position: prevPos,
      new_position: targetNextTicket,
      quantity_before: prevRemaining,
      quantity_changed: targetRemaining - prevRemaining,
      quantity_after: targetRemaining,
      transaction_type: 'INVENTORY_ADJUSTMENT',
      user_id: adjustedBy,
      reason: `Manual inventory adjustment: ${reason}`
    });

    persistToDisk();
    return { success: true, pack };
  });
}

// ============================================================================
// 9. DISCONTINUATION & RETURNS
// ============================================================================

export async function discontinuePack({
  storeId,
  packNumber,
  packId = null,
  reason,
  discontinuedBy = 'admin'
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found.`);
    }
    if (pack.store_id !== storeId) {
      throw new Error('Unauthorized store modification.');
    }

    const prevStatus = pack.lifecycle_status;
    pack.lifecycle_status = 'DISCONTINUED';
    pack.updated_at = new Date().toISOString();

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: storeId,
      previous_status: prevStatus,
      new_status: 'DISCONTINUED',
      previous_location: 'STORE',
      new_location: 'STORE',
      previous_position: pack.next_ticket_to_sell,
      new_position: pack.next_ticket_to_sell,
      quantity_before: pack.remaining_tickets,
      quantity_changed: 0,
      quantity_after: pack.remaining_tickets,
      transaction_type: 'PACK_DISCONTINUED',
      user_id: discontinuedBy,
      reason: `Pack discontinued. Remaining tickets preserved: ${pack.remaining_tickets}. Reason: ${reason || 'Lottery end of game'}`
    });

    persistToDisk();
    return { success: true, pack };
  });
}

export async function returnPackToWarehouse({
  storeId,
  packNumber,
  packId = null,
  reason,
  returnedBy = 'owner'
}) {
  return withInventoryLock(async () => {
    if (!storeId || (!packNumber && !packId)) {
      throw new Error('Store ID and Pack Identifier are required.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found.`);
    }
    if (pack.store_id !== storeId) {
      throw new Error('Unauthorized store modification.');
    }

    const prevLocation = pack.physical_location;
    pack.physical_location = 'RETURNED';
    pack.lifecycle_status = 'DISCONTINUED';
    pack.updated_at = new Date().toISOString();

    const warehousePack = inventoryState.centralWarehouse.find(
      p => cleanPackNum(p.pack_number) === cleanPackNum(pack.pack_number)
    );
    if (warehousePack) {
      warehousePack.status = 'RETURNED';
    }

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: storeId,
      previous_status: pack.lifecycle_status,
      new_status: 'DISCONTINUED',
      previous_location: prevLocation,
      new_location: 'RETURNED',
      previous_position: pack.next_ticket_to_sell,
      new_position: pack.next_ticket_to_sell,
      quantity_before: pack.remaining_tickets,
      quantity_changed: -pack.remaining_tickets,
      quantity_after: 0,
      transaction_type: 'PACK_RETURNED',
      user_id: returnedBy,
      reason: `Pack returned to warehouse. Reason: ${reason || 'Store return'}`
    });

    persistToDisk();
    return { success: true, pack };
  });
}

// ============================================================================
// 10. STORE-TO-STORE TRANSFERS (Single Physical Pack Guarantee)
// ============================================================================

export async function transferPackBetweenStores({
  fromStoreId,
  toStoreId,
  packNumber,
  packId = null,
  requestedBy = 'manager'
}) {
  return withInventoryLock(async () => {
    if (!fromStoreId || !toStoreId || (!packNumber && !packId)) {
      throw new Error('From Store, To Store, and Pack Number are required for transfer.');
    }

    const cleanNum = cleanPackNum(packNumber);
    const pack = inventoryState.storePacks.find(
      p => (packId ? p.pack_id === packId : cleanPackNum(p.pack_number) === cleanNum)
    );

    if (!pack) {
      throw new Error(`Pack #${packNumber} not found.`);
    }
    if (pack.store_id !== fromStoreId) {
      throw new Error(`Pack does not belong to store "${fromStoreId}".`);
    }

    // Update the location of the SAME physical pack record! Never create duplicates!
    const transferId = generateId('txf');
    pack.physical_location = 'IN_TRANSIT';
    pack.store_id = toStoreId;
    pack.lifecycle_status = 'UNACTIVATED';
    pack.box_number = null;
    pack.updated_at = new Date().toISOString();

    const transferRecord = {
      transfer_id: transferId,
      pack_id: pack.pack_id,
      pack_number: pack.pack_number,
      game_id: pack.game_id,
      from_store_id: fromStoreId,
      to_store_id: toStoreId,
      status: 'IN_TRANSIT',
      requested_by: requestedBy,
      created_at: new Date().toISOString()
    };

    inventoryState.transfers.push(transferRecord);

    await appendLedgerEntry({
      pack_id: pack.pack_id,
      game_id: pack.game_id,
      store_id: fromStoreId,
      previous_status: 'ACTIVE',
      new_status: 'UNACTIVATED',
      previous_location: 'STORE',
      new_location: 'IN_TRANSIT',
      previous_position: pack.next_ticket_to_sell,
      new_position: pack.next_ticket_to_sell,
      quantity_before: pack.remaining_tickets,
      quantity_changed: 0,
      quantity_after: pack.remaining_tickets,
      transaction_type: 'PACK_TRANSFERRED',
      source_ref_id: transferId,
      user_id: requestedBy,
      reason: `Transfer pack #${pack.pack_number} from ${fromStoreId} to ${toStoreId}`
    });

    persistToDisk();
    return { success: true, transfer: transferRecord, pack };
  });
}

// ============================================================================
// 11. BARCODE NORMALIZATION (NEXT_TICKET vs LAST_SOLD)
// ============================================================================

export function normalizeScannedPosition(rawInput, mode = 'NEXT_TICKET') {
  let ticketNum = null;
  let packNum = null;
  let gameNum = null;

  if (typeof rawInput === 'object' && rawInput !== null) {
    ticketNum = rawInput.ticketNumber !== undefined ? rawInput.ticketNumber : null;
    packNum = rawInput.packNumber || null;
    gameNum = rawInput.gameNumber || null;
  } else if (typeof rawInput === 'number') {
    ticketNum = rawInput;
  } else {
    const s = String(rawInput || '').trim();
    const digits = s.replace(/[^0-9]/g, '');
    if (digits.length === 14) {
      gameNum = digits.slice(0, 4);
      packNum = digits.slice(4, 10);
      ticketNum = parseInt(digits.slice(10, 13), 10);
    } else {
      const parsedNum = parseInt(digits, 10);
      if (!isNaN(parsedNum)) ticketNum = parsedNum;
    }
  }

  if (ticketNum === null || isNaN(ticketNum)) {
    return { isValid: false, normalizedNextTicket: null, raw: rawInput };
  }

  // If scanner captures LAST_TICKET_SOLD, the next ticket to sell is ticketNum + 1.
  // If scanner captures NEXT_TICKET_TO_SELL, it is ticketNum directly.
  const normalizedNextTicket = (mode === 'LAST_SOLD' || mode === 'LAST_TICKET_SOLD')
    ? (ticketNum + 1)
    : ticketNum;

  return {
    isValid: true,
    scannedTicket: ticketNum,
    normalizedNextTicket,
    mode,
    packNumber: packNum,
    gameNumber: gameNum,
    raw: rawInput
  };
}

// ============================================================================
// 12. EXISTING DATA MIGRATION ENGINE
// ============================================================================

export async function migrateExistingInventoryData({
  sourceDir = DATA_DIR,
  storeId = 'store_amigo',
  dryRun = false
} = {}) {
  const report = {
    migratedPacks: 0,
    skippedDuplicates: 0,
    flaggedIncomplete: 0,
    details: []
  };

  // 1. Read pos_state file for this store
  const posFile = path.join(sourceDir, `pos_state_${storeId}.json`);
  const legacyFile = path.join(sourceDir, 'pos_state.json');
  const targetFile = fs.existsSync(posFile) ? posFile : (fs.existsSync(legacyFile) ? legacyFile : null);

  if (!targetFile) {
    return { ...report, message: 'No legacy POS state file found to migrate.' };
  }

  try {
    const stateData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

    // Migrate Active Dispensers
    if (Array.isArray(stateData.slots)) {
      for (const slot of stateData.slots) {
        if (!slot || !slot.packNumber || slot.packNumber === '---' || slot.gameName === 'EMPTY') {
          continue;
        }

        const cleanPack = cleanPackNum(slot.packNumber);
        const gameId = String(slot.gameId || slot.barcodePrefix || '1001');

        // Prevent duplicate packs
        const alreadyExists = inventoryState.storePacks.some(
          p => p.game_id === gameId && cleanPackNum(p.pack_number) === cleanPack
        );
        if (alreadyExists) {
          report.skippedDuplicates++;
          continue;
        }

        // Validate complete records
        if (slot.currentTicket === null || slot.currentTicket === undefined || isNaN(Number(slot.currentTicket))) {
          report.flaggedIncomplete++;
          const disc = {
            discrepancy_id: generateId('disc_mig'),
            pack_id: `pack_${gameId}_${cleanPack}`,
            pack_number: cleanPack,
            store_id: storeId,
            expected_position: 0,
            scanned_position: null,
            difference: 0,
            discrepancy_type: 'INCOMPLETE_MIGRATION_RECORD',
            reason: `Legacy slot #${slot.boxNumber} has missing or NaN currentTicket. Position unverified.`,
            status: 'OPEN',
            created_at: new Date().toISOString()
          };
          if (!dryRun) inventoryState.discrepancies.push(disc);
          report.details.push({ pack: cleanPack, status: 'FLAGGED_INCOMPLETE' });
          continue;
        }

        const packSize = Number(slot.packSize) || 100;
        const currentTicket = Number(slot.currentTicket);
        const startTicket = Number(slot.startTicket) || 0;
        const endTicket = startTicket + packSize - 1;
        const ticketsSold = Math.max(0, currentTicket - startTicket);
        const remainingTickets = Math.max(0, packSize - ticketsSold);

        if (!dryRun) {
          const packId = `pack_${gameId}_${cleanPack}`;
          const packObj = {
            id: generateId('spk'),
            pack_id: packId,
            store_id: storeId,
            game_id: gameId,
            game_name: slot.gameName,
            pack_number: cleanPack,
            barcode: `${gameId}${cleanPack}0000`,
            ticket_price: Number(slot.price) || 1.00,
            total_tickets: packSize,
            start_ticket: startTicket,
            end_ticket: endTicket,
            next_ticket_to_sell: currentTicket,
            remaining_tickets: remainingTickets,
            tickets_sold: ticketsSold,
            lifecycle_status: remainingTickets === 0 ? 'DEPLETED' : 'ACTIVE',
            physical_location: 'STORE',
            box_number: slot.boxNumber,
            activated_at: new Date().toISOString(),
            activated_by: 'system_migration',
            completed_at: remainingTickets === 0 ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          inventoryState.storePacks.push(packObj);
          await appendLedgerEntry({
            pack_id: packId,
            game_id: gameId,
            store_id: storeId,
            previous_status: null,
            new_status: packObj.lifecycle_status,
            previous_location: null,
            new_location: 'STORE',
            previous_position: startTicket,
            new_position: currentTicket,
            quantity_before: packSize,
            quantity_changed: -ticketsSold,
            quantity_after: remainingTickets,
            transaction_type: 'PACK_ACTIVATED',
            user_id: 'migration',
            reason: `Migrated from active POS Box #${slot.boxNumber}`
          });
        }
        report.migratedPacks++;
        report.details.push({ pack: cleanPack, status: 'MIGRATED_ACTIVE' });
      }
    }

    // Migrate In-Stock Storage Inventory
    if (Array.isArray(stateData.inStockInventory)) {
      for (const inv of stateData.inStockInventory) {
        if (!inv || !inv.packNumber) continue;

        const cleanPack = cleanPackNum(inv.packNumber);
        const gameId = String(inv.gameNumber ? String(inv.gameNumber).replace(/[^0-9]/g, '') : '1001') || '1001';

        const alreadyExists = inventoryState.storePacks.some(
          p => p.game_id === gameId && cleanPackNum(p.pack_number) === cleanPack
        );
        if (alreadyExists) {
          report.skippedDuplicates++;
          continue;
        }

        const packSize = Number(inv.packSizeNum) || 100;
        if (!dryRun) {
          const packId = `pack_${gameId}_${cleanPack}`;
          const packObj = {
            id: generateId('spk'),
            pack_id: packId,
            store_id: storeId,
            game_id: gameId,
            game_name: inv.gameName || 'Scratch Off Game',
            pack_number: cleanPack,
            barcode: `${gameId}${cleanPack}0000`,
            ticket_price: Number(inv.price) || 1.00,
            total_tickets: packSize,
            start_ticket: 0,
            end_ticket: packSize - 1,
            next_ticket_to_sell: 0,
            remaining_tickets: packSize,
            tickets_sold: 0,
            lifecycle_status: 'UNACTIVATED',
            physical_location: 'STORE',
            box_number: null,
            activated_at: null,
            activated_by: null,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          inventoryState.storePacks.push(packObj);
          await appendLedgerEntry({
            pack_id: packId,
            game_id: gameId,
            store_id: storeId,
            previous_status: null,
            new_status: 'UNACTIVATED',
            previous_location: null,
            new_location: 'STORE',
            previous_position: 0,
            new_position: 0,
            quantity_before: 0,
            quantity_changed: packSize,
            quantity_after: packSize,
            transaction_type: 'PACK_RECEIVED_BY_STORE',
            user_id: 'migration',
            reason: 'Migrated from store reserve stock'
          });
        }
        report.migratedPacks++;
        report.details.push({ pack: cleanPack, status: 'MIGRATED_UNACTIVATED' });
      }
    }

    if (!dryRun) {
      persistToDisk();
    }
  } catch (err) {
    report.error = err.message;
  }

  return report;
}

// ============================================================================
// 13. INVENTORY REPORTS & AUDIT TRAIL
// ============================================================================

export function getPackHistory(packNumberOrId, storeId = null) {
  const cleanNum = cleanPackNum(packNumberOrId);
  const pack = inventoryState.storePacks.find(
    p => p.pack_id === packNumberOrId || cleanPackNum(p.pack_number) === cleanNum
  );

  const packId = pack ? pack.pack_id : packNumberOrId;
  let history = transactionLedger.filter(
    t => t.pack_id === packId || cleanPackNum(t.pack_id) === cleanNum
  );

  if (storeId) {
    history = history.filter(t => !t.store_id || t.store_id === storeId);
  }

  return {
    pack: pack || null,
    history
  };
}

export function getStoreInventorySummary(storeId) {
  if (!storeId) {
    throw new Error('Store ID is required for inventory summary.');
  }

  const packs = inventoryState.storePacks.filter(p => p.store_id === storeId);

  const totalReceivedPacks = packs.length;
  const unactivatedPacks = packs.filter(p => p.lifecycle_status === 'UNACTIVATED').length;
  const activePacks = packs.filter(p => p.lifecycle_status === 'ACTIVE').length;
  const completedPacks = packs.filter(p => p.lifecycle_status === 'DEPLETED').length;
  const discontinuedPacks = packs.filter(p => p.lifecycle_status === 'DISCONTINUED').length;

  const totalRemainingTickets = packs
    .filter(p => p.lifecycle_status === 'UNACTIVATED' || p.lifecycle_status === 'ACTIVE')
    .reduce((sum, p) => sum + (p.remaining_tickets || 0), 0);

  const sellableTickets = packs
    .filter(p => p.lifecycle_status === 'ACTIVE')
    .reduce((sum, p) => sum + (p.remaining_tickets || 0), 0);

  const totalTicketsSold = packs.reduce((sum, p) => sum + (p.tickets_sold || 0), 0);

  const openDiscrepancies = inventoryState.discrepancies.filter(
    d => d.store_id === storeId && d.status === 'OPEN'
  ).length;

  return {
    storeId,
    totalReceivedPacks,
    unactivatedPacks,
    activePacks,
    completedPacks,
    discontinuedPacks,
    totalRemainingTickets,
    sellableTickets,
    totalTicketsSold,
    openDiscrepancies
  };
}

export function getStorePackInventory(storeId, filters = {}) {
  loadFromDisk();
  let list = inventoryState.storePacks.filter(p => p.store_id === storeId);
  if (filters.status) {
    list = list.filter(p => p.lifecycle_status === filters.status);
  }
  if (filters.gameId) {
    list = list.filter(p => p.game_id === String(filters.gameId));
  }
  return list;
}

export function getGameWiseInventory(storeId = null) {
  loadFromDisk();
  const packs = storeId
    ? inventoryState.storePacks.filter(p => p.store_id === storeId)
    : inventoryState.storePacks;

  const gameMap = {};

  for (const pack of packs) {
    if (!gameMap[pack.game_id]) {
      gameMap[pack.game_id] = {
        gameId: pack.game_id,
        gameName: pack.game_name,
        ticketPrice: pack.ticket_price,
        totalPacks: 0,
        unactivatedPacks: 0,
        activePacks: 0,
        completedPacks: 0,
        discontinuedPacks: 0,
        totalTickets: 0,
        remainingTickets: 0,
        soldTickets: 0
      };
    }

    const g = gameMap[pack.game_id];
    g.totalPacks += 1;
    if (pack.lifecycle_status === 'UNACTIVATED') g.unactivatedPacks += 1;
    if (pack.lifecycle_status === 'ACTIVE') g.activePacks += 1;
    if (pack.lifecycle_status === 'DEPLETED') g.completedPacks += 1;
    if (pack.lifecycle_status === 'DISCONTINUED') g.discontinuedPacks += 1;

    g.totalTickets += pack.total_tickets || 0;
    g.remainingTickets += pack.remaining_tickets || 0;
    g.soldTickets += pack.tickets_sold || 0;
  }

  return Object.values(gameMap);
}

export function getDiscrepancyReport(storeId = null) {
  let list = [...inventoryState.discrepancies];
  if (storeId) {
    list = list.filter(d => d.store_id === storeId);
  }
  return list;
}

export async function resolveDiscrepancy({
  discrepancyId,
  resolvedBy = 'admin',
  status = 'RESOLVED',
  notes = ''
}) {
  return withInventoryLock(async () => {
    const disc = inventoryState.discrepancies.find(d => d.discrepancy_id === discrepancyId);
    if (!disc) {
      throw new Error(`Discrepancy record #${discrepancyId} not found.`);
    }

    disc.status = status;
    disc.resolved_by = resolvedBy;
    disc.resolved_at = new Date().toISOString();
    disc.resolution_notes = notes;

    persistToDisk();
    return { success: true, discrepancy: disc };
  });
}

// ============================================================================
// 14. DURABLE POS OUTBOX & RETRY RECONCILIATION
// ============================================================================

export async function recordToOutbox(event) {
  const item = {
    outbox_id: generateId('obx'),
    idempotency_key: event.sourceRefId || generateId('pos_sale'),
    store_id: event.storeId || 'store_amigo',
    pack_number: cleanPackNum(event.packNumber),
    quantity: Number(event.quantity) || 1,
    cashier: event.cashier || 'master',
    barcode: event.barcode || null,
    status: 'PENDING',
    retry_count: 0,
    created_at: new Date().toISOString(),
    error: null
  };
  outboxQueue.push(item);
  persistToDisk();
  return item;
}

export async function processOutbox() {
  const pending = outboxQueue.filter(item => item.status === 'PENDING' || item.status === 'RETRY');
  const results = [];
  for (const item of pending) {
    try {
      const res = await recordTicketSale({
        storeId: item.store_id,
        packNumber: item.pack_number,
        quantity: item.quantity,
        sourceRefId: item.idempotency_key,
        cashier: item.cashier,
        barcode: item.barcode
      });
      item.status = 'PROCESSED';
      item.processed_at = new Date().toISOString();
      item.error = null;
      results.push({ id: item.outbox_id, success: true, res });
    } catch (err) {
      item.retry_count++;
      item.error = err.message;
      if (err.message && (err.message.includes('Insufficient') || err.message.includes('DEPLETED'))) {
        item.status = 'FAILED';
      } else {
        item.status = item.retry_count > 5 ? 'DEAD_LETTER' : 'RETRY';
      }
      results.push({ id: item.outbox_id, success: false, error: err.message });
    }
  }
  persistToDisk();
  return results;
}

export function getOutboxStatus() {
  return {
    total: outboxQueue.length,
    pending: outboxQueue.filter(i => i.status === 'PENDING' || i.status === 'RETRY').length,
    processed: outboxQueue.filter(i => i.status === 'PROCESSED').length,
    failed: outboxQueue.filter(i => i.status === 'FAILED' || i.status === 'DEAD_LETTER').length,
    items: [...outboxQueue]
  };
}

