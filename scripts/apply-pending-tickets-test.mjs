import mysql from 'mysql2/promise';
import fs from 'fs';

const env = fs.readFileSync('.env.test_credentials', 'utf8');
const lines = env.split('\n');
const conf = {};
for (const line of lines) {
  const [k, ...v] = line.trim().split('=');
  if (k && !k.startsWith('#')) conf[k.trim()] = v.join('=').trim();
}

if (conf.DB_NAME !== 'jackpotlo_test') {
  console.error('CRITICAL GUARD: Target is NOT jackpotlo_test! Aborting.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: conf.DB_HOST,
  user: conf.DB_USER,
  password: conf.DB_PASSWORD,
  port: Number(conf.DB_PORT),
  database: conf.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS \`store_pending_tickets\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`store_id\` VARCHAR(60) NOT NULL,
      \`barcode\` VARCHAR(100) NOT NULL,
      \`pack_number\` VARCHAR(50) NULL,
      \`game_number\` VARCHAR(50) NULL,
      \`ticket_number\` INT NULL,
      \`game_name\` VARCHAR(120) NULL,
      \`ticket_price\` DECIMAL(6, 2) NULL,
      \`box_number\` INT NULL,
      \`status\` ENUM('PENDING_SETUP', 'CONFIGURED') NOT NULL DEFAULT 'PENDING_SETUP',
      \`cashier\` VARCHAR(60) NULL,
      \`session_info\` VARCHAR(100) NULL,
      \`discovered_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`configured_at\` TIMESTAMP NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`uk_store_barcode\` (\`store_id\`, \`barcode\`),
      INDEX \`idx_spt_store_status\` (\`store_id\`, \`status\`),
      CONSTRAINT \`fk_spt_store\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`store_id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(ddl);
  console.log('✅ Created store_pending_tickets table in', conf.DB_NAME);
  const [desc] = await pool.query('DESCRIBE store_pending_tickets');
  console.log('Columns:', desc.map(c => `${c.Field} (${c.Type})`).join(', '));
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

