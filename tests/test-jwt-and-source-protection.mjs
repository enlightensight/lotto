import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

console.log('================================================================');
console.log('   TEST SUITE: JWT AUTHENTICATION & SOURCE CODE HARDENING       ');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// Test 1: Cryptographic JWT (RFC 7519) Generation & Verification Engine
// -----------------------------------------------------------------------------
console.log('--- Test 1: Cryptographic JWT Unit Engine ---');

const JWT_SECRET = process.env.JWT_SECRET || 'jackpotlo_jwt_production_secret_2026_supersecure#99';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function generateTestJWT(payload, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

function verifyTestJWT(token, secret = JWT_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const clean = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = clean.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, signature] = parts;
  const data = `${encHeader}.${encPayload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
}

// 1a. Valid JWT structure
const samplePayload = {
  sub: 'usr_amigo_1',
  storeId: 'store_amigo',
  role: 'STORE_USER',
  email: 'amigo@example.com'
};
const token = generateTestJWT(samplePayload, 3600);
assert(typeof token === 'string', 'Generated token is string');
assert(token.split('.').length === 3, 'Token has exactly 3 RFC 7519 parts');
assert(token.startsWith('eyJ'), 'Token starts with standard base64url JSON header (eyJ)');

// 1b. Verification of valid JWT
const decoded = verifyTestJWT(token);
assert(decoded !== null, 'JWT successfully verified');
assert(decoded.sub === 'usr_amigo_1', 'Decoded subject matches payload');
assert(decoded.storeId === 'store_amigo', 'Decoded storeId matches payload');
assert(decoded.role === 'STORE_USER', 'Decoded role matches payload');
assert(typeof decoded.exp === 'number' && decoded.exp > decoded.iat, 'Token has valid timestamp claims');

// 1c. Tampered signature rejection
const tamperedToken = token.slice(0, -4) + 'abcd';
assert(verifyTestJWT(tamperedToken) === null, 'Tampered signature is strictly rejected');

// 1d. Tampered payload rejection
const parts = token.split('.');
const tamperedPayload = base64UrlEncode(JSON.stringify({ ...samplePayload, role: 'SUPER_ADMIN' }));
const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
assert(verifyTestJWT(forgedToken) === null, 'Tampered payload with mismatched signature is strictly rejected');

// 1e. Expired token rejection
const expiredToken = generateTestJWT(samplePayload, -100);
assert(verifyTestJWT(expiredToken) === null, 'Expired JWT is strictly rejected');

// 1f. Wrong secret rejection
assert(verifyTestJWT(token, 'wrong_secret_key_1234') === null, 'JWT signed with different secret is rejected');

// -----------------------------------------------------------------------------
// Test 2: Source Code Hardening & Inspection Protection
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Source Code Hardening & Inspection Protection ---');

// 2a. Check vite.config.js
const viteConfig = fs.readFileSync('vite.config.js', 'utf8');
assert(viteConfig.includes('sourcemap: false'), 'vite.config.js explicitly sets sourcemap: false');
assert(viteConfig.includes("legalComments: 'none'"), 'vite.config.js strips legal comments');
assert(viteConfig.includes('preview:'), 'vite.config.js has preview server configuration with API proxy');

// 2b. Check index.html protection script
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('<!-- POS Security: Disable Source Inspection & Developer Shortcuts -->'), 'index.html contains POS security comments');
assert(indexHtml.includes('contextmenu'), 'index.html disables right-click context menu outside text fields');
assert(indexHtml.includes('F12'), 'index.html blocks F12 keyboard shortcut');
assert(indexHtml.includes('Ctrl+Shift+I') || indexHtml.includes('key === "I"') || indexHtml.includes("key === 'I'"), 'index.html blocks Ctrl+Shift+I');
assert(indexHtml.includes('Ctrl+U') || indexHtml.includes('key === "u"') || indexHtml.includes("key === 'u'"), 'index.html blocks Ctrl+U View Source');

// 2c. Check START_POS.bat
const startBat = fs.readFileSync('START_POS.bat', 'utf8');
assert(startBat.toLowerCase().includes('http://localhost:5173'), 'START_POS.bat launches browser at POS URL');

// -----------------------------------------------------------------------------
// Test 3: Frontend dbSync.js JWT Transmission
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Frontend dbSync.js Bearer Header Transmission ---');

const dbSync = fs.readFileSync('src/dbSync.js', 'utf8');
assert(dbSync.includes("headers['Authorization'] = 'Bearer ' + token") || dbSync.includes("headers['Authorization'] = `Bearer ${token}`"), 'dbSync.js sets Authorization Bearer token');
assert(dbSync.includes("headers['x-store-token'] = token"), 'dbSync.js preserves backward-compatible x-store-token');

console.log('\n================================================================');
console.log(` ALL ${total} JWT & SOURCE PROTECTION TESTS PASSED! (${passed}/${total})`);
console.log('================================================================\n');

