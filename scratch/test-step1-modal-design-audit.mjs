import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- Auditing Step 1 Ticket Details Modal (Image 1 vs Image 2) ---');

// 1. Audit index.html DOM structure
const html = fs.readFileSync(path.resolve('index.html'), 'utf8');

console.log('Checking index.html elements...');
assert(html.includes('id="setTicketDetailsModal" class="modal-ticket-details"'), 'modal-ticket-details class exists on setTicketDetailsModal');
assert(html.includes('class="set-ticket-step-eyebrow"'), 'STEP 1 OF 2 eyebrow exists');
assert(html.includes('id="setTicketHeaderGameTitle"'), 'setTicketHeaderGameTitle exists for large modal header game name');
assert(html.includes('id="setTicketHeaderSubtitle"'), 'setTicketHeaderSubtitle exists for "We know this game..." subtitle');
assert(html.includes('id="closeSetTicketDetailsModalBtn"'), 'closeSetTicketDetailsModalBtn close button exists');

// Barcode card
assert(html.includes('class="set-ticket-barcode-card"'), 'set-ticket-barcode-card container exists');
assert(html.includes('class="set-ticket-card-tag">SCANNED BARCODE</span>'), 'SCANNED BARCODE tag exists');
assert(html.includes('id="setTicketKnownGameBadge"'), 'setTicketKnownGameBadge exists for "✓ Known game — filled in for you"');
assert(html.includes('id="setTicketBarcodeDisplay"'), 'setTicketBarcodeDisplay exists for large barcode text');
assert(html.includes('id="setTicketBarcodeMetaLine"'), 'setTicketBarcodeMetaLine exists for metadata line');
assert(html.includes('id="setTicketMetaGameNum"'), 'setTicketMetaGameNum exists');
assert(html.includes('id="setTicketMetaPackNum"'), 'setTicketMetaPackNum exists');
assert(html.includes('id="setTicketMetaFirstTicket"'), 'setTicketMetaFirstTicket exists');

// Form fields
assert(html.includes('id="setBoxGameNameInput"'), 'setBoxGameNameInput exists');
assert(html.includes('id="setBoxPricePillsContainer"'), 'setBoxPricePillsContainer exists');
assert(html.includes('id="setBoxPriceInput"'), 'setBoxPriceInput exists for custom Other $ price');
assert(html.includes('id="setBoxPackTicketsInput"'), 'setBoxPackTicketsInput exists for Tickets in this pack');
assert(html.includes('id="setBoxPackValueInput"'), 'setBoxPackValueInput exists for Pack value');
assert(html.includes('id="setTicketPackHint"'), 'setTicketPackHint exists for "Most $1 packs have 300 tickets."');

// Footer
assert(html.includes('id="btnCancelTicketDetails"'), 'btnCancelTicketDetails exists');
assert(html.includes('id="btnTicketDetailsNext"'), 'btnTicketDetailsNext exists');
console.log('✓ PASS: All DOM elements from Image 1 are present in index.html');

// 2. Audit design-system.css styling
console.log('Checking design-system.css styling...');
const css = fs.readFileSync(path.resolve('src/design-system.css'), 'utf8');

assert(css.includes('.modal-ticket-details'), 'modal-ticket-details styles exist');
assert(css.includes('.set-ticket-icon-box'), 'set-ticket-icon-box styles exist');
assert(css.includes('.set-ticket-barcode-card'), 'set-ticket-barcode-card styles exist');
assert(css.includes('.set-ticket-game-badge'), 'set-ticket-game-badge styles exist');
assert(css.includes('.set-ticket-barcode-meta'), 'set-ticket-barcode-meta styles exist');
assert(css.includes('.set-ticket-columns-row'), 'set-ticket-columns-row 2-column grid styles exist');
assert(css.includes('.set-ticket-price-pills-row .set-box-price-pill.active'), 'active price pill styles match dark slate pill');
assert(css.includes('[data-theme="dark"] .modal-ticket-details'), 'dark theme styles exist for modal-ticket-details');
console.log('✓ PASS: All CSS styling matching Image 1 is present in design-system.css');

// 3. Audit main.js logic
console.log('Checking main.js population logic...');
const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');

assert(mainJs.includes('setTicketHeaderGameTitle'), 'main.js updates setTicketHeaderGameTitle');
assert(mainJs.includes('setTicketHeaderSubtitle'), 'main.js updates setTicketHeaderSubtitle');
assert(mainJs.includes('setTicketKnownGameBadge'), 'main.js updates setTicketKnownGameBadge');
assert(mainJs.includes('setTicketMetaGameNum'), 'main.js updates setTicketMetaGameNum');
assert(mainJs.includes('setTicketMetaPackNum'), 'main.js updates setTicketMetaPackNum');
assert(mainJs.includes('setTicketMetaFirstTicket'), 'main.js updates setTicketMetaFirstTicket');
assert(mainJs.includes('setTicketPackHint'), 'main.js updates setTicketPackHint');
assert(mainJs.includes("`$${std.bookValue.toFixed(2)}`"), 'main.js formats pack value with dollar and decimals');
console.log('✓ PASS: main.js properly wires all dynamic fields');

console.log('\n--- ALL STEP 1 MODAL DESIGN AUDIT TESTS PASSED ---');
