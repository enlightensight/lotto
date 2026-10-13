import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

// Parse all IDs in index.html
const idRegex = /id=["']([^"']+)["']/g;
const allIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  allIds.add(match[1]);
}

console.log(`Loaded ${allIds.size} distinct IDs from index.html.`);

// Create mock elements
const elements = new Map();

function createMockElement(id) {
  return {
    id: id || '',
    tagName: 'DIV',
    dataset: {},
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {}
    },
    addEventListener: (event, handler) => {
      // console.log(`[Event Added] #${id} -> ${event}`);
    },
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
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

// Global document mock
global.document = {
  createElement: (tag) => createMockElement(tag),
  getElementById: (id) => {
    if (!elements.has(id)) {
      if (allIds.has(id)) {
        elements.set(id, createMockElement(id));
      } else {
        // ID does not exist in index.html!
        return null;
      }
    }
    return elements.get(id);
  },
  querySelector: (sel) => createMockElement(sel),
  querySelectorAll: (sel) => [createMockElement(sel)],
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

// Now let's try running main.js by importing it or evaluating setupEventListeners
console.log('Testing import of src/main.js in Node...');
try {
  await import('../src/main.js');
  console.log('✓ Successfully imported and initialized src/main.js with mock DOM!');
} catch (err) {
  console.error('❌ CRASH during src/main.js execution:');
  console.error(err);
}
