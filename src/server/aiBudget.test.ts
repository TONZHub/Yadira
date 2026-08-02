// Tests for the daily ceiling on the routes that cost money.
//
// The hole: the local-demo token is unsigned by necessity — it exists for
// deployments with no Firebase Auth — so a hand-written
// {"uid":"local-anything","iss":"yadira-local-dev"} is accepted, and every AI
// route accepts it. Verified against a running build before writing this.
// Circle isolation held, so it was never a data leak. It was a bill.
//
// The shape of the limit is the interesting part: a real family must never be
// cut off mid-afternoon, and a forged token must not be worth farming. Those
// are different numbers, and the tier is what tells them apart.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAiBudget,
  overBudget,
  circleLimitFor,
  __resetAiBudget,
  AI_DAILY_PER_CIRCLE_LOCAL,
  AI_DAILY_PER_CIRCLE_VERIFIED,
  AI_DAILY_PER_CIRCLE_PRO,
  AI_DAILY_PER_IP,
} from './aiBudget';

beforeEach(() => __resetAiBudget());

const spend = (n: number, circle: string, ip: string, tier: 'pro' | 'verified' | 'local', now = Date.now()) => {
  let last = { allowed: true } as ReturnType<typeof checkAiBudget>;
  for (let i = 0; i < n; i++) last = checkAiBudget(circle, ip, tier, now);
  return last;
};

describe('a demo circle is bounded tightly — that is where forged tokens land', () => {
  test('it gets through a genuine look around', () => {
    const r = spend(AI_DAILY_PER_CIRCLE_LOCAL, 'local-someone', '1.1.1.1', 'local');
    assert.equal(r.allowed, true);
  });

  test('and stops one past it', () => {
    spend(AI_DAILY_PER_CIRCLE_LOCAL, 'local-someone', '1.1.1.1', 'local');
    const r = checkAiBudget('local-someone', '1.1.1.1', 'local');
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'circle');
  });

  test('signing out is never an upgrade', () => {
    // The ceiling used to sit far below the family one, back when the family
    // ceiling was 600 — a number 24x above what anyone actually used, so it
    // bounded abuse and nothing else. Now that the free tier is sized to a
    // real day, a demo ceiling BELOW it would mean logging out bought you a
    // bigger allowance than signing in. Level is the relationship that
    // matters; the IP cap is what still bounds a forged token.
    assert.ok(circleLimitFor('local') <= circleLimitFor('verified'));
  });
});

describe('the ceiling follows who is paying', () => {
  // The measured cost of one family is $6.10/week, and every cent of it was
  // free-tier spend: the companion is free, only the caregiver's reports are
  // paid. A single ceiling for everyone meant the free tier set the bill.

  test('a paying family is given far more room than a free one', () => {
    assert.ok(circleLimitFor('pro') > circleLimitFor('verified') * 4);
  });

  test('Pro gets the old generous ceiling, unchanged', () => {
    // A paying family meeting a limit is the thing this tier exists to
    // prevent. If this number ever drops, it should be a decision, not a
    // side effect of tuning the free one.
    assert.equal(circleLimitFor('pro'), AI_DAILY_PER_CIRCLE_PRO);
    assert.ok(AI_DAILY_PER_CIRCLE_PRO >= 600);
  });

  test('a Pro circle sails past where a free one would have stopped', () => {
    const r = spend(AI_DAILY_PER_CIRCLE_VERIFIED + 1, 'paying-family', '9.9.9.9', 'pro');
    assert.equal(r.allowed, true);
  });

  test('the free ceiling is sized to a day, not to abuse', () => {
    // ~25 exchanges is fifteen minutes of companion. The ceiling has to clear
    // that — a short daily visit must finish at full quality — while staying
    // near enough that a heavy day degrades rather than bills.
    assert.ok(AI_DAILY_PER_CIRCLE_VERIFIED >= 25, 'a normal daily visit must complete');
    assert.ok(AI_DAILY_PER_CIRCLE_VERIFIED <= 120, 'or it is not a ceiling at all');
  });
});

describe('a signed-in family is not the one being defended against', () => {
  test('a very heavy day still goes through', () => {
    const r = spend(AI_DAILY_PER_CIRCLE_VERIFIED, 'A1b2C3d4', '2.2.2.2', 'verified');
    assert.equal(r.allowed, true);
  });

  test('a verified circle is unaffected by a demo circle burning its own', () => {
    spend(AI_DAILY_PER_CIRCLE_LOCAL + 5, 'local-noisy', '3.3.3.3', 'local');
    assert.equal(checkAiBudget('A1b2C3d4', '3.3.3.3', 'verified').allowed, true);
  });
});

describe('the per-IP backstop catches someone rotating circles', () => {
  test('fresh uids every time still hit the address ceiling', () => {
    // The exact attack the local tier cannot stop on its own: mint a new
    // local-* uid per request and every circle counter starts at zero.
    let blocked = false;
    for (let i = 0; i <= AI_DAILY_PER_IP + 1; i++) {
      const r = checkAiBudget(`local-throwaway-${i}`, '9.9.9.9', 'local');
      if (!r.allowed) { blocked = true; assert.equal(r.reason, 'ip'); break; }
    }
    assert.equal(blocked, true, 'rotating circles should still be stopped by the IP cap');
  });

  test('a circle-limited request still counts against the IP', () => {
    // Otherwise tripping the circle limit would be a free pass past the
    // backstop — spend there, then rotate.
    spend(AI_DAILY_PER_CIRCLE_LOCAL + 50, 'local-one', '8.8.8.8', 'local');
    // 50 of those were refused by the circle rule; they must still be counted.
    assert.ok(overBudget('ip:8.8.8.8', AI_DAILY_PER_CIRCLE_LOCAL + 40) === true);
  });

  test('two addresses do not share a ceiling', () => {
    spend(AI_DAILY_PER_CIRCLE_LOCAL, 'local-a', '4.4.4.4', 'local');
    assert.equal(checkAiBudget('local-b', '5.5.5.5', 'local').allowed, true);
  });
});

describe('the ceiling resets', () => {
  test('a new day starts clean', () => {
    const day1 = Date.parse('2026-08-02T12:00:00Z');
    const day2 = Date.parse('2026-08-03T00:05:00Z');
    spend(AI_DAILY_PER_CIRCLE_LOCAL + 10, 'local-someone', '6.6.6.6', 'local', day1);
    assert.equal(checkAiBudget('local-someone', '6.6.6.6', 'local', day1).allowed, false);
    assert.equal(checkAiBudget('local-someone', '6.6.6.6', 'local', day2).allowed, true);
  });
});
