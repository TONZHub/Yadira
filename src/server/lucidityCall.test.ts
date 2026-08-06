// Tests for the lucidity call.
//
// This one is short enough that almost everything in it is a constraint
// rather than a feature. The failures it guards against are:
//
//   · telling a stranger that a named person's mind has cleared
//   · promising a window nobody can promise
//   · turning forty seconds of good news into a conversation, while the
//     window it announced is closing

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLucidityCallGoal,
  withinLucidityCooldown,
  markLucidityCalled,
  clearLucidityCooldown,
  __resetLucidityCooldowns,
  LUCIDITY_RESULT_SCHEMA,
} from './lucidityCall';

const req = {
  toPhone: '+15559990000',
  patientName: 'Eleanor',
  caregiverName: 'Thomas',
  at: Date.now(),
};

const goal = buildLucidityCallGoal(req);

describe('it says nothing until it knows who answered', () => {
  test('identity is confirmed before Eleanor is named', () => {
    const ask = goal.indexOf('Am I speaking with');
    const name = goal.indexOf('Nothing is wrong');
    assert.ok(ask > -1 && ask < name);
  });

  test('a wrong number learns nothing — including the word "clear"', () => {
    assert.match(goal, /Do NOT say why you are calling/);
    assert.match(goal, /Do NOT name Eleanor/);
    assert.match(goal, /Do NOT mention health, memory, clarity, or an app/);
    assert.match(goal, /learns only that somebody called/);
  });

  test('a voicemail says nothing about clarity, because it may be heard hours late', () => {
    const vm = goal.slice(goal.indexOf('VOICEMAIL'));
    assert.match(vm, /do not name Eleanor/i);
    assert.match(vm, /worth seeing/);
    assert.doesNotMatch(vm, /clear moment/i);
  });
});

describe('it does not promise the window will last', () => {
  test('the news is anchored to now', () => {
    assert.match(goal, /clear moment right now/i);
    assert.match(goal, /now is the time/i);
  });

  test('and it is explicitly forbidden from promising more', () => {
    // A caregiver who drives across town on "she'll be waiting" and finds it
    // has passed has been handed a second loss by the call that told them.
    assert.match(goal, /do not say how long it will last/i);
    assert.match(goal, /will be waiting/);
    assert.match(goal, /handed a second loss/i);
  });
});

describe('it asks nothing at all', () => {
  test('no question is put to the caregiver', () => {
    assert.match(goal, /Ask NOTHING/);
    assert.match(goal, /Do not ask whether they can get there/i);
  });

  test('wanting to hang up is the call succeeding, not failing', () => {
    assert.match(goal, /let them — that is the call working/i);
  });

  test('it is bounded to well under a minute', () => {
    assert.match(goal, /under forty seconds/i);
  });

  test('the schema asks only who answered', () => {
    // Everything else would be a question, and this call has none.
    assert.deepEqual(Object.keys(LUCIDITY_RESULT_SCHEMA.properties), ['reached']);
  });
});

describe('it is not a doctor and it is not alarming', () => {
  test('no prognosis, no speculation', () => {
    assert.match(goal, /must not speculate/i);
    assert.match(goal, /Say nothing about their prognosis/i);
  });

  test('nothing is wrong is said first, because this number also rings for the help button', () => {
    assert.match(goal, /also rings for Eleanor's help button/);
    assert.match(goal, /braced for bad news/i);
    assert.match(goal, /Do not sound alarmed/i);
  });

  test('works without a caregiver name', () => {
    const anon = buildLucidityCallGoal({ ...req, caregiverName: undefined });
    assert.match(anon, /the caregiver/);
    assert.doesNotMatch(anon, /undefined/);
  });
});

describe('a flickering signal must not become three phone calls', () => {
  test('a second window inside the hour does not ring again', () => {
    // Lucidity detection flickers — clear, then not, then clear again inside
    // minutes. Three calls teaches a caregiver to stop answering, and the
    // one they stop answering might be the help button.
    __resetLucidityCooldowns();
    const now = Date.now();
    assert.equal(withinLucidityCooldown('circle-a', now), false);
    markLucidityCalled('circle-a', now);
    assert.equal(withinLucidityCooldown('circle-a', now + 10 * 60_000), true);
    assert.equal(withinLucidityCooldown('circle-a', now + 59 * 60_000), true);
  });

  test('it lapses after an hour', () => {
    __resetLucidityCooldowns();
    const now = Date.now();
    markLucidityCalled('circle-a', now);
    assert.equal(withinLucidityCooldown('circle-a', now + 61 * 60_000), false);
  });

  test('one family never silences another', () => {
    __resetLucidityCooldowns();
    markLucidityCalled('circle-a', Date.now());
    assert.equal(withinLucidityCooldown('circle-b'), false);
  });

  test('a call that failed does not cost the next window', () => {
    __resetLucidityCooldowns();
    const now = Date.now();
    markLucidityCalled('circle-a', now);
    clearLucidityCooldown('circle-a');
    assert.equal(withinLucidityCooldown('circle-a', now + 1000), false);
  });
});
