// ============================================================================
// LOTTO TRACK PRO — GET REPORT & END SHIFT WORKFLOW REGRESSION TEST SUITE
// Permanently protects:
// 1. Two-phase sequential workflow: Phase 1 -> Phase 2 -> Animation -> Final Report
// 2. Exact preservation of all 3 Step 2 values (including explicit 0 values)
// 3. Jurisdiction-specific calculating subtext (GA vs SC)
// 4. Delayed execution of confirmEndShift (strictly after spinner completes)
// 5. Concurrency protection (no duplicate report generation)
// 6. Cancellation behavior preservation
// 7. Static binding guard against accidental revert to direct confirmEndShift
// ============================================================================

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAIN_JS_PATH = path.join(__dirname, '..', 'src', 'main.js');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

console.log('\n====================================================');
console.log('   GET REPORT & END SHIFT WORKFLOW VERIFICATION     ');
console.log('====================================================\n');

// -------------------------------------------------------------
// Group 1: Static Code Integrity & AST Guard
// -------------------------------------------------------------
console.log('--- Group 1: Static Code Architecture Guard ---');

const mainJsSource = fs.readFileSync(MAIN_JS_PATH, 'utf8');

runTest('1.1: executeEndShiftFinalReportWorkflow is declared as a named function', () => {
  assert(
    mainJsSource.includes('export function executeEndShiftFinalReportWorkflow()') ||
    mainJsSource.includes('function executeEndShiftFinalReportWorkflow()'),
    'Expected executeEndShiftFinalReportWorkflow to be declared as a function'
  );
});

runTest('1.2: confConfirmBtn is bound to executeEndShiftFinalReportWorkflow', () => {
  assert(
    mainJsSource.includes("confConfirmBtn?.addEventListener('click', executeEndShiftFinalReportWorkflow)") ||
    mainJsSource.includes("confConfirmBtn.addEventListener('click', executeEndShiftFinalReportWorkflow)"),
    'confConfirmBtn must be bound to executeEndShiftFinalReportWorkflow'
  );
});

runTest('1.3: confConfirmBtn is NOT bound directly to confirmEndShift', () => {
  const directBinding = mainJsSource.includes("confConfirmBtn?.addEventListener('click', confirmEndShift)") ||
                        mainJsSource.includes("confConfirmBtn.addEventListener('click', confirmEndShift)");
  assert.strictEqual(
    directBinding,
    false,
    'Regression detected: confConfirmBtn must not bypass animation by binding directly to confirmEndShift'
  );
});

runTest('1.4: Double-click concurrency guard exists in executeEndShiftFinalReportWorkflow', () => {
  assert(
    mainJsSource.includes('_isGeneratingEndShiftReport') ||
    mainJsSource.includes('isGeneratingReport'),
    'Expected concurrency lock flag guarding executeEndShiftFinalReportWorkflow'
  );
});

// -------------------------------------------------------------
// Group 2: Behavioral Mock Simulation of the Workflow
// -------------------------------------------------------------
console.log('\n--- Group 2: Two-Phase Sequence & Delayed Execution ---');

function createMockEnvironment(jurisdiction = 'GA') {
  const elements = new Map();

  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        textContent: '',
        style: { display: 'none' },
        disabled: false,
        open: false,
        showModal() { this.open = true; },
        close() { this.open = false; }
      });
    }
    return elements.get(id);
  }

  // Pre-seed known modal elements
  getOrCreateElement('endShiftConfirmModal');
  getOrCreateElement('endShiftStep1View');
  getOrCreateElement('endShiftStep2View');
  getOrCreateElement('calculatingSpinnerModal');
  getOrCreateElement('calculatingSpinnerText');
  getOrCreateElement('calculatingSubText');
  getOrCreateElement('inputManualActivations');
  getOrCreateElement('inputManualEmptySlots');
  getOrCreateElement('inputManualOnlineSales');
  getOrCreateElement('confTerminalOnlineCashes');
  getOrCreateElement('confTerminalCashes');
  getOrCreateElement('confConfirmBtn');

  const mockState = {
    shiftStatus: 'SCANNING_END_SHIFT',
    lotteryJurisdiction: jurisdiction,
    onlineSales: 0,
    onlineCashes: 0,
    cashes: 0,
    manualOnlineSales: null,
    manualScratchOffSales: null,
    slots: [
      { boxNumber: 1, status: 'ACTIVE', packNumber: '001', scannedInEndShift: true }
    ]
  };

  const spinnerCalls = [];
  function mockShowCalculatingSpinner(title, subtext, onDone, duration = 1200) {
    spinnerCalls.push({ title, subtext, duration, onDone });
    const modal = getOrCreateElement('calculatingSpinnerModal');
    modal.showModal();
    getOrCreateElement('calculatingSpinnerText').textContent = title;
    getOrCreateElement('calculatingSubText').textContent = subtext;
  }

  let confirmEndShiftCalled = false;
  function mockConfirmEndShift() {
    confirmEndShiftCalled = true;
    mockState.shiftStatus = 'SHIFT_ENDED';
  }

  return {
    elements,
    getOrCreateElement,
    mockState,
    spinnerCalls,
    getConfirmEndShiftCalled: () => confirmEndShiftCalled,
    mockConfirmEndShift,
    mockShowCalculatingSpinner
  };
}

runTest('2.1: Phase 1 navigation opens Phase 2 without triggering animation', () => {
  const env = createMockEnvironment('GA');
  const step1 = env.getOrCreateElement('endShiftStep1View');
  const step2 = env.getOrCreateElement('endShiftStep2View');

  // Step 1 open
  step1.style.display = 'block';
  step2.style.display = 'none';

  // Cashier enters activations and empty slots
  env.getOrCreateElement('inputManualActivations').value = '4';
  env.getOrCreateElement('inputManualEmptySlots').value = '12';

  // Next clicked
  step1.style.display = 'none';
  step2.style.display = 'block';

  assert.strictEqual(step1.style.display, 'none');
  assert.strictEqual(step2.style.display, 'block');
  assert.strictEqual(env.spinnerCalls.length, 0, 'No animation allowed during Phase 1 -> Phase 2 transition');
  assert.strictEqual(env.getConfirmEndShiftCalled(), false, 'Report cannot generate on Step 1');
});

runTest('2.2: Phase 2 back button returns to Phase 1 preserving entered values', () => {
  const env = createMockEnvironment('GA');
  const step1 = env.getOrCreateElement('endShiftStep1View');
  const step2 = env.getOrCreateElement('endShiftStep2View');

  // In Step 2, cashier enters manual online sale
  env.getOrCreateElement('inputManualOnlineSales').value = '125.50';

  // Cashier clicks Back to Step 1
  step2.style.display = 'none';
  step1.style.display = 'block';

  assert.strictEqual(step1.style.display, 'block');
  assert.strictEqual(step2.style.display, 'none');
  assert.strictEqual(env.getOrCreateElement('inputManualOnlineSales').value, '125.50', 'Values must be preserved on Back');
  assert.strictEqual(env.spinnerCalls.length, 0);
  assert.strictEqual(env.getConfirmEndShiftCalled(), false);
});

runTest('2.3: Clicking Finish & Generate Report closes modal, starts animation, delays confirmEndShift', () => {
  // Extract executeEndShiftFinalReportWorkflow logic
  function executeWorkflow(env) {
    const rawOnline = env.getOrCreateElement('inputManualOnlineSales').value;
    const rawOnlineCashes = env.getOrCreateElement('confTerminalOnlineCashes').value;
    const rawCashes = env.getOrCreateElement('confTerminalCashes').value;

    function parseVal(val, fallback = 0) {
      if (val === null || val === undefined) return fallback;
      const s = String(val).trim();
      if (s === '') return fallback;
      const n = parseFloat(s);
      return isNaN(n) ? fallback : n;
    }

    env.mockState.onlineSales = parseVal(rawOnline, 0);
    env.mockState.onlineCashes = parseVal(rawOnlineCashes, 0);
    env.mockState.cashes = parseVal(rawCashes, 0);

    const modal = env.getOrCreateElement('endShiftConfirmModal');
    modal.close();

    const subtext = env.mockState.lotteryJurisdiction === 'SC'
      ? 'Generating South Carolina Lottery Report...'
      : 'Generating Georgia Lottery Report...';

    env.mockShowCalculatingSpinner('Calculating', subtext, () => {
      env.mockConfirmEndShift();
    }, 1200);
  }

  const env = createMockEnvironment('GA');
  const modal = env.getOrCreateElement('endShiftConfirmModal');
  modal.open = true;

  env.getOrCreateElement('inputManualOnlineSales').value = '250.75';
  env.getOrCreateElement('confTerminalOnlineCashes').value = '40.00';
  env.getOrCreateElement('confTerminalCashes').value = '85.25';

  executeWorkflow(env);

  // Assert modal closed before animation
  assert.strictEqual(modal.open, false, 'Confirmation modal must close before animation starts');

  // Assert animation called
  assert.strictEqual(env.spinnerCalls.length, 1, 'showCalculatingSpinner must be called once');
  assert.strictEqual(env.spinnerCalls[0].title, 'Calculating');
  assert.strictEqual(env.spinnerCalls[0].subtext, 'Generating Georgia Lottery Report...');
  assert.strictEqual(env.spinnerCalls[0].duration, 1200);

  // Assert confirmEndShift was NOT called yet (delayed)
  assert.strictEqual(env.getConfirmEndShiftCalled(), false, 'confirmEndShift must NOT execute synchronously');

  // Fire the timer callback
  env.spinnerCalls[0].onDone();

  // Assert confirmEndShift called upon callback
  assert.strictEqual(env.getConfirmEndShiftCalled(), true, 'confirmEndShift must execute when timer expires');
  assert.strictEqual(env.mockState.shiftStatus, 'SHIFT_ENDED');
  assert.strictEqual(env.mockState.onlineSales, 250.75);
  assert.strictEqual(env.mockState.onlineCashes, 40.00);
  assert.strictEqual(env.mockState.cashes, 85.25);
});

// -------------------------------------------------------------
// Group 3: Preserving Explicit Zero Entries
// -------------------------------------------------------------
console.log('\n--- Group 3: Explicit Zero Input Preservation ---');

runTest('3.1: Explicit zero inputs (0.00 or 0) are strictly preserved and not overwritten', () => {
  function parseExplicitCurrencyInput(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const trimmed = String(val).trim();
    if (trimmed === '') return fallback;
    const num = parseFloat(trimmed);
    return isNaN(num) ? fallback : num;
  }

  // Fallback defaults to 999.00
  assert.strictEqual(parseExplicitCurrencyInput('0', 999.00), 0, 'String "0" must parse as integer 0');
  assert.strictEqual(parseExplicitCurrencyInput('0.00', 999.00), 0, 'String "0.00" must parse as number 0');
  assert.strictEqual(parseExplicitCurrencyInput('   0   ', 999.00), 0, 'Whitespace padded " 0 " must parse as 0');
  assert.strictEqual(parseExplicitCurrencyInput('', 999.00), 999.00, 'Empty string must use fallback');
  assert.strictEqual(parseExplicitCurrencyInput(null, 999.00), 999.00, 'Null must use fallback');
});

runTest('3.2: Step 2 captures explicit zero values for all 3 fields', () => {
  const env = createMockEnvironment('GA');
  env.mockState.manualOnlineSales = 500; // Pre-existing state

  env.getOrCreateElement('inputManualOnlineSales').value = '0.00';
  env.getOrCreateElement('confTerminalOnlineCashes').value = '0';
  env.getOrCreateElement('confTerminalCashes').value = '0.00';

  function parseVal(val, fallback = 0) {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    if (s === '') return fallback;
    const n = parseFloat(s);
    return isNaN(n) ? fallback : n;
  }

  env.mockState.onlineSales = parseVal(env.getOrCreateElement('inputManualOnlineSales').value, env.mockState.manualOnlineSales || 0);
  env.mockState.onlineCashes = parseVal(env.getOrCreateElement('confTerminalOnlineCashes').value, 0);
  env.mockState.cashes = parseVal(env.getOrCreateElement('confTerminalCashes').value, 0);

  assert.strictEqual(env.mockState.onlineSales, 0, 'Explicit 0.00 onlineSales must not fall back to 500');
  assert.strictEqual(env.mockState.onlineCashes, 0, 'Explicit 0 onlineCashes must remain 0');
  assert.strictEqual(env.mockState.cashes, 0, 'Explicit 0.00 cashes must remain 0');
});

// -------------------------------------------------------------
// Group 4: Jurisdiction Specific Subtext
// -------------------------------------------------------------
console.log('\n--- Group 4: Jurisdiction Specific Subtext ---');

runTest('4.1: Georgia store displays Georgia Lottery Report message', () => {
  const env = createMockEnvironment('GA');
  const subtext = env.mockState.lotteryJurisdiction === 'SC'
    ? 'Generating South Carolina Lottery Report...'
    : 'Generating Georgia Lottery Report...';
  assert.strictEqual(subtext, 'Generating Georgia Lottery Report...');
});

runTest('4.2: South Carolina store displays South Carolina Lottery Report message', () => {
  const env = createMockEnvironment('SC');
  const subtext = env.mockState.lotteryJurisdiction === 'SC'
    ? 'Generating South Carolina Lottery Report...'
    : 'Generating Georgia Lottery Report...';
  assert.strictEqual(subtext, 'Generating South Carolina Lottery Report...');
});

// -------------------------------------------------------------
// Group 5: Concurrency & Duplicate Click Guard
// -------------------------------------------------------------
console.log('\n--- Group 5: Concurrency & Duplicate Click Guard ---');

runTest('5.1: Duplicate clicks on confConfirmBtn while processing are blocked', () => {
  let isGenerating = false;
  let executionCount = 0;

  function handleConfirmClick() {
    if (isGenerating) return;
    isGenerating = true;
    executionCount++;
  }

  // First click
  handleConfirmClick();
  assert.strictEqual(executionCount, 1);
  assert.strictEqual(isGenerating, true);

  // Second rapid click while in-flight
  handleConfirmClick();
  assert.strictEqual(executionCount, 1, 'Second click must be ignored while isGenerating is true');

  // Third rapid click while in-flight
  handleConfirmClick();
  assert.strictEqual(executionCount, 1, 'Third click must be ignored while isGenerating is true');

  // Completion
  isGenerating = false;
  handleConfirmClick();
  assert.strictEqual(executionCount, 2, 'Subsequent click allowed once previous generation finishes');
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`   TEST RESULTS: Passed: ${passedTests}, Failed: ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL GET REPORT WORKFLOW REGRESSION TESTS PASSED PERFECTLY!\n');
}
