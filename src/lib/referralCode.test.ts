// Tests for the parts of the referral system that face outward: what a code
// coming back off a stranger's URL is worth, and where a copied link points.
//
// Both are places where the failure is silent and the cost is the whole
// feature. A code that survives normalization but doesn't match what was
// minted attributes a signup to nobody; a link copied on a laptop that carries
// `localhost` is sent to a caregiver's sister and simply doesn't open.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_ORIGIN,
  generateReferralCode,
  normalizeReferralCode,
  referralLink,
  shareOrigin,
  splitRefFromUrl,
  timestampReferralCode,
} from './referralCode';

describe('generated codes', () => {
  test('look like YADIRA-XXXX', () => {
    for (let i = 0; i < 200; i++) {
      assert.match(generateReferralCode(), /^YADIRA-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  test('leave out the glyphs people mistype — no I, O, 0, 1', () => {
    for (let i = 0; i < 200; i++) {
      const body = generateReferralCode().slice('YADIRA-'.length);
      assert.equal(/[IO01]/.test(body), false, `ambiguous glyph in ${body}`);
    }
  });

  test('a code always survives its own normalizer', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      assert.equal(normalizeReferralCode(code), code);
    }
    const stamped = timestampReferralCode();
    assert.equal(normalizeReferralCode(stamped), stamped);
  });

  test('the timestamp fallback is still a four-character code', () => {
    assert.match(timestampReferralCode(1770000000000), /^YADIRA-[A-Z0-9]{4}$/);
  });
});

describe('codes arriving from the outside world', () => {
  test('lowercase and padding are forgiven', () => {
    assert.equal(normalizeReferralCode('  yadira-x7k2 '), 'YADIRA-X7K2');
  });

  test('a bare body gets the prefix — people copy the tail', () => {
    assert.equal(normalizeReferralCode('x7k2'), 'YADIRA-X7K2');
  });

  test('junk is nothing, not a lookup', () => {
    for (const bad of [null, undefined, '', '   ', 'YADIRA-', 'YADIRA-X7K', 'YADIRA-X7K23', 'X7-2', '../../etc', 'YADIRA-X7K2 OR 1=1']) {
      assert.equal(normalizeReferralCode(bad as any), null, `accepted ${JSON.stringify(bad)}`);
    }
  });

  test('a megabyte of junk never reaches localStorage', () => {
    assert.equal(normalizeReferralCode('A'.repeat(100000)), null);
  });
});

describe('the link a caregiver copies', () => {
  test('a real https origin is kept', () => {
    assert.equal(shareOrigin('https://yadira.chat/?ref=YADIRA-X7K2'), 'https://yadira.chat');
  });

  test('localhost and http fall back to the canonical domain', () => {
    assert.equal(shareOrigin('http://localhost:5173/'), CANONICAL_ORIGIN);
    assert.equal(shareOrigin('https://localhost:5173/'), CANONICAL_ORIGIN);
    assert.equal(shareOrigin('https://127.0.0.1:5173/'), CANONICAL_ORIGIN);
    assert.equal(shareOrigin('http://yadira.chat/'), CANONICAL_ORIGIN);
    assert.equal(shareOrigin('not a url'), CANONICAL_ORIGIN);
    assert.equal(shareOrigin(null), CANONICAL_ORIGIN);
  });

  test('the whole link is what goes in the Reddit post', () => {
    assert.equal(
      referralLink('YADIRA-X7K2', 'https://yadira.chat/hub'),
      'https://yadira.chat/?ref=YADIRA-X7K2'
    );
    assert.equal(referralLink('YADIRA-X7K2', 'http://localhost:5173/'), `${CANONICAL_ORIGIN}/?ref=YADIRA-X7K2`);
  });
});

describe('taking the code back out of the URL', () => {
  test('the code is read and the param removed', () => {
    const { code, cleanedUrl } = splitRefFromUrl('https://yadira.chat/?ref=yadira-x7k2');
    assert.equal(code, 'YADIRA-X7K2');
    assert.equal(cleanedUrl, '/');
  });

  test("every other param survives — Stripe's return trip runs through here", () => {
    const { code, cleanedUrl } = splitRefFromUrl(
      'https://yadira.chat/?premium_session=cs_test_123&ref=YADIRA-X7K2&start'
    );
    assert.equal(code, 'YADIRA-X7K2');
    assert.equal(cleanedUrl, '/?premium_session=cs_test_123&start=');
  });

  test('the hash survives too', () => {
    assert.equal(splitRefFromUrl('https://yadira.chat/?ref=YADIRA-X7K2#hub').cleanedUrl, '/#hub');
  });

  test('no ref param means nothing to do — and no URL rewrite', () => {
    assert.deepEqual(splitRefFromUrl('https://yadira.chat/?start'), { code: null, cleanedUrl: null });
  });

  test('a junk ref is still stripped from the URL', () => {
    // The code is worthless, but leaving it in the address bar means every
    // reload re-reads it, and it rides along into the Stripe return URL.
    const { code, cleanedUrl } = splitRefFromUrl('https://yadira.chat/?ref=%3Cscript%3E');
    assert.equal(code, null);
    assert.equal(cleanedUrl, '/');
  });
});
