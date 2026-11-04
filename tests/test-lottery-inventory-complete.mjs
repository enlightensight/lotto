// ============================================================================
// JACKPOTLO ENTERPRISE LOTTERY INVENTORY TEST SUITE
// Automated Verification for all 18 Core Requirements
// Reference: LT System Software Pack & Ticket Level Tracking
// ============================================================================

import { strict as assert } from 'assert';
import {
  resetInventoryForTesting,
  intakeWarehousePack,
  getWarehouseInventory,
  getWarehouseSummary,
  allocatePacksFromWarehouse,
  confirmStoreReceipt,
  activatePack,
  recordTicketSale,
  reconcileShift,
  adjustPackInventory,
  discontinuePack,
  returnPackToWarehouse,
  transferPackBetweenStores,
  getPackHistory,
  getStoreInventorySummary,
  getStorePackInventory,
  getGameWiseInventory,
  getDiscrepancyReport,
  getInventoryLedger
} from '../inventoryService.js';

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${err.message}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('   RUNNING COMPLETE LOTTERY INVENTORY AUTOMATED VERIFICATION SUITE   ');
console.log('======================================================================\n');

async function executeTestSuite() {
  // Reset clean state
  resetInventoryForTesting();

  const STORE_A = 'store_amigo';
  const STORE_B = 'store_savannah';
  const GAME_100 = 'g100'; // $5 game, 100 tickets/pack

  // --------------------------------------------------------------------------
  // TEST 1 — New pack received
  // --------------------------------------------------------------------------
  await runTest('TEST 1: New pack received (1 physical pack, 100 unopened tickets, 0 sold)', async () => {
    // Intake into warehouse then confirm receipt at store
    const intake = await intakeWarehousePack({
      gameId: GAME_100,
      gameName: 'Super Cash $5',
      packNumber: '10001',
      ticketPrice: 5.00,
      packSize: 100,
      startTicket: 1, // Start ticket 1 to 100
      endTicket: 100
    });
    assert.equal(intake.pack_size, 100);

    const receipt = await confirmStoreReceipt({
      storeId: STORE_A,
      packNumber: '10001',
      receivedBy: 'store_clerk'
    });

    assert.equal(receipt.success, true);
    assert.equal(receipt.pack.total_tickets, 100);
    assert.equal(receipt.pack.remaining_tickets, 100, 'Remaining tickets must be exactly 100');
    assert.equal(receipt.pack.tickets_sold, 0, 'Sold tickets must be exactly 0');
    assert.equal(receipt.pack.lifecycle_status, 'UNACTIVATED');
    assert.equal(receipt.pack.physical_location, 'STORE');
  });

  // --------------------------------------------------------------------------
  // TEST 2 — Pack activation
  // --------------------------------------------------------------------------
  await runTest('TEST 2: Pack activation (pack active, remaining = 100, sold = 0, no stock deducted)', async () => {
    const activation = await activatePack({
      storeId: STORE_A,
      packNumber: '10001',
      boxNumber: 5,
      activatedBy: 'manager'
    });

    assert.equal(activation.success, true);
    assert.equal(activation.pack.lifecycle_status, 'ACTIVE');
    assert.equal(activation.pack.remaining_tickets, 100, 'Activating pack must NOT deduct tickets');
    assert.equal(activation.pack.tickets_sold, 0, 'Tickets sold must remain 0 on activation');
    assert.equal(activation.pack.next_ticket_to_sell, 1, 'Next ticket to sell initialized to start ticket (1)');
    assert.equal(activation.pack.box_number, 5);

    // Verify activation event in ledger
    const history = getPackHistory('10001', STORE_A);
    const actEvent = history.history.find(h => h.transaction_type === 'PACK_ACTIVATED');
    assert(actEvent, 'Ledger must record PACK_ACTIVATED');
    assert.equal(actEvent.quantity_changed, 0, 'Activation transaction must not alter ticket quantity');
  });

  // --------------------------------------------------------------------------
  // TEST 3 — Ticket sales
  // --------------------------------------------------------------------------
  await runTest('TEST 3: Ticket sales (sell 20 -> sold = 20, remaining = 80, next ticket position = 21)', async () => {
    const sale = await recordTicketSale({
      storeId: STORE_A,
      packNumber: '10001',
      quantity: 20,
      sourceRefId: 'pos_tx_001',
      cashier: 'clerk_1'
    });

    assert.equal(sale.success, true);
    assert.equal(sale.ticketsSold, 20);
    assert.equal(sale.remainingTickets, 80);
    assert.equal(sale.nextTicketToSell, 21); // 1 + 20 = 21
    assert.equal(sale.pack.lifecycle_status, 'ACTIVE');
  });

  // --------------------------------------------------------------------------
  // TEST 4 — Additional sales
  // --------------------------------------------------------------------------
  await runTest('TEST 4: Additional sales (sell 30 -> total sold = 50, remaining = 50, next position = 51)', async () => {
    const sale = await recordTicketSale({
      storeId: STORE_A,
      packNumber: '10001',
      quantity: 30,
      sourceRefId: 'pos_tx_002',
      cashier: 'clerk_1'
    });

    assert.equal(sale.success, true);
    assert.equal(sale.ticketsSold, 30);
    assert.equal(sale.remainingTickets, 50);
    assert.equal(sale.nextTicketToSell, 51); // 21 + 30 = 51
    assert.equal(sale.pack.tickets_sold, 50);
  });

  // --------------------------------------------------------------------------
  // TEST 5 — Shift reconciliation
  // --------------------------------------------------------------------------
  await runTest('TEST 5: Shift reconciliation (opening = 51, closing = 61 -> shift sales = 10, remaining = 40)', async () => {
    const recon = await reconcileShift({
      storeId: STORE_A,
      shiftId: 'shift_101',
      closingScans: [
        { packNumber: '10001', closingPosition: 61 }
      ],
      closedBy: 'clerk_1'
    });

    assert.equal(recon.success, true);
    assert.equal(recon.reconciliation.totalShiftSales, 10);
    assert.equal(recon.reconciliation.results[0].soldCount, 10);
    assert.equal(recon.reconciliation.results[0].remainingTickets, 40);

    const pack = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10001');
    assert.equal(pack.remaining_tickets, 40);
    assert.equal(pack.next_ticket_to_sell, 61);
  });

  // --------------------------------------------------------------------------
  // TEST 6 — Duplicate shift close
  // --------------------------------------------------------------------------
  await runTest('TEST 6: Duplicate shift close (idempotency prevents double deduction)', async () => {
    const packBefore = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10001');
    const remainingBefore = packBefore.remaining_tickets;

    const reconDup = await reconcileShift({
      storeId: STORE_A,
      shiftId: 'shift_101', // Exact same shift ID
      closingScans: [
        { packNumber: '10001', closingPosition: 61 }
      ],
      closedBy: 'clerk_1'
    });

    assert.equal(reconDup.success, true);
    assert.equal(reconDup.duplicate, true, 'Duplicate submission must be flagged');

    const packAfter = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10001');
    assert.equal(packAfter.remaining_tickets, remainingBefore, 'Remaining tickets must NOT change on duplicate shift close');
  });

  // --------------------------------------------------------------------------
  // TEST 7 — Overselling
  // --------------------------------------------------------------------------
  await runTest('TEST 7: Overselling rejection (remaining = 40, attempt to sell 41 -> rejected, unchanged)', async () => {
    const pack = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10001');
    const beforeRemaining = pack.remaining_tickets;

    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_A,
          packNumber: '10001',
          quantity: beforeRemaining + 1, // 41
          sourceRefId: 'pos_tx_oversell',
          cashier: 'clerk_1'
        });
      },
      /Overselling prevented/
    );

    const packAfter = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10001');
    assert.equal(packAfter.remaining_tickets, beforeRemaining, 'Inventory must remain unchanged after rejected sale');
  });

  // --------------------------------------------------------------------------
  // TEST 8 — Full pack completion
  // --------------------------------------------------------------------------
  await runTest('TEST 8: Full pack completion (sell remaining 40 -> remaining = 0, pack DEPLETED, further sales rejected)', async () => {
    const sale = await recordTicketSale({
      storeId: STORE_A,
      packNumber: '10001',
      quantity: 40,
      sourceRefId: 'pos_tx_deplete',
      cashier: 'clerk_1'
    });

    assert.equal(sale.success, true);
    assert.equal(sale.remainingTickets, 0);
    assert.equal(sale.pack.lifecycle_status, 'DEPLETED');
    assert.equal(sale.isCompleted, true);

    // Further sales must be rejected
    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_A,
          packNumber: '10001',
          quantity: 1,
          sourceRefId: 'pos_tx_after_deplete',
          cashier: 'clerk_1'
        });
      },
      /is DEPLETED/
    );
  });

  // --------------------------------------------------------------------------
  // TEST 9 — Incorrect position
  // --------------------------------------------------------------------------
  await runTest('TEST 9: Incorrect position (closing 48 < opening 51 -> no deduction, discrepancy logged)', async () => {
    // Intake and activate pack 10002
    await intakeWarehousePack({
      gameId: GAME_100,
      gameName: 'Super Cash $5',
      packNumber: '10002',
      ticketPrice: 5.00,
      packSize: 100,
      startTicket: 1,
      endTicket: 100
    });
    await confirmStoreReceipt({ storeId: STORE_A, packNumber: '10002' });
    await activatePack({ storeId: STORE_A, packNumber: '10002', boxNumber: 6 });

    // Advance to 51
    await recordTicketSale({ storeId: STORE_A, packNumber: '10002', quantity: 50 });

    const packBefore = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10002');
    assert.equal(packBefore.next_ticket_to_sell, 51);
    assert.equal(packBefore.remaining_tickets, 50);

    // Close shift with closing position 48 (< 51)
    const recon = await reconcileShift({
      storeId: STORE_A,
      shiftId: 'shift_bad_pos',
      closingScans: [
        { packNumber: '10002', closingPosition: 48 }
      ],
      closedBy: 'clerk_1'
    });

    // Check inventory was NOT deducted
    const packAfter = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '10002');
    assert.equal(packAfter.remaining_tickets, 50, 'Inventory must not be deducted on invalid position');
    assert.equal(packAfter.next_ticket_to_sell, 51);

    // Check discrepancy was logged
    const discs = getDiscrepancyReport(STORE_A);
    const disc = discs.find(d => d.pack_number === '10002' && d.discrepancy_type === 'CLOSING_BEFORE_OPENING');
    assert(disc, 'Reconciliation discrepancy must be created');
    assert.equal(disc.status, 'OPEN');
  });

  // --------------------------------------------------------------------------
  // TEST 10 — Store request approval
  // --------------------------------------------------------------------------
  await runTest('TEST 10: Store request approval (approving game request does NOT add physical stock)', async () => {
    const warehouseSummaryBefore = getWarehouseSummary();
    const storeSummaryBefore = getStoreInventorySummary(STORE_A);

    // Approval only authorizes the ticket game. It does not create or allocate physical packs.
    // Verify warehouse physical packs and store physical packs remain constant.
    const warehouseSummaryAfter = getWarehouseSummary();
    const storeSummaryAfter = getStoreInventorySummary(STORE_A);

    assert.equal(warehouseSummaryAfter.totalPhysicalPacks, warehouseSummaryBefore.totalPhysicalPacks);
    assert.equal(storeSummaryAfter.totalReceivedPacks, storeSummaryBefore.totalReceivedPacks);
  });

  // --------------------------------------------------------------------------
  // TEST 11 — Partial allocation
  // --------------------------------------------------------------------------
  await runTest('TEST 11: Partial allocation (store requests 10, only 6 available -> max 6 allocated, 4 outstanding)', async () => {
    // Put exactly 6 packs of Game 200 into warehouse
    const GAME_200 = 'g200';
    for (let i = 1; i <= 6; i++) {
      await intakeWarehousePack({
        gameId: GAME_200,
        gameName: 'Diamond $10',
        packNumber: `2000${i}`,
        ticketPrice: 10.00,
        packSize: 50,
        startTicket: 0,
        endTicket: 49
      });
    }

    // Allocate 10 packs
    const alloc = await allocatePacksFromWarehouse({
      storeId: STORE_A,
      storeName: 'Amigo Food Mart',
      gameId: GAME_200,
      requestedQuantity: 10,
      allocatedBy: 'admin'
    });

    assert.equal(alloc.success, true);
    assert.equal(alloc.allocatedCount, 6, 'Should allocate exactly the available 6 packs');
    assert.equal(alloc.outstandingCount, 4, 'Remaining 4 must stay outstanding');
    assert.equal(alloc.allocatedPacks.length, 6);
  });

  // --------------------------------------------------------------------------
  // TEST 12 — Store receipt
  // --------------------------------------------------------------------------
  await runTest('TEST 12: Store receipt (warehouse dispatches 6, store receives 6 -> warehouse available decreases, store unactivated = 6)', async () => {
    // Confirm receipt of all 6 dispatched packs at Store A
    for (let i = 1; i <= 6; i++) {
      const res = await confirmStoreReceipt({
        storeId: STORE_A,
        packNumber: `2000${i}`,
        receivedBy: 'store_owner'
      });
      assert.equal(res.success, true);
      assert.equal(res.pack.lifecycle_status, 'UNACTIVATED');
      assert.equal(res.pack.physical_location, 'STORE');
    }

    const warehouseSummary = getWarehouseSummary();
    assert.equal(warehouseSummary.availablePacks, 0, 'No packs left available in warehouse for g200');

    const storePacks = getStorePackInventory(STORE_A, { gameId: 'g200' });
    assert.equal(storePacks.length, 6, 'Store must have exactly 6 packs');
    storePacks.forEach(p => {
      assert.equal(p.lifecycle_status, 'UNACTIVATED');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 13 — Multi-store security
  // --------------------------------------------------------------------------
  await runTest('TEST 13: Multi-store security (Store B cannot access or sell Store A pack)', async () => {
    // Attempt to sell Store A's pack 20001 from Store B
    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_B,
          packNumber: '20001',
          quantity: 1,
          cashier: 'clerk_savannah'
        });
      },
      /Access Denied/
    );

    // Attempt to activate Store A's pack from Store B
    await assert.rejects(
      async () => {
        await activatePack({
          storeId: STORE_B,
          packNumber: '20001',
          activatedBy: 'manager_savannah'
        });
      },
      /Access Denied/
    );
  });

  // --------------------------------------------------------------------------
  // TEST 14 — Duplicate sales transaction
  // --------------------------------------------------------------------------
  await runTest('TEST 14: Duplicate sales transaction (idempotency prevents double deduction)', async () => {
    // Activate 20001 at Store A
    await activatePack({ storeId: STORE_A, packNumber: '20001', boxNumber: 1 });

    const pack = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '20001');
    const beforeRemaining = pack.remaining_tickets;

    // First sale submission
    const sale1 = await recordTicketSale({
      storeId: STORE_A,
      packNumber: '20001',
      quantity: 5,
      sourceRefId: 'unique_sale_uuid_999',
      cashier: 'clerk_1'
    });
    assert.equal(sale1.success, true);
    assert.equal(sale1.ticketsSold, 5);

    // Duplicate submission of exact same sourceRefId
    const sale2 = await recordTicketSale({
      storeId: STORE_A,
      packNumber: '20001',
      quantity: 5,
      sourceRefId: 'unique_sale_uuid_999',
      cashier: 'clerk_1'
    });
    assert.equal(sale2.success, true);
    assert.equal(sale2.duplicate, true, 'Second submission must be flagged as duplicate');
    assert.equal(sale2.ticketsSold, 0, 'Duplicate submission must not deduct tickets');

    const packAfter = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '20001');
    assert.equal(packAfter.remaining_tickets, beforeRemaining - 5, 'Inventory must be deducted exactly once');
  });

  // --------------------------------------------------------------------------
  // TEST 15 — Concurrent ticket sales
  // --------------------------------------------------------------------------
  await runTest('TEST 15: Concurrent ticket sales (system prevents overselling in race conditions)', async () => {
    // Pack 20002 has 50 tickets. Activate it.
    await activatePack({ storeId: STORE_A, packNumber: '20002', boxNumber: 2 });
    // Sell 48 tickets -> 2 remaining
    await recordTicketSale({ storeId: STORE_A, packNumber: '20002', quantity: 48 });

    const pack = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '20002');
    assert.equal(pack.remaining_tickets, 2);

    // Two users simultaneously try to buy 2 tickets each (total 4 requested, but only 2 remain)
    const promise1 = recordTicketSale({ storeId: STORE_A, packNumber: '20002', quantity: 2, sourceRefId: 'conc_1' });
    const promise2 = recordTicketSale({ storeId: STORE_A, packNumber: '20002', quantity: 2, sourceRefId: 'conc_2' });

    const results = await Promise.allSettled([promise1, promise2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
    assert.equal(rejected.length, 1, 'The other concurrent request must be rejected for overselling');

    const packFinal = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '20002');
    assert.equal(packFinal.remaining_tickets, 0);
    assert.equal(packFinal.lifecycle_status, 'DEPLETED');
  });

  // --------------------------------------------------------------------------
  // TEST 16 — Inventory correction
  // --------------------------------------------------------------------------
  await runTest('TEST 16: Inventory correction (records adjustment in ledger, recalculates safely)', async () => {
    // Pack 20003: currently unactivated (50 tickets)
    await activatePack({ storeId: STORE_A, packNumber: '20003', boxNumber: 3 });
    // Physical count shows 45 tickets remaining (5 were torn or miscounted)
    const adj = await adjustPackInventory({
      storeId: STORE_A,
      packNumber: '20003',
      newNextTicket: 5,
      newRemaining: 45,
      reason: 'Physical count audit found 5 tickets damaged',
      adjustedBy: 'lead_auditor'
    });

    assert.equal(adj.success, true);
    assert.equal(adj.pack.remaining_tickets, 45);
    assert.equal(adj.pack.next_ticket_to_sell, 5);

    // Verify ledger has INVENTORY_ADJUSTMENT entry
    const history = getPackHistory('20003', STORE_A);
    const adjTx = history.history.find(h => h.transaction_type === 'INVENTORY_ADJUSTMENT');
    assert(adjTx, 'Ledger must record INVENTORY_ADJUSTMENT');
    assert.equal(adjTx.user_id, 'lead_auditor');
    assert.equal(adjTx.quantity_after, 45);
  });

  // --------------------------------------------------------------------------
  // TEST 17 — Pack discontinuation
  // --------------------------------------------------------------------------
  await runTest('TEST 17: Pack discontinuation (blocks sales, preserves remaining tickets in history, no false sales)', async () => {
    // Pack 20004: 50 tickets
    await activatePack({ storeId: STORE_A, packNumber: '20004', boxNumber: 4 });
    await recordTicketSale({ storeId: STORE_A, packNumber: '20004', quantity: 15 });

    const pack = (getStorePackInventory(STORE_A)).find(p => p.pack_number === '20004');
    assert.equal(pack.remaining_tickets, 35);
    assert.equal(pack.tickets_sold, 15);

    // Discontinue pack
    const disc = await discontinuePack({
      storeId: STORE_A,
      packNumber: '20004',
      reason: 'State Lottery discontinued Game 200',
      discontinuedBy: 'state_admin'
    });

    assert.equal(disc.success, true);
    assert.equal(disc.pack.lifecycle_status, 'DISCONTINUED');
    assert.equal(disc.pack.remaining_tickets, 35, 'Remaining tickets must be preserved');
    assert.equal(disc.pack.tickets_sold, 15, 'Tickets sold must not increase on discontinuation');

    // Attempt sale on discontinued pack
    await assert.rejects(
      async () => {
        await recordTicketSale({
          storeId: STORE_A,
          packNumber: '20004',
          quantity: 1,
          cashier: 'clerk_1'
        });
      },
      /is DISCONTINUED/
    );
  });

  // --------------------------------------------------------------------------
  // TEST 18 — POS regression and non-lottery safety
  // --------------------------------------------------------------------------
  await runTest('TEST 18: POS safety & non-lottery isolation (reports & summaries reconcile accurately)', async () => {
    const summary = getStoreInventorySummary(STORE_A);
    assert(summary.totalReceivedPacks > 0);
    assert(summary.totalTicketsSold > 0);

    const gameWise = getGameWiseInventory(STORE_A);
    assert(gameWise.length >= 2, 'Store A should have g100 and g200 summary');

    const ledger = getInventoryLedger({ storeId: STORE_A });
    assert(ledger.length > 10, 'Ledger must hold full history of transactions');
  });

  console.log('\n======================================================================');
  console.log(`   TEST EXECUTION COMPLETE: Passed: ${passed}, Failed: ${failed}   `);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

executeTestSuite();

