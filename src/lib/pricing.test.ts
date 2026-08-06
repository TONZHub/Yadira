// Tests for the plan the checkout is asked to bill.
//
// The bug this file exists for: startPremiumCheckout took no arguments, so
// the Lodge passed it straight to onClick. The moment it took a plan, React
// began handing it the click event instead — and JSON.stringify of a
// synthetic event throws on its circular references, so the request was never
// sent and the caregiver was told the server could not be reached.
//
// TypeScript was silent: (plan?: Plan) => void is assignable to () => void.
// So the guard has to be a runtime one, and this is what holds it there.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  planOf,
  isPlan,
  PLANS,
  PRICE_MONTHLY_CENTS,
  PRICE_ANNUAL_CENTS,
  TRIAL_DAYS,
  TRIAL_LABEL,
  hasTrial,
  TRIAL_EXCLUDES_BRIEFING_CALL,
} from './pricing';

describe('the plan is normalised, never trusted', () => {
  test('the two real plans pass through', () => {
    assert.equal(planOf('monthly'), 'monthly');
    assert.equal(planOf('annual'), 'annual');
  });

  test('nothing at all bills monthly', () => {
    assert.equal(planOf(undefined), 'monthly');
    assert.equal(planOf(null), 'monthly');
  });

  test('a click event bills monthly instead of throwing', () => {
    // The actual failure, in the shape React produces.
    const el: any = {}; el.self = el;
    const evt: any = { type: 'click', target: el, nativeEvent: {} };
    evt.nativeEvent.target = el;
    assert.equal(planOf(evt), 'monthly');
    // And the whole point: the payload must now serialise.
    assert.doesNotThrow(() => JSON.stringify({ circle: 'c', plan: planOf(evt) }));
  });

  test('junk never becomes a price', () => {
    for (const bad of ['yearly', 'free', 42, {}, [], true]) {
      assert.equal(isPlan(bad), false);
      assert.ok(PLANS[planOf(bad)].cents > 0);
    }
  });
});

describe('the prices are the ones that were decided', () => {
  test('$39.99 monthly and $399 annual, in cents', () => {
    assert.equal(PRICE_MONTHLY_CENTS, 3999);
    assert.equal(PRICE_ANNUAL_CENTS, 39900);
  });

  test('the annual plan is worth about two months, and is never a loss', () => {
    // "Two months free" is the pitch, not an exact identity: $39.99 x 12 is
    // $479.88, so $399 saves $80.88 — 2.02 months. Assert the relationship
    // that actually matters rather than reverse-engineering the arithmetic.
    const saving = PRICE_MONTHLY_CENTS * 12 - PRICE_ANNUAL_CENTS;
    const monthsFree = saving / PRICE_MONTHLY_CENTS;
    assert.ok(monthsFree > 1.5 && monthsFree < 2.5, `discount is ${monthsFree.toFixed(2)} months`);
    // The measured cost of one family is $6.10/week = $317/year. Below that
    // the annual plan loses money on every subscriber who uses it properly.
    assert.ok(PRICE_ANNUAL_CENTS > 31720, 'annual price must clear the cost of serving a year');
  });

  test('the intervals Stripe is sent match the labels shown', () => {
    assert.equal(PLANS.monthly.interval, 'month');
    assert.equal(PLANS.annual.interval, 'year');
    assert.match(PLANS.monthly.label, /month/);
    assert.match(PLANS.annual.label, /year/);
  });
});

describe('the free trial', () => {
  test('seven days by default, and copy derived from it', () => {
    // Every string that mentions the trial comes off this number, so a
    // button can never promise a trial that is not configured.
    assert.equal(TRIAL_DAYS, 7);
    assert.equal(hasTrial(), true);
    assert.match(TRIAL_LABEL, new RegExp(`^${TRIAL_DAYS}-day free trial$`));
  });

  test('the trial is bounded by what it costs to serve', () => {
    // Measured COGS is $6.10/week, so $0.871/day. Seven days risks $6.10
    // against a $39.99 month — the constraint on length was never money, it
    // was leaving enough time to finish setup before the card is charged.
    const exposurePerStart = TRIAL_DAYS * 0.871;
    assert.ok(exposurePerStart < PRICE_MONTHLY_CENTS / 100, 'a trial must cost less than the month it sells');
  });

  test('the briefing call is excluded, the weekly email is not', () => {
    // The call is billed per call and is the one thing a trial could be
    // farmed for. The email costs a fraction of a cent, and a trial where
    // nothing ever arrives is a week of silence followed by a charge.
    assert.equal(TRIAL_EXCLUDES_BRIEFING_CALL, true);
  });
});
