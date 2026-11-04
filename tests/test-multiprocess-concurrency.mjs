// Multi-process concurrency test suite for Jackpotlo lottery inventory system
// Verifies cross-process locking, overselling prevention, heartbeat liveness, and dead-PID recovery

import { fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import assert from 'assert';
import {
  intakeWarehousePack,
  allocatePacksFromWarehouse,
  confirmStoreReceipt,
  activatePack,
  getStorePackInventory,
  getInventoryLedger,
  withInventoryLock
} from '../inventoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerScript = path.resolve(__dirname, '../scratch/concurrency_worker.js');

function runWorker(args) {
  return new Promise((resolve, reject) => {
    const child = fork(workerScript, args, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    let result = null;
    child.on('message', (msg) => {
      result = msg;
    });
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (result) {
        resolve(result);
      } else if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      } else {
        resolve({ success: true, code });
      }
    });
  });
}

async function runTests() {
  console.log('=== MULTI-PROCESS CONCURRENCY TEST SUITE ===\n');

  // ----------------------------------------------------
  // TEST 1: Prevent overselling across separate Node.js processes
  // ----------------------------------------------------
  console.log('[TEST 1] Multi-process concurrent sales on final remaining tickets');
  const storeId = 'store_amigo';
  const packNumber = 'CONC_PACK_OVERSELL_' + Date.now();
  const gameId = '1001';

  // 1. Warehouse intake (5 tickets: 1 to 5)
  await intakeWarehousePack({
    gameId,
    gameName: '$10 Mega Cash',
    packNumber,
    ticketPrice: 10,
    packSize: 5,
    startTicket: 1,
    endTicket: 5
  });

  // 2. Allocate & Receive & Activate
  await allocatePacksFromWarehouse({
    packNumbers: [packNumber],
    storeId,
    gameId,
    allocatedBy: 'audit_runner'
  });
  await confirmStoreReceipt({ storeId, packNumber, receivedBy: 'audit_runner' });
  await activatePack({ storeId, packNumber, slotNumber: 42, activatedBy: 'audit_runner' });

  let pack = (await getStorePackInventory(storeId)).find(p => p.pack_number === packNumber);
  assert.strictEqual(pack.remaining_tickets, 5, 'Initial remaining tickets should be 5');

  // Spawn 3 workers simultaneously: Worker A wants 3, Worker B wants 3, Worker C wants 3 (Total = 9 requested, 5 available)
  console.log('Spawning 3 child processes attempting simultaneous purchases of 3 tickets each (Total requested: 9, Available: 5)...');
  const p1 = runWorker(['sale', '1', storeId, packNumber, '3']);
  const p2 = runWorker(['sale', '2', storeId, packNumber, '3']);
  const p3 = runWorker(['sale', '3', storeId, packNumber, '3']);

  const results = await Promise.all([p1, p2, p3]);
  console.log('Worker results:');
  results.forEach(r => console.log(` - Worker ${r.workerId}: success=${r.success}, error=${r.error || 'none'}`));

  pack = (await getStorePackInventory(storeId)).find(p => p.pack_number === packNumber);
  console.log(`Pack status after concurrent workers: remaining_tickets=${pack.remaining_tickets}, status=${pack.lifecycle_status || pack.status}`);

  // Verification: remaining_tickets must be >= 0 (never negative)
  assert.ok(pack.remaining_tickets >= 0, 'Remaining tickets must never be negative (NO OVERSELLING)');
  // Total tickets sold across workers must equal (5 - remaining_tickets)
  let successfulSalesCount = 0;
  for (const r of results) {
    if (r.success) {
      successfulSalesCount += 3;
    }
  }
  assert.strictEqual(successfulSalesCount, 5 - pack.remaining_tickets, 'Ledger sales count must match decrement');
  console.log('✓ PASS: No overselling occurred across concurrent child processes.\n');

  // ----------------------------------------------------
  // TEST 2: Multi-process concurrent store receipt
  // ----------------------------------------------------
  console.log('[TEST 2] Multi-process concurrent receipt of same allocated pack');
  const receiptPack = 'CONC_PACK_RECEIPT_' + Date.now();
  await intakeWarehousePack({
    gameId,
    gameName: '$10 Mega Cash',
    packNumber: receiptPack,
    ticketPrice: 10,
    packSize: 30,
    startTicket: 1,
    endTicket: 30
  });
  await allocatePacksFromWarehouse({
    packNumbers: [receiptPack],
    storeId,
    gameId,
    allocatedBy: 'audit_runner'
  });

  // 2 workers concurrently confirm receipt
  console.log('Spawning 2 child processes attempting to confirm receipt of the same pack simultaneously...');
  const rc1 = runWorker(['receipt', '1', storeId, receiptPack]);
  const rc2 = runWorker(['receipt', '2', storeId, receiptPack]);
  const rcResults = await Promise.all([rc1, rc2]);

  console.log('Receipt worker results:');
  rcResults.forEach(r => console.log(` - Worker ${r.workerId}: success=${r.success}, error=${r.error || 'none'}`));

  const allTx = await getInventoryLedger({ storeId });
  const receiptTx = allTx.filter(t => (t.pack_id && t.pack_id.includes(receiptPack)) && (t.transaction_type === 'PACK_RECEIVED_BY_STORE' || t.transaction_type === 'STORE_RECEIVE'));
  console.log(`PACK_RECEIVED_BY_STORE transactions logged: ${receiptTx.length}`);
  assert.strictEqual(receiptTx.length, 1, 'Exactly one PACK_RECEIVED_BY_STORE transaction must be logged (no duplicate receipt transactions)');
  console.log('✓ PASS: Concurrent receipt handled atomically without duplicate ledger transactions.\n');

  // ----------------------------------------------------
  // TEST 3: Active lock retention with heartbeat (no stale lock stealing)
  // ----------------------------------------------------
  console.log('[TEST 3] Active lock retention with heartbeat against concurrent worker');
  let worker1Finished = false;
  let worker2Started = false;

  // Worker 1 holds lock for 2000ms
  const child1 = fork(workerScript, ['long_running', '1', '2000'], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  
  await new Promise(resolve => {
    child1.on('message', msg => {
      if (msg.status === 'LOCKED') resolve();
    });
  });
  console.log('Worker 1 acquired lock and is executing long task (2000ms)...');

  // Now Worker 2 attempts to acquire lock immediately
  const child2Promise = new Promise((resolve, reject) => {
    const child2 = fork(workerScript, ['long_running', '2', '200'], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    child2.on('message', msg => {
      if (msg.status === 'LOCKED') {
        worker2Started = true;
        // Check if worker 1 has finished
        assert.ok(worker1Finished, 'Worker 2 must not acquire lock before Worker 1 has released it');
      }
      if (msg.status === 'DONE') {
        resolve();
      }
    });
    child2.on('error', reject);
  });

  await new Promise(resolve => {
    child1.on('message', msg => {
      if (msg.status === 'DONE') {
        worker1Finished = true;
        console.log('Worker 1 finished and released lock safely.');
        resolve();
      }
    });
  });

  await child2Promise;
  console.log('Worker 2 finished after waiting for Worker 1 to release.');
  console.log('✓ PASS: Long-running operation held lock safely; heartbeat prevented premature lock theft.\n');

  // ----------------------------------------------------
  // TEST 4: Dead PID lock recovery
  // ----------------------------------------------------
  console.log('[TEST 4] Dead-PID lock recovery');
  const lockDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });
  const lockFile = path.join(lockDir, 'inventory.lock');

  // Simulate an abandoned lock from a dead PID (e.g., PID 99999999) created 10 seconds ago
  const staleData = JSON.stringify({ pid: 99999999, timestamp: Date.now() - 10000 });
  fs.writeFileSync(lockFile, staleData, 'utf8');
  console.log('Wrote dead PID 99999999 lockfile.');

  let acquiredAfterDeadPid = false;
  await withInventoryLock(async () => {
    acquiredAfterDeadPid = true;
    console.log('Successfully acquired lock after dead PID recovery.');
  });

  assert.strictEqual(acquiredAfterDeadPid, true, 'Lock must be acquired after safely removing dead PID lockfile');
  console.log('✓ PASS: Dead PID lock cleanly recovered without manual intervention or deadlock.\n');

  console.log('====================================================');
  console.log('ALL MULTI-PROCESS CONCURRENCY TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('CONCURRENCY TEST SUITE FAILED:', err);
  process.exit(1);
});
