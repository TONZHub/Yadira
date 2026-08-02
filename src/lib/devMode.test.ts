// Tests for the developer-mode gesture.
//
// Seven deliberate taps, close together. The point is that it cannot be
// reached by a hand that is shaking, wandering, or exploring — which on a
// patient's device is every hand.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerTap, DEV_TAP_COUNT, DEV_TAP_WINDOW_MS, type TapState } from './devMode';

const fresh = (): TapState => ({ count: 0, lastAt: 0 });

/** Tap n times, each `gap` ms after the last. */
function tap(times: number, gap: number) {
  let state = fresh();
  let opened = false;
  let now = 1_000_000;
  for (let i = 0; i < times; i++) {
    now += gap;
    const r = registerTap(state, now);
    state = r.next;
    opened = r.opened;
    if (opened) break;
  }
  return opened;
}

describe('the gesture opens only when it is meant', () => {
  test(`${DEV_TAP_COUNT} quick taps open it`, () => {
    assert.equal(tap(DEV_TAP_COUNT, 200), true);
  });

  test('fewer than that do not', () => {
    for (let n = 1; n < DEV_TAP_COUNT; n++) {
      assert.equal(tap(n, 200), false, `${n} taps opened it`);
    }
  });

  test('slow taps never accumulate', () => {
    // Someone idly touching the logo over a minute must not arrive here.
    assert.equal(tap(30, DEV_TAP_WINDOW_MS + 1), false);
  });

  test('a pause in the middle resets the count', () => {
    let state = fresh();
    let now = 1_000_000;
    for (let i = 0; i < DEV_TAP_COUNT - 1; i++) {
      now += 200;
      state = registerTap(state, now).next;
    }
    now += DEV_TAP_WINDOW_MS + 1; // hesitated
    const r = registerTap(state, now);
    assert.equal(r.opened, false);
    assert.equal(r.next.count, 1, 'the count should start over');
  });

  test('opening leaves the counter clean for next time', () => {
    let state = fresh();
    let now = 1_000_000;
    let result = { next: state, opened: false };
    for (let i = 0; i < DEV_TAP_COUNT; i++) {
      now += 100;
      result = registerTap(result.next, now);
    }
    assert.equal(result.opened, true);
    assert.deepEqual(result.next, { count: 0, lastAt: 0 });
  });
});
