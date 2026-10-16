import { parseLotteryBarcode } from '../src/data.js';

console.log('Testing Cross-Game Scanning & Bracket Parsing...');

// Game 1: 1648, Pack: 018378, Ticket: 029 with PIN (000)
const barcode1 = '1648-018378-8-029(000)';
const parsed1 = parseLotteryBarcode(barcode1);

console.log('Barcode 1 parsed:', {
  isValid: parsed1.isValid,
  gameNumber: parsed1.gameNumber,
  packNumber: parsed1.packNumber,
  ticketNumber: parsed1.ticketNumber,
  ticketString: parsed1.ticketString,
  securityCode: parsed1.securityCode
});

if (parsed1.securityCode !== '000') {
  throw new Error(`Expected securityCode '000', got '${parsed1.securityCode}'`);
}

// Game 2: 1672, Pack: 018378 (same pack number different game!), Ticket: 005
const barcode2 = '1672-018378-3-005(000)';
const parsed2 = parseLotteryBarcode(barcode2);

console.log('Barcode 2 parsed:', {
  isValid: parsed2.isValid,
  gameNumber: parsed2.gameNumber,
  packNumber: parsed2.packNumber,
  ticketNumber: parsed2.ticketNumber,
  ticketString: parsed2.ticketString,
  securityCode: parsed2.securityCode
});

if (parsed2.gameNumber === parsed1.gameNumber) {
  throw new Error('Game numbers should be different');
}

// Check square brackets support as well: e.g. [000]
const barcodeSquare = '1648-018378-8-029[000]';
const parsedSquare = parseLotteryBarcode(barcodeSquare);
if (parsedSquare.securityCode !== '000') {
  throw new Error(`Expected square bracket securityCode '000', got '${parsedSquare.securityCode}'`);
}

// Continuous with bracket: 16480183788029(000)
const barcodeContinuous = '16480183788029(000)';
const parsedCont = parseLotteryBarcode(barcodeContinuous);
if (parsedCont.securityCode !== '000' || parsedCont.ticketNumber !== 29) {
  throw new Error(`Expected continuous ticket 29 with PIN '000', got ${parsedCont.ticketNumber} and '${parsedCont.securityCode}'`);
}

console.log('✅ ALL CROSS-GAME SCANNING & BRACKET TESTS PASSED!');
