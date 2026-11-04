import mysql from 'mysql2/promise';
import fs from 'fs';
import crypto from 'crypto';

const PBKDF2_ROUNDS = 600000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ROUNDS}$${salt}$${hash}`;
}

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
    throw new Error('CRITICAL ABORT: Connected to ' + dbName[0].db + ', expected jackpotlo_test');
  }
  console.log('✓ Connected strictly to test database:', dbName[0].db);

  // Generate two completely distinct, cryptographically secure passwords
  const storePassword = creds.STORE_TEST_PASS || ('StorePass_' + crypto.randomBytes(10).toString('hex') + '!2026');
  const adminPassword = creds.ADMIN_TEST_PASS || ('AdminPass_' + crypto.randomBytes(10).toString('hex') + '#Root99');

  const storeHash = hashPassword(storePassword);
  const adminHash = hashPassword(adminPassword);

  const sharedEmail = 'amigofoodmart2300@gmail.com';
  const normEmail = sharedEmail.toLowerCase();

  // 1. Provision / Update Admin Account in admin_users
  console.log('\n[1] Updating Platform Administrator in admin_users...');
  const [existingAdmins] = await conn.query("SELECT * FROM admin_users WHERE username = 'admin' OR email = ?", [normEmail]);
  if (existingAdmins.length > 0) {
    const adminId = existingAdmins[0].id;
    await conn.query(
      `UPDATE admin_users 
       SET email = ?, password_hash = ?, full_name = 'Platform Administrator', role = 'SUPER_ADMIN', is_active = 1
       WHERE id = ?`,
      [normEmail, adminHash, adminId]
    );
    console.log(`✓ Admin user "${adminId}" successfully updated with email "${normEmail}" and separate admin password hash.`);
  } else {
    await conn.query(
      `INSERT INTO admin_users (id, username, password_hash, full_name, email, role, is_active)
       VALUES ('adm_001', 'admin', ?, 'Platform Administrator', ?, 'SUPER_ADMIN', 1)`,
      [adminHash, normEmail]
    );
    console.log(`✓ Admin user "admin" provisioned with email "${normEmail}" and separate admin password hash.`);
  }

  // 2. Provision / Update Store Account in store_users
  console.log('\n[2] Provisioning Store Account in store_users...');
  const [existingStoreUsers] = await conn.query(
    "SELECT * FROM store_users WHERE store_id = 'store_amigo' AND (username = 'amigo' OR normalized_email = ?)",
    [normEmail]
  );
  if (existingStoreUsers.length > 0) {
    const usrId = existingStoreUsers[0].id;
    await conn.query(
      `UPDATE store_users
       SET email = ?, normalized_email = ?, password_hash = ?, role = 'STORE_USER', account_status = 'APPROVED', is_active = 1, approved_by = 'admin', approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sharedEmail, normEmail, storeHash, usrId]
    );
    console.log(`✓ Store user "${usrId}" successfully updated with email "${sharedEmail}" and separate store password hash.`);
  } else {
    await conn.query(
      `INSERT INTO store_users 
        (id, store_id, username, email, normalized_email, password_hash, full_name, role, account_status, is_active, approved_by, approved_at)
       VALUES 
        ('usr_amigo_primary', 'store_amigo', 'amigo', ?, ?, ?, 'Amigo Food Mart', 'STORE_USER', 'APPROVED', 1, 'admin', CURRENT_TIMESTAMP)`,
      [sharedEmail, normEmail, storeHash]
    );
    console.log(`✓ Store user "usr_amigo_primary" provisioned with email "${sharedEmail}" and separate store password hash.`);
  }

  // 3. Ensure store_amigo is APPROVED in stores table
  await conn.query(
    "UPDATE stores SET authorization_status = 'APPROVED', operational_status = 'ACTIVE' WHERE store_id = 'store_amigo'"
  );
  console.log('✓ Store "store_amigo" marked as APPROVED in stores table.');

  // 4. Save the generated credentials to .env.test_credentials for automated test runners
  let newEnv = credLines.filter(l => !l.startsWith('STORE_TEST_PASS=') && !l.startsWith('ADMIN_TEST_PASS=') && !l.startsWith('SHARED_TEST_EMAIL=')).join('\n').trim();
  newEnv += `\nSHARED_TEST_EMAIL=${sharedEmail}\nSTORE_TEST_PASS=${storePassword}\nADMIN_TEST_PASS=${adminPassword}\n`;
  fs.writeFileSync('.env.test_credentials', newEnv, 'utf8');
  if (fs.existsSync('../jackpotlo-deploy/.env.test_credentials')) {
    fs.writeFileSync('../jackpotlo-deploy/.env.test_credentials', newEnv, 'utf8');
  }
  console.log('✓ Saved secure testing credentials to .env.test_credentials.');

  await conn.end();
  console.log('\n=== DUAL IDENTITIES PROVISIONED SUCCESSFULLY ON jackpotlo_test ===');
}

main().catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
