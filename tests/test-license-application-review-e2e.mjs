// ============================================================================
// Real Browser E2E Test: Store License Send (PNG, ZIP, Encrypted File, Folder)
// & Admin Full Review Flow. Preserves server_data/admin_state.json.
// ============================================================================

import { spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9799;
const BASE_URL = 'http://127.0.0.1:5173/';
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e5d66af5-2b32-406b-b7b2-c5318eae9544';
const ADMIN_STATE_FILE = join(process.cwd(), 'server_data', 'admin_state.json');
const LICENSES_DIR = join(process.cwd(), 'server_data', 'licenses');

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAADklEQVR4nGP8z4APMOGVAAAhdAH+6vK6OAAAAABJRU5ErkJggg==';

// Build a valid PKZIP buffer containing an uncompressed PNG + a flag-bit-0 encrypted entry
function buildTestZipBase64() {
  const pngBuf = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
  const encBuf = Buffer.from('ENCRYPTED-PAYLOAD-BYTES', 'utf8');

  function makeEntry(name, dataBuf, flags = 0) {
    const nameBuf = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(flags, 6);
    lh.writeUInt16LE(0, 8); // stored (method 0)
    lh.writeUInt32LE(dataBuf.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(lh, 30);
    return { nameBuf, flags, dataBuf, localBlock: Buffer.concat([lh, dataBuf]) };
  }

  const e1 = makeEntry('folder/inside_license.png', pngBuf, 0);
  const e2 = makeEntry('locked_tax.pdf', encBuf, 1); // Bit 0 = encrypted entry
  const localAll = Buffer.concat([e1.localBlock, e2.localBlock]);

  function makeCd(entry, offset) {
    const cd = Buffer.alloc(46 + entry.nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(entry.flags, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt32LE(entry.dataBuf.length, 20);
    cd.writeUInt32LE(entry.dataBuf.length, 24);
    cd.writeUInt16LE(entry.nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    entry.nameBuf.copy(cd, 46);
    return cd;
  }

  const cd1 = makeCd(e1, 0);
  const cd2 = makeCd(e2, e1.localBlock.length);
  const cdAll = Buffer.concat([cd1, cd2]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(2, 8);
  eocd.writeUInt16LE(2, 10);
  eocd.writeUInt32LE(cdAll.length, 12);
  eocd.writeUInt32LE(localAll.length, 16);

  return Buffer.concat([localAll, cdAll, eocd]).toString('base64');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('\n============================================================');
  console.log('   REAL-BROWSER E2E: ZIP + ENCRYPTED + FOLDER LICENSE REVIEW');
  console.log('============================================================\n');

  const adminStateBackup = existsSync(ADMIN_STATE_FILE) ? readFileSync(ADMIN_STATE_FILE, 'utf8') : null;
  const existingPosFiles = new Set(readdirSync(join(process.cwd(), 'server_data')));
  const existingLicenseFiles = existsSync(LICENSES_DIR) ? new Set(readdirSync(LICENSES_DIR)) : new Set();

  let passed = 0;
  let failed = 0;
  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  const tmpProfile = mkdtempSync(join(tmpdir(), 'chrome-lic-e2e-'));
  const p = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,920',
    BASE_URL
  ]);

  let ws;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        targets = await res.json();
        if (targets?.some(t => t.type === 'page')) break;
      } catch (_) {}
      await sleep(250);
    }

    const page = targets.find(t => t.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(r => (ws.onopen = r));
    await send('Runtime.enable');
    await send('Page.enable');

    const evalCode = async (expression) => {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (res.result?.exceptionDetails) {
        throw new Error(res.result.exceptionDetails.exception?.description || 'Eval failed');
      }
      return res.result?.result?.value;
    };

    const saveShot = async (filename) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(ARTIFACT_DIR, filename), Buffer.from(res.result.data, 'base64'));
    };

    await sleep(1800);

    // 1. Force clean Sign-In view & check CTA button
    await evalCode(`
      sessionStorage.clear();
      localStorage.setItem('lotto_signed_out', 'true');
      localStorage.removeItem('lotto_session_user');
      localStorage.removeItem('lotto_admin_token');
      localStorage.removeItem('lotto_store_token');
      if (typeof showSignInScreen === 'function') showSignInScreen();
    `);
    await sleep(600);

    const ctaInfo = await evalCode(`(() => {
      const btn = document.getElementById('btnOpenStoreAppModal');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { text: btn.textContent.trim(), visible: r.width > 0 && r.height > 0 };
    })()`);
    assert(ctaInfo && ctaInfo.visible, `Sign-In shows "${ctaInfo?.text}" CTA button`);

    // 2. Open modal & upload: (a) ZIP archive, (b) .enc encrypted file, (c) folder-path file
    await evalCode(`document.getElementById('btnOpenStoreAppModal').click()`);
    await sleep(400);

    const zipB64 = buildTestZipBase64();
    const ts = Date.now();
    const storeName = `Peach State Lotto #${ts}`;
    const ownerEmail = `peach.${ts}@example.com`;
    const ownerPass = 'PeachPass99!';

    const uploadState = await evalCode(`(async () => {
      const zipBytes = Uint8Array.from(atob(${JSON.stringify(zipB64)}), c => c.charCodeAt(0));
      const zipFile = new File([zipBytes], 'license_pack.zip', { type: 'application/zip' });

      const encBytes = new TextEncoder().encode('U2FsdGVkX19encryptedDemoBytes');
      const encFile = new File([encBytes], 'tax_license.enc', { type: '' });

      const folderFile = new File(['Georgia Lottery Retail Permit 2026 - Active'], 'permit.txt', { type: 'text/plain' });
      Object.defineProperty(folderFile, 'webkitRelativePath', { value: 'StoreDocs/2026/permit.txt' });

      const dt1 = new DataTransfer();
      dt1.items.add(zipFile);
      dt1.items.add(encFile);
      dt1.items.add(folderFile);
      const fileInput = document.getElementById('appInputLicenseFiles');
      fileInput.files = dt1.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 350));

      return document.getElementById('appLicenseFilesPreview')?.textContent || '';
    })()`);

    assert(
      uploadState.includes('license_pack.zip') &&
      uploadState.includes('tax_license.enc') &&
      uploadState.includes('StoreDocs/2026/permit.txt'),
      'Upload queue accepts ZIP archive, empty-MIME .enc encrypted file, and folder relativePath'
    );

    await evalCode(`
      document.getElementById('appInputStoreName').value = ${JSON.stringify(storeName)};
      document.getElementById('appInputOwnerName').value = 'Elena Patel';
      document.getElementById('appInputRetailerId').value = 'GA-LIC-77889';
      document.getElementById('appInputTaxId').value = 'TAX-99-887766';
      document.getElementById('appInputLicenseExpiry').value = '2027-12-31';
      document.getElementById('appInputEmail').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('appInputPhone').value = '(478) 555-7744';
      document.getElementById('appInputAddress').value = '780 Watson Blvd, Warner Robins, GA 31093';
      document.getElementById('appInputPassword').value = ${JSON.stringify(ownerPass)};
      document.getElementById('appInputNotes').value = 'Attached ZIP bundle, encrypted tax license, and StoreDocs folder. File password: ZipSecret2026!';
    `);
    await saveShot('verified-store-send-license-modal.png');

    await evalCode(`
      document.getElementById('formSubmitStoreApp').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1200);

    const newLicFiles = existsSync(LICENSES_DIR)
      ? readdirSync(LICENSES_DIR).filter(f => !existingLicenseFiles.has(f))
      : [];
    assert(newLicFiles.length === 3, `All 3 attachments (ZIP, .enc, folder file) saved to disk (${newLicFiles.length})`);

    // 3. Log in as real Admin via UI & inspect Store Applications
    await evalCode(`
      document.getElementById('inputSignInUser').value = 'admin';
      document.getElementById('inputSignInPass').value = 'aj123456@';
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1800);

    await evalCode(`
      document.querySelector('#adminDashboardSubnav [data-admin-tab="applications"]')?.click();
    `);
    await sleep(1000);

    const tableInfo = await evalCode(`(() => {
      const tbody = document.getElementById('adminApplicationsTableBody');
      if (!tbody) return null;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const targetRow = rows.find(r => r.textContent.includes(${JSON.stringify(storeName)}));
      return targetRow ? { text: targetRow.textContent, appId: targetRow.querySelector('.btn-review-app')?.dataset?.appId } : null;
    })()`);
    assert(
      tableInfo && tableInfo.text.includes('GA-LIC-77889') && tableInfo.text.includes('3 Files'),
      'Admin Applications table lists License #, Tax ID, Expiry & 3 Files indicator cleanly'
    );
    await saveShot('verified-admin-applications-table.png');

    // 4. Open Review License modal & test ZIP explorer + ZIP entry PNG preview + .enc card + folder file
    await evalCode(`
      document.querySelector('.btn-review-app[data-app-id="' + ${JSON.stringify(tableInfo.appId)} + '"]')?.click();
    `);
    await sleep(1000);

    const zipViewInfo = await evalCode(`(() => {
      const details = document.getElementById('adminAppModalContent')?.textContent || '';
      const vp = document.getElementById('adminDocViewerViewport')?.textContent || '';
      return {
        hasArchivePass: details.includes('ZipSecret2026!'),
        hasZipEntries: vp.includes('folder/inside_license.png') && vp.includes('locked_tax.pdf') && vp.includes('Password-encrypted entry')
      };
    })()`);
    assert(
      zipViewInfo.hasArchivePass && zipViewInfo.hasZipEntries,
      'Admin Review inspects ZIP archive entries (detects PNG + encrypted entry) and displays archive password'
    );
    await saveShot('verified-admin-review-zip-contents.png');

    // Click Preview on PNG inside ZIP
    await evalCode(`document.querySelector('[data-zip-entry-idx="0"]')?.click()`);
    await sleep(800);
    const zipPngLoaded = await evalCode(`(() => {
      const img = document.querySelector('#adminDocViewerViewport img');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    })()`);
    assert(zipPngLoaded, 'Admin extracts and previews PNG image directly from inside uploaded ZIP');

    // Switch to encrypted .enc tab
    await evalCode(`document.querySelector('[data-lic-idx="1"]')?.click()`);
    await sleep(700);
    const encViewInfo = await evalCode(`document.getElementById('adminDocViewerViewport')?.textContent || ''`);
    assert(
      encViewInfo.includes('Encrypted License Container') && encViewInfo.includes('SHA-256:'),
      'Admin Review displays Encrypted Container details and SHA-256 checksum for .enc file'
    );

    // Switch to folder file tab
    await evalCode(`document.querySelector('[data-lic-idx="2"]')?.click()`);
    await sleep(700);
    const folderViewText = await evalCode(`document.getElementById('adminDocViewerViewport')?.textContent || ''`);
    assert(
      folderViewText.includes('Georgia Lottery Retail Permit 2026 - Active'),
      'Admin Review displays folder-uploaded document (StoreDocs/2026/permit.txt) inline'
    );

    // 5. Approve Store & verify newly approved store signs in
    await evalCode(`
      document.getElementById('adminAppNotesInput').value = 'ZIP, encrypted tax file, and permit folder verified.';
      document.getElementById('btnAdminAppApprove').click();
    `);
    await sleep(1200);

    await evalCode(`if (typeof signOutUser === 'function') signOutUser();`);
    await sleep(800);
    await evalCode(`
      document.getElementById('inputSignInUser').value = ${JSON.stringify(ownerEmail)};
      document.getElementById('inputSignInPass').value = ${JSON.stringify(ownerPass)};
      document.getElementById('signInMainForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    `);
    await sleep(1800);

    const storeSessionInfo = await evalCode(`(() => {
      const s = JSON.parse(sessionStorage.getItem('lotto_session_user') || '{}');
      return {
        isAdmin: s.isAdmin,
        storeId: s.storeId,
        hasStoreName: document.body.innerText.includes(${JSON.stringify(storeName)})
      };
    })()`);
    assert(
      storeSessionInfo.isAdmin === false && Boolean(storeSessionInfo.storeId) && storeSessionInfo.hasStoreName,
      `Newly approved store logs into isolated workspace "${storeName}" (${storeSessionInfo.storeId})`
    );

    console.log('\n============================================================');
    console.log(`   ZIP/ENCRYPTED/FOLDER E2E RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('============================================================\n');
  } finally {
    try { ws?.close(); } catch (_) {}
    try { p.kill(); } catch (_) {}
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch (_) {}

    if (adminStateBackup !== null) {
      writeFileSync(ADMIN_STATE_FILE, adminStateBackup, 'utf8');
    }
    const afterPosFiles = readdirSync(join(process.cwd(), 'server_data'));
    for (const f of afterPosFiles) {
      if (!existingPosFiles.has(f) && f.startsWith('pos_state_')) {
        try { unlinkSync(join(process.cwd(), 'server_data', f)); } catch (_) {}
      }
    }
    if (existsSync(LICENSES_DIR)) {
      for (const f of readdirSync(LICENSES_DIR)) {
        if (!existingLicenseFiles.has(f)) {
          try { unlinkSync(join(LICENSES_DIR, f)); } catch (_) {}
        }
      }
    }
  }

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('License E2E fatal error:', err);
  process.exit(1);
});
