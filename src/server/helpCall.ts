// The help-button call — a ringing phone, because a banner can be missed.
// ------------------------------------------------------------------
// When the patient presses "I need my caregiver", the app already raises an
// in-app alert. That alert is only as good as somebody looking at a screen,
// and the whole reason the button exists is that the person pressing it cannot
// wait for that. So the button also rings the caregiver's phone.
//
// This is deliberately NOT the check-in call, and the differences all point the
// same way:
//   • It fires immediately. No "wait and see if they noticed" delay — the
//     button is a person asking for a human, not telemetry.
//   • It calls the CAREGIVER, never the patient. Two different numbers, and
//     dialling the wrong one would mean telling a frightened person that a
//     frightened person needs help.
//   • The voice does not have to be Yadira's. A caregiver knows what the call
//     is; the phone voice being someone else's is a non-issue here, which is
//     exactly why this works when the patient-facing call does not.
//   • It says as little as possible: who, what, when. Not a health report to
//     whoever happens to answer.

import { hasApiKey, placeCallAndWait } from './calleApi';
import { localeFor } from './calleRegions';
import { isE164, maskPhone } from './phone';

export interface HelpCallRequest {
  /** The CAREGIVER's number. Never the patient's. */
  toPhone: string;
  patientName: string;
  caregiverName?: string;
  /** When the button was pressed (ms epoch). */
  at: number;
  region?: string;
  language?: string;
}

export interface HelpCallResult {
  callId: string;
  reached: boolean;
  acknowledged: boolean;
  phone: string;
  summary: string;
}

/**
 * What the caregiver hears.
 *
 * Identity first, message second. This ordering is the whole design and it
 * costs about a second: the call names a vulnerable person and says they have
 * asked for help, and a phone number will eventually be answered by a
 * neighbour, a child, a colleague, or a stranger with a recycled number. Ask
 * who is there BEFORE saying any of it, and if it is not them, say nothing at
 * all and hang up. A wrong number should learn only that somebody called.
 *
 * Short on purpose after that: somebody answering a phone at 3am needs one
 * fact and one instruction, not a briefing.
 */
export function buildHelpCallGoal(req: HelpCallRequest): string {
  const caregiver = req.caregiverName || 'the caregiver';
  return [
    `Call ${caregiver}. Before you say anything about why you are calling, confirm you are speaking to the right person.`,
    '',
    'Follow these steps in order:',
    `1. Open with exactly this: "Hello, this is Yadira. Am I speaking with ${caregiver}?"`,
    `2. If they say no, or they are evasive, or you are not certain it is ${caregiver}: say only "Sorry to have troubled you. Goodbye," and end the call. Do NOT say why you are calling. Do NOT name anyone. Do NOT ask them to pass on a message. A wrong number learns only that somebody called.`,
    `3. Once they confirm they are ${caregiver}, say: "${req.patientName} has pressed their help button and is asking for you. Please go to them when you can."`,
    '4. Ask them to confirm they have heard you.',
    '5. Say thank you and end the call.',
    '',
    'Throughout:',
    'Speak clearly and calmly. Do not sound alarmed — panic does not help anyone get there faster.',
    'Say nothing about their health, their condition, or anything they said. You do not know why they pressed it, and you must not speculate.',
    `If the call reaches voicemail, do not name ${req.patientName} and do not say why you are calling — a voicemail can be played aloud to a room. Leave only: "This is Yadira calling for ${caregiver}. There is an alert waiting in your Yadira app. Please check it now."`,
    'Keep the whole call under a minute.',
  ].join('\n');
}

/** Tiny schema: this call has exactly two questions to answer. */
export const HELP_RESULT_SCHEMA = {
  type: 'object',
  required: ['reached'],
  properties: {
    reached: {
      type: 'string',
      enum: ['caregiver', 'someone_else', 'voicemail', 'no_answer'],
      description: 'Who the message actually reached.',
    },
    acknowledged: {
      type: 'string',
      enum: ['yes', 'no', 'unknown'],
      description: 'Did they confirm they heard and are going to the patient?',
    },
  },
} as const;

/**
 * Repeat presses must not mean repeat calls. Someone frightened and confused
 * may press the button many times in a minute; the caregiver needs one call,
 * not eleven, and each one costs real money.
 */
const lastCallAt = new Map<string, number>();
const COOLDOWN_MS = Number(process.env.HELP_CALL_COOLDOWN_MS || 10 * 60_000);

export function withinCooldown(circle: string, now = Date.now()): boolean {
  const last = lastCallAt.get(circle);
  return last !== undefined && now - last < COOLDOWN_MS;
}

export function markCalled(circle: string, now = Date.now()): void {
  lastCallAt.set(circle, now);
}

/** Test seam — the cooldown is process-wide state. */
export function __resetCooldowns(): void {
  lastCallAt.clear();
}

export async function placeHelpCall(req: HelpCallRequest): Promise<HelpCallResult> {
  if (!isE164(req.toPhone)) {
    throw new Error("The caregiver's phone number must be in E.164 format (e.g. +15551234567).");
  }
  if (!hasApiKey()) {
    throw new Error('CALL-E is not configured (set CALLE_API_KEY), so the help button cannot ring anyone.');
  }

  const result = await placeCallAndWait({
    task: buildHelpCallGoal(req),
    phone: req.toPhone,
    region: req.region,
    locale: localeFor(req.region, req.language),
    recipientResultSchema: HELP_RESULT_SCHEMA as unknown as Record<string, any>,
    // One press is one call: a retried request inside the same minute must not
    // ring the caregiver twice.
    idempotencyKey: `yadira-help-${req.toPhone}-${Math.floor(req.at / 60_000)}`,
    metadata: { product: 'yadira', workflow: 'help-button' },
    // A help call that is still ringing after four minutes has failed at its
    // job; stop waiting and let the caller log it.
    maxWaitMs: 4 * 60_000,
    pollIntervalMs: 3_000,
  });

  const structured = result.recipientResult || {};
  const reachedWho = String(structured.reached || '');
  const reached = reachedWho ? reachedWho === 'caregiver' : result.turns.some((t) => String(t.speaker).includes('user'));
  const acknowledged = String(structured.acknowledged || '') === 'yes';

  const summary = reached
    ? acknowledged
      ? `${req.caregiverName || 'The caregiver'} was reached and is going to ${req.patientName}.`
      : `${req.caregiverName || 'The caregiver'} was reached but did not confirm.`
    : reachedWho === 'voicemail'
      ? 'The call reached voicemail; a message was left.'
      : reachedWho === 'someone_else'
        ? 'Someone else answered the phone.'
        : 'The caregiver could not be reached by phone.';

  return { callId: result.callId, reached, acknowledged, phone: maskPhone(req.toPhone), summary };
}
