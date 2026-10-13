// Verification Suite for Sell Counter Scanner Card and Last Scan Box
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

console.log('--- 1. Testing index.html Sell Counter DOM Elements ---');
const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

// A. Green-marked removal verification
const scannerHelpRowMatch = htmlContent.match(/<div class="scanner-help-row">([\s\S]*?)<\/div>/);
assert(Boolean(scannerHelpRowMatch), 'scanner-help-row exists');
if (scannerHelpRowMatch) {
  assert(!scannerHelpRowMatch[1].includes('prototype-links'), 'prototype-links block removed from scanner-help-row (as marked in green)');
  assert(!scannerHelpRowMatch[1].includes('Test Barcodes'), 'Test Barcodes button removed from scanner-help-row');
  assert(!scannerHelpRowMatch[1].includes('protoTrySaleBtn'), 'Try a sale button removed from visible scanner-help-row');
  assert(scannerHelpRowMatch[1].includes("Sold ticket &rarr; it's counted. New pack &rarr; we ask which box."), 'Hint text preserved cleanly');
}

// B. Last Scan Box structure verification (Matching Reference Header)
assert(htmlContent.includes('id="lastScanReadoutContainer"'), 'card-last-scan-box exists with id lastScanReadoutContainer');
assert(htmlContent.includes('id="largeStatReadout"'), 'largeStatReadout exists for big box number');
assert(htmlContent.includes('scanActionTitle'), 'scanActionTitle exists for Game Name');
assert(htmlContent.includes('lastScanDisplay'), 'lastScanDisplay exists for Ticket detail');
assert(htmlContent.includes('LAST SCAN'), 'LAST SCAN label exists');
assert(htmlContent.includes('last-scan-price-accent'), 'last-scan-price-accent exists for ticket price');

console.log('--- 2. Testing design-system.css & style.css Styles ---');
const dsCss = fs.readFileSync(path.resolve('./src/design-system.css'), 'utf-8');
const styleCss = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');

assert(dsCss.includes('.card-last-scan-box'), 'design-system.css has .card-last-scan-box styles');
assert(dsCss.includes('.last-scan-huge-box'), 'design-system.css has .last-scan-huge-box styles');
assert(dsCss.includes('.last-scan-meta-lines'), 'design-system.css has .last-scan-meta-lines styles');
assert(dsCss.includes('.last-scan-price-accent'), 'design-system.css has .last-scan-price-accent styles');

assert(styleCss.includes('[data-theme="dark"] .card-last-scan-box'), 'style.css has dark theme .card-last-scan-box');
assert(styleCss.includes('[data-theme="dark"] .last-scan-price-accent'), 'style.css has dark theme price accent');

console.log('--- 3. Testing main.js Dynamic Text Formatting ---');
const mainJs = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

assert(mainJs.includes("last-scan-price-accent"), 'main.js formats price accent on ticket scan');
assert(!mainJs.includes("scanActionTitle.textContent = isDailyMode ? 'Day in Progress'"), 'Day in Progress removed from scanActionTitle inside the card');
assert(mainJs.includes("cleanName || 'Cross Word'"), 'main.js defaults to Cross Word matching Image 2 reference');
assert(mainJs.includes("Ticket #084 &middot; <span class=\"last-scan-price-accent\">$3</span>"), 'main.js matches Image 2 default ticket #084 · $3');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
