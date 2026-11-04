#!/usr/bin/env node
// ============================================================================
// Administrator Account Provisioning CLI
// Securely provisions or updates a Platform Administrator for Jackpotlo
// Usage: node scripts/provision-admin.js <username> <password> [fullName] [email]
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const username = args[0] ? args[0].trim().toLowerCase() : null;
const password = args[1] ? args[1].trim() : null;
const fullName = args[2] ? args[2].trim() : (username ? username.charAt(0).toUpperCase() + username.slice(1) + ' Admin' : 'Admin');
const email = args[3] ? args[3].trim() : `${username || 'admin'}@jackpotlo.com`;

if (!username || !password) {
  console.log(`
Usage:
  node scripts/provision-admin.js <username> <password> [fullName] [email]

Example:
  node scripts/provision-admin.js superadmin P@ssw0rd2026 "Chief Admin" admin@jackpotlo.com
  `);
  process.exit(1);
}

const adminRecord = {
  id: `adm_${Date.now()}_${username.replace(/[^a-z0-9_]/g, '_')}`,
  username: username,
  password_hash: password, // In production could be bcrypt; here matches existing auth pattern
  full_name: fullName,
  email: email,
  role: 'SUPER_ADMIN',
  is_active: 1,
  created_at: new Date().toISOString()
};

async function provisionAdmin() {
  console.log(`\n======================================================`);
  console.log(`   JACKPOTLO PLATFORM ADMIN PROVISIONING TOOL`);
  console.log(`======================================================\n`);
  console.log(`Target Username : ${username}`);
  console.log(`Full Name       : ${fullName}`);
  console.log(`Role            : SUPER_ADMIN`);
  console.log(`Email           : ${email}`);

  // 1. Update / Create server_data/admin_state.json
  const serverDataDir = path.join(rootDir, 'server_data');
  if (!fs.existsSync(serverDataDir)) {
    fs.mkdirSync(serverDataDir, { recursive: true });
  }

  const adminStateFile = path.join(serverDataDir, 'admin_state.json');
  let adminState = {
    admins: [],
    stores: [],
    applications: [],
    catalog: [],
    ticketRequests: [],
    approvedTickets: [],
    allocations: [],
    auditLogs: []
  };

  if (fs.existsSync(adminStateFile)) {
    try {
      const raw = fs.readFileSync(adminStateFile, 'utf8');
      adminState = { ...adminState, ...JSON.parse(raw) };
    } catch (e) {
      console.warn('⚠️  Could not parse existing admin_state.json, creating clean state.');
    }
  }

  // Upsert into adminState.admins
  const existingIdx = adminState.admins.findIndex(a => (a.username || '').toLowerCase() === username);
  if (existingIdx >= 0) {
    adminState.admins[existingIdx].password_hash = password;
    adminState.admins[existingIdx].full_name = fullName;
    adminState.admins[existingIdx].email = email;
    adminState.admins[existingIdx].is_active = 1;
    console.log(`✓ Updated existing administrator "${username}" in server_data/admin_state.json`);
  } else {
    adminState.admins.push(adminRecord);
    console.log(`✓ Added new administrator "${username}" to server_data/admin_state.json`);
  }

  // Add audit log
  adminState.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    admin_username: 'CLI_SYSTEM',
    action_type: 'ADMIN_PROVISIONED',
    target_entity: 'admin_users',
    target_id: username,
    details: { username, fullName, email },
    created_at: new Date().toISOString()
  });

  fs.writeFileSync(adminStateFile, JSON.stringify(adminState, null, 2), 'utf8');

  // 2. Provision into MySQL if running
  try {
    const connConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME || 'jackpotlo'
    };
    if (process.env.DB_SSL_CA_PATH) {
      const caPath = path.isAbsolute(process.env.DB_SSL_CA_PATH)
        ? process.env.DB_SSL_CA_PATH
        : path.resolve(__dirname, '..', process.env.DB_SSL_CA_PATH);
      if (fs.existsSync(caPath)) {
        connConfig.ssl = {
          ca: fs.readFileSync(caPath, 'utf8').trim(),
          rejectUnauthorized: true
        };
      }
    }
    const conn = await mysql.createConnection(connConfig);

    await conn.query(`
      INSERT INTO admin_users (id, username, password_hash, full_name, email, role, is_active)
      VALUES (?, ?, ?, ?, ?, 'SUPER_ADMIN', 1)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        email = VALUES(email),
        is_active = 1
    `, [adminRecord.id, username, password, fullName, email]);

    await conn.query(`
      INSERT INTO admin_audit_logs (admin_username, action_type, target_entity, target_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, ['CLI_SYSTEM', 'ADMIN_PROVISIONED', 'admin_users', username, JSON.stringify({ username, fullName, email })]);

    await conn.end();
    console.log(`✓ Successfully synced to MySQL database (table: admin_users)`);
  } catch (err) {
    console.log(`ℹ MySQL connection bypassed (${err.message}). Local persistence saved to disk.`);
  }

  console.log(`\n✅ Administrator "${username}" is now authorized to access /admin`);
  console.log(`======================================================\n`);
}

provisionAdmin().catch(console.error);
