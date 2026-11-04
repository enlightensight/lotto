#!/usr/bin/env node
// ==============================================================================
// JACKPOTLO SECURE ADMINISTRATOR PASSWORD RESET SCRIPT
//
// STRICT SECURITY PROTOCOLS:
// 1. Genuinely masked terminal input for Windows PowerShell (setRawMode, * echo).
// 2. PBKDF2-HMAC-SHA256 Cryptographic Standards (600,000 rounds).
// 3. Verifies new admin password is NOT identical to the store password.
// 4. Preserves adm_001 ID, SUPER_ADMIN role, and registered email.
// 5. Zero password or hash logging.
// 6. Transactional integrity with automatic rollback on error.
// ==============================================================================

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// PBKDF2-HMAC-SHA256 Cryptographic Standards
const PBKDF2_ROUNDS = 600000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ROUNDS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 5) {
      const [, digest, iterations, salt, expectedHash] = parts;
      const derived = crypto.pbkdf2Sync(password, salt, parseInt(iterations, 10), PBKDF2_KEYLEN, digest).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
    }
  }
  return false;
}

// Windows PowerShell masked password prompt
function promptPasswordMasked(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);

    if (!process.stdin.isTTY) {
      let buf = '';
      const onData = (chunk) => {
        buf += chunk;
        const newlineIdx = buf.search(/[\r\n]/);
        if (newlineIdx !== -1) {
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          resolve(buf.slice(0, newlineIdx).trim());
        }
      };
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', onData);
      return;
    }

    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key) => {
      for (const char of key) {
        if (char === '\u0003') {
          // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          process.exit(1);
        } else if (char === '\r' || char === '\n') {
          // Enter
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          return resolve(password.trim());
        } else if (char === '\u0008' || char === '\x7f' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char <= '~') {
          password += char;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  console.log('==================================================================');
  console.log('   JACKPOTLO PLATFORM ADMINISTRATOR PASSWORD RESET PROCEDURE     ');
  console.log('==================================================================\n');

  // Load database configuration
  const host = process.env.DB_HOST || process.env.MYSQLHOST;
  const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '19289', 10);
  const user = process.env.DB_USER || process.env.MYSQLUSER;
  const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'jackpotlo';

  if (!host || !user || !password) {
    console.error('FATAL: Database connection parameters (DB_HOST, DB_USER, DB_PASSWORD) required.');
    process.exit(1);
  }

  const caCertPath = process.env.DB_SSL_CA || process.env.DB_SSL_CA_PATH || path.resolve('ca.pem');
  let sslConfig = false;
  if (fs.existsSync(caCertPath)) {
    sslConfig = {
      ca: fs.readFileSync(caCertPath, 'utf8'),
      rejectUnauthorized: true
    };
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: dbName,
    ssl: sslConfig
  });

  try {
    const [dbResult] = await conn.query('SELECT DATABASE() AS current_db');
    const currentDb = dbResult[0]?.current_db;
    console.log(`[Check 1/4] Connected to database: "${currentDb}"`);

    // Verify adm_001
    const [admins] = await conn.query(
      "SELECT id, username, email, role, is_active, password_hash FROM admin_users WHERE id = 'adm_001'"
    );
    if (admins.length === 0) {
      console.error("FATAL: Administrator 'adm_001' not found in admin_users.");
      process.exit(1);
    }
    const admin = admins[0];
    const targetEmail = 'amigofoodmart2300@gmail.com';
    if (admin.email.toLowerCase().trim() !== targetEmail) {
      console.error(`FATAL: Admin email is '${admin.email}', expected '${targetEmail}'.`);
      process.exit(1);
    }
    console.log(`[Check 2/4] Verified adm_001 (${admin.username}) -> Email: ${admin.email}, Role: ${admin.role}`);

    // Check store password to prevent identical password reuse
    const [storeUsers] = await conn.query(
      "SELECT id, store_id, password_hash FROM store_users WHERE store_id = 'store_amigo' OR normalized_email = ?",
      [targetEmail]
    );
    const storeHash = storeUsers[0]?.password_hash;
    console.log('[Check 3/4] Store identity namespace inspected for conflict prevention.\n');

    // Interactive password collection
    console.log('--- Enter New Password for Platform Administrator (adm_001) ---');
    let newPassword = '';

    // Support non-interactive test mode ONLY if IS_TEST_BACKEND is true
    if (process.env.IS_TEST_BACKEND === 'true' && process.env.RESET_ADMIN_TEST_PASS) {
      newPassword = process.env.RESET_ADMIN_TEST_PASS;
      console.log('(Test mode: password provided via test environment variable)');
    } else {
      newPassword = await promptPasswordMasked('Enter new Administrator password: ');
      if (!newPassword || newPassword.length < 8) {
        console.error('ERROR: Administrator password must be at least 8 characters long.');
        process.exit(1);
      }
      const confirmPassword = await promptPasswordMasked('Confirm new Administrator password: ');
      if (newPassword !== confirmPassword) {
        console.error('ERROR: Passwords do not match. Password reset aborted.');
        process.exit(1);
      }
    }

    // Verify new admin password is NOT identical to store password
    if (storeHash && verifyPassword(newPassword, storeHash)) {
      console.error('\nSECURITY ERROR: The new Administrator password cannot be identical to the Store POS password!');
      console.error('Store and Platform Administrator identities must maintain strictly independent passwords.');
      process.exit(1);
    }

    console.log('\n[Check 4/4] Cryptographic separation verified (Admin password != Store password).');

    // Generate new PBKDF2 hash
    const newHash = hashPassword(newPassword);

    // Transactional update
    console.log('Beginning database transaction...');
    await conn.beginTransaction();

    await conn.query(
      'UPDATE admin_users SET password_hash = ? WHERE id = ?',
      [newHash, admin.id]
    );

    // Verify update
    const [afterRows] = await conn.query(
      "SELECT id, username, email, role, is_active, password_hash FROM admin_users WHERE id = 'adm_001'"
    );
    const updatedAdmin = afterRows[0];
    if (updatedAdmin.password_hash !== newHash ||
        updatedAdmin.email !== targetEmail ||
        updatedAdmin.role !== 'SUPER_ADMIN') {
      await conn.rollback();
      console.error('ROLLBACK: Verification of updated admin record failed.');
      process.exit(1);
    }

    // Verify store_users is 100% untouched
    if (storeHash) {
      const [storeAfter] = await conn.query(
        "SELECT id, password_hash FROM store_users WHERE store_id = 'store_amigo' OR normalized_email = ?",
        [targetEmail]
      );
      if (storeAfter[0]?.password_hash !== storeHash) {
        await conn.rollback();
        console.error('ROLLBACK: Store user password was modified during admin reset!');
        process.exit(1);
      }
    }

    await conn.commit();
    console.log('✓ Transaction committed successfully.\n');

    console.log('==================================================================');
    console.log('  ADMINISTRATOR PASSWORD RESET SUCCESSFUL                         ');
    console.log('==================================================================');
    console.log(`  Admin ID:            ${updatedAdmin.id}`);
    console.log(`  Username:            ${updatedAdmin.username}`);
    console.log(`  Email:               ${updatedAdmin.email}`);
    console.log(`  Role:                ${updatedAdmin.role}`);
    console.log('  Password Format:     PBKDF2-HMAC-SHA256 (600,000 rounds) [Verified]');
    console.log('  Store User Account:  Untouched & Separated');
    console.log('==================================================================\n');

  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('RESET ERROR: Operation failed and was safely rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err.message);
  process.exit(1);
});
