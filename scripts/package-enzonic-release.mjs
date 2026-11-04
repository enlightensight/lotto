import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const LOTTO_DIR = 'C:/Users/Admin/OneDrive/Documents/lotto';
const DEPLOY_DIR = 'C:/Users/Admin/OneDrive/Documents/jackpotlo-deploy';
const TARGET_ZIP_DOCS = 'C:/Users/Admin/Documents/jackpotlo-enzonic-root-deploy.zip';
const TARGET_ZIP_ONEDRIVE = 'C:/Users/Admin/OneDrive/Documents/jackpotlo-enzonic-root-deploy.zip';
const STAGING_DIR = 'C:/Users/Admin/AppData/Local/Temp/jackpotlo-enzonic-root-staging';

console.log('================================================================');
console.log('   JACKPOTLO PRODUCTION BACKEND ENZONIC RELEASE BUILD ENGINE   ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// STEP 1: Pre-flight Verification of Source Files
// -----------------------------------------------------------------------------
console.log('--- Step 1: Pre-flight Integrity & Configuration Audit ---');

const serverJsPath = path.join(LOTTO_DIR, 'server.js');
const serverContent = fs.readFileSync(serverJsPath, 'utf8');

// 1a. Verify production database configuration is jackpotlo (not jackpotlo_test)
if (!serverContent.includes("database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'jackpotlo'")) {
  throw new Error("CONFIGURATION ERROR: server.js default database must be 'jackpotlo'.");
}
console.log("  ✓ Database Configuration: Default target verified as 'jackpotlo'.");

// 1b. Verify isolation guard against accidental test DB leakage in production
if (!serverContent.includes("config.database !== 'jackpotlo_test'")) {
  throw new Error("SECURITY ERROR: Database isolation guard missing in server.js.");
}
console.log("  ✓ Database Isolation Guard: Test backend isolation active.");

// 1c. Verify Aiven TLS configuration with CA certificate and rejectUnauthorized
if (!serverContent.includes("rejectUnauthorized: true") || !serverContent.includes("ca.pem")) {
  throw new Error("SECURITY ERROR: Aiven TLS / CA configuration missing in server.js.");
}
const caCertPath = path.join(LOTTO_DIR, 'ca.pem');
if (!fs.existsSync(caCertPath) || !fs.readFileSync(caCertPath, 'utf8').includes('-----BEGIN CERTIFICATE-----')) {
  throw new Error("SECURITY ERROR: Valid Aiven ca.pem certificate missing at repository root.");
}
console.log("  ✓ Aiven TLS Architecture: Verified ca.pem certificate and rejectUnauthorized: true.");

// 1d. Verify dual-login authentication endpoints and protections
if (!serverContent.includes("app.post('/api/auth/login'") || !serverContent.includes("account_status")) {
  throw new Error("SECURITY ERROR: Dual-login authentication and account_status protections missing in server.js.");
}
if (!serverContent.includes("store_users") || !serverContent.includes("operational_status")) {
  throw new Error("SECURITY ERROR: Store operational and approval validation missing in server.js.");
}
console.log("  ✓ Dual-Login System: Store and Administrator authentication with suspension guards intact.");

// 1e. Verify inventoryService.js integrity
const invServicePath = path.join(LOTTO_DIR, 'inventoryService.js');
if (!fs.existsSync(invServicePath)) {
  throw new Error("INTEGRITY ERROR: inventoryService.js is missing.");
}
console.log("  ✓ Inventory Engine: inventoryService.js verified intact.");

// -----------------------------------------------------------------------------
// STEP 2: Synchronize Verified Source Files to jackpotlo-deploy
// -----------------------------------------------------------------------------
console.log('\n--- Step 2: Synchronizing Files from lotto to jackpotlo-deploy ---');

const SYNC_FILES = [
  'server.js',
  'inventoryService.js',
  'schema.sql',
  'package.json',
  'package-lock.json',
  'ca.pem',
  'index.html',
  'vite.config.js',
  'netlify.toml'
];

for (const file of SYNC_FILES) {
  const src = path.join(LOTTO_DIR, file);
  const dest = path.join(DEPLOY_DIR, file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ Synchronized: ${file}`);
}

// Synchronize src/ directory
function syncSrcDir(sDir, dDir) {
  fs.mkdirSync(dDir, { recursive: true });
  for (const entry of fs.readdirSync(sDir, { withFileTypes: true })) {
    const sPath = path.join(sDir, entry.name);
    const dPath = path.join(dDir, entry.name);
    if (entry.isDirectory()) {
      syncSrcDir(sPath, dPath);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  }
}
syncSrcDir(path.join(LOTTO_DIR, 'src'), path.join(DEPLOY_DIR, 'src'));
console.log('  ✓ Synchronized: src/ tree');
syncSrcDir(path.join(LOTTO_DIR, 'public'), path.join(DEPLOY_DIR, 'public'));
console.log('  ✓ Synchronized: public/ tree');

// -----------------------------------------------------------------------------
// STEP 3: Production Frontend Build in jackpotlo-deploy
// -----------------------------------------------------------------------------
console.log('\n--- Step 3: Executing Production Build in deploy directory ---');
execSync('npm run build', { cwd: DEPLOY_DIR, stdio: 'inherit' });

// Verify built dist/index.html and dist/sw.js
const distIndex = path.join(DEPLOY_DIR, 'dist', 'index.html');
const distSw = path.join(DEPLOY_DIR, 'dist', 'sw.js');
if (!fs.existsSync(distIndex) || !fs.existsSync(distSw)) {
  throw new Error("BUILD ERROR: Production build failed to generate dist/index.html or dist/sw.js.");
}
console.log('  ✓ Production build artifacts verified (dist/index.html, dist/sw.js).');

// -----------------------------------------------------------------------------
// STEP 4: Staging Deployment Release Files (Root-Level Archive)
// -----------------------------------------------------------------------------
console.log('\n--- Step 4: Staging Production Files for Root-Level Archive ---');

if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// Copy root application files
for (const file of SYNC_FILES) {
  const src = path.join(DEPLOY_DIR, file);
  const dest = path.join(STAGING_DIR, file);
  fs.copyFileSync(src, dest);
  console.log(`  ✓ Staged Root File: ${file}`);
}

// Staging directories with strict exclusion filters
const STAGED_DIRS = ['dist', 'src', 'public', 'scripts'];

function copyDirWithExclusions(src, dest, relPath = '') {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const entryRel = path.join(relPath, entry.name).replace(/\\/g, '/');
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Exclusion filter rules
    if (
      entry.name.startsWith('.env') ||
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name.endsWith('.log') ||
      entry.name.endsWith('.tmp') ||
      entry.name.endsWith('.bak') ||
      entry.name.startsWith('jackpotlo_') || // database dumps
      entry.name.includes('backup') ||
      entry.name.includes('credentials')
    ) {
      console.log(`  [Excluded from staging] ${entryRel}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirWithExclusions(srcPath, destPath, entryRel);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

for (const dir of STAGED_DIRS) {
  const src = path.join(DEPLOY_DIR, dir);
  const dest = path.join(STAGING_DIR, dir);
  if (fs.existsSync(src)) {
    copyDirWithExclusions(src, dest, dir);
    console.log(`  ✓ Staged Filtered Directory: ${dir}/`);
  }
}

// -----------------------------------------------------------------------------
// STEP 5: Rigorous Security & Exclusion Audit on Staging Directory
// -----------------------------------------------------------------------------
console.log('\n--- Step 5: Performing Deep Security & Credential Audit ---');

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env/i,
  /credentials/i,
  /(^|[/\\])passwords?(\.txt|\.json|\.env|\.md)?$/i,
  /backup/i,
  /\.git/i,
  /node_modules/i,
  /server_data/i,
  /jackpotlo_.*\.sql$/i,
  /\.bat$/i
];

let violationCount = 0;

function auditStaging(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    const rel = path.relative(STAGING_DIR, fullPath).replace(/\\/g, '/');

    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(e.name) || pattern.test(rel)) {
        console.error(`  ❌ SECURITY VIOLATION: Staged forbidden item "${rel}"`);
        violationCount++;
      }
    }
    if (e.isDirectory()) {
      auditStaging(fullPath);
    }
  }
}

auditStaging(STAGING_DIR);

if (violationCount > 0) {
  throw new Error(`SECURITY AUDIT FAILED: ${violationCount} forbidden item(s) found in staging.`);
}
console.log('  ✓ Security Audit Passed: Zero credentials, zero .env files, zero dumps, zero node_modules.');

// -----------------------------------------------------------------------------
// STEP 6: Rebuilding Archive with Files Directly at Archive Root
// -----------------------------------------------------------------------------
console.log('\n--- Step 6: Compressing Staging Folder directly at Archive Root ---');

if (fs.existsSync(TARGET_ZIP_DOCS)) {
  fs.rmSync(TARGET_ZIP_DOCS, { force: true });
}

// PowerShell Compress-Archive directly from STAGING_DIR\* ensures files are directly at root
const compressCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${STAGING_DIR}\\*' -DestinationPath '${TARGET_ZIP_DOCS}' -CompressionLevel Optimal -Force"`;
execSync(compressCmd, { stdio: 'inherit' });

// Also mirror to OneDrive Documents if different
if (TARGET_ZIP_DOCS.toLowerCase() !== TARGET_ZIP_ONEDRIVE.toLowerCase()) {
  fs.copyFileSync(TARGET_ZIP_DOCS, TARGET_ZIP_ONEDRIVE);
}

// Clean up staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

// -----------------------------------------------------------------------------
// STEP 7: Archive Verification and SHA-256 Hash Calculation
// -----------------------------------------------------------------------------
console.log('\n--- Step 7: Verifying ZIP Structure & Integrity ---');

const zipBuffer = fs.readFileSync(TARGET_ZIP_DOCS);
const sha256Hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
const stats = fs.statSync(TARGET_ZIP_DOCS);

// Inspect root entries via tar
const tarOutput = execSync(`powershell -NoProfile -Command "tar -tf '${TARGET_ZIP_DOCS}'"`, { encoding: 'utf8' });
const entries = tarOutput.split(/[\r\n]+/).filter(Boolean);

console.log(`Total archive entries: ${entries.length}`);

// Confirm essential root items exist
const REQUIRED_ENTRIES = [
  'server.js',
  'inventoryService.js',
  'schema.sql',
  'package.json',
  'package-lock.json',
  'ca.pem',
  'index.html',
  'vite.config.js',
  'dist/index.html',
  'dist/sw.js',
  'scripts/production-migration.sql',
  'scripts/provision-production-store-identity.mjs'
];

for (const req of REQUIRED_ENTRIES) {
  if (!entries.includes(req)) {
    throw new Error(`ARCHIVE ERROR: Required file "${req}" is missing from ZIP root!`);
  }
}
console.log('  ✓ All essential production root files and scripts verified inside ZIP.');

// Confirm NO forbidden entries in the ZIP
for (const entry of entries) {
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(entry)) {
      throw new Error(`ARCHIVE ERROR: Forbidden entry "${entry}" detected in ZIP!`);
    }
  }
}
console.log('  ✓ Zero forbidden entries inside final ZIP archive.');

console.log('\n================================================================');
console.log('  JACKPOTLO PRODUCTION BACKEND ZIP READY FOR DEPLOYMENT         ');
console.log('================================================================');
console.log(`  Primary Location:    ${TARGET_ZIP_DOCS}`);
console.log(`  Mirror Location:     ${TARGET_ZIP_ONEDRIVE}`);
console.log(`  Archive Size:        ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`);
console.log(`  SHA-256 Checksum:    ${sha256Hash}`);
console.log('================================================================\n');
