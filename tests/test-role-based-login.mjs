import assert from 'assert';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const deployRoot = path.resolve(__dirname, '..', '..', 'jackpotlo-deploy');

const TEST_PORT = 3995;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE_URL}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseData); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || responseData
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

console.log('====================================================');
console.log('   JACKPOTLO ROLE-BASED LOGIN VERIFICATION SUITE   ');
console.log('====================================================\n');

// Reset local admin state to ensure known credentials
const adminStateFile = path.join(deployRoot, 'server_data', 'admin_state.json');
let originalState = null;
if (fs.existsSync(adminStateFile)) {
  originalState = fs.readFileSync(adminStateFile, 'utf8');
}

// Start backend from deploy copy
const serverProcess = spawn('node', ['server.js'], {
  cwd: deployRoot,
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    HOST: '127.0.0.1',
    NODE_ENV: 'development'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverLogs = '';
serverProcess.stdout.on('data', d => serverLogs += d.toString());
serverProcess.stderr.on('data', d => serverLogs += d.toString());

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function run() {
  try {
    // Wait for server boot
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await wait(200);
      try {
        const check = await new Promise(res => {
          http.get(`${BASE_URL}/api/health`, r => res(r.statusCode)).on('error', () => res(0));
        });
        if (check === 200) { ready = true; break; }
      } catch (_) {}
    }

    if (!ready) {
      throw new Error(`Server failed to boot. Logs:\n${serverLogs}`);
    }

    console.log('Backend server running on test port. Running verification tests...\n');

    // -------------------------------------------------------------
    // Test 1: Admin login via username 'admin'
    // -------------------------------------------------------------
    await it('Admin login via username "admin" returns role: ADMIN and redirect: /admin', async () => {
      // In dev mode with default admin, test password is '1234'
      const res = await post('/api/auth/login', { username: 'admin', password: '1234' });
      assert.strictEqual(res.statusCode, 200, 'Admin login must return 200 OK');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.role, 'ADMIN', 'Role must be ADMIN');
      assert.strictEqual(res.body.isAdmin, true, 'isAdmin must be true');
      assert.strictEqual(res.body.redirect, '/admin', 'redirect must be /admin');
      assert.ok(res.body.token && res.body.token.startsWith('adm_'), 'Must return valid adm_ token');
      assert.strictEqual(res.body.user.username, 'admin');
      assert.strictEqual(res.body.user.role, 'SUPER_ADMIN');
    });

    // -------------------------------------------------------------
    // Test 2: Admin login via email 'admin@jackpotlo.com'
    // -------------------------------------------------------------
    await it('Admin login via email "admin@jackpotlo.com" returns role: ADMIN and redirect: /admin', async () => {
      const res = await post('/api/auth/login', { username: 'admin@jackpotlo.com', password: '1234' });
      assert.strictEqual(res.statusCode, 200, 'Admin email login must return 200 OK');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.role, 'ADMIN', 'Role must be ADMIN');
      assert.strictEqual(res.body.isAdmin, true, 'isAdmin must be true');
      assert.strictEqual(res.body.redirect, '/admin', 'redirect must be /admin');
      assert.ok(res.body.token && res.body.token.startsWith('adm_'));
    });

    // -------------------------------------------------------------
    // Test 3: Admin login with incorrect password returns 401
    // -------------------------------------------------------------
    await it('Admin login with incorrect password returns 401 unauthorized', async () => {
      const res = await post('/api/auth/login', { username: 'admin', password: 'WrongPassword999!' });
      assert.strictEqual(res.statusCode, 401, 'Wrong admin password must return 401');
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Incorrect password for administrator account.');
    });

    // -------------------------------------------------------------
    // Test 4: Normal store user login opens store POS (redirect: /)
    // -------------------------------------------------------------
    await it('Normal store user login returns role: STORE_USER, isAdmin: false, redirect: /', async () => {
      const res = await post('/api/auth/login', { username: 'savannah_store', password: 'StorePassword123!' });
      assert.strictEqual(res.statusCode, 200, 'Store user login must return 200 OK');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.role, 'STORE_USER', 'Role must be STORE_USER');
      assert.strictEqual(res.body.isAdmin, false, 'isAdmin must be false');
      assert.strictEqual(res.body.redirect, '/', 'redirect must be /');
      assert.ok(res.body.storeId, 'Must return storeId for store user');
      assert.strictEqual(res.body.token, undefined, 'Must NOT return admin token for store user');
    });

    // -------------------------------------------------------------
    // Test 5: Verify compiled frontend bundle contains admin redirect logic
    // -------------------------------------------------------------
    await it('Compiled frontend bundle contains updated role-based login routing', async () => {
      const distDir = path.join(deployRoot, 'dist', 'assets');
      const files = fs.readdirSync(distDir);
      const jsBundle = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
      assert.ok(jsBundle, 'Compiled JS bundle must exist in dist/assets');

      const bundleContent = fs.readFileSync(path.join(distDir, jsBundle), 'utf8');
      assert.ok(bundleContent.includes('/admin'), 'Bundle must reference /admin');
      assert.ok(bundleContent.includes('SUPER_ADMIN'), 'Bundle must handle SUPER_ADMIN');
      assert.ok(bundleContent.includes('lotto_admin_token'), 'Bundle must store lotto_admin_token');
    });

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('====================================================\n');

  } finally {
    serverProcess.kill('SIGTERM');
    // Restore original state if present
    if (originalState) {
      fs.writeFileSync(adminStateFile, originalState, 'utf8');
    }
  }

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal Test Runner Error:', err.message);
  serverProcess.kill('SIGKILL');
  process.exit(1);
});
