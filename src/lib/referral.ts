// Referral links — who brought whom.
// ------------------------------------------------------------------
// Every signed-in caregiver gets a permanent code on first login, and a link
// carrying it (`yadira.chat/?ref=CODE`). When someone lands on that link and
// signs up, the signup is written down and the referrer's counter ticks.
//
// Firestore layout (deliberately OUTSIDE careCircles/, which is one family's
// private data — a referral is a relationship between two circles and cannot
// live inside either):
//
//   referrals/{uid}
//     code            string     — "YADIRA-X7K2", permanent
//     createdAt       timestamp
//     signupsFromCode number     — how many accounts this code brought in
//
//   referralSignups/{newUserUid}
//     referredBy      string     — the code they arrived with
//     referrerUid     string     — who owns that code
//     createdAt       timestamp
//
// Two rules run through everything below:
//
//   1. This is marketing telemetry sitting in the middle of an app that a
//      family with dementia depends on. It must never be able to block, slow,
//      or fail a sign-in. Every function here swallows its own errors and
//      returns something harmless.
//   2. It only ever runs for a real Firebase account. Local demo sessions and
//      unlinked patient devices (see localSession.ts) have uids that no
//      Firestore rule will authenticate, so writing for them would produce
//      nothing but permission errors in a caregiver's console.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  generateReferralCode,
  normalizeReferralCode,
  splitRefFromUrl,
  timestampReferralCode,
} from './referralCode';

const STORAGE_KEY = 'yadira_ref';

export interface ReferralRecord {
  code: string;
  /** How many accounts this code has brought in. */
  signups: number;
  /** True only on the login that minted it — i.e. this account's first ever. */
  created: boolean;
}

function cloudReady(): boolean {
  return Boolean(isFirebaseConfigured && db);
}

// ---------- the code in the URL ----------

/**
 * Reads `?ref=CODE` off the current URL and parks it in localStorage.
 *
 * Called at app boot, before anything is rendered, because the code arrives on
 * a visit that is almost never a sign-in: someone taps a link, reads the page,
 * closes it, and comes back the next day to sign up. localStorage is what
 * carries the attribution across that gap. The param is stripped from the URL
 * on the way through — see splitRefFromUrl for why.
 */
export function captureRefFromURL(): void {
  if (typeof window === 'undefined') return;
  try {
    const { code, cleanedUrl } = splitRefFromUrl(window.location.href);
    if (cleanedUrl !== null) {
      window.history.replaceState({}, '', cleanedUrl);
    }
    if (code) {
      localStorage.setItem(STORAGE_KEY, code);
    }
  } catch {
    /* blocked storage or an exotic URL — a lost referral, nothing more */
  }
}

/** Reads the parked code and forgets it, so it is only ever spent once. */
export function consumeStoredRef(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}

// ---------- minting ----------

async function codeIsTaken(code: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db!, 'referrals'), where('code', '==', code), limit(1))
  );
  return !snap.empty;
}

async function mintUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    if (!(await codeIsTaken(code))) return code;
  }
  // Five collisions in a 1M-code space means the rolls aren't the problem —
  // most likely reads are failing open. A timestamp code cannot collide with
  // one minted in another millisecond, so stop rolling and take it.
  return timestampReferralCode();
}

/**
 * This account's referral record, creating it if this is their first login.
 *
 * Idempotent, and safe to call from anywhere — the UI calls it too, so a
 * caregiver who opens Settings before the sign-in hook has finished still sees
 * a code rather than an empty card. Returns null if the cloud is unavailable
 * or refuses us, which is the signal to show nothing at all.
 */
export async function ensureReferralRecord(uid: string): Promise<ReferralRecord | null> {
  if (!cloudReady() || !uid) return null;
  try {
    const ref = doc(db!, 'referrals', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const code = normalizeReferralCode(data.code);
      // A record with no usable code is corrupt rather than absent. Rewriting
      // it would hand this account a second identity and orphan the signups
      // already attributed to the first, so leave it alone and stay quiet.
      if (!code) return null;
      return { code, signups: Number(data.signupsFromCode) || 0, created: false };
    }

    const code = await mintUniqueCode();
    await setDoc(ref, { code, createdAt: serverTimestamp(), signupsFromCode: 0 });
    return { code, signups: 0, created: true };
  } catch (err) {
    console.warn('[Yadira] Referral code unavailable:', err);
    return null;
  }
}

// ---------- attribution ----------

/**
 * Writes down that `newUserUid` arrived on `code`, and ticks the owner's count.
 *
 * Silently does nothing when the code is unknown, when someone tries to refer
 * themselves, or when this account has already been attributed to somebody —
 * the first referrer keeps the signup, and a second link cannot steal it.
 */
export async function applyReferralCode(newUserUid: string, code: string): Promise<void> {
  if (!cloudReady() || !newUserUid) return;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;

  try {
    const owners = await getDocs(
      query(collection(db!, 'referrals'), where('code', '==', normalized), limit(1))
    );
    if (owners.empty) return;

    const referrerUid = owners.docs[0].id;
    if (referrerUid === newUserUid) return;

    const signupRef = doc(db!, 'referralSignups', newUserUid);
    if ((await getDoc(signupRef)).exists()) return;

    await setDoc(signupRef, {
      referredBy: normalized,
      referrerUid,
      createdAt: serverTimestamp(),
    });

    // Deliberately after the signup doc, and deliberately not fatal. The
    // signup record is the truth; the counter is a convenience that saves
    // querying the whole collection to answer "how many?". If the tick fails,
    // the count is recoverable from referralSignups and nothing is lost.
    try {
      await updateDoc(doc(db!, 'referrals', referrerUid), { signupsFromCode: increment(1) });
    } catch (err) {
      console.warn('[Yadira] Referral counted but not tallied:', err);
    }
  } catch (err) {
    console.warn('[Yadira] Referral not recorded:', err);
  }
}

// ---------- the one call the auth layer makes ----------

// onAuthStateChanged fires on every token refresh, and React's StrictMode
// mounts the listener twice in development. Without this, one sign-in races
// itself into two code lookups and — worse — two attribution attempts.
const inFlight = new Map<string, Promise<void>>();

/**
 * Everything the referral system needs from a completed sign-in.
 *
 * Fire-and-forget by design: the caller must not await this, and it never
 * throws. Attribution is limited to the login that MINTED the account's code,
 * which is the only moment that is unambiguously a new signup — an existing
 * caregiver who later clicks a friend's link is a visit, not a referral, and
 * counting them would inflate the number the giveaway is decided on.
 */
export function syncReferralForUser(uid: string): Promise<void> {
  if (!cloudReady() || !uid) return Promise.resolve();
  const existing = inFlight.get(uid);
  if (existing) return existing;

  const run = (async () => {
    // Read the parked code first and unconditionally: whatever happens next,
    // it has been spent. Leaving it behind would let it apply to whoever signs
    // in on this browser afterwards, which on a shared family device is the
    // wrong person entirely.
    const incoming = consumeStoredRef();
    const record = await ensureReferralRecord(uid);
    if (record?.created && incoming) {
      await applyReferralCode(uid, incoming);
    }
  })().catch((err) => {
    console.warn('[Yadira] Referral sync failed:', err);
  });

  inFlight.set(uid, run);
  return run;
}
