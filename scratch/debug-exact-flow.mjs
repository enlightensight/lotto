import { 
  parseLotteryBarcode, 
  findGameByBarcode, 
  formatLotteryBarcode,
  formatTicketDisplayBarcode,
  getCleanEmptyState,
  getStandardPackDetails,
  SAMPLE_GAMES
} from '../src/data.js';

console.log('--- TEST 1: Parsing 14180996564081 ---');
const p1 = parseLotteryBarcode('14180996564081');
console.log('p1:', JSON.stringify(p1, null, 2));

console.log('\n--- TEST 2: Parsing pack manifest 1648-018378 ---');
const p2 = parseLotteryBarcode('1648-018378');
console.log('p2:', JSON.stringify(p2, null, 2));

console.log('\n--- TEST 3: Parsing pack manifest 16480183788 (11 digits) ---');
const p3 = parseLotteryBarcode('16480183788');
console.log('p3:', JSON.stringify(p3, null, 2));

console.log('\n--- TEST 4: Parsing pack manifest 14180996564 (11 digits) ---');
const p4 = parseLotteryBarcode('14180996564');
console.log('p4:', JSON.stringify(p4, null, 2));
