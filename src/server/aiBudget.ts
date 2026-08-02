// A daily ceiling on the routes that cost money.
// ------------------------------------------------------------------
// Token verification closed the hole where anyone could claim to be any
// family. It did not close the one where anyone can be SOME family: the
// local-demo token is unsigned by design — it has to be, because it exists
// for deployments with no Firebase Auth — so a hand-written
//
//   {"uid":"local-anything","iss":"yadira-local-dev"}
//
// is accepted, and every AI route accepts it. Verified against a running
// build: that token gets a full reply out of /api/chat. Circle isolation
// holds, so this was never a data leak. It is a bill, and the commit that
// added verification named "free use of the AI routes on our bill" as the
// thing it was fixing. This is the other half of that.
//
// The shape of the limit follows the shape of the risk:
//
//   · A LOCAL circle is a demo. Real families sign in, and a forged token is
//     always local — so local circles get a much smaller allowance. Enough
//     to explore the companion properly, nowhere near enough to be worth
//     farming.
//   · A VERIFIED circle is a family who signed in. Generous, because the
//     worst case is a talkative patient on a bad day, and running out of
//     companion mid-afternoon is a care failure.
//   · The per-IP cap is the backstop for someone rotating uids. Deliberately
//     high: a care facility behind one NAT is many families on one address.
//
// In-memory, resetting on deploy, matching the TTS budget beside it. That is
// the right weight for this: it bounds abuse without becoming infrastructure,
// and the failure mode of losing the counters is a slightly larger bill, not
// a family locked out.

export type BudgetTier = 'pro' | 'verified' | 'local';

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

// ---- What these cost ----
//
// A measured stress test put one family at $6.10/week — about $0.87 a day —
// at roughly fifteen minutes of companion use. Fifteen minutes is somewhere
// near 25 exchanges, so the old 600 was never a budget: it sat 24x above what
// anyone actually did, which means it bounded abuse and nothing else. The
// entire $6.10 was free-tier spend, because the companion is free and only
// the caregiver's reports are paid.
//
// So the ceiling now follows who is paying:

/** Caregiver Pro. Unchanged — a paying family should never meet a ceiling. */
export const AI_DAILY_PER_CIRCLE_PRO = envInt('AI_DAILY_PRO', 600);

/**
 * A signed-in family on the free tier.
 *
 * Deliberately near a normal day rather than far above it: a short daily
 * visit finishes at full quality, and a heavy day degrades instead of
 * billing. It degrades rather than stopping — /api/chat falls through to the
 * simulation companion and the device voice — so "the companion is free"
 * stays literally true, which is the promise this number had to keep.
 */
export const AI_DAILY_PER_CIRCLE_VERIFIED = envInt('AI_DAILY_FREE', 30);

/**
 * A demo circle — including every forged token, which is the point.
 *
 * Held level with the free tier rather than below it. Lower, and signing out
 * would buy a bigger allowance than signing in.
 */
export const AI_DAILY_PER_CIRCLE_LOCAL = envInt('AI_DAILY_LOCAL', 30);

/** Per address, across all circles. A facility NAT is one IP, many families. */
export const AI_DAILY_PER_IP = envInt('AI_DAILY_IP', 1500);

interface Usage {
  day: string;
  count: number;
}

const usage = new Map<string, Usage>();

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Record one AI request against a key and say whether it broke the ceiling.
 *
 * Counts the request either way. A caller who is already over budget going
 * around again should not get a free one because the last was refused.
 */
export function overBudget(key: string, limit: number, now = Date.now()): boolean {
  const day = today(now);
  const entry = usage.get(key);
  const used = entry && entry.day === day ? entry.count : 0;
  usage.set(key, { day, count: used + 1 });
  return used + 1 > limit;
}

export function circleLimitFor(tier: BudgetTier): number {
  if (tier === 'pro') return AI_DAILY_PER_CIRCLE_PRO;
  if (tier === 'verified') return AI_DAILY_PER_CIRCLE_VERIFIED;
  return AI_DAILY_PER_CIRCLE_LOCAL;
}

export interface BudgetCheck {
  allowed: boolean;
  /** Which ceiling stopped it — for the log line, never for the caller. */
  reason?: 'circle' | 'ip';
}

/**
 * Both ceilings, in one call.
 *
 * Deliberately evaluates BOTH rather than short-circuiting: a request that
 * trips the circle limit should still count against the IP, or rotating
 * circles would be a free pass past the backstop.
 */
export function checkAiBudget(
  circle: string,
  ip: string,
  tier: BudgetTier,
  now = Date.now()
): BudgetCheck {
  const circleOver = overBudget(`circle:${circle}`, circleLimitFor(tier), now);
  const ipOver = overBudget(`ip:${ip}`, AI_DAILY_PER_IP, now);
  if (circleOver) return { allowed: false, reason: 'circle' };
  if (ipOver) return { allowed: false, reason: 'ip' };
  return { allowed: true };
}

/** Test seam — the counters are process-wide. */
export function __resetAiBudget(): void {
  usage.clear();
}
