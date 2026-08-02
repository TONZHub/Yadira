// Transcription hygiene — keeping invented words out of a patient's mouth.
// ------------------------------------------------------------------
// Whisper-family models do not return "nothing" when handed silence. They
// return confident, fluent, entirely invented text, drawn from whatever
// dominated their training data: subtitle credits, sign-offs, stray numbers.
// Reported from a real session: "double o seven" and "The system is down".
//
// That failure is worse here than in most products. The transcript becomes
// what the patient said — it is sent to the companion as their words, it can
// trip the lucidity tripwire, and it can end up quoted back to them. A person
// with dementia being told they said something they did not say is precisely
// the disorientation this whole app exists to avoid.
//
// Two defences, in order:
//   1. Do not send silence to a model at all (looksLikeSilence).
//   2. If something comes back that is never real speech, drop it
//      (isTranscriptionArtifact).

/** Below this, a recording is a fumbled tap rather than a sentence. */
export const MIN_DURATION_MS = 500;

/**
 * Peak amplitude, 0–1, below which the room was effectively silent.
 *
 * Set low on purpose. The two failures this sits between are not equally bad:
 * an invented sentence is caught downstream by isTranscriptionArtifact and, at
 * worst, is one strange reply — a refused recording is a person with dementia
 * speaking into a device that acts as though they said nothing, repeatedly,
 * with no way to tell why. A frail voice at arm's length from a tablet peaks
 * far lower than a healthy one leaning in, and that voice is the whole point
 * of this app. When in doubt, transcribe.
 */
export const MIN_PEAK_AMPLITUDE = 0.01;

/** A webm/opus container with no audio in it still weighs a few hundred bytes. */
export const MIN_AUDIO_BYTES = 1200;

export interface AudioHints {
  /** How long the recorder ran, when the client reports it. */
  durationMs?: number;
  /**
   * Loudest sample in the recording as a fraction of full scale, 0–1,
   * measured in the TIME domain — max(|sample − 128|) / 128 over
   * getByteTimeDomainData.
   *
   * ABSENT means the client could not measure, and absent is not zero. That
   * distinction is what broke dictation: the browser meter feeding this was
   * decoration before the guard depended on it, so its failure modes were all
   * silent. Safari has no `window.AudioContext` (only the webkit-prefixed
   * one) and an unresumed context returns zeros without erroring — both
   * reported a confident 0, which was read as "silent room", and every
   * recording on those devices was refused. Nothing in the transcript, no
   * error, just a microphone that appeared not to work.
   *
   * The field was renamed rather than fixed in place so a cached older build
   * cannot have its differently-measured value read as this one. Its reading
   * simply goes unreported, and duration and size decide.
   */
  peakAmplitude?: number;
  /** Decoded size of the audio payload. */
  bytes: number;
}

/**
 * Should this audio be sent to a transcription model at all?
 *
 * Deliberately only decides on evidence it actually has. A client that reports
 * no hints is trusted apart from the byte floor — an older build, or one whose
 * AudioContext was refused by the browser, should degrade to today's behaviour
 * rather than have its dictation silently refused forever.
 */
export function looksLikeSilence(hints: AudioHints): boolean {
  if (hints.bytes < MIN_AUDIO_BYTES) return true;
  if (typeof hints.durationMs === 'number' && hints.durationMs < MIN_DURATION_MS) return true;
  if (typeof hints.peakAmplitude === 'number' && hints.peakAmplitude < MIN_PEAK_AMPLITUDE) return true;
  return false;
}

// Phrases these models emit over silence. Every entry is something a person
// speaking to their companion would never say, which is the bar for inclusion.
//
// Note what is NOT here: "thank you", "hello", "goodbye", "yes", "no". Those
// are classic Whisper silence artifacts AND completely ordinary things for a
// patient to say. Filtering them would delete real speech, so they are left to
// the silence check above, which catches them by looking at the audio instead
// of guessing from the words.
const ARTIFACT_PATTERNS: RegExp[] = [
  /^the system is down\.?$/i,
  /^(thanks for watching|thank you for watching)[.!]?$/i,
  /^(please )?(like and )?subscribe([ .!].*)?$/i,
  /^(sous-titres|subtitles?|legendas|untertitel)[^.]*$/i,
  /amara\.org/i,
  /^transcri(ption|pt) by/i,
  /^\W*$/, // punctuation, music notes, or nothing at all
  /^(you|uh|um|hmm|mm)\.?$/i, // single filler tokens, the commonest silence output
  /^\d{1,3}$/, // a bare number, e.g. "007"
  /^(double o seven|double-o-seven)\.?$/i,
];

/**
 * True when the text is something a transcription model invents rather than
 * hears. Applied to the whole reply only — a phrase appearing inside a longer
 * sentence is almost certainly genuine, and this must never truncate real
 * speech.
 */
export function isTranscriptionArtifact(text: string): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;
  return ARTIFACT_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * The final say on what reaches the patient's message box. Returns an empty
 * string rather than a guess: the client falls back to its live captions, and
 * failing that tells them plainly that nothing was heard.
 */
export function cleanTranscript(text: string): string {
  return isTranscriptionArtifact(text) ? '' : (text || '').trim();
}
