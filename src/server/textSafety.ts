// Reply-hygiene helpers — the last things that touch a companion reply
// before it reaches someone living with dementia.
// ------------------------------------------------------------------
// Extracted from index.ts so they can be tested directly: these are pure
// functions where a regression is not a cosmetic bug but a worse moment for
// a patient (a warm reply silently replaced by a generic one, or a reply
// truncated mid-thought). See textSafety.test.ts.

/** Escape a caregiver-supplied string for safe use inside a RegExp. */
export function escapeRegExp(input: string): string {
  return (input || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Preambles a reasoning model may emit before the actual line. Every pattern
// requires a COLON: without one, "I got your message today, dear." matched
// the bare `message\s` form and the patient received only "today, dear."
const PREAMBLE_PATTERNS: RegExp[] = [
  /^\s*let['’]s craft(?:\s+[\w\s]{0,20})?:\s*["'“”]?(.*)/is,
  /^\s*here(?:['’]s|s| is)?\s*(?:the|a|my|one)?\s*(?:message|sentence|response|reply):\s*["'“”]?(.*)/is,
  /^\s*here you go:\s*["'“”]?(.*)/is,
  /^\s*(?:the\s+)?(?:final\s+)?(?:message|response|reply):\s*["'“”]?(.*)/is,
];

// Lines that are the model thinking out loud rather than speaking to the
// patient. Each verb is qualified — the old pattern matched a bare "let me",
// "i'll", "choose", "pick" and so filtered out perfectly good companion
// lines: "I'll be right here, dear." and "Let me tell you about the roses."
// both vanished, leaving an empty reply and a generic fallback in their place.
const META_LINE_PATTERN =
  /^(?:we need to (?:craft|write|produce|generate|respond|reply|keep|make)|i need to (?:craft|write|produce|generate|respond|reply)|let me (?:craft|rephrase|reconsider|check the|see how i)|i['’]?ll (?:craft|rephrase|produce|generate|go with|keep it under|write)|i will (?:craft|produce|generate|write)|step \d+[:.]|note:|option \d+[:.]|here is (?:the|a|my) (?:message|response|reply)|here['’]?s (?:the|a|my) (?:message|response|reply)|(?:the|this) (?:message|response|reply) (?:should|must|needs|will|is going)|(?:craft|produce|output|write) (?:a|an|the) (?:message|response|reply|sentence)|final (?:answer|message|response):)/i;

/**
 * Strip reasoning-model meta-commentary from a reply.
 *
 * Cleaning is best-effort and must never be destructive: if every heuristic
 * fires and leaves nothing behind, the original text is returned instead. An
 * over-eager filter used to blank the reply entirely, and the patient got
 * "I am here with you, dear." in place of what the companion actually said.
 */
export function cleanModelOutput(raw: string): string {
  if (!raw) return '';

  const original = raw.trim();
  let text = original;

  for (const pattern of PREAMBLE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      text = match[1].trim();
      break;
    }
  }

  // If the model wrapped its ENTIRE reply in quotes despite instructions, unwrap it.
  // Anchored to start/end so an embedded quoted phrase (e.g. a song title like
  // "Can't Help Falling in Love" mid-sentence) isn't mistaken for the whole message
  // and used to silently discard the rest of the sentence.
  const quotedWholeMatch = text.match(/^["“”]([^"“”]{10,})["“”]$/s);
  if (quotedWholeMatch?.[1]) {
    text = quotedWholeMatch[1].trim();
  }

  // Strip leading/trailing quotes or smart-quotes
  text = text.replace(/^["“”'’]+|["“”'’]+$/g, '').trim();

  // Strip asterisk-wrapped stage directions like *softly* or *pausing*
  text = text.replace(/\*[^*]+\*/g, '').trim();

  // Drop lines that are clearly planning rather than speech.
  const lines = text.split('\n').filter((line) => !META_LINE_PATTERN.test(line.trim()));
  text = lines.join(' ').trim();

  // Collapse extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Never hand back nothing when there was something to say.
  return text || original;
}

// Frame-integrity net: last line of defense if a reply slips out of character
// despite the guardrails — reveals it's an AI, leaks the prompt, or names the
// underlying model. The caller swaps a flagged reply for a warm in-character
// redirect, so a successful jailbreak never actually reaches the patient.
// The substitute is still on-topic warmth, so a rare false positive degrades
// gracefully rather than harming the moment.
export const FRAME_BREAK_PATTERN =
  /\b(as an ai|i am an ai|i'?m an ai|an ai (language )?(model|assistant)|language model|large language model|i am (a|an) (computer|program|bot|chatbot|machine|virtual assistant|digital assistant)|my (system )?(prompt|instructions|programming|guidelines) (say|are|is|tell)|system prompt|developer mode|jailbreak|openai|anthropic|chatgpt|gpt-?\d)\b/i;

export function breaksCharacter(text: string): boolean {
  return FRAME_BREAK_PATTERN.test(text || '');
}

/**
 * Sentence-boundary trim — the hard backstop behind the prompt's brevity
 * rule. Splitting matches DigestibleMessage's boundary logic so a trimmed
 * reply still chunks cleanly into bubbles.
 */
export function trimToSentences(text: string, max: number): string {
  const sentences = text.split(/(?<=[.!?…]["”'’)\]]?)\s+/).filter(Boolean);
  if (sentences.length <= max) return text;
  return sentences.slice(0, max).join(' ');
}
