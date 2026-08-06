// Stripe billing for Yadira Caregiver Pro — monthly or annual, per care circle.
// ------------------------------------------------------------------
// Talks to Stripe's REST API directly with fetch (same pattern as the
// Inworld/OpenRouter integrations) so no SDK dependency is needed.
//
// Flow (no webhooks, matching the client-writes-Firestore architecture):
//   1. Caregiver picks a plan → POST /api/stripe/create-checkout-session
//      → browser redirects to Stripe Checkout.
//   2. Stripe redirects back to the app with ?premium_session=cs_...
//   3. Client calls GET /api/stripe/verify-session — the server confirms
//      payment with Stripe using the secret key, and only then does the
//      client flip the circle's premium doc (with subscription ids attached).
//   4. On later visits, once the paid period has lapsed, the client calls
//      GET /api/stripe/subscription-status to re-verify renewal or downgrade.
//
// Env: STRIPE_SECRET_KEY (sk_test_... first, sk_live_... for real revenue).
// Optional APP_URL overrides the redirect base (defaults to request origin).

import express from 'express';
import { PLANS, planOf, TRIAL_DAYS, hasTrial } from '../lib/pricing';
import { notePremium } from './premiumRegistry';

const STRIPE_API = 'https://api.stripe.com/v1';

const stripeKey = () => process.env.STRIPE_SECRET_KEY;
const isStripeConfigured = () => {
  const key = stripeKey();
  return !!key && key.trim() !== '' && key !== 'MY_STRIPE_SECRET_KEY';
};

/**
 * A Stripe failure that carries WHY, because two very different things were
 * being treated as one.
 *
 * A network blip, an outage page, a bad key — those mean "ask again later",
 * and downgrading a paying family over one is unforgivable.
 *
 * "No such customer" is not that. It is Stripe answering the question
 * definitively: there is no subscription here. Collapsing both into a generic
 * 502 is what let a deleted customer keep Caregiver Pro indefinitely — the
 * only code path that can downgrade requires a SUCCESSFUL reply saying
 * inactive, and a deleted subscription never produces one.
 */
class StripeError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'StripeError';
  }
}

/** Stripe telling us the thing is gone, rather than that it could not answer. */
function isMissingResource(err: any): boolean {
  if (err instanceof StripeError) {
    return err.status === 404 || err.code === 'resource_missing';
  }
  // Belt and braces: the message is stable across Stripe's resource types.
  return /no such (customer|subscription|checkout\.session|price)/i.test(String(err?.message || ''));
}

// Stripe's API takes application/x-www-form-urlencoded bodies with
// bracket-notation for nested params (line_items[0][price_data][currency]).
async function stripeRequest(
  method: 'GET' | 'POST',
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = method === 'GET' && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' && body ? { body } : {}),
  });

  // Stripe replies with JSON, but an intermediary (corporate proxy, outage
  // page) may not — surface a readable error instead of a JSON.parse crash.
  const raw = await response.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Stripe API returned a non-JSON response (HTTP ${response.status}): ${raw.slice(0, 120)}`);
  }
  if (!response.ok) {
    const message = data?.error?.message || `Stripe API error ${response.status}`;
    throw new StripeError(message, response.status, data?.error?.code);
  }
  return data;
}

// Base URL for Stripe's post-checkout redirects. Render sits behind a proxy,
// so req.protocol reports http — prefer APP_URL, then the fetch Origin header,
// then x-forwarded-proto.
function baseUrl(req: express.Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const origin = req.headers.origin;
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

const notConfigured = (res: express.Response) =>
  res.status(503).json({
    error: 'stripe_not_configured',
    message: 'STRIPE_SECRET_KEY is not set — Premium checkout is unavailable.',
  });

// A subscription counts as premium while Stripe says it's active or trialing.
// past_due keeps access briefly (Stripe retries the card); everything else
// (canceled, unpaid, incomplete_expired) downgrades.
function subscriptionState(sub: any) {
  const status: string = sub?.status || 'unknown';
  const active = status === 'active' || status === 'trialing' || status === 'past_due';
  return {
    active,
    // Surfaced separately, not folded into `active`. Trialing IS premium —
    // but the briefing call is billed per call and is deliberately not part
    // of a trial, so something downstream has to be able to tell them apart.
    trialing: status === 'trialing',
    status,
    subscriptionId: sub?.id || null,
    customerId: typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id || null,
    // Seconds → ms so the client can compare against Date.now() directly.
    currentPeriodEnd: sub?.current_period_end ? sub.current_period_end * 1000 : null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
  };
}

export function registerStripeRoutes(app: express.Express) {
  // Step 1 — create the Checkout Session and hand its URL back to the client.
  app.post('/api/stripe/create-checkout-session', async (req: express.Request, res: express.Response) => {
    if (!isStripeConfigured()) return notConfigured(res);

    const circle = String(req.body?.circle || 'default-circle').slice(0, 128);
    const base = baseUrl(req);
    // Lock the checkout to the signed-in account's email. Restore-by-email
    // (below) can only find a subscription whose Stripe customer email
    // matches the login email — letting people type a different address at
    // checkout is how a paying caregiver gets orphaned from their purchase.
    const accountEmail = String((req as any).user?.email || '').trim().toLowerCase();

    // Monthly or annual, from the button the caregiver pressed. Unrecognised
    // values fall back to monthly rather than erroring: a caregiver who has
    // decided to pay should never meet a validation message.
    const chosen = PLANS[planOf(req.body?.plan)];

    // Pinned rather than left to the dashboard's dynamic payment-method
    // config: an account whose dashboard methods are unset/misconfigured
    // otherwise gets "No valid payment method types for this Checkout
    // Session". Every pinned type must be activated in the dashboard's
    // payment methods for the CURRENT mode (test and live are configured
    // separately) — if Stripe rejects 'link' as not activated, retry
    // card-only so checkout never breaks on dashboard state.
    const sessionParams: Record<string, string> = {
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'link',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(chosen.cents),
      'line_items[0][price_data][recurring][interval]': chosen.interval,
      'line_items[0][price_data][product_data][name]': `Yadira Caregiver Pro (${chosen.label})`,
      'line_items[0][price_data][product_data][description]':
        'Unlimited AI care reports — personalized routines and clinical insights. The companion itself stays free for your family; this sustains the professional caregiver tooling.',
      success_url: `${base}/?premium_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?premium_canceled=1`,
      'metadata[circleId]': circle,
      'subscription_data[metadata][circleId]': circle,
      allow_promotion_codes: 'true',
      // Stripe collects the card now and charges when the trial ends. A
      // card-required trial converts several times better than a no-card one,
      // and without it the circle id IS the account uid — a new signup would
      // be a new trial, forever, with nothing to track it by.
      ...(hasTrial() ? { 'subscription_data[trial_period_days]': String(TRIAL_DAYS) } : {}),
      ...(accountEmail && accountEmail.includes('@') && !accountEmail.endsWith('@yadira.local')
        ? { customer_email: accountEmail }
        : {}),
    };

    try {
      let session;
      try {
        session = await stripeRequest('POST', '/checkout/sessions', sessionParams);
      } catch (err: any) {
        if (!/type provided: link is invalid/i.test(String(err?.message || ''))) throw err;
        console.warn('[Stripe] Link not activated for this mode — falling back to card-only checkout.');
        const cardOnly = { ...sessionParams };
        delete cardOnly['payment_method_types[1]'];
        session = await stripeRequest('POST', '/checkout/sessions', cardOnly);
      }
      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('[Stripe] create-checkout-session failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to create checkout session' });
    }
  });

  // Step 3 — the client returned from Stripe; confirm the payment actually
  // happened before it flips the premium doc. The secret key never leaves the
  // server, so this cannot be spoofed by editing client code.
  app.get('/api/stripe/verify-session', async (req: express.Request, res: express.Response) => {
    if (!isStripeConfigured()) return notConfigured(res);

    const sessionId = String(req.query?.session_id || '');
    if (!sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'A Stripe checkout session_id is required' });
    }

    try {
      const session = await stripeRequest('GET', `/checkout/sessions/${sessionId}`, {
        'expand[]': 'subscription',
      });
      const paid = session.payment_status === 'paid';
      const state = subscriptionState(session.subscription);
      // Tell the budget middleware what Stripe just confirmed, so a caregiver
      // who has this second paid for Pro is not held to the free ceiling.
      notePremium(String(session.metadata?.circleId || ''), paid && state.active, state.trialing);
      res.json({
        active: paid && state.active,
        circleId: session.metadata?.circleId || null,
        ...state,
      });
    } catch (err: any) {
      console.error('[Stripe] verify-session failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to verify checkout session' });
    }
  });

  // Step 4 — renewal / lapse check once the stored period end has passed.
  app.get('/api/stripe/subscription-status', async (req: express.Request, res: express.Response) => {
    if (!isStripeConfigured()) return notConfigured(res);

    const subscriptionId = String(req.query?.subscription_id || '');
    if (!subscriptionId.startsWith('sub_')) {
      return res.status(400).json({ error: 'A Stripe subscription_id is required' });
    }

    try {
      const sub = await stripeRequest('GET', `/subscriptions/${subscriptionId}`);
      const state = subscriptionState(sub);
      notePremium(String(sub?.metadata?.circleId || req.query?.circle || ''), state.active, state.trialing);
      res.json(state);
    } catch (err: any) {
      if (isMissingResource(err)) {
        // Deleted or never existed. Say so plainly so the client can act on
        // it, rather than returning a 502 the client is right to ignore.
        console.warn('[Stripe] subscription-status: resource gone —', err.message || err);
        return res.json({ active: false, gone: true });
      }
      console.error('[Stripe] subscription-status failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to fetch subscription status' });
    }
  });

  // Restore purchase — find an active subscription by the AUTHENTICATED
  // account's email, independent of care-circle id. The premium doc lives in
  // careCircles/{uid}, so a caregiver who recreates their account or switches
  // sign-in provider gets a new uid and an empty circle — without this, a
  // paying family is silently locked out of what they paid for. The email
  // comes from the auth token, never the request body, so the endpoint can't
  // be used to probe other people's subscriptions by address.
  app.get('/api/stripe/restore', async (req: express.Request, res: express.Response) => {
    if (!isStripeConfigured()) return notConfigured(res);

    const email = String((req as any).user?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'The signed-in account has no email address' });
    }

    try {
      const customers = await stripeRequest('GET', '/customers', { email, limit: '10' });
      let best: any = null;
      for (const customer of customers?.data || []) {
        const subs = await stripeRequest('GET', '/subscriptions', {
          customer: customer.id,
          status: 'all',
          limit: '10',
        });
        for (const sub of subs?.data || []) {
          const state = subscriptionState(sub);
          if (!state.active) continue;
          if (!best || (sub.created || 0) > (best.created || 0)) best = sub;
        }
      }
      if (!best) return res.json({ found: false });

      // Re-point the subscription's metadata at the circle claiming it, so
      // the Stripe dashboard reflects where this family actually lives now.
      const circle = String(req.query?.circle || '').slice(0, 128);
      if (circle) {
        stripeRequest('POST', `/subscriptions/${best.id}`, {
          'metadata[circleId]': circle,
        }).catch(() => {});
      }

      notePremium(circle, subscriptionState(best).active, subscriptionState(best).trialing);
      res.json({ found: true, ...subscriptionState(best) });
    } catch (err: any) {
      console.error('[Stripe] restore failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to restore subscription' });
    }
  });

  // Self-serve billing management (cancel, update card) via Stripe's hosted
  // customer portal — families must always have an easy way out.
  app.post('/api/stripe/create-portal-session', async (req: express.Request, res: express.Response) => {
    if (!isStripeConfigured()) return notConfigured(res);

    const customerId = String(req.body?.customerId || '');
    if (!customerId.startsWith('cus_')) {
      return res.status(400).json({ error: 'A Stripe customerId is required' });
    }

    try {
      const portal = await stripeRequest('POST', '/billing_portal/sessions', {
        customer: customerId,
        return_url: `${baseUrl(req)}/`,
      });
      res.json({ url: portal.url });
    } catch (err: any) {
      if (isMissingResource(err)) {
        console.warn('[Stripe] create-portal-session: customer gone —', err.message || err);
        return res.status(404).json({
          error: 'This subscription no longer exists in billing.',
          gone: true,
        });
      }
      console.error('[Stripe] create-portal-session failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to create billing portal session' });
    }
  });
}

// Test seam. The class and predicate are internal to the billing flow, but
// the distinction they draw decides whether a paying family keeps what they
// paid for, so it is asserted rather than trusted. See stripeGone.test.ts.
export { StripeError as __StripeError, isMissingResource as __isMissingResource };
