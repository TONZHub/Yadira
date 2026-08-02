// Ask Yadira, by phone.
// ------------------------------------------------------------------
// The caregiver dashboard is excellent and requires you to be sitting at it.
// The people using it are driving home, standing in a hospital corridor, or
// lying awake at two in the morning. This is the same information delivered
// down a phone line, which needs no app, no screen, and works on a handset
// from 2007.
//
// It reuses the help-call transport wholesale. What is different is the
// content and — much more importantly — the opening.
//
// ---- The opening is the whole design ----
//
// This voice already calls this number for one other reason: the help button.
// A caregiver who has been through that once has an adrenaline response
// attached to Yadira's voice on their phone. If a weekly briefing opens with
// anything ambiguous, the first two seconds are a spike of fear, and after a
// few of those either the briefings get ignored or — far worse — the
// emergency calls stop being believed.
//
// So the first sentence after the identity gate says nothing is wrong. Not
// the second, not "just calling to let you know". The first.
//
// ---- What it will not do ----
//
// It knows only what we put in the goal. Asked something outside that, it
// says so rather than guessing: a confident wrong answer about whether
// someone slept is worse than "I can't see that from here."

import { placeCallAndWait, hasApiKey, type CalleCallResult } from './calleApi';

export interface BriefingCallRequest {
  /** The caregiver's phone, E.164. */
  toPhone: string;
  patientName: string;
  caregiverName?: string;
  /**
   * The briefing itself — generated from real logged days by the same code
   * that writes the on-screen insights. Prose, not JSON: it is going to be
   * spoken aloud.
   */
  briefing: string;
  region?: string;
  at: number;
}

/** What we want back, declared rather than inferred from a transcript. */
export const BRIEFING_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    reached: {
      type: 'string',
      enum: ['caregiver', 'someone_else', 'voicemail', 'no_answer'],
      description: 'Who actually answered.',
    },
    heard_briefing: {
      type: 'string',
      enum: ['yes', 'partial', 'no'],
      description: 'Did they hear the update through, or cut it short?',
    },
    asked_about: {
      type: 'string',
      description:
        'Anything they asked, in their own words. Empty if they asked nothing. Used to find out what caregivers actually want to know.',
    },
    unanswered: {
      type: 'string',
      description:
        'Anything they asked that could not be answered from the update. Empty if none. This is the backlog of what the briefing should have contained.',
    },
  },
  required: ['reached'],
} as const;

const MAX_BRIEFING_CHARS = 2400;

/** Keep the spoken portion bounded — nobody wants a nine-minute robocall. */
export function trimBriefing(text: string): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_BRIEFING_CHARS) return clean;
  const cut = clean.slice(0, MAX_BRIEFING_CHARS);
  const lastStop = cut.lastIndexOf('. ');
  return (lastStop > MAX_BRIEFING_CHARS * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim();
}

export function buildBriefingGoal(req: BriefingCallRequest): string {
  const who = req.caregiverName || 'the caregiver';
  const them = req.patientName;
  const briefing = trimBriefing(req.briefing);

  return [
    `You are Yadira, calling ${who} with their update about ${them}. You are warm, unhurried, and you sound like a person who knows this family — not a system reading a report.`,
    '',
    '1. Open with: "Hello, this is Yadira. Am I speaking with ' + who + '?"',
    '',
    `2. If they say no, or you are not certain it is ${who}: say "Sorry to have troubled you, I'll try another time," and end the call. Do NOT say why you are calling. Do NOT name ${them}. Do NOT mention health, care, or an app. Do NOT ask them to pass on a message. Whoever answered learns only that somebody called. This update names a person's health and moods, and a phone number is eventually answered by a neighbour, a grandchild, or a stranger with a recycled number.`,
    '',
    `3. The moment you know it is ${who}, the FIRST thing you say is that nothing is wrong: "Nothing is wrong — ${them} is alright. This is just your update." Say it before anything else. This number also rings for ${them}'s help button, so ${who} may have answered braced for bad news. Do not make them wait through a greeting to find out.`,
    '',
    `4. Then give them the update, in your own words, conversationally. Do not read it as a list and do not say "firstly" or "in summary". Here is what you know about ${them}'s week:`,
    '',
    briefing || `There is not much recorded this week. Say so plainly — that there has not been enough logged to draw anything from, and that the app will have more once a few more days are recorded. Do not invent a week that did not happen.`,
    '',
    `5. Then ask: "Is there anything you'd like to ask me about ${them}?" Answer from what you were told above, and only from that.`,
    '',
    `6. If they ask something the update does not cover — a medication, an appointment, something from before this week — say plainly: "I can't see that from here, but it'll be in the app." Do NOT guess and do NOT infer. A confident wrong answer about whether someone slept or ate is worse than admitting the limit.`,
    '',
    `7. You must not give medical advice, offer a diagnosis, or suggest what treatment or medication ${them} should have. If they ask what something means clinically, say that is a question for ${them}'s doctor, and that you can help them get the week written down to bring along.`,
    '',
    `8. If they cut you short, sound busy, or say now is not a good time: stop immediately, say "Of course — it's all in the app whenever you want it," and let them go. Do not finish the update over the top of them. Do not sound disappointed.`,
    '',
    `9. Close warmly and briefly. Something like: "That's everything. I'm right here with ${them}." Do not offer to call back at a particular time — you cannot schedule that from here.`,
    '',
    `10. If you reach VOICEMAIL: do not name ${them}, do not say anything about health, moods, sleep, or care. A voicemail is played aloud in kitchens and offices. Say only: "This is Yadira with your weekly update — it's waiting for you in your Yadira app." Nothing else.`,
    '',
    'Keep the whole call under three minutes unless they are asking questions. Do not sound alarmed at any point — there is nothing to be alarmed about, and this call proves it.',
  ].join('\n');
}

// ---- Cooldown ------------------------------------------------------------
// Lighter than the help call's, and for a different reason: this is not
// someone frightened pressing a button repeatedly, it is a caregiver who
// might tap "call me" twice while the first call is dialling.

const COOLDOWN_MS = 3 * 60_000;
const lastBriefing = new Map<string, number>();

export function withinBriefingCooldown(circle: string, now = Date.now()): boolean {
  const last = lastBriefing.get(circle);
  return last != null && now - last < COOLDOWN_MS;
}

export function markBriefed(circle: string, now = Date.now()): void {
  lastBriefing.set(circle, now);
}

/** A call that never happened must not silence the next attempt. */
export function clearBriefingCooldown(circle: string): void {
  lastBriefing.delete(circle);
}

export function __resetBriefingCooldowns(): void {
  lastBriefing.clear();
}

// ---- Placing it ----------------------------------------------------------

/**
 * One sentence for the caregiver's screen.
 *
 * The status card says what happened in words a person reads, rather than a
 * call id and a status enum. "Reached voicemail" is a thing you can act on.
 */
export function summarizeBriefing(result: CalleCallResult): string {
  const reached = String(result.recipientResult?.reached || '');
  if (reached === 'caregiver') {
    const heard = String(result.recipientResult?.heard_briefing || '');
    return heard === 'no'
      ? 'Reached you, but the update was cut short.'
      : 'Reached you and gave you the week.';
  }
  if (reached === 'voicemail') return 'Left a voicemail — it names nobody, so it is safe to play aloud.';
  if (reached === 'someone_else') return 'Someone else answered, so nothing was said.';
  if (reached === 'no_answer') return 'No answer.';
  return `Call ${result.status}.`;
}

export async function placeBriefingCall(
  req: BriefingCallRequest,
  idempotencyKey?: string
): Promise<CalleCallResult & { summary: string }> {
  if (!/^\+[1-9]\d{6,14}$/.test(req.toPhone)) {
    throw new Error('The caregiver phone number must be in E.164 format, e.g. +15551234567.');
  }
  if (!hasApiKey()) {
    throw new Error('CALLE_API_KEY is not configured, so Yadira cannot place calls.');
  }

  const result = await placeCallAndWait({
    task: buildBriefingGoal(req),
    phone: req.toPhone,
    region: req.region,
    recipientResultSchema: BRIEFING_RESULT_SCHEMA as unknown as Record<string, any>,
    idempotencyKey,
    metadata: { kind: 'briefing' },
  });
  return { ...result, summary: summarizeBriefing(result) };
}
