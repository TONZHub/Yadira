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
import { isE164, maskPhone } from './calle';

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
 * What the caregiver hears. Short on purpose: somebody answering a phone at
 * 3am needs one fact and one instruction, not a briefing.
 */
export function buildHelpCallGoal(req: HelpCallRequest): string {
  const when = new Date(req.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const who = req.caregiverName ? `${req.caregiverName}, ` : '';
  return [
    `Call ${req.caregiverName || 'the caregiver'} with an urgent but calm message. Say it in the first sentence — do not build up to it.`,
    `The message: "${who}this is Yadira. ${req.patientName} pressed the help button at ${when} and is asking for you."`,
    'Speak clearly and calmly. Do not sound alarmed — panic does not help anyone get there faster.',
    'Say nothing further about their health, their condition, or anything they said. You do not know why they pressed it, and you must not speculate.',
    'Ask the person to confirm they have heard and are going to them.',
    'If it goes to voicemail, leave the same short message and say the app also has an alert waiting.',
    'If someone other than the caregiver answers, give the same message only if they say they are with the family; otherwise ask them to pass on that the caregiver should check the Yadira app.',
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
