// Tests for the help-button call.
//
// The failure that matters here is not a crash. It is ringing the wrong phone,
// ringing it eleven times, or saying something on the call that should not be
// said to whoever picks up.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHelpCallGoal,
  buildTestCallGoal,
  withinCooldown,
  markCalled,
  clearCooldown,
  cooldownRemaining,
  __resetCooldowns,
  recordOutcome,
  getOutcome,
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

  test('a call that never happened does not hold the cooldown', () => {
    // The cooldown is claimed BEFORE dialling, so a second press arriving
    // while the first is still connecting cannot ring the caregiver twice.
    // When the call then fails outright — bad number, CALL-E unreachable, no
    // key — holding it would answer the next ten minutes of presses with
    // "Already called you recently, so this press did not ring again". That
    // sentence would be false, on the one feature that must never be.
    __resetCooldowns();
    const now = Date.now();
    markCalled('circle-a', now);
    assert.equal(withinCooldown('circle-a', now + 1_000), true);

    clearCooldown('circle-a'); // what the failure path now does

    assert.equal(withinCooldown('circle-a', now + 1_000), false, 'the next press must be able to ring');
    assert.equal(cooldownRemaining('circle-a', now + 1_000), 0);
  });

  test('clearing one family’s cooldown leaves another’s alone', () => {
    __resetCooldowns();
    const now = Date.now();
    markCalled('circle-a', now);
    markCalled('circle-b', now);
    clearCooldown('circle-a');
    assert.equal(withinCooldown('circle-b', now + 1_000), true);
  });

  test('clearing a circle that was never called is harmless', () => {
    __resetCooldowns();
    clearCooldown('never-called');
    assert.equal(withinCooldown('never-called'), false);
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

describe('the test call is unmistakably a test', () => {
  const goal = buildTestCallGoal(req);

  test('says nothing is wrong, early and plainly', () => {
    // A caregiver who hears "Eleanor pressed the help button" as a drill will
    // either panic, or learn that these calls are sometimes not real. The
    // second is worse: this feature cannot afford a caregiver who hesitates.
    assert.match(goal, /This is only a test/);
    assert.match(goal, /nothing is wrong/i);
    const reassure = goal.indexOf('This is only a test');
    const explain = goal.indexOf('If they ever press the help button');
    assert.ok(reassure < explain, 'reassurance must come before the explanation');
  });

  test('never claims the patient pressed anything', () => {
    assert.match(goal, /Never say they pressed anything/);
    assert.doesNotMatch(goal, /Eleanor has pressed/);
  });

  test('still gates on identity before saying anything', () => {
    const ask = goal.indexOf('Am I speaking with');
    const anythingElse = goal.indexOf('This is only a test');
    assert.ok(ask > -1 && ask < anythingElse);
  });

  test('it does NOT tell them to save the number, because there is none to save', () => {
    // Three consecutive test calls arrived from three different area codes —
    // 504, 832, 214. CALL-E rotates the caller ID, so "save this as a contact"
    // was advice that could not work, and worse, advice that would leave a
    // caregiver believing they were covered when nothing had changed.
    assert.doesNotMatch(goal, /worth saving as a contact/i);
    assert.doesNotMatch(goal, /save (this|the) number/i);
  });

  test('it tells them the thing that actually protects them instead', () => {
    // A phone setting works whatever number calls, which is the only kind of
    // advice that survives a rotating caller ID.
    assert.match(goal, /different number each time/i);
    assert.match(goal, /silences unknown callers/i);
  });

  test('is explicitly not to be delivered in an alarmed tone', () => {
    assert.match(goal, /not an urgent one/i);
  });
});

describe('when the caregiver says they cannot get there', () => {
  // From a live call: asked "are you able to get to them?", answered no, and
  // the call said "thank you, bye." That is the moment the patient is LEAST
  // likely to get help, and it was the moment the call did least.

  const goal = buildHelpCallGoal({
    toPhone: '+15551234567',
    patientName: 'Eleanor',
    caregiverName: 'Thomas',
    at: Date.now(),
  });

  test('it does not simply thank them and hang up', () => {
    assert.match(goal, /do not simply thank them and hang up/i);
  });

  test('it accepts the answer instead of pressing', () => {
    assert.match(goal, /"no" is an answer, not a failure/i);
    assert.match(goal, /do not sound disappointed and do not ask again/i);
  });

  test('it asks the one question that could still produce a person', () => {
    assert.match(goal, /anyone else nearby who could look in on them/i);
  });

  test('it promises only what the app can actually do', () => {
    // "I'll stay with them" is true — the companion is on their device. It
    // must not offer to phone the person they name, because it cannot.
    assert.match(goal, /I'll stay with Eleanor and keep them company/i);
    assert.match(goal, /do not offer to call that person, because you cannot/i);
  });

  test('emergency services are offered once, and the choice stays theirs', () => {
    assert.match(goal, /if you're worried about their safety, please call emergency services/i);
    assert.match(goal, /their judgement, not yours/i);
    // Never a diagnosis or an instruction to call — this is not a medical device.
    assert.doesNotMatch(goal, /you (should|must) call (an ambulance|911|emergency)/i);
  });

  test('the branch is still bounded in length', () => {
    assert.match(goal, /under ninety seconds/i);
  });
});

describe('"cannot come" and "did not say" are different answers', () => {
  // They used to collapse into one sentence. They are not the same situation:
  // one means nobody is coming, the other means we do not know — and the
  // PATIENT's device reads this to decide what the companion may promise.

  test('the schema still offers all three', () => {
    assert.deepEqual(HELP_RESULT_SCHEMA.properties.acknowledged.enum, ['yes', 'no', 'unknown']);
  });

  test('an outcome carries the answer through to the patient side', () => {
    __resetCooldowns();
    recordOutcome('circle-a', 'placed', 'Thomas was reached but said they cannot get to Eleanor right now.', 'no');
    assert.equal(getOutcome('circle-a')?.canGetThere, 'no');
  });

  test('an outcome with no answer does not claim one', () => {
    __resetCooldowns();
    recordOutcome('circle-b', 'placed', 'Calling you now.');
    assert.equal(getOutcome('circle-b')?.canGetThere, undefined);
  });
});
