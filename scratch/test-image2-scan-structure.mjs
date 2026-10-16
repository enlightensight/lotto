import { strict as assert } from 'assert';
import { parseLotteryBarcode, formatLotteryBarcode, computeLotterySeriesCode } from '../src/data.js';

console.log('--- Testing Accurate Series Number Directly From Barcode ---');

// 1. Scanned 14-digit barcode directly from the barcode in Image 2
const rawScanned = '14180996564081';
const parsed = parseLotteryBarcode(rawScanned);

console.log('Parsed Image 2 barcode:', parsed);

assert.strictEqual(parsed.isValid, true, 'Barcode should be valid');
assert.strictEqual(parsed.gameNumber, '1418', 'Game number should be 1418');
assert.strictEqual(parsed.packNumber, '099656', 'Pack number should be 099656');
assert.strictEqual(parsed.checkCode, '4', 'Check code should be 4');
assert.strictEqual(parsed.packCombined, '0996564', 'Combined pack should be 0996564 (7 digits matching Image 2)');
assert.strictEqual(parsed.ticketString, '081', 'Ticket string should be 081 (matching Image 2)');

// CRITICAL: The series code must be automatically computed as '068' from the ticket barcode without manual intervention!
assert.strictEqual(parsed.securityCode, '068', 'Series PIN must accurately equal 068 directly from barcode calculation');

// 2. Formatted display barcode structure should exactly match Image 2: 1418-0996564-081 (068)
const formatted = formatLotteryBarcode(rawScanned);
console.log('Formatted directly from raw 14-digit scan:', formatted);
assert.strictEqual(formatted, '1418-0996564-081 (068)', 'Formatted barcode must automatically match 1418-0996564-081 (068)');

// 3. Test other tickets to ensure accuracy across all games:
// Ticket 82 of 10X Money (pack size 150): 149 - 82 = 67 -> (067)
assert.strictEqual(computeLotterySeriesCode('1418', 82), '067');
assert.strictEqual(formatLotteryBarcode('14180996564082'), '1418-0996564-082 (067)');

// Ticket 29 of Epic Riches (pack size 30): 29 - 29 = 0 -> (000)
assert.strictEqual(computeLotterySeriesCode('1648', 29), '000');
assert.strictEqual(formatLotteryBarcode('16480183788029'), '1648-0183788-029 (000)');

// Ticket 0 of Treasure Hunt (pack size 100): 99 - 0 = 99 -> (099)
assert.strictEqual(computeLotterySeriesCode('1672', 0), '099');
assert.strictEqual(formatLotteryBarcode('16720072520000'), '1672-0072520-000 (099)');

// Ticket 9 of 5X Money (pack size 300): 299 - 9 = 290 -> (290)
assert.strictEqual(computeLotterySeriesCode('1417', 9), '290');
assert.strictEqual(formatLotteryBarcode('14170670170009'), '1417-0670170-009 (290)');

console.log('✅ ALL ACCURATE SERIES NUMBER AUTOMATIC BARCODE TESTS PASSED!');
