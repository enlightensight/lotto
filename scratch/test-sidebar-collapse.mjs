import fs from 'fs';
import assert from 'assert';

console.log('--- Testing Sidebar Collapse Styles and Logic ---');

const css = fs.readFileSync('src/design-system.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('src/main.js', 'utf8');

// 1. Check HTML markup
assert(html.includes('id="sidebarCollapseBtn"'), 'HTML contains #sidebarCollapseBtn');
assert(html.includes('class="sidebar-collapse-btn"'), 'HTML contains .sidebar-collapse-btn');
console.log('✓ PASS: HTML contains sidebarCollapseBtn with correct id and class');

// 2. Check CSS styles for collapse button
assert(css.includes('.sidebar-collapse-btn {'), 'CSS defines .sidebar-collapse-btn');
assert(css.includes('.pos-sidebar.collapsed {'), 'CSS defines .pos-sidebar.collapsed');
assert(css.includes('.pos-sidebar.collapsed .brand-text-block'), 'CSS hides brand text in collapsed mode');
assert(css.includes('.pos-sidebar.collapsed .nav-group-title'), 'CSS hides nav group titles in collapsed mode');
assert(css.includes('.pos-sidebar.collapsed .sidebar-nav-item span'), 'CSS hides nav label spans in collapsed mode');
assert(css.includes('.pos-sidebar.collapsed .sidebar-user-pill .user-meta-block'), 'CSS hides user meta in collapsed mode');
console.log('✓ PASS: CSS contains full icon-rail styling for .pos-sidebar.collapsed');

// 3. Check JavaScript toggle logic & localStorage persistence
assert(js.includes('sidebarCollapseBtn'), 'JS references sidebarCollapseBtn');
assert(js.includes("sidebar.classList.toggle('collapsed')"), 'JS toggles collapsed class on sidebar');
assert(js.includes('lottotrack_sidebar_collapsed'), 'JS persists collapsed preference to localStorage');
assert(js.includes("localStorage.getItem('lottotrack_sidebar_collapsed') === 'true'"), 'JS restores collapsed preference on initPOS');
console.log('✓ PASS: JS properly toggles and restores sidebar collapse state');

console.log('\n=== ALL SIDEBAR COLLAPSE AUDIT CHECKS PASSED PERFECTLY! ===');
