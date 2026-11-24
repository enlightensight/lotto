// Sign-in restore must keep the newest copy. Real case (Amigo, Nov 19): the laptop had a newer
// in-progress shift whose saves never reached the server; re-login loaded the older server copy
// (shift 1, ended) because the two copies differed.
import { strict as assert } from 'assert';
import { shouldUseServerState } from '../src/data.js';

const slots = [{ boxNumber: 1, status: 'ACTIVE', packNumber: '0018902' }];
const older = { slots, shiftNumber: 1, shiftStatus: 'SHIFT_ENDED', lastSavedAt: '2026-11-19T02:52:01.538Z' };
const newer = { slots, shiftNumber: 2, shiftStatus: 'IN_PROGRESS', lastSavedAt: '2026-11-19T19:05:00.000Z' };

assert.equal(shouldUseServerState(older, newer), false, 'newer local work must not be replaced by an older server copy');
assert.equal(shouldUseServerState(newer, older), true, 'a newer server copy (saved from another device) wins');
assert.equal(shouldUseServerState(newer, { ...newer }), true, 'same time: take the server copy');
assert.equal(shouldUseServerState(newer, null), true, 'new device with nothing saved locally takes the server copy');
assert.equal(shouldUseServerState(older, { slots }), true, 'local copy without a save time is treated as oldest');
assert.equal(shouldUseServerState(null, newer), false, 'no server copy: keep local');
assert.equal(shouldUseServerState({ shiftNumber: 3 }, newer), false, 'server copy without slots is ignored');

console.log('restore-newest-state: 7 checks passed');
