// Vocal tone — what the words alone cannot tell you.
// ------------------------------------------------------------------
// Emotion in this app has always been read from the transcript. Which means
// "I'm fine" reads as fine. Said brightly, said flatly, said through tears:
// identical string, identical answer. For someone whose words are becoming
// less reliable than their voice — which is the direction dementia runs — that
// is the wrong half of the signal to keep.
//
// Gemini takes audio as a modality rather than a transcript, so it can be
// asked about things that were never in the words: flatness, tremor, effort,
// pace, whether someone is crying. Whisper cannot do this at all; it returns
// text and nothing else.
//
// Two rules govern everything below, and they are the app's, not the model's:
//
//   1. MOOD IS NEVER GUESSED. A fabricated wellbeing signal gets charted and
//      acted on by a tired human at midnight. "Unclear" is a first-class
//      answer here, and an unsure reading is discarded rather than rounded to
//      neutral.
//   2. A HEARD READING IS NOT A FACT. It is one person's impression of a
//      voice, produced by a model, with no clinical validation behind it. It
//      travels with its provenance attached so the caregiver's screen can say
//      "heard" rather than implying "measured".

/** The emotions the rest of the app already knows how to render. */
export const KNOWN_EMOTIONS = [
  'happy',
  'sad',
  'anxious',
  'confused',
  'peaceful',
  'angry',
  'excited',
  'neutral',
] as const;

export type KnownEmotion = (typeof KNOWN_EMOTIONS)[number];

export interface VocalTone {
  emotion: KnownEmotion;
  /** 0–1. Below MIN_CONFIDENCE the reading is dropped rather than shown. */
  confidence: number;
  /** One short phrase describing how it sounded, for the caregiver to read. */
  tone: string;
  /** Always 'voice' here — the badge and the companion prompt distinguish
      what was heard from what was inferred from wording. */
  source: 'voice';
}

/**
 * Below this we say nothing rather than something weak.
 *
 * A low-confidence mood shown at all is worse than no mood: it looks like
 * information, it charts like information, and it is a coin toss.
 */
export const MIN_CONFIDENCE = 0.55;

/**
 * Asks for the transcript and the voice in one pass.
 *
 * One call rather than two is not only cheaper — it replaces the existing
 * transcribe-then-analyse round trip, so dictation gets faster while gaining
 * a signal it never had. The patient is waiting through this.
 */
export const TRANSCRIBE_WITH_TONE_PROMPT = `You are helping a companion app for people living with dementia understand what someone just said.

Return ONLY valid JSON, no markdown fences and no commentary:
{"text": "...", "emotion": "happy|sad|anxious|confused|peaceful|angry|excited|neutral|unclear", "confidence": 0.0-1.0, "tone": "short phrase"}

"text": transcribe the speech EXACTLY as spoken, in the original language. Do not correct grammar, tidy repetition, or complete unfinished sentences — repetition and disfluency are clinically meaningful here. If there is no intelligible speech, use an empty string.

"emotion": how the person SOUNDS, judged from the voice itself — pace, pitch, volume, steadiness, breath, effort, whether there is crying or laughter. Judge the delivery, NOT the subject matter. Someone saying something sad in a light, comfortable voice is not sad. Someone saying "I'm fine" flatly, or with a tremor, is not happy.

"confidence": how sure you are about the emotion, from the audio quality and how clear the delivery was. Be honest and use low values freely.

"tone": a short plain phrase a family member would understand, e.g. "quiet and a little shaky", "bright, laughing at the end", "flat, long pauses". No jargon. No diagnosis.

Use "unclear" for emotion whenever the audio is too short, too quiet, too noisy, or the delivery is genuinely ambiguous. "unclear" is the correct and expected answer in those cases — never guess a mood to fill the field. A wrong reading here is charted and acted on by an exhausted person; saying nothing is always better.`;

/** The same question, when something else already did the transcribing. */
export const TONE_ONLY_PROMPT = `You are helping a companion app for people living with dementia.

Listen to this audio and judge how the person SOUNDS — from the voice itself: pace, pitch, volume, steadiness, breath, effort, crying or laughter. Judge the delivery, NOT the subject matter.

Return ONLY valid JSON, no markdown fences and no commentary:
{"emotion": "happy|sad|anxious|confused|peaceful|angry|excited|neutral|unclear", "confidence": 0.0-1.0, "tone": "short phrase"}

Use "unclear" whenever the audio is too short, too quiet, too noisy, or the delivery is genuinely ambiguous. Never guess a mood to fill the field — saying nothing is always better than a wrong reading, which gets charted and acted on.`;

/** Strips the markdown fence models add even when told not to. */
export function stripJsonFence(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Turn a model's reply into a tone reading, or into nothing.
 *
 * Returns null far more readily than it returns a value: unknown emotion,
 * explicit "unclear", missing or low confidence, unparseable JSON. Every one
 * of those is a case where the honest output is silence, and silence here
 * costs only a badge that does not appear.
 */
export function parseVocalTone(raw: string): VocalTone | null {
  let parsed: any;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const emotion = String(parsed.emotion || '').trim().toLowerCase();
  // 'unclear' arrives here by design, and leaves as null.
  if (!(KNOWN_EMOTIONS as readonly string[]).includes(emotion)) return null;

  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) return null;

  const tone = String(parsed.tone || '').trim().slice(0, 120);

  return {
    emotion: emotion as KnownEmotion,
    confidence: Math.min(1, Math.max(0, confidence)),
    tone: tone || 'heard in their voice',
    source: 'voice',
  };
}

/**
 * Pull the transcript out of the combined reply.
 *
 * Kept separate from the tone so one can fail without taking the other with
 * it: a malformed emotion field must never cost the patient their words. If
 * the JSON is unusable the raw reply is returned, on the assumption the model
 * ignored the format and simply transcribed — which is the outcome we want
 * anyway.
 */
export function parseTranscriptWithTone(raw: string): { text: string; tone: VocalTone | null } {
  const cleaned = stripJsonFence(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { text: cleaned, tone: null };
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.text !== 'string') {
    return { text: cleaned, tone: null };
  }
  return { text: parsed.text, tone: parseVocalTone(cleaned) };
}
