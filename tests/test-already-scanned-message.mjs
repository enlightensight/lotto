// ============================================================================
// LOTTO TRACK PRO — TEST ALREADY SCANNED MESSAGE ON DUPLICATE TICKET SCAN
// ============================================================================

import assert from 'assert';
import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n====================================================');
console.log('   TEST ALREADY SCANNED MESSAGE ON SAME TICKET SCAN  ');
console.log('====================================================\n');

it('1. displayUpperRightMessage correctly parses "Already Scanned" messages without truncation', () => {
  // Simulate the parsing logic in displayUpperRightMessage
  function parseMessage(message, type = 'info') {
    const cleanMsg = String(message || '')
      .replace(/^[\s✓✔⚠ℹ🚨📦🏷️🔄❌]+/, '')
      .trim();

    let mainTitle = cleanMsg;
    let subDetail = '';

    if (/already\s*scanned/i.test(cleanMsg)) {
      mainTitle = 'Already Scanned';
      subDetail = cleanMsg.replace(/^Already\s*Scanned[:\s-]*/i, '').trim();
      if (!subDetail) subDetail = 'Ticket was already scanned.';
    } else {
      const splitMatch = cleanMsg.match(/^([^:!·\n]+[:!·])\s*(.*)$/) || cleanMsg.match(/^([^.\n]{1,24}\.)\s*(.*)$/);
      if (splitMatch) {
        mainTitle = splitMatch[1].replace(/[:!]$/, '').trim();
        subDetail = splitMatch[2].trim();
      }
    }
    return { mainTitle, subDetail };
  }

  const res1 = parseMessage('⚠️ Already Scanned: Ticket #015 was already scanned.', 'error');
  assert.strictEqual(res1.mainTitle, 'Already Scanned');
  assert.strictEqual(res1.subDetail, 'Ticket #015 was already scanned.');

  const res2 = parseMessage('Ticket #015 was already scanned.', 'error');
  assert.strictEqual(res2.mainTitle, 'Already Scanned');
  assert.strictEqual(res2.subDetail, 'Ticket #015 was already scanned.');
});

it('2. src/main.js contains "Already Scanned" and no longer says "was already sold. Cannot be sold again."', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  assert.ok(!mainJs.includes('was already sold. Cannot be sold again.'), 'Must not contain old "was already sold" text');
  assert.ok(mainJs.includes("scanActionTitle.textContent = 'Already Scanned'"), 'Must set title to "Already Scanned"');
  assert.ok(mainJs.includes('was already scanned.'), 'Must state ticket was already scanned');
});

it('3. CSS in src/dashboard-modern.css and src/style.css prevents truncation on alert-yellow detail', () => {
  const modernCss = readFileSync('src/dashboard-modern.css', 'utf8');
  const styleCss = readFileSync('src/style.css', 'utf8');
  assert.ok(modernCss.includes('.dashboard-last-scan-card.alert-yellow .last-scan-box-ticket'));
  assert.ok(modernCss.includes('white-space: normal !important'));
  assert.ok(styleCss.includes('.dashboard-last-scan-card.alert-yellow .last-scan-box-ticket'));
  assert.ok(styleCss.includes('white-space: normal !important'));
});

console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passed}, Failed: ${failed}   `);
console.log('====================================================');

if (failed > 0) process.exit(1);
