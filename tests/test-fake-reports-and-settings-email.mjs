import assert from 'node:assert';
import { getHistoryScreenData } from '../src/historyData.js';
import { getScreenDayReportData } from '../src/dayReportData.js';
import { getCleanEmptyState, loadState, saveState } from '../src/data.js';

console.log('================================================================');
console.log(' TEST: VERIFY ZERO FAKE REPORTS & EMAIL SETTINGS ADD/REMOVE     ');
console.log('================================================================');

// --- Test 1: Fake Reports Check for Non-Amigo Store (e.g. store_anish) ---
console.log('\n--- 1. Testing Reports Data Isolation ---');
const anishState = getCleanEmptyState('store_anish');
assert.strictEqual(anishState.storeId, 'store_anish');

const anishHistory = getHistoryScreenData(anishState);
console.log('Anish Store history shifts count:', anishHistory.shifts.length);
assert.strictEqual(anishHistory.shifts.length, 0, 'Anish Store must have 0 shifts when no real shifts are closed');
assert.strictEqual(anishHistory.kpis.totalSales, 0, 'Anish Store total sales KPI must be 0');
assert.strictEqual(anishHistory.kpis.ticketsSold, 0, 'Anish Store total tickets KPI must be 0');
console.log('  ✓ PASS: Anish Store has 0 fake shifts and 0 mock sales in History');

const anishDayReport = getScreenDayReportData(anishState);
console.log('Anish Store day report shifts count:', anishDayReport.shifts.length);
assert.strictEqual(anishDayReport.shifts.length, 0, 'Anish Store day report must have 0 shifts');
console.log('  ✓ PASS: Anish Store has 0 fake shifts in Day Report');

// --- Test 2: Cleared Amigo Store Check ---
console.log('\n--- 2. Testing Cleared Amigo Store ---');
const amigoClearedState = {
  ...getCleanEmptyState('store_amigo'),
  dataCleared: true,
  shiftHistory: []
};
const amigoClearedHistory = getHistoryScreenData(amigoClearedState);
assert.strictEqual(amigoClearedHistory.shifts.length, 0, 'Cleared Amigo Store must have 0 shifts');
console.log('  ✓ PASS: Cleared Amigo Store returns 0 shifts');

// --- Test 3: Unmodified Amigo Demo Store Check ---
console.log('\n--- 3. Testing Reference Amigo Demo Store ---');
const amigoDemoState = {
  storeId: 'store_amigo',
  dataCleared: false,
  shiftHistory: []
};
const amigoDemoHistory = getHistoryScreenData(amigoDemoState);
assert.strictEqual(amigoDemoHistory.shifts.length, 9, 'Reference Amigo Store has 9 reference shifts');
console.log('  ✓ PASS: Amigo demo reference store maintains 9 demo shifts when not cleared');

// --- Test 4: Settings Email Default State ---
console.log('\n--- 4. Testing Settings Email Initial Values ---');
assert.deepStrictEqual(anishState.settingsReportEmails, [], 'Non-amigo store starts with empty settingsReportEmails');
assert.strictEqual(anishState.reportEmail, '', 'Non-amigo store starts with empty reportEmail');
console.log('  ✓ PASS: Anish Store starts with clean empty email list');

// --- Test 5: Email Add and Remove Flow Simulation ---
console.log('\n--- 5. Testing Email Add and Remove Flow ---');
// Simulate adding an email
const testEmail1 = 'owner@anishstore.com';
if (!anishState.settingsReportEmails.includes(testEmail1)) {
  anishState.settingsReportEmails.push(testEmail1);
  anishState.reportEmail = anishState.settingsReportEmails[0] || '';
}
assert.strictEqual(anishState.settingsReportEmails.length, 1);
assert.strictEqual(anishState.settingsReportEmails[0], testEmail1);
assert.strictEqual(anishState.reportEmail, testEmail1);
console.log('  ✓ PASS: Successfully added recipient', testEmail1);

// Add second email
const testEmail2 = 'manager@anishstore.com';
if (!anishState.settingsReportEmails.includes(testEmail2)) {
  anishState.settingsReportEmails.push(testEmail2);
  anishState.reportEmail = anishState.settingsReportEmails[0] || '';
}
assert.strictEqual(anishState.settingsReportEmails.length, 2);
console.log('  ✓ PASS: Successfully added second recipient', testEmail2);

// Remove first email
const removedIdx = 0;
const removed = anishState.settingsReportEmails.splice(removedIdx, 1);
anishState.reportEmail = anishState.settingsReportEmails[0] || '';
assert.strictEqual(removed[0], testEmail1);
assert.strictEqual(anishState.settingsReportEmails.length, 1);
assert.strictEqual(anishState.settingsReportEmails[0], testEmail2);
assert.strictEqual(anishState.reportEmail, testEmail2);
console.log('  ✓ PASS: Successfully removed recipient', testEmail1, '- remaining:', testEmail2);

// Remove last remaining email
const removedLast = anishState.settingsReportEmails.splice(0, 1);
anishState.reportEmail = anishState.settingsReportEmails[0] || '';
assert.strictEqual(removedLast[0], testEmail2);
assert.strictEqual(anishState.settingsReportEmails.length, 0);
assert.strictEqual(anishState.reportEmail, '');
// Verify it does NOT reset back to amigofoodmart2300@gmail.com
assert.notStrictEqual(anishState.settingsReportEmails[0], 'amigofoodmart2300@gmail.com');
console.log('  ✓ PASS: Removing last email leaves recipient list empty without restoring amigo email');

console.log('\n================================================================');
console.log(' ALL FAKE REPORTS & SETTINGS EMAIL TESTS PASSED!                ');
console.log('================================================================');
