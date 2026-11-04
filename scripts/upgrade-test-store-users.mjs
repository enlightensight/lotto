import mysql from 'mysql2/promise';
import fs from 'fs';

const credLines = fs.readFileSync('.env.test_credentials', 'utf8').split('\n');
const creds = {};
credLines.forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length) creds[k.trim()] = v.join('=').trim();
});
const caCert = fs.readFileSync('ca.pem', 'utf8');

async function main() {
  const conn = await mysql.createConnection({
    host: creds.DB_HOST,
    port: parseInt(creds.DB_PORT, 10),
    user: creds.DB_USER,
    password: creds.DB_PASSWORD,
    database: 'jackpotlo_test',
    ssl: { ca: caCert, rejectUnauthorized: true }
  });

  const [dbName] = await conn.query('SELECT DATABASE() as db');
  if (dbName[0].db !== 'jackpotlo_test') {
    throw new Error('Aborting: Connected to non-test database: ' + dbName[0].db);
  }
  console.log('Connected to target database:', dbName[0].db);

  const [cols] = await conn.query('DESCRIBE store_users');
  const existingCols = new Set(cols.map(c => c.Field));
  console.log('Existing columns:', Array.from(existingCols));

  if (!existingCols.has('email')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN email VARCHAR(120) NOT NULL DEFAULT '' AFTER username");
    console.log('Added email column');
  }
  if (!existingCols.has('normalized_email')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN normalized_email VARCHAR(120) NOT NULL DEFAULT '' AFTER email");
    console.log('Added normalized_email column');
  }
  if (!existingCols.has('account_status')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN account_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING' AFTER role");
    console.log('Added account_status column');
  }
  if (!existingCols.has('approval_notes')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN approval_notes TEXT NULL AFTER is_active");
    console.log('Added approval_notes column');
  }
  if (!existingCols.has('approved_by')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN approved_by VARCHAR(60) NULL AFTER approval_notes");
    console.log('Added approved_by column');
  }
  if (!existingCols.has('approved_at')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by");
    console.log('Added approved_at column');
  }
  if (!existingCols.has('updated_at')) {
    await conn.query("ALTER TABLE store_users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
    console.log('Added updated_at column');
  }

  try {
    await conn.query("ALTER TABLE store_users ADD INDEX idx_store_user_norm_email (normalized_email)");
    console.log('Added index on normalized_email');
  } catch (e) {
    console.log('Index note:', e.message);
  }

  const [newCols] = await conn.query('DESCRIBE store_users');
  console.log('Updated columns in store_users:', newCols.map(c => c.Field));
  await conn.end();
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

