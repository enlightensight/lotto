import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(cond, name, details = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name} - ${details}`);
  }
}

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const designSystemCss = fs.readFileSync(path.join(root, 'src', 'design-system.css'), 'utf-8');
const styleCss = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf-8');
const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf-8');
const dataJs = fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf-8');

console.log('--- 1. Testing index.html Sell Counter & Mini-Map DOM ---');
assert(indexHtml.includes('id="cardAllBoxesMap"'), 'cardAllBoxesMap container exists');
assert(indexHtml.includes('All 65 boxes'), 'Title All 65 boxes exists in card');
assert(indexHtml.includes('A quick map of the whole dispenser. Tap an empty box to load a pack into it.'), 'Subtitle matches reference text');
assert(indexHtml.includes('class="all-boxes-map-legend"'), 'all-boxes-map-legend container exists');
assert(indexHtml.includes('class="legend-swatch selling"'), 'Legend swatch selling exists');
assert(indexHtml.includes('class="legend-swatch older"'), 'Legend swatch older exists');
assert(indexHtml.includes('class="legend-swatch empty"'), 'Legend swatch empty exists');
assert(indexHtml.includes('class="slots-ribbon-grid" id="slotsRibbon"'), 'slotsRibbon exists inside cardAllBoxesMap');

// Ensure slotsRibbon only appears ONCE
const slotsRibbonCount = (indexHtml.match(/id="slotsRibbon"/g) || []).length;
assert(slotsRibbonCount === 1, 'slotsRibbon id appears exactly once in index.html', `Got ${slotsRibbonCount}`);

// Ensure rack footer bar is hidden
assert(indexHtml.includes('class="rack-footer-bar" style="display: none;"'), 'Legacy rack-footer-bar is hidden');

console.log('--- 2. Testing CSS Styles (design-system.css & style.css) ---');
assert(designSystemCss.includes('.card-all-boxes-map'), 'design-system.css has .card-all-boxes-map styles');
assert(designSystemCss.includes('.slots-ribbon-grid'), 'design-system.css has .slots-ribbon-grid');
assert(designSystemCss.includes('grid-template-columns: repeat(29, minmax(0, 1fr))'), 'slots-ribbon-grid defines 29-column desktop grid');
assert(designSystemCss.includes('.box-card-add-pack'), 'design-system.css has .box-card-add-pack styles');
assert(designSystemCss.includes('.tile-ticket-info-top'), 'design-system.css has .tile-ticket-info-top');
assert(designSystemCss.includes('.tile-ticket-info-bottom'), 'design-system.css has .tile-ticket-info-bottom');

assert(styleCss.includes('.ribbon-cell.active-slot'), 'style.css defines .ribbon-cell.active-slot (soft blue)');
assert(styleCss.includes('.ribbon-cell.older-slot'), 'style.css defines .ribbon-cell.older-slot (peach)');
assert(styleCss.includes('.ribbon-cell.empty-slot'), 'style.css defines .ribbon-cell.empty-slot (dashed border)');
assert(styleCss.includes('.ribbon-cell.selected-slot'), 'style.css defines .ribbon-cell.selected-slot (royal blue)');
assert(styleCss.includes('.ribbon-cell.dashed-focus-slot'), 'style.css defines .ribbon-cell.dashed-focus-slot (dashed blue)');

assert(styleCss.includes('[data-theme="dark"] .card-all-boxes-map'), 'style.css has dark theme card-all-boxes-map');
assert(styleCss.includes('[data-theme="dark"] .box-card-add-pack'), 'style.css has dark theme box-card-add-pack');

console.log('--- 3. Testing main.js Rack & Ribbon Logic ---');
assert(mainJs.includes('cardLoadNewPack'), 'main.js appends cardLoadNewPack');
assert(mainJs.includes('Load a new pack'), 'cardLoadNewPack has title Load a new pack');
assert(mainJs.includes('or just scan it'), 'cardLoadNewPack has subtitle or just scan it');
assert(mainJs.includes('tile-ticket-info-top'), 'main.js formats tile-ticket-info-top with Next ticket and mono ticket');
assert(mainJs.includes('tile-ticket-info-bottom'), 'main.js formats tile-ticket-info-bottom with remaining and total');
assert(mainJs.includes('⏱'), 'main.js uses stopwatch emoji ⏱ for aging tags');
assert(mainJs.includes('older-slot'), 'main.js assigns older-slot class in renderSlotsRibbon');
assert(mainJs.includes('active-slot'), 'main.js assigns active-slot class in renderSlotsRibbon');
assert(mainJs.includes('empty-slot'), 'main.js assigns empty-slot class in renderSlotsRibbon');
assert(mainJs.includes('openActivationForBox(slot.boxNumber)'), 'main.js opens pack activation when empty slot is tapped');
assert(mainJs.includes('dashed-focus-slot'), 'main.js sets dashed-focus-slot for Box 16 target/focus');

console.log('--- 4. Testing data.js Reference State & Baseline ---');
assert(dataJs.includes('refBoxes = ['), 'data.js seeds reference boxes');
assert(dataJs.includes('daysActive: 7') && dataJs.includes('daysActive: 12') && dataJs.includes('daysActive: 21'), 'data.js seeds age >= 7 for older boxes');
assert(dataJs.includes('lastScannedSlot: 6'), 'data.js sets default selected slot 6');
assert(dataJs.includes("gameName: 'Loteria'") && dataJs.includes("gameName: 'Cash 500,000'"), 'data.js seeds Georgia reference games');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
