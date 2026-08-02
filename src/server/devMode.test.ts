// Tests for developer mode.
//
// This switch turns OFF the frame-integrity protections in a dementia-care
// product. Almost every test here is about it staying shut: the interesting
// property is not "the secret works", it is "nothing else does".

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isDevRequest, devModeAvailable, devModeSecret, DEV_MODE_NOTE } from './devMode';

const SECRET = 'a-real-secret-value';
let saved: string | undefined;
beforeEach(() => { saved = process.env.DEV_MODE_SECRET; });
afterEach(() => {
  if (saved === undefined) delete process.env.DEV_MODE_SECRET;
  else process.env.DEV_MODE_SECRET = saved;
});

describe('with no secret configured, developer mode does not exist', () => {
  // The default, and the state of any deployment nobody has deliberately
  // set up. Not hidden, not guarded — impossible.
  beforeEach(() => { delete process.env.DEV_MODE_SECRET; });

  test('it is unavailable', () => {
    assert.equal(devModeAvailable(), false);
    assert.equal(devModeSecret(), null);
  });

  test('and no presented value can open it', () => {
    for (const attempt of ['', 'password', 'true', 'undefined', 'null', SECRET]) {
      assert.equal(isDevRequest(attempt), false, `opened with ${JSON.stringify(attempt)}`);
    }
  });
});

describe('a weak secret is treated as no secret', () => {
  test('short values are refused outright', () => {
    // Guessing this disables the thing that keeps a manipulation attempt away
    // from someone with dementia, so "dev" is not an acceptable password.
    for (const weak of ['dev', '1234', 'test', 'yadira']) {
      process.env.DEV_MODE_SECRET = weak;
      assert.equal(devModeAvailable(), false, `accepted ${weak}`);
      assert.equal(isDevRequest(weak), false);
    }
  });

  test('whitespace is not a secret either', () => {
    process.env.DEV_MODE_SECRET = '            ';
    assert.equal(devModeAvailable(), false);
  });
});

describe('with a secret configured', () => {
  beforeEach(() => { process.env.DEV_MODE_SECRET = SECRET; });

  test('the exact secret opens it', () => {
    assert.equal(devModeAvailable(), true);
    assert.equal(isDevRequest(SECRET), true);
  });

  test('nothing else does', () => {
    const nearMisses = [
      SECRET.toUpperCase(),
      SECRET.slice(0, -1),
      `${SECRET} `,
      ` ${SECRET}`,
      `${SECRET}x`,
      SECRET.replace('-', '_'),
    ];
    for (const attempt of nearMisses) {
      assert.equal(isDevRequest(attempt), false, `opened with ${JSON.stringify(attempt)}`);
    }
  });

  test('a non-string is not quietly coerced into one', () => {
    // A client sending `devToken: true` must not become developer mode.
    for (const attempt of [true, 1, null, undefined, {}, [], { toString: () => SECRET }]) {
      assert.equal(isDevRequest(attempt as unknown), false, `opened with ${JSON.stringify(attempt)}`);
    }
  });

  test('revoking it is a matter of clearing the variable', () => {
    assert.equal(isDevRequest(SECRET), true);
    delete process.env.DEV_MODE_SECRET;
    assert.equal(isDevRequest(SECRET), false);
  });
});

describe('what developer mode actually changes', () => {
  test('it lifts the frame and nothing else', () => {
    // The note replaces the staying-in-character rules. It must not quietly
    // unpick the rest of what makes this safe — those are not what makes
    // testing impossible.
    assert.match(DEV_MODE_NOTE, /answer plainly and honestly about what you are/i);
    assert.match(DEV_MODE_NOTE, /never produce content that would be harmful/i);
    assert.match(DEV_MODE_NOTE, /stay kind, stay concise/i);
  });

  test('it says out loud that this is not a patient', () => {
    assert.match(DEV_MODE_NOTE, /a developer is testing this system, not a patient/i);
  });
});
