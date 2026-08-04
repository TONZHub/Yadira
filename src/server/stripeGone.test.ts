// Tests for telling "Stripe says it's gone" apart from "Stripe didn't answer".
//
// Found in production: an investor's Stripe customer was deleted so he could
// re-subscribe on the new plan. He kept Hattie's Lodge and every other paid
// feature, and the only visible symptom was a toast reading
// "Billing portal unavailable — No such customer: 'cus_UweaV2YtuR6vjm'".
//
// The cause was one line — `if (!res.ok) return;` — guarding the only code
// path that can downgrade. That guard is right for a flaky connection and
// wrong for a definitive 404, and the two were indistinguishable. On an
// annual plan the gap was up to a year and three days.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { __isMissingResource as isMissingResource, __StripeError as StripeError } from './stripe';

describe('a deleted resource is an answer, not an outage', () => {
  test('a 404 from Stripe means gone', () => {
    assert.equal(isMissingResource(new StripeError('No such customer', 404, 'resource_missing')), true);
  });

  test('resource_missing means gone whatever the status', () => {
    assert.equal(isMissingResource(new StripeError('nope', undefined, 'resource_missing')), true);
  });

  test('the real message from production is recognised', () => {
    // Verbatim from the toast that surfaced this.
    assert.equal(isMissingResource(new Error("No such customer: 'cus_UweaV2YtuR6vjm'")), true);
  });

  test('a missing subscription counts too', () => {
    assert.equal(isMissingResource(new Error('No such subscription: sub_123')), true);
  });
});

describe('everything else must never downgrade a paying family', () => {
  const mustNotBeGone = [
    new StripeError('Stripe API error 500', 500),
    new StripeError('rate limit exceeded', 429, 'rate_limit'),
    new StripeError('Invalid API Key provided', 401, 'api_key_invalid'),
    new Error('fetch failed'),
    new Error('Stripe API returned a non-JSON response (HTTP 502): <html>'),
    new Error(''),
  ];

  for (const err of mustNotBeGone) {
    test(`not gone: ${String(err.message).slice(0, 40) || '(empty)'}`, () => {
      // Any false positive here cancels Caregiver Pro for someone who paid,
      // because of a blip. That is worse than the bug this fixes.
      assert.equal(isMissingResource(err), false);
    });
  }

  test('undefined and null are not answers', () => {
    assert.equal(isMissingResource(undefined), false);
    assert.equal(isMissingResource(null), false);
  });
});
