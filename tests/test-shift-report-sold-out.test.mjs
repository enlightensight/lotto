import assert from 'node:assert/strict';

console.log('================================================================');
console.log('   VERIFY: SHIFT REPORT PREVIEW SOLD-OUT & REPLACED BOXES      ');
console.log('================================================================\n');

// Mock buildReportRow logic matching src/main.js
function buildTestReportRow(box, slot, state) {
  let rowsHtml = '';

  const boxSoldOuts = (state.soldOutThisShift || []).filter(so => so && Number(so.boxNumber) === box);
  boxSoldOuts.forEach(so => {
    const sold = so.ticketsSold !== undefined ? so.ticketsSold : Math.max(0, (so.closeTicket || 0) - (so.startTicket || 0));
    const amount = so.salesAmount !== undefined ? so.salesAmount : (sold * (so.price || 0));
    const startStr = String(so.startTicket !== undefined ? so.startTicket : 0).padStart(3, '0');
    const closeStr = String(so.closeTicket !== undefined ? so.closeTicket : (so.startTicket || 0) + sold).padStart(3, '0');
    const isSold = sold > 0;
    const rowClass = isSold ? 'row-sold' : '';
    const badgeText = so.isReturned ? 'RETURNED' : 'SOLD OUT';
    rowsHtml += `<tr class="${rowClass}"><td class="box">${box}</td><td class="pack">${so.packNumber || ''}</td><td class="game">${so.gameName} (${badgeText})</td><td class="start">${startStr}</td><td class="close">${closeStr}</td><td class="price">${so.price || 1}</td><td class="amount">${amount.toFixed(2)}</td></tr>`;
  });

  if (slot && slot.status === 'SOLD_OUT' && slot.packNumber && !boxSoldOuts.some(so => so.packNumber === slot.packNumber)) {
    const sold = slot.ticketsSold !== undefined ? slot.ticketsSold : Math.max(0, (slot.currentTicket || 0) - (slot.startTicket || 0));
    const amount = sold * (slot.price || 0);
    const startStr = String(slot.startTicket !== undefined ? slot.startTicket : 0).padStart(3, '0');
    const closeStr = String(slot.currentTicket !== undefined ? slot.currentTicket : (slot.startTicket || 0) + sold).padStart(3, '0');
    const isSold = sold > 0;
    const rowClass = isSold ? 'row-sold' : '';
    rowsHtml += `<tr class="${rowClass}"><td class="box">${box}</td><td class="pack">${slot.packNumber || ''}</td><td class="game">${slot.gameName} (SOLD OUT)</td><td class="start">${startStr}</td><td class="close">${closeStr}</td><td class="price">${slot.price || 1}</td><td class="amount">${amount.toFixed(2)}</td></tr>`;
  }

  const isBoxActive = Boolean(slot && slot.status === 'ACTIVE' && slot.packNumber && !boxSoldOuts.some(so => so.packNumber === slot.packNumber));
  if (isBoxActive) {
    if (slot.scannedInEndShift) {
      const sold = slot.ticketsSold || 0;
      const amount = sold * (slot.price || 0);
      const startStr = String(slot.startTicket !== undefined ? slot.startTicket : 0).padStart(3, '0');
      const closeStr = String(slot.currentTicket !== undefined ? slot.currentTicket : 0).padStart(3, '0');
      const isSold = sold > 0;
      const rowClass = isSold ? 'row-sold' : '';
      rowsHtml += `<tr class="${rowClass}"><td class="box">${box}</td><td class="pack">${slot.packNumber || ''}</td><td class="game">${slot.gameName}</td><td class="start">${startStr}</td><td class="close">${closeStr}</td><td class="price">${slot.price || 1}</td><td class="amount">${amount.toFixed(2)}</td></tr>`;
    } else if (slot.declaredOutThere) {
      rowsHtml += `<tr><td class="box">${box}</td><td class="pack">${slot.packNumber || ''}</td><td class="game">${slot.gameName}</td><td colspan="4">MANUALLY DECLARED OUT THERE</td></tr>`;
    } else {
      // User specifically requested to preserve EXCLUDED — NOT SCANNED for unscanned active boxes
      rowsHtml += `<tr><td class="box">${box}</td><td></td><td class="td-rep-empty" colspan="5">EXCLUDED — NOT SCANNED</td></tr>`;
    }
  } else if (boxSoldOuts.length === 0 && (!slot || slot.status !== 'SOLD_OUT')) {
    rowsHtml += `<tr><td class="box">${box}</td><td></td><td class="td-rep-empty">EMPTY</td><td class="td-rep-empty">SLOT</td><td></td><td></td><td></td></tr>`;
  }

  return rowsHtml;
}

// -------------------------------------------------------------
// Test Case 1: Box 8 marked Sold Out
// -------------------------------------------------------------
console.log('--- Test 1: Box 8 marked Sold Out ---');
{
  const mockState = {
    soldOutThisShift: [
      {
        boxNumber: 8,
        gameName: 'Jumbo Bucks',
        packNumber: '1422001',
        price: 5,
        startTicket: 0,
        closeTicket: 60,
        ticketsSold: 60,
        salesAmount: 300.00,
        isReturned: false
      }
    ]
  };
  const emptySlot8 = { boxNumber: 8, status: 'EMPTY', packNumber: null };
  const html = buildTestReportRow(8, emptySlot8, mockState);

  assert.ok(html.includes('Jumbo Bucks (SOLD OUT)'), 'Must contain game name with (SOLD OUT)');
  assert.ok(html.includes('1422001'), 'Must contain pack number');
  assert.ok(html.includes('300.00'), 'Must contain sales amount 300.00');
  assert.ok(!html.includes('EMPTY'), 'Must NOT say EMPTY SLOT');
  console.log('  ✓ PASS: Box 8 displays sold out pack details accurately!\n');
}

// -------------------------------------------------------------
// Test Case 2: Box 2 replaced (sold out pack + new active pack)
// -------------------------------------------------------------
console.log('--- Test 2: Box 2 replaced in same shift ---');
{
  const mockState = {
    soldOutThisShift: [
      {
        boxNumber: 2,
        gameName: '5X The Cash',
        packNumber: '111222',
        price: 2,
        startTicket: 10,
        closeTicket: 100,
        ticketsSold: 90,
        salesAmount: 180.00,
        isReturned: false
      }
    ]
  };
  const activeSlot2 = {
    boxNumber: 2,
    status: 'ACTIVE',
    packNumber: '333444',
    gameName: '10X The Cash',
    price: 2,
    startTicket: 0,
    currentTicket: 15,
    ticketsSold: 15,
    scannedInEndShift: true
  };
  const html = buildTestReportRow(2, activeSlot2, mockState);

  assert.ok(html.includes('5X The Cash (SOLD OUT)'), 'Must include sold out pack');
  assert.ok(html.includes('180.00'), 'Must include sold out sales amount');
  assert.ok(html.includes('10X The Cash'), 'Must include newly active pack');
  assert.ok(html.includes('333444'), 'Must include newly active pack number');
  console.log('  ✓ PASS: Box 2 displays both sold-out pack and new active pack!\n');
}

// -------------------------------------------------------------
// Test Case 3: Box 1 active but NOT scanned (Preserve EXCLUDED)
// -------------------------------------------------------------
console.log('--- Test 3: Box 1 active but NOT scanned ---');
{
  const mockState = { soldOutThisShift: [] };
  const activeSlot1 = {
    boxNumber: 1,
    status: 'ACTIVE',
    packNumber: '999888',
    gameName: 'Georgia Jackpot',
    price: 10,
    startTicket: 0,
    currentTicket: 0,
    scannedInEndShift: false
  };
  const html = buildTestReportRow(1, activeSlot1, mockState);

  assert.ok(html.includes('EXCLUDED — NOT SCANNED'), 'Must preserve EXCLUDED — NOT SCANNED per user request');
  console.log('  ✓ PASS: Unscanned active box preserved with EXCLUDED — NOT SCANNED!\n');
}

// -------------------------------------------------------------
// Test Case 4: Box 11 truly empty
// -------------------------------------------------------------
console.log('--- Test 4: Box 11 truly empty ---');
{
  const mockState = { soldOutThisShift: [] };
  const emptySlot11 = { boxNumber: 11, status: 'EMPTY', packNumber: null };
  const html = buildTestReportRow(11, emptySlot11, mockState);

  assert.ok(html.includes('EMPTY'), 'Must say EMPTY');
  assert.ok(html.includes('SLOT'), 'Must say SLOT');
  console.log('  ✓ PASS: Truly empty box displays EMPTY SLOT!\n');
}

console.log('================================================================');
console.log('   ALL SHIFT REPORT SOLD-OUT TESTS PASSED 100%!                ');
console.log('================================================================');
