import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken, type TokenTier } from './firebaseToken';

export interface AuthenticatedRequest extends Request {
  user?: { uid: string; email?: string };
  /** How much the identity above can be trusted — see firebaseToken.ts. */
  authTier?: TokenTier;
  token?: string;
}

/**
 * Paths that must keep working on a token that has aged out.
 *
 * The reasoning behind the original exemption still holds: a family missing a
 * brief lucid window, or a patient's help button failing, because a token
 * expired would be unforgivable. What changed is *how* that resilience is
 * bought. These paths no longer skip authentication altogether — they accept
 * a token whose signature still checks out but whose expiry has passed
 * ('stale'), and they accept having no token at all (an anonymous demo
 * session, which circleOf() then confines to the shared demo circle).
 *
 * What they no longer accept is a forged token naming somebody else's
 * circle — which is what let a stranger clear a family's help alert.
 */
const STALE_TOKEN_OK = new Set([
  '/shared-mode',
  '/tts',
  '/aurora-mode',
  '/caregiver-alert',
  '/lucidity-alert',
  // The readout for the alert above. index.ts always claimed it followed "the
  // same resilience rules as the alert routes it sits beside" — it did not,
  // so a caregiver whose token had aged out got the help alert but a 401
  // where the explanation should be. The one screen that says whether their
  // phone is going to ring is a poor place to go dark.
  '/calls/help-status',
]);

/** These same paths stay reachable with no Authorization header at all. */
const ANONYMOUS_OK = STALE_TOKEN_OK;

/**
 * Paths where an UNVERIFIABLE identity may still name a circle: none.
 *
 * Raised in review, and correct. The 'unverified' tier exists for a server
 * that has never reached Google's signing certs — and in that state
 * verifyFirebaseToken returns the uid straight out of an UNCHECKED payload.
 * Both `aud` and `iss` are public constants, so anyone could craft a token
 * naming another family's uid and be that family on every resilience path.
 * That was true of all five before /calls/help-status joined them; adding a
 * sixth is what made it worth noticing.
 *
 * Rejecting the tier outright is only safe because the resilience it was
 * bought for now comes from somewhere better: the help alert is mirrored into
 * the family's own Firestore circle by the client (see App.tsx), which does
 * not route through this server at all. The tier was a workaround for a
 * durability problem that has since been fixed properly.
 */
const UNVERIFIED_OK = new Set<string>();

/**
 * Verify the caller's Firebase ID token and attach the identity to the
 * request. Mounted under /api, so req.path values look like "/chat".
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const resilient = STALE_TOKEN_OK.has(req.path);
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (ANONYMOUS_OK.has(req.path)) return next(); // demo circle only
      console.warn('[Yadira Auth] Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Unauthorized: missing token' });
    }

    const token = authHeader.substring(7);
    const verified = await verifyFirebaseToken(token);

    if (!verified) {
      if (ANONYMOUS_OK.has(req.path)) return next(); // fall through as anonymous
      console.warn('[Yadira Auth] Token failed verification');
      return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    // An expired-but-genuine token gets the help button through, and nothing
    // else — everywhere else the client refreshes and retries.
    if (verified.tier === 'stale' && !resilient) {
      return res.status(401).json({ error: 'Unauthorized: token expired' });
    }

    // Signatures aren't currently enforceable (never reached Google's certs),
    // so this uid came out of a payload nobody checked. It must not be allowed
    // to select a circle — see UNVERIFIED_OK above.
    if (verified.tier === 'unverified' && !UNVERIFIED_OK.has(req.path)) {
      console.warn(
        `[Yadira Auth] Refusing an unverifiable identity on ${req.path} — no Google signing certs.`
      );
      return res.status(503).json({ error: 'Authentication temporarily unavailable' });
    }

    req.user = { uid: verified.uid, email: verified.email };
    req.authTier = verified.tier;
    req.token = token;
    next();
  } catch (err: any) {
    console.error('[Yadira Auth] Middleware error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional middleware for routes that don't require auth.
 * Attaches user info when a token verifies, never fails the request.
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verified = await verifyFirebaseToken(token);
      if (verified) {
        req.user = { uid: verified.uid, email: verified.email };
        req.authTier = verified.tier;
        req.token = token;
      }
    }
  } catch {
    // Silently ignore auth errors for optional middleware
  }
  next();
};
