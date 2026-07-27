// Tests for the help-button call.
//
// The failure that matters here is not a crash. It is ringing the wrong phone,
// ringing it eleven times, or saying something on the call that should not be
// said to whoever picks up.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHelpCallGoal,
  withinCooldown,
  markCalled,
  __resetCooldowns,
  HELP_RESULT_SCHEMA,
  type HelpCallRequest,
} from './helpCall';

const at = new Date('2026-07-27T15:14:00Z').getTime();

const req: HelpCallRequest = {
  toPhone: '+15559990000', // the caregiver
  patientName: 'Eleanor',
  caregiverName: 'Thomas',
  at,
};

describe('what the caregiver hears', () => {
  const goal = buildHelpCallGoal(req);

  test('leads with the fact, rather than building up to it', () => {
    assert.match(goal, /do not build up to it/i);
    assert.match(goal, /pressed the help button/);
  });

  test('names the patient and the caregiver', () => {
    assert.match(goal, /Eleanor/);
    assert.match(goal, /Thomas/);
  });

  test('includes when it happened', () => {
    // Rendered in the server's locale; just assert a time is present.
    assert.match(goal, /at \d{1,2}:\d{2}/);
  });

  test('forbids speculating about why', () => {
    assert.match(goal, /must not speculate/i);
    assert.match(goal, /Say nothing further about their health/i);
  });

  test('asks for confirmation that someone is going', () => {
    assert.match(goal, /confirm they have heard and are going/i);
  });

  test('tells the caller not to sound alarmed', () => {
    // Panic on the phone does not get anybody there faster.
    assert.match(goal, /Do not sound alarmed/i);
  });

  test('handles voicemail and a stranger answering', () => {
    assert.match(goal, /voicemail/i);
    assert.match(goal, /someone other than the caregiver answers/i);
  });

  test('works without a caregiver name', () => {
    const anon = buildHelpCallGoal({ ...req, caregiverName: undefined });
    assert.match(anon, /the caregiver/);
    assert.doesNotMatch(anon, /undefined/);
  });
});

describe('the result schema asks only what matters', () => {
  test('who it reached, and whether they acknowledged', () => {
    assert.deepEqual(Object.keys(HELP_RESULT_SCHEMA.properties), ['reached', 'acknowledged']);
    assert.deepEqual(HELP_RESULT_SCHEMA.properties.reached.enum, [
      'caregiver',
      'someone_else',
      'voicemail',
      'no_answer',
    ]);
  });
});

describe('repeat presses do not mean repeat calls', () => {
  test('a second press inside the window is suppressed', () => {
    __resetCooldowns();
    const now = Date.now();
    assert.equal(withinCooldown('circle-a', now), false);
    markCalled('circle-a', now);
    // Someone frightened may press the button many times in a minute.
    assert.equal(withinCooldown('circle-a', now + 1_000), true);
    assert.equal(withinCooldown('circle-a', now + 60_000), true);
  });

  test('the cooldown lapses', () => {
    __resetCooldowns();
    const now = Date.now();
    markCalled('circle-a', now);
    assert.equal(withinCooldown('circle-a', now + 11 * 60_000), false);
  });

  test('one family’s cooldown never silences another’s', () => {
    __resetCooldowns();
    const now = Date.now();
    markCalled('circle-a', now);
    assert.equal(withinCooldown('circle-b', now + 1_000), false);
  });
});

describe('it refuses to place a call it should not', () => {
  test('rejects a non-E.164 caregiver number', async () => {
    const { placeHelpCall } = await import('./helpCall');
    await assert.rejects(
      () => placeHelpCall({ ...req, toPhone: '555-1234' }),
      /E\.164/
    );
  });

  test('says plainly when CALL-E is not configured, rather than failing obscurely', async () => {
    const saved = process.env.CALLE_API_KEY;
    delete process.env.CALLE_API_KEY;
    const { placeHelpCall } = await import('./helpCall');
    try {
      await assert.rejects(() => placeHelpCall(req), /CALLE_API_KEY/);
    } finally {
      if (saved === undefined) delete process.env.CALLE_API_KEY;
      else process.env.CALLE_API_KEY = saved;
    }
  });
});
