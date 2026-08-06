// The lucidity call — "she is clear right now."
// ------------------------------------------------------------------
// A window of real clarity in advanced dementia can last minutes. The app
// already raises a banner in the caregiver hub when it detects one, and a
// banner is the wrong medium for news with a shelf life: it waits on a screen
// nobody is looking at until the thing it announced has passed.
//
// So this rings the phone. It is the third call Yadira makes, and it is
// deliberately the SHORTEST.
//
// ---- Why it asks nothing ----
//
// The help call asks "are you able to get to them?", because that answer
// changes what the companion may promise the patient. This one has no
// question in it at all. There is nothing to decide and nothing to arrange —
// the only useful action is to go, and every second spent answering a
// question is a second of the window spent on the phone.
//
// Identity gate, one sentence, goodbye. That is the whole call.
//
// ---- Why it does not say "nothing is wrong" ----
//
// The help call and the briefing call both open that way, and there it means
// "no action needed, you can breathe". This call is asking somebody to move.
// Saying "nothing is wrong" and then "now is the time" is a contradiction in
// the same breath — and worse, it teaches a caregiver that the phrase can
// precede urgency. One of the times they stop believing it is the call where
// it is true.
//
// So it rules out the EMERGENCY without ruling out the NEWS: "she is safe,
// and nobody is hurt." Those are different sentences and they must stay
// different across all three calls.
//
// ---- The one thing it must not do ----
//
// It must not promise the window will last. Nobody knows how long a lucid
// period runs, and a caregiver who drives across town on "she'll be waiting"
// and arrives to find she has gone again has been handed a second loss by
// the app that told them. So it says "right now", never "she will be".

import { placeCallAndWait, hasApiKey, type CalleCallResult } from './calleApi';

export interface LucidityCallRequest {
  toPhone: string;
  patientName: string;
  caregiverName?: string;
  region?: string;
  at: number;
}

/** Almost nothing, because the call asks almost nothing. */
export const LUCIDITY_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    reached: {
      type: 'string',
      enum: ['caregiver', 'someone_else', 'voicemail', 'no_answer'],
      description: 'Who answered.',
    },
  },
  required: ['reached'],
} as const;

export function buildLucidityCallGoal(req: LucidityCallRequest): string {
  const who = req.caregiverName || 'the caregiver';
  const them = req.patientName;

  return [
    `You are Yadira, calling ${who} with one short piece of news about ${them}. This call is under forty seconds. You ask them nothing and you arrange nothing.`,
    '',
    `1. Open with: "Hello, this is Yadira. Am I speaking with ${who}?"`,
    '',
    `2. If they say no, or you are not certain it is ${who}: say "Sorry to have troubled you," and end the call. Do NOT say why you are calling. Do NOT name ${them}. Do NOT mention health, memory, clarity, or an app. Do NOT ask them to pass on a message. Whoever answered learns only that somebody called.`,
    '',
    `3. The moment you know it is ${who}, take the fear off the table FIRST: "${them} is safe, and nobody is hurt." This number also rings for ${them}'s help button, so ${who} may have answered braced for bad news.`,
    '',
    `4. Do NOT say "nothing is wrong". That is what the help-button call and the weekly update call say to mean "no action needed, you can breathe". This call is asking them to move. If "nothing is wrong" starts arriving before urgency, ${who} learns not to believe it — and one of the times they stop believing it is the call where it is true. Rule out the EMERGENCY, not the NEWS.`,
    '',
    `5. Then the news, in one or two sentences: "${them} is having a very clear moment right now. Those don't usually last long — so if you are able to be with them, or to call them, now would be the time."`,
    '',
    `6. Say it is happening NOW and do not say how long it will last. Never say "${them} will be waiting", "you have time", or anything that promises the window is still open when they arrive. Nobody knows how long a clear period runs, and a caregiver who drives across town on a promise and finds it has passed has been handed a second loss by the call that told them.`,
    '',
    `7. Ask NOTHING. Do not ask whether they can get there, whether they want you to call anyone, or how they are. There is nothing to arrange and every second on the phone is a second of the window spent on the phone.`,
    '',
    `8. If they ask you a question, answer it in one short sentence and then let them go. If they sound like they want to hang up and hurry, let them — that is the call working.`,
    '',
    `9. Close immediately: "I'll leave you to it." Then end the call.`,
    '',
    `10. You must not speculate about why this is happening, what it means, how long ${them} has, or anything clinical. Say nothing about their prognosis. If asked, say that is a question for ${them}'s doctor.`,
    '',
    `11. If you reach VOICEMAIL: do not name ${them} and do not say anything about clarity, memory or health. A voicemail is played aloud in kitchens and offices, and this one may be heard hours late. Say only: "This is Yadira — there is something in your Yadira app worth seeing." Nothing else.`,
    '',
    'Warm and quick. Do not sound alarmed — there is nothing wrong. This is good news that is time-sensitive, and it should sound like it.',
  ].join('\n');
}

// ---- Cooldown ------------------------------------------------------------
// Longer than the others, and for a reason particular to this signal.
// Lucidity detection flickers: a person can read as clear, then not, then
// clear again inside a few minutes. Without a wide cooldown that is three
// phone calls, and three calls teaches a caregiver to stop answering.

const COOLDOWN_MS = 60 * 60_000;
const lastCall = new Map<string, number>();

export function withinLucidityCooldown(circle: string, now = Date.now()): boolean {
  const last = lastCall.get(circle);
  return last != null && now - last < COOLDOWN_MS;
}

export function markLucidityCalled(circle: string, now = Date.now()): void {
  lastCall.set(circle, now);
}

/** A call that never happened must not silence the next window. */
export function clearLucidityCooldown(circle: string): void {
  lastCall.delete(circle);
}

export function __resetLucidityCooldowns(): void {
  lastCall.clear();
}

export async function placeLucidityCall(
  req: LucidityCallRequest,
  idempotencyKey?: string
): Promise<CalleCallResult & { summary: string }> {
  if (!/^\+[1-9]\d{6,14}$/.test(req.toPhone)) {
    throw new Error('The caregiver phone number must be in E.164 format, e.g. +15551234567.');
  }
  if (!hasApiKey()) {
    throw new Error('CALLE_API_KEY is not configured, so Yadira cannot place calls.');
  }

  const result = await placeCallAndWait({
    task: buildLucidityCallGoal(req),
    phone: req.toPhone,
    region: req.region,
    recipientResultSchema: LUCIDITY_RESULT_SCHEMA as unknown as Record<string, any>,
    idempotencyKey,
    metadata: { kind: 'lucidity' },
    // Short call, so do not sit on the poll for ten minutes.
    maxWaitMs: 3 * 60_000,
  });

  const reached = String(result.recipientResult?.reached || '');
  const summary =
    reached === 'caregiver'
      ? 'Told you directly.'
      : reached === 'voicemail'
        ? 'Left a voicemail — it names nobody.'
        : reached === 'someone_else'
          ? 'Someone else answered, so nothing was said.'
          : reached === 'no_answer'
            ? 'No answer.'
            : `Call ${result.status}.`;

  return { ...result, summary };
}
