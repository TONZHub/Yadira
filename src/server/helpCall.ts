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
  /**
   * Whether they said they can get there — kept as three states, not two.
   *
   * "No" and "didn't say" used to collapse into the same sentence, and they
   * are not the same situation at all: one means nobody is coming, the other
   * means we do not know. The patient's own device reads this, so flattening
   * it is how Yadira ends up telling someone their son is on his way after
   * he has said he cannot come.
   */
  canGetThere: 'yes' | 'no' | 'unknown';
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
    `3. Once they confirm they are ${caregiver}, say: "${req.patientName} has pressed the help button and is asking for you. Please go to them when you can."`,
    `4. Then ask, gently and once: "Are you able to get to them?" Ask it as a question, not an instruction. Do not press for a commitment, do not repeat it, and do not tell them what to do — they may have been asleep, and they know their own situation better than you do.`,
    '5. If they say yes: thank them warmly and end the call.',
    `6. If they say NO, or they are unsure, this is the moment that matters most — do not simply thank them and hang up. They may be at work, driving, or three hours away, and "no" is an answer, not a failure. Do not sound disappointed and do not ask again. Instead, in this order and briefly:`,
    `   a. Accept it plainly: "That's alright."`,
    `   b. Ask one question, once: "Is there anyone else nearby who could look in on them?" If they name someone, thank them and move on — do not ask for a number and do not offer to call that person, because you cannot.`,
    `   c. Then tell them the one thing that is actually true and worth hearing: "I'll stay with ${req.patientName} and keep them company until someone can get there." Say it as a fact, because it is one — the companion is on their device and will keep talking with them.`,
    `   d. Last, once, without pressing: "If you're worried about their safety, please call emergency services." State it and stop. Whether to call is their judgement, not yours — you do not know what is happening in that room and you must not decide for them.`,
    '7. Thank them warmly and end the call.',
    '',
    'Throughout:',
    'Sound like a person passing on a message, not a system issuing an order. Warm, unhurried, ordinary.',
    'Speak clearly and calmly. Do not sound alarmed — panic does not help anyone get there faster.',
    'Say nothing about their health, their condition, or anything they said. You do not know why they pressed it, and you must not speculate.',
    `If the call reaches voicemail, do not name ${req.patientName} and do not say why you are calling — a voicemail can be played aloud to a room. Leave only: "This is Yadira calling for ${caregiver}. There is an alert waiting in your Yadira app. Please check it now."`,
    'Keep the whole call under a minute — under ninety seconds if they said they cannot get there, since that branch has more to say.',
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

/**
 * Give the cooldown back after a call that never happened.
 *
 * The cooldown has to be claimed BEFORE dialling — the call is
 * fire-and-forget, so a second press arriving while the first is still
 * connecting would otherwise ring the caregiver twice. But when the call then
 * fails outright (bad number, CALL-E unreachable, no key), holding the
 * cooldown means the next ten minutes of presses are answered with "Already
 * called you recently, so this press did not ring again" — which is false,
 * on the one feature in this app that must never say something false.
 */
export function clearCooldown(circle: string): void {
  lastCallAt.delete(circle);
}

/** Test seam — the cooldown is process-wide state. */
export function __resetCooldowns(): void {
  lastCallAt.clear();
  lastOutcome.clear();
}

// ---------------------------------------------------------------- outcomes
//
// The call is fire-and-forget so the patient never waits on a phone network,
// and every way it can decline to ring is silent by design. That is right for
// the patient and wrong for the caregiver, who is the one person who needs to
// know their phone is not going to ring. Record what happened, per circle, so
// the settings card can say so in a sentence instead of leaving them to guess.

export type HelpCallStatus =
  | 'placed'
  | 'no_number'
  | 'not_premium'
  | 'cooldown'
  | 'failed';

export interface HelpCallOutcome {
  status: HelpCallStatus;
  /** One sentence a caregiver can act on. Never contains a full number. */
  detail: string;
  at: number;
  /** Read by the PATIENT's device, so it never promises help that is not coming. */
  canGetThere?: 'yes' | 'no' | 'unknown';
}

const lastOutcome = new Map<string, HelpCallOutcome>();

export function recordOutcome(
  circle: string,
  status: HelpCallStatus,
  detail: string,
  canGetThere?: 'yes' | 'no' | 'unknown'
): void {
  lastOutcome.set(circle, { status, detail, at: Date.now(), canGetThere });
}

export function getOutcome(circle: string): HelpCallOutcome | null {
  return lastOutcome.get(circle) ?? null;
}

/** How long until this circle can trigger another call, in ms. 0 when ready. */
export function cooldownRemaining(circle: string, now = Date.now()): number {
  const last = lastCallAt.get(circle);
  if (last === undefined) return 0;
  return Math.max(0, COOLDOWN_MS - (now - last));
}

/**
 * The same call, declared as a test.
 *
 * A test call must be unmistakably a test within its first breath. A caregiver
 * who hears "Eleanor pressed the help button" as a drill will either panic or —
 * far worse in the long run — learn that these calls are sometimes not real.
 * The one thing this feature cannot afford is a caregiver who hesitates because
 * the last one was a test.
 */
export function buildTestCallGoal(req: HelpCallRequest): string {
  const caregiver = req.caregiverName || 'the caregiver';
  return [
    `Call ${caregiver} to run a test of their alert system. Nothing is wrong. Say so early and clearly.`,
    '',
    'Follow these steps in order:',
    `1. Open with exactly this: "Hello, this is Yadira. Am I speaking with ${caregiver}?"`,
    `2. If they say no, or you are not certain it is ${caregiver}: say only "Sorry to have troubled you. Goodbye," and end the call. Say nothing else and name nobody.`,
    `3. Once they confirm, say immediately: "This is only a test — nothing is wrong, and ${req.patientName} is fine. You asked to hear what a help-button call sounds like."`,
    '4. Then say: "If they ever press the help button, I will call you like this and tell you they are asking for you."',
    '5. Tell them this number is worth saving as a contact, so a real call is not silenced as an unknown number.',
    '6. Thank them and end the call.',
    '',
    'Throughout:',
    'Sound calm and ordinary. This is a reassuring call, not an urgent one — do not use an alarmed tone at any point.',
    `Never suggest anything is wrong with ${req.patientName}. Never say they pressed anything.`,
    'If the call reaches voicemail, leave only: "This is Yadira. That was a test of your alert calls, and nothing is wrong."',
    'Keep the whole call under a minute.',
  ].join('\n');
}

export async function placeHelpCall(
  req: HelpCallRequest,
  opts: { test?: boolean } = {}
): Promise<HelpCallResult> {
  if (!isE164(req.toPhone)) {
    throw new Error("The caregiver's phone number must be in E.164 format (e.g. +15551234567).");
  }
  if (!hasApiKey()) {
    throw new Error('CALL-E is not configured (set CALLE_API_KEY), so the help button cannot ring anyone.');
  }

  const result = await placeCallAndWait({
    task: opts.test ? buildTestCallGoal(req) : buildHelpCallGoal(req),
    phone: req.toPhone,
    region: req.region,
    locale: localeFor(req.region, req.language),
    recipientResultSchema: HELP_RESULT_SCHEMA as unknown as Record<string, any>,
    // One press is one call: a retried request inside the same minute must not
    // ring the caregiver twice.
    idempotencyKey: `yadira-${opts.test ? 'test' : 'help'}-${req.toPhone}-${Math.floor(req.at / 60_000)}`,
    metadata: { product: 'yadira', workflow: opts.test ? 'help-button-test' : 'help-button' },
    // A help call that is still ringing after four minutes has failed at its
    // job; stop waiting and let the caller log it.
    maxWaitMs: 4 * 60_000,
    pollIntervalMs: 3_000,
  });

  const structured = result.recipientResult || {};
  const reachedWho = String(structured.reached || '');
  const reached = reachedWho ? reachedWho === 'caregiver' : result.turns.some((t) => String(t.speaker).includes('user'));
  const rawAck = String(structured.acknowledged || '').toLowerCase();
  const canGetThere: 'yes' | 'no' | 'unknown' =
    rawAck === 'yes' ? 'yes' : rawAck === 'no' ? 'no' : 'unknown';
  const acknowledged = canGetThere === 'yes';

  if (opts.test) {
    return {
      callId: result.callId,
      reached,
      acknowledged,
      phone: maskPhone(req.toPhone),
      canGetThere,
      summary: reached
        ? 'Test call answered — this is how a real one will reach you.'
        : reachedWho === 'voicemail'
          ? 'Test call went to voicemail. A real one would too, so keep the app to hand.'
          : 'Test call was not answered. Worth checking the number, and whether unknown callers are silenced.',
    };
  }

  const who = req.caregiverName || 'The caregiver';
  const summary = reached
    ? canGetThere === 'yes'
      ? `${who} was reached and is going to ${req.patientName}.`
      : canGetThere === 'no'
        // The one outcome that needs the caregiver to do something else. Said
        // plainly rather than softened into "did not confirm".
        ? `${who} was reached but said they cannot get to ${req.patientName} right now.`
        : `${who} was reached but did not say whether they can get there.`
    : reachedWho === 'voicemail'
      ? 'The call reached voicemail; a message was left.'
      : reachedWho === 'someone_else'
        ? 'Someone else answered the phone.'
        : 'The caregiver could not be reached by phone.';

  return {
    callId: result.callId,
    reached,
    acknowledged,
    canGetThere,
    phone: maskPhone(req.toPhone),
    summary,
  };
}
