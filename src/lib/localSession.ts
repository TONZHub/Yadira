// Local sessions — the ones that are NOT in a family's care circle.
// ------------------------------------------------------------------
// Two things in this app start a session without an account: the one-tap
// "I'm a Patient" button, and the fallback used when Firebase auth is
// unavailable. Both mint an unsigned local token whose uid carries a
// `local-` prefix, which the server insists on so a forged token can never
// claim a real family's circle (see src/server/firebaseToken.ts).
//
// A circle id IS the uid, so a local session is its own circle — it can see
// nothing the caregiver saved and the caregiver can see nothing it does. That
// is correct for a demo and wrong the moment it is mistaken for a real setup:
// a patient device started this way raises help alerts nobody receives, holds
// no escalation number, and is not on anyone's subscription, so the help
// button's phone call has nothing to call. Everything here exists so the app
// can tell the difference and say so.
//
// The device suffix fixes a second, quieter problem. The uid used to be
// derived from the email alone, which made `local-patientyadiralocal` a
// constant — every unlinked patient device in the world landed in one shared
// server-side circle, where their alert state stepped on each other's.

const DEVICE_KEY = 'yadira_local_device';

export const LOCAL_UID_PREFIX = 'local-';

/** The identity "I'm a Patient" mints when there is no account to inherit. */
export const UNLINKED_PATIENT_EMAIL = 'patient@yadira.local';

/** True when this uid belongs to a local session rather than a real account. */
export function isLocalCircle(uid: string | null | undefined): boolean {
  return !!uid && uid.startsWith(LOCAL_UID_PREFIX);
}

/**
 * True when this is a patient session that never joined anyone's circle.
 *
 * Deliberately narrower than isLocalCircle. A local session is not by itself
 * cut off: with Firebase disabled a caregiver's own account is local too, and
 * a device handed over from it inherits that uid, so the help button really
 * does reach them. The one session with nobody at the other end is the one
 * that minted its own identity from UNLINKED_PATIENT_EMAIL — which is what
 * this recognises.
 */
export function isUnlinkedPatientCircle(uid: string | null | undefined): boolean {
  return isLocalCircle(uid) && uid!.startsWith(localBase(UNLINKED_PATIENT_EMAIL));
}

function localBase(email: string): string {
  return `${LOCAL_UID_PREFIX}${email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user'}`;
}

/** A random id for this browser, minted once and then reused forever. */
function deviceSuffix(): string {
  // Storage can be absent (SSR) or refused outright (private mode, blocked
  // third-party storage). Either way the session must still start, so fall
  // back to a per-load id rather than throwing on the way in.
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

/**
 * The uid for a local session started by this email on this device.
 *
 * Stable across sign-out and sign-in, because a demo caregiver who logs back
 * in must find their data still there — the uid is what the storage keys are
 * built from. Devices that already hold a legacy suffix-free uid keep it for
 * the same reason.
 */
/** Read a JWT's payload without verifying it — identity for display only. */
export function parseJwtPayload(
  token: string
): { uid?: string; user_id?: string; sub?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export type DeviceAccount =
  /** Nobody has signed in here, and no demo has been started. */
  | { state: 'none' }
  /** A demo session left its token behind. This device is in nobody's circle. */
  | { state: 'demo' }
  /** A real account. `email` names it, so the claim can be checked at a glance. */
  | { state: 'linked'; email?: string };

/**
 * What kind of account, if any, this device is carrying.
 *
 * The first version of this asked only "is there a token?", which is a
 * question with a misleading answer. Tapping the demo button once mints a
 * token and stores it — so from then on the role screen said "Connected to
 * your care circle" on a device connected to nothing at all, permanently, and
 * the more confidently the longer it had been used. Exactly the reassurance
 * this screen exists to avoid giving falsely.
 *
 * `demo` and `none` are treated the same by callers; they are kept apart
 * because "you started a demo here" and "this device is new" are different
 * things to say to someone setting up a tablet.
 */
export function readDeviceAccount(token: string | null, storedUid: string | null): DeviceAccount {
  if (!token) return { state: 'none' };
  const payload = parseJwtPayload(token);
  const uid = storedUid || payload?.uid || payload?.user_id || payload?.sub;
  if (!uid) return { state: 'none' };
  if (isUnlinkedPatientCircle(uid)) return { state: 'demo' };
  return { state: 'linked', email: payload?.email };
}

export function localUid(email: string, existingUid?: string | null): string {
  const base = localBase(email);
  // Minted before the suffix existed. Re-deriving would orphan their data.
  if (existingUid === base) return base;
  return `${base}-${deviceSuffix()}`;
}
