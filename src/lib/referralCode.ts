// Referral codes — the shape of them, and the link they turn into.
// ------------------------------------------------------------------
// Its own module, with no imports, for the same reason snapshotRule.ts is:
// referral.ts pulls in Firebase, which cannot be loaded outside a browser, and
// this part is worth asserting rather than merely eyeballing. Two of the rules
// below (what counts as a valid code coming back off a URL, and which origin a
// shared link is allowed to carry) are the ones that quietly break a giveaway.

/** Ambiguous glyphs are left out — nobody should lose a referral to O vs 0. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'YADIRA-';
const CODE_BODY_LENGTH = 4;

/** Where a shared link points when the app isn't running on a real domain. */
export const CANONICAL_ORIGIN = 'https://yadira.chat';

/** e.g. "YADIRA-X7K2" */
export function generateReferralCode(random: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    body += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + body;
}

/**
 * Last resort when repeated rolls keep colliding: a timestamp fragment, which
 * cannot collide with a code minted in a different millisecond. Base-36 digits
 * include the ambiguous glyphs the alphabet above avoids, so this is only ever
 * shown to someone whose code was generated for them, never typed from memory.
 */
export function timestampReferralCode(now: number = Date.now()): string {
  return CODE_PREFIX + now.toString(36).toUpperCase().slice(-CODE_BODY_LENGTH);
}

/**
 * What a code from the outside world (a URL param, a pasted string) is worth.
 *
 * Anything arriving here has been through someone's address bar, so it is
 * treated as hostile: cased however, padded with spaces, possibly missing the
 * prefix because they only copied the tail, possibly megabytes of junk aimed at
 * localStorage. Returns the canonical form, or null if there is nothing usable
 * — and null must be indistinguishable from "no referral" to every caller.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toUpperCase();
  // Long before it could be a code, it is an attack or a mistake.
  if (trimmed.length === 0 || trimmed.length > 64) return null;

  const body = trimmed.startsWith(CODE_PREFIX) ? trimmed.slice(CODE_PREFIX.length) : trimmed;
  // The body is fixed-width and alphanumeric. Timestamp codes live in the same
  // space (base-36 uppercase), so this accepts those too.
  if (!/^[A-Z0-9]{4}$/.test(body)) return null;

  return CODE_PREFIX + body;
}

/**
 * The origin a copied link should carry.
 *
 * A caregiver copying their link from a laptop on localhost, or from a preview
 * deploy, and pasting it into a message to their sister must not send her
 * somewhere that doesn't exist. So the current origin is used only when it
 * looks like a real, reachable site; everything else falls back to the
 * canonical domain.
 */
export function shareOrigin(href: string | null | undefined): string {
  if (!href) return CANONICAL_ORIGIN;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return CANONICAL_ORIGIN;
  }
  if (url.protocol !== 'https:') return CANONICAL_ORIGIN;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return CANONICAL_ORIGIN;
  return url.origin;
}

/** The thing that actually gets pasted into a message or a Reddit post. */
export function referralLink(code: string, href?: string | null): string {
  return `${shareOrigin(href)}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Pulls a referral code out of a URL, and gives back the URL without it.
 *
 * The code is stripped so a refresh, a bookmark, or a screenshot of the address
 * bar doesn't carry it around — and, more to the point, so the caregiver's own
 * link doesn't sit in the URL of the app they then sign in to. Every other
 * param is preserved: ?terms opens the terms modal and ?premium_session is
 * Stripe's return trip, and neither may be lost to a referral landing. (They
 * come back re-serialized, so a valueless ?start becomes ?start= — cosmetic,
 * and only on a URL that carried a ref in the first place.)
 */
export function splitRefFromUrl(href: string): { code: string | null; cleanedUrl: string | null } {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { code: null, cleanedUrl: null };
  }
  if (!url.searchParams.has('ref')) return { code: null, cleanedUrl: null };

  const code = normalizeReferralCode(url.searchParams.get('ref'));
  url.searchParams.delete('ref');
  return { code, cleanedUrl: `${url.pathname}${url.search}${url.hash}` };
}
