#!/usr/bin/env node
// ============================================================================
// Jackpotlo Administrator Credential & Security Management CLI
// Allows secure creation, password resetting, and session revocation of admins.
// ============================================================================

try { require('dotenv').config(); } catch (_) {}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'server_data');
const ADMIN_STATE_FILE = path.join(DATA_DIR, 'admin_state.json');

const PBKDF2_ROUNDS = 600000;
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_KEYLEN = 32;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ROUNDS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    // Format 1: Modern 5-part format -> pbkdf2$digest$iterations$salt$hash
    if (parts.length === 5) {
      const digest = parts[1];
      const iterations = parseInt(parts[2], 10);
      const salt = parts[3];
      const originalHash = parts[4];
      if (isNaN(iterations) || !salt || !originalHash) return false;
      try {
        const keylen = Buffer.from(originalHash, 'hex').length;
        const testHash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(originalHash, 'hex'));
      } catch (_) {
        return false;
      }
    }
    // Format 2: Legacy 4-part format -> pbkdf2$iterations$salt$hash (sha512)
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const originalHash = parts[3];
      if (isNaN(iterations) || !salt || !originalHash) return false;
      try {
        const testHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
        return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(originalHash, 'hex'));
      } catch (_) {
        return false;
      }
    }
  }
  // Format 3: Plaintext fallback
  try {
    const b1 = Buffer.from(String(password));
    const b2 = Buffer.from(String(storedHash));
    return b1.length === b2.length && crypto.timingSafeEqual(b1, b2);
  } catch (_) {
    return storedHash === password;
  }
}

function getPasswordSecurityLabel(hash, username) {
  if (!hash || hash === '1234' || (username === 'admin' && hash === '1234')) {
    return '⚠️ INSECURE DEFAULT (1234)';
  }
  if (!hash.startsWith('pbkdf2$')) {
    return '⚠️ LEGACY PLAINTEXT (Auto-upgrades on login or run reset)';
  }
  const parts = hash.split('$');
  if (parts.length === 5) {
    const digest = parts[1];
    const iters = parts[2];
    return `✓ PBKDF2-HMAC-${digest.toUpperCase()} (${Number(iters).toLocaleString()} rounds)`;
  }
  if (parts.length === 4) {
    const iters = parts[1];
    return `⚠️ LEGACY PBKDF2-SHA512 (${Number(iters).toLocaleString()} rounds - auto-upgrades on login)`;
  }
  return '✓ PBKDF2 HASHED';
}

function loadState() {
  if (fs.existsSync(ADMIN_STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ADMIN_STATE_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading admin state file:', e.message);
    }
  }
  return { admins: [], adminSessions: [], auditLogs: [] };
}


async function syncToDatabase(adminUser) {
  try {
    const mysql = require('mysql2/promise');
    let dbConfig = null;
    const urlString = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (urlString) {
      const parsed = new URL(urlString);
      dbConfig = {
        host: parsed.hostname,
        port: parseInt(parsed.port || '3306', 10),
        user: decodeURIComponent(parsed.username || 'root'),
        password: decodeURIComponent(parsed.password || ''),
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'railway'
      };
    } else if (process.env.MYSQLHOST || process.env.DB_HOST) {
      dbConfig = {
        host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
        user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'lotto_pos'
      };
    }
    if (!dbConfig) return;
    const caPath = process.env.DB_SSL_CA_PATH || path.join(__dirname, '..', 'ca.pem');
    if (fs.existsSync(caPath)) {
      try {
        dbConfig.ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
      } catch (_) {}
    }
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      `INSERT INTO admin_users (id, username, password_hash, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), email = VALUES(email), is_active = 1`,
      [adminUser.id || ('adm_' + Date.now()), adminUser.username, adminUser.password_hash, adminUser.full_name || adminUser.username, adminUser.email || (adminUser.username + '@jackpotlo.com'), adminUser.role || 'SUPER_ADMIN']
    );
    await conn.end();
    console.log('✓ Successfully synchronized admin credentials to MySQL (admin_users table).');
  } catch (err) {
    console.warn('MySQL sync notice:', err.message);
  }
}

function saveState(st) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ADMIN_STATE_FILE, JSON.stringify(st, null, 2), 'utf8');
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  console.log(`
Jackpotlo Administrator Management CLI
Usage:
  node scripts/manage-admin.cjs reset <username> <newPassword>
  node scripts/manage-admin.cjs create <username> <password> [fullName] [email]
  node scripts/manage-admin.cjs list
  node scripts/manage-admin.cjs revoke [username]
`);
  process.exit(0);
}

(async () => {
const st = loadState();
if (!Array.isArray(st.admins)) st.admins = [];
if (!Array.isArray(st.adminSessions)) st.adminSessions = [];
if (!Array.isArray(st.auditLogs)) st.auditLogs = [];

if (command === 'list') {
  console.log('\n--- Registered Platform Administrators ---');
  if (st.admins.length === 0) {
    console.log('No administrators registered.');
  } else {
    st.admins.forEach((a, i) => {
      const isHashed = (a.password_hash || '').startsWith('pbkdf2$');
      const isDefault = a.password_hash === '1234' || (a.username === 'admin' && !isHashed);
      console.log(`[${i + 1}] Username: ${a.username}`);
      console.log(`    Full Name: ${a.full_name || 'N/A'}`);
      console.log(`    Email: ${a.email || 'N/A'}`);
      console.log(`    Role: ${a.role || 'SUPER_ADMIN'}`);
      console.log(`    Status: ${a.is_active ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`    Security: ${getPasswordSecurityLabel(a.password_hash, a.username)}`);
      console.log(`    Created: ${a.created_at || 'N/A'}\n`);
    });
  }
  process.exit(0);
}

if (command === 'reset') {
  const username = args[1];
  const newPassword = args[2];

  if (!username || !newPassword) {
    console.error('Error: Username and newPassword are required.\nExample: node scripts/manage-admin.cjs reset admin MyStrongPass123!');
    process.exit(1);
  }

  if (newPassword === '1234' || newPassword === 'admin') {
    console.error('Error: Insecure password rejected. You cannot use "1234" or "admin".');
    process.exit(1);
  }

  const normUser = username.trim().toLowerCase();
  const admin = st.admins.find(a => (a.username || '').toLowerCase() === normUser);
  if (!admin) {
    console.error(`Error: Administrator "${username}" not found.`);
    process.exit(1);
  }

  admin.password_hash = hashPassword(newPassword.trim());
  admin.updated_at = new Date().toISOString();

  // Revoke active sessions for security
  st.adminSessions = st.adminSessions.filter(s => (s.username || '').toLowerCase() !== normUser);

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: 'CLI_MANAGEMENT',
    actionType: 'ADMIN_PASSWORD_RESET',
    targetEntity: 'admin_users',
    targetId: normUser,
    details: { message: 'Password reset via CLI utility with PBKDF2-HMAC-SHA256 (600,000 rounds)' },
    createdAt: new Date().toISOString()
  });

  saveState(st);
  await syncToDatabase(admin);
  console.log(`✓ Password for administrator "${normUser}" successfully reset and hashed with PBKDF2-HMAC-SHA256 (600,000 rounds).`);
  console.log(`✓ All active sessions for "${normUser}" have been revoked for security.`);
  process.exit(0);
}

if (command === 'create') {
  const username = args[1];
  const password = args[2];
  const fullName = args[3] || `${username} Administrator`;
  const email = args[4] || `${username}@jackpotlo.com`;

  if (!username || !password) {
    console.error('Error: Username and password are required.\nExample: node scripts/manage-admin.cjs create newadmin SecurePassword789!');
    process.exit(1);
  }

  const normUser = username.trim().toLowerCase();
  if (st.admins.some(a => (a.username || '').toLowerCase() === normUser)) {
    console.error(`Error: Administrator "${username}" already exists. Use "reset" to change password.`);
    process.exit(1);
  }

  const newAdmin = {
    id: `adm_${Date.now()}`,
    username: normUser,
    password_hash: hashPassword(password.trim()),
    full_name: fullName,
    email: email,
    role: 'SUPER_ADMIN',
    is_active: 1,
    created_at: new Date().toISOString()
  };

  st.admins.push(newAdmin);

  st.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    adminUsername: 'CLI_MANAGEMENT',
    actionType: 'ADMIN_PROVISIONED',
    targetEntity: 'admin_users',
    targetId: normUser,
    details: { username: normUser, fullName, email },
    createdAt: new Date().toISOString()
  });

  saveState(st);
  await syncToDatabase(newAdmin);
  console.log(`✓ Administrator "${normUser}" created successfully with cryptographically hashed credentials.`);
  process.exit(0);
}

if (command === 'revoke') {
  const username = args[1];
  if (username) {
    const normUser = username.trim().toLowerCase();
    const countBefore = st.adminSessions.length;
    st.adminSessions = st.adminSessions.filter(s => (s.username || '').toLowerCase() !== normUser);
    const revoked = countBefore - st.adminSessions.length;
    saveState(st);
    console.log(`✓ Revoked ${revoked} session(s) for administrator "${normUser}".`);
  } else {
    const count = st.adminSessions.length;
    st.adminSessions = [];
    saveState(st);
    console.log(`✓ Revoked all ${count} active administrator session(s).`);
  }
  process.exit(0);
}

console.error(`Unknown command "${command}". Run with "help" for options.`);
process.exit(1);


})();
