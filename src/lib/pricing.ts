// What Caregiver Pro costs, in one place.
// ------------------------------------------------------------------
// The price used to live as the string "$5/week" in eleven files and as the
// integer 500 in a twelfth. Changing it meant finding all twelve, and the one
// that mattered — Stripe's `unit_amount` — was the one with no "$5" in it to
// grep for. A price the checkout and the screen can disagree about is a
// support ticket at best and a chargeback at worst.
//
// No imports, so both the browser bundle and the esbuild server bundle can
// use the same numbers.
//
// ---- Why these numbers ----
//
// A measured stress test put the cost of one family at $6.10/week at about
// fifteen minutes of companion use a day. That is $317/year in cost per
// active family, against a $5/week price that netted $4.56 after Stripe —
// every subscriber was losing roughly $80 a year.
//
// Weekly billing was also the worst available interval: Stripe's fixed $0.30
// made fees 8.9% of a $5 charge, and it put 52 card-decline opportunities a
// year in front of every subscriber. Monthly billing drops fee overhead to
// 3.5% and dunning events to 12.

export type Plan = 'monthly' | 'annual';

/** Cents, because that is the unit Stripe's `unit_amount` takes. */
export const PRICE_MONTHLY_CENTS = 3999;
export const PRICE_ANNUAL_CENTS = 39900;

export interface PlanDetail {
  /** Stripe `unit_amount`. */
  cents: number;
  /** Stripe `recurring[interval]`. */
  interval: 'month' | 'year';
  /** "$39.99/month" — for buttons and inline copy. */
  label: string;
  /** "$39.99" alone, for a price displayed beside its own interval. */
  amount: string;
  /** What it works out to per month, for comparing the two plans. */
  perMonth: string;
}

export const PLANS: Record<Plan, PlanDetail> = {
  monthly: {
    cents: PRICE_MONTHLY_CENTS,
    interval: 'month',
    label: '$39.99/month',
    amount: '$39.99',
    perMonth: '$39.99',
  },
  annual: {
    cents: PRICE_ANNUAL_CENTS,
    interval: 'year',
    // Two months free against the monthly price — the discount people
    // recognise without having to work it out.
    label: '$399/year',
    amount: '$399',
    perMonth: '$33.25',
  },
};

export function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'annual';
}

export function planOf(value: unknown): Plan {
  return isPlan(value) ? value : 'monthly';
}

/** "$39.99/month or $399/year" — the full offer in one clause. */
export const PRICE_BOTH = `${PLANS.monthly.label} or ${PLANS.annual.label}`;

/**
 * The price named in a sentence about the paid tier.
 *
 * Everywhere the app mentions Pro in passing it should say the entry price,
 * not the whole offer — "Caregiver Pro ($39.99/month) adds ..." reads; the
 * two-plan version does not.
 */
export const PRICE_SHORT = PLANS.monthly.label;

/** Savings copy for the annual plan, derived rather than written down. */
export const ANNUAL_SAVING = `$${((PRICE_MONTHLY_CENTS * 12 - PRICE_ANNUAL_CENTS) / 100).toFixed(2)}`;

// ---- The free trial ----
//
// Seven days, not three. Cost was never the constraint — at a measured
// $0.871/day a trial start risks $6.10, which is nothing against a $39.99
// month. The constraint is SETUP: a caregiver has to complete the family
// profile, write real memories, save the phone number the help button rings,
// and hand a tablet over. Three days is barely onboarding, and the failure
// mode is not "they didn't like it" — it is being charged before they ever
// finished, which costs a refund and a review rather than a customer.
//
// Env-configurable so it can be tuned or switched off (0) without a deploy of
// new code. Every piece of copy derives from this number, so the buttons can
// never promise a trial that is not configured.
export const TRIAL_DAYS = (() => {
  const raw = Number(
    typeof process !== 'undefined' ? process.env?.VITE_TRIAL_DAYS ?? process.env?.TRIAL_DAYS : undefined
  );
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 7;
})();

export function hasTrial(): boolean {
  return TRIAL_DAYS > 0;
}

/** "7-day free trial" — or empty, when trials are off. */
export const TRIAL_LABEL = hasTrial() ? `${TRIAL_DAYS}-day free trial` : '';

/**
 * What a trial deliberately does NOT include.
 *
 * The weekly email stays in: it costs a fraction of a cent, it arrives on its
 * own, and a trial where nothing ever turns up is three days of poking around
 * followed by a charge.
 *
 * The briefing CALL stays out: every one is a real, billed CALL-E call, and
 * it is the single feature a trial could be farmed for.
 */
export const TRIAL_EXCLUDES_BRIEFING_CALL = true;
