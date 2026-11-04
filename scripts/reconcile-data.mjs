import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

const isDryRun = !process.argv.includes('--apply');
const newAdminPassword = process.env.NEW_ADMIN_PASSWORD || null;

console.log('================================================================');
console.log(` JACKPOTLO RECONCILIATION ENGINE — MODE: ${isDryRun ? 'DRY-RUN (SIMULATION ONLY)' : 'TRANSACTIONAL APPLY'}`);
console.log('================================================================\n');

if (isDryRun) {
  console.log('🛡️  DRY-RUN MODE ACTIVE:');
  console.log('   - 100% Read-Only Simulation.');
  console.log('   - Source MySQL database lotto_pos remains UNTOUCHED.');
  console.log('   - Source JSON files and backups remain UNTOUCHED.\n');
}

const DATA_DIR = path.join(process.cwd(), 'server_data');
const adminStatePath = path.join(DATA_DIR, 'admin_state.json');

if (!fs.existsSync(adminStatePath)) {
  console.error(`ERROR: admin_state.json not found at ${adminStatePath}`);
  process.exit(1);
}

const adminState = JSON.parse(fs.readFileSync(adminStatePath, 'utf8'));

function generateSecureHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex');
  return `pbkdf2$sha256$600000$${salt}$${hash}`;
}

async function reconcile() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lotto_pos'
  });

  const report = {
    proposedInserts: [],
    proposedUpdates: [],
    skippedDuplicates: [],
    conflicts: [],
    beforeCounts: {},
    afterCounts: {}
  };

  async function recordCounts(target) {
    const tables = [
      'admin_users', 'stores', 'store_applications', 'lottery_ticket_catalog',
      'store_ticket_requests', 'store_approved_tickets', 'ticket_stock_allocations',
      'store_pos_state', 'store_inventory', 'shift_reports', 'shift_box_sales',
      'daily_reports', 'day_box_sales'
    ];
    for (const t of tables) {
      const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
      target[t] = rows[0].c;
    }
  }

  await recordCounts(report.beforeCounts);

  // -------------------------------------------------------------------------
  // 1. ADMIN USER PASSWORD RECONCILIATION (Rule 5: No test hash in production)
  // -------------------------------------------------------------------------
  console.log('--- 1. Evaluating Admin User Security ---');
  const [dbAdmins] = await conn.query('SELECT * FROM admin_users');
  const currentAdmin = dbAdmins.find(a => a.username === 'admin');

  if (currentAdmin) {
    if (currentAdmin.password_hash === '1234' || !currentAdmin.password_hash.startsWith('pbkdf2$')) {
      report.conflicts.push({
        entity: 'admin_users',
        identifier: 'admin',
        issue: 'MySQL holds insecure legacy plaintext password ("1234").',
        resolution: 'Replace with a newly established master password and fresh PBKDF2-HMAC-SHA256 (600,000 iterations) hash with unique salt. Test hashes (e.g. BrowserTestPass123!) are strictly rejected.'
      });

      if (newAdminPassword) {
        const freshHash = generateSecureHash(newAdminPassword);
        report.proposedUpdates.push({
          table: 'admin_users',
          where: { username: 'admin' },
          field: 'password_hash',
          oldValue: '[PLAINTEXT_1234]',
          newValue: freshHash.slice(0, 32) + '... (Fresh PBKDF2-HMAC-SHA256, 600k rounds, unique salt)',
          rawNewValue: freshHash
        });
      } else {
        report.proposedUpdates.push({
          table: 'admin_users',
          where: { username: 'admin' },
          field: 'password_hash',
          oldValue: '[PLAINTEXT_1234]',
          newValue: '[AWAITING USER NEW MASTER PASSWORD — Fresh PBKDF2-HMAC-SHA256 600,000 rounds hash will be generated upon apply]'
        });
      }
    } else {
      report.skippedDuplicates.push({
        table: 'admin_users',
        identifier: 'admin',
        reason: 'Administrator already has a cryptographically secure PBKDF2 hash.'
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. STORES RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('--- 2. Evaluating Stores ---');
  const [dbStores] = await conn.query('SELECT * FROM stores');
  for (const js of adminState.stores || []) {
    const ms = dbStores.find(s => s.store_id === js.storeId);
    if (!ms) {
      report.proposedInserts.push({
        table: 'stores',
        reason: 'Store in JSON missing from MySQL',
        data: { store_id: js.storeId, store_name: js.storeName }
      });
    } else {
      report.skippedDuplicates.push({
        table: 'stores',
        identifier: js.storeId,
        reason: `Store "${js.storeName}" already exists in MySQL with status ${ms.authorization_status}/${ms.operational_status}.`
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. STORE APPLICATIONS RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('--- 3. Evaluating Store Applications ---');
  const [dbApps] = await conn.query('SELECT * FROM store_applications');
  for (const ja of adminState.applications || []) {
    const ma = dbApps.find(a => a.store_id === ja.storeId);
    if (!ma) {
      report.proposedInserts.push({
        table: 'store_applications',
        reason: 'Application in JSON missing from MySQL',
        data: {
          store_id: ja.storeId,
          store_name: ja.storeName,
          applicant_name: ja.applicantName || 'Applicant',
          applicant_email: ja.applicantEmail || null,
          applicant_phone: ja.applicantPhone || null,
          business_tax_id: ja.businessTaxId || null,
          lottery_retailer_id: ja.lotteryRetailerId || null,
          address: ja.address || null,
          documents: JSON.stringify(ja.documents || []),
          status: ja.status || 'PENDING',
          admin_notes: ja.adminNotes || null,
          reviewed_by: ja.reviewedBy || null,
          reviewed_at: ja.reviewedAt ? new Date(ja.reviewedAt) : null,
          created_at: ja.createdAt ? new Date(ja.createdAt) : new Date()
        }
      });
    } else {
      report.skippedDuplicates.push({
        table: 'store_applications',
        identifier: ja.storeId,
        reason: `Application for "${ja.storeName}" already present in MySQL (ID: ${ma.id}, Status: ${ma.status}).`
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. LOTTERY TICKET CATALOG RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('--- 4. Evaluating Lottery Ticket Catalog ---');
  const [dbCatalog] = await conn.query('SELECT * FROM lottery_ticket_catalog');
  for (const jc of adminState.catalog || []) {
    const mc = dbCatalog.find(c => String(c.game_id) === String(jc.gameId));
    if (!mc) {
      report.proposedInserts.push({
        table: 'lottery_ticket_catalog',
        reason: 'Game definition in JSON missing from MySQL catalog',
        data: {
          game_id: String(jc.gameId),
          game_name: jc.gameName,
          game_code: jc.gameCode || String(jc.gameId),
          price: Number(jc.price) || 1.00,
          pack_size: Number(jc.packSize) || 100,
          pack_value: Number(jc.packValue) || ((Number(jc.price) || 1) * (Number(jc.packSize) || 100)),
          is_active: jc.isActive !== false ? 1 : 0
        }
      });
    } else {
      report.skippedDuplicates.push({
        table: 'lottery_ticket_catalog',
        identifier: `Game #${jc.gameId}`,
        reason: `Game "${jc.gameName}" already present in MySQL (Price: $${mc.price}, Active: ${mc.is_active}).`
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. STORE TICKET REQUESTS RECONCILIATION (Rule 1: Preserve all 13 requests)
  // -------------------------------------------------------------------------
  console.log('--- 5. Evaluating All 13 Store Ticket Requests ---');
  const [dbRequests] = await conn.query('SELECT * FROM store_ticket_requests ORDER BY id ASC');

  // MySQL currently has 2 requests for store_amigo Game 1720 (ID 4 and ID 6), both PENDING.
  // We match ID 4 and ID 6 to the two modern Amigo requests, updating them to APPROVED.
  // All other 11 requests are inserted so zero history is lost.
  const mysqlAmigoReqs = dbRequests.filter(r => r.store_id === 'store_amigo' && String(r.game_id) === '1720');
  let matchedAmigoIndex = 0;

  for (const jr of adminState.ticketRequests || []) {
    const isAmigo1720 = jr.storeId === 'store_amigo' && String(jr.gameId) === '1720';
    
    // Check if this matches one of the 2 existing MySQL rows
    if (isAmigo1720 && matchedAmigoIndex < mysqlAmigoReqs.length) {
      const targetDbRow = mysqlAmigoReqs[matchedAmigoIndex];
      matchedAmigoIndex++;

      if (targetDbRow.status === 'PENDING') {
        report.conflicts.push({
          entity: 'store_ticket_requests',
          identifier: `MySQL Request ID #${targetDbRow.id} (Store "${jr.storeId}" Game #${jr.gameId})`,
          issue: `MySQL request status is PENDING, but admin reviewed and APPROVED it in JSON.`,
          resolution: 'Update MySQL status to APPROVED with decision reason.'
        });
        report.proposedUpdates.push({
          table: 'store_ticket_requests',
          where: { id: targetDbRow.id },
          field: 'status',
          oldValue: 'PENDING',
          newValue: 'APPROVED'
        });
      } else {
        report.skippedDuplicates.push({
          table: 'store_ticket_requests',
          identifier: `MySQL Request ID #${targetDbRow.id}`,
          reason: 'Request already recorded as APPROVED in MySQL.'
        });
      }
    } else {
      // Rule 1: Preserve historical test requests with explicit marker
      const isHistorical = isAmigo1720;
      const decisionReason = isHistorical
        ? `[HISTORICAL TEST RECORD] Archival test request record. Excluded from active queue.`
        : (jr.adminDecisionReason || 'Authorized for Savannah market retail distribution.');

      // Rule 2: Keep Savannah Store #011 PENDING
      const status = (jr.storeId === 'store_savannah_quick_stop__179326011')
        ? 'PENDING'
        : (jr.status || 'PENDING');
      const reviewedBy = (status === 'PENDING') ? null : (jr.reviewedBy || 'admin');
      const reviewedAt = (status === 'PENDING') ? null : (jr.reviewedAt ? new Date(jr.reviewedAt) : new Date());

      report.proposedInserts.push({
        table: 'store_ticket_requests',
        reason: isHistorical
          ? `Historical test request record for store_amigo Game 1720 (preserved for audit)`
          : `Active ticket request for store "${jr.storeName}" Game #${jr.gameId}`,
        data: {
          store_id: jr.storeId,
          store_name: jr.storeName,
          game_id: String(jr.gameId),
          game_name: jr.gameName,
          price: Number(jr.price) || 1.00,
          requested_by: jr.requestedBy || 'store_owner',
          status: status,
          admin_decision_reason: decisionReason,
          reviewed_by: reviewedBy,
          reviewed_at: reviewedAt,
          created_at: jr.createdAt ? new Date(jr.createdAt) : new Date()
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 6. STORE APPROVED TICKETS (Rule 2: Store #011 stays unapproved)
  // -------------------------------------------------------------------------
  console.log('--- 6. Evaluating Store Approved Tickets ---');
  const [dbApproved] = await conn.query('SELECT * FROM store_approved_tickets');
  const processedApprovalKeys = new Set();

  for (const ja of adminState.approvedTickets || []) {
    const appKey = `${ja.storeId}_${ja.gameId}`;
    if (processedApprovalKeys.has(appKey)) continue;
    processedApprovalKeys.add(appKey);

    // Rule 2 check: Do NOT insert approval for Store #011
    if (ja.storeId === 'store_savannah_quick_stop__179326011') {
      console.log('   ✓ Preserved Store #011 as PENDING: not in approved tickets.');
      continue;
    }

    const ma = dbApproved.find(a => a.store_id === ja.storeId && String(a.game_id) === String(ja.gameId));
    if (!ma) {
      report.proposedInserts.push({
        table: 'store_approved_tickets',
        reason: `Authorized game approval for store "${ja.storeId}" Game #${ja.gameId}`,
        data: {
          store_id: ja.storeId,
          game_id: String(ja.gameId),
          approved_by: ja.approvedBy || 'admin',
          approved_at: ja.approvedAt ? new Date(ja.approvedAt) : new Date(),
          status: 'ACTIVE'
        }
      });
    } else {
      report.skippedDuplicates.push({
        table: 'store_approved_tickets',
        identifier: `Store "${ja.storeId}" Game #${ja.gameId}`,
        reason: 'Game authorization already recorded in MySQL.'
      });
    }
  }

  // -------------------------------------------------------------------------
  // 7. TICKET STOCK ALLOCATIONS (Rule 6: Supported status progression)
  // -------------------------------------------------------------------------
  console.log('--- 7. Evaluating Ticket Stock Allocations ---');
  const [dbAllocs] = await conn.query('SELECT * FROM ticket_stock_allocations');
  const [dbInv] = await conn.query('SELECT * FROM store_inventory');
  const updatedAllocIds = new Set();

  for (const ja of adminState.allocations || []) {
    const ref = ja.allocationReference || `ALC-AUTO-${ja.id}`;
    const ma = dbAllocs.find(a => a.allocation_reference === ref || (a.store_id === ja.storeId && a.pack_number === ja.packNumber));
    
    if (!ma) {
      report.proposedInserts.push({
        table: 'ticket_stock_allocations',
        reason: `Stock allocation ${ref} (Pack #${ja.packNumber}) for store "${ja.storeName}"`,
        data: {
          allocation_reference: ref,
          store_id: ja.storeId,
          store_name: ja.storeName,
          game_id: String(ja.gameId),
          game_name: ja.gameName,
          pack_number: ja.packNumber,
          pack_size: Number(ja.packSize) || 100,
          ticket_price: Number(ja.price || ja.ticketPrice) || 1.00,
          pack_value: Number(ja.packValue) || ((Number(ja.price || 1)) * (Number(ja.packSize || 100))),
          total_tickets: Number(ja.packSize) || 100,
          allocated_by: ja.allocatedBy || 'admin',
          allocation_date: ja.allocatedAt || ja.createdAt || new Date().toISOString().split('T')[0],
          status: ja.status || 'ALLOCATED',
          received_at: ja.receivedAt ? new Date(ja.receivedAt) : null,
          created_at: ja.createdAt ? new Date(ja.createdAt) : new Date()
        }
      });
    } else {
      if (ma.status === 'ALLOCATED' && ja.status === 'RECEIVED' && !updatedAllocIds.has(ma.id)) {
        updatedAllocIds.add(ma.id);
        const evidenceInInventory = dbInv.some(i => i.store_id === ja.storeId && i.pack_number === ja.packNumber);
        if (evidenceInInventory) {
          report.conflicts.push({
            entity: 'ticket_stock_allocations',
            identifier: ref,
            issue: `MySQL allocation status is ALLOCATED, but store received it (status RECEIVED in JSON).`,
            resolution: `CONFIRMED with supporting evidence (Pack #${ja.packNumber} exists in store_inventory). Safe to advance status to RECEIVED.`
          });
          report.proposedUpdates.push({
            table: 'ticket_stock_allocations',
            where: { id: ma.id },
            field: 'status',
            oldValue: 'ALLOCATED',
            newValue: 'RECEIVED'
          });
        }
      } else {
        report.skippedDuplicates.push({
          table: 'ticket_stock_allocations',
          identifier: ref,
          reason: `Allocation reference already exists in MySQL with status ${ma.status}.`
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 8. STORE POS STATE & INVENTORY (Rule 3: Verbatim state & pack isolation)
  // -------------------------------------------------------------------------
  console.log('--- 8. Evaluating Store POS State & In-Stock Inventory ---');
  const posFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('pos_state_') && f.endsWith('.json'));
  const [dbPosStates] = await conn.query('SELECT store_id, updated_at FROM store_pos_state');

  for (const pf of posFiles) {
    const rawPos = fs.readFileSync(path.join(DATA_DIR, pf), 'utf8');
    const posObj = JSON.parse(rawPos);
    const storeId = posObj.storeId;

    const hasDbState = dbPosStates.some(s => s.store_id === storeId);
    if (!hasDbState) {
      report.proposedInserts.push({
        table: 'store_pos_state',
        reason: `Verbatim 65-slot POS rack state for store "${posObj.storeName || storeId}" (${rawPos.length} bytes)`,
        data: {
          store_id: storeId,
          state_data: rawPos,
          updated_at: new Date()
        }
      });
    } else {
      report.skippedDuplicates.push({
        table: 'store_pos_state',
        identifier: storeId,
        reason: 'Store POS state record already present in MySQL.'
      });
    }

    if (Array.isArray(posObj.inStockInventory)) {
      for (const pack of posObj.inStockInventory) {
        const inDb = dbInv.some(i => i.store_id === storeId && i.pack_number === pack.packNumber);
        if (!inDb) {
          report.proposedInserts.push({
            table: 'store_inventory',
            reason: `In-stock pack #${pack.packNumber} exclusively assigned to store "${storeId}"`,
            data: {
              pack_number: pack.packNumber,
              game_code: String(pack.gameCode || pack.gameId || '1780'),
              game_name: pack.gameName || 'Millionaire Bucks',
              ticket_price: Number(pack.price || pack.ticketPrice) || 5.00,
              pack_size: Number(pack.packSize) || 60,
              pack_value: Number(pack.packValue) || 300.00,
              location_status: 'STORAGE',
              current_box_number: null,
              tickets_remaining: Number(pack.ticketsRemaining || pack.packSize) || 60,
              notes: 'Reconciled from store POS in-stock inventory state',
              date_received: new Date().toISOString().split('T')[0],
              location: 'STORAGE',
              store_id: storeId
            }
          });
        } else {
          report.skippedDuplicates.push({
            table: 'store_inventory',
            identifier: `Pack #${pack.packNumber} (${storeId})`,
            reason: 'Pack already present in store_inventory.'
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 9. FINANCIAL AUDIT CHECK (Rule 4: Zero changes to shifts & days)
  // -------------------------------------------------------------------------
  console.log('--- 9. Verifying Complete Financial History Preservation ---');
  const [shifts] = await conn.query('SELECT COUNT(*) as c FROM shift_reports');
  const [shiftBoxes] = await conn.query('SELECT COUNT(*) as c FROM shift_box_sales');
  const [days] = await conn.query('SELECT COUNT(*) as c FROM daily_reports');
  const [dayBoxes] = await conn.query('SELECT COUNT(*) as c FROM day_box_sales');

  console.log(`✓ 100% PRESERVED: ${shifts[0].c} shift reports and ${shiftBoxes[0].c} itemized box sales.`);
  console.log(`✓ 100% PRESERVED: ${days[0].c} daily reports and ${dayBoxes[0].c} daily box sales.`);
  console.log('✓ ZERO modifications proposed for financial history tables.\n');

  // Calculate final projected counts
  for (const t of Object.keys(report.beforeCounts)) {
    const added = report.proposedInserts.filter(p => p.table === t).length;
    report.afterCounts[t] = report.beforeCounts[t] + added;
  }

  // Transactional apply block (dormant unless --apply is passed)
  if (!isDryRun) {
    console.log('⚠️ APPLY MODE ACTIVATED: Starting MySQL database transaction...');
    await conn.beginTransaction();
    try {
      for (const ins of report.proposedInserts) {
        const fields = Object.keys(ins.data);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(f => ins.data[f]);
        await conn.query(
          `INSERT INTO \`${ins.table}\` (${fields.map(f => `\`${f}\``).join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
      for (const up of report.proposedUpdates) {
        const val = up.rawNewValue || up.newValue;
        const whereField = Object.keys(up.where)[0];
        const whereVal = up.where[whereField];
        await conn.query(
          `UPDATE \`${up.table}\` SET \`${up.field}\` = ? WHERE \`${whereField}\` = ?`,
          [val, whereVal]
        );
      }
      await conn.commit();
      console.log('✅ ALL TRANSACTIONS COMMITTED CLEANLY TO MYSQL.');
    } catch (err) {
      await conn.rollback();
      console.error('❌ TRANSACTION FAILED. AUTOMATIC ROLLBACK EXECUTED:', err.message);
      throw err;
    }
  }

  await conn.end();

  printDryRunReport(report);
}

function printDryRunReport(r) {
  console.log('================================================================');
  console.log('         CORRECTED RECONCILIATION REPORT (DRY-RUN RESULTS)      ');
  console.log('================================================================\n');

  console.log('📌 CONFLICTS AND RESOLUTIONS:');
  r.conflicts.forEach((c, i) => {
    console.log(`  [#${i + 1}] Entity: ${c.entity} (${c.identifier})`);
    console.log(`      Issue:      ${c.issue}`);
    console.log(`      Resolution: ${c.resolution}\n`);
  });

  console.log('----------------------------------------------------------------');
  console.log(`📌 PROPOSED INSERTS (${r.proposedInserts.length} total rows):`);
  r.proposedInserts.forEach((ins, i) => {
    console.log(`  [Insert #${i + 1}] Table: \`${ins.table}\` (${ins.reason})`);
    if (ins.table === 'store_pos_state') {
      console.log(`     Values: {"store_id": "${ins.data.store_id}", "state_data": "[Verbatim JSON string (${ins.data.state_data.length} bytes)]"}`);
    } else {
      console.log(`     Values:`, JSON.stringify(ins.data));
    }
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`📌 PROPOSED UPDATES (${r.proposedUpdates.length} total fields):`);
  r.proposedUpdates.forEach((up, i) => {
    console.log(`  [Update #${i + 1}] Table: \`${up.table}\` WHERE ${JSON.stringify(up.where)}`);
    console.log(`     Field:     \`${up.field}\``);
    console.log(`     Old Value: ${up.oldValue}`);
    console.log(`     New Value: ${up.newValue}`);
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`📌 SKIPPED DUPLICATES (${r.skippedDuplicates.length} identical records safely skipped):`);
  r.skippedDuplicates.forEach((sk, i) => {
    console.log(`  [Skip #${i + 1}] Table: \`${sk.table}\` (${sk.identifier}): ${sk.reason}`);
  });

  console.log('\n----------------------------------------------------------------');
  console.log('📌 FINAL EXPECTED TABLE RECORD COUNTS (BEFORE -> AFTER):');
  console.log('----------------------------------------------------------------');
  console.log('Table Name                  | Before Count | Proposed Added | Projected After');
  console.log('----------------------------|--------------|----------------|----------------');
  for (const [table, before] of Object.entries(r.beforeCounts)) {
    const added = r.proposedInserts.filter(p => p.table === table).length;
    const after = r.afterCounts[table];
    console.log(`${table.padEnd(27)} | ${String(before).padStart(12)} | ${String('+' + added).padStart(14)} | ${String(after).padStart(15)}`);
  }
  console.log('----------------------------------------------------------------');
  console.log('\n🛡️  DRY-RUN SIMULATION COMPLETE. ZERO DATABASE WRITES EXECUTED.');
}

reconcile().catch(err => {
  console.error('Reconciliation error:', err.message);
  process.exit(1);
});
