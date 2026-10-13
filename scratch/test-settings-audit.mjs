// Automated Verification Suite for LottoTrack Settings Screen
import fs from 'fs';
import path from 'path';
import { REFERENCE_SETTINGS_GAMES, getSettingsGamesList } from '../src/gamesData.js';
import { REFERENCE_SETTINGS_PEOPLE, getSettingsPeopleList } from '../src/clerksData.js';

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

console.log('--- 1. Testing gamesData.js Reference Games (Matching Screenshot) ---');
assert(REFERENCE_SETTINGS_GAMES.length === 10, 'Reference games has 10 games matching screenshot');

const expectedGames = [
  { name: '5X Money', gameNumber: '1650', price: 1, ticketsPack: 300, bookValue: 300 },
  { name: 'Jr Jumbo', gameNumber: '1602', price: 1, ticketsPack: 300, bookValue: 300 },
  { name: 'Loteria', gameNumber: '1631', price: 2, ticketsPack: 150, bookValue: 300 },
  { name: 'Hit 100', gameNumber: '1644', price: 2, ticketsPack: 150, bookValue: 300 },
  { name: 'Cross Word', gameNumber: '1590', price: 3, ticketsPack: 100, bookValue: 300 },
  { name: 'Treasure Hunt', gameNumber: '1611', price: 3, ticketsPack: 100, bookValue: 300 },
  { name: 'Lucky 7s', gameNumber: '1688', price: 5, ticketsPack: 60, bookValue: 300 },
  { name: '50X Money', gameNumber: '1711', price: 10, ticketsPack: 30, bookValue: 300 },
  { name: 'Hit 1000', gameNumber: '1720', price: 20, ticketsPack: 30, bookValue: 600 },
  { name: '500X The Money', gameNumber: '1770', price: 50, ticketsPack: 20, bookValue: 1000 },
];

expectedGames.forEach(eg => {
  const match = REFERENCE_SETTINGS_GAMES.find(g => g.name === eg.name);
  assert(Boolean(match), `Found game ${eg.name}`);
  if (match) {
    assert(match.gameNumber === eg.gameNumber, `${eg.name} game# matches ${eg.gameNumber}`);
    assert(match.price === eg.price, `${eg.name} price matches $${eg.price}`);
    assert(match.ticketsPack === eg.ticketsPack, `${eg.name} tix/pack matches ${eg.ticketsPack}`);
    assert(match.bookValue === eg.bookValue, `${eg.name} book value matches $${eg.bookValue}`);
  }
});

const mockStateGames = { customGames: [{ name: 'Mega Millions Ext', gameNumber: '1999', price: 5, packSize: 60, bookValue: 300 }] };
const mergedGames = getSettingsGamesList(mockStateGames);
assert(mergedGames.length === 11, 'Custom games appended properly (11 total)');

console.log('--- 2. Testing clerksData.js Reference People (Matching Screenshot) ---');
assert(REFERENCE_SETTINGS_PEOPLE.length === 3, 'Reference people has 3 people matching screenshot');

const expectedPeople = [
  { name: 'master', role: 'Owner', desc: 'Owner · can change settings and clear data' },
  { name: 'Priya', role: 'Clerk', desc: 'Clerk · can sell, receive packs and end the day' },
  { name: 'Carlos', role: 'Clerk', desc: 'Clerk · can sell, receive packs and end the day' },
];

expectedPeople.forEach(ep => {
  const match = REFERENCE_SETTINGS_PEOPLE.find(p => p.name === ep.name);
  assert(Boolean(match), `Found person ${ep.name}`);
  if (match) {
    assert(match.role === ep.role, `${ep.name} role matches ${ep.role}`);
    assert(match.roleDesc === ep.desc, `${ep.name} description matches`);
  }
});

const mockStatePeople = { clerks: [...REFERENCE_SETTINGS_PEOPLE, { name: 'Sarah', role: 'Clerk', roleDesc: 'Clerk · can sell', pin: '5555' }] };
const mergedPeople = getSettingsPeopleList(mockStatePeople);
assert(mergedPeople.length === 4, 'Custom clerks list supported (4 total)');

console.log('--- 3. Testing index.html Settings View DOM Structure ---');
const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');

assert(htmlContent.includes('id="viewSettings"'), 'index.html contains #viewSettings container');
assert(htmlContent.includes('Settings'), 'index.html contains Settings title');
assert(htmlContent.includes('Only the store owner can change these.'), 'index.html contains owner disclaimer subtitle');
assert(htmlContent.includes('id="btnSettingsSaveAll"'), 'index.html contains #btnSettingsSaveAll (Save changes button)');
assert(htmlContent.includes('data-tab="store"'), 'index.html contains Store details tab');
assert(htmlContent.includes('data-tab="dayorshift"'), 'index.html contains Day or shift tab');
assert(htmlContent.includes('data-tab="rack"'), 'index.html contains Rack & alerts tab');
assert(htmlContent.includes('data-tab="games"'), 'index.html contains Ticket games tab');
assert(htmlContent.includes('data-tab="people"'), 'index.html contains People & PINs tab');
assert(htmlContent.includes('data-tab="printing"'), 'index.html contains Printing tab');
assert(htmlContent.includes('data-tab="cleardata"'), 'index.html contains Clear data tab');

assert(htmlContent.includes('id="paneSettingsStore"'), 'index.html contains #paneSettingsStore');
assert(htmlContent.includes('id="paneSettingsDayOrShift"'), 'index.html contains #paneSettingsDayOrShift');
assert(htmlContent.includes('id="cardModeDaily"'), 'index.html contains #cardModeDaily');
assert(htmlContent.includes('id="cardModeShifts"'), 'index.html contains #cardModeShifts');
assert(htmlContent.includes('id="setCounterCashier"'), 'index.html contains #setCounterCashier');
assert(htmlContent.includes('id="paneSettingsRack"'), 'index.html contains #paneSettingsRack');
assert(htmlContent.includes('id="paneSettingsGames"'), 'index.html contains #paneSettingsGames');
assert(htmlContent.includes('id="paneSettingsPeople"'), 'index.html contains #paneSettingsPeople');
assert(htmlContent.includes('id="paneSettingsPrinting"'), 'index.html contains #paneSettingsPrinting');
assert(htmlContent.includes('id="paneSettingsClearData"'), 'index.html contains #paneSettingsClearData');

// Printing tab contents
assert(htmlContent.includes('id="setReportPrinter"'), 'index.html contains #setReportPrinter dropdown');
assert(htmlContent.includes('Receipt printer (80 mm)'), 'index.html contains Receipt printer (80 mm) option');
assert(htmlContent.includes('id="toggleAutoPrintDayReport"'), 'index.html contains #toggleAutoPrintDayReport');
assert(htmlContent.includes('Print day report when the day ends'), 'index.html contains Print day report when the day ends');
assert(htmlContent.includes('id="toggleShowEmptyBoxesReport"'), 'index.html contains #toggleShowEmptyBoxesReport');
assert(htmlContent.includes('Show empty boxes on report'), 'index.html contains Show empty boxes on report');

// Clear data tab contents
assert(htmlContent.includes('Clear all data'), 'index.html contains Clear all data title');
assert(htmlContent.includes('This deletes every box, pack, sale and report on this register.'), 'index.html contains clear data warning description');
assert(htmlContent.includes('Type CLEAR to confirm'), 'index.html contains Type CLEAR to confirm label');
assert(htmlContent.includes('id="inputConfirmClear"'), 'index.html contains #inputConfirmClear input');
assert(htmlContent.includes('id="btnClearAllData"'), 'index.html contains #btnClearAllData button');

console.log('--- 4. Testing src/style.css Settings Styles ---');
const cssContent = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');

assert(cssContent.includes('.settings-view'), 'style.css contains .settings-view styles');
assert(cssContent.includes('.btn-settings-save-header'), 'style.css contains .btn-settings-save-header');
assert(cssContent.includes('.settings-layout-grid'), 'style.css contains two-column .settings-layout-grid');
assert(cssContent.includes('.settings-tabs-nav'), 'style.css contains .settings-tabs-nav');
assert(cssContent.includes('.settings-tab-btn.active'), 'style.css contains active tab pill styles');
assert(cssContent.includes('.settings-tab-btn.danger'), 'style.css contains red destructive tab pill styles');
assert(cssContent.includes('.settings-card-panel'), 'style.css contains .settings-card-panel');
assert(cssContent.includes('.settings-text-input'), 'style.css contains .settings-text-input');

assert(cssContent.includes('.settings-select-dropdown'), 'style.css contains .settings-select-dropdown');
assert(cssContent.includes('.settings-danger-panel'), 'style.css contains .settings-danger-panel');
assert(cssContent.includes('.settings-danger-card-title'), 'style.css contains .settings-danger-card-title');
assert(cssContent.includes('.settings-danger-card-desc'), 'style.css contains .settings-danger-card-desc');
assert(cssContent.includes('.settings-danger-label'), 'style.css contains .settings-danger-label');
assert(cssContent.includes('.settings-danger-input'), 'style.css contains .settings-danger-input');
assert(cssContent.includes('.btn-clear-all-data'), 'style.css contains .btn-clear-all-data');
assert(cssContent.includes('.btn-clear-all-data.ready'), 'style.css contains .btn-clear-all-data.ready');

assert(cssContent.includes('[data-theme="dark"] .settings-select-dropdown'), 'style.css contains dark theme select dropdown');
assert(cssContent.includes('[data-theme="dark"] .settings-danger-panel'), 'style.css contains dark theme danger panel');
assert(cssContent.includes('[data-theme="dark"] .btn-clear-all-data'), 'style.css contains dark theme clear data button');

console.log('--- 5. Testing src/main.js Settings Logic & Navigation ---');
const mainContent = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

assert(mainContent.includes('setReportPrinter'), 'main.js reads/saves setReportPrinter');
assert(mainContent.includes('toggleAutoPrintDayReport'), 'main.js reads/saves toggleAutoPrintDayReport');
assert(mainContent.includes('toggleShowEmptyBoxesReport'), 'main.js reads/saves toggleShowEmptyBoxesReport');
assert(mainContent.includes('inputConfirmClear'), 'main.js wires inputConfirmClear');
assert(mainContent.includes('btnClearAllData'), 'main.js wires btnClearAllData');
assert(mainContent.includes("val === 'CLEAR'"), 'main.js requires typing CLEAR to activate clear button');
assert(mainContent.includes('populateSettingsInputs();'), 'main.js initializes settings inputs in initPOS');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
