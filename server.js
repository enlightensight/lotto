import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Number parsing utilities to ensure zero NaNs in database
const parseNum = (val, defaultVal = 0) => {
  if (val === null || val === undefined || val === '' || val === '-') return defaultVal;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? defaultVal : n;
};

const parseIntSafe = (val, defaultVal = 0) => {
  if (val === null || val === undefined || val === '' || val === '-') return defaultVal;
  const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? defaultVal : n;
};

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'lotto_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true
};

let pool = null;
let isDbConnected = false;
let dbLastError = null;

// Initialize Database, Tables & Clean Views
async function initDatabase() {
  try {
    // 1. Ensure database exists
    const adminConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await adminConnection.end();

    // 2. Connect pool
    pool = mysql.createPool(dbConfig);

    // 3. Execute clean schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('✅ [MySQL] Enterprise database schema and human-readable views verified.');
    }

    isDbConnected = true;
    dbLastError = null;
    console.log(`✅ [MySQL] Connected to database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);

    // 4. Run automatic data migration & purge empty boxes
    await migrateCleanData(pool);
  } catch (err) {
    isDbConnected = false;
    dbLastError = err.message;
    console.warn(`⚠️ [MySQL] Connection error at ${dbConfig.host}:${dbConfig.port}: ${err.message}`);
  }
}

// Automatic Data Migration Helper - Purges empty boxes and ensures Date field is populated
async function migrateCleanData(db) {
  try {
    // 1. Ensure columns exist before cleanup
    try {
      await db.query(`ALTER TABLE day_box_sales ADD COLUMN IF NOT EXISTS \`date\` VARCHAR(20) NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE shift_box_sales ADD COLUMN IF NOT EXISTS \`date\` VARCHAR(30) NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE active_dispensers ADD COLUMN IF NOT EXISTS \`date\` DATE NOT NULL DEFAULT (CURRENT_DATE)`);
    } catch (_) {}

    // 2. PURGE ALL EMPTY BOXES from existing database
    await db.query(`
      DELETE FROM day_box_sales 
      WHERE game_name = 'EMPTY' 
         OR game_name = 'Empty Slot' 
         OR pack_number = '---' 
         OR pack_number IS NULL
    `);

    await db.query(`
      DELETE FROM shift_box_sales 
      WHERE game_name = 'EMPTY' 
         OR game_name = 'Empty Slot' 
         OR pack_number = '---' 
         OR pack_number IS NULL
    `);

    await db.query(`
      DELETE FROM active_dispensers 
      WHERE game_name IS NULL 
         OR game_name = 'EMPTY' 
         OR game_name = 'Empty Slot' 
         OR pack_number IS NULL 
         OR pack_number = '---'
    `);

    // 3. Populate missing dates in day_box_sales from daily_reports
    await db.query(`
      UPDATE day_box_sales dbs
      INNER JOIN daily_reports dr ON dbs.report_id = dr.id
      SET dbs.date = dr.report_date
      WHERE dbs.date = '' OR dbs.date IS NULL
    `);

    // 4. Populate missing dates in shift_box_sales from shift_reports
    await db.query(`
      UPDATE shift_box_sales sbs
      INNER JOIN shift_reports sr ON sbs.shift_id = sr.id
      SET sbs.date = COALESCE(sr.shift_date, sr.started_at, 'CURRENT')
      WHERE sbs.date = '' OR sbs.date IS NULL
    `);

    // 5. Migrate any un-migrated daily reports (WITHOUT empty boxes)
    const [dReports] = await db.query('SELECT * FROM daily_reports');
    for (const dr of dReports) {
      const [existing] = await db.query('SELECT COUNT(*) as c FROM day_box_sales WHERE report_id = ?', [dr.id]);
      if (existing[0].c === 0 && dr.boxes_data) {
        let boxes = [];
        try { boxes = JSON.parse(dr.boxes_data); } catch (_) {}
        for (const b of boxes) {
          // SKIP EMPTY BOXES
          if (b.isEmpty || !b.name || b.name === 'EMPTY' || !b.pack || b.pack === '---') continue;

          if (b.isMultiPack && Array.isArray(b.subRows)) {
            for (const sr of b.subRows) {
              if (!sr.name || sr.name === 'EMPTY' || !sr.pack || sr.pack === '---') continue;
              const openT = parseIntSafe(sr.open, 0);
              const closeT = parseIntSafe(sr.close, 0);
              const sold = Math.max(0, closeT - openT);
              await db.query(
                `INSERT INTO day_box_sales (
                  report_id, date, box_number, game_name, pack_number, ticket_price,
                  opening_ticket, closing_ticket, tickets_sold, sales_amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  dr.id, dr.report_date, b.box, sr.name, sr.pack,
                  parseNum(sr.price, 0), openT, closeT, sold,
                  parseNum(sr.total, 0)
                ]
              );
            }
          } else {
            const openT = parseIntSafe(b.open, 0);
            const closeT = parseIntSafe(b.close, 0);
            const sold = Math.max(0, closeT - openT);
            await db.query(
              `INSERT INTO day_box_sales (
                report_id, date, box_number, game_name, pack_number, ticket_price,
                opening_ticket, closing_ticket, tickets_sold, sales_amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                dr.id, dr.report_date, b.box, b.name,
                b.pack, parseNum(b.price, 0), openT, closeT,
                sold, parseNum(b.total, 0)
              ]
            );
          }
        }
      }
    }

    // 6. Migrate any un-migrated shift reports (WITHOUT empty boxes)
    const [sReports] = await db.query('SELECT * FROM shift_reports');
    for (const sr of sReports) {
      const [existing] = await db.query('SELECT COUNT(*) as c FROM shift_box_sales WHERE shift_id = ?', [sr.id]);
      if (existing[0].c === 0 && sr.slots_snapshot) {
        let slots = [];
        try { slots = JSON.parse(sr.slots_snapshot); } catch (_) {}
        const sDate = sr.shift_date || (sr.started_at ? String(sr.started_at).slice(0, 10) : new Date().toLocaleDateString('en-US'));
        for (const s of slots) {
          // SKIP EMPTY BOXES
          if (!s.packNumber || s.packNumber === '---' || s.status === 'EMPTY' || !s.gameName || s.gameName === 'Empty Slot') continue;

          const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
          const amt = sold * parseNum(s.price, 0);
          await db.query(
            `INSERT INTO shift_box_sales (
              shift_id, shift_number, date, box_number, game_name, pack_number,
              ticket_price, start_ticket, close_ticket, tickets_sold, sales_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sr.id, sr.shift_number, sDate, s.boxNumber, s.gameName,
              s.packNumber, parseNum(s.price, 0), s.startTicket || 0,
              s.currentTicket || 0, sold, amt
            ]
          );
        }
      }
    }

    // 7. Sync active dispensers from pos_state (ONLY loaded active boxes)
    const [pState] = await db.query('SELECT state_data FROM pos_state WHERE id = 1');
    if (pState.length > 0 && pState[0].state_data) {
      let state = {};
      try { state = JSON.parse(pState[0].state_data); } catch (_) {}
      await syncStateToNormalizedTables(state, db);
    }
  } catch (err) {
    console.warn('⚠️ [MySQL Migration] Notice during database cleanup:', err.message);
  }
}

// Sync POS state to active_dispensers (ONLY ACTIVE LOADED BOXES - ZERO EMPTY BOXES)
async function syncStateToNormalizedTables(state, db) {
  if (!state || !db) return;

  if (Array.isArray(state.slots)) {
    const activeBoxNums = [];

    for (const s of state.slots) {
      const isActive = (s.status === 'ACTIVE' || s.status === 'SOLD_OUT') &&
                       s.packNumber && s.packNumber !== '---' &&
                       s.gameName && s.gameName !== 'EMPTY' && s.gameName !== 'Empty Slot' &&
                       !s.isEmpty;

      if (!isActive) {
        // Remove empty box from active_dispensers table
        await db.query('DELETE FROM active_dispensers WHERE box_number = ?', [s.boxNumber]);
      } else {
        activeBoxNums.push(s.boxNumber);
        const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
        const rem = Math.max(0, (s.packSize || 0) - (s.currentTicket || 0));
        const amt = sold * parseNum(s.price, 0);

        await db.query(
          `INSERT INTO active_dispensers (
            box_number, date, game_name, ticket_price, pack_number,
            start_ticket, current_ticket, tickets_sold, tickets_remaining, sales_revenue
          ) VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            date=CURRENT_DATE(),
            game_name=VALUES(game_name),
            ticket_price=VALUES(ticket_price),
            pack_number=VALUES(pack_number),
            start_ticket=VALUES(start_ticket),
            current_ticket=VALUES(current_ticket),
            tickets_sold=VALUES(tickets_sold),
            tickets_remaining=VALUES(tickets_remaining),
            sales_revenue=VALUES(sales_revenue)`,
          [
            s.boxNumber, s.gameName, parseNum(s.price, 0),
            s.packNumber, s.startTicket || 0, s.currentTicket || 0,
            sold, rem, amt
          ]
        );
      }
    }

    // Clean any boxes not in active list
    if (activeBoxNums.length > 0) {
      await db.query('DELETE FROM active_dispensers WHERE box_number NOT IN (?)', [activeBoxNums]);
    } else {
      await db.query('DELETE FROM active_dispensers');
    }
  }

  // 2. Sync reserve inventory packs
  if (Array.isArray(state.inventory)) {
    for (const inv of state.inventory) {
      if (!inv.packNumber) continue;
      const pPrice = parseNum(inv.price, 1);
      const pSize = inv.packSize || (pPrice >= 50 ? 18 : Math.floor(300 / pPrice));
      const todayStr = new Date().toLocaleDateString('en-US');

      await db.query(
        `INSERT INTO store_inventory (
          date_received, pack_number, game_name, ticket_price, pack_size, location
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          game_name=VALUES(game_name),
          ticket_price=VALUES(ticket_price),
          pack_size=VALUES(pack_size),
          location=VALUES(location)`,
        [
          todayStr, inv.packNumber, inv.gameName || 'Scratch Off',
          pPrice, pSize, inv.status === 'SAFE' ? 'SAFE' : 'STORAGE'
        ]
      );
    }
  }
}

// =============================================================
// API ROUTES
// =============================================================

// 1. Health & Connection Status Check
app.get('/api/db-status', async (req, res) => {
  if (!pool) {
    return res.json({ connected: false, message: 'MySQL Pool is not initialized.', error: dbLastError });
  }
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    isDbConnected = true;
    dbLastError = null;
    res.json({
      connected: true,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      status: 'Online & Synced'
    });
  } catch (err) {
    isDbConnected = false;
    dbLastError = err.message;
    res.status(500).json({ connected: false, error: err.message });
  }
});

// 2. Save Daily Report (Saves Parent + Itemized Active Box Sales with Date)
app.post('/api/save-day-report', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });

  try {
    const d = req.body;
    const reportDate = d.reportDate || new Date().toLocaleDateString('en-US');
    const reportTime = d.reportTime || new Date().toLocaleTimeString('en-US');
    const net = (parseNum(d.totalSales, 0) || (parseNum(d.totalScratcherSales, 0) + parseNum(d.onlineSales, 0))) -
                (parseNum(d.totalCashes, 0) || (parseNum(d.cashes, 0) + parseNum(d.onlineCashes, 0)));

    const query = `
      INSERT INTO daily_reports (
        report_date, report_time, cashier, store_name, total_scratcher_sales,
        online_sales, cashes, total_sales, net_balance, boxes_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      reportDate,
      reportTime,
      d.userId || 'master',
      d.storeName || 'AMIGO FOOD MART',
      parseNum(d.totalScratcherSales, 0),
      parseNum(d.onlineSales, 0),
      parseNum(d.cashes, 0) + parseNum(d.onlineCashes, 0),
      parseNum(d.totalSales, 0),
      net,
      JSON.stringify(d.boxes || [])
    ]);

    const reportId = result.insertId;

    // Insert Itemized Day Box Sales (NO EMPTY BOXES - DATE ALWAYS INCLUDED)
    if (Array.isArray(d.boxes) && d.boxes.length > 0) {
      for (const b of d.boxes) {
        // Skip empty dispenser boxes
        if (b.isEmpty || !b.name || b.name === 'EMPTY' || !b.pack || b.pack === '---') continue;

        if (b.isMultiPack && Array.isArray(b.subRows)) {
          for (const sr of b.subRows) {
            if (!sr.name || sr.name === 'EMPTY' || !sr.pack || sr.pack === '---') continue;
            const openT = parseIntSafe(sr.open, 0);
            const closeT = parseIntSafe(sr.close, 0);
            const sold = Math.max(0, closeT - openT);
            await pool.query(
              `INSERT INTO day_box_sales (
                report_id, date, box_number, game_name, pack_number, ticket_price,
                opening_ticket, closing_ticket, tickets_sold, sales_amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                reportId, reportDate, b.box, sr.name, sr.pack,
                parseNum(sr.price, 0), openT, closeT, sold,
                parseNum(sr.total, 0)
              ]
            );
          }
        } else {
          const openT = parseIntSafe(b.open, 0);
          const closeT = parseIntSafe(b.close, 0);
          const sold = Math.max(0, closeT - openT);
          await pool.query(
            `INSERT INTO day_box_sales (
              report_id, date, box_number, game_name, pack_number, ticket_price,
              opening_ticket, closing_ticket, tickets_sold, sales_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reportId, reportDate, b.box, b.name,
              b.pack, parseNum(b.price, 0), openT, closeT,
              sold, parseNum(b.total, 0)
            ]
          );
        }
      }
    }

    res.json({ success: true, insertId: reportId, message: 'Daily report saved with date and active boxes!' });
  } catch (err) {
    console.error('Error saving daily report to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Daily Reports
app.get('/api/day-reports', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM daily_reports ORDER BY id DESC LIMIT 100');
    res.json({ success: true, reports: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Itemized Box Sales for a Day Report
app.get('/api/day-report/:id/boxes', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM day_box_sales WHERE report_id = ? ORDER BY box_number', [req.params.id]);
    res.json({ success: true, boxes: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Save Shift Report (Saves Parent + Itemized Active Box Sales with Date)
app.post('/api/save-shift-report', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });

  try {
    const h = req.body;
    const floatVal = parseNum(h.drawerFloat, 0);
    const lottoSales = parseNum(h.totalSalesRevenue, 0);
    const cashes = parseNum(h.cashes, 0);
    const expectedCash = floatVal + lottoSales - cashes;
    const actualCash = parseNum(h.actualCashCounted, expectedCash);
    const overShort = actualCash - expectedCash;
    const shiftDate = h.endedAt ? String(h.endedAt).slice(0, 10) : (h.startedAt ? String(h.startedAt).slice(0, 10) : new Date().toLocaleDateString('en-US'));

    const query = `
      INSERT INTO shift_reports (
        shift_number, shift_date, cashier, tickets_sold, total_sales,
        cashes, drawer_float, actual_cash_counted, expected_cash,
        drawer_over_short, slots_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      parseIntSafe(h.shiftNumber, 1),
      shiftDate,
      h.cashier || 'master',
      parseIntSafe(h.totalTicketsSold, 0),
      lottoSales,
      cashes,
      floatVal,
      actualCash,
      expectedCash,
      overShort,
      JSON.stringify(h.slots || [])
    ]);

    const shiftId = result.insertId;

    // Insert Itemized Shift Box Sales (NO EMPTY BOXES - DATE ALWAYS INCLUDED)
    if (Array.isArray(h.slots) && h.slots.length > 0) {
      for (const s of h.slots) {
        // Skip empty dispenser boxes
        if (!s.packNumber || s.packNumber === '---' || s.status === 'EMPTY' || !s.gameName || s.gameName === 'Empty Slot') continue;

        const sold = Math.max(0, (s.currentTicket || 0) - (s.startTicket || 0));
        const amt = sold * parseNum(s.price, 0);
        await pool.query(
          `INSERT INTO shift_box_sales (
            shift_id, shift_number, date, box_number, game_name, pack_number,
            ticket_price, start_ticket, close_ticket, tickets_sold, sales_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shiftId, parseIntSafe(h.shiftNumber, 1), shiftDate, s.boxNumber,
            s.gameName, s.packNumber, parseNum(s.price, 0),
            s.startTicket || 0, s.currentTicket || 0, sold, amt
          ]
        );
      }
    }

    res.json({ success: true, insertId: shiftId, message: 'Shift report saved with date and active boxes!' });
  } catch (err) {
    console.error('Error saving shift report to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get All Shift Reports
app.get('/api/shift-reports', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM shift_reports ORDER BY shift_number DESC LIMIT 100');
    res.json({ success: true, shifts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get Itemized Box Sales for a Shift
app.get('/api/shift-report/:id/boxes', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM shift_box_sales WHERE shift_id = ? ORDER BY box_number', [req.params.id]);
    res.json({ success: true, boxes: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Full POS State Sync (Synchronizes active loaded boxes with Date)
app.post('/api/sync-pos-state', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });

  try {
    const stateObj = req.body;
    const stateJson = JSON.stringify(stateObj);

    // 1. Raw backup
    await pool.query(
      `INSERT INTO pos_state (id, state_data) VALUES (1, ?)
       ON DUPLICATE KEY UPDATE state_data = VALUES(state_data)`,
      [stateJson]
    );

    // 2. Real tabular synchronization of active boxes
    await syncStateToNormalizedTables(stateObj, pool);

    res.json({ success: true, message: 'Active dispensers and state synchronized to MySQL!' });
  } catch (err) {
    console.error('Error synchronizing POS state to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Load POS State from MySQL
app.get('/api/load-pos-state', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT state_data, updated_at FROM pos_state WHERE id = 1');
    if (rows.length > 0 && rows[0].state_data) {
      const stateObj = JSON.parse(rows[0].state_data);
      res.json({ success: true, state: stateObj, updatedAt: rows[0].updated_at });
    } else {
      res.json({ success: false, message: 'No stored state found in MySQL.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Live Active Dispenser Rack (Only Loaded Boxes)
app.get('/api/active-dispensers', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM active_dispensers ORDER BY box_number');
    res.json({ success: true, dispensers: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Store Inventory (Table Query)
app.get('/api/inventory', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const [rows] = await pool.query('SELECT * FROM store_inventory ORDER BY location, id DESC');
    res.json({ success: true, inventory: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Log Ticket Scan / Sale with Date & Time
app.post('/api/log-scan', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  try {
    const s = req.body;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US');
    const timeStr = now.toLocaleTimeString('en-US');

    await pool.query(
      `INSERT INTO ticket_scans_log (
        date, time, barcode, box_number, game_name, pack_number,
        ticket_number, ticket_price, cashier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dateStr, timeStr, s.barcode || 'UNKNOWN', s.boxNumber || 0,
        s.gameName || 'Scratch Off', s.packNumber || '---',
        parseIntSafe(s.ticketNumber, 0), parseNum(s.price, 0),
        s.cashier || 'master'
      ]
    );
    res.json({ success: true, message: 'Scan logged to database.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Query Human-Readable SQL Views Directly
app.get('/api/views/:viewName', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ success: false, message: 'MySQL is offline.' });
  const allowedViews = [
    'v_current_dispenser_rack',
    'v_daily_sales_overview',
    'v_shift_settlement_audit',
    'v_top_selling_games'
  ];
  const { viewName } = req.params;
  if (!allowedViews.includes(viewName)) {
    return res.status(400).json({ success: false, message: 'Invalid view name. Allowed: ' + allowedViews.join(', ') });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${viewName}\` LIMIT 200`);
    res.json({ success: true, view: viewName, rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start listening and initialize DB
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 LottoTrack Backend API Server running at http://localhost:${PORT}`);
  });
});
