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
  if (dbName[0].db !== 'jackpotlo_test') throw new Error('Not jackpotlo_test');

  await conn.query("ALTER TABLE store_users MODIFY COLUMN account_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING'");
  console.log('✓ Modified store_users.account_status to DEFAULT PENDING on jackpotlo_test');

  const [cols] = await conn.query("SHOW COLUMNS FROM store_users LIKE 'account_status'");
  console.log('Column definition:', cols[0]);

  await conn.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

