// Georgia books are identified by 7 digits. Real barcodes from Amigo Food Mart, game 1908 (Bulldog):
// books 0018902 and 0018903 were active in boxes 31 and 28 at the same time and must never be merged.
import { strict as assert } from 'assert';
import { parseLotteryBarcode, isPackNumberMatch, getFullPackNumber, formatTicketDisplayBarcode } from '../src/data.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('  ok -', name); };

const book2 = '19080018902040'; // book 0018902, ticket 040
const book3 = '19080018903048'; // book 0018903, ticket 048

check('parser keeps the 7th digit in the book number', () => {
  assert.equal(parseLotteryBarcode(book2).packNumber, '0018902');
  assert.equal(parseLotteryBarcode(book3).packNumber, '0018903');
  assert.equal(parseLotteryBarcode(book3).basePackNumber, '001890');
  assert.equal(parseLotteryBarcode(book3).ticketNumber, 48);
});

check('Georgia books whose 7th digit happens to equal the SC check-digit formula keep 7 digits', () => {
  // Real scans, game 1835: books 0477937 and 0477938 (the 8 matches the SC formula by chance)
  assert.equal(parseLotteryBarcode('18350477938017').packNumber, '0477938');
  assert.equal(parseLotteryBarcode('18350477937016').packNumber, '0477937');
  assert.equal(isPackNumberMatch('0477937', '18350477938017'), false);
  assert.equal(parseLotteryBarcode('19150005913019').packNumber, '0005913');
});

check('neighbouring books never match each other', () => {
  assert.equal(isPackNumberMatch('0018902', book3), false);
  assert.equal(isPackNumberMatch('0018903', book2), false);
  assert.equal(isPackNumberMatch('001890-2', '001890-3'), false);
  assert.equal(isPackNumberMatch(parseLotteryBarcode(book2).packNumber, parseLotteryBarcode(book3).packNumber), false);
});

check('every format of the same book matches', () => {
  for (const other of [book3, '1908-001890-3-048', '001890-3', '0018903', '19080018903']) {
    assert.equal(isPackNumberMatch('0018903', other), true, other);
  }
  assert.equal(isPackNumberMatch(parseLotteryBarcode(book3).packNumber, '19080018903045'), true);
});

check('selling picks only the box holding that book (packNumber OR packCombined OR packClean, as main.js does)', () => {
  const boxes = [{ boxNumber: 28, packNumber: '0018903' }, { boxNumber: 31, packNumber: '0018902' }];
  const boxFor = code => {
    const t = parseLotteryBarcode(code);
    return boxes.filter(s => isPackNumberMatch(s.packNumber, t.packNumber) ||
      (t.packCombined && isPackNumberMatch(s.packNumber, t.packCombined)) ||
      (t.packClean && isPackNumberMatch(s.packNumber, t.packClean))).map(s => s.boxNumber);
  };
  assert.deepEqual(boxFor(book3), [28]);
  assert.deepEqual(boxFor(book2), [31]);
});

check('boxes saved with only 6 digits still match (no data loss for older boxes)', () => {
  assert.equal(isPackNumberMatch('001890', book2), true);
  assert.equal(isPackNumberMatch('001890', book3), true);
});

check('full book number reader', () => {
  assert.equal(getFullPackNumber(book2), '18902');
  assert.equal(getFullPackNumber('1908-001890-2-040'), '18902');
  assert.equal(getFullPackNumber('001890'), '');
  assert.equal(getFullPackNumber('1908001890'), '');
});

check('other Georgia games keep working the same way', () => {
  const p = parseLotteryBarcode('16480183788000');
  assert.equal(p.packNumber, '0183788');
  assert.equal(isPackNumberMatch(p.packNumber, '1648-018378-8-029'), true);
});

check('printed ticket text still shows game-pack-check-ticket', () => {
  assert.match(formatTicketDisplayBarcode(book2), /^1908-001890-2-040/);
});

check('South Carolina parsing is unchanged', () => {
  const sc = parseLotteryBarcode('1705-002921-5-069 (080)', [], 'SC');
  assert.equal(sc.jurisdiction, 'SC');
  assert.equal(sc.basePackNumber, '002921');
});

console.log(`\n7-digit book number tests: ${passed} passed`);
