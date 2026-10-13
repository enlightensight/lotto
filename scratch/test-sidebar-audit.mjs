import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

// Parse all IDs in index.html
const idRegex = /id=["']([^"']+)["']/g;
const allIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  allIds.add(match[1]);
}

const eventRegistry = new Map(); // elementId -> Map(eventType, [handlers])

function createMockElement(id) {
  const listeners = new Map();
  return {
    id: id || '',
    tagName: 'DIV',
    dataset: {},
    style: { display: '' },
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      contains: function(c) { return this._classes.has(c); },
      toggle: function(c) {
        if (this._classes.has(c)) this._classes.delete(c);
        else this._classes.add(c);
      }
    },
    addEventListener: function(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
      if (!eventRegistry.has(id)) eventRegistry.set(id, new Map());
      if (!eventRegistry.get(id).has(event)) eventRegistry.get(id).set(event, []);
      eventRegistry.get(id).get(event).push(handler);
    },
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    focus: () => {},
    blur: () => {},
    showModal: () => {},
    close: () => {},
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    disabled: false
  };
}

const elements = new Map();

global.document = {
  createElement: (tag) => createMockElement(tag),
  getElementById: (id) => {
    if (!elements.has(id)) {
      if (allIds.has(id)) {
        elements.set(id, createMockElement(id));
      } else {
        return null;
      }
    }
    return elements.get(id);
  },
  querySelector: (sel) => createMockElement(sel),
  querySelectorAll: (sel) => {
    if (sel === '.sidebar-nav-item') {
      const ids = ['navSellCounter', 'navReceivePacks', 'navInventory', 'navDayReport', 'navHistory', 'navSettings'];
      return ids.map(id => global.document.getElementById(id));
    }
    return [createMockElement(sel)];
  },
  addEventListener: () => {},
  body: createMockElement('body'),
  documentElement: createMockElement('html')
};

global.window = {
  addEventListener: () => {},
  location: { hash: '', pathname: '/' },
  history: { replaceState: () => {} },
  scrollTo: () => {},
  print: () => {},
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  speechSynthesis: { speak: () => {}, getVoices: () => [] }
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

console.log('--- Testing Sidebar Navigation Initialization ---');
await import('../src/main.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function triggerClick(id) {
  const handlers = eventRegistry.get(id)?.get('click');
  if (!handlers || handlers.length === 0) {
    return false;
  }
  for (const h of handlers) {
    h({ stopPropagation: () => {}, preventDefault: () => {} });
  }
  return true;
}

// 1. Verify that click listeners are registered on all sidebar elements
const sidebarNavIds = [
  'navSellCounter',
  'navReceivePacks',
  'navInventory',
  'navDayReport',
  'navHistory',
  'navSettings'
];

for (const id of sidebarNavIds) {
  const hasListener = triggerClick(id);
  assert(hasListener, `Sidebar #${id} has working click listener`);
}

// 2. Verify view switching behavior
triggerClick('navReceivePacks');
const viewReceive = global.document.getElementById('viewReceivePacks');
const viewSell = global.document.getElementById('viewSellCounter');
assert(viewReceive.style.display === 'block', 'Receive Packs view is displayed after clicking #navReceivePacks');
assert(viewSell.style.display === 'none', 'Sell Counter view is hidden when Receive Packs is active');

triggerClick('navInventory');
const viewInv = global.document.getElementById('viewInventory');
assert(viewInv.style.display === 'block', 'Inventory view is displayed after clicking #navInventory');
assert(viewReceive.style.display === 'none', 'Receive Packs is hidden when Inventory is active');

triggerClick('navDayReport');
const viewReport = global.document.getElementById('viewDayReport');
assert(viewReport.style.display === 'block', 'Day Report view is displayed after clicking #navDayReport');
assert(viewInv.style.display === 'none', 'Inventory is hidden when Day Report is active');

triggerClick('navHistory');
const viewHist = global.document.getElementById('viewHistory');
assert(viewHist.style.display === 'block', 'History view is displayed after clicking #navHistory');
assert(viewReport.style.display === 'none', 'Day Report is hidden when History is active');

triggerClick('navSettings');
const viewSet = global.document.getElementById('viewSettings');
assert(viewSet.style.display === 'block', 'Settings view is displayed after clicking #navSettings');
assert(viewHist.style.display === 'none', 'History is hidden when Settings is active');

triggerClick('navSellCounter');
assert(viewSell.style.display === 'block', 'Sell Counter view is displayed after clicking #navSellCounter');
assert(viewSet.style.display === 'none', 'Settings is hidden when Sell Counter is active');

// 3. Test theme toggle button
const themeHasListener = triggerClick('themeToggleBtn');
assert(themeHasListener, '#themeToggleBtn has click listener');

// 4. Test sign out button
const signoutHasListener = triggerClick('menuSignOutBtn');
assert(signoutHasListener, '#menuSignOutBtn has click listener');

// 5. Test sidebar user pill
const pillHasListener = triggerClick('sidebarUserPill');
assert(pillHasListener, '#sidebarUserPill has click listener');

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
