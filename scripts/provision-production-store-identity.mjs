#!/usr/bin/env node
// ==============================================================================
// JACKPOTLO PRODUCTION STORE IDENTITY PROVISIONING SCRIPT
// Target Database: jackpotlo (Aiven Production Cloud Database ONLY)
//
// STRICT PRODUCTION SECURITY PROTOCOLS:
// 1. Genuinely masked terminal input for Windows PowerShell (no echo, setRawMode).
// 2. Zero logging of password hashes (no full, partial, or sliced hashes logged).
// 3. Mandatory interactive password entry with confirmation (NO env bypass).
// 4. Requires store_amigo authorization_status = 'APPROVED' AND operational_status = 'ACTIVE'.
// 5. Preserves adm_001 credentials and password hash exactly (never modifies admin_users).
// 6. Connects exclusively to Aiven production database named 'jackpotlo'.
// 7. Requires explicit DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and Aiven TLS CA cert.
// 8. Enforces ACID transaction with post-insert verification and automatic rollback.
// 9. Verifies created store_users record without exposing its hash.
// ==============================================================================

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// PBKDF2-HMAC-SHA256 Cryptographic Standards (Authoritative server.js auth engine)
const PBKDF2_ROUNDS = 600000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ROUNDS}$${salt}$${hash}`;
}

// Windows PowerShell & Terminal compatible genuinely masked input
function promptPasswordMasked(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);

    if (!process.stdin.isTTY) {
      // Non-TTY stream fallback (automated pipes / CI)
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
          // Ctrl+C (Interrupt)
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          process.exit(1);
        } else if (char === '\r' || char === '\n') {
          // Enter Key
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          return resolve(password.trim());
        } else if (char === '\u0008' || char === '\x7f' || char === '\b') {
          // Backspace / Delete
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char <= '~') {
          // Printable ASCII characters
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
  console.log('  JACKPOTLO PRODUCTION STORE ACCOUNT PROVISIONING (AMIGO FOOD MART)');
  console.log('==================================================================\n');

  // ----------------------------------------------------------------------------
  // PREFLIGHT CHECK 1: Explicit Production Credentials Enforcement
  // ----------------------------------------------------------------------------
  const host = process.env.DB_HOST || process.env.MYSQLHOST;
  const port = parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '', 10);
  const user = process.env.DB_USER || process.env.MYSQLUSER;
  const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE;

  if (!host) {
    console.error('FATAL: Explicit DB_HOST is required. Cannot proceed.');
    process.exit(1);
  }
  if (!port || isNaN(port)) {
    console.error('FATAL: Explicit DB_PORT is required (e.g. Aiven port 19289). Cannot proceed.');
    process.exit(1);
  }
  if (!user) {
    console.error('FATAL: Explicit DB_USER is required. Cannot proceed.');
    process.exit(1);
  }
  if (!password) {
    console.error('FATAL: Explicit DB_PASSWORD is required. Cannot proceed.');
    process.exit(1);
  }
  if (!dbName || dbName !== 'jackpotlo') {
    console.error(`FATAL: DB_NAME must be exactly 'jackpotlo' (received: '${dbName || ''}'). Cannot proceed.`);
    process.exit(1);
  }

  // Guard against localhost, default root, and test databases
  const lowerHost = host.toLowerCase().trim();
  if (lowerHost === 'localhost' || lowerHost === '127.0.0.1' || lowerHost === '::1') {
    console.error('FATAL: Localhost is strictly prohibited for production provisioning. Must be Aiven production host.');
    process.exit(1);
  }
  if (user.toLowerCase().trim() === 'root') {
    console.error('FATAL: Default "root" user is prohibited. Must connect with explicit authorized Aiven credentials.');
    process.exit(1);
  }
  if (dbName.includes('test')) {
    console.error(`FATAL: Database name '${dbName}' indicates a test database. Must be production 'jackpotlo'.`);
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // PREFLIGHT CHECK 2: Aiven CA Certificate and TLS Enforcement
  // ----------------------------------------------------------------------------
  const caCertPath = process.env.DB_SSL_CA || path.resolve('ca.pem');
  if (!fs.existsSync(caCertPath)) {
    console.error(`FATAL: Required Aiven CA certificate not found at "${caCertPath}".`);
    console.error('Production database connection requires verified TLS with Aiven CA certificate.');
    process.exit(1);
  }
  const caCert = fs.readFileSync(caCertPath, 'utf8');
  if (!caCert.includes('-----BEGIN CERTIFICATE-----')) {
    console.error(`FATAL: Invalid CA certificate format at "${caCertPath}".`);
    process.exit(1);
  }

  const dbConfig = {
    host,
    port,
    user,
    password,
    database: dbName,
    ssl: {
      ca: caCert,
      rejectUnauthorized: true
    },
    connectTimeout: 10000
  };

  console.log(`Connecting securely via TLS to ${host}:${port}/${dbName}...`);
  const conn = await mysql.createConnection(dbConfig);
  console.log('✓ Secure TLS connection established.\n');

  try {
    // --------------------------------------------------------------------------
    // PREFLIGHT CHECK 3: Verify SELECT DATABASE() returns exactly 'jackpotlo'
    // --------------------------------------------------------------------------
    const [dbResult] = await conn.query('SELECT DATABASE() AS current_db');
    const currentDb = dbResult[0]?.current_db;
    if (currentDb !== 'jackpotlo') {
      console.error(`FATAL: Active database is '${currentDb}', expected exactly 'jackpotlo'. Aborting.`);
      process.exit(1);
    }
    console.log(`[Check 1/5] Active Database: "${currentDb}" (Verified Production Target)`);

    // --------------------------------------------------------------------------
    // PREFLIGHT CHECK 4: Verify 'store_amigo' exists, is APPROVED AND ACTIVE
    // --------------------------------------------------------------------------
    const [stores] = await conn.query(
      "SELECT store_id, store_name, authorization_status, operational_status FROM stores WHERE store_id = 'store_amigo'"
    );
    if (stores.length === 0) {
      console.error("FATAL: Store record 'store_amigo' does not exist in stores table. Aborting.");
      process.exit(1);
    }
    const store = stores[0];
    if (store.authorization_status !== 'APPROVED') {
      console.error(`FATAL: Store 'store_amigo' authorization_status is '${store.authorization_status}', expected 'APPROVED'. Aborting.`);
      process.exit(1);
    }
    if (store.operational_status !== 'ACTIVE') {
      console.error(`FATAL: Store 'store_amigo' operational_status is '${store.operational_status}', expected 'ACTIVE'. Aborting.`);
      process.exit(1);
    }
    console.log(`[Check 2/5] Store Record: "${store.store_name}" (ID: ${store.store_id}) -> Auth: APPROVED, Ops: ACTIVE (Verified)`);

    // --------------------------------------------------------------------------
    // PREFLIGHT CHECK 5: Verify 'adm_001' exists, is active, role SUPER_ADMIN, email correct
    // --------------------------------------------------------------------------
    const [admins] = await conn.query(
      "SELECT id, username, email, role, is_active, password_hash FROM admin_users WHERE id = 'adm_001'"
    );
    if (admins.length === 0) {
      console.error("FATAL: Platform administrator 'adm_001' does not exist in admin_users. Aborting.");
      process.exit(1);
    }
    const admin = admins[0];
    const expectedAdminEmail = 'amigofoodmart2300@gmail.com';
    if (admin.email.toLowerCase().trim() !== expectedAdminEmail) {
      console.error(`FATAL: Admin 'adm_001' email is '${admin.email}', expected '${expectedAdminEmail}'. Aborting.`);
      process.exit(1);
    }
    if (!admin.is_active) {
      console.error("FATAL: Admin 'adm_001' is not active (is_active = 0). Aborting.");
      process.exit(1);
    }
    if (admin.role !== 'SUPER_ADMIN') {
      console.error(`FATAL: Admin 'adm_001' role is '${admin.role}', expected 'SUPER_ADMIN'. Aborting.`);
      process.exit(1);
    }
    if (!admin.password_hash || admin.password_hash.length < 20) {
      console.error("FATAL: Admin 'adm_001' password hash is invalid or missing. Aborting.");
      process.exit(1);
    }
    const adminOriginalHashSnapshot = admin.password_hash;
    console.log(`[Check 3/5] Admin Record: "${admin.username}" (${admin.id}) -> Role: ${admin.role}, Email: ${admin.email} (Verified)`);

    // --------------------------------------------------------------------------
    // PREFLIGHT CHECK 6: Verify NO existing Amigo store login exists before creating one
    // --------------------------------------------------------------------------
    const targetEmail = 'amigofoodmart2300@gmail.com';
    const normEmail = targetEmail.toLowerCase().trim();

    const [existingStoreUsers] = await conn.query(
      "SELECT id, store_id, username, email, normalized_email, role, account_status FROM store_users WHERE store_id = 'store_amigo' OR normalized_email = ? OR username = 'amigo'",
      [normEmail]
    );

    if (existingStoreUsers.length > 0) {
      console.error('FATAL: Existing store login identity already exists in store_users:');
      existingStoreUsers.forEach(u => {
        console.error(`  - ID: ${u.id}, Store: ${u.store_id}, Username: ${u.username}, Email: ${u.email}, Status: ${u.account_status}`);
      });
      console.error('Aborting: To prevent accidental duplicate accounts or overwrites, existing records must not be present.');
      process.exit(1);
    }
    console.log('[Check 4/5] Store Users Namespace: Clean (No prior Amigo store login exists)\n');

    // --------------------------------------------------------------------------
    // STEP 7: Interactive Masked Password Prompt & Confirmation (Always Interactive)
    // --------------------------------------------------------------------------
    console.log('--- Enter Dedicated Store Password for Amigo Food Mart POS ---');
    console.log('(Must be separate from the administrator password. Input will be masked.)');

    const storePassword = await promptPasswordMasked('Enter new Store password: ');
    if (!storePassword || storePassword.length < 8) {
      console.error('ERROR: Store password must be at least 8 characters long. Aborting.');
      process.exit(1);
    }
    const confirmPassword = await promptPasswordMasked('Confirm new Store password: ');
    if (storePassword !== confirmPassword) {
      console.error('ERROR: Passwords do not match. Aborting.');
      process.exit(1);
    }

    // --------------------------------------------------------------------------
    // STEP 8: Hash with PBKDF2-HMAC-SHA256 (600,000 iterations)
    // --------------------------------------------------------------------------
    const storeHash = hashPassword(storePassword);

    console.log('\n[Check 5/5] Cryptographic Hash: Generated PBKDF2-HMAC-SHA256 (600,000 rounds)');

    // --------------------------------------------------------------------------
    // STEP 9: Execute Insertion in an ACID Transaction
    // --------------------------------------------------------------------------
    console.log('\nBeginning database transaction...');
    await conn.beginTransaction();

    const newUserId = `usr_amigo_${Date.now()}`;
    const username = 'amigo';
    const fullName = 'Amigo Food Mart Store User';
    const role = 'STORE_USER';
    const accountStatus = 'APPROVED';

    // Insert ONLY into store_users (never modify admin_users or stores)
    await conn.query(
      `INSERT INTO store_users (
        id, store_id, username, email, normalized_email, password_hash,
        full_name, role, account_status, is_active, approved_by, approved_at, created_at
      ) VALUES (?, 'store_amigo', ?, ?, ?, ?, ?, ?, ?, 1, 'adm_001', NOW(), NOW())`,
      [newUserId, username, targetEmail, normEmail, storeHash, fullName, role, accountStatus]
    );

    // --------------------------------------------------------------------------
    // STEP 10: Verify the Inserted Record Inside Transaction (Without Logging Hash)
    // --------------------------------------------------------------------------
    const [verifyRows] = await conn.query(
      'SELECT id, store_id, username, email, normalized_email, role, account_status, is_active, password_hash FROM store_users WHERE id = ?',
      [newUserId]
    );

    if (verifyRows.length !== 1) {
      await conn.rollback();
      console.error('ROLLBACK: Failed to verify inserted store_users record.');
      process.exit(1);
    }

    const insertedUser = verifyRows[0];
    if (insertedUser.store_id !== 'store_amigo' ||
        insertedUser.role !== 'STORE_USER' ||
        insertedUser.account_status !== 'APPROVED' ||
        insertedUser.normalized_email !== normEmail ||
        insertedUser.password_hash !== storeHash) {
      await conn.rollback();
      console.error('ROLLBACK: Data mismatch detected in inserted store_users record.');
      process.exit(1);
    }

    // --------------------------------------------------------------------------
    // STEP 11: Strictly Verify admin_users Was NEVER Modified
    // --------------------------------------------------------------------------
    const [adminCheckRows] = await conn.query(
      "SELECT id, username, email, role, is_active, password_hash FROM admin_users WHERE id = 'adm_001'"
    );
    if (adminCheckRows.length !== 1) {
      await conn.rollback();
      console.error('ROLLBACK: admin_users adm_001 missing after store user insertion.');
      process.exit(1);
    }
    const adminAfter = adminCheckRows[0];
    if (adminAfter.password_hash !== adminOriginalHashSnapshot) {
      await conn.rollback();
      console.error('CRITICAL SECURITY VIOLATION: adm_001 password hash was modified! Rolling back immediately.');
      process.exit(1);
    }
    if (adminAfter.email !== expectedAdminEmail || adminAfter.role !== 'SUPER_ADMIN') {
      await conn.rollback();
      console.error('ROLLBACK: adm_001 metadata was modified.');
      process.exit(1);
    }

    // Commit transaction
    await conn.commit();
    console.log('✓ Transaction committed successfully.\n');

    // --------------------------------------------------------------------------
    // FINAL REPORT (Zero hash logging)
    // --------------------------------------------------------------------------
    console.log('==================================================================');
    console.log('  PROVISIONING SUCCESSFUL: AMIGO STORE IDENTITY ACTIVE');
    console.log('==================================================================');
    console.log(`  User ID:             ${insertedUser.id}`);
    console.log(`  Store ID:            ${insertedUser.store_id} (Amigo Food Mart)`);
    console.log(`  Username:            ${insertedUser.username}`);
    console.log(`  Email:               ${insertedUser.email}`);
    console.log(`  Role:                ${insertedUser.role}`);
    console.log(`  Account Status:      ${insertedUser.account_status}`);
    console.log('  Password Format:     PBKDF2-HMAC-SHA256 (600,000 iterations) [Verified]');
    console.log('------------------------------------------------------------------');
    console.log('  Platform Admin adm_001: Verified Intact & Untouched');
    console.log('==================================================================\n');

  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('TRANSACTION ERROR: Operation failed and was rolled back safely.');
    console.error('Error detail:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal initialization error:', err.message);
  process.exit(1);
});
