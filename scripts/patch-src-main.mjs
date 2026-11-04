import fs from 'fs';
import path from 'path';

function patchMainJs() {
  const filePath = path.resolve('src/main.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Ensure line endings are preserved
  const isCRLF = content.includes('\r\n');
  const eol = isCRLF ? '\r\n' : '\n';

  // 1. Conflict resolution functions to insert before confirmSetBoxForTicket
  const conflictFunctions = `
// -------------------------------------------------------------
// Box Occupied Conflict Resolution (Empty Box vs Return Pack)
// -------------------------------------------------------------
let pendingConflictResolution = null;

export function promptBoxConflictModal(boxNum, barcode, existingSlot, newTicketData) {
  pendingConflictResolution = {
    boxNum,
    barcode,
    existingSlot,
    newTicketData
  };

  const modal = document.getElementById('boxOccupiedConflictModal');
  if (!modal) {
    const choice = window.confirm(
      \`Box #\${boxNum} is already occupied by "\${cleanGameTitle(existingSlot.gameName)}" (Pack #\${existingSlot.packNumber}).\\n\\nClick OK to Replace & Empty Box, or Cancel to Return Pack to Safe Inventory.\`
    );
    resolveBoxConflict(choice ? 'empty' : 'return');
    return;
  }

  const conflictBoxNum = document.getElementById('conflictBoxNum');
  const conflictCurrentBoxText = document.getElementById('conflictCurrentBoxText');
  const conflictTargetBoxText = document.getElementById('conflictTargetBoxText');
  const conflictCurrentGameTitle = document.getElementById('conflictCurrentGameTitle');
  const conflictCurrentGameDetails = document.getElementById('conflictCurrentGameDetails');
  const conflictNewGameTitle = document.getElementById('conflictNewGameTitle');
  const conflictNewGameDetails = document.getElementById('conflictNewGameDetails');

  if (conflictBoxNum) conflictBoxNum.textContent = boxNum;
  if (conflictCurrentBoxText) conflictCurrentBoxText.textContent = boxNum;
  if (conflictTargetBoxText) conflictTargetBoxText.textContent = boxNum;
  document.querySelectorAll('.conflictBoxInline').forEach(el => {
    el.textContent = boxNum;
  });

  const curClean = cleanGameTitle(existingSlot.gameName);
  const curPos = (existingSlot.currentTicket !== undefined && existingSlot.currentTicket !== null) ? existingSlot.currentTicket : 0;
  if (conflictCurrentGameTitle) {
    conflictCurrentGameTitle.textContent = \`\${curClean} · Pack #\${existingSlot.packNumber || '---'}\`;
  }
  if (conflictCurrentGameDetails) {
    conflictCurrentGameDetails.textContent = \`Current Ticket #\${String(curPos).padStart(3, '0')} · $\${existingSlot.price || 1} / ticket\`;
  }

  const newClean = cleanGameTitle(newTicketData.chosenName);
  if (conflictNewGameTitle) {
    conflictNewGameTitle.textContent = \`\${newClean} · Barcode \${barcode ? String(barcode).slice(-6) : ''}\`;
  }
  if (conflictNewGameDetails) {
    conflictNewGameDetails.textContent = \`Price: $\${newTicketData.chosenPrice} · Pack Size: \${newTicketData.chosenPackSize} tickets\`;
  }

  sfx.alert();
  if (!modal.open) {
    modal.showModal();
  }
}

export function resolveBoxConflict(action) {
  if (!pendingConflictResolution) return;
  const { boxNum, barcode, existingSlot, newTicketData } = pendingConflictResolution;
  const modal = document.getElementById('boxOccupiedConflictModal');
  if (modal && modal.open) {
    modal.close();
  }

  const slot = (state.slots || []).find(s => Number(s.boxNumber) === Number(boxNum)) || existingSlot;

  if (action === 'empty') {
    // 1. "replace the box with empty": mark existing pack finished / empty, record sold tickets
    const std = getStandardPackDetails(slot.price || 2);
    const packSize = slot.packSize || std.packSize || 100;
    const curr = (slot.currentTicket !== undefined && slot.currentTicket !== null) ? slot.currentTicket : 0;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    const sold = Math.max(0, curr - start);

    if (sold > 0 || slot.status === 'SOLD_OUT') {
      const closePos = slot.status === 'SOLD_OUT' ? packSize : curr;
      recordSoldOutPack(slot, closePos);
    }

    // Clear slot
    slot.status = 'EMPTY';
    slot.packNumber = null;
    slot.gameName = 'Empty Slot';
    slot.gameId = null;
    slot.price = null;
    slot.currentTicket = 0;
    slot.startTicket = 0;
    slot.scannedBarcodes = [];
    slot.soldBarcodes = [];
    slot.ticketsInBox = 0;
    slot.activatedThisShift = false;
  } else if (action === 'return') {
    // 2. "return the pack": return remaining unsold tickets to safe inventory
    const std = getStandardPackDetails(slot.price || 2);
    const packSize = slot.packSize || std.packSize || 100;
    const start = (slot.startTicket !== undefined && slot.startTicket !== null) ? slot.startTicket : 0;
    let curr = (slot.currentTicket !== undefined && slot.currentTicket !== null) ? slot.currentTicket : 0;
    if (curr > packSize) curr = packSize;
    if (curr < 0) curr = 0;

    const sold = Math.max(0, curr - start);
    const remaining = Math.max(0, packSize - sold);
    const price = slot.price || 0;
    const soldAmt = sold * price;
    const returnedAmt = remaining * price;

    if (sold > 0) {
      if (!state.soldOutThisShift) state.soldOutThisShift = [];
      state.soldOutThisShift.push({
        boxNumber: slot.boxNumber,
        gameName: slot.gameName,
        price: price,
        packNumber: slot.packNumber,
        packSize: packSize,
        startTicket: start,
        closeTicket: curr,
        ticketsSold: sold,
        salesAmount: soldAmt,
        ticketsReturned: remaining,
        returnedAmount: returnedAmt,
        isReturned: true,
        soldAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      });
    }

    if (!Array.isArray(state.inStockInventory)) state.inStockInventory = [];
    const existingStock = state.inStockInventory.find(p => isPackNumberMatch(p.packNumber, slot.packNumber));
    if (existingStock) {
      existingStock.boxNumber = null;
      existingStock.currentTicket = curr;
      existingStock.status = 'IN_STOCK';
    } else {
      state.inStockInventory.unshift({
        packNumber: String(slot.packNumber),
        gameName: slot.gameName,
        gameId: slot.gameId,
        price: price,
        packSize: packSize,
        currentTicket: curr,
        boxNumber: null,
        status: 'IN_STOCK',
        receivedDate: 'Today'
      });
    }

    state.returnedCount = (state.returnedCount || 0) + 1;

    // Clear slot
    slot.status = 'EMPTY';
    slot.packNumber = null;
    slot.gameName = 'Empty Slot';
    slot.gameId = null;
    slot.price = null;
    slot.currentTicket = 0;
    slot.startTicket = 0;
    slot.scannedBarcodes = [];
    slot.soldBarcodes = [];
    slot.ticketsInBox = 0;
    slot.activatedThisShift = false;
  }

  // 3. Immediately activate the new ticket on this box!
  const success = handleSetBoxForTicket(
    boxNum,
    barcode,
    newTicketData.detectedGame,
    newTicketData.restorePack || null,
    newTicketData.chosenName,
    newTicketData.chosenPrice,
    newTicketData.chosenPackSize,
    newTicketData.securityCode
  );

  if (success) {
    if (setBoxModal && setBoxModal.open) {
      setBoxModal.close();
    }
    pendingSetBoxBarcode = null;
    pendingSetBoxGame = null;
    pendingSetBoxSecurityCode = null;
    pendingSetBoxDisplayBarcode = null;
    pendingRestorePack = null;
    pendingNewTicketBarcode = null;
    if (setBoxModal) {
      delete setBoxModal.dataset.barcode;
      delete setBoxModal.dataset.securityCode;
      delete setBoxModal.dataset.gameName;
      delete setBoxModal.dataset.gamePrice;
      delete setBoxModal.dataset.packSize;
    }
    if (setTicketDetailsModal) {
      delete setTicketDetailsModal.dataset.barcode;
    }
    const actionDesc = action === 'return' ? 'returned to safe inventory' : 'marked empty';
    showToast(\`✓ Previous book \${actionDesc}. Box #\${boxNum} activated with \${cleanGameTitle(newTicketData.chosenName)}!\`, 'success');
  }

  pendingConflictResolution = null;
}

function setupBoxConflictModalListeners() {
  const btnEmpty = document.getElementById('btnConflictEmptyBox');
  const btnReturn = document.getElementById('btnConflictReturnPack');
  const btnCancel = document.getElementById('btnConflictCancel');
  const btnClose = document.getElementById('closeBoxConflictBtn');
  const modal = document.getElementById('boxOccupiedConflictModal');

  btnEmpty?.addEventListener('click', (e) => {
    e.preventDefault();
    resolveBoxConflict('empty');
  });

  btnReturn?.addEventListener('click', (e) => {
    e.preventDefault();
    resolveBoxConflict('return');
  });

  const handleCancel = () => {
    if (modal && modal.open) modal.close();
    pendingConflictResolution = null;
    const boxInput = document.getElementById('setBoxNumberInput');
    boxInput?.focus();
    boxInput?.select();
  };

  btnCancel?.addEventListener('click', (e) => {
    e.preventDefault();
    handleCancel();
  });

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    handleCancel();
  });
}

window.promptBoxConflictModal = promptBoxConflictModal;
window.resolveBoxConflict = resolveBoxConflict;
`;

  // Insert conflict functions before confirmSetBoxForTicket if not already present
  if (!content.includes('function promptBoxConflictModal')) {
    const targetAnchor = 'let isConfirmingSetBox = false;';
    if (!content.includes(targetAnchor)) {
      throw new Error('targetAnchor "let isConfirmingSetBox = false;" not found in src/main.js');
    }
    content = content.replace(targetAnchor, conflictFunctions.trim() + eol + eol + targetAnchor);
    console.log('✓ Added conflict functions to src/main.js');
  }

  // 2. Modify confirmSetBoxForTicket to check for occupied box before calling handleSetBoxForTicket
  const oldConfirmCode = `    const securityCode = pendingSetBoxSecurityCode || setBoxModal?.dataset.securityCode || null;

    const success = handleSetBoxForTicket(boxNum, barcode, pendingSetBoxGame, restorePack, chosenName, chosenPrice, chosenPackSize, securityCode);`;

  const newConfirmCode = `    const securityCode = pendingSetBoxSecurityCode || setBoxModal?.dataset.securityCode || null;

    // Check if target box is already occupied by a different active game/pack
    const targetSlot = (state.slots || []).find(s => Number(s.boxNumber) === Number(boxNum));
    const parsedCandidate = parseLotteryBarcode(barcode, state.customGames);
    const candidatePack = parsedCandidate?.packCombined || parsedCandidate?.packNumber || (barcode ? String(barcode).replace(/[^0-9]/g, '').slice(-6) : null);
    const isSamePack = targetSlot && isPackNumberMatch(targetSlot.packNumber, candidatePack) &&
      (!parsedCandidate?.gameNumber || slotMatchesGameNumber(targetSlot, parsedCandidate.gameNumber));
    const isOccupiedByDifferent = Boolean(targetSlot && targetSlot.status === 'ACTIVE' && targetSlot.packNumber && !isSamePack);

    if (isOccupiedByDifferent) {
      promptBoxConflictModal(boxNum, barcode, targetSlot, {
        chosenName,
        chosenPrice,
        chosenPackSize,
        securityCode,
        detectedGame: pendingSetBoxGame,
        restorePack
      });
      return;
    }

    const success = handleSetBoxForTicket(boxNum, barcode, pendingSetBoxGame, restorePack, chosenName, chosenPrice, chosenPackSize, securityCode);`;

  // Account for CRLF/LF when replacing
  const normalizedOld = oldConfirmCode.replace(/\r?\n/g, eol);
  const normalizedNew = newConfirmCode.replace(/\r?\n/g, eol);

  if (content.includes(normalizedOld)) {
    content = content.replace(normalizedOld, normalizedNew);
    console.log('✓ Modified confirmSetBoxForTicket with occupied box check in src/main.js');
  } else if (content.includes('isOccupiedByDifferent')) {
    console.log('confirmSetBoxForTicket already has isOccupiedByDifferent check');
  } else {
    throw new Error('Could not find oldConfirmCode block in src/main.js');
  }

  // 3. Ensure cleanupSetBoxModalState does not reset state while conflict modal is open
  const oldCleanup = `  function cleanupSetBoxModalState() {
    if (isTransitioningSetBoxStep) return;
    if (setBoxModal && setBoxModal.open) return;
    if (setTicketDetailsModal && setTicketDetailsModal.open) return;`;

  const newCleanup = `  function cleanupSetBoxModalState() {
    if (isTransitioningSetBoxStep) return;
    if (setBoxModal && setBoxModal.open) return;
    if (setTicketDetailsModal && setTicketDetailsModal.open) return;
    const conflictModal = document.getElementById('boxOccupiedConflictModal');
    if (conflictModal && conflictModal.open) return;`;

  const normOldCleanup = oldCleanup.replace(/\r?\n/g, eol);
  const normNewCleanup = newCleanup.replace(/\r?\n/g, eol);

  if (content.includes(normOldCleanup)) {
    content = content.replace(normOldCleanup, normNewCleanup);
    console.log('✓ Updated cleanupSetBoxModalState with conflictModal check in src/main.js');
  }

  // 4. Call setupBoxConflictModalListeners inside setupSetBoxModalLogic
  const oldSetupLogicEnd = `  // Back button in Step 2: return to Step 1 without resetting details`;
  const newSetupLogicWithConflict = `  setupBoxConflictModalListeners();

  // Back button in Step 2: return to Step 1 without resetting details`;

  const normOldLogicEnd = oldSetupLogicEnd.replace(/\r?\n/g, eol);
  const normNewLogicWithConflict = newSetupLogicWithConflict.replace(/\r?\n/g, eol);

  if (content.includes(normOldLogicEnd) && !content.includes('setupBoxConflictModalListeners();')) {
    content = content.replace(normOldLogicEnd, normNewLogicWithConflict);
    console.log('✓ Added setupBoxConflictModalListeners call to setupSetBoxModalLogic in src/main.js');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

patchMainJs();

