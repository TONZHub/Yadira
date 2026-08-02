import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { AlertTriangle, Loader, UserRound, Shield, ALargeSmall } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TermsModal, { TERMS_VERSION } from './TermsModal';
import { useLargeFont } from '../lib/fontScale';
import EvergreenBackdrop from './EvergreenBackdrop';
import { readDeviceAccount } from '../lib/localSession';

// The logo draw-in finishes around 2.5s and holds; the frame blanks near
// 5.5s. Fade the intro out just before the blank so the wordmark never
// vanishes mid-hold.
const INTRO_MS = 5200;
const INTRO_SEEN_KEY = 'yadira_intro_seen';

export const LoginScreen: React.FC = () => {
  const { login, signup, loginWithGoogle, enterPatientMode, loading, error: authError } = useAuth();
  const [largeFont, toggleLargeFont] = useLargeFont();
  // The brand moment: "Yadira!" … then "log in?". Plays once per browser
  // session — bouncing back to this screen doesn't replay the wait.
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !sessionStorage.getItem(INTRO_SEEN_KEY);
    } catch {
      return true;
    }
  });
  const finishIntro = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch { /* storage blocked — intro just replays next time */ }
    setShowIntro(false);
  };
  useEffect(() => {
    if (!showIntro) return;
    const t = window.setTimeout(finishIntro, INTRO_MS);
    return () => window.clearTimeout(t);
  }, [showIntro]);
  // Is there a REAL account on this device for patient mode to inherit?
  //
  // "Is there a token?" was the wrong question. The demo button mints one, so
  // a single tap made this screen claim "Connected to your care circle" for
  // ever after, on a device connected to nothing — the precise false
  // reassurance it was added to prevent. readDeviceAccount tells a real
  // account from a demo's leftovers.
  const account =
    typeof window === 'undefined'
      ? ({ state: 'none' } as const)
      : readDeviceAccount(localStorage.getItem('yadira_token'), localStorage.getItem('yadira_user_id'));
  const deviceHasAccount = account.state === 'linked';
  const [screen, setScreen] = useState<'role' | 'caregiver'>('role');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [localError, setLocalError] = useState('');
  // /?terms deep-links straight to the terms (used by the landing page footer,
  // since the terms live in-app rather than as a duplicated static page).
  const [showTerms, setShowTerms] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('terms')
  );
  // Affirmative acknowledgements required to create an account. The Vivid /
  // not-medical acknowledgement is deliberately its OWN checkbox — it is the
  // ethically loaded part of this product and deserves an explicit yes.
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedCare, setAgreedCare] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Email and password required');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (isSignup && (!agreedTerms || !agreedCare)) {
      setLocalError('Please review and check both acknowledgements to create an account');
      return;
    }

    try {
      if (isSignup) {
        // Record consent before account creation; App syncs this into the
        // family's cloud store (see the pending-consent effect in App.tsx),
        // giving a durable version + timestamp record.
        localStorage.setItem(
          'yadira_pending_consent',
          JSON.stringify({ version: TERMS_VERSION, acceptedAt: Date.now(), email })
        );
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
    }
  };

  const handleGoogle = async () => {
    setLocalError('');
    // A first-time Google sign-in creates the account, so the signup tab's
    // acknowledgements apply to it the same as to email signup.
    if (isSignup && (!agreedTerms || !agreedCare)) {
      setLocalError('Please review and check both acknowledgements to create an account');
      return;
    }
    try {
      if (isSignup) {
        localStorage.setItem(
          'yadira_pending_consent',
          JSON.stringify({ version: TERMS_VERSION, acceptedAt: Date.now(), email })
        );
      }
      await loginWithGoogle();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in failed');
    }
  };

  const displayError = localError || authError;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#5C8D71] to-[#3A5D45] flex items-center justify-center p-4 overflow-hidden">
      {/* Evergreen forest backdrop — Hattie's woodland, extended to Yadira's
          front door. Decorative, behind everything. */}
      <EvergreenBackdrop className="pointer-events-none absolute inset-0 w-full h-full z-0" />

      {/* Larger-text toggle — reachable before signing in, for caregivers who
          need it from the very first screen. */}
      <button
        type="button"
        onClick={toggleLargeFont}
        aria-pressed={largeFont}
        className={`fixed top-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border font-semibold text-sm shadow-sm transition-all ${
          largeFont
            ? 'bg-white text-[#3A5D45] border-white'
            : 'bg-white/15 text-white border-white/40 hover:bg-white/25'
        }`}
        title={largeFont ? 'Normal text size' : 'Larger text'}
      >
        <ALargeSmall className="w-4 h-4" />
        {largeFont ? 'Normal text' : 'Larger text'}
      </button>

      {/* Logo intro — the wordmark draws itself in on its own cream, then
          fades to reveal the login. Tap anywhere to skip. */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="logo-intro"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }}
            onClick={finishIntro}
            role="status"
            aria-label="Yadira"
            className="fixed inset-0 z-50 bg-[#D5D1C2] flex items-center justify-center p-6 cursor-pointer"
          >
            <img
              src="/yadira-loading.gif"
              alt="Yadira"
              className="w-full max-w-[420px]"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-[#E3DFC2]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            {/* Width-based sizing — the global img height:auto reset overrides
                h-* utilities in Tailwind v4. ~118px wide ≈ 64px tall. */}
            <img src="/yadira-logo.png" alt="Yadira" className="w-[118px]" />
          </div>
          <p className="text-[#7E7D76] text-sm">Dementia Companion Platform</p>
        </div>

        {screen === 'role' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setScreen('caregiver')}
              className="w-full p-4 bg-[#3A5D45] text-white rounded-xl hover:bg-[#2B4633] transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6" />
                <div>
                  <p className="font-bold">I'm a Caregiver</p>
                  <p className="text-xs opacity-90">Sign in to manage settings and records</p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={enterPatientMode}
              disabled={loading}
              className="w-full p-4 bg-[#FCFAF5] border border-[#C4C09E] text-[#2C2C2A] rounded-xl hover:bg-[#F5F2E8] transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <UserRound className="w-6 h-6 text-[#5C8D71]" />
                <div>
                  {/* The same tap does two genuinely different things, and
                      until now they looked identical. With an account on the
                      device it resumes the real thing; without one it is a
                      demo that reaches nobody. Both are worth having — the
                      first is how a handed-over tablet gets back in after a
                      restart, the second is how anyone tries the companion —
                      so they are labelled apart rather than one removed. */}
                  <p className="font-bold">{deviceHasAccount ? 'I\'m a Patient' : 'Try the companion'}</p>
                  <p className="text-xs text-[#7E7D76]">
                    {deviceHasAccount
                      ? 'Connected to your care circle — one tap, no password'
                      : 'A demo, on this device only — not connected to a caregiver'}
                  </p>
                  {/* Name the account. A claim you can check beats a claim you
                      have to trust — and if this is not the caregiver's email,
                      the device is not set up the way they think it is. */}
                  {deviceHasAccount && account.state === 'linked' && account.email && (
                    <p className="text-[11px] text-[#8A8981] mt-0.5 break-all">
                      Signed in as <span className="font-semibold">{account.email}</span>
                    </p>
                  )}
                </div>
              </div>
            </button>
            {!deviceHasAccount && (
              <div className="rounded-xl border border-[#E3DFC2] bg-[#FCFAF5] p-3.5 text-left">
                <p className="text-xs text-[#5A594F] leading-relaxed">
                  <span className="font-bold text-[#2C2C2A]">Setting up the patient's own device?</span>{' '}
                  Sign in below with the caregiver's account first. That account staying on the device
                  is what connects their help button to your phone.
                </p>
                <p className="text-xs text-[#5A594F] leading-relaxed mt-2">
                  Once you are in, <b>hand over</b> in the header brings you back to this screen still
                  signed in — then they tap <b>I&rsquo;m a Patient</b>. On their own tablet, add the{' '}
                  <b>padlock</b> as well, so the caregiver controls are out of reach.
                </p>
                <p className="text-xs text-[#5A594F] leading-relaxed mt-2">
                  Tapping below <i>without</i> signing in starts a demo in a circle of its own. Nothing
                  it raises reaches you.
                </p>
                <button
                  type="button"
                  onClick={() => setScreen('caregiver')}
                  className="mt-2 text-xs font-bold text-[#3A5D45] underline"
                >
                  Sign in to connect this device
                </button>
              </div>
            )}
            {/* The patient path stays frictionless — the caregiver is the
                account holder who formally consents at signup. */}
            <p className="text-center text-[11px] text-[#8A8981] pt-1">
              By using Yadira you agree to the{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-[#5C8D71] font-semibold underline"
              >
                Terms &amp; Acknowledgements
              </button>
              .{' '}
              <a href="/about" className="text-[#5C8D71] font-semibold underline">
                Learn more about Yadira →
              </a>
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#2C2C2A] mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-[#C4C09E] rounded-lg focus:outline-none focus:ring-3 focus:ring-[#5C8D71] bg-[#FCFAF5] text-lg"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2C2C2A] mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="w-full px-4 py-3 border border-[#C4C09E] rounded-lg focus:outline-none focus:ring-3 focus:ring-[#5C8D71] bg-[#FCFAF5] text-lg"
                  placeholder="••••••••"
                />
              </div>

              {isSignup && (
                <div className="space-y-3 p-3.5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 w-4 h-4 accent-[#3A5D45] shrink-0"
                    />
                    <span className="text-xs text-[#5E5D57] leading-relaxed">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                        className="text-[#3A5D45] font-semibold underline"
                      >
                        Terms &amp; Acknowledgements
                      </button>
                      .
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedCare}
                      onChange={(e) => setAgreedCare(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 w-4 h-4 accent-[#3A5D45] shrink-0"
                    />
                    <span className="text-xs text-[#5E5D57] leading-relaxed">
                      I understand Yadira is <b>not a medical device</b> and never replaces human
                      care or emergency services — and if I enable Vivid Mode, I affirm I may
                      represent that person and remain responsible for my loved one's wellbeing.
                    </span>
                  </label>
                </div>
              )}

              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
                >
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{displayError}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || (isSignup && (!agreedTerms || !agreedCare))}
                className="w-full py-3 bg-[#3A5D45] text-white font-bold rounded-lg hover:bg-[#2B4633] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-5 h-5 animate-spin" />}
                {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Log In'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#E3DFC2]" />
              <span className="text-xs text-[#8A8981]">or</span>
              <div className="flex-1 h-px bg-[#E3DFC2]" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading || (isSignup && (!agreedTerms || !agreedCare))}
              className="w-full py-3 bg-white border border-[#C4C09E] text-[#2C2C2A] font-semibold rounded-lg hover:bg-[#F5F2E8] disabled:opacity-50 transition-all flex items-center justify-center gap-2.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {isSignup ? 'Sign up with Google' : 'Continue with Google'}
            </button>

            <div className="text-center mt-6">
              <p className="text-sm text-[#7E7D76]">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignup(!isSignup)}
                  disabled={loading}
                  className="text-[#5C8D71] font-semibold hover:underline disabled:opacity-50"
                >
                  {isSignup ? 'Log In' : 'Sign Up'}
                </button>
              </p>
              <button
                type="button"
                onClick={() => setScreen('role')}
                className="mt-2 text-xs text-[#5C8D71] hover:underline font-semibold"
              >
                ← Back to role selection
              </button>
            </div>

            {!isSignup && (
              <div className="mt-6 p-3 bg-[#F2FAF4] border border-[#CEDFCF] rounded-lg">
                <p className="text-xs text-[#3A5D45]">
                  <span className="font-semibold">New here?</span> Tap <span className="font-semibold">Sign Up</span> and you'll be asked whether to explore a sample family or set up the person you care for. Or use <span className="font-semibold">Try the companion</span> for a one-tap look, on this device only.
                </p>
              </div>
            )}
          </>
        )}
      </motion.div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
};
