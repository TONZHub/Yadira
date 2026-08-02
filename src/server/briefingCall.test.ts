// Tests for Ask Yadira by phone.
//
// Two things here can hurt someone, and neither shows up as a stack trace.
//
// The first is disclosure: this call names a person's health and moods down a
// phone line, and phone numbers get answered by neighbours, grandchildren and
// strangers with recycled numbers.
//
// The second is subtler and is the reason this file exists. This number
// already rings for the help button. If a weekly briefing opens ambiguously,
// every caregiver learns that Yadira's voice on their phone might be an
// emergency — and the day it IS one, they answer a beat slower.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBriefingGoal,
  trimBriefing,
  withinBriefingCooldown,
  markBriefed,
  clearBriefingCooldown,
  __resetBriefingCooldowns,
  BRIEFING_RESULT_SCHEMA,
  type BriefingCallRequest,
} from './briefingCall';

const req: BriefingCallRequest = {
  toPhone: '+15559990000',
  patientName: 'Eleanor',
  caregiverName: 'Thomas',
  briefing:
    'Eleanor was calm most days this week. Tuesday afternoon she was restless and asked for her mother twice. She slept well except Thursday. She talked about the lake house a lot.',
  at: new Date('2026-08-02T19:00:00Z').getTime(),
};

describe('the first thing it says is that nothing is wrong', () => {
  const goal = buildBriefingGoal(req);

  test('reassurance comes before the update, not after it', () => {
    const reassure = goal.indexOf('Nothing is wrong');
    const update = goal.indexOf("Then give them the update");
    assert.ok(reassure > -1, 'the call must say nothing is wrong');
    assert.ok(reassure < update, 'it must say so BEFORE delivering anything');
  });

  test('it knows why: this number also rings for the help button', () => {
    // The rationale is in the goal on purpose. A model that understands why
    // it is reassuring will do it better than one following an instruction.
    assert.match(goal, /also rings for Eleanor's help button/i);
    assert.match(goal, /braced for bad news/i);
  });

  test('it is told not to sound alarmed', () => {
    assert.match(goal, /Do not sound alarmed/i);
  });
});

describe('it says nothing until it knows who answered', () => {
  const goal = buildBriefingGoal(req);

  test('identity is confirmed before the patient is named', () => {
    const ask = goal.indexOf('Am I speaking with');
    const name = goal.indexOf('Nothing is wrong');
    assert.ok(ask > -1 && ask < name, 'the gate must come first');
  });

  test('a wrong number learns nothing at all', () => {
    assert.match(goal, /Do NOT say why you are calling/);
    assert.match(goal, /Do NOT name Eleanor/);
    assert.match(goal, /Do NOT mention health, care, or an app/);
    assert.match(goal, /learns only that somebody called/);
  });

  test('it does not ask a stranger to pass the message on', () => {
    assert.match(goal, /Do NOT ask them to pass on a message/);
  });

  test('a voicemail names nobody — it gets played aloud in kitchens', () => {
    const vm = goal.slice(goal.indexOf('VOICEMAIL'));
    assert.match(vm, /do not name Eleanor/i);
    assert.match(vm, /waiting for you in your Yadira app/);
    assert.doesNotMatch(vm, /restless/i);
  });
});

describe('it answers from what it was given, and admits the edge', () => {
  const goal = buildBriefingGoal(req);

  test('the briefing is actually in the goal', () => {
    assert.match(goal, /asked for her mother twice/);
  });

  test('it invites questions', () => {
    assert.match(goal, /anything you'd like to ask me about Eleanor/i);
  });

  test('asked something it cannot see, it says so rather than guessing', () => {
    // The failure this prevents: a caregiver asks whether their mother took
    // her tablets, and a confident "yes" comes back from a model that has no
    // idea. That is worse than no call at all.
    assert.match(goal, /I can't see that from here/);
    assert.match(goal, /Do NOT guess and do NOT infer/);
  });

  test('it is not a doctor and does not pretend to be', () => {
    assert.match(goal, /must not give medical advice/i);
    assert.match(goal, /a question for Eleanor's doctor/i);
  });

  test('a week with nothing logged is not invented', () => {
    const empty = buildBriefingGoal({ ...req, briefing: '   ' });
    assert.match(empty, /not much recorded this week/i);
    assert.match(empty, /Do not invent a week that did not happen/);
  });

  test('works without a caregiver name', () => {
    const anon = buildBriefingGoal({ ...req, caregiverName: undefined });
    assert.match(anon, /the caregiver/);
    assert.doesNotMatch(anon, /undefined/);
  });
});

describe('it lets them go the moment they want to go', () => {
  const goal = buildBriefingGoal(req);

  test('a busy caregiver is not talked over', () => {
    // They are driving, or at work, or a nurse just walked in. Finishing the
    // update over the top of someone is how a helpful call becomes a call
    // they stop answering.
    assert.match(goal, /stop immediately/i);
    assert.match(goal, /Do not finish the update over the top of them/i);
    assert.match(goal, /Do not sound disappointed/i);
  });

  test('it does not promise a callback it cannot schedule', () => {
    assert.match(goal, /you cannot schedule that from here/i);
  });

  test('the call is bounded', () => {
    assert.match(goal, /under three minutes/i);
  });
});

describe('the briefing is trimmed before it is spoken', () => {
  test('short prose is left alone', () => {
    assert.equal(trimBriefing('She was calm this week.'), 'She was calm this week.');
  });

  test('whitespace from the generator is collapsed', () => {
    assert.equal(trimBriefing('She was\n\n  calm.  '), 'She was calm.');
  });

  test('a long briefing is cut at a sentence, not mid-word', () => {
    const long = ('Eleanor was calm on that day and slept through the night. ').repeat(80);
    const out = trimBriefing(long);
    assert.ok(out.length <= 2400, 'nobody wants a nine-minute robocall');
    assert.ok(out.endsWith('.'), 'a spoken briefing must not stop mid-sentence');
  });

  test('empty in, empty out — the goal handles that case itself', () => {
    assert.equal(trimBriefing(''), '');
  });
});

describe('the result schema asks what we would actually act on', () => {
  test('who answered, whether they heard it, and what we could not answer', () => {
    assert.deepEqual(Object.keys(BRIEFING_RESULT_SCHEMA.properties), [
      'reached',
      'heard_briefing',
      'asked_about',
      'unanswered',
    ]);
  });

  test('`unanswered` exists because it is the product backlog', () => {
    // Every question a caregiver asks that the briefing could not answer is a
    // thing the briefing should have contained. That is worth collecting.
    assert.match(BRIEFING_RESULT_SCHEMA.properties.unanswered.description, /backlog/i);
  });
});

describe('a double-tap does not ring twice', () => {
  test('a second request inside the window is suppressed', () => {
    __resetBriefingCooldowns();
    const now = Date.now();
    assert.equal(withinBriefingCooldown('circle-a', now), false);
    markBriefed('circle-a', now);
    assert.equal(withinBriefingCooldown('circle-a', now + 1_000), true);
  });

  test('it lapses, unlike the help call it does not need to hold long', () => {
    __resetBriefingCooldowns();
    const now = Date.now();
    markBriefed('circle-a', now);
    assert.equal(withinBriefingCooldown('circle-a', now + 4 * 60_000), false);
  });

  test('one family never silences another', () => {
    __resetBriefingCooldowns();
    markBriefed('circle-a', Date.now());
    assert.equal(withinBriefingCooldown('circle-b'), false);
  });

  test('a call that never happened does not hold the next one', () => {
    // Same lesson the help call learned: the cooldown is claimed before
    // dialling, so a failure has to release it or the caregiver is told they
    // were called recently when they were not.
    __resetBriefingCooldowns();
    const now = Date.now();
    markBriefed('circle-a', now);
    clearBriefingCooldown('circle-a');
    assert.equal(withinBriefingCooldown('circle-a', now + 1_000), false);
  });
});
