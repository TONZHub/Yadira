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

  test('CONFIRMS WHO IS THERE BEFORE DISCLOSING ANYTHING', () => {
    // The ordering is the whole design. A phone number will eventually be
    // answered by a neighbour, a child, or a stranger with a recycled number,
    // and this call names a vulnerable person and says they asked for help.
    const askIdentity = goal.indexOf('Am I speaking with');
    const nameThePatient = goal.indexOf('Eleanor has pressed');
    assert.ok(askIdentity > -1, 'the call must ask who it is speaking to');
    assert.ok(nameThePatient > -1, 'the call must eventually deliver the message');
    assert.ok(askIdentity < nameThePatient, 'identity must be confirmed BEFORE the patient is named');
  });

  test('a wrong number is told nothing at all', () => {
    assert.match(goal, /Do NOT say why you are calling/);
    assert.match(goal, /Do NOT name anyone/);
    assert.match(goal, /learns only that somebody called/);
  });

  test('does not ask a stranger to pass the message on', () => {
    // The previous version did exactly this, which is a disclosure with extra
    // steps.
    assert.match(goal, /Do NOT ask them to pass on a message/);
  });

  test('names the patient and the caregiver', () => {
    assert.match(goal, /Eleanor/);
    assert.match(goal, /Thomas/);
  });

  test('asks them to go to the patient', () => {
    assert.match(goal, /Please go to them/);
  });

  test('a voicemail names nobody — it can be played aloud to a room', () => {
    const vm = goal.slice(goal.indexOf('voicemail'));
    assert.match(vm, /do not name Eleanor/i);
    assert.match(vm, /alert waiting in your Yadira app/);
  });

  test('forbids speculating about why', () => {
    assert.match(goal, /must not speculate/i);
    assert.match(goal, /Say nothing about their health/i);
  });

  test('asks whether they can go — a question, not an order', () => {
    // "Confirm you are going to her" read as an instruction being issued to
    // someone who had just been woken up. It is their family member; they know
    // their own situation.
    assert.match(goal, /Are you able to get to them\?/);
    assert.match(goal, /as a question, not an instruction/i);
    assert.match(goal, /do not tell them what to do/i);
  });

  test('is told to sound like a person, not a system', () => {
    assert.match(goal, /not a system issuing an order/i);
  });

  test('tells the caller not to sound alarmed', () => {
    // Panic on the phone does not get anybody there faster.
    assert.match(goal, /Do not sound alarmed/i);
  });

  test('a stranger is handled by the identity gate, not by a later branch', () => {
    // The old script delivered the message and only then asked who it was
    // talking to. Nothing downstream can un-say that, so the gate is the
    // handling.
    assert.match(goal, /Am I speaking with/);
    assert.match(goal, /or you are not certain/i);
    assert.match(goal, /Sorry to have troubled you/);
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
