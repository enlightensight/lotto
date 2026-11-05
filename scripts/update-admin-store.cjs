const fs = require('fs');

// 1. Update src/data.js
let dataJs = fs.readFileSync('src/data.js', 'utf8');
const adminStoreObj = `  {
    id: 'store_admin',
    name: 'ADMIN STORE',
    address: 'Platform Head Office, Warner Robins, GA, 31088',
    retailerNumber: 'GA-ADM01',
    phone: '(478) 555-0100',
    totalBoxes: 65,
    status: 'ACTIVE'
  },
`;

if (!dataJs.includes('store_admin')) {
  dataJs = dataJs.replace(/(export const DEFAULT_STORES = \[\r?\n)/, `$1${adminStoreObj}`);
  dataJs = dataJs.replace(
    /if \(Array\.isArray\(parsed\) && parsed\.length > 0\) return parsed;/,
    `if (Array.isArray(parsed) && parsed.length > 0) {\n        if (!parsed.some(s => s.id === 'store_admin')) {\n          parsed.unshift(DEFAULT_STORES[0]);\n          saveStoresList(parsed);\n        }\n        return parsed;\n      }`
  );
  fs.writeFileSync('src/data.js', dataJs, 'utf8');
  console.log('✓ Updated src/data.js with store_admin');
}

// 2. Update src/clerksData.js
let clerksJs = fs.readFileSync('src/clerksData.js', 'utf8');
if (clerksJs.includes("storeId: 'platform_admin'")) {
  clerksJs = clerksJs.replace("storeId: 'platform_admin'", "storeId: 'store_admin'");
  clerksJs = clerksJs.replace("storeName: 'Platform Administrator'", "storeName: 'ADMIN STORE'");
  fs.writeFileSync('src/clerksData.js', clerksJs, 'utf8');
  console.log('✓ Updated src/clerksData.js with store_admin');
}

// 3. Update src/adminUiHandlers.js
let adminUi = fs.readFileSync('src/adminUiHandlers.js', 'utf8');
adminUi = adminUi.replace(
  /const targetStoreId = \(typeof window\.getCurrentStoreId === 'function' \? window\.getCurrentStoreId\(\) : 'store_amigo'\) \|\| 'store_amigo';/,
  `const targetStoreId = 'store_admin';`
);
adminUi = adminUi.replace(
  /showToast\('Switched to Store POS counter view\.', 'info'\);/,
  `showToast('Switched to Admin Store POS counter view.', 'info');`
);
fs.writeFileSync('src/adminUiHandlers.js', adminUi, 'utf8');
console.log('✓ Updated src/adminUiHandlers.js switch to store_admin');

// 4. Update src/main.js
let mainJs = fs.readFileSync('src/main.js', 'utf8');
mainJs = mainJs.replace(
  "storeId: data.storeId || (isAdmin ? 'platform_admin' : 'store_amigo')",
  "storeId: data.storeId || (isAdmin ? 'store_admin' : 'store_amigo')"
);
mainJs = mainJs.replace(
  "storeName: data.storeName || (isAdmin ? 'Platform Admin' : 'Amigo Food Mart')",
  "storeName: data.storeName || (isAdmin ? 'ADMIN STORE' : 'Amigo Food Mart')"
);
mainJs = mainJs.replace(
  /if \(authRes\.isAdmin\) \{\r?\n\s+showAdminDashboardView\(\);/g,
  `if (authRes.isAdmin) {\n      setCurrentStoreId('store_admin');\n      if (typeof window.switchStore === 'function') window.switchStore('store_admin');\n      showAdminDashboardView();`
);
fs.writeFileSync('src/main.js', mainJs, 'utf8');
console.log('✓ Updated src/main.js admin routing to store_admin');

// 5. Update server.js
let serverJs = fs.readFileSync('server.js', 'utf8');
if (!serverJs.includes("storeId: 'store_admin'")) {
  serverJs = serverJs.replace(
    /(isAdmin: true,\r?\n\s+mode: 'ADMIN'\r?\n\s+\}, 86400\);)/,
    `storeId: 'store_admin',\n        storeName: 'ADMIN STORE',\n        $1`
  );
  serverJs = serverJs.replace(
    /(return res\.json\(\{\r?\n\s+success: true,\r?\n\s+mode: 'ADMIN',)/,
    `$1\n        storeId: 'store_admin',\n        storeName: 'ADMIN STORE',`
  );
  fs.writeFileSync('server.js', serverJs, 'utf8');
  console.log('✓ Updated server.js admin responses with store_admin');
}

// 6. Update server_data/admin_state.json
const adminStatePath = 'server_data/admin_state.json';
if (fs.existsSync(adminStatePath)) {
  const adminState = JSON.parse(fs.readFileSync(adminStatePath, 'utf8'));
  if (!Array.isArray(adminState.stores)) adminState.stores = [];
  if (!adminState.stores.some(s => s.storeId === 'store_admin')) {
    adminState.stores.unshift({
      storeId: 'store_admin',
      storeName: 'ADMIN STORE',
      ownerUsername: 'admin',
      retailerNumber: 'GA-ADM01',
      address: 'Platform Head Office, Warner Robins, GA, 31088',
      phone: '(478) 555-0100',
      totalBoxes: 65,
      authorizationStatus: 'APPROVED',
      operationalStatus: 'ACTIVE'
    });
    fs.writeFileSync(adminStatePath, JSON.stringify(adminState, null, 2), 'utf8');
    console.log('✓ Added store_admin to server_data/admin_state.json');
  }
}

// 7. Ensure pos_state_store_admin.json exists
const adminPosPath = 'server_data/pos_state_store_admin.json';
if (!fs.existsSync(adminPosPath)) {
  const cleanAdminState = {
    storeId: 'store_admin',
    storeName: 'ADMIN STORE',
    totalSlots: 65,
    shiftNumber: 1,
    shiftStatus: 'SHIFT_NOT_STARTED',
    slots: Array.from({ length: 65 }, (_, i) => ({
      boxNumber: i + 1,
      gameName: '',
      price: 1,
      packNumber: '',
      startTicket: 0,
      currentTicket: 0,
      ticketsSold: 0,
      status: 'EMPTY'
    })),
    inStockInventory: []
  };
  fs.writeFileSync(adminPosPath, JSON.stringify(cleanAdminState, null, 2), 'utf8');
  console.log('✓ Initialized clean pos_state_store_admin.json');
}

