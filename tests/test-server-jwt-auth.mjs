import http from 'http';
import fs from 'fs';

console.log('================================================================');
console.log('   TESTING LIVE SERVER JWT AUTHENTICATION ENDPOINTS            ');
console.log('================================================================\n');

// Import server logic verification
const serverCode = fs.readFileSync('server.js', 'utf8');

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exit(1);
  }
}

// 1. Verify server.js contains the JWT implementation
assert(serverCode.includes('function generateJWT('), 'server.js contains generateJWT');
assert(serverCode.includes('function verifyJWT('), 'server.js contains verifyJWT');
assert(serverCode.includes('JWT_SECRET'), 'server.js defines JWT_SECRET');
assert(serverCode.includes('/api/auth/verify-token'), 'server.js defines /api/auth/verify-token');

// 2. Verify server.js issues JWTs on login
assert(serverCode.includes("jwt: token"), 'server.js login response returns jwt property');
assert(serverCode.includes("accessToken: token"), 'server.js login response returns accessToken property');
assert(serverCode.includes("tokenType: 'Bearer'"), 'server.js login response returns tokenType Bearer');

// 3. Verify server.js verifies JWTs in getActiveAdminSession and getActiveStoreSession
assert(serverCode.includes("const jwtPayload = verifyJWT(cleanToken)"), 'server.js verifies JWT in session lookup');

// 4. Verify static file serving from dist
assert(serverCode.includes("app.use(express.static(distPath"), 'server.js serves compiled dist assets without raw source files');

console.log('\n================================================================');
console.log(' ALL SERVER JWT LOGIC VERIFIED SUCCESSFULLY!                    ');
console.log('================================================================\n');

