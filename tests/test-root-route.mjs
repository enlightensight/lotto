import assert from 'assert';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const TEST_PORT = 3987;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function request(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('====================================================');
console.log('   JACKPOTLO GET / AND /api/health VERIFICATION     ');
console.log('====================================================\n');

// Start server on isolated test port
console.log(`Starting test server on port ${TEST_PORT}...`);
const serverProcess = spawn('node', ['server.js'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    HOST: '127.0.0.1',
    NODE_ENV: 'development'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverOutput = '';
serverProcess.stdout.on('data', (d) => { serverOutput += d.toString(); });
serverProcess.stderr.on('data', (d) => { serverOutput += d.toString(); });

async function runTests() {
  try {
    // Wait for server to bind
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await wait(200);
      try {
        const check = await request('/health');
        if (check.statusCode === 200) {
          ready = true;
          break;
        }
      } catch (_) {}
    }

    if (!ready) {
      throw new Error(`Server failed to start within 6 seconds. Logs:\n${serverOutput}`);
    }

    console.log('Server is responding on test port. Executing test assertions...\n');

    // -------------------------------------------------------------
    // Test 1: GET / (Root Service Route)
    // -------------------------------------------------------------
    console.log('Test 1: GET / endpoint returns expected JSON payload');
    const rootRes = await request('/');
    assert.strictEqual(rootRes.statusCode, 200, 'GET / must return 200 OK');
    assert.ok(
      rootRes.headers['content-type'] && rootRes.headers['content-type'].includes('application/json'),
      'GET / Content-Type must be application/json'
    );
    assert.deepStrictEqual(rootRes.body, {
      service: 'Jackpotlo API',
      status: 'running',
      health: '/api/health'
    }, 'GET / response body must match the exact required JSON structure');
    console.log('  ✓ PASS: GET / returned exact required JSON structure:');
    console.log('   ', JSON.stringify(rootRes.body, null, 2));

    // -------------------------------------------------------------
    // Test 2: Verify zero credential or internal config leakage on /
    // -------------------------------------------------------------
    console.log('\nTest 2: Verify zero sensitive information leakage');
    const sensitiveKeys = ['password', 'db_password', 'secret', 'token', 'user', 'host', 'port', 'database'];
    for (const key of sensitiveKeys) {
      assert.strictEqual(key in rootRes.body, false, `Response must NOT contain key "${key}"`);
    }
    console.log('  ✓ PASS: No credentials, tokens or internal configuration exposed');

    // -------------------------------------------------------------
    // Test 3: GET /api/health
    // -------------------------------------------------------------
    console.log('\nTest 3: GET /api/health endpoint');
    const apiHealthRes = await request('/api/health');
    assert.strictEqual(apiHealthRes.statusCode, 200, 'GET /api/health must return 200 OK');
    assert.strictEqual(apiHealthRes.body.status, 'ok', 'Status must be "ok"');
    assert.ok(typeof apiHealthRes.body.uptime === 'number', 'Uptime must be a number');
    assert.ok(apiHealthRes.body.timestamp, 'Timestamp must exist');
    assert.ok(apiHealthRes.body.database, 'Database status must exist');
    console.log('  ✓ PASS: GET /api/health is healthy:');
    console.log('   ', JSON.stringify(apiHealthRes.body, null, 2));

    // -------------------------------------------------------------
    // Test 4: GET /health (Alias check)
    // -------------------------------------------------------------
    console.log('\nTest 4: GET /health endpoint (alias)');
    const healthAliasRes = await request('/health');
    assert.strictEqual(healthAliasRes.statusCode, 200, 'GET /health must return 200 OK');
    assert.strictEqual(healthAliasRes.body.status, 'ok');
    console.log('  ✓ PASS: GET /health returned 200 OK');

    // -------------------------------------------------------------
    // Test 5: Verify 404 for unknown route
    // -------------------------------------------------------------
    console.log('\nTest 5: Verify 404 for unknown route');
    const unknownRes = await request('/non-existent-route-xyz');
    assert.strictEqual(unknownRes.statusCode, 404, 'Unknown route must return 404');
    console.log('  ✓ PASS: Unknown route returns 404 Not Found');

    console.log('\n====================================================');
    console.log('   🎉 ALL ROOT & HEALTH ROUTE TESTS PASSED!          ');
    console.log('====================================================\n');
  } finally {
    serverProcess.kill('SIGTERM');
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err.message);
  serverProcess.kill('SIGKILL');
  process.exit(1);
});

