// The check-in call — Yadira on the telephone.
// ------------------------------------------------------------------
// This is the Yadira-shaped layer on top of the generic CALL-E client: what
// Yadira is asked to accomplish on the call, and what the caregiver gets back
// when it ends.
//
// A phone call is NOT the chat companion piped through a speaker. The
// differences are the whole design:
//   • There is no screen, no help button, and no caregiver glancing over.
//     Nobody is in the room. Everything the tablet solves with a tap has to
//     be solved with a voice or escalated to a person.
//   • Turn-taking is real. A long reply on a screen is skimmable; a long reply
//     on a phone is a monologue at someone who has lost the thread.
//   • The call may reach a voicemail, a neighbour, or a care worker. It must
//     degrade gracefully and never disclose health information to whoever
//     happens to pick up.
//
// Two deliberate exclusions, both of which are safety decisions rather than
// scope decisions:
//   • Vivid mode never goes down the phone line. On the tablet, the caregiver
//     consented and is nearby. A synthetic voice of a dead spouse calling
//     someone sitting alone is a different act, and this product should not
//     make it by accident.
//   • No medical content. Not doses, not symptoms, not reassurance about
//     either. Distress escalates to a human being.

import { detectLucidity, type LucidityKind } from './lucidity';
import { placeOneCall, maskPhone, isE164, type CallActivity, type CallStatus } from './calle';
import { hasApiKey, placeCallAndWait, type CalleCallResult } from './calleApi';

export type CheckInMood = 'peaceful' | 'anxious' | 'restless' | 'sad';

export interface CheckInCallRequest {
  toPhone: string;
  patientName: string;
  caregiverName?: string;
  /** A warm thread from the persona file — what she was talking about last time. */
  threadToPickUp?: string;
  /** Two or three of the family's memories, for something real to talk about. */
  memoryHints?: string[];
  timezone: string;
  language?: string;
  region?: string;
}

export interface CheckInCallResult {
  runId: string;
  answered: boolean;
  state: string;
  /** Masked — the full number is never returned to a client. */
  phone: string;
  mood: CheckInMood | null;
  /** Set when the patient's own words showed a window of real clarity. */
  lucidity: LucidityKind | null;
  /** True when the call needs a human now, not at the next visit. */
  needsCaregiver: boolean;
  reasons: string[];
  /** One or two plain sentences for the caregiver's dashboard. */
  summary: string;
  transcript: CallActivity[];
}

// ---------------------------------------------------------------- the brief

/**
 * The goal handed to CALL-E. It is written as instructions to a person making
 * a call, because that is what CALL-E plans against — not as a chat system
 * prompt. Kept deliberately short: a long brief dilutes the rules that matter.
 */
export function buildCallGoal(req: CheckInCallRequest): string {
  const lines: string[] = [];
  lines.push(
    `Make a short, warm check-in call to ${req.patientName}, who is living with dementia. You are Yadira, their companion. This is a friendly call, not an interview.`
  );
  lines.push(
    `Open by saying who you are and why you are calling. ${req.patientName} may not remember the last call — that is fine, never point it out.`
  );
  lines.push(
    'Speak in short sentences, one idea at a time, and leave generous silences. Let them set the pace. If they repeat themselves, answer with the same warmth as the first time.'
  );
  lines.push(
    'Find out gently how they are feeling today and whether anything is worrying them. Ask about feelings, never test their memory, and never ask "do you remember".'
  );
  if (req.threadToPickUp) {
    lines.push(`If it fits naturally, pick up this thread from last time: ${req.threadToPickUp}`);
  }
  if (req.memoryHints?.length) {
    lines.push(`Things they love talking about: ${req.memoryHints.slice(0, 3).join('; ')}.`);
  }
  lines.push(
    'Never correct them about what year it is, where they are, or who is alive. If they reach for someone who has died, meet the feeling rather than the fact.'
  );
  lines.push(
    'Give no medical advice of any kind. Do not discuss medication, doses, symptoms, or treatment, even if asked. Say a person will help with that.'
  );
  lines.push(
    `If someone other than ${req.patientName} answers, say only that Yadira is calling to say hello, share no details about their health, and end the call politely.`
  );
  lines.push(
    'If they sound frightened, in pain, unsafe, or ask for help, stay calm and warm, tell them someone who loves them is being told right now, and end the call gently.'
  );
  lines.push(
    'If the call reaches voicemail, leave a short friendly message saying Yadira called to say hello and will try again. Leave no health information.'
  );
  lines.push('Keep the whole call under about four minutes. End warmly.');
  return lines.join('\n');
}

// ------------------------------------------------------------- the readout

/** What the patient themselves said — the only part we interpret. */
function recipientText(activity: CallActivity[]): string {
  return activity
    .filter((a) => a.speaker === 'recipient')
    .map((a) => a.text)
    .join(' ');
}

const MOOD_CUES: { mood: CheckInMood; patterns: RegExp[] }[] = [
  {
    mood: 'sad',
    patterns: [/\bmiss(ing)?\b/i, /\blonely\b/i, /\balone\b/i, /\bcry(ing)?\b/i, /\bsad\b/i],
  },
  {
    mood: 'anxious',
    patterns: [/\bworri(ed|es)\b/i, /\bafraid\b/i, /\bscared\b/i, /\bfrightened\b/i, /\bnervous\b/i, /\banxious\b/i],
  },
  {
    mood: 'restless',
    patterns: [/\brestless\b/i, /\bcan'?t settle\b/i, /\bpacing\b/i, /\bagitated\b/i, /\bcan'?t sleep\b/i],
  },
  {
    mood: 'peaceful',
    patterns: [/\b(quite |very |really )?(well|fine|good|lovely|happy|content|peaceful)\b/i, /\ball right\b/i],
  },
];

/**
 * A first-pass mood read from the patient's own words. Deliberately keyword
 * based and deliberately conservative: this feeds the caregiver's chart, and a
 * confidently wrong number is worse than an honest blank. Returns null when
 * nothing clear was said, and the caregiver sees "not recorded" rather than a
 * guess.
 */
export function readMood(activity: CallActivity[]): CheckInMood | null {
  const text = recipientText(activity);
  if (!text.trim()) return null;
  // Distress wins over contentment when someone says both ("I'm fine, just worried").
  for (const { mood, patterns } of MOOD_CUES) {
    if (patterns.some((p) => p.test(text))) return mood;
  }
  return null;
}

const DISTRESS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(help me|i need help|please help)\b/i, reason: 'asked for help' },
  { pattern: /\bi('m| am) (in pain|hurt(ing)?|bleeding)\b/i, reason: 'reported pain or injury' },
  { pattern: /\bi (fell|have fallen|had a fall)\b/i, reason: 'reported a fall' },
  { pattern: /\bi can'?t (breathe|get up|stand)\b/i, reason: 'reported being unable to breathe or get up' },
  { pattern: /\bi('m| am) (frightened|terrified|scared)\b/i, reason: 'said they were frightened' },
  { pattern: /\bsomeone is in (the|my) (house|room)\b/i, reason: 'reported someone in the house' },
  { pattern: /\bi don'?t know where i am\b/i, reason: 'did not know where they were' },
];

export function readDistress(activity: CallActivity[]): string[] {
  const text = recipientText(activity);
  return DISTRESS_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
}

/**
 * Turn a finished call into the caregiver's readout, and decide whether it
 * needs a person now.
 *
 * The lucidity tripwire is the same one the chat companion uses. A window of
 * clarity on a phone call is if anything more urgent than one on the tablet:
 * on the tablet the caregiver is usually in the house, and here nobody is.
 */
export function summariseCall(
  status: CallStatus,
  req: CheckInCallRequest,
  personaName = 'Yadira'
): CheckInCallResult {
  const reasons: string[] = [];
  const mood = readMood(status.activity);
  const distress = readDistress(status.activity);
  reasons.push(...distress);

  const lucidity = detectLucidity(recipientText(status.activity), personaName);
  if (lucidity) reasons.push('showed a window of real clarity');

  if (!status.answered) reasons.push('did not answer');

  const needsCaregiver = distress.length > 0 || lucidity !== null;

  let summary: string;
  if (!status.answered) {
    summary = `${req.patientName} did not answer. No message was left about their health.`;
  } else if (needsCaregiver) {
    summary = `${req.patientName} answered, and this call needs you: they ${reasons
      .filter((r) => r !== 'did not answer')
      .join(', ')}.`;
  } else if (mood) {
    const moodWord = { peaceful: 'settled', anxious: 'a little worried', restless: 'restless', sad: 'low' }[mood];
    summary = `${req.patientName} answered and sounded ${moodWord}.`;
  } else {
    summary = `${req.patientName} answered and had a short chat. Nothing stood out.`;
  }

  return {
    runId: status.runId,
    answered: status.answered,
    state: status.state,
    phone: maskPhone(req.toPhone),
    mood,
    lucidity,
    needsCaregiver,
    reasons,
    summary,
    transcript: status.activity,
  };
}

// ------------------------------------------------- CALL-E structured result

/**
 * The readout we ask CALL-E to return, declared as a schema so it comes back
 * validated instead of inferred from a transcript.
 *
 * Deliberately small. Every field is something a caregiver can act on, and
 * every field is phrased so the honest answer to "they didn't really say" is
 * available — `unclear` and `unknown` exist so the model is never forced to
 * invent a wellbeing signal that will be charted and acted upon.
 */
export const RECIPIENT_RESULT_SCHEMA = {
  type: 'object',
  required: ['answered', 'mood'],
  properties: {
    answered: {
      type: 'string',
      enum: ['recipient', 'someone_else', 'voicemail', 'no_answer'],
      description: 'Who actually picked up the phone.',
    },
    mood: {
      type: 'string',
      enum: ['peaceful', 'anxious', 'restless', 'sad', 'unclear'],
      description:
        'How the person themselves sounded, from their own words. Use "unclear" when they did not say anything that clearly indicates mood — never guess.',
    },
    distress: {
      type: 'string',
      enum: ['none', 'possible', 'urgent'],
      description:
        'Did they ask for help, report pain, a fall, fear, or not knowing where they are? "urgent" means a person should go to them now.',
    },
    distress_detail: {
      type: 'string',
      description: 'One plain sentence a family member can read, or empty when distress is "none".',
    },
    wanted_company: {
      type: 'string',
      enum: ['yes', 'no', 'unknown'],
      description: 'Did they express wanting someone with them?',
    },
  },
} as const;

/** Map CALL-E's transcript turns onto our speaker-tagged shape. Their
 *  speakers are "bot" and "user"; only the user's words are ever interpreted. */
function turnsToActivity(result: CalleCallResult): CallActivity[] {
  return result.turns
    .map((t) => {
      const speaker = String(t.speaker || '').toLowerCase();
      return {
        speaker: (speaker.includes('bot') || speaker.includes('agent')
          ? 'agent'
          : speaker.includes('user') || speaker.includes('recipient')
            ? 'recipient'
            : 'system') as CallActivity['speaker'],
        text: String(t.text || '').trim(),
      };
    })
    .filter((t) => t.text);
}

/**
 * Combine CALL-E's structured result with our own independent reading of the
 * transcript.
 *
 * The two are NOT redundant, and the vendor's answer does not simply win. A
 * distress signal is the one output where being wrong in one direction is much
 * worse than the other, so the checks are a union: if either CALL-E's schema
 * result or our own patterns see distress, the caregiver is told. Yadira's
 * lucidity tripwire likewise runs on the raw words regardless of what the
 * model concluded — that judgment belongs to this product, not to a supplier.
 */
export function summariseApiCall(result: CalleCallResult, req: CheckInCallRequest): CheckInCallResult {
  const activity = turnsToActivity(result);
  const structured = result.recipientResult || {};

  const answeredBy = String(structured.answered || '');
  const answered = answeredBy
    ? answeredBy === 'recipient'
    : activity.some((a) => a.speaker === 'recipient');

  // Mood: CALL-E's, unless it declined to say — then our own reading, which may
  // also return null. Nothing here invents a value.
  const vendorMood = String(structured.mood || '');
  const mood: CheckInMood | null =
    vendorMood && vendorMood !== 'unclear' ? (vendorMood as CheckInMood) : readMood(activity);

  const reasons: string[] = [];
  const vendorDistress = String(structured.distress || 'none');
  if (vendorDistress === 'urgent' || vendorDistress === 'possible') {
    reasons.push(String(structured.distress_detail || 'CALL-E flagged distress on the call'));
  }
  // Our own patterns run regardless — a supplier's "none" does not silence them.
  for (const own of readDistress(activity)) {
    if (!reasons.some((r) => r.toLowerCase().includes(own))) reasons.push(own);
  }

  const lucidity = detectLucidity(
    activity.filter((a) => a.speaker === 'recipient').map((a) => a.text).join(' '),
    'Yadira'
  );
  if (lucidity) reasons.push('showed a window of real clarity');

  if (answeredBy === 'someone_else') reasons.push('someone else answered the phone');
  if (!answered && answeredBy !== 'someone_else') reasons.push(answeredBy === 'voicemail' ? 'reached voicemail' : 'did not answer');

  const needsCaregiver =
    vendorDistress === 'urgent' ||
    lucidity !== null ||
    readDistress(activity).length > 0 ||
    vendorDistress === 'possible';

  let summary: string;
  if (!answered) {
    summary =
      answeredBy === 'voicemail'
        ? `${req.patientName} did not pick up; a short hello was left with nothing about their health.`
        : answeredBy === 'someone_else'
          ? `Someone else answered ${req.patientName}'s phone. Nothing about their health was shared.`
          : `${req.patientName} did not answer.`;
  } else if (needsCaregiver) {
    summary = `${req.patientName} answered, and this call needs you: ${reasons.join('; ')}.`;
  } else if (mood) {
    const moodWord = { peaceful: 'settled', anxious: 'a little worried', restless: 'restless', sad: 'low' }[mood];
    summary = `${req.patientName} answered and sounded ${moodWord}.`;
  } else {
    summary = `${req.patientName} answered and had a short chat. Nothing stood out.`;
  }
  if (structured.wanted_company === 'yes') summary += ' They said they would like someone with them.';

  return {
    runId: result.callId,
    answered,
    state: result.status,
    phone: maskPhone(req.toPhone),
    mood,
    lucidity,
    needsCaregiver,
    reasons,
    summary,
    transcript: activity,
  };
}

// ------------------------------------------------------------ orchestration

export async function placeCheckInCall(req: CheckInCallRequest): Promise<CheckInCallResult> {
  if (!isE164(req.toPhone)) {
    throw new Error('A destination phone number in E.164 format is required (e.g. +15551234567).');
  }
  if (!req.patientName?.trim()) {
    throw new Error('The patient name is required so Yadira knows who she is calling.');
  }
  if (!req.timezone?.trim()) {
    throw new Error('A timezone is required — it is never inferred from the phone number or the server clock.');
  }

  const goal = buildCallGoal(req);

  // The Developer API is preferred whenever a key is configured: a static key
  // deploys, a per-machine OAuth cache does not. The CLI stays as the fallback
  // so an existing `calle auth login` keeps working with no key at all.
  if (hasApiKey()) {
    const result = await placeCallAndWait({
      task: goal,
      phone: req.toPhone,
      region: req.region,
      locale: req.language,
      recipientResultSchema: RECIPIENT_RESULT_SCHEMA as unknown as Record<string, any>,
      // One check-in per patient per minute is the most a retry should ever
      // produce — a duplicated request must not ring them twice.
      idempotencyKey: `yadira-checkin-${req.toPhone}-${new Date().toISOString().slice(0, 16)}`,
      webhookUrl: process.env.CALLE_WEBHOOK_URL || undefined,
      metadata: { product: 'yadira', workflow: 'check-in-call' },
    });
    return summariseApiCall(result, req);
  }

  const { status } = await placeOneCall({
    toPhone: req.toPhone,
    goal,
    timezone: req.timezone,
    language: req.language,
    region: req.region,
  });
  return summariseCall(status, req);
}
