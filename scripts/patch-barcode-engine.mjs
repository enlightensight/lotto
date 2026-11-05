import fs from 'fs';

let content = fs.readFileSync('src/data.js', 'utf8');

// 1. Add SCEL Games to SAMPLE_GAMES if not present
if (!content.includes('g1670')) {
  const target = `{ id: 'g1903', name: '$600 CASH IN HAND', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1903' }`;
  const replacement = `{ id: 'g1903', name: '$600 CASH IN HAND', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1903' },
  // South Carolina Education Lottery (SCEL) Active Game Catalog
  { id: 'g1670', name: 'HIT $100', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1670' },
  { id: 'g1678', name: '7-11-21 TRIPLER', price: 2, bookValue: 300, packSize: 150, barcodePrefix: '1678' },
  { id: 'g1690', name: '$200,000 PAYDAY', price: 5, bookValue: 300, packSize: 60, barcodePrefix: '1690' },
  { id: 'g1691', name: 'BIG MATCH BONUS', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1691' },
  { id: 'g1665', name: '200X', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1665' },
  { id: 'g1714', name: '25 TIMES LUCKY', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1714' },
  { id: 'g1683', name: 'MAGNIFICENT JUMBO BUCKS', price: 20, bookValue: 300, packSize: 15, barcodePrefix: '1683' },
  { id: 'g1669', name: 'WINNING SPREE', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1669' },
  { id: 'g1650', name: 'RUBY RED TREASURES', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1650' },
  { id: 'g1680', name: 'TENFOLD LUCKY', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1680' },
  { id: 'g1645', name: 'FROSTY FORTUNES', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1645' },
  { id: 'g1660', name: '$100 $200 OR $300', price: 10, bookValue: 300, packSize: 30, barcodePrefix: '1660' }`;
  content = content.replace(target, replacement);
  console.log('✓ Injected SCEL games into SAMPLE_GAMES');
}

// 2. Fix AIM Prefix regex: strictly ']' + letter + digit (2 chars after ']')
content = content.replace(
  /s\s*=\s*s\.replace\(\/\^\\\]\[a-zA-Z0-9\]\{2,3\}\/,\s*''\)\.trim\(\);/,
  `s = s.replace(/^\\][a-zA-Z][0-9]/, '').trim();`
);
console.log('✓ Fixed AIM prefix stripping regex');

// 3. Add helper function inferPackDetailsFromCountdown
if (!content.includes('function inferPackDetailsFromCountdown')) {
  const insertMarker = `// Robust Lottery Barcode Parser (SCEL, Georgia Lottery, Scientific Games / IGT)`;
  const helperCode = `export function inferPackDetailsFromCountdown(ticketNumber, securityCode) {
  if (ticketNumber === null || ticketNumber === undefined || securityCode === null || securityCode === undefined || isNaN(ticketNumber)) {
    return null;
  }
  const pinNum = parseInt(securityCode, 10);
  if (isNaN(pinNum)) return null;
  const inferredPackSize = Number(ticketNumber) + pinNum + 1;
  const standardPackSizes = [300, 150, 100, 60, 30, 25, 20, 18, 15, 12, 10];
  if (standardPackSizes.includes(inferredPackSize)) {
    let price = 1;
    let bookValue = 300;
    if (inferredPackSize === 300) { price = 1; bookValue = 300; }
    else if (inferredPackSize === 150) { price = 2; bookValue = 300; }
    else if (inferredPackSize === 100) { price = 3; bookValue = 300; }
    else if (inferredPackSize === 60) { price = 5; bookValue = 300; }
    else if (inferredPackSize === 30) { price = 10; bookValue = 300; }
    else if (inferredPackSize === 18) { price = 50; bookValue = 900; }
    else if (inferredPackSize === 15) { price = 20; bookValue = 300; }
    else if (inferredPackSize === 12) { price = 25; bookValue = 300; }
    else if (inferredPackSize === 10) { price = 30; bookValue = 300; }
    return { packSize: inferredPackSize, price, bookValue };
  }
  return null;
}

`;
  content = content.replace(insertMarker, helperCode + insertMarker);
  console.log('✓ Added inferPackDetailsFromCountdown');
}

fs.writeFileSync('src/data.js', content, 'utf8');
console.log('✓ Staged intermediate src/data.js updates');

