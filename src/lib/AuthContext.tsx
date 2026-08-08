import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo, Auth } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { isUnlinkedPatientCircle, localUid, parseJwtPayload, UNLINKED_PATIENT_EMAIL } from './localSession';
import { syncReferralForUser } from './referral';

interface AuthContextType {
  user: { uid: string; email: string | null } | null;
  token: string | null;
  sessionRole: 'caregiver' | 'patient';
  /** True when this is a patient session that never joined a care circle, so
      nothing it raises leaves the device — no banner, no phone call. */
  isUnlinkedPatient: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  enterPatientMode: () => void;
  /** Return to the role screen WITHOUT signing out — see below. */
  handOverDevice: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createLocalDemoToken(uid: string, email: string): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      uid,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      iss: 'yadira-local-dev',
    })
  );
  return `${header}.${payload}.local-dev-signature`;
}

function startLocalSession(
  email: string,
  setUser: React.Dispatch<React.SetStateAction<{ uid: string; email: string | null } | null>>,
  setToken: React.Dispatch<React.SetStateAction<string | null>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  const uid = localUid(email, localStorage.getItem('yadira_user_id'));
  const localToken = createLocalDemoToken(uid, email);
  setUser({ uid, email });
  setToken(localToken);
  localStorage.setItem('yadira_token', localToken);
  localStorage.setItem('yadira_user_id', uid);
  setError(null);
}

// Fire-and-forget: a failed (or unconfigured) welcome email must never
// surface as a signup error.
function sendWelcomeEmail(token: string) {
  fetch('/api/email/welcome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

function isFirebaseAuthConfigError(err: any): boolean {
  const code = String(err?.code || '');
  return (
    code === 'auth/configuration-not-found' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/invalid-api-key'
  );
}

// Sessions are only resumed within the SAME browser session — the marker
// lives in sessionStorage, which survives reloads (so a mid-conversation
// refresh never logs anyone out) but not new tabs/visits. A fresh visit
// always starts at the role-selection screen, even if a token or Firebase
// user is still lying around from last time.
function activeSessionRole(): 'caregiver' | 'patient' | null {
  if (typeof window === 'undefined') return null;
  const role = sessionStorage.getItem('yadira_session_role');
  if (role === 'patient' || role === 'caregiver') return role;

  // ...with one exception: a device under Care Lock.
  //
  // The rule above exists so a shared or public browser never auto-resumes
  // somebody's session. A care-locked tablet is the exact opposite situation
  // — it is a dedicated patient device, deliberately pinned to the companion
  // by a caregiver who then handed it over. When it restarts overnight, the
  // rule as written puts a login screen in front of a person with dementia
  // and asks them to pick a role. They cannot be asked for a password, and
  // they should not have to be: the account is still on the device, which is
  // the only thing that was ever in question.
  //
  // Resuming as 'caregiver' restores exactly the pre-restart state — Care
  // Lock pins the view to the companion and hides every caregiver control, so
  // the role underneath is the one it already had.
  try {
    if (localStorage.getItem('yadira_care_lock') === '1' && localStorage.getItem('yadira_token')) {
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      return 'caregiver';
    }
  } catch { /* storage blocked — fall through to the login screen */ }

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionRole, setSessionRole] = useState<'caregiver' | 'patient'>(() => {
    return activeSessionRole() === 'patient' ? 'patient' : 'caregiver';
  });
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(() => {
    if (!activeSessionRole()) return null;
    const existingToken = localStorage.getItem('yadira_token');
    if (!existingToken) return null;
    const payload = parseJwtPayload(existingToken);
    const uid = payload?.uid || payload?.user_id || payload?.sub;
    if (!uid) return null;
    return { uid, email: payload?.email ?? null };
  });
  const [token, setToken] = useState<string | null>(() => {
    // Load token from localStorage on init — only for a live browser session
    if (activeSessionRole() && typeof window !== 'undefined') {
      return localStorage.getItem('yadira_token');
    }
    return null;
  });
  const [loading, setLoading] = useState(!token); // If we have a token, we're not loading initially
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Referral bookkeeping, deliberately outside the role branches below and
      // deliberately not awaited. Every sign-in path lands here — popup,
      // email, a session resumed on reload — whereas hooking loginWithGoogle
      // would miss the others and race the session-role marker it sets after
      // the popup resolves. Nothing about signing in waits on it, and it
      // cannot fail loudly: see referral.ts.
      if (firebaseUser) void syncReferralForUser(firebaseUser.uid);

      const role = activeSessionRole();
      if (firebaseUser && role) {
        // Firebase user with a live browser session — refresh the token and
        // keep the session's existing role (don't force caregiver: the same
        // device may have been handed to a patient).
        const newToken = await firebaseUser.getIdToken();
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
        setToken(newToken);
        localStorage.setItem('yadira_token', newToken);
        localStorage.setItem('yadira_user_id', firebaseUser.uid);
        setSessionRole(role);
        setError(null);
      } else if (!firebaseUser && role) {
        // No Firebase user: keep local demo/patient sessions if present.
        const existingToken = localStorage.getItem('yadira_token');
        const payload = existingToken ? parseJwtPayload(existingToken) : null;
        const uid = payload?.uid || payload?.user_id || payload?.sub;
        if (existingToken && uid) {
          setUser({ uid, email: payload?.email ?? null });
          setToken(existingToken);
          setSessionRole(role);
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('yadira_token');
          localStorage.removeItem('yadira_user_id');
          sessionStorage.removeItem('yadira_session_role');
          setSessionRole('caregiver');
        }
      } else {
        // Fresh visit (no session marker): stay on the login/role-selection
        // screen regardless of any lingering token or Firebase user.
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      // No Firebase → local demo session, same as patient mode already does.
      // The app's design principle is to work fully without Firebase.
      console.warn('[Yadira Auth] Firebase not configured, using local demo auth mode.');
      startLocalSession(email, setUser, setToken, setError);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth as Auth, email, password);
      const newToken = await result.user.getIdToken();
      setUser({ uid: result.user.uid, email: result.user.email });
      setToken(newToken);
      localStorage.setItem('yadira_token', newToken);
      localStorage.setItem('yadira_user_id', result.user.uid);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
    } catch (err: any) {
      if (isFirebaseAuthConfigError(err)) {
        console.warn('[Yadira Auth] Firebase Auth not fully configured, using local demo auth mode.');
        startLocalSession(email, setUser, setToken, setError);
        // Without the session-role marker the auth listener treats this as a
        // fresh visit and immediately signs the demo session back out.
        sessionStorage.setItem('yadira_session_role', 'caregiver');
        setSessionRole('caregiver');
        return;
      }
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      console.warn('[Yadira Auth] Firebase not configured, using local demo auth mode.');
      startLocalSession(email, setUser, setToken, setError);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth as Auth, email, password);
      const newToken = await result.user.getIdToken();
      setUser({ uid: result.user.uid, email: result.user.email });
      setToken(newToken);
      localStorage.setItem('yadira_token', newToken);
      localStorage.setItem('yadira_user_id', result.user.uid);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
      sendWelcomeEmail(newToken);
    } catch (err: any) {
      if (isFirebaseAuthConfigError(err)) {
        console.warn('[Yadira Auth] Firebase Auth not fully configured, using local demo auth mode.');
        startLocalSession(email, setUser, setToken, setError);
        sessionStorage.setItem('yadira_session_role', 'caregiver');
        setSessionRole('caregiver');
        return;
      }
      setError(err.message || 'Signup failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      console.warn('[Yadira Auth] Firebase not configured, using local demo auth mode.');
      startLocalSession('google@yadira.local', setUser, setToken, setError);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth as Auth, new GoogleAuthProvider());
      const newToken = await result.user.getIdToken();
      setUser({ uid: result.user.uid, email: result.user.email });
      setToken(newToken);
      localStorage.setItem('yadira_token', newToken);
      localStorage.setItem('yadira_user_id', result.user.uid);
      sessionStorage.setItem('yadira_session_role', 'caregiver');
      setSessionRole('caregiver');
      // Google sign-in doubles as signup — welcome only first-time accounts.
      if (getAdditionalUserInfo(result)?.isNewUser) sendWelcomeEmail(newToken);
    } catch (err: any) {
      const code = String(err?.code || '');
      // Dismissing the Google popup is a normal action, not a failure.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (isFirebaseAuthConfigError(err)) {
        console.warn('[Yadira Auth] Firebase Auth not fully configured, using local demo auth mode.');
        startLocalSession('google@yadira.local', setUser, setToken, setError);
        sessionStorage.setItem('yadira_session_role', 'caregiver');
        setSessionRole('caregiver');
        return;
      }
      setError(err.message || 'Google sign-in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enterPatientMode = () => {
    // Always hydrate the user state, not just when no token exists. Since
    // sessions stopped auto-restoring on fresh visits, `user` is null on the
    // login screen even when a valid token sits in localStorage — previously
    // this function skipped setUser in that case and the tap did nothing.
    //
    // Note the two outcomes, because they are not the same product. With a
    // token present the device keeps the caregiver's uid, so it is INSIDE the
    // family's circle: the help button reaches them and their phone rings.
    // Without one it starts a local session in a circle of its own, which is
    // a demo — nothing it raises leaves the device. `isUnlinkedPatient` is
    // how the rest of the app tells which of the two it is standing in.
    const existingToken = localStorage.getItem('yadira_token');
    const payload = existingToken ? parseJwtPayload(existingToken) : null;
    const uid = payload?.uid || payload?.user_id || payload?.sub;
    if (existingToken && uid) {
      setUser({ uid, email: payload?.email ?? null });
      setToken(existingToken);
      setError(null);
    } else {
      startLocalSession(UNLINKED_PATIENT_EMAIL, setUser, setToken, setError);
    }
    sessionStorage.setItem('yadira_session_role', 'patient');
    setSessionRole('patient');
  };

  /**
   * Back to the role screen, still signed in.
   *
   * Until now the only way to reach that screen was to log out — which
   * removes the account, and the account is the only thing putting a device
   * in the family's circle. So the screen's own "Connected to your care
   * circle" state was unreachable on purpose: you could only land on it by
   * accident, by closing the tab and reopening. A caregiver following the
   * obvious path instead destroyed the connection on the way to using it.
   *
   * This clears the session's ROLE, not the identity. localStorage keeps the
   * token and uid; only the sessionStorage marker goes, which is exactly what
   * a fresh visit does. The patient button then reads "Connected to your care
   * circle" and means it.
   */
  const handOverDevice = () => {
    sessionStorage.removeItem('yadira_session_role');
    setSessionRole('caregiver');
    setUser(null);
    setToken(null);
    setError(null);
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        await signOut(auth as Auth);
      }
      setUser(null);
      setToken(null);
      localStorage.removeItem('yadira_token');
      localStorage.removeItem('yadira_user_id');
      sessionStorage.removeItem('yadira_session_role');
      setSessionRole('caregiver');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, sessionRole, isUnlinkedPatient: isUnlinkedPatientCircle(user?.uid), loading, error, login, signup, loginWithGoogle, enterPatientMode, handOverDevice, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
