// Reading the Web Speech API without letting it repeat itself.
// ------------------------------------------------------------------
// The obvious way to consume `onresult` is the way both call sites did it:
// walk from `event.resultIndex` and append finalised segments to a running
// string.
//
//     for (let i = event.resultIndex; i < event.results.length; i++)
//       if (results[i].isFinal) finalTranscript += text + ' ';
//
// That assumes each result is delivered final exactly once. Browsers do not
// promise this. On mobile engines in particular, `continuous` sessions
// re-deliver earlier results with `resultIndex` back at 0 — so every redelivery
// appends the same words again, on top of everything already accumulated.
//
// Reported from a real call, and it is not subtle:
//
//   "I'm I'm feeling I'm feeling okay I'm feeling okay I'm feeling okay
//    I I'm feeling okay I was I'm feeling okay I was just ..."
//
// — each new word restating the whole utterance so far, growing without bound,
// and then sent to the companion as what the patient said.
//
// The fix is to stop accumulating. `event.results` is the complete session
// every time it fires, so reading all of it and REPLACING is idempotent:
// redelivery becomes a no-op instead of a duplication.

/**
 * A hard ceiling on one utterance.
 *
 * Belt and braces — replacing rather than appending is what actually fixes
 * this. But the failure above reached a person with dementia, and a runaway
 * string is both an unreadable wall on their screen and a prompt sent to the
 * model on their behalf. If some other engine finds a new way to be strange,
 * it stops here.
 */
export const MAX_UTTERANCE_CHARS = 1200;

/** The shape we need from SpeechRecognitionResult, so this is testable. */
export interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface ReadTranscript {
  /** Segments the engine has committed to. */
  final: string;
  /** The in-progress tail, still subject to change. */
  interim: string;
  /** What to show, and what to send when the turn ends. */
  text: string;
}

/**
 * Rebuild the whole transcript from the results list.
 *
 * Deliberately reads from index 0 and returns a value rather than mutating an
 * accumulator: calling it twice with the same event yields the same string,
 * which is the property the old code lacked.
 */
export function readSpeechResults(
  results: ArrayLike<SpeechResultLike> | null | undefined
): ReadTranscript {
  let final = '';
  let interim = '';
  const length = results?.length ?? 0;
  for (let i = 0; i < length; i++) {
    const result = results![i];
    const spoken = result?.[0]?.transcript ?? '';
    if (!spoken) continue;
    if (result.isFinal) final += `${spoken} `;
    else interim += spoken;
  }
  final = collapse(final);
  interim = collapse(interim);
  const text = cap(collapse(`${final} ${interim}`));
  return { final: cap(final), interim: cap(interim), text };
}

/** Engines vary on leading/trailing spaces between segments. */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cap(value: string): string {
  return value.length > MAX_UTTERANCE_CHARS ? value.slice(0, MAX_UTTERANCE_CHARS).trimEnd() : value;
}
