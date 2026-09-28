import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database configuration (Defaults match standard Windows XAMPP / local MySQL install)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'lotto_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isDbConnected = false;
let dbLastError = null;

// Initialize Database & Tables
async function initDatabase() {
  try {
    // 1. Connect without database to ensure database exists
    const adminConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await adminConnection.end();

    // 2. Connect pool to the database
    pool = mysql.createPool(dbConfig);

    // 3. Create tables
    // Table 1: Daily Reports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_date VARCHAR(20) NOT NULL,
        report_time VARCHAR(20) NOT NULL,
        user_id VARCHAR(50) DEFAULT 'master',
        store_name VARCHAR(120) DEFAULT 'AMIGO FOOD MART',
        store_address VARCHAR(255) DEFAULT '',
        total_scratcher_sales DECIMAL(10, 2) DEFAULT 0.00,
        cashes DECIMAL(10, 2) DEFAULT 0.00,
        online_sales DECIMAL(10, 2) DEFAULT 0.00,
        online_cashes DECIMAL(10, 2) DEFAULT 0.00,
        total_sales DECIMAL(10, 2) DEFAULT 0.00,
        total_cashes DECIMAL(10, 2) DEFAULT 0.00,
        net_balance DECIMAL(10, 2) DEFAULT 0.00,
        inventory_stats JSON,
        activations JSON,
        sold_out JSON,
        boxes_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Table 2: Shift Reports & History
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shift_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shift_number INT NOT NULL,
        cashier VARCHAR(60) NOT NULL,
        started_at VARCHAR(60),
        ended_at VARCHAR(60),
        total_tickets_sold INT DEFAULT 0,
        total_sales_revenue DECIMAL(10, 2) DEFAULT 0.00,
        cashes DECIMAL(10, 2) DEFAULT 0.00,
        online_sales DECIMAL(10, 2) DEFAULT 0.00,
        online_cashes DECIMAL(10, 2) DEFAULT 0.00,
        drawer_float DECIMAL(10, 2) DEFAULT 0.00,
        activations_count INT DEFAULT 0,
        slots_snapshot JSON,
        sold_out_snapshot JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Table 3: Sold Out Audit Trail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sold_out_packs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shift_number INT DEFAULT 1,
        box_number INT NOT NULL,
        game_name VARCHAR(100) NOT NULL,
        price DECIMAL(8, 2) NOT NULL,
        pack_number VARCHAR(50) NOT NULL,
        pack_size INT DEFAULT 0,
        start_ticket INT DEFAULT 0,
        close_ticket INT DEFAULT 0,
        tickets_sold INT DEFAULT 0,
        sales_amount DECIMAL(10, 2) DEFAULT 0.00,
        is_returned BOOLEAN DEFAULT FALSE,
        tickets_returned INT DEFAULT 0,
        sold_at VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Table 4: POS State Storage (Full Persistence Backup)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pos_state (
        id INT PRIMARY KEY,
        state_data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    isDbConnected = true;
    dbLastError = null;
    console.log(`✅ [MySQL] Successfully connected to MySQL database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);
  } catch (err) {
    isDbConnected = false;
    dbLastError = err.message;
    console.warn(`⚠️ [MySQL] Could not connect to MySQL server at ${dbConfig.host}:${dbConfig.port}: ${err.message}`);
    console.warn('   Ensure MySQL Server or XAMPP (MySQL module) is running.');
  }
}

// Check connection periodically or on demand
setInterval(async () => {
  if (!isDbConnected) {
    await initDatabase();
  }
}, 15000);

// Initialize on startup
initDatabase();

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health & Status
app.get('/api/db-status', (req, res) => {
  res.json({
    connected: isDbConnected,
    database: dbConfig.database,
    host: dbConfig.host,
    port: dbConfig.port,
    error: dbLastError
  });
});

// 2. Save Daily Report
app.post('/api/save-day-report', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({
      success: false,
      message: 'MySQL is not connected. Saved to local storage fallback.'
    });
  }

  try {
    const d = req.body;
    const query = `
      INSERT INTO daily_reports (
        report_date, report_time, user_id, store_name, store_address,
        total_scratcher_sales, cashes, online_sales, online_cashes,
        total_sales, total_cashes, net_balance,
        inventory_stats, activations, sold_out, boxes_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const net = (Number(d.totalSales || 0)) - (Number(d.totalCashes || 0));

    const [result] = await pool.query(query, [
      d.reportDate || new Date().toLocaleDateString('en-US'),
      d.reportTime || new Date().toLocaleTimeString('en-US'),
      d.userId || 'master',
      d.storeName || 'AMIGO FOOD MART',
      d.storeAddress || '2300 MOODY RD WARNER ROBINS, GA, 31088',
      Number(d.totalScratcherSales || 0),
      Number(d.cashes || 0),
      Number(d.onlineSales || 0),
      Number(d.onlineCashes || 0),
      Number(d.totalSales || 0),
      Number(d.totalCashes || 0),
      net,
      JSON.stringify(d.inventoryStats || {}),
      JSON.stringify(d.activations || []),
      JSON.stringify(d.soldOut || []),
      JSON.stringify(d.boxes || [])
    ]);

    res.json({ success: true, insertId: result.insertId, message: 'Daily report saved to MySQL!' });
  } catch (err) {
    console.error('Error saving daily report to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Daily Reports
app.get('/api/day-reports', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ success: false, message: 'MySQL is not connected.' });
  }

  try {
    const [rows] = await pool.query(`SELECT * FROM daily_reports ORDER BY id DESC LIMIT 100`);
    res.json({ success: true, reports: rows });
  } catch (err) {
    console.error('Error fetching daily reports from MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Save Shift Report
app.post('/api/save-shift-report', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ success: false, message: 'MySQL is not connected.' });
  }

  try {
    const h = req.body;
    const query = `
      INSERT INTO shift_reports (
        shift_number, cashier, started_at, ended_at,
        total_tickets_sold, total_sales_revenue, cashes,
        online_sales, online_cashes, drawer_float, activations_count,
        slots_snapshot, sold_out_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      h.shiftNumber || 1,
      h.cashier || 'Clerk',
      h.startedAt || new Date().toISOString(),
      h.endedAt || new Date().toISOString(),
      h.totalTicketsSold || 0,
      Number(h.totalSalesRevenue || 0),
      Number(h.cashes || 0),
      Number(h.onlineSales || 0),
      Number(h.onlineCashes || 0),
      Number(h.drawerFloat || 0),
      h.activationsCount || 0,
      JSON.stringify(h.slotsSnapshot || []),
      JSON.stringify(h.soldOutSnapshot || [])
    ]);

    // Also record individual sold-out pack audits
    if (Array.isArray(h.soldOutSnapshot) && h.soldOutSnapshot.length > 0) {
      for (const so of h.soldOutSnapshot) {
        await pool.query(`
          INSERT INTO sold_out_packs (
            shift_number, box_number, game_name, price, pack_number,
            pack_size, start_ticket, close_ticket, tickets_sold, sales_amount,
            is_returned, tickets_returned, sold_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          h.shiftNumber || 1,
          so.boxNumber,
          so.gameName || 'Scratch Off',
          Number(so.price || 0),
          so.packNumber || '---',
          so.packSize || 0,
          so.startTicket || 0,
          so.closeTicket || 0,
          so.ticketsSold || 0,
          Number(so.salesAmount || 0),
          Boolean(so.isReturned),
          so.ticketsReturned || 0,
          so.soldAt || ''
        ]);
      }
    }

    res.json({ success: true, insertId: result.insertId, message: 'Shift report saved to MySQL!' });
  } catch (err) {
    console.error('Error saving shift report to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get Shift Reports
app.get('/api/shift-reports', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ success: false, message: 'MySQL is not connected.' });
  }

  try {
    const [rows] = await pool.query(`SELECT * FROM shift_reports ORDER BY shift_number DESC LIMIT 100`);
    res.json({ success: true, shifts: rows });
  } catch (err) {
    console.error('Error fetching shift reports from MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Full POS State Sync
app.post('/api/sync-pos-state', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ success: false, message: 'MySQL is not connected.' });
  }

  try {
    const stateJson = JSON.stringify(req.body);
    await pool.query(`
      INSERT INTO pos_state (id, state_data) VALUES (1, ?)
      ON DUPLICATE KEY UPDATE state_data = VALUES(state_data)
    `, [stateJson]);

    res.json({ success: true, message: 'POS state backed up to MySQL!' });
  } catch (err) {
    console.error('Error backing up POS state to MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Load POS State from MySQL
app.get('/api/load-pos-state', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ success: false, message: 'MySQL is not connected.' });
  }

  try {
    const [rows] = await pool.query(`SELECT state_data, updated_at FROM pos_state WHERE id = 1`);
    if (rows.length > 0 && rows[0].state_data) {
      const stateObj = JSON.parse(rows[0].state_data);
      res.json({ success: true, state: stateObj, updatedAt: rows[0].updated_at });
    } else {
      res.json({ success: false, message: 'No stored state found in MySQL.' });
    }
  } catch (err) {
    console.error('Error loading POS state from MySQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LottoTrack Backend API Server running at http://localhost:${PORT}`);
});
