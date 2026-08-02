// Tests for the rule that decides whether a Firestore snapshot replaces what
// the family is looking at.
//
// Both bugs this encodes were silent data loss, found by reading the sync
// layer rather than by anything failing:
//
//   1. `if (!snap.empty)` meant an emptied collection never crossed devices.
//      Delete your last memory on the phone, the tablet keeps it — and the
//      tablet's next write puts it back for everyone. A deletion that
//      resurrects is worse than one that fails.
//
//   2. `pendingWrite` was a single boolean that skipped the NEXT snapshot
//      whatever it contained. A genuine change from the other device landing
//      just after a local write was swallowed as our own echo, and Firestore
//      does not resend.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { shouldApplySnapshot } from './snapshotRule';

const snap = (o: Partial<Parameters<typeof shouldApplySnapshot>[0]> = {}) =>
  shouldApplySnapshot({ empty: false, hasPendingWrites: false, seenSnapshot: true, ...o });

describe('our own write is not news', () => {
  test('a snapshot carrying our un-acknowledged write is skipped', () => {
    assert.equal(snap({ hasPendingWrites: true }), false);
  });

  test('the server echo of that same write IS applied', () => {
    // Harmless — it is the same data — and insisting on skipping it is what
    // made the old boolean swallow real updates.
    assert.equal(snap({ hasPendingWrites: false }), true);
  });

  test('a remote change arriving right after a local write is NOT swallowed', () => {
    // THE regression. Under the old boolean this was discarded as our echo
    // and never seen again.
    assert.equal(snap({ hasPendingWrites: false, seenSnapshot: true }), true);
  });
});

describe('an empty collection is ambiguous exactly once', () => {
  test('the first empty snapshot is "nothing here yet" — keep the local seed', () => {
    // A brand-new circle. Applying this would wipe the sample family the
    // caregiver just chose, before they had touched anything.
    assert.equal(snap({ empty: true, seenSnapshot: false }), false);
  });

  test('a later empty snapshot is a deletion — apply it', () => {
    // THE regression. Not applying this is how deleting your last memory on
    // one device leaves it alive on the other.
    assert.equal(snap({ empty: true, seenSnapshot: true }), true);
  });

  test('a non-empty first snapshot is applied as always', () => {
    assert.equal(snap({ empty: false, seenSnapshot: false }), true);
  });
});

describe('the two rules do not fight', () => {
  test('our own write that empties the list is still skipped as ours', () => {
    // The deletion will come back around from the server without the pending
    // flag, and be applied then.
    assert.equal(snap({ empty: true, hasPendingWrites: true, seenSnapshot: true }), false);
  });

  test('and the server confirmation of it is applied', () => {
    assert.equal(snap({ empty: true, hasPendingWrites: false, seenSnapshot: true }), true);
  });
});
