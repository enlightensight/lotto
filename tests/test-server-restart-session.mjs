// ============================================================================
// Server Restart & Session Persistence Test
// ============================================================================

import assert from 'assert';
import http from 'http';
import fs from 'fs';
import { execSync, spawn } from 'child_process';

const BASE_URL = 'http://localhost:3001';

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

console.log('\n--- Testing Session Survival Across Server Restart ---');

// 1. Reset password and log in
const adminCliCmd = fs.existsSync('.env.test_credentials') 
  ? 'node --env-file=.env.test_credentials scripts/manage-admin.cjs reset admin RestartTestPass123!'
  : 'node scripts/manage-admin.cjs reset admin RestartTestPass123!';
execSync(adminCliCmd);
const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'RestartTestPass123!', mode: 'ADMIN' });
assert.strictEqual(loginRes.status, 200);
const token = loginRes.body.token;
console.log('✓ Admin logged in, token generated:', token.slice(0, 16) + '...');

// 2. Verify token works before restart
let res = await request('GET', '/api/admin/overview', null, { 'x-admin-token': token });
assert.strictEqual(res.status, 200, 'Token must work before restart');
console.log('✓ Token verified before server restart');

// 3. Restart server
console.log('Restarting server process...');
try {
  execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess -Force"');
} catch (_) {}

// Give OS a second to release socket
await new Promise(r => setTimeout(r, 1000));

// Spawn new server process in detached mode with test environment credentials if present
const nodeArgs = fs.existsSync('.env.test_credentials') ? ['--env-file=.env.test_credentials', 'server.js'] : ['server.js'];
const srv = spawn('node', nodeArgs, { detached: true, stdio: 'ignore' });
srv.unref();

// Wait for server to come online
let online = false;
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 500));
  try {
    const probe = await request('GET', '/api/health').catch(() => null);
    if (probe || (await request('GET', '/api/store/catalog?storeId=store_amigo').catch(() => null))) {
      online = true;
      break;
    }
  } catch (_) {}
}
assert.ok(online, 'Server must come back online after restart');
console.log('✓ Server successfully restarted');

// 4. Verify that session token survives restart and can access admin API
res = await request('GET', '/api/admin/overview', null, { 'x-admin-token': token });
assert.strictEqual(res.status, 200, 'Session token must survive server restart and return 200');
assert.strictEqual(res.body.success, true);
console.log('✓ Session verified after server restart (200 OK)');

// 5. Verify logout revokes session
const logoutRes = await request('POST', '/api/admin/logout', null, { 'x-admin-token': token });
assert.strictEqual(logoutRes.status, 200);
res = await request('GET', '/api/admin/overview', null, { 'x-admin-token': token });
assert.strictEqual(res.status, 403, 'Revoked token must be rejected with 403');
console.log('✓ Token revoked on logout (403 Forbidden on subsequent call)');

console.log('🎉 ALL SERVER RESTART & SESSION PERSISTENCE TESTS PASSED!\n');

