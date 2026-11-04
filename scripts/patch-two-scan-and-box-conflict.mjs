import fs from 'fs';
import path from 'path';

console.log('--- Applying Two-Scan Inventory Setup & Conflict UI Patch ---');

// 1. Update src/main.js
const mainJsPath = path.resolve('src/main.js');
let mainJs = fs.readFileSync(mainJsPath, 'utf8');

// Target 1: Two-scan logic in processScannedBarcode
const scanTarget = `    // 4b. At the Sell Counter: A pack barcode or new ticket was scanned (not in an active box yet).
    // If ticket is in stock, automatically add pack to dispenser rack and offer "Activate" button!
    const inStock = findInStockPack(parsedTicket, rawBarcode);
    if (inStock) {
      autoAddInStockPackToDispenser(inStock.item, parsedTicket, rawBarcode);
      return;
    }

    // Otherwise seamlessly open the Set Ticket / Set Box modal so the pack can be activated into a dispenser box!
    const effectiveBarcode = (parsedTicket && parsedTicket.standardBarcode) ? parsedTicket.standardBarcode : rawBarcode;
    pendingNewTicketBarcode = effectiveBarcode;
    openSetTicketDetailsModal(rawBarcode, effectiveBarcode);
    if (parsedTicket.isPackBarcode || parsedTicket.ticketNumber === null) {
      showToast(\`🏷️ Pack barcode scanned [\${effectiveBarcode}]: Set details and put in box.\`, 'info');
    } else {
      showToast(\`🏷️ New ticket scanned [\${effectiveBarcode}]: Set name and price.\`, 'info');
    }
    return;`;

const scanReplacement = `    // 4b. At the Sell Counter: A pack barcode or new ticket was scanned (not in an active box yet).
    // If ticket is already in stock as an active/configured pack, add to dispenser rack with "Activate" button!
    const inStock = findInStockPack(parsedTicket, rawBarcode);
    if (inStock && inStock.item?.status !== 'PENDING_SETUP') {
      autoAddInStockPackToDispenser(inStock.item, parsedTicket, rawBarcode);
      return;
    }

    const effectiveBarcode = (parsedTicket && parsedTicket.standardBarcode) ? parsedTicket.standardBarcode : rawBarcode;

    // Check if this barcode is already registered as PENDING_SETUP (Scan #2)
    if (!Array.isArray(state.pendingTickets)) state.pendingTickets = [];
    const existingPending = state.pendingTickets.find(pt => pt && pt.status === 'PENDING_SETUP' && (
      pt.barcode === effectiveBarcode || pt.barcode === rawBarcode ||
      (parsedTicket?.packNumber && pt.packNumber === parsedTicket.packNumber)
    )) || (inStock && inStock.item?.status === 'PENDING_SETUP' ? inStock.item : null);

    if (existingPending) {
      // -----------------------------------------------------------------------
      // SCAN 2: Previously registered PENDING_SETUP barcode scanned again!
      // Automatically open the Two-Step Setup (Step 1: Details -> Step 2: Box)
      // -----------------------------------------------------------------------
      pendingNewTicketBarcode = effectiveBarcode;
      openSetTicketDetailsModal(rawBarcode, effectiveBarcode);
      showToast(\`⚙️ Unconfigured ticket [\${effectiveBarcode}] scanned again: Complete setup to activate in box.\`, 'info');
      return;
    }

    // -------------------------------------------------------------------------
    // SCAN 1: Brand-new unrecognized ticket barcode scanned anywhere in Store POS!
    // 1. Automatically register as persistent In-Stock Inventory (PENDING_SETUP).
    // 2. Associate with store, record timestamp, cashier & session.
    // 3. Do NOT open the modal or make a sale on first scan.
    // -------------------------------------------------------------------------
    const matchedGame = findGameByBarcode(rawBarcode, state.customGames);
    const packNum = parsedTicket?.packNumber || rawBarcode.replace(/[^0-9]/g, '').slice(-6) || '000000';
    const gameNum = parsedTicket?.gameNumber || matchedGame?.gameCode || '';
    const defaultPrice = matchedGame ? matchedGame.price : 2;
    const defaultName = matchedGame ? cleanGameTitle(matchedGame.name) : \`New Ticket \${gameNum ? '#' + gameNum : ''}\`.trim();

    const newPendingRecord = {
      id: 'pt_' + Date.now(),
      barcode: effectiveBarcode,
      originalBarcode: rawBarcode,
      packNumber: packNum,
      gameNumber: gameNum,
      gameName: defaultName,
      ticketPrice: defaultPrice,
      status: 'PENDING_SETUP',
      discoveredAt: new Date().toISOString(),
      cashier: state.cashierName || 'Cashier',
      sessionInfo: \`Shift \${state.shiftNumber || 1}\`
    };

    state.pendingTickets.unshift(newPendingRecord);

    // Also register in inStockInventory so it immediately appears in In-Stock inventory view & counts
    if (!Array.isArray(state.inStockInventory)) state.inStockInventory = [];
    state.inStockInventory.unshift({
      id: newPendingRecord.id,
      barcode: effectiveBarcode,
      originalBarcode: rawBarcode,
      pack: packNum,
      packNumber: packNum,
      gameNumber: gameNum,
      game: defaultName,
      gameName: defaultName,
      price: defaultPrice,
      status: 'PENDING_SETUP',
      statusLabel: 'Pending Setup',
      receivedDate: 'Today',
      boxNumber: null,
      position: '—'
    });

    saveState(state);

    // Persist to backend store_pending_tickets database table / JSON state
    fetch('/api/inventory/pending-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-store-id': getCurrentStoreId()
      },
      body: JSON.stringify({
        storeId: getCurrentStoreId(),
        barcode: effectiveBarcode,
        packNumber: packNum,
        gameNumber: gameNum,
        cashier: state.cashierName || 'Cashier',
        sessionInfo: \`Shift \${state.shiftNumber || 1}\`
      })
    }).catch(() => {});

    sfx.chime?.() || sfx.beep?.();
    state.lastScanData = {
      barcode: effectiveBarcode,
      action: 'PENDING_REGISTRATION',
      gameName: defaultName,
      packNumber: packNum,
      ticketNumber: parsedTicket?.ticketNumber || 0
    };
    state.lastScannedBarcode = \`Registered to Stock: [\${effectiveBarcode}] · Status: PENDING_SETUP\`;
    if (scanActionTitle) {
      scanActionTitle.textContent = 'NEW TICKET REGISTERED TO STOCK';
    }
    if (lastScanDisplay) {
      lastScanDisplay.textContent = \`Barcode [\${effectiveBarcode}] stored in inventory. Scan again to activate into a box.\`;
    }
    showToast(\`📦 New ticket [\${effectiveBarcode}] stored in In-Stock inventory (Pending Setup). Scan again to activate!\`, 'success');
    renderHeaderAndMetrics();
    renderDispenserRack();
    renderSlotsRibbon();
    return;`;

// Normalize line breaks for matching
const norm = str => str.replace(/\r\n/g, '\n');

if (norm(mainJs).includes(norm(scanTarget))) {
  mainJs = norm(mainJs).replace(norm(scanTarget), norm(scanReplacement));
  console.log('✓ Successfully patched two-scan barcode detection in src/main.js');
} else {
  console.error('FAILED to match scanTarget in src/main.js');
}

// Target 2: Remove from pendingTickets upon successful configuration
const cleanupTarget = `    // Remove pack from warehouse inventory and in-stock inventory since it's now in a dispenser box!
    state.inventory = (state.inventory || []).filter(p => !isPackNumberMatch(p.packNumber, realPackNumber));
    if (Array.isArray(state.inStockInventory)) {
      state.inStockInventory = state.inStockInventory.filter(p => !isPackNumberMatch(p.packNumber, realPackNumber));
    }`;

const cleanupReplacement = `    // Remove pack from warehouse inventory and in-stock inventory since it's now in a dispenser box!
    state.inventory = (state.inventory || []).filter(p => !isPackNumberMatch(p.packNumber, realPackNumber));
    if (Array.isArray(state.inStockInventory)) {
      state.inStockInventory = state.inStockInventory.filter(p => !isPackNumberMatch(p.packNumber, realPackNumber));
    }
    if (Array.isArray(state.pendingTickets)) {
      state.pendingTickets = state.pendingTickets.filter(pt =>
        pt.barcode !== barcode &&
        pt.barcode !== standardKey &&
        !isPackNumberMatch(pt.packNumber, realPackNumber)
      );
    }
    fetch('/api/inventory/configure-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-store-id': getCurrentStoreId()
      },
      body: JSON.stringify({
        storeId: getCurrentStoreId(),
        barcode: standardKey || barcode,
        ticketName: finalName,
        ticketPrice: finalPrice,
        boxNumber: boxNum,
        cashier: state.cashierName || 'Cashier'
      })
    }).catch(() => {});`;

if (norm(mainJs).includes(norm(cleanupTarget))) {
  mainJs = norm(mainJs).replace(norm(cleanupTarget), norm(cleanupReplacement));
  console.log('✓ Successfully patched pendingTickets cleanup in handleSetBoxForTicket');
} else {
  console.error('FAILED to match cleanupTarget in src/main.js');
}

fs.writeFileSync(mainJsPath, mainJs, 'utf8');
console.log('✓ Saved src/main.js');

