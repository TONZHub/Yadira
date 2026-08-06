// Which care circles are paying — as far as this process knows.
// ------------------------------------------------------------------
// The server has no Firestore access by design (no firebase-admin; the client
// owns the premium doc), so it cannot look up whether a circle is on
// Caregiver Pro. It needs to know, because the daily AI ceiling is now the
// difference between the free tier and the paid one.
//
// What the server DOES see is every Stripe round trip: checkout verification,
// the renewal check, and restore-by-email all pass through here and all know
// both the circle and whether Stripe considers the subscription live. So this
// records what those calls already established, rather than asking again.
//
// In-memory and day-scoped, matching the budget counters it feeds. Losing it
// on deploy is the acceptable direction of failure: a paying family briefly
// treated as free is a smaller allowance for one session, not a lockout, and
// the client re-verifies its subscription on load — which repopulates this.
//
// It is never written from a client claim. A browser asserting "I'm premium"
// would be a free upgrade for anyone who opened devtools.

interface Known {
  day: string;
  pro: boolean;
  /** On a free trial — premium, but not entitled to the billed briefing call. */
  trialing: boolean;
}

const known = new Map<string, Known>();

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Record what a Stripe call just proved about this circle. */
export function notePremium(circle: string, pro: boolean, trialing = false, now = Date.now()): void {
  if (!circle) return;
  known.set(circle, { day: today(now), pro, trialing });
}

/**
 * Is this circle on Pro?
 *
 * `undefined` means "not established today" — deliberately distinct from
 * `false`, so a caller can tell "we know they are free" from "we have not
 * heard". Both currently get the free allowance; keeping them separable is
 * what lets a later lazy Stripe lookup slot in without changing shape.
 */
export function knownPremium(circle: string, now = Date.now()): boolean | undefined {
  const entry = known.get(circle);
  if (!entry || entry.day !== today(now)) return undefined;
  return entry.pro;
}

/** Test seam — the registry is process-wide. */
export function __resetPremiumRegistry(): void {
  known.clear();
}

/**
 * Is this circle on a free trial rather than a paid subscription?
 *
 * `undefined` means we have not established it today — which the caller must
 * read as "not trialing", because the alternative is refusing a paying
 * family the feature they bought whenever this process has just restarted.
 * Erring toward serving the customer costs at most one CALL-E call; erring
 * the other way is a paying caregiver told they cannot have what they paid
 * for.
 */
export function isTrialing(circle: string, now = Date.now()): boolean {
  const entry = known.get(circle);
  if (!entry || entry.day !== today(now)) return false;
  return entry.trialing;
}
