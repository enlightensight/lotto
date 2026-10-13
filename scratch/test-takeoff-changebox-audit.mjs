// Verification Suite for Take Off The Rack & Change Box Modals (Matching Screenshots 1 & 2)
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

console.log('--- 1. Testing index.html Modal 1: returnPackModal (Screenshot 1) ---');
const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

assert(htmlContent.includes('id="returnPackModal"'), 'returnPackModal exists');
assert(htmlContent.includes('id="returnPackBoxBadge"'), 'Badge for box number exists');
assert(htmlContent.includes('id="returnPackModalTitle"'), 'Modal title element exists');
assert(htmlContent.includes('id="returnPackModalSubtitle"'), 'Modal subtitle element exists');
assert(htmlContent.includes('WHERE ARE THE REMAINING TICKETS GOING?'), 'Section label exists');

assert(htmlContent.includes('id="cardReturnToLottery"'), 'Card 1 (Return to Lottery) exists');
assert(htmlContent.includes('Return to Lottery'), 'Return to Lottery title exists');
assert(htmlContent.includes('Send the tickets back for credit'), 'Return to Lottery description exists');
assert(htmlContent.includes('id="returnLotteryCreditText"'), 'Credit value element exists');

assert(htmlContent.includes('id="cardKeepInSafe"'), 'Card 2 (Keep in the safe) exists');
assert(htmlContent.includes('Keep in the safe'), 'Keep in the safe title exists');
assert(htmlContent.includes('Free up the box for another game'), 'Keep in the safe description exists');
assert(htmlContent.includes('id="returnStorageValText"'), 'Stored safe value element exists');

assert(htmlContent.includes('id="cancelReturnPackBtn"'), 'Cancel button exists');
assert(htmlContent.includes('Cancel &mdash; keep it in the box'), 'Cancel button has exact label matching screenshot');

console.log('--- 2. Testing index.html Modal 2: changeBoxModal (Screenshot 2) ---');
assert(htmlContent.includes('id="changeBoxModal"'), 'changeBoxModal exists');
assert(htmlContent.includes('Change box number'), 'Title Change box number exists');
assert(htmlContent.includes('Move this pack to an empty box.'), 'Subtitle Move this pack to an empty box exists');

// Left Column
assert(htmlContent.includes('id="changeBoxPricePill"'), 'Price pill element exists');
assert(htmlContent.includes('id="changeBoxPackTitle"'), 'Pack title element exists');
assert(htmlContent.includes('id="changeBoxPackSub"'), 'Pack subtitle element exists');
assert(htmlContent.includes('NEW BOX NUMBER'), 'NEW BOX NUMBER section label exists');
assert(htmlContent.includes('id="changeBoxDisplayVal"'), 'Display value box element exists');
assert(htmlContent.includes('EMPTY BOXES'), 'EMPTY BOXES section label exists');
assert(htmlContent.includes('id="changeBoxEmptyPills"'), 'Empty box pills container exists');

// Right Column Keypad
assert(htmlContent.includes('class="change-box-keypad"'), 'Keypad container exists');
assert(htmlContent.includes('id="keyChangeClear"'), 'Clear button exists');
assert(htmlContent.includes('id="keyChangeBackspace"'), 'Backspace button exists');

// Footer Actions
assert(htmlContent.includes('id="btnCancelChangeBox"'), 'Cancel button exists');
assert(htmlContent.includes('id="btnConfirmChangeBox"'), 'Confirm Move pack button exists');
assert(htmlContent.includes('Move pack'), 'Move pack button text exists');

console.log('--- 3. Testing src/style.css Styles for Both Modals ---');
const styleCss = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');

assert(styleCss.includes('dialog#returnPackModal'), 'style.css has dialog#returnPackModal styles');
assert(styleCss.includes('.take-off-dest-card'), 'style.css has .take-off-dest-card styles');
assert(styleCss.includes('.take-off-dest-card.lottery'), 'style.css has lottery card hover styles');
assert(styleCss.includes('.take-off-dest-card.safe'), 'style.css has safe card hover styles');

assert(styleCss.includes('dialog#changeBoxModal'), 'style.css has dialog#changeBoxModal styles');
assert(styleCss.includes('.change-box-grid'), 'style.css has 2-column .change-box-grid');
assert(styleCss.includes('.new-box-display-wrap'), 'style.css has .new-box-display-wrap styles');
assert(styleCss.includes('.empty-box-pill'), 'style.css has .empty-box-pill styles');
assert(styleCss.includes('.change-box-keypad'), 'style.css has .change-box-keypad grid');
assert(styleCss.includes('.btn-confirm-move-pack'), 'style.css has .btn-confirm-move-pack styles');

assert(styleCss.includes('[data-theme="dark"] dialog#returnPackModal'), 'style.css has dark theme returnPackModal');
assert(styleCss.includes('[data-theme="dark"] dialog#changeBoxModal'), 'style.css has dark theme changeBoxModal');

console.log('--- 4. Testing src/main.js Logic & Keypad Wiring ---');
const mainJs = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

assert(mainJs.includes('returnPackBoxBadge'), 'main.js populates returnPackBoxBadge');
assert(mainJs.includes('returnPackModalTitle'), 'main.js populates returnPackModalTitle');
assert(mainJs.includes('returnPackModalSubtitle'), 'main.js populates returnPackModalSubtitle');
assert(mainJs.includes('cardReturnToLottery'), 'main.js wires cardReturnToLottery click');
assert(mainJs.includes('cardKeepInSafe'), 'main.js wires cardKeepInSafe click');

assert(mainJs.includes('changeBoxPricePill'), 'main.js populates changeBoxPricePill');
assert(mainJs.includes('changeBoxPackTitle'), 'main.js populates changeBoxPackTitle');
assert(mainJs.includes('changeBoxPackSub'), 'main.js populates changeBoxPackSub');
assert(mainJs.includes('changeBoxEmptyPills'), 'main.js dynamically populates empty boxes pills');
assert(mainJs.includes('syncChangeBoxDisplay'), 'main.js synchronizes display value and pill highlights');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
