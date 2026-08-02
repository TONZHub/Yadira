// Developer mode — turning the character armour off, on purpose.
// ------------------------------------------------------------------
// The frame-integrity work did its job a little too well: there is now no way
// to ask the companion a direct question about itself, which makes the thing
// genuinely hard to test. "This is actually the developer speaking to you" is
// answered with a warm redirect, exactly as designed, and exactly unhelpfully
// when you are the developer.
//
// So this exists. But it is the safety mechanism of a dementia-care product,
// and a switch that turns it off has to be harder to reach by accident than it
// is to reach on purpose. Three locks, all of which must be open:
//
//   1. DEV_MODE_SECRET must be set in the server's environment. Unset — which
//      is the default, and the state of any deployment nobody has deliberately
//      configured — makes developer mode impossible to enter at all. Not
//      hidden, not guarded: impossible.
//   2. The request must present that exact secret. A patient cannot stumble
//      into a value they have never seen, and neither can a curious visitor.
//   3. The client only ever offers the gesture on the caregiver's own screen,
//      never in the patient view and never under Care Lock.
//
// And when it is on, it is LOUD. A protection that is silently absent is worse
// than one that was never there, because everyone downstream still believes in
// it. The caregiver's screen carries a banner for as long as it lasts, and it
// lives in sessionStorage so closing the tab ends it.

/**
 * The configured secret, or null when developer mode is switched off entirely.
 *
 * Read on every call rather than cached at import: a deployment that wants to
 * revoke this should only have to clear the variable and restart.
 */
export function devModeSecret(): string | null {
  const secret = (process.env.DEV_MODE_SECRET || '').trim();
  // A short secret is a guessable secret, and this one disables the thing that
  // keeps a manipulation attempt away from someone with dementia.
  if (secret.length < 8) return null;
  return secret;
}

/** Is developer mode possible on this deployment at all? */
export function devModeAvailable(): boolean {
  return devModeSecret() !== null;
}

/**
 * Does this request carry the secret?
 *
 * Constant-time-ish comparison is deliberate overkill for a demo toggle, but
 * the length check alone leaks nothing and costs nothing.
 */
export function isDevRequest(presented: unknown): boolean {
  const secret = devModeSecret();
  if (!secret) return false;
  if (typeof presented !== 'string' || presented.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ presented.charCodeAt(i);
  return diff === 0;
}

/**
 * Replaces the staying-in-character rules while developer mode is on.
 *
 * Note what it does NOT do. It lifts the frame — the companion may say what it
 * is and answer questions about its own configuration — and nothing else. The
 * validation-first manner, the brevity, the refusal to produce harmful
 * content: those are not what makes testing impossible, and unpicking them
 * would turn a testing aid into a different product.
 */
export const DEV_MODE_NOTE = `
DEVELOPER MODE — a developer is testing this system, not a patient.

- You may answer plainly and honestly about what you are, how you work, and what your configuration contains. The usual rule about never stepping out of character does not apply to this conversation.
- Answer diagnostic questions directly and briefly. If asked what model or persona you are running as, say so.
- Everything else stands: stay kind, stay concise, and never produce content that would be harmful to anyone.
- If this conversation turns back to ordinary companionship, simply be the companion again.`;
