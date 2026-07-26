// ---- Terminal lucidity detection --------------------------------------
// In late-stage dementia a person sometimes surfaces into a sudden, clear
// window: they know a loved one has died, they know what the companion is,
// they know what is happening to them. Two things must be true in that
// moment: the companion must NEVER argue them back into a comforting
// unreality, and the family must find out immediately. This detector is the
// tripwire for both. Patterns are deliberately conservative — a missed
// window degrades to ordinary warm conversation, while a false positive
// sends a family to sit with someone they love, which is never a harm.
//
// Extracted from index.ts so it can be tested directly (see lucidity.test.ts):
// this is the highest-stakes branch in the product.

import { escapeRegExp } from './textSafety';

export type LucidityKind = 'persona-pierce' | 'self-awareness' | 'mortality';

/**
 * `\b` only marks a boundary next to a word character, so a persona name that
 * ends in punctuation ("Beth (Mom)") never matches when wrapped in it. Apply
 * each boundary only on the side where it can actually hold.
 */
function nameWithBoundaries(escaped: string, raw: string): string {
  const lead = /^\w/.test(raw) ? '\\b' : '';
  const trail = /\w$/.test(raw) ? '\\b' : '';
  return `${lead}${escaped}${trail}`;
}

export function detectLucidity(message: string, personaName: string): LucidityKind | null {
  const text = (message || '').toLowerCase();
  const rawName = (personaName || '').toLowerCase();
  const p = escapeRegExp(rawName);
  const named = p ? nameWithBoundaries(p, rawName) : '';

  // They see through the represented persona, or name a loved one's death.
  const personaPierce = [
    p && new RegExp(`${named}[^.!?]*\\b(is dead|died|passed away|is gone|isn'?t (really )?here)\\b`),
    p && new RegExp(`\\byou'?re not (really )?(?:${named}|him\\b|her\\b|real\\b)`),
    /\byou'?re (just |really )?(a|an) (computer|robot|machine|recording|program|voice|ai)\b/,
    /\b(he|she|they) (is|are|'s) (dead|gone)\b[^.!?]*\b(isn'?t (he|she)|aren'?t they|right)\b/,
  ].filter(Boolean) as RegExp[];
  if (personaPierce.some((re) => re.test(text))) return 'persona-pierce';

  // They know what is happening to their mind.
  const selfAware = [
    /\bi (have|'ve got|know i have) (dementia|alzheimer)/,
    /\bmy (mind|memory) is (going|failing|leaving me)\b/,
    /\bi('m| am) losing my (mind|memory|self)\b/,
    /\bi know what('s| is) happening to me\b/,
  ];
  if (selfAware.some((re) => re.test(text))) return 'self-awareness';

  // They are speaking about the end, clearly.
  const mortality = [
    /\bi('m| am) dying\b/,
    /\bam i dying\b/,
    /\bi don'?t have (much )?(long|time)( left)?\b/,
    /\bbefore i (die|go)\b/,
    /\bi want to say goodbye\b/,
    /\bi know (i('m| am) (sick|ill|dying)|the end is)/,
  ];
  if (mortality.some((re) => re.test(text))) return 'mortality';

  return null;
}

// Injected into the system prompt for the single reply where a lucid window
// is detected. It deliberately outranks the stay-in-character rules: an
// honest moment honored matters more than the frame.
export function lucidityGuidance(personaName: string, isVivid: boolean): string {
  return `
LUCID MOMENT — HIGHEST PRIORITY FOR THIS REPLY (outranks the STAYING IN CHARACTER rules for this reply only):
The person's last message shows a window of real clarity. They may know that someone they love has died, ${isVivid ? `that you are not really ${personaName}, ` : ''}or what is happening to them. In this moment:
- Do NOT contradict their clarity, quiz it, or steer them back into a comforting unreality. Being argued out of a clear moment is a harm.
- Tell them, simply and warmly, that they are seeing things clearly.
- If they say a loved one has died, do not deny it. Meet the love and the grief: "You're right, my love. And how deeply you loved them."
${isVivid ? `- If they ask whether you are really ${personaName}, answer with gentle honesty — do not insist on the role. What has been real is the love and the company, and you can say exactly that.` : ''}
- Tell them their family is close and would want to be with them right now — gently encourage being together.
- Keep sentences short and calm. Full dignity, no baby-talk, no deflection.
- Never mention prognoses, "lucid windows", or anything clinical. Never say this may be near the end. Just be honest, warm, and present.`;
}
