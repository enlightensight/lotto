// Verification Suite for Box Details Modal Redesign (Matching Screenshot)
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- 1. Testing index.html Box Details Modal DOM Structure ---');
const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

assert(htmlContent.includes('id="boxAdjustModal"'), 'boxAdjustModal exists');
assert(htmlContent.includes('class="box-details-badge" id="boxDetailNumBadge"'), 'Box number badge element exists');
assert(htmlContent.includes('class="box-details-game-name" id="boxDetailGameName"'), 'Game name element exists');
assert(htmlContent.includes('class="box-details-price" id="boxDetailPrice"'), 'Price element exists');
assert(htmlContent.includes('class="box-details-subtitle" id="boxDetailSubtitle"'), 'Subtitle element exists');

// Top 4 KPI Metrics Row
assert(htmlContent.includes('class="box-details-kpi-row"'), '4 KPI metrics row exists');
assert(htmlContent.includes('NEXT TICKET'), 'Card 1 NEXT TICKET label exists');
assert(htmlContent.includes('id="boxDetailNextTicket"'), 'Next ticket value element exists');
assert(htmlContent.includes('id="boxDetailStartedAt"'), 'Started at subtext element exists');

assert(htmlContent.includes('SOLD TODAY'), 'Card 2 SOLD TODAY label exists');
assert(htmlContent.includes('id="boxDetailSoldToday"'), 'Sold today value element exists');
assert(htmlContent.includes('id="boxDetailSoldAmount"'), 'Sold amount subtext element exists');

assert(htmlContent.includes('LEFT IN BOX'), 'Card 3 LEFT IN BOX label exists');
assert(htmlContent.includes('id="boxDetailLeftInBox"'), 'Left in box value element exists');
assert(htmlContent.includes('id="boxDetailLeftValue"'), 'Left value subtext element exists');

assert(htmlContent.includes('ON THE RACK'), 'Card 4 ON THE RACK label exists');
assert(htmlContent.includes('id="boxDetailDaysOnRack"'), 'Days on rack value element exists');

// Progress Bar
assert(htmlContent.includes('class="box-details-progress-bar"'), 'Progress bar container exists');
assert(htmlContent.includes('id="boxDetailProgressFill"'), 'Progress fill element exists');

// Action Sections & Buttons
assert(htmlContent.includes('SELLING'), 'Section 1 SELLING header exists');
assert(htmlContent.includes('id="btnBoxSellOneTicket"'), 'Sell 1 ticket button exists');
assert(htmlContent.includes('Sell 1 ticket'), 'Sell 1 ticket label exists');
assert(htmlContent.includes('id="btnMarkPackSoldOut"'), 'Mark sold out button exists');
assert(htmlContent.includes('Mark sold out'), 'Mark sold out label exists');

assert(htmlContent.includes('MOVE'), 'Section 2 MOVE header exists');
assert(htmlContent.includes('id="btnBoxSwitch"'), 'Switch boxes button exists');
assert(htmlContent.includes('Switch boxes'), 'Switch boxes label exists');
assert(htmlContent.includes('id="btnBoxChange"'), 'Change box number button exists');
assert(htmlContent.includes('Change box number'), 'Change box number label exists');
assert(htmlContent.includes('id="btnFixPosition"'), 'Fix ticket number button exists');
assert(htmlContent.includes('Fix ticket number'), 'Fix ticket number label exists');

assert(htmlContent.includes('TAKE OFF THE RACK'), 'Section 3 TAKE OFF THE RACK header exists');
assert(htmlContent.includes('id="btnReturnPack"'), 'Return or store pack button exists');
assert(htmlContent.includes('Return or store pack'), 'Return or store pack label exists');
assert(htmlContent.includes('id="btnSetCountZero"'), 'Loaded by mistake button exists');
assert(htmlContent.includes('Loaded by mistake'), 'Loaded by mistake label exists');

console.log('--- 2. Testing src/style.css Box Details Modal Styles ---');
const styleCss = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');

assert(styleCss.includes('dialog#boxAdjustModal'), 'style.css contains dialog#boxAdjustModal base styles');
assert(styleCss.includes('.box-details-badge'), 'style.css contains .box-details-badge styles');
assert(styleCss.includes('.box-details-kpi-row'), 'style.css contains .box-details-kpi-row grid');
assert(styleCss.includes('.box-details-progress-bar'), 'style.css contains .box-details-progress-bar styles');
assert(styleCss.includes('.box-action-section-title'), 'style.css contains section title styles');
assert(styleCss.includes('.box-action-card'), 'style.css contains .box-action-card styles');
assert(styleCss.includes('.btn-box-details-close'), 'style.css contains .btn-box-details-close styles');

assert(styleCss.includes('[data-theme="dark"] dialog#boxAdjustModal'), 'style.css contains dark theme modal override');
assert(styleCss.includes('[data-theme="dark"] .box-details-badge'), 'style.css contains dark theme badge override');
assert(styleCss.includes('[data-theme="dark"] .box-details-kpi-card'), 'style.css contains dark theme KPI card override');
assert(styleCss.includes('[data-theme="dark"] .box-action-card'), 'style.css contains dark theme action card override');

console.log('--- 3. Testing src/main.js Logic & Wiring ---');
const mainJs = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

assert(mainJs.includes('boxDetailNumBadge'), 'main.js populates boxDetailNumBadge');
assert(mainJs.includes('boxDetailGameName'), 'main.js populates boxDetailGameName');
assert(mainJs.includes('boxDetailPrice'), 'main.js populates boxDetailPrice');
assert(mainJs.includes('boxDetailNextTicket'), 'main.js populates boxDetailNextTicket');
assert(mainJs.includes('boxDetailSoldToday'), 'main.js populates boxDetailSoldToday');
assert(mainJs.includes('boxDetailLeftInBox'), 'main.js populates boxDetailLeftInBox');
assert(mainJs.includes('boxDetailDaysOnRack'), 'main.js populates boxDetailDaysOnRack');
assert(mainJs.includes('boxDetailProgressFill'), 'main.js updates boxDetailProgressFill');
assert(mainJs.includes('btnBoxSellOneTicket'), 'main.js wires btnBoxSellOneTicket');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
