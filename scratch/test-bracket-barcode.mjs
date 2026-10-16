import { strict as assert } from 'assert';
import { parseLotteryBarcode, formatLotteryBarcode } from '../src/data.js';

const testInputs = [
  {
    raw: '14180996564082(067)',
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '14180996564082067',
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '1418-099656-4-082(067)',
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '1418-099656-4-082-067',
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '1418-0996564-082(067)',
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '14180996564082', // Standard 14-digit scan (automatically computes 067 from Game 1418 & Ticket 082)
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  },
  {
    raw: '141809965640828494869032', // 2D payload > 17 digits
    expectedBarcode: '1418-0996564-082 (067)',
    expectedTicket: '082 (067)',
    expectedSec: '067'
  }
];

function computeModalDisplay(barcode) {
  const parsed = parseLotteryBarcode(barcode);
  const displayBarcode = formatLotteryBarcode(barcode);
  const sec = parsed?.securityCode || '000';
  const displayTicket = `${parsed?.ticketString || '000'} (${sec})`;

  return {
    displayBarcode,
    displayTicket,
    securityCode: sec
  };
}

console.log('Testing Bracket Barcode Display Logic...');
for (const tc of testInputs) {
  const res = computeModalDisplay(tc.raw);
  console.log(`Input: ${tc.raw} -> Barcode: ${res.displayBarcode}, Ticket: ${res.displayTicket}`);
  assert.strictEqual(res.displayBarcode, tc.expectedBarcode, `displayBarcode mismatch for ${tc.raw}`);
  assert.strictEqual(res.displayTicket, tc.expectedTicket, `displayTicket mismatch for ${tc.raw}`);
  assert.strictEqual(res.securityCode, tc.expectedSec, `securityCode mismatch for ${tc.raw}`);
}

console.log('✅ ALL BRACKET BARCODE TESTS PASSED!');
