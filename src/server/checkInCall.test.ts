// Tests for the check-in call.
//
// The stakes here are different from the chat companion's: a wrong number
// means a stranger's phone rings with a synthetic voice, and a missed distress
// signal means nobody goes to the house. Both paths are tested.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isE164, maskPhone, inspectPlan, pickField, type CallPlan, type CallStatus } from './calle';
import { buildCallGoal, readMood, readDistress, summariseCall, type CheckInCallRequest } from './checkInCall';

const req: CheckInCallRequest = {
  toPhone: '+15551234567',
  patientName: 'Eleanor',
  caregiverName: 'Thomas',
  timezone: 'America/New_York',
};

const plan = (targets: string[]): CallPlan => ({
  planId: 'plan_1',
  confirmToken: 'token_1',
  targets,
  raw: {},
});

const status = (activity: { speaker: 'agent' | 'recipient' | 'system'; text: string }[], answered = true): CallStatus => ({
  runId: 'run_1',
  state: 'completed',
  answered,
  activity,
  raw: {},
});

const said = (text: string) => status([{ speaker: 'recipient', text }]);

describe('phone numbers are validated, never inferred', () => {
  test('accepts E.164', () => assert.equal(isE164('+15551234567'), true));
  for (const bad of ['5551234567', '+1 555 123 4567', '', '+0123456789', 'not a number']) {
    test(`rejects ${JSON.stringify(bad)}`, () => assert.equal(isE164(bad), false));
  }
  test('masks a number for logs and API responses', () => {
    assert.equal(maskPhone('+15551234567'), '+1555***4567');
    assert.doesNotMatch(maskPhone('+15551234567'), /1234/);
  });
});

describe('inspectPlan — the gate before dialling', () => {
  test('allows a plan that targets the configured number', () => {
    assert.equal(inspectPlan(plan(['+15551234567']), '+15551234567').ok, true);
  });

  test('REFUSES a plan that targets a different number', () => {
    const verdict = inspectPlan(plan(['+15559999999']), '+15551234567');
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /unexpected number/);
    // The wrong number must not be echoed in full into logs.
    assert.doesNotMatch(verdict.reason, /\+15559999999/);
  });

  test('REFUSES a plan that would dial more than one number', () => {
    assert.equal(inspectPlan(plan(['+15551234567', '+15551112222']), '+15551234567').ok, false);
  });

  test('refuses a plan with no confirmation token', () => {
    assert.equal(inspectPlan({ ...plan(['+15551234567']), confirmToken: '' }, '+15551234567').ok, false);
  });

  test('proceeds, and says so, when CALL-E echoes no destination', () => {
    const verdict = inspectPlan(plan([]), '+15551234567');
    assert.equal(verdict.ok, true);
    assert.match(verdict.reason, /did not echo/);
  });
});

describe('the real @call-e/cli auth status payload', () => {
  // Captured from `calle auth status` against @call-e/cli, so a field rename
  // upstream fails here rather than at the moment someone needs a call placed.
  const signedOut = {
    server_url: 'https://example.test/mcp/openagent_oauth',
    cache_path: '/root/.calle-mcp/cli/abc/token.json',
    cache_exists: false,
    pending_exists: false,
    usable: false,
    expires_at: null,
    pending_status: null,
    pending_login_url: null,
  };

  test('"usable" is the field that decides authorization', () => {
    assert.equal(pickField(signedOut, ['usable', 'is_usable']), false);
    assert.equal(pickField({ ...signedOut, usable: true }, ['usable']), true);
  });

  test('a never-logged-in machine is distinguishable from an expired token', () => {
    assert.equal(pickField(signedOut, ['cache_exists']), false);
    assert.equal(pickField({ ...signedOut, cache_exists: true, expires_at: '2026-01-01T00:00:00Z' }, ['expires_at']), '2026-01-01T00:00:00Z');
  });

  test('a null field is skipped so the fallback chain keeps looking', () => {
    // expires_at is null when nobody has ever logged in; treating that as a
    // present value would stop the search at a field that says nothing.
    assert.equal(pickField(signedOut, ['expires_at', 'cache_path']), '/root/.calle-mcp/cli/abc/token.json');
  });
});

describe('pickField tolerates CALL-E response shapes', () => {
  test('finds a top-level snake_case field', () => {
    assert.equal(pickField({ plan_id: 'p1' }, ['plan_id', 'planId']), 'p1');
  });
  test('finds a camelCase field', () => {
    assert.equal(pickField({ planId: 'p1' }, ['plan_id', 'planId']), 'p1');
  });
  test('finds a field nested under data', () => {
    assert.equal(pickField({ data: { plan_id: 'p1' } }, ['plan_id']), 'p1');
  });
  test('returns undefined when absent', () => {
    assert.equal(pickField({ other: 1 }, ['plan_id']), undefined);
  });
});

describe('the call brief', () => {
  const goal = buildCallGoal({ ...req, threadToPickUp: 'the roses by the back gate' });

  test('names who is calling and who is being called', () => {
    assert.match(goal, /Yadira/);
    assert.match(goal, /Eleanor/);
  });
  test('forbids memory testing', () => assert.match(goal, /never ask "do you remember"/i));
  test('forbids correcting their reality', () => assert.match(goal, /Never correct them/i));
  test('forbids medical advice outright', () => assert.match(goal, /no medical advice/i));
  test('handles somebody else picking up, without disclosing health', () => {
    assert.match(goal, /share no details about their health/i);
  });
  test('handles voicemail without leaving health information', () => {
    assert.match(goal, /voicemail/i);
    assert.match(goal, /Leave no health information/i);
  });
  test('carries the thread from last time', () => assert.match(goal, /roses by the back gate/));
});

describe('reading the patient s own words', () => {
  test('hears worry', () => assert.equal(readMood(said('I am a bit worried today').activity), 'anxious'));
  test('hears missing someone', () => assert.equal(readMood(said('I do miss him so').activity), 'sad'));
  test('hears settledness', () => assert.equal(readMood(said('Oh, I am quite well thank you').activity), 'peaceful'));
  test('distress outranks a polite "I am fine"', () => {
    assert.equal(readMood(said('I am fine, just a bit frightened').activity), 'anxious');
  });
  test('returns null rather than guessing', () => {
    assert.equal(readMood(said('The postman came at ten').activity), null);
  });
  test('ignores what the agent said — only the patient is interpreted', () => {
    const s = status([{ speaker: 'agent', text: 'Are you worried, dear?' }]);
    assert.equal(readMood(s.activity), null);
  });
});

describe('distress detection', () => {
  const shouldFire: [string, RegExp][] = [
    ['Please help me', /asked for help/],
    ['I fell this morning', /fall/],
    ["I can't get up", /unable to breathe or get up/],
    ["I don't know where I am", /did not know where they were/],
    ['I am frightened', /frightened/],
  ];
  for (const [utterance, expected] of shouldFire) {
    test(`fires on: ${utterance}`, () => {
      assert.match(readDistress(said(utterance).activity).join(' '), expected);
    });
  }

  test('stays quiet on an ordinary chat', () => {
    assert.deepEqual(readDistress(said('The garden is looking lovely this week').activity), []);
  });
});

describe('summariseCall — what the caregiver is told', () => {
  test('a calm call needs nobody', () => {
    const result = summariseCall(said('I am quite well, thank you'), req);
    assert.equal(result.needsCaregiver, false);
    assert.equal(result.mood, 'peaceful');
    assert.match(result.summary, /Eleanor answered/);
  });

  test('distress escalates', () => {
    const result = summariseCall(said('Please help me, I fell'), req);
    assert.equal(result.needsCaregiver, true);
    assert.match(result.summary, /needs you/);
  });

  test('a window of clarity escalates, using the same tripwire as the chat', () => {
    const result = summariseCall(said('I know I have dementia, you know'), req);
    assert.equal(result.lucidity, 'self-awareness');
    assert.equal(result.needsCaregiver, true);
  });

  test('an unanswered call says so and leaks nothing', () => {
    const result = summariseCall(status([], false), req);
    assert.equal(result.answered, false);
    assert.match(result.summary, /did not answer/);
    assert.match(result.summary, /No message was left about their health/);
  });

  test('never returns the full phone number', () => {
    const result = summariseCall(said('Hello dear'), req);
    assert.equal(result.phone, '+1555***4567');
    assert.doesNotMatch(JSON.stringify(result), /\+15551234567/);
  });
});
