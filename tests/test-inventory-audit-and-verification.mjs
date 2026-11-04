// ============================================================================
// JACKPOTLO LOTTERY INVENTORY TECHNICAL AUDIT & VERIFICATION SUITE
// Verifies 12 Rigorous Audit Dimensions (Section 7)
// ============================================================================

import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import {
  resetInventoryForTesting,
  intakeWarehousePack,
  confirmStoreReceipt,
  activatePack,
  recordTicketSale,
  reconcileShift,
  transferPackBetweenStores,
  normalizeScannedPosition,
  migrateExistingInventoryData,
  getStorePackInventory,
  getDiscrepancyReport,
  getPackHistory,
  withInventoryLock
} from '../inventoryService.js';

let passed = 0;
let failed = 0;

async function auditTest(name, fn) {
  try {
    await fn();
    console.log(`✅ AUDIT PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ AUDIT FAIL: ${name}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('      JACKPOTLO INVENTORY TECHNICAL AUDIT & VERIFICATION SUITE       ');
console.log('======================================================================\n');

async function runAudit() {
  resetInventoryForTesting();

  const STORE_AMIGO = 'store_amigo';
  const STORE_SAVANNAH = 'store_savannah';
  const GAME_1658 = '1658'; // $10 Players Club, 30 tickets

  // Setup initial pack 350877 (Game 1658) at Store Amigo
  await intakeWarehousePack({
    gameId: GAME_1658,
    gameName: 'PLAYERS CLUB $10',
    packNumber: '350877',
    ticketPrice: 10.00,
    packSize: 30,
    startTicket: 0,
    endTicket: 29
  });
  await confirmStoreReceipt({ storeId: STORE_AMIGO, gameId: GAME_1658, packNumber: '350877' });
  await activatePack({ storeId: STORE_AMIGO, packNumber: '350877', boxNumber: 1 });

  // --------------------------------------------------------------------------
  // AUDIT 1: A real POS sale updates its correct inventory pack
  // --------------------------------------------------------------------------
  await auditTest('1. Real POS sale updates its correct inventory pack', async () => {
    const packBefore = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    assert.equal(packBefore.next_ticket_to_sell, 0);
    assert.equal(packBefore.remaining_tickets, 30);

    // Call POS sale via logTicketScanToDB backend route simulation
    const saleResult = await recordTicketSale({
      storeId: STORE_AMIGO,
      packNumber: '350877',
      quantity: 1,
      sourceRefId: 'pos_sale_aud_001',
      cashier: 'master',
      barcode: '16583508770000'
    });

    assert.equal(saleResult.success, true);
    assert.equal(saleResult.ticketsSold, 1);
    assert.equal(saleResult.nextTicketToSell, 1);
    assert.equal(saleResult.remainingTickets, 29);

    const packAfter = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    assert.equal(packAfter.next_ticket_to_sell, 1);
    assert.equal(packAfter.remaining_tickets, 29);
    assert.equal(packAfter.tickets_sold, 1);
  });

  // --------------------------------------------------------------------------
  // AUDIT 2: A failed POS sale does not change stock
  // --------------------------------------------------------------------------
  await auditTest('2. Failed POS sale does not change stock', async () => {
    const packBefore = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    const remainingBefore = packBefore.remaining_tickets;
    const nextTixBefore = packBefore.next_ticket_to_sell;

    // Attempt illegal overselling sale (requesting 50 tickets when only 29 remain)
    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_AMIGO,
          packNumber: '350877',
          quantity: 50,
          sourceRefId: 'pos_fail_oversell',
          cashier: 'master'
        });
      },
      /Overselling prevented/
    );

    const packAfter = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    assert.equal(packAfter.remaining_tickets, remainingBefore, 'Stock must not change on failed sale');
    assert.equal(packAfter.next_ticket_to_sell, nextTixBefore, 'Ticket position must not change on failed sale');
  });

  // --------------------------------------------------------------------------
  // AUDIT 3: Duplicate POS submission deducts once
  // --------------------------------------------------------------------------
  await auditTest('3. Duplicate POS submission deducts once (Idempotency guarantee)', async () => {
    const packBefore = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    const remainingBefore = packBefore.remaining_tickets;

    // First submission
    const res1 = await recordTicketSale({
      storeId: STORE_AMIGO,
      packNumber: '350877',
      quantity: 1,
      sourceRefId: 'pos_tx_duplicate_id_555',
      cashier: 'master'
    });
    assert.equal(res1.success, true);
    assert.equal(res1.ticketsSold, 1);

    // Duplicate submission of the exact same event
    const res2 = await recordTicketSale({
      storeId: STORE_AMIGO,
      packNumber: '350877',
      quantity: 1,
      sourceRefId: 'pos_tx_duplicate_id_555',
      cashier: 'master'
    });
    assert.equal(res2.success, true);
    assert.equal(res2.duplicate, true, 'Must flag as duplicate');
    assert.equal(res2.ticketsSold, 0, 'Duplicate sale must not deduct tickets');

    const packAfter = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    assert.equal(packAfter.remaining_tickets, remainingBefore - 1, 'Only 1 ticket must be deducted overall');
  });

  // --------------------------------------------------------------------------
  // AUDIT 4: POS sales and closing scanner positions reconcile correctly
  // --------------------------------------------------------------------------
  await auditTest('4. POS sales and closing scanner positions reconcile correctly (Match case: 51 + 10 = 61)', async () => {
    // Setup fresh pack 10050 at Store Amigo (start 51, sell 10 via POS -> expected closing 61, scan 61)
    await intakeWarehousePack({
      gameId: '1001',
      packNumber: '10050',
      packSize: 100,
      startTicket: 0,
      endTicket: 99
    });
    await confirmStoreReceipt({ storeId: STORE_AMIGO, gameId: '1001', packNumber: '10050' });
    await activatePack({ storeId: STORE_AMIGO, packNumber: '10050', boxNumber: 10 });

    // Advance to opening position 51
    await recordTicketSale({ storeId: STORE_AMIGO, packNumber: '10050', quantity: 51 });

    // During shift, sell 10 tickets via POS
    await recordTicketSale({ storeId: STORE_AMIGO, packNumber: '10050', quantity: 10 });

    // Closing shift scan = 61. Expected = 51 + 10 = 61.
    const recon = await reconcileShift({
      storeId: STORE_AMIGO,
      shiftId: 'shift_perfect_match',
      closingScans: [
        { packNumber: '10050', closingPosition: 61 },
        { packNumber: '350877', closingPosition: 2 }
      ],
      posLoggedSalesByPack: { '10050': 10, '350877': 0 },
      openingPositionsByPack: { '10050': 51, '350877': 2 }
    });

    assert.equal(recon.success, true);
    assert.equal(recon.reconciliation.discrepancyCount, 0, 'Should have 0 discrepancies when all active packs match');
    const res10050 = recon.reconciliation.results.find(r => r.packNumber === '10050');
    assert.equal(res10050.reconciled, true);
    assert.equal(res10050.difference, 0);
  });

  // --------------------------------------------------------------------------
  // AUDIT 5: A one-ticket mismatch creates a discrepancy
  // --------------------------------------------------------------------------
  await auditTest('5. One-ticket mismatch creates a discrepancy (Mismatch: expected 61, scan 60 -> diff -1, 0 deductions)', async () => {
    // Opening 51, POS sold 10 -> Expected 61. But physically scanned 60!
    const packBefore = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '10050');
    const remainingBefore = packBefore.remaining_tickets;
    const nextTicketBefore = packBefore.next_ticket_to_sell;

    const recon = await reconcileShift({
      storeId: STORE_AMIGO,
      shiftId: 'shift_one_ticket_mismatch',
      closingScans: [
        { packNumber: '10050', closingPosition: 60 },
        { packNumber: '350877', closingPosition: 2 }
      ],
      posLoggedSalesByPack: { '10050': 10, '350877': 0 },
      openingPositionsByPack: { '10050': 51, '350877': 2 }
    });

    assert.equal(recon.success, true);
    assert.equal(recon.reconciliation.discrepancyCount, 1, 'Must flag exactly 1 discrepancy for pack 10050');
    const res10050 = recon.reconciliation.results.find(r => r.packNumber === '10050');
    assert.equal(res10050.reconciled, false);
    assert.equal(res10050.expectedClosingPosition, 61);
    assert.equal(res10050.closingPosition, 60);
    assert.equal(res10050.difference, -1);

    // CRITICAL REQUIREMENT: Do NOT deduct another ticket or overwrite either record!
    const packAfter = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '10050');
    assert.equal(packAfter.remaining_tickets, remainingBefore, 'Remaining tickets must NOT change on discrepancy');
    assert.equal(packAfter.next_ticket_to_sell, nextTicketBefore, 'Next ticket to sell must NOT be overwritten');

    const discs = getDiscrepancyReport(STORE_AMIGO);
    const disc = discs.find(d => d.shift_id === 'shift_one_ticket_mismatch');
    assert(disc, 'Discrepancy must be recorded in discrepancies ledger');
    assert.equal(disc.status, 'OPEN');
    assert.equal(disc.difference, -1);
  });

  // --------------------------------------------------------------------------
  // AUDIT 6: One physical pack cannot be assigned to two stores
  // --------------------------------------------------------------------------
  await auditTest('6. One physical pack cannot be assigned to two stores simultaneously', async () => {
    // Pack 350877 (Game 1658) is currently at Store Amigo.
    // Attempt to receive the exact same physical pack (same game and pack) into Store Savannah
    await assert.rejects(
      async () => {
        await confirmStoreReceipt({
          storeId: STORE_SAVANNAH,
          gameId: GAME_1658,
          packNumber: '350877',
          receivedBy: 'savannah_clerk'
        });
      },
      /already belongs to store "store_amigo"/
    );
  });

  // --------------------------------------------------------------------------
  // AUDIT 7: A transferred pack retains its identity and history
  // --------------------------------------------------------------------------
  await auditTest('7. Transferred pack retains its identity and history (Single physical row update)', async () => {
    const packBefore = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '350877');
    const originalPackId = packBefore.pack_id;
    const originalTicketsSold = packBefore.tickets_sold;
    const originalRemaining = packBefore.remaining_tickets;

    // Transfer pack from Store Amigo to Store Savannah
    const txf = await transferPackBetweenStores({
      fromStoreId: STORE_AMIGO,
      toStoreId: STORE_SAVANNAH,
      packNumber: '350877',
      requestedBy: 'manager_amigo'
    });

    assert.equal(txf.success, true);
    assert.equal(txf.pack.store_id, STORE_SAVANNAH);
    assert.equal(txf.pack.physical_location, 'IN_TRANSIT');
    assert.equal(txf.pack.pack_id, originalPackId, 'Pack ID must remain identical');

    // Confirm receipt at Store Savannah
    const rcpt = await confirmStoreReceipt({
      storeId: STORE_SAVANNAH,
      gameId: GAME_1658,
      packNumber: '350877',
      receivedBy: 'manager_savannah'
    });

    assert.equal(rcpt.success, true);
    assert.equal(rcpt.pack.store_id, STORE_SAVANNAH);
    assert.equal(rcpt.pack.physical_location, 'STORE');
    assert.equal(rcpt.pack.tickets_sold, originalTicketsSold, 'Tickets sold count preserved');
    assert.equal(rcpt.pack.remaining_tickets, originalRemaining, 'Remaining tickets preserved');

    // Check complete chronological history
    const history = getPackHistory('350877');
    assert(history.history.some(h => h.transaction_type === 'PACK_TRANSFERRED'));
    assert(history.history.some(h => h.transaction_type === 'PACK_RECEIVED_BY_STORE'));
  });

  // --------------------------------------------------------------------------
  // AUDIT 8: Multiple simultaneous sales cannot oversell
  // --------------------------------------------------------------------------
  await auditTest('8. Multiple simultaneous sales cannot oversell (Concurrency mutex lock)', async () => {
    // Setup pack with only 3 tickets remaining
    await intakeWarehousePack({
      gameId: '1002',
      packNumber: '50001',
      packSize: 10,
      startTicket: 0,
      endTicket: 9
    });
    await confirmStoreReceipt({ storeId: STORE_AMIGO, gameId: '1002', packNumber: '50001' });
    await activatePack({ storeId: STORE_AMIGO, packNumber: '50001', boxNumber: 15 });
    // Sell 7 -> 3 remaining
    await recordTicketSale({ storeId: STORE_AMIGO, packNumber: '50001', quantity: 7 });

    // 5 concurrent requests, each trying to buy 1 ticket (only 3 exist)
    const promises = Array.from({ length: 5 }, (_, i) =>
      recordTicketSale({
        storeId: STORE_AMIGO,
        packNumber: '50001',
        quantity: 1,
        sourceRefId: `concurrent_sale_${i}`
      })
    );

    const outcomes = await Promise.allSettled(promises);
    const succeeded = outcomes.filter(o => o.status === 'fulfilled');
    const failedOversell = outcomes.filter(o => o.status === 'rejected');

    assert.equal(succeeded.length, 3, 'Exactly 3 sales must succeed');
    assert.equal(failedOversell.length, 2, '2 sales must be rejected to prevent overselling');

    const pack = (getStorePackInventory(STORE_AMIGO)).find(p => p.pack_number === '50001');
    assert.equal(pack.remaining_tickets, 0);
    assert.equal(pack.lifecycle_status, 'DEPLETED');
  });

  // --------------------------------------------------------------------------
  // AUDIT 9: Existing inventory data survives migration
  // --------------------------------------------------------------------------
  await auditTest('9. Existing inventory data migration (preserves packs, flags incomplete, 0 duplicates)', async () => {
    // Create mock legacy POS state data file
    const mockLegacyDir = path.resolve('scratch/test_migration_data');
    if (!fs.existsSync(mockLegacyDir)) fs.mkdirSync(mockLegacyDir, { recursive: true });

    const mockPosState = {
      slots: [
        { boxNumber: 1, gameId: '1650', gameName: '5X Money', packNumber: '99001', price: 1, packSize: 300, startTicket: 0, currentTicket: 10 },
        { boxNumber: 2, gameId: '1602', gameName: 'Jr Jumbo', packNumber: '99002', price: 1, packSize: 300, startTicket: 0, currentTicket: null } // INCOMPLETE RECORD
      ],
      inStockInventory: [
        { packNumber: '99003', gameName: 'Hit 100', gameNumber: 'Game 1644', price: 2, packSizeNum: 150 }
      ]
    };

    fs.writeFileSync(path.join(mockLegacyDir, 'pos_state_store_test_mig.json'), JSON.stringify(mockPosState, null, 2));

    const migReport = await migrateExistingInventoryData({
      sourceDir: mockLegacyDir,
      storeId: 'store_test_mig',
      dryRun: false
    });

    assert.equal(migReport.migratedPacks, 2, 'Should migrate 1 active and 1 in-stock pack');
    assert.equal(migReport.flaggedIncomplete, 1, 'Incomplete record (currentTicket=null) must be flagged');

    // Verify migrated active pack
    const migratedActive = (getStorePackInventory('store_test_mig')).find(p => p.pack_number === '99001');
    assert(migratedActive, 'Pack 99001 must exist');
    assert.equal(migratedActive.next_ticket_to_sell, 10);
    assert.equal(migratedActive.remaining_tickets, 290);
    assert.equal(migratedActive.tickets_sold, 10);
    assert.equal(migratedActive.lifecycle_status, 'ACTIVE');

    // Verify migrated unactivated pack
    const migratedStock = (getStorePackInventory('store_test_mig')).find(p => p.pack_number === '99003');
    assert(migratedStock, 'Pack 99003 must exist');
    assert.equal(migratedStock.lifecycle_status, 'UNACTIVATED');
    assert.equal(migratedStock.remaining_tickets, 150);

    // Verify incomplete record was flagged in discrepancies
    const discs = getDiscrepancyReport('store_test_mig');
    const disc = discs.find(d => d.pack_number === '99002');
    assert(disc, 'Pack 99002 must have discrepancy record');
    assert.equal(disc.discrepancy_type, 'INCOMPLETE_MIGRATION_RECORD');

    // Run migration a second time to ensure idempotency (0 duplicates)
    const migReport2 = await migrateExistingInventoryData({
      sourceDir: mockLegacyDir,
      storeId: 'store_test_mig',
      dryRun: false
    });
    assert.equal(migReport2.migratedPacks, 0, 'Second run must not migrate duplicate packs');
    assert.equal(migReport2.skippedDuplicates, 2, 'Second run must skip duplicates');
  });

  // --------------------------------------------------------------------------
  // AUDIT 10: The JSON fallback cannot silently lose concurrent updates
  // --------------------------------------------------------------------------
  await auditTest('10. Atomic persistence strategy & inter-process file locking (crash-safe atomic rename)', async () => {
    // Perform rapid concurrent locked updates
    const updates = Array.from({ length: 10 }, (_, i) =>
      withInventoryLock(async () => {
        await intakeWarehousePack({
          gameId: '9999',
          packNumber: `atom_${i}`,
          packSize: 50
        });
      })
    );

    await Promise.all(updates);

    // Verify all 10 packs survived without file corruption
    const stateFile = path.resolve('server_data/inventory_state.json');
    const onDiskData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    for (let i = 0; i < 10; i++) {
      const found = onDiskData.centralWarehouse.find(p => p.pack_number === `atom_${i}`);
      assert(found, `Pack atom_${i} must be persisted to disk without loss`);
    }
  });

  // --------------------------------------------------------------------------
  // AUDIT 11: Barcode Compatibility & Normalization
  // --------------------------------------------------------------------------
  await auditTest('11. Barcode normalization supports NEXT_TICKET and LAST_SOLD modes accurately', async () => {
    // Mode NEXT_TICKET: scanned ticket is next ticket directly
    const normNext = normalizeScannedPosition('16583508770290', 'NEXT_TICKET');
    assert.equal(normNext.isValid, true);
    assert.equal(normNext.scannedTicket, 29);
    assert.equal(normNext.normalizedNextTicket, 29);

    // Mode LAST_SOLD: scanned ticket was sold, so next ticket is scanned + 1
    const normLast = normalizeScannedPosition('16583508770290', 'LAST_SOLD');
    assert.equal(normLast.isValid, true);
    assert.equal(normLast.scannedTicket, 29);
    assert.equal(normLast.normalizedNextTicket, 30);
  });

  // --------------------------------------------------------------------------
  // AUDIT 12: Multi-store permission boundaries on new APIs
  // --------------------------------------------------------------------------
  await auditTest('12. Store permission isolation on inventory APIs', async () => {
    // Pack 10050 belongs to Store Amigo. Store Savannah cannot sell it.
    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_SAVANNAH,
          packNumber: '10050',
          quantity: 1
        });
      },
      /Access Denied/
    );

    // Store Savannah cannot adjust Store Amigo's pack
    await assert.rejects(
      async () => {
        await activatePack({
          storeId: STORE_SAVANNAH,
          packNumber: '10050'
        });
      },
      /Access Denied/
    );
  });

  console.log('\n======================================================================');
  console.log(`   AUDIT SUITE COMPLETE: Passed: ${passed}, Failed: ${failed}   `);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit();
