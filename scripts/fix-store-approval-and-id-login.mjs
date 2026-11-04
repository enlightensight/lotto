import fs from 'fs';
import path from 'path';

console.log('--- Applying Fix: Remove Admin Approval Block & Support ID/Username Login ---');

// 1. Patch server.js
function patchServer() {
  const filePath = path.resolve('server.js');
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';

  // 1a. Remove PENDING rejection in requireStoreActive
  const oldPendingStore = `    if (store.authorizationStatus === 'PENDING') {
      return res.status(403).json({
        success: false,
        code: 'STORE_PENDING',
        message: \`Access Denied: Store "\${store.storeName}" is awaiting administrator approval.\`
      });
    }`;

  const normOldPending = oldPendingStore.replace(/\r?\n/g, eol);
  if (content.includes(normOldPending)) {
    content = content.replace(normOldPending, `    // Normal stores in PENDING status are permitted to sell and activate tickets without admin approval`);
    console.log('✓ Removed PENDING store block in requireStoreActive');
  } else {
    console.warn('Pending store block in requireStoreActive already modified or not found');
  }

  // 1b. Patch /api/auth/login identifier validation and queries
  const oldLoginValidation = `    const normEmail = rawIdentifier.toLowerCase();

    // Enforce email format as the sole login identifier; reject username-only logins (e.g. "admin", "amigo")
    if (!normEmail.includes('@') || !normEmail.includes('.')) {
      return res.status(400).json({
        success: false,
        code: 'EMAIL_REQUIRED',
        message: 'Invalid login identifier. Please enter your registered email address (username-only login is disabled).'
      });
    }

    const st = getAdminState();

    // 1. Retrieve candidate records for this email from both namespaces
    let matchedAdmin = null;
    let matchedStoreUser = null;

    if (isDbConnected && pool) {
      try {
        const [adminRows] = await pool.query(
          'SELECT * FROM admin_users WHERE LOWER(email) = ? AND is_active = 1',
          [normEmail]
        );
        if (adminRows.length > 0) matchedAdmin = adminRows[0];
      } catch (_) {}

      try {
        const [storeRows] = await pool.query(
          'SELECT * FROM store_users WHERE (LOWER(email) = ? OR LOWER(normalized_email) = ?) AND is_active = 1',
          [normEmail, normEmail]
        );
        if (storeRows.length > 0) matchedStoreUser = storeRows[0];
      } catch (_) {}
    }

    // In-memory state fallbacks
    if (!matchedAdmin && Array.isArray(st.admins)) {
      matchedAdmin = st.admins.find(a => (a.email || '').toLowerCase().trim() === normEmail && a.is_active);
    }
    if (!matchedStoreUser && Array.isArray(st.storeUsers)) {
      matchedStoreUser = st.storeUsers.find(u =>
        ((u.email || '').toLowerCase().trim() === normEmail ||
         (u.normalizedEmail || '').toLowerCase().trim() === normEmail) &&
        u.isActive !== false
      );
    }`;

  const newLoginValidation = `    const normIdentifier = rawIdentifier.toLowerCase();
    const st = getAdminState();

    // 1. Retrieve candidate records for this identifier (supports ID, username, or email)
    let matchedAdmin = null;
    let matchedStoreUser = null;

    if (isDbConnected && pool) {
      try {
        const [adminRows] = await pool.query(
          'SELECT * FROM admin_users WHERE (LOWER(email) = ? OR LOWER(username) = ? OR LOWER(id) = ?) AND is_active = 1',
          [normIdentifier, normIdentifier, normIdentifier]
        );
        if (adminRows.length > 0) matchedAdmin = adminRows[0];
      } catch (_) {}

      try {
        const [storeRows] = await pool.query(
          'SELECT * FROM store_users WHERE (LOWER(email) = ? OR LOWER(username) = ? OR LOWER(normalized_email) = ? OR LOWER(id) = ? OR LOWER(store_id) = ?) AND is_active = 1',
          [normIdentifier, normIdentifier, normIdentifier, normIdentifier, normIdentifier]
        );
        if (storeRows.length > 0) matchedStoreUser = storeRows[0];
      } catch (_) {}
    }

    // In-memory state fallbacks
    if (!matchedAdmin && Array.isArray(st.admins)) {
      matchedAdmin = st.admins.find(a =>
        ((a.email || '').toLowerCase().trim() === normIdentifier ||
         (a.username || '').toLowerCase().trim() === normIdentifier ||
         (a.id || '').toLowerCase().trim() === normIdentifier) &&
        a.is_active !== false
      );
    }
    if (!matchedStoreUser && Array.isArray(st.storeUsers)) {
      matchedStoreUser = st.storeUsers.find(u =>
        ((u.email || '').toLowerCase().trim() === normIdentifier ||
         (u.username || '').toLowerCase().trim() === normIdentifier ||
         (u.normalizedEmail || '').toLowerCase().trim() === normIdentifier ||
         (u.id || '').toLowerCase().trim() === normIdentifier ||
         (u.storeId || '').toLowerCase().trim() === normIdentifier ||
         (u.store_id || '').toLowerCase().trim() === normIdentifier) &&
        u.isActive !== false
      );
    }`;

  const normOldLogin = oldLoginValidation.replace(/\r?\n/g, eol);
  const normNewLogin = newLoginValidation.replace(/\r?\n/g, eol);

  if (content.includes(normOldLogin)) {
    content = content.replace(normOldLogin, normNewLogin);
    console.log('✓ Updated /api/auth/login candidate lookup to support ID, username, and email');
  } else {
    console.warn('oldLoginValidation block not matched in server.js');
  }

  // 1c. Remove STORE_USER_PENDING and STORE_PENDING login rejection
  const oldUserPending = `      if (userStatus === 'PENDING') {
        return res.status(403).json({
          success: false,
          code: 'STORE_USER_PENDING',
          message: 'Access Denied: This store account is pending administrator approval.'
        });
      }`;

  const normOldUserPending = oldUserPending.replace(/\r?\n/g, eol);
  if (content.includes(normOldUserPending)) {
    content = content.replace(normOldUserPending, `      // Normal store users in PENDING status are permitted to log in and operate POS`);
    console.log('✓ Removed STORE_USER_PENDING login block');
  }

  const oldStorePendingLogin = `        if (storeRec.authorizationStatus === 'PENDING') {
          return res.status(403).json({
            success: false,
            code: 'STORE_PENDING',
            message: \`Access Denied: Store "\${storeRec.storeName}" is awaiting administrator approval.\`
          });
        }`;

  const normOldStorePendingLogin = oldStorePendingLogin.replace(/\r?\n/g, eol);
  if (content.includes(normOldStorePendingLogin)) {
    content = content.replace(normOldStorePendingLogin, `        // Normal stores in PENDING status are permitted to log in and operate POS`);
    console.log('✓ Removed STORE_PENDING login block');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 2. Patch src/main.js
function patchMainJs() {
  const filePath = path.resolve('src/main.js');
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';

  const oldValidation = `    if (!email) {
      if (errorAlert) {
        errorAlert.textContent = 'Please enter your email address.';
        errorAlert.style.display = 'block';
      }
      userInput?.focus();
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      if (errorAlert) {
        errorAlert.textContent = 'Please enter a valid registered email address.';
        errorAlert.style.display = 'block';
      }
      userInput?.focus();
      return;
    }`;

  const newValidation = `    if (!email) {
      if (errorAlert) {
        errorAlert.textContent = 'Please enter your ID, username, or email.';
        errorAlert.style.display = 'block';
      }
      userInput?.focus();
      return;
    }`;

  const normOldVal = oldValidation.replace(/\r?\n/g, eol);
  const normNewVal = newValidation.replace(/\r?\n/g, eol);

  if (content.includes(normOldVal)) {
    content = content.replace(normOldVal, normNewVal);
    console.log('✓ Removed email-only restriction in src/main.js handleSignInSubmit');
  } else {
    console.warn('oldValidation block not matched in src/main.js');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

// 3. Patch index.html
function patchIndexHtml() {
  const filePath = path.resolve('index.html');
  let content = fs.readFileSync(filePath, 'utf8');

  // Change label from "Email address" to "Email or Username / ID"
  content = content.replace(
    '<label for="inputSignInUser" class="signin-label">Email address</label>',
    '<label for="inputSignInUser" class="signin-label">Email or Username / ID</label>'
  );

  // Change type="email" to type="text"
  content = content.replace(
    /type="email"\s+id="inputSignInUser"\s+class="signin-input"\s+placeholder="[^"]*"/,
    'type="text" id="inputSignInUser" class="signin-input" placeholder="e.g. amigo, admin, or name@example.com"'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Updated index.html inputSignInUser to type="text" with ID/Username placeholder');
}

patchServer();
patchMainJs();
patchIndexHtml();
console.log('✓ All patches applied successfully!');

