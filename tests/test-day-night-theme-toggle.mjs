import { readFileSync } from 'fs';

console.log('=== Test: Jackpotlo Admin Day/Night Mode Verification ===\n');

// 1. Verify index.html structure
const html = readFileSync('index.html', 'utf8');

if (!html.includes('id="adminThemeToggleBtn"')) {
  throw new Error('FAIL: #adminThemeToggleBtn not found in index.html');
}
console.log('✔ Found #adminThemeToggleBtn in topbar');

if (html.includes('id="adminSidebarThemeToggleBtn"')) {
  throw new Error('FAIL: Duplicate #adminSidebarThemeToggleBtn should be removed');
}
console.log('✔ Verified duplicate #adminSidebarThemeToggleBtn removed');

if (!html.includes('id="themeToggleBtn"')) {
  throw new Error('FAIL: #themeToggleBtn not found in POS sidebar');
}
console.log('✔ Found #themeToggleBtn in POS sidebar');

// 2. Verify admin-dashboard.css selectors
const css = readFileSync('src/admin-dashboard.css', 'utf8');

if (!css.includes('[data-admin-theme="light"]')) {
  throw new Error('FAIL: [data-admin-theme="light"] missing in src/admin-dashboard.css');
}
console.log('✔ [data-admin-theme="light"] present in src/admin-dashboard.css');

if (!css.includes('[data-theme="light"] #viewAdminDashboard')) {
  throw new Error('FAIL: [data-theme="light"] #viewAdminDashboard missing in src/admin-dashboard.css');
}
console.log('✔ [data-theme="light"] #viewAdminDashboard present in src/admin-dashboard.css');

if (!css.includes('--admin-bg-base: #f8fafc;')) {
  throw new Error('FAIL: Light mode canvas color missing');
}
console.log('✔ Light mode canvas variable verified (#f8fafc)');

if (!css.includes('--admin-bg-sidebar: #ffffff;')) {
  throw new Error('FAIL: Light mode sidebar color missing');
}
console.log('✔ Light mode sidebar variable verified (#ffffff)');

if (!css.includes('--admin-card-bg: #ffffff;')) {
  throw new Error('FAIL: Light mode card background verified');
}
console.log('✔ Light mode card background verified (#ffffff)');

if (!css.includes('.admin-theme-toggle-btn')) {
  throw new Error('FAIL: .admin-theme-toggle-btn styling missing in CSS');
}
console.log('✔ .admin-theme-toggle-btn styling present in CSS');

// 3. Verify JavaScript logic in src/main.js
const mainJs = readFileSync('src/main.js', 'utf8');
if (!mainJs.includes("document.documentElement.setAttribute('data-admin-theme', theme);")) {
  throw new Error('FAIL: data-admin-theme attribute setting missing in main.js');
}
console.log('✔ main.js sets data-admin-theme attribute');

// 4. Verify adminUiHandlers.js
const adminJs = readFileSync('src/adminUiHandlers.js', 'utf8');
if (!adminJs.includes('adminThemeToggleBtn')) {
  throw new Error('FAIL: adminThemeToggleBtn handler missing in adminUiHandlers.js');
}
console.log('✔ adminUiHandlers.js binds adminThemeToggleBtn');

console.log('\n=== ALL 11 THEME VERIFICATION CHECKS PASSED ===');
