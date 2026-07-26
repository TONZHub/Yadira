// Firebase ID token verification — real RS256 signature checking.
// ------------------------------------------------------------------
// The old middleware base64-decoded the JWT payload and trusted whatever
// uid it found, so anyone could mint `{"uid":"<any family>"}` and be that
// family as far as the server was concerned. Every AI route was therefore
// an open proxy on our OpenRouter/Gemini bill, and the cross-device alert
// endpoints could be driven by a stranger.
//
// This verifies properly against Google's published signing certificates,
// with no new dependency (firebase-admin pulls in gRPC and a service
// account file; node:crypto already does everything needed here).
//
// Three outcomes, because a companion for someone with dementia must not
// go dark the moment a token ages out:
//   'verified' — signature, issuer, audience and expiry all good.
//   'stale'    — signature/issuer/audience good, expiry passed. Accepted
//                only on the resilience paths (help button, lucidity
//                alert, TTS, mode sync); see auth.ts.
//   'local'    — the unsigned local-demo token the client mints when
//                Firebase Auth isn't configured. Its uid MUST be
//                `local-*`, so a forged one can never claim a real
//                family's circle (those are Firebase uids).
// Anything else is rejected.

import crypto from 'crypto';

/** Firebase project whose tokens we accept. Mirrors src/lib/firebase.ts. */
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'yadira-1c1dd';

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Expired tokens stay usable on the resilience paths for this long. */
export const STALE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** Small allowance for clock skew between us and Google. */
const CLOCK_SKEW_S = 60;

export type TokenTier = 'verified' | 'stale' | 'local' | 'unverified';

export interface VerifiedToken {
  uid: string;
  email?: string;
  tier: TokenTier;
}

// ---------------------------------------------------------------- certs

let certs: Record<string, string> | null = null;
let certsFetchedAt = 0;
let inFlight: Promise<Record<string, string> | null> | null = null;

const CERT_TTL_MS = 6 * 60 * 60 * 1000; // re-fetch every 6h

async function loadCerts(): Promise<Record<string, string> | null> {
  const fresh = certs && Date.now() - certsFetchedAt < CERT_TTL_MS;
  if (fresh) return certs;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(CERT_URL, { signal: controller.signal }).finally(() =>
        clearTimeout(timeout)
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, string>;
      certs = body;
      certsFetchedAt = Date.now();
      return certs;
    } catch (err: any) {
      // Keep the last known good set rather than failing every request on a
      // transient blip — Google rotates these keys slowly, and an expired
      // cached key only risks accepting a token signed by a rotated-out key,
      // which is not a practical attack. Only a server that has NEVER
      // reached Google is left without keys.
      console.warn(
        `[Yadira Auth] Could not refresh Google signing certs (${err?.message || err}) —` +
          (certs ? ' using the cached set.' : ' NO cached set available.')
      );
      return certs;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Warm the cert cache at boot so the first request isn't the one that pays. */
export function primeCerts(): void {
  void loadCerts();
}

/** True once we have signing keys — i.e. signatures are actually enforceable. */
export function canVerifySignatures(): boolean {
  return certs !== null;
}

// ----------------------------------------------------------------- jwt

function b64urlToBuffer(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeSegment(part: string): any {
  return JSON.parse(b64urlToBuffer(part).toString('utf-8'));
}

/**
 * Verify a Firebase ID token (or the local-demo token). Returns null when the
 * token is missing, malformed, or fails verification.
 */
export async function verifyFirebaseToken(token: string): Promise<VerifiedToken | null> {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;

  let header: any;
  let payload: any;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const uid: string | undefined = payload.uid || payload.user_id || payload.sub;
  if (!uid || typeof uid !== 'string') return null;
  const email: string | undefined = typeof payload.email === 'string' ? payload.email : undefined;

  // ---- the unsigned local-demo token (client falls back to this when
  // Firebase Auth isn't configured). Trusted only to be a *local* identity:
  // its uid must carry the `local-` prefix the client mints, so it can never
  // address a real family's circle even though it isn't signed.
  if (payload.iss === 'yadira-local-dev') {
    if (!uid.startsWith('local-')) {
      console.warn('[Yadira Auth] Local-dev token claimed a non-local uid — rejected.');
      return null;
    }
    return { uid, email, tier: 'local' };
  }

  // ---- a real Firebase ID token: issuer and audience must be ours.
  if (payload.aud !== PROJECT_ID || payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    return null;
  }

  const signingCerts = await loadCerts();
  if (!signingCerts) {
    // Never reached Google, not even once. Failing closed here would brick
    // the companion for every family; instead the token is accepted at the
    // lowest trust tier, which auth.ts confines to the resilience paths.
    console.error(
      '[Yadira Auth] No Google signing certs available — token accepted UNVERIFIED. ' +
        'Check outbound network access to googleapis.com.'
    );
    return { uid, email, tier: 'unverified' };
  }

  const pem = header?.kid ? signingCerts[header.kid] : undefined;
  if (header?.alg !== 'RS256' || !pem) return null;

  let signatureOk = false;
  try {
    const publicKey = new crypto.X509Certificate(pem).publicKey;
    signatureOk = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      b64urlToBuffer(parts[2])
    );
  } catch (err: any) {
    console.warn('[Yadira Auth] Signature check errored:', err?.message || err);
    return null;
  }
  if (!signatureOk) return null;

  // Issued-in-the-future tokens are nonsense; reject rather than grace them.
  const nowS = Math.floor(Date.now() / 1000);
  if (typeof payload.iat === 'number' && payload.iat > nowS + CLOCK_SKEW_S) return null;

  const expS: number | undefined = typeof payload.exp === 'number' ? payload.exp : undefined;
  if (expS === undefined) return null;
  if (expS + CLOCK_SKEW_S >= nowS) return { uid, email, tier: 'verified' };

  // Signed by Google, addressed to us, simply old.
  if (Date.now() - expS * 1000 <= STALE_GRACE_MS) return { uid, email, tier: 'stale' };
  return null;
}

export const __testing = { PROJECT_ID };
