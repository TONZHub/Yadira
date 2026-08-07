import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  Heart, 
  User, 
  Users,
  Plus, 
  Trash, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  Activity, 
  Check, 
  Image as ImageIcon, 
  AlertTriangle, 
  Send, 
  RefreshCw, 
  Sliders, 
  PlusCircle,
  HelpCircle,
  Shield,
  HeartHandshake,
  Music2,
  LogOut,
  UserRoundCheck,
  Phone,
  PhoneOff,
  Tent,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  ALargeSmall,
  Moon,
  Sun,
  Mail
} from 'lucide-react';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Message, Memory, CustomFAQ, DailyLog, RoutineItem, PersonaFile, SessionMoment, MoodCheckIn, GalleryPhoto } from './types';
import { DEFAULT_PROFILE, DEFAULT_PERSONA_FILE } from './types';
import { useStoreList, useStoreDoc } from './lib/useStore';
import { PRICE_SHORT, planOf, TRIAL_LABEL, type Plan } from './lib/pricing';
import { weekKey } from './server/briefingEmail';
import { useLargeFont } from './lib/fontScale';
import { useTheme, THEMES } from './lib/theme';
import { getCircleId, isFirebaseConfigured } from './lib/firebase';
import { CALLE_REGIONS } from './server/calleRegions';
import { VoiceInput, MediaUpload, EmotionBadge, LoginScreen, AuroraScreen, DigestibleMessage, FamilySetup, SensoryRoomsMenu, RainyWindow, AutumnLeaves, ForestCanopy, StillWater, ClubMenu, MemoryPairs, HattiesTune, SlidingNumbers, CallScreen, CampCheckIn, TermsModal, TERMS_VERSION, PhotoAlbum, CloneVoiceModal, CaregiverTour, tourSeenKey } from './components';
import type { FamilyPackApply } from './components';
import type { RoomId } from './lib/sensoryRooms';
import type { GameId } from './lib/hattieClub';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { devToken, setDevToken, clearDevToken, registerTap, type TapState } from './lib/devMode';
import { INITIAL_LOGS, INITIAL_MEMORIES, INITIAL_FAQS, DEFAULT_ROUTINE } from './lib/initialData';
import MemoriesTab from './components/hub/MemoriesTab';
import TodayTab from './components/hub/TodayTab';
import SettingsTab from './components/hub/SettingsTab';
import PatientView from './components/PatientView';
import { ToastProvider, useToast } from './lib/ToastContext';
import { DEMO_MEMORIES, DEMO_FAQS, DEMO_LOGS, DEMO_ROUTINE } from './lib/demoData';
import { playMemorySoundscape } from './lib/soundscapes';
import { ChatMessageSkeleton, MemorySkeleton, RoutineSkeleton, LogSkeleton } from './components/LoadingSkeletons';
import LodgeScreen from './lodge/LodgeScreen';
import { Hattie } from './components/Hattie';

// Realistic pre-populated clinical logs for a high-fidelity starting state (caregiver charts look populated immediately)

function AppContent() {
  const { user, sessionRole, isUnlinkedPatient, handOverDevice, logout } = useAuth();
  const isPatientSession = sessionRole === 'patient';
  // A patient session that never joined a care circle sits in one of its own:
  // the caregiver never receives what it raises, it holds no escalation
  // number, and it is on nobody's subscription. Nothing here can fix that —
  // only signing the device in can — but the app must stop promising help is
  // coming when it demonstrably is not. See src/lib/localSession.ts.
  const helpReachesCaregiver = !isUnlinkedPatient;
  const { error: toastError, success: toastSuccess } = useToast();
  const [demoSeeded, setDemoSeeded] = useState(false);
  // First run for a caregiver: the Family Setup modal, opened as a question
  // rather than reached from a menu. Distinct from showFamilySetup so the
  // first-run copy and the skip-the-confirm behaviour only apply here.
  const [firstRunSetup, setFirstRunSetup] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Developer mode. The frame-integrity work made the companion impossible to
  // interrogate — which is correct for a patient and useless for whoever is
  // testing it. Seven taps on the hub's logo asks for the secret; the server
  // refuses unless DEV_MODE_SECRET is configured there and matches, so on any
  // deployment nobody has deliberately configured this cannot be entered at
  // all. The logo only renders on the Caregiver Hub, so the gesture is not
  // merely hidden from the patient's screen — it is not on it.
  const [devActive, setDevActive] = useState(() => !!devToken());
  const devTapRef = useRef<TapState>({ count: 0, lastAt: 0 });
  const handleLogoTap = () => {
    if (isPatientSession || careLocked) return;
    const { next, opened } = registerTap(devTapRef.current, Date.now());
    devTapRef.current = next;
    if (!opened) return;
    const secret = window.prompt(
      'Developer mode\n\nThis turns OFF the protections that keep the companion in character — it is for testing, never for a session with a patient.\n\nEnter the developer secret (DEV_MODE_SECRET on the server). Leave blank to cancel.'
    );
    if (!secret) return;
    setDevToken(secret.trim());
    setDevActive(true);
    toastSuccess('Developer mode on', 'Character protections are off for this browser session. Close the tab to end it.');
  };
  const endDevMode = () => {
    clearDevToken();
    setDevActive(false);
    toastSuccess('Developer mode off', 'The companion is back in character.');
  };


  // Auth headers for API requests that must fail *silently* (drift, reflection)
  // — apiCall below raises a toast on failure, which is wrong for background
  // calls the patient should never notice.
  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('yadira_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // Helper to add auth token to API requests
  const apiCall = async (url: string, options: RequestInit = {}) => {
    try {
      const token = localStorage.getItem('yadira_token');
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const response = await fetch(url, { ...options, headers });
      if (!response.ok && response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err: any) {
      toastError('Network Error', err.message || 'Failed to reach server');
      throw err;
    }
  };

  // Larger-text accessibility toggle — device-wide, persisted.
  const [largeFont, toggleLargeFont] = useLargeFont();
  const { theme: dashTheme, dark: darkMode, setTheme: setDashTheme, setDark: setDarkMode } = useTheme();
  // Honor the OS "reduce motion" setting — for vestibular sensitivity, and
  // because constant background drift can be dysregulating for a dementia
  // patient. When set, the ambient blobs hold still (CSS animations are
  // quieted globally in index.css).
  const reduceMotion = useReducedMotion();

  // Navigation: 'patient' or 'caregiver'
  const [activeTab, setActiveTab] = useState<'patient' | 'caregiver'>(isPatientSession ? 'patient' : 'caregiver');
  // Secondary caregiver hub navigation
  type CaregiverTab = 'today' | 'talk' | 'lodge' | 'memories' | 'settings';
  const [caregiverTab, setCaregiverTab] = useState<CaregiverTab>('talk');
  const isCaregiverPreview = !isPatientSession && activeTab === 'patient';
  useEffect(() => {
    if (isPatientSession && activeTab !== 'patient') {
      setActiveTab('patient');
    }
  }, [isPatientSession, activeTab]);

  // ---- Care Lock ----
  // Born from a real incident: a grandmother trying to zoom wiped the family's
  // data because a stray touch reached a caregiver control. When locked, this
  // DEVICE is pinned to the patient view — the tab switcher and logout vanish,
  // so no destructive control is reachable. Unlocking requires pressing and
  // holding the lock for 3 seconds plus a confirm, which no accidental gesture
  // can perform. Deliberately per-device (localStorage, not the synced store):
  // locking the patient's tablet must never lock the caregiver's own phone.
  const [careLocked, setCareLocked] = useState(() => {
    try { return localStorage.getItem('yadira_care_lock') === '1'; } catch { return false; }
  });
  const setCareLock = (locked: boolean) => {
    setCareLocked(locked);
    try { localStorage.setItem('yadira_care_lock', locked ? '1' : '0'); } catch { /* non-fatal */ }
  };
  useEffect(() => {
    if (careLocked && activeTab !== 'patient') setActiveTab('patient');
  }, [careLocked, activeTab]);
  // Press-and-hold unlock plumbing
  const unlockHoldRef = useRef<number | null>(null);
  const [unlockHolding, setUnlockHolding] = useState(false);
  const beginUnlockHold = () => {
    if (unlockHoldRef.current) return;
    setUnlockHolding(true);
    unlockHoldRef.current = window.setTimeout(() => {
      unlockHoldRef.current = null;
      setUnlockHolding(false);
      if (window.confirm('Unlock caregiver controls on this device?')) {
        setCareLock(false);
        playSoundCue('chime');
      }
    }, 3000);
  };
  const cancelUnlockHold = () => {
    if (unlockHoldRef.current) {
      window.clearTimeout(unlockHoldRef.current);
      unlockHoldRef.current = null;
    }
    setUnlockHolding(false);
  };

  // ---- Full screen ----
  // Hides the browser's own chrome — address bar, tabs — which are the last
  // stray-tap targets left once Care Lock removes the in-app ones. State is
  // tracked via the fullscreenchange event because Esc exits behind our back.
  const fullscreenSupported =
    typeof document !== 'undefined' &&
    !!(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);
  const enterFullscreen = () => {
    const el: any = document.documentElement;
    try {
      (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
    } catch { /* unsupported or denied — non-fatal */ }
  };
  const exitFullscreen = () => {
    const d: any = document;
    try {
      (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch?.(() => {});
    } catch { /* ignore */ }
  };

  // Caregiver Config State — now persisted (was lost on refresh before)
  const [profile, setProfile] = useStoreDoc('profile', DEFAULT_PROFILE);
  const { 
    patientName, 
    patientStage, 
    patientHobbies, 
    patientWakeTime, 
    patientSleepTime, 
    caregiverName, 
    caregiverRelationship,
    representedPersona,
    representedVoiceId,
    driftTimeoutSeconds,
    driftEnabled,
    companionPersonality,
    yadiraVoice
  } = profile;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Guard the split-second mode-reconciliation flash. On load several sources
  // (cached profile, shared-mode localStorage, the server poll) settle the
  // patient mode, and their brief disagreement could flash the wrong companion
  // — Beth for an instant before Yadira — breaking the illusion. Everything
  // patient-facing (styling, name, and the greeting) reads this stable value,
  // which holds the mount-time mode until reconciliation settles (modeReady),
  // then commits to the real mode exactly once instead of thrashing.
  const [modeReady, setModeReady] = useState(false);
  const mountPatientModeRef = useRef(profile.patientMode);
  const patientMode = modeReady ? profile.patientMode : mountPatientModeRef.current;
  
  const setPatientName = (v: string) => setProfile({ ...profile, patientName: v });
  const setPatientStage = (v: string) => setProfile({ ...profile, patientStage: v });
  const setPatientHobbies = (v: string) => setProfile({ ...profile, patientHobbies: v });
  const setPatientWakeTime = (v: string) => setProfile({ ...profile, patientWakeTime: v });
  const setPatientSleepTime = (v: string) => setProfile({ ...profile, patientSleepTime: v });
  const setCaregiverName = (v: string) => setProfile({ ...profile, caregiverName: v });
  const setCaregiverRelationship = (v: string) => setProfile({ ...profile, caregiverRelationship: v });
  const setPatientMode = (v: 'lucid' | 'vivid') => {
    setProfile({ ...profileRef.current, patientMode: v });
    // Same-browser fast path: fires the native `storage` event in any other
    // tab of this browser sharing localStorage.
    localStorage.setItem('yadira_shared_mode', JSON.stringify({ mode: v, at: Date.now() }));
    // Cross-context path: also push to the backend so two genuinely separate
    // browser tabs/devices (which don't share localStorage) stay in sync too.
    fetch('/api/shared-mode', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode: v, circle: getCircleId() }),
    }).catch((err) => console.warn('[Yadira] shared-mode push failed', err));
  };
  const setRepresentedPersona = (v: string) => setProfile({ ...profile, representedPersona: v });
  const setCompanionPersonality = (v: NonNullable<typeof profile.companionPersonality>) =>
    setProfile({ ...profile, companionPersonality: v });
  const setYadiraVoice = (v: 'female' | 'male') => setProfile({ ...profile, yadiraVoice: v });
  const setRepresentedVoiceId = (v: string) => setProfile({ ...profile, representedVoiceId: v });
  const [showCloneVoice, setShowCloneVoice] = useState(false);
  const setDriftTimeoutSeconds = (v: number) => setProfile({ ...profile, driftTimeoutSeconds: v });
  const setDriftEnabled = (v: boolean) => setProfile({ ...profile, driftEnabled: v });

  // Persisted stores — localStorage today, Firestore the moment config exists
  const [memories, setMemories] = useStoreList<Memory>('memories', INITIAL_MEMORIES);
  const [faqs, setFaqs] = useStoreList<CustomFAQ>('faqs', INITIAL_FAQS);
  const [logs, setLogs] = useStoreList<DailyLog>('logs', INITIAL_LOGS, 'date');
  const [routine, setRoutine] = useStoreList<RoutineItem>('routine', DEFAULT_ROUTINE);
  // The family's shared photo album — every photo uploaded in chat is kept
  // here (it used to be analyzed and thrown away), and caregivers can add,
  // recaption, or remove photos from the Hub. Capped so the localStorage
  // mirror stays comfortably under browser quota.
  const [galleryPhotos, setGalleryPhotos] = useStoreList<GalleryPhoto>('gallery', []);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const GALLERY_CAP = 40; // oldest photos roll off past this
  const addPhotoToGallery = (
    photoDataUrl: string,
    insight: { description: string; emotion: string; caption?: string },
    addedBy: GalleryPhoto['addedBy']
  ) => {
    const photo: GalleryPhoto = {
      id: `photo-${Date.now()}`,
      dataUrl: photoDataUrl,
      // The vision model's short caption reads better in the album than the
      // full description; fall back to the description for older responses.
      caption: insight.caption || insight.description,
      emotion: insight.emotion,
      addedAt: Date.now(),
      addedBy,
    };
    setGalleryPhotos((prev) => [...prev, photo].slice(-GALLERY_CAP));
  };
  // Caption editing in the Hub's album manager
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const saveCaption = () => {
    const id = editingPhotoId;
    const caption = editingCaption.trim();
    setEditingPhotoId(null);
    if (!id || !caption) return;
    setGalleryPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
  };
  // Patient's daily emotional check-ins with Hattie at camp (keyed by date).
  const [checkins, setCheckins, checkinsSynced] = useStoreList<MoodCheckIn>('checkins', [], 'date');

  // Consent record — the caregiver's Terms acceptance (version + timestamp),
  // captured at signup (LoginScreen writes yadira_pending_consent) and synced
  // here into the family's cloud store so it survives devices and is auditable.
  const [consent, setConsent] = useStoreDoc<{ version?: string; acceptedAt?: number; email?: string }>('consent', {});
  useEffect(() => {
    if (consent.acceptedAt) return; // already recorded for this circle
    try {
      const pending = localStorage.getItem('yadira_pending_consent');
      if (!pending) return;
      const parsed = JSON.parse(pending);
      if (parsed?.acceptedAt && parsed?.version) {
        setConsent(parsed);
        localStorage.removeItem('yadira_pending_consent');
      }
    } catch {
      // Malformed pending record — ignore rather than block the app.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent.acceptedAt]);

  // Terms §9 mechanism: when the terms version changes after a caregiver
  // already consented, a Hub banner asks them to review and re-accept the new
  // version. Never shown to patients; never blocks the companion.
  const termsOutdated = !isPatientSession && !!consent.acceptedAt && consent.version !== TERMS_VERSION;
  const [showTermsReview, setShowTermsReview] = useState(false);
  const acceptUpdatedTerms = () => {
    setConsent({ version: TERMS_VERSION, acceptedAt: Date.now(), email: consent.email });
    setShowTermsReview(false);
    toastSuccess('Thank you', `Terms version ${TERMS_VERSION} accepted and recorded.`);
  };

  // The persona file — session-to-session memory. Written to after every
  // conversation (see runReflection), read into every chat prompt. This is
  // what separates Yadira from tools that forget the people who forget.
  const [personaFile, setPersonaFile] = useStoreDoc<PersonaFile>('personaFile', DEFAULT_PERSONA_FILE);

  // ---- Check-in calls (CALL-E) ----
  // Yadira on the telephone, for the days the tablet is too much. The number
  // lives in the care circle so both caregiver devices see the same one; the
  // last readout is kept so the caregiver can see how the last call went
  // without hunting for it.
  // ---- Help-button call (CALL-E) ----
  // The caregiver's own number, rung the moment the patient asks for help.
  // A banner is easy to miss; a ringing phone is not.
  const [helpCall, setHelpCall] = useStoreDoc<{
    /** The CAREGIVER's number. There is deliberately nowhere here to put the
        patient's: Yadira does not phone the patient. */
    escalationPhone?: string;
    /** CALL-E calling region — chosen, never inferred. Decides which line the
        call comes from. */
    region?: string;
    // Storage key kept as 'checkInCall' from when this card also placed
    // patient calls — renaming it would silently drop a number a caregiver
    // has already saved.
  }>('checkInCall', {});

  // Why the last help call did or did not ring. Every branch is silent to the
  // patient by design; the caregiver is the one person who needs to know.
  const [helpCallStatus, setHelpCallStatus] = useState<{ status: string; detail: string; at: number } | null>(null);
  const [testingCall, setTestingCall] = useState(false);

  // "Send me a test call" — hearing it once, on your own terms, is the only way
  // to know it works before the night you need it. It also tells you what the
  // number looks like on your screen, which is worth more than it sounds: a
  // real call arrives from an unfamiliar number at an unsociable hour.
  const sendTestCall = async () => {
    const phone = (helpCall.escalationPhone || '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      toastError('Check your number', 'Use the full international form, e.g. +15551234567.');
      return;
    }
    setTestingCall(true);
    try {
      const res = await fetch('/api/calls/test', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          toPhone: phone,
          patientName: profile.patientName,
          caregiverName: profile.caregiverName,
          region: helpCall.region || undefined,
          isPremium,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toastSuccess('Calling you now', 'It usually takes a minute or two to ring. Save the number as a contact when it does.');
    } catch (err: any) {
      toastError('Test call not sent', err?.message || 'Please try again.');
    } finally {
      setTestingCall(false);
    }
  };
  useEffect(() => {
    if (isPatientSession) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/calls/help-status', { headers: authHeaders() });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.status && data.status !== 'none') setHelpCallStatus(data);
      } catch { /* best-effort */ }
    };
    poll();
    const id = window.setInterval(poll, 5000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [isPatientSession]);
  const personaFileRef = useRef(personaFile);
  personaFileRef.current = personaFile;

  // What a brand-new circle starts with.
  // ------------------------------------------------------------------
  // This used to seed Eleanor's family silently on first login, and that had a
  // sharp edge on the caregiver side: `logs` goes straight to
  // /api/insights/summarize and to Ask Yadira, which the app describes as
  // "grounded in the patient's own records". So a real caregiver could, on day
  // one, generate a clinical insight report about a fictional woman's sleep
  // and confusion — indistinguishable from a real one about their own mother.
  // For a product whose own rule is that a fabricated wellbeing signal gets
  // charted and acted on, that is the wrong default.
  //
  // A caregiver is now ASKED, using the Family Setup modal that already
  // existed: a sample family to explore, or their own from scratch. Both paths
  // already worked; only the moment of choosing is new.
  //
  // A patient/demo session still seeds silently, because there is nobody there
  // to ask and a companion with no memories is not a demo of anything. That is
  // the "Try the companion" path, which is a demo by name.
  useEffect(() => {
    if (!user || demoSeeded) return;
    // Per-circle flag: each new family gets this once, and a second account on
    // the same browser doesn't inherit the first's flag.
    const seededKey = `yadira_${getCircleId()}_seeded_demo`;
    if (localStorage.getItem(seededKey) === 'true') return;

    if (sessionRole === 'patient') {
      setMemories(DEMO_MEMORIES);
      setFaqs(DEMO_FAQS);
      setLogs(DEMO_LOGS);
      setRoutine(DEMO_ROUTINE);
      localStorage.setItem(seededKey, 'true');
      setDemoSeeded(true);
      toastSuccess('Welcome back', `${patientName || 'Eleanor'}, you are safe and supported.`);
      return;
    }

    // Caregiver: ask rather than assume. Marked handled immediately so the
    // effect doesn't reopen the modal on every re-render; the flag is written
    // when they choose (or when they close, meaning "start empty").
    setDemoSeeded(true);
    setFirstRunSetup(true);
  }, [user, demoSeeded, sessionRole, patientName]);

  useEffect(() => {
    const applySharedMode = (nextMode: unknown) => {
      if ((nextMode === 'lucid' || nextMode === 'vivid') && profileRef.current.patientMode !== nextMode) {
        setProfile({ ...profileRef.current, patientMode: nextMode });
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'yadira_shared_mode' || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { mode?: 'lucid' | 'vivid' };
        applySharedMode(parsed.mode);
      } catch {
        // Ignore malformed sync payloads.
      }
    };

    const existingLocal = localStorage.getItem('yadira_shared_mode');
    if (existingLocal) {
      try {
        const parsed = JSON.parse(existingLocal) as { mode?: 'lucid' | 'vivid' };
        applySharedMode(parsed.mode);
      } catch {
        // Ignore malformed local payloads.
      }
    }

    window.addEventListener('storage', onStorage);

    // Poll the backend too. The `storage` event only reaches other tabs of
    // the SAME browser — it never fires for genuinely separate browser
    // windows/devices. Polling the shared server state is what makes the
    // caregiver tab and patient tab agree even when they aren't sharing
    // localStorage.
    let cancelled = false;
    // Reveal the settled mode once the first reconciliation completes, so the
    // patient view commits to the real mode exactly once instead of flashing.
    const settle = () => { if (!cancelled) setModeReady(true); };
    const poll = async () => {
      try {
        const res = await fetch(`/api/shared-mode?circle=${encodeURIComponent(getCircleId())}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) applySharedMode(data?.mode);
        }
      } catch {
        // Best-effort — ignore transient network errors during polling.
      } finally {
        settle();
      }
    };
    poll();
    const intervalId = window.setInterval(poll, 1500);
    // Safety net: never leave the companion gated if the first poll hangs.
    const settleFallback = window.setTimeout(settle, 1200);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
      window.clearTimeout(settleFallback);
    };
  }, []);

  // ---- Caregiver Pro (paid tier: unlimited AI care reports; companion is free) ----
  // Persisted per circle so both the caregiver's and patient's devices agree.
  // Real Stripe checkout flips `unlocked` (after server-side verification of
  // the paid session); the demo toggle remains as a fallback only when
  // STRIPE_SECRET_KEY isn't configured on the server.
  const [premium, setPremium, premiumSynced] = useStoreDoc<{
    unlocked: boolean;
    /** Premium via a free trial rather than a paid subscription. */
    trialing?: boolean;
    subscriptionId?: string;
    customerId?: string;
    currentPeriodEnd?: number; // ms epoch, from Stripe
  }>('premium', { unlocked: false });
  const isPremium = !!premium.unlocked;
  const [premiumBusy, setPremiumBusy] = useState(false);

  // The whole patient-facing companion is free — natural voice, Call Mode,
  // Session Memory, calming rooms, photos, and an unlimited memory bank. The
  // families we serve never meet a paywall on the sound of someone they love.
  // `isPremium` now gates only the caregiver's *professional* tooling: the
  // Gemini-powered AI care reports, where each generation is a real API cost.
  // Free caregivers get one routine + one insights report per week; Caregiver
  // Pro / facility partners are unlimited. Timestamps persist per circle so a
  // refresh doesn't reset them.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  // How many times a person must be mentioned in a single Lucid session before
  // Yadira suggests inviting them via Vivid mode.
  const VIVID_INVITE_THRESHOLD = 3;

  // Yadira's own Inworld voices (Lucid mode). Vivid mode always speaks with
  // the represented persona's voice — Yadira and the loved one must never
  // share a voice, or the identities blur for the patient.
  const YADIRA_VOICES: Record<'female' | 'male', string> = {
    female: 'zippy-pecan-9151__design-voice-6cd2e59a',
    male: 'zippy-pecan-9151__design-voice-87c0a467',
  };
  const [aiUsage, setAiUsage] = useStoreDoc<{ lastInsightsAt?: number; lastRoutineAt?: number; caregiverChatCount?: number; lastBriefingEmailAt?: number }>('aiUsage', {});

  // ---- Ask Yadira: the caregiver's co-pilot chat (Caregiver Pro tooling) ----
  const CAREGIVER_CHAT_FREE_LIMIT = 5;
  const [caregiverChat, setCaregiverChat] = useStoreList<Message>('caregiverChat', []);
  const [caregiverInput, setCaregiverInput] = useState('');
  const [caregiverTyping, setCaregiverTyping] = useState(false);
  const caregiverLogRef = useRef<HTMLDivElement>(null);

  // Returning from Stripe Checkout: verify the session server-side, then
  // persist the subscription onto the circle's premium doc. Patient sessions
  // never see this — Stripe redirects land on the caregiver's device.
  useEffect(() => {
    if (isPatientSession) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('premium_session');
    const canceled = params.get('premium_canceled');
    if (!sessionId && !canceled) return;

    // Clean the URL immediately so refreshes don't re-run verification.
    window.history.replaceState({}, '', window.location.pathname);

    if (canceled) {
      toastError('Checkout canceled', 'No charge was made. Premium is still available whenever you are ready.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId!)}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (res.ok && data.active) {
          setPremium({
            unlocked: true,
            trialing: !!data.trialing,
            subscriptionId: data.subscriptionId || undefined,
            customerId: data.customerId || undefined,
            currentPeriodEnd: data.currentPeriodEnd || undefined,
          });
          toastSuccess('Caregiver Pro active', 'Thank you for sustaining Yadira! Unlimited AI care reports are now unlocked for you.');
        } else {
          toastError('Payment not confirmed', data.error || 'Stripe has not confirmed this payment yet. If you were charged, contact support.');
        }
      } catch {
        toastError('Verification failed', 'Could not reach the server to confirm your payment. Please refresh to retry.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientSession]);

  // Restore purchase: premium is stored per care circle (keyed by uid), so a
  // caregiver who recreates their account or switches sign-in provider lands
  // in a fresh circle and loses what they paid for. Once the circle's premium
  // doc has synced and still says locked, ask the server whether this
  // account's EMAIL has an active subscription — and re-unlock if so.
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (isPatientSession || premium.unlocked || restoreAttemptedRef.current) return;
    if (isFirebaseConfigured && !premiumSynced) return; // wait for the cloud doc before assuming locked
    restoreAttemptedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/stripe/restore?circle=${encodeURIComponent(getCircleId())}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return; // unconfigured/no-email/hiccup — nothing to restore
        const data = await res.json();
        if (data.found && data.active) {
          setPremium({
            unlocked: true,
            subscriptionId: data.subscriptionId || undefined,
            customerId: data.customerId || undefined,
            currentPeriodEnd: data.currentPeriodEnd || undefined,
          });
          toastSuccess('Caregiver Pro restored', 'Welcome back — your subscription followed you to this sign-in.');
        }
      } catch {
        // Best-effort: the Unlock button still works, and we retry next visit.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientSession, premium.unlocked, premiumSynced]);

  /**
   * Turn Caregiver Pro off, everywhere, in one place.
   *
   * The stale ids are the point. Leaving customerId behind kept sending the
   * caregiver to a billing portal for a customer that no longer exists — the
   * error that surfaced this whole bug — and leaving subscriptionId behind
   * would keep re-checking a subscription that is gone.
   */
  const downgradePremium = (reason: string) => {
    setPremium({ unlocked: false });
    toastError('Caregiver Pro ended', reason);
  };

  // Renewal / lapse check: once the paid-through date (plus a 3-day retry
  // grace window) has passed, re-verify the subscription with Stripe and
  // downgrade if it was canceled. Skipped entirely for demo-toggled premium
  // (no subscriptionId) and on patient devices.
  useEffect(() => {
    if (isPatientSession || !premium.unlocked || !premium.subscriptionId) return;

    // Two triggers, not one.
    //
    // The old rule only re-checked after the paid-through date plus a 3-day
    // retry grace. That is correct for an ordinary lapse, and useless for a
    // subscription cancelled or deleted mid-period: on an annual plan it
    // meant keeping Caregiver Pro for up to a year and three days. So there
    // is now also a daily check, per device, which bounds the gap to a day
    // without asking Stripe on every page load.
    const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lapsed = !!premium.currentPeriodEnd && Date.now() >= premium.currentPeriodEnd + GRACE_MS;
    const checkedKey = `yadira_${getCircleId()}_sub_checked`;
    const lastChecked = Number(localStorage.getItem(checkedKey) || 0);
    const due = Date.now() - lastChecked >= DAY_MS;
    if (!lapsed && !due) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/stripe/subscription-status?subscription_id=${encodeURIComponent(premium.subscriptionId!)}&circle=${encodeURIComponent(getCircleId())}`,
          { headers: authHeaders() }
        );
        const data = await res.json().catch(() => ({}));

        // `gone` is Stripe answering, not failing: the subscription has been
        // deleted. Everything else that is not ok is a hiccup, and a family
        // must never lose what they paid for over one.
        if (!res.ok && !data.gone) return;

        localStorage.setItem(checkedKey, String(Date.now()));

        if (data.active) {
          setPremium({
            ...premium,
            trialing: !!data.trialing,
            currentPeriodEnd: data.currentPeriodEnd || premium.currentPeriodEnd,
          });
        } else {
          downgradePremium(
            data.gone
              ? 'That subscription no longer exists in billing, so Caregiver Pro has been switched off. The companion stays free for your family.'
              : 'Your Caregiver Pro subscription is no longer active — the companion stays free for your family. You can re-subscribe any time from the Caregiver Hub.'
          );
        }
      } catch {
        // Best-effort — try again next visit rather than punishing a family
        // for a flaky connection.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientSession, premium.unlocked, premium.subscriptionId, premium.currentPeriodEnd]);

  // "Get Caregiver Pro" → Stripe Checkout. Falls back to the local demo toggle
  // only when the server reports Stripe isn't configured.
  const startPremiumCheckout = async (plan?: Plan) => {
    setPremiumBusy(true);
    try {
      // Normalised rather than trusted. When this took no arguments it was
      // safe to pass straight to onClick; the moment it took a plan, React
      // started handing it the click event instead — and JSON.stringify of a
      // synthetic event throws on its circular refs, which surfaced to the
      // caregiver as "Could not reach the server to start checkout" on a
      // request that was never sent. TypeScript could not catch it:
      // (plan?: Plan) => void is assignable to () => void.
      const chosen = planOf(plan);
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ circle: getCircleId(), plan: chosen }),
      });
      const data = await res.json();
      if (res.status === 503 && data.error === 'stripe_not_configured') {
        setPremium({ ...premium, unlocked: true });
        toastSuccess('Caregiver Pro active (demo)', 'Stripe is not configured on this server, so Caregiver Pro was enabled in demo mode.');
        return;
      }
      if (res.ok && data.url) {
        window.location.assign(data.url); // off to Stripe Checkout
        return;
      }
      toastError('Checkout unavailable', data.error || 'Could not start checkout. Please try again.');
    } catch {
      toastError('Checkout unavailable', 'Could not reach the server to start checkout.');
    } finally {
      setPremiumBusy(false);
    }
  };

  // "Manage subscription" → Stripe's hosted billing portal (cancel, card).
  const openBillingPortal = async () => {
    setPremiumBusy(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ customerId: premium.customerId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      // The customer was deleted in Stripe. This is exactly how the bug was
      // found: "Billing portal unavailable — No such customer: cus_..." while
      // the account still had every paid feature. The error already knew the
      // subscription was gone; it just was not doing anything about it.
      if (data.gone) {
        downgradePremium(
          'That subscription no longer exists in billing, so Caregiver Pro has been switched off. The companion stays free for your family.'
        );
        return;
      }
      toastError('Billing portal unavailable', data.error || 'Could not open the billing portal.');
    } catch {
      toastError('Billing portal unavailable', 'Could not reach the server.');
    } finally {
      setPremiumBusy(false);
    }
  };

  // Calming rooms — Aurora (free) plus the premium sensory rooms.
  const [showRoomsMenu, setShowRoomsMenu] = useState(false);
  const [premiumRoom, setPremiumRoom] = useState<RoomId | null>(null);

  // Hattie's Club — the games. Free, because they cost nothing to run and
  // charging for the one part of the app that looks like fun would be
  // charging for the cheapest thing in it.
  const [showClubMenu, setShowClubMenu] = useState(false);
  const [clubGame, setClubGame] = useState<GameId | null>(null);

  // ---- Camp: Hattie's daily check-in (patient-facing) ----
  // The patient meets Hattie first, taps how they're feeling, then "leaves
  // camp" to talk with Yadira. The check-in feeds mood + AI insights without
  // fabricating clinical numbers (see handleCampCheckIn).
  const todayKey = () =>
    new Date().toLocaleDateString([], { month: '2-digit', day: '2-digit' }).replace('/', '-');
  const todaysCheckIn = checkins.find((c) => c.date === todayKey());
  // Consecutive days checked in at camp — feeds the campfire's intensity.
  // If today's check-in hasn't happened yet, the count holds from yesterday
  // (the fire settles, it is never "lost" before they've had their visit).
  const checkinStreak = (() => {
    const dates = new Set(checkins.map((c) => c.date));
    const fmt = (d: Date) =>
      d.toLocaleDateString([], { month: '2-digit', day: '2-digit' }).replace('/', '-');
    const day = new Date();
    if (!dates.has(fmt(day))) day.setDate(day.getDate() - 1);
    let streak = 0;
    for (let i = 0; i < 60 && dates.has(fmt(day)); i++) {
      streak++;
      day.setDate(day.getDate() - 1);
    }
    return streak;
  })();
  const [campOpen, setCampOpen] = useState(false);
  const campAutoOpenedRef = useRef(false);
  // Auto-open camp once per patient session/day, only after the store has
  // loaded (so we don't flash camp at someone who already checked in today).
  useEffect(() => {
    if (campAutoOpenedRef.current) return;
    if (!isPatientSession) return;
    if (isFirebaseConfigured && !checkinsSynced) return;
    campAutoOpenedRef.current = true;
    if (!todaysCheckIn) setCampOpen(true);
  }, [isPatientSession, checkinsSynced, todaysCheckIn]);

  const handleCampCheckIn = (mood: DailyLog['mood']) => {
    const date = todayKey();
    setCheckins((prev) => [...prev.filter((c) => c.date !== date), { date, mood, at: Date.now() }]);
    // Reflect onto today's clinical log ONLY if the caregiver already made one
    // — never invent sleep/hydration from a single mood tap.
    setLogs((prev) =>
      prev.some((l) => l.date === date) ? prev.map((l) => (l.date === date ? { ...l, mood } : l)) : prev
    );
  };

  const moodLabel = (m: DailyLog['mood']) =>
    ({ peaceful: 'calm & content', anxious: 'a little worried', restless: 'restless', sad: 'missing someone' }[m] || m);

  // ---- Call Mode (hands-free voice session) ----
  const [isCallActive, setIsCallActive] = useState(false);

  const handleCallMessage = async (text: string) => {
    if (!text) {
      // Call connected: trigger initial greeting.
      // If the conversation is still at the opening greeting, replace it so
      // the patient doesn't see two back-to-back greetings when they return
      // from the call to the chat view.
      const greetingText = patientMode === 'vivid'
        ? `Hello, love. It's me, ${representedPersona || 'Beth'}. I'm so glad we are speaking on the phone. How are you feeling today?`
        : `Hello! I am Yadira, and I'm right here on the phone with you. How is your heart feeling today?`;

      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => {
        if (prev.length === 1 && prev[0].id === 'greet') {
          // Fresh session — update the greeting in place
          return [{ ...prev[0], text: greetingText, timestamp: ts }];
        }
        return [...prev, { id: `msg-call-greet-${Date.now()}`, role: 'model' as const, text: greetingText, timestamp: ts }];
      });
      // Force voice enabled so they can hear it
      setVoiceEnabled(true);
      speakTextDirect(greetingText);
      return;
    }

    // User spoke something! Send to AI conversation handler
    await handleSendMessage(text);
  };

  const endCallMode = () => {
    setIsCallActive(false);
    // Stop any active speaking/audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    setIsSpeaking(false);
    if (soundFeedback) playSoundCue('pop');
  };

  // ---- Aurora (intentional visual dissociation screen) ----
  const [auroraActive, setAuroraActiveState] = useState(false);

  const setAuroraActive = (active: boolean) => {
    setAuroraActiveState(active);
    // Silence Yadira when drifting — audio is jarring against the visual calm
    if (active) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      try { window.speechSynthesis.cancel(); } catch (_) {}
      setIsSpeaking(false);
    }
    // Same-browser tabs via storage event
    localStorage.setItem('yadira_aurora_mode', JSON.stringify({ active, at: Date.now() }));
    // Cross-device sync via backend
    fetch('/api/aurora-mode', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ active, circle: getCircleId() }),
    }).catch((err) => console.warn('[Yadira] aurora push failed', err));
  };

  // Launch a room from the picker. Aurora keeps its cross-device beam; the
  // premium rooms open locally on the device that chose them.
  const openRoom = (id: RoomId) => {
    setShowRoomsMenu(false);
    if (id === 'aurora') {
      setAuroraActive(true);
      return;
    }
    // Quiet Yadira's voice against the calm, same as Aurora does.
    if (activeAudioRef.current) { activeAudioRef.current.pause(); activeAudioRef.current = null; }
    try { window.speechSynthesis.cancel(); } catch (_) {}
    setIsSpeaking(false);
    setPremiumRoom(id);
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'yadira_aurora_mode' || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { active?: boolean };
        if (typeof parsed.active === 'boolean') setAuroraActiveState(parsed.active);
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/aurora-mode?circle=${encodeURIComponent(getCircleId())}`, { headers: authHeaders() });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (typeof data?.active === 'boolean') setAuroraActiveState(data.active);
      } catch { /* best-effort */ }
    };
    poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  // ---- Caregiver alert: the patient's "I need my caregiver" button ----
  // Same rails as Aurora: localStorage fast path for same-browser tabs, the
  // server map for genuinely separate devices. The patient taps once; the
  // caregiver's hub shows a banner within ~1.5s and acknowledges to clear.
  const [caregiverAlert, setCaregiverAlertState] = useState<{ active: boolean; at: number }>({ active: false, at: 0 });

  // The alert's durable copy, in the family's care circle.
  //
  // The server keeps this in a Map, which makes the cross-device hand-off fast
  // and makes it exactly as durable as one process's memory. A redeploy, a
  // restart, or Render waking from idle drops it — AFTER the patient has been
  // told someone has been told and is coming. It also does not survive a
  // second instance: the patient posts to one, the caregiver polls the other.
  //
  // So Firestore holds the truth and the server stays the fast path. Newest
  // timestamp wins, which keeps both directions honest: a restarted server
  // reporting nothing cannot clear a live alert, and a stale synced doc cannot
  // resurrect one the caregiver has already acknowledged.
  const [helpAlertDoc, setHelpAlertDoc] = useStoreDoc<{
    active: boolean;
    at: number;
    /**
     * What the caregiver said on the phone. Durable for the same reason the
     * alert is: it lived only in the server's memory, so a restart turned a
     * "no, I can't get there" back into "unknown" — and the companion resumed
     * telling the patient someone was on their way. Raised in review.
     */
    canGetThere?: 'yes' | 'no' | 'unknown';
  }>('helpAlert', { active: false, at: 0 });
  const helpAlertDocRef = useRef(helpAlertDoc);
  helpAlertDocRef.current = helpAlertDoc;

  // What the caregiver said on the phone when asked whether they can get
  // there. 'no' is the one that changes what the companion may say: promising
  // that someone is on their way, after that someone has said they cannot
  // come, is the same false reassurance as an unlinked device — and this one
  // is worse, because it is contradicted by a person who actually answered.
  const [canGetThere, setCanGetThere] = useState<'yes' | 'no' | 'unknown'>('unknown');


  // Vivid invite flow — tracks how many times each name is mentioned by the
  // patient within the current session (resets on new session / family switch).
  // When a name crosses VIVID_INVITE_THRESHOLD, a warm banner invites the
  // caregiver to enable Vivid mode for that person.
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  const [vividInviteAlert, setVividInviteAlert] = useState<{ name: string; count: number } | null>(null);

  const sendCaregiverAlert = (active: boolean) => {
    const state = { active, at: Date.now() };
    setCaregiverAlertState(state);
    localStorage.setItem('yadira_caregiver_alert', JSON.stringify(state));
    // The durable copy. Written first so a request that never lands still
    // reaches the caregiver's device through the circle. A newly raised alert
    // clears the previous call's answer: it is a fresh question, and the old
    // "no" must not silence a caregiver who can come this time.
    setHelpAlertDoc({ ...state, canGetThere: active ? 'unknown' : helpAlertDoc.canGetThere });
    if (active) setCanGetThere('unknown');
    fetch('/api/caregiver-alert', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        active,
        circle: getCircleId(),
        // Rings the caregiver as well as raising the banner. Sent from here so
        // the server needs no stored state of its own; when it is absent the
        // alert behaves exactly as it always has.
        escalationPhone: helpCall.escalationPhone || undefined,
        patientName: profile.patientName,
        caregiverName: profile.caregiverName,
        region: helpCall.region || undefined,
        // Caregiver Pro gates the phone call, never the alert itself.
        isPremium,
      }),
    }).catch((err) => console.warn('[Yadira] caregiver-alert push failed', err));
  };

  // The circle's copy arriving from Firestore, when it is newer than what we
  // are showing. The poll above merges on its own tick, but that only runs
  // when the server answers — this is the path that still works when the
  // server is the thing that is down.
  useEffect(() => {
    setCaregiverAlertState((prev) => (helpAlertDoc.at > prev.at ? helpAlertDoc : prev));
    if (helpAlertDoc.canGetThere && helpAlertDoc.canGetThere !== 'unknown') {
      setCanGetThere(helpAlertDoc.canGetThere);
    }
  }, [helpAlertDoc.active, helpAlertDoc.at, helpAlertDoc.canGetThere]);

  // ---- Terminal lucidity alert ----
  // Raised when the chat endpoint detects a window of real clarity in the
  // patient's words. Same rails as the help button. These windows can be
  // brief and precious — the family should know within seconds.
  const [lucidityAlert, setLucidityAlertState] = useState<{ active: boolean; at: number }>({ active: false, at: 0 });

  const sendLucidityAlert = (active: boolean) => {
    const state = { active, at: Date.now() };
    setLucidityAlertState(state);
    localStorage.setItem('yadira_lucidity_alert', JSON.stringify(state));
    fetch('/api/lucidity-alert', {
      method: 'POST',
      headers: authHeaders(),
      // The phone details travel with the alert so the server can also RING
      // the caregiver. A clear moment is short, and a banner waits on a
      // screen nobody is watching until the thing it announced has gone.
      body: JSON.stringify({
        active,
        circle: getCircleId(),
        toPhone: helpCall.escalationPhone,
        region: helpCall.region,
        patientName,
        caregiverName: profile.caregiverName,
        isPremium,
      }),
    }).catch((err) => console.warn('[Yadira] lucidity-alert push failed', err));
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { active?: boolean; at?: number };
        if (typeof parsed.active !== 'boolean') return;
        if (event.key === 'yadira_caregiver_alert') {
          setCaregiverAlertState({ active: parsed.active, at: parsed.at || Date.now() });
        } else if (event.key === 'yadira_lucidity_alert') {
          setLucidityAlertState({ active: parsed.active, at: parsed.at || Date.now() });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);

    let cancelled = false;
    const poll = async () => {
      // Both alert channels ride the same 1.5s tick — one interval, two GETs.
      const circle = encodeURIComponent(getCircleId());
      try {
        const [helpRes, lucidRes] = await Promise.all([
          fetch(`/api/caregiver-alert?circle=${circle}`, { headers: authHeaders() }),
          fetch(`/api/lucidity-alert?circle=${circle}`, { headers: authHeaders() }),
        ]);
        if (cancelled) return;
        if (helpRes.ok) {
          const data = await helpRes.json();
          if (typeof data?.active === 'boolean') {
            // Server vs. the circle's durable copy — newest wins. A server that
            // has just restarted answers {active:false, at:0}, which must not
            // be allowed to silence an alert Firestore still knows about.
            if (typeof data?.canGetThere === 'string' && data.canGetThere !== 'unknown') {
              setCanGetThere(data.canGetThere);
              // Straight into the circle, so a server restart cannot turn it
              // back into "unknown" and resume the arrival promise.
              const stored = helpAlertDocRef.current;
              if (stored.canGetThere !== data.canGetThere) {
                setHelpAlertDoc({ ...stored, canGetThere: data.canGetThere });
              }
            }
            const fromServer = { active: data.active as boolean, at: (data.at as number) || 0 };
            const stored = helpAlertDocRef.current;
            const winner = stored.at > fromServer.at ? stored : fromServer;
            // Bail out when nothing changed — a fresh object every poll tick
            // re-renders the whole app every 1.5s for no reason.
            setCaregiverAlertState((prev) =>
              prev.active === winner.active && prev.at === winner.at ? prev : winner
            );
          }
        }
        if (lucidRes.ok) {
          const data = await lucidRes.json();
          if (typeof data?.active === 'boolean') {
            setLucidityAlertState((prev) =>
              prev.active === data.active && prev.at === (data.at || 0)
                ? prev
                : { active: data.active, at: data.at || 0 }
            );
          }
        }
      } catch { /* best-effort */ }
    };
    poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(id);
    };
  }, []);

  // Caregiver side: make an incoming alert impossible to miss — sound + toast
  // on the rising edge (patient devices skip this; they see the inline state).
  const prevAlertRef = useRef(false);
  useEffect(() => {
    if (caregiverAlert.active && !prevAlertRef.current && !isPatientSession) {
      playSoundCue('chime');
      toastError(`${patientName || 'The patient'} needs you`, 'They pressed the help button. The banner in the Caregiver Hub shows details.');
    }
    prevAlertRef.current = caregiverAlert.active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caregiverAlert.active, isPatientSession, patientName]);

  // Lucidity rising edge — the one notification in the app that says "go,
  // now." Never shown to the patient; their side stays ordinary and warm.
  const prevLucidityRef = useRef(false);
  useEffect(() => {
    if (lucidityAlert.active && !prevLucidityRef.current && !isPatientSession) {
      playSoundCue('chime');
      toastError(
        `${patientName || 'Your loved one'} is speaking with unusual clarity`,
        'These moments can be brief and precious. If you can, go be with them now — details in the Caregiver Hub.'
      );
    }
    prevLucidityRef.current = lucidityAlert.active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lucidityAlert.active, isPatientSession, patientName]);

  // Patient tap: raise the alert, then comfort — the companion immediately
  // reassures them that a real person is coming.
  //
  // Pressing again is not an error and must never be met with silence. Someone
  // frightened presses a button repeatedly precisely because they are not sure
  // it worked, and that is the moment they most need to hear a voice. The
  // caregiver's phone is not rung again — that is the cooldown, and it is
  // right — but the person in the room is answered every single time.
  const repeatComfortRef = useRef(0);
  const handlePatientAlert = () => {
    const name = caregiverName || 'Your caregiver';
    const dear = patientName || 'dear';
    const alreadyRaised = caregiverAlert.active;

    if (!alreadyRaised) sendCaregiverAlert(true);

    // Said aloud, so it must sound like reassurance rather than a status
    // update. Nothing here mentions calls, cooldowns, or anything technical —
    // only that a person knows and is coming.
    //
    // On an unlinked device there is nobody at the other end, so none of these
    // lines may claim there is. Telling a person with dementia that someone
    // has been told and is coming, when no message left the tablet, is exactly
    // the disorientation this app exists to prevent — and they would sit and
    // wait on it. The unlinked lines give the one thing that is still true:
    // presence.
    // Raised in review, and right: a caregiver who said "no" and then cleared
    // the banner leaves the NEXT press looking like a first one, which took
    // the arrival promise straight back. The last thing we were told still
    // stands until a new call says otherwise.
    const nobodyComing = helpReachesCaregiver && canGetThere === 'no';
    const firstTime = !helpReachesCaregiver
      ? `I'm right here with you, ${dear}. You're not on your own — I'm staying right here.`
      : nobodyComing
        ? `${name} knows, ${dear}. I'm right here with you.`
        : `${name} has been told, ${dear}. They will come to you soon. I'm right here with you until then.`;
    // When the caregiver has answered the phone and said they cannot get
    // there, "they're on their way" becomes a lie told to someone who will sit
    // and wait on it. These lines drop the arrival and keep everything that is
    // still true: they were told, it was the right thing to do, and the
    // companion is not going anywhere. Nothing here says nobody is coming —
    // that is the caregiver's news to give, not a sentence to leave with
    // someone alone in a room.
    const againOptions = nobodyComing
      ? [
          `${name} knows, ${dear}. I'm staying right here with you in the meantime.`,
          `You did the right thing telling them. Let's keep each other company a while.`,
          `I'm not going anywhere, ${dear}. We'll sit together for a bit.`,
        ]
      : helpReachesCaregiver
      ? [
          `${name} already knows, ${dear}, and they're on their way to you. Let's wait together — I'm right here.`,
          `I've told ${name}, and they're coming. It won't be long. Stay with me until they get here.`,
          `${name} is on their way, ${dear}. You did the right thing. I'm not going anywhere.`,
        ]
      : [
          `I'm still here, ${dear}. Let's stay together a while.`,
          `You're not on your own. I'm right beside you, ${dear}.`,
          `I'm here, ${dear}, and I'm not going anywhere. Take your time.`,
        ];
    const comfort = alreadyRaised
      ? againOptions[repeatComfortRef.current++ % againOptions.length]
      : firstTime;

    appendChatMessage({
      id: `msg-alert-${Date.now()}`,
      role: 'model',
      text: comfort,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    speakText(comfort);
    if (soundFeedback) playSoundCue('chime');
  };

  // Caregiver accepts the Vivid invite for a person the patient keeps mentioning.
  const handleAcceptVividInvite = (personName: string) => {
    // If the persona isn't already set to this person, update it first so the
    // greeting and voice pick up the right name immediately.
    if (representedPersona !== personName) {
      setRepresentedPersona(personName);
    }
    setPatientMode('vivid');
    setVividInviteAlert(null);
    setMentionCounts({});
    toastSuccess(
      `${personName} has joined`,
      `Vivid mode is now active — the companion speaks as ${personName}, the way ${patientName || 'they'} remembers them.`
    );
  };

  // New Memory Modal State
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemDesc, setNewMemDesc] = useState('');
  const [newMemEra, setNewMemEra] = useState('');
  const [newMemTheme, setNewMemTheme] = useState<'family' | 'nature' | 'retro' | 'home' | 'wedding'>('family');
  const [showMemModal, setShowMemModal] = useState(false);

  // Family setup / onboarding modal
  const [showFamilySetup, setShowFamilySetup] = useState(false);

  // New FAQ State
  const [newFaqQuest, setNewFaqQuest] = useState('');
  const [newFaqAns, setNewFaqAns] = useState('');

  // Daily Log Inputs
  const [logConfusion, setLogConfusion] = useState<number>(2);
  const [logMood, setLogMood] = useState<'peaceful' | 'anxious' | 'restless' | 'sad'>('peaceful');
  // Prefill the caregiver's mood field from the patient's own camp check-in
  // (once, and only if they haven't already charted a clinical log today).
  const moodPrefilledRef = useRef(false);
  useEffect(() => {
    if (moodPrefilledRef.current || !todaysCheckIn) return;
    if (logs.some((l) => l.date === todayKey())) return;
    moodPrefilledRef.current = true;
    setLogMood(todaysCheckIn.mood);
  }, [todaysCheckIn, logs]);
  const [logHydration, setLogHydration] = useState<number>(6);
  const [logSleep, setLogSleep] = useState<number>(7.5);
  const [logMeds, setLogMeds] = useState<boolean>(true);
  const [logNotes, setLogNotes] = useState('');

  // AI Generation Loading States
  const [loadingRoutine, setLoadingRoutine] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<{
    clinicalSummary: string;
    criticalAlerts: string[];
    actionableTips: string[];
  } | null>(null);

  // Patient Chat State — persisted like every other store, so a page refresh
  // or connection drop never erases the conversation. (The Elsy killswitch
  // test: ask her if she remembers. She does.)
  const buildGreeting = (): Message => {
    const isVividMode = profile?.patientMode === 'vivid';
    const persona = profile?.representedPersona || 'Beth';
    const thread = personaFile?.threadToPickUp || '';
    const greetingText = isVividMode
      ? thread
        ? `Hello, love. It's me, ${persona}. ${thread}`
        : `Hello, love. It's me, ${persona}. I'm right here with you.`
      : `Hello, ${profile?.patientName || 'dear'}! I am Yadira, and I'm sitting right here with you. How is your heart feeling today?`;
    return {
      id: 'greet',
      role: 'model',
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };
  const [chatMessages, setChatMessages] = useStoreList<Message>('chat', [buildGreeting()]);
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  // Messages that were already present at mount render fully; anything that
  // arrives later reveals one thought-bubble at a time (see DigestibleMessage).
  const mountIdsRef = useRef<Set<string> | null>(null);
  if (mountIdsRef.current === null) {
    mountIdsRef.current = new Set(chatMessages.map((m) => m.id));
  }
  // Chunk reveals happen after the message itself is appended, so the log
  // needs a nudge to follow them down.
  const scrollLogToBottom = () => {
    const log = messageLogRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  };
  // Append helper — caps the stored transcript so localStorage/Firestore stay lean.
  const appendChatMessage = (msg: Message) => {
    setChatMessages(prev => [...prev, msg].slice(-60));
  };
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Tracks whether Beth's voice is actually playing (Inworld audio or the
  // browser SpeechSynthesis fallback) so the drift timer can wait for her
  // to finish talking instead of starting the moment text generation ends.
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(isPatientSession);
  const [soundFeedback, setSoundFeedback] = useState(true);

  // Ref for chat auto-scrolling — the message-log container itself, NOT a
  // sentinel div: scrollIntoView() scrolls every scrollable ancestor, and the
  // root overflow-hidden wrapper is programmatically scrollable, so on load it
  // silently shifted the whole app up ~100px and clipped the header.
  const messageLogRef = useRef<HTMLDivElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  // Monotonic "speak generation". Each speakTextDirect call bumps it; an
  // async TTS fetch only plays its audio if it's still the latest request.
  // Without this, two greetings fired close together (e.g. the Lucid startup
  // greeting and the Vivid greeting after a mode sync) each fetch audio and
  // then both play at once — "Hello, I'm Yadira" over "Hello, it's me, Beth".
  const speakGenRef = useRef(0);
  const startupGreetingSpokenRef = useRef(false);

  // Unlock browser audio autoplay policy on the first user interaction.
  // This is critical so that Inworld audio can play even when the chat
  // is submitted via Enter key (which browsers don't count as a gesture).
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ctx.resume().then(() => {
          ctx.suspend();
          audioUnlockedRef.current = true;
          console.log('[Audio] Context unlocked by user interaction.');
        });
      } catch (_) {}
    };
    window.addEventListener('click', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false, passive: true });
    window.addEventListener('touchstart', unlock, { once: false, passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // (localStorage sync now handled inside useStore — with Firestore on top)

  // Scroll to bottom of chat — scoped to the log container only
  useEffect(() => {
    const log = messageLogRef.current;
    if (log) {
      log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  // Handle active mode transition dynamically (update greeting and speak it)
  const prevModeRef = useRef(patientMode);
  useEffect(() => {
    if (prevModeRef.current !== patientMode) {
      prevModeRef.current = patientMode;
      if (patientMode === 'vivid') {
        // Switching to Vivid — the invite was answered (or toggled manually).
        setMentionCounts({});
        setVividInviteAlert(null);
        const thread = personaFileRef.current?.threadToPickUp || '';
        const text = thread
          ? `Hello, love. It's me, ${representedPersona || 'Beth'}. ${thread}`
          : `Hello, love. It's me, ${representedPersona || 'Beth'}. I'm right here with you.`;
        setChatMessages(prev => prev.map(m => m.id === 'greet' ? { ...m, text } : m));
        if (activeTab === 'patient' && !auroraActive) speakText(text);
        if (soundFeedback) playSoundCue('chime');
      } else {
        const text = `Hello, ${patientName || 'dear'}! I am Yadira, and I'm sitting right here with you. How is your heart feeling today?`;
        setChatMessages(prev => prev.map(m => m.id === 'greet' ? { ...m, text } : m));
        if (activeTab === 'patient' && !auroraActive) speakText(text);
        if (soundFeedback) playSoundCue('pop');
      }
    }
  }, [patientMode, representedPersona, patientName, soundFeedback, activeTab]);

  // Proactive Drift Detection (Inactivity Timer calling /api/drift/proactive)
  // We derive the last user message ID so the effect only re-runs when the
  // patient actually says something — NOT when model/drift messages are added.
  const lastUserMsg = chatMessages.filter(m => m.role === 'user').slice(-1)[0];
  const lastUserMsgId = lastUserMsg?.id ?? null;

  // She reaches into the silence at most twice, then rests until the patient
  // says something. Counted from the persisted transcript itself (trailing
  // drift messages since the last user message), so page reloads can't re-arm
  // an endless stream of unanswered reaches into an empty room.
  const MAX_UNANSWERED_REACHES = 2;
  let trailingDriftReaches = 0;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    if (chatMessages[i].role === 'user') break;
    if (chatMessages[i].id.startsWith('msg-drift-')) trailingDriftReaches++;
  }

  useEffect(() => {
    if (activeTab !== 'patient' || !driftEnabled || auroraActive) return;
    if (isTyping) return;
    // Wait for Beth's voice to actually finish before starting the drift
    // countdown — otherwise the timer runs out while she's still talking.
    if (isSpeaking) return;

    // The reaches went unanswered — rest, stay present, don't pester.
    if (trailingDriftReaches >= MAX_UNANSWERED_REACHES) return;

    const triggerDriftReach = async () => {
      try {
        // Auth middleware protects /api/drift — without the Bearer header this
        // call 401s and the proactive reach silently never happens.
        const response = await fetch('/api/drift/proactive', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            patientName,
            representedPersona,
            memories: memories.map(m => ({ title: m.title, description: m.description, relationshipOrEra: m.relationshipOrEra })),
            personaFile: personaFileRef.current
          })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const driftReply: Message = {
          id: `msg-drift-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        appendChatMessage(driftReply);
        speakText(data.reply);
        if (soundFeedback) playSoundCue('chime');
      } catch (err) {
        console.error('Proactive reach error:', err);
      }
    };

    const timer = setTimeout(() => {
      triggerDriftReach();
    }, driftTimeoutSeconds * 1000);

    return () => clearTimeout(timer);
  }, [lastUserMsgId, trailingDriftReaches, userInput, driftEnabled, driftTimeoutSeconds, activeTab, isTyping, isSpeaking, patientName, representedPersona, memories]);

  // ---- Session reflection: writing the persona file ----
  // Every few patient turns (and whenever the tab is hidden), the transcript
  // is distilled server-side into what they shared, how they seemed, and what
  // they keep coming back to. The result is persisted and read back into every
  // chat prompt — Beth remembers so the patient doesn't have to.
  const reflectingRef = useRef(false);
  const lastReflectedCountRef = useRef<number | null>(null);
  const userMsgCount = chatMessages.filter(m => m.role === 'user').length;
  if (lastReflectedCountRef.current === null) {
    // Messages restored from a previous session were already reflected.
    lastReflectedCountRef.current = userMsgCount;
  }

  const runReflection = async (options: { keepalive?: boolean } = {}): Promise<PersonaFile | null> => {
    const currentCount = chatMessagesRef.current.filter(m => m.role === 'user').length;
    if (reflectingRef.current) return null;
    if (currentCount - (lastReflectedCountRef.current ?? 0) < 1) return null;
    reflectingRef.current = true;
    try {
      const response = await fetch('/api/session/reflect', {
        method: 'POST',
        keepalive: options.keepalive,
        headers: authHeaders(),
        body: JSON.stringify({
          transcript: chatMessagesRef.current.slice(-20).map(m => ({ role: m.role, text: m.text })),
          patientName: profileRef.current.patientName,
          representedPersona: profileRef.current.representedPersona,
          personaFile: personaFileRef.current
        })
      });
      const data = await response.json();
      if (!response.ok || data.error || !data.reflection) return null;

      lastReflectedCountRef.current = currentCount;
      const r = data.reflection;
      const prev = personaFileRef.current;
      const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
      const newMoments: SessionMoment[] = (Array.isArray(r.newMoments) ? r.newMoments : [])
        .filter((m: any) => m && m.summary)
        .map((m: any, i: number) => ({
          id: `moment-${Date.now()}-${i}`,
          date: dateStr,
          summary: m.summary,
          emotionalTone: m.emotionalTone || 'calm'
        }));
      const merged: PersonaFile = {
        lastSessionAt: new Date().toISOString(),
        lastSummary: r.sessionSummary || prev.lastSummary,
        recurringThreads: (Array.isArray(r.recurringThreads) && r.recurringThreads.length > 0
          ? r.recurringThreads
          : prev.recurringThreads).slice(0, 6),
        moments: [...newMoments, ...prev.moments].slice(0, 30),
        threadToPickUp: r.threadToPickUp || prev.threadToPickUp
      };
      setPersonaFile(merged);
      return merged;
    } catch (err) {
      console.warn('[Yadira] Session reflection failed (will retry later):', err);
      return null;
    } finally {
      reflectingRef.current = false;
    }
  };

  // Reflect every 3 patient messages while the conversation is quiet…
  useEffect(() => {
    if (isTyping) return;
    if (userMsgCount - (lastReflectedCountRef.current ?? 0) >= 3) {
      runReflection();
    }
  }, [userMsgCount, isTyping]);

  // …and when the tab is hidden or closed, so nothing shared is ever lost.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        runReflection({ keepalive: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // "Start Fresh Session" — the killswitch demo. Reflect whatever is pending,
  // clear the conversation, and let the greeting pick the thread back up.
  // The chat resets; the memory doesn't.
  const handleStartFreshSession = async () => {
    const merged = await runReflection();
    const pf = merged || personaFileRef.current;
    const p = profileRef.current;
    const persona = p.representedPersona || 'Beth';
    const greetingText = p.patientMode === 'vivid'
      ? pf.threadToPickUp
        ? `Hello, love. It's me, ${persona}. ${pf.threadToPickUp}`
        : `Hello, love. It's me, ${persona}. I'm right here with you.`
      : pf.threadToPickUp
        ? `Hello, ${p.patientName || 'dear'}! I am Yadira, right here with you as always. ${pf.threadToPickUp}`
        : `Hello, ${p.patientName || 'dear'}! I am Yadira, and I'm sitting right here with you. How is your heart feeling today?`;
    setChatMessages([{
      id: 'greet',
      role: 'model',
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    lastReflectedCountRef.current = 0;
    setMentionCounts({});
    setVividInviteAlert(null);
    toastSuccess('New session started', `${persona} kept everything from the last visit.`);
  };

  // Load a sample family or a freshly created one into THIS circle. Replaces
  // the profile and all content, clears the persona file and conversation so
  // the new family starts clean, and syncs the mode across devices.
  const applyFamilyPack = (pack: FamilyPackApply, label: string) => {
    // Final gate on the single most destructive action in the app — loading a
    // family replaces the profile, memories, FAQs, logs, and routine. A real
    // incident (a stray zoom gesture) once wiped a family's data; this
    // confirm plus Care Lock makes that path unrepeatable.
    //
    // Skipped on first run, where there is nothing to destroy: warning someone
    // that their empty circle is about to be REPLACED, seconds after asking
    // them to choose, reads as a threat rather than a safeguard.
    if (
      !firstRunSetup &&
      !window.confirm(`Load "${label}" into this care circle? This REPLACES the current profile, memories, FAQs, logs, and routine.`)
    ) {
      return;
    }
    setProfile(pack.profile);
    setMemories(pack.memories);
    setFaqs(pack.faqs);
    setLogs(pack.logs);
    setRoutine(pack.routine);
    setPersonaFile(DEFAULT_PERSONA_FILE);

    const p = pack.profile;
    const greetingText = p.patientMode === 'vivid'
      ? `Hello, love. It's me, ${p.representedPersona || 'Beth'}. I'm right here with you.`
      : `Hello, ${p.patientName || 'dear'}! I am Yadira, and I'm sitting right here with you. How is your heart feeling today?`;
    setChatMessages([{
      id: 'greet',
      role: 'model',
      text: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    lastReflectedCountRef.current = 0;
    setMentionCounts({});
    setVividInviteAlert(null);

    // A loaded family is intentional content — don't let the first-login
    // auto-seed overwrite it on the next mount.
    localStorage.setItem(`yadira_${getCircleId()}_seeded_demo`, 'true');

    // Keep any separate patient device in step with the new family's mode.
    localStorage.setItem('yadira_shared_mode', JSON.stringify({ mode: p.patientMode, at: Date.now() }));
    fetch('/api/shared-mode', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode: p.patientMode, circle: getCircleId() }),
    }).catch(() => {});

    setShowFamilySetup(false);
    toastSuccess('Care circle ready', `${label} is loaded and ready.`);

    // Straight from choosing into the walkthrough, once, for a caregiver who
    // has just arrived. Anyone who returns to Family Setup later has already
    // seen it and does not need it again.
    if (firstRunSetup) {
      setFirstRunSetup(false);
      if (localStorage.getItem(tourSeenKey(getCircleId())) !== 'true') setShowTour(true);
    }
  };

  /** The walkthrough is dismissed for good once seen — reopenable from the header. */
  const closeTour = () => {
    setShowTour(false);
    try { localStorage.setItem(tourSeenKey(getCircleId()), 'true'); } catch { /* non-fatal */ }
  };

  /** Closing first-run setup without choosing means "start with nothing". */
  const skipFirstRunSetup = () => {
    setFirstRunSetup(false);
    localStorage.setItem(`yadira_${getCircleId()}_seeded_demo`, 'true');
    if (localStorage.getItem(tourSeenKey(getCircleId())) !== 'true') setShowTour(true);
  };

  // Stop whatever Yadira is saying, right now. Bumping the speak generation
  // also cancels any in-flight TTS fetch, so a queued reply can't start
  // talking a second after the patient asked for quiet.
  const stopSpeaking = () => {
    speakGenRef.current++;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (_) { /* ignore */ }
    setIsSpeaking(false);
  };

  // Text To Speech helper
  // Core TTS — no tab/voice guard, used internally and by caregiver memory preview.
  const speakTextDirect = (text: string) => {

    // Stop any currently playing speech/audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    // Claim this as the newest speak request; any in-flight older fetch below
    // will see a bumped generation and bail instead of playing over us.
    const myGen = ++speakGenRef.current;

    // Clean text by removing markdown asterisks (e.g. *softly*) so they aren't read out literally
    const cleanedText = text.replace(/\*.*?\*/g, '').trim();
    if (!cleanedText) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    // The natural (Inworld) voice — the reunion, the "oh my god, it's her"
    // moment — is free for every family. Cost is bounded by the server's daily
    // per-circle TTS budget: past the cap, /api/tts returns 429 and we fall
    // back to the device voice below, so the companion never goes silent.
    // First try Inworld proxy endpoint (authenticated fetch), then fall back to browser TTS.
    void (async () => {
      try {
        // Vivid: the persona's configured voice. Lucid: Yadira's own voice
        // (caregiver-chosen female/male) — she must never borrow the persona's.
        const p = profileRef.current;
        const selectedVoice = p.patientMode === 'vivid'
          ? (p.representedVoiceId || 'Sarah')
          : YADIRA_VOICES[p.yadiraVoice || 'female'];
        const token = localStorage.getItem('yadira_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers,
          // circle keys the server's daily synthesis budget to this family
          body: JSON.stringify({ text: cleanedText, voiceId: selectedVoice, circle: getCircleId() }),
        });
        if (!response.ok) {
          const details = await response.text();
          throw new Error(`TTS request failed (${response.status}): ${details || 'no details'}`);
        }

        const audioBlob = await response.blob();
        // A newer speak started while we were fetching — drop this one so the
        // two don't play simultaneously.
        if (speakGenRef.current !== myGen) return;
        const objectUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(objectUrl);
        activeAudioRef.current = audio;

        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(objectUrl);
          if (speakGenRef.current === myGen) setIsSpeaking(false);
        });

        audio.addEventListener('error', () => {
          URL.revokeObjectURL(objectUrl);
          if (speakGenRef.current === myGen) fallbackSpeechSynthesis(cleanedText);
        });

        await audio.play();
      } catch (err) {
        console.warn('[TTS] Inworld backend proxy failed, falling back to browser SpeechSynthesis.', err);
        if (speakGenRef.current === myGen) fallbackSpeechSynthesis(cleanedText);
      }
    })();
  };

  const fallbackSpeechSynthesis = (text: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.82;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const friendlyVoice = voices.find(v =>
        v.name.includes('Google US English') ||
        v.name.includes('Natural') ||
        v.name.includes('Zira') ||
        v.name.includes('Samantha')
      );
      if (friendlyVoice) {
        utterance.voice = friendlyVoice;
      }
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[TTS] SpeechSynthesis fallback error:', e);
      setIsSpeaking(false);
    }
  };

  // Public wrapper — only speaks when voice is enabled and on the patient tab.
  const speakText = (text: string) => {
    if (!voiceEnabled || activeTab !== 'patient') return;
    speakTextDirect(text);
  };

  // Play a soft pleasant tone when patient does certain actions (sound therapy cue)
  const playSoundCue = (type: 'chime' | 'pop') => {
    if (!soundFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'chime') {
        // High, pure harmonic chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } else {
        // Soft bubble pop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch (err) {
      console.warn('AudioContext failed:', err);
    }
  };

  // Speak initial greeting when voice is enabled
  useEffect(() => {
    const storageKey = 'yadira_startup_greeting_spoken';
    const alreadySpokenThisLoad = typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === 'true';
    if (activeTab === 'patient' && chatMessages.length === 1 && voiceEnabled && !startupGreetingSpokenRef.current && !alreadySpokenThisLoad) {
      startupGreetingSpokenRef.current = true;
      sessionStorage.setItem(storageKey, 'true');
      speakText(chatMessages[0].text);
    }
  }, [voiceEnabled, activeTab]);

  // Handle Patient message submission
  const handleSendMessage = async (textToSend: string, emotion?: Message['emotion'], mediaInsight?: { description: string; emotion: string; suggestions: string[] }) => {
    if (!textToSend.trim()) return;

    const userMsgId = `msg-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emotion,
      mediaInsight
    };

    appendChatMessage(userMsg);
    setUserInput('');
    setIsTyping(true);

    if (soundFeedback) playSoundCue('pop');

    try {
      // Build full state details for context injection on the server
      const caregiverSettings = {
        patientName,
        caregiverName,
        relationship: caregiverRelationship,
        customAnswers: faqs.map(f => ({ question: f.question, answer: f.answer })),
        patientMode,
        representedPersona,
        companionPersonality: companionPersonality || 'gentle'
      };

      const serverHistory = chatMessages.map(m => ({
        role: m.role,
        text: m.text
      }));

      // Inject emotion/media context into the prompt
      let contextualMessage = textToSend;
      if (emotion) {
        // The companion is told HOW this was known, because the two deserve
        // different weight. A tremor heard in the voice can contradict the
        // words outright — "I'm fine", said unsteadily — and the companion
        // should be able to follow the voice rather than the sentence. A
        // reading inferred from wording is only a restatement of what it can
        // already see, so it is labelled as the weaker signal it is.
        contextualMessage +=
          emotion.source === 'voice'
            ? ` [Heard in their voice: ${emotion.emotion}${emotion.tone ? ` — ${emotion.tone}` : ''}. This is how they SOUNDED, which may not match their words. Trust it over the wording if they differ.]`
            : ` [Detected emotion: ${emotion.emotion}]`;
      }
      if (mediaInsight) {
        contextualMessage += ` [Media insight: ${mediaInsight.description}. Emotion: ${mediaInsight.emotion}]`;
      }

      const response = await apiCall('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextualMessage,
          history: serverHistory,
          // Only ever present while developer mode is on, and the server
          // ignores it unless DEV_MODE_SECRET is configured there and matches.
          devToken: devToken() || undefined,
          caregiverSettings,
          patientMode,
          representedPersona,
          memories: memories.map(m => ({ title: m.title, description: m.description, relationshipOrEra: m.relationshipOrEra })),
          personaFile: personaFileRef.current,
          todaysMood: todaysCheckIn?.mood ?? null,
          // Captions only — the companion talks about the album's photos
          // ("looking at old photos" now refers to real ones), images stay client-side.
          galleryCaptions: galleryPhotos.slice(-10).map(p => p.caption),
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const yadiraReply: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      appendChatMessage(yadiraReply);
      speakText(data.reply);

      // Terminal lucidity: the server flagged a window of real clarity in
      // what they just said. Raise the caregiver alert immediately — these
      // windows can be brief. Nothing changes on the patient's screen.
      if (data.lucidity && !lucidityAlert.active) {
        sendLucidityAlert(true);
      }

      // Vivid invite: accumulate mention counts from this message. Only fires
      // in Lucid mode and only once per session per threshold crossing.
      if (data.mentionedNames && data.mentionedNames.length > 0 && patientMode !== 'vivid') {
        setMentionCounts(prev => {
          const next = { ...prev };
          let newAlert: { name: string; count: number } | null = null;
          for (const name of data.mentionedNames as string[]) {
            next[name] = (next[name] || 0) + 1;
            if (next[name] >= VIVID_INVITE_THRESHOLD && !vividInviteAlert && !newAlert) {
              newAlert = { name, count: next[name] };
            }
          }
          if (newAlert) setVividInviteAlert(newAlert);
          return next;
        });
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const isVivid = patientMode === 'vivid';
      const persona = representedPersona || 'Beth';
      const fallbackText = isVivid
        ? `I'm right here, sweetheart. I just wanted you to know I'm thinking of you. Take a moment with me.`
        : `I hear you, dear. I am right here with you. Everything is safe and comfortable.`;
      const errorReply: Message = {
        id: `msg-err-${Date.now()}`,
        role: 'model',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      appendChatMessage(errorReply);
      speakText(errorReply.text);
    } finally {
      setIsTyping(false);
    }
  };

  // Routine Activity Completion
  const toggleRoutine = (id: string) => {
    const updated = routine.map(item => {
      if (item.id === id) {
        const nextState = !item.completed;
        if (nextState && soundFeedback) playSoundCue('chime');
        return { ...item, completed: nextState };
      }
      return item;
    });
    setRoutine(updated);
  };

  // Add Caregiver Daily Log
  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toLocaleDateString([], { month: '2-digit', day: '2-digit' }).replace('/', '-');
    const newLog: DailyLog = {
      date: todayStr,
      confusionLevel: logConfusion,
      mood: logMood,
      hydrationCups: logHydration,
      sleepHours: logSleep,
      medsTaken: logMeds,
      notes: logNotes || 'Logged symptoms'
    };

    setLogs(prev => {
      // If a log for today already exists, filter it out first
      const clean = prev.filter(l => l.date !== todayStr);
      return [...clean, newLog];
    });

    setLogNotes('');
    alert('Today\'s symptoms and daily stats have been logged securely.');
  };

  // Delete Log
  const handleDeleteLog = (date: string) => {
    setLogs(prev => prev.filter(l => l.date !== date));
  };

  // Memory Actions
  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle || !newMemDesc) return;

    const newMem: Memory = {
      id: `mem-${Date.now()}`,
      title: newMemTitle,
      description: newMemDesc,
      relationshipOrEra: newMemEra || 'Family',
      imageTheme: newMemTheme
    };

    setMemories(prev => [newMem, ...prev]);
    setNewMemTitle('');
    setNewMemDesc('');
    setNewMemEra('');
    setShowMemModal(false);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  // FAQ Actions
  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQuest || !newFaqAns) return;

    const newFaq: CustomFAQ = {
      id: `faq-${Date.now()}`,
      question: newFaqQuest,
      answer: newFaqAns
    };

    setFaqs(prev => [...prev, newFaq]);
    setNewFaqQuest('');
    setNewFaqAns('');
  };

  const handleDeleteFaq = (id: string) => {
    setFaqs(prev => prev.filter(f => f.id !== id));
  };

  // Send Nurse Redirection Cue to Backend and Push as Message to Patient
  const handleSendRedirection = async (nurseNote: string) => {
    if (!nurseNote.trim()) return;
    try {
      // apiCall attaches the Bearer token — /api routes are auth-protected.
      const response = await apiCall('/api/redirection/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurseNote,
          patientName,
          representedPersona
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Create message from the persona (model)
      const redirectMsg: Message = {
        id: `msg-redirect-${Date.now()}`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      appendChatMessage(redirectMsg);
      speakText(data.reply);
      if (soundFeedback) playSoundCue('chime');
      alert(`Redirection cue successfully dispatched to Patient View: "${data.reply}"`);
    } catch (err: any) {
      console.error('Redirection error:', err);
      alert('Could not dispatch redirection. Please check if server is running.');
    }
  };

  // AI-Powered Routine Generation
  const handleGenerateAiRoutine = async () => {
    if (!isPremium && aiUsage.lastRoutineAt && Date.now() - aiUsage.lastRoutineAt < WEEK_MS) {
      const daysLeft = Math.ceil((aiUsage.lastRoutineAt + WEEK_MS - Date.now()) / (24 * 60 * 60 * 1000));
      toastError(
        'Weekly routine used',
        `The free plan includes one AI routine per week — the next is available in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Caregiver Pro (${PRICE_SHORT}) generates them without limits.`
      );
      return;
    }
    setLoadingRoutine(true);
    try {
      const response = await apiCall('/api/routine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientProfile: {
            name: patientName,
            stage: patientStage,
            hobbies: patientHobbies,
            wakeTime: patientWakeTime,
            sleepTime: patientSleepTime
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.routine && Array.isArray(data.routine)) {
        const formattedRoutine: RoutineItem[] = data.routine.map((item: any, idx: number) => ({
          id: `rout-ai-${Date.now()}-${idx}`,
          time: item.time,
          title: item.title,
          description: item.description,
          caregiverTips: item.caregiverTips,
          completed: false
        }));

        setRoutine(formattedRoutine);
        setAiUsage({ ...aiUsage, lastRoutineAt: Date.now() });
        toastSuccess('Routine ready', 'AI generated a personalized cognitive routine — it\'s now loaded into the active schedule.');
      }
    } catch (err: any) {
      console.error(err);
      toastError('Routine unavailable', err.message?.includes('GEMINI') ? 'The AI routine builder needs a Gemini API key — check the server environment.' : (err.message || 'Could not generate routine. Please try again.'));
    } finally {
      setLoadingRoutine(false);
    }
  };

  // AI-Powered Clinical Insights Generation
  const handleGenerateInsights = async () => {
    if (!isPremium && aiUsage.lastInsightsAt && Date.now() - aiUsage.lastInsightsAt < WEEK_MS) {
      const daysLeft = Math.ceil((aiUsage.lastInsightsAt + WEEK_MS - Date.now()) / (24 * 60 * 60 * 1000));
      toastError(
        'Weekly insights used',
        `The free plan includes one AI insights report per week — the next is available in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Caregiver Pro (${PRICE_SHORT}) has no limits.`
      );
      return;
    }
    setLoadingInsights(true);
    try {
      const response = await apiCall('/api/insights/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLogs: logs,
          // Patient's own daily mood check-ins with Hattie — self-reported
          // feeling, distinct from the caregiver's clinical charting.
          moodCheckIns: checkins,
          patientProfile: {
            name: patientName,
            stage: patientStage,
            hobbies: patientHobbies
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.insights) {
        setAiInsights(data.insights);
        setAiUsage({ ...aiUsage, lastInsightsAt: Date.now() });
      }
    } catch (err: any) {
      console.error(err);
      toastError('Insights unavailable', err.message?.includes('GEMINI') ? 'The AI clinical advisor needs a Gemini API key — check the server environment.' : (err.message || 'Could not generate insights. Please try again.'));
    } finally {
      setLoadingInsights(false);
    }
  };

  // ---- Ask Yadira: caregiver co-pilot send handler ----
  const handleCaregiverSend = async (text: string) => {
    const content = text.trim();
    if (!content || caregiverTyping) return;
    const used = aiUsage.caregiverChatCount || 0;
    if (!isPremium && used >= CAREGIVER_CHAT_FREE_LIMIT) {
      toastError(
        'Free trial used up',
        `You've used your ${CAREGIVER_CHAT_FREE_LIMIT} free Ask Yadira messages. Caregiver Pro (${PRICE_SHORT}) unlocks unlimited caregiver chat.`
      );
      return;
    }

    const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: `cg-${Date.now()}`, role: 'user', text: content, timestamp: now() };
    setCaregiverChat(prev => [...prev, userMsg].slice(-40));
    setCaregiverInput('');
    setCaregiverTyping(true);

    try {
      const response = await apiCall('/api/caregiver/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history: caregiverChat.slice(-8).map(m => ({ role: m.role, text: m.text })),
          patientProfile: { name: patientName, stage: patientStage, hobbies: patientHobbies },
          memories: memories.map(m => ({ title: m.title, description: m.description, relationshipOrEra: m.relationshipOrEra })),
          dailyLogs: logs,
          moodCheckIns: checkins,
          personaFile: personaFileRef.current,
          faqs,
          routine,
          representedPersona,
          patientMode,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const reply: Message = { id: `cg-${Date.now() + 1}`, role: 'model', text: data.reply, timestamp: now() };
      setCaregiverChat(prev => [...prev, reply].slice(-40));
      if (!isPremium) setAiUsage({ ...aiUsage, caregiverChatCount: used + 1 });
    } catch (err) {
      // apiCall already surfaces a network-error toast.
      console.error('Caregiver chat error:', err);
    } finally {
      setCaregiverTyping(false);
    }
  };

  /**
   * What the call will say — the SAME material the hub shows on screen.
   *
   * Deliberately not a second generator. If the call and the dashboard could
   * ever tell different stories about the same week, the caregiver has no way
   * to know which one to believe, and the one they cannot re-read is the one
   * they will remember.
   *
   * Falls back to the raw week when no insights report has been run, because
   * "nothing has been generated yet" is not a reason to have nothing to say.
   */
  const briefingText = (): string => {
    if (aiInsights?.clinicalSummary) {
      return [
        aiInsights.clinicalSummary,
        ...(aiInsights.criticalAlerts || []).map((a) => `Worth watching: ${a}`),
      ].join(' ');
    }
    const week = logs.slice(-7);
    if (week.length === 0) return '';
    const days = week
      .map((l) => `${l.date}: ${moodLabel(l.mood)}${l.notes ? ` — ${l.notes}` : ''}`)
      .join('. ');
    return `Here is what was recorded over the last ${week.length} day${week.length === 1 ? '' : 's'}. ${days}.`;
  };

  // ---- The week, as an email ----
  // The weekly digest a scheduler would have sent. Asked for on load rather
  // than pushed on a timer: the server holds no durable schedule, and an
  // inbox waits, so a digest that arrives when the caregiver next opens the
  // app is still a weekly digest. `auto` lets the server enforce one a week.
  const sendBriefingEmail = async (auto: boolean) => {
    // The weekly gate lives HERE, not on the server.
    //
    // It used to be an in-memory Map in briefingEmail.ts, which made "once a
    // week" true only within one process lifetime. Render spins the free tier
    // down after inactivity, so a caregiver logging in once a day hit a cold
    // server every time, found an empty Map, and got the digest on EVERY
    // LOGIN. Reported exactly that way.
    //
    // aiUsage is a useStoreDoc — localStorage plus Firestore, per circle —
    // which is where the other weekly limits already live, and it survives
    // both a restart and a new device. The server keeps its own check as a
    // backstop; it just can no longer be the only one.
    if (auto) {
      const last = aiUsage.lastBriefingEmailAt;
      if (last && weekKey(last) === weekKey(Date.now())) return;
    }
    try {
      const res = await apiCall('/api/email/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto,
          patientName,
          caregiverName: profile.caregiverName,
          briefing: briefingText(),
          alerts: aiInsights?.criticalAlerts || [],
          tips: aiInsights?.actionableTips || [],
        }),
      });
      const data = await res.json();
      // Only a real send consumes the week. A 503 because RESEND_API_KEY is
      // unset, or a 502 from Resend, must not cost the family their digest.
      if (res.ok && !data.skipped) {
        setAiUsage({ ...aiUsage, lastBriefingEmailAt: Date.now() });
      }
      if (!auto) {
        if (res.ok && !data.skipped) toastSuccess('Sent', 'The week is in your inbox.');
        else if (!res.ok) toastError('Could not send', data.error || 'Please try again.');
      }
    } catch {
      if (!auto) toastError('Could not send', 'Could not reach the server.');
    }
  };

  // Once per session, on the caregiver hub. The server decides whether a week
  // has actually passed — the client only offers the opportunity.
  useEffect(() => {
    if (isPatientSession || !isPremium) return;
    const t = setTimeout(() => sendBriefingEmail(true), 4000);
    return () => clearTimeout(t);
    // lastBriefingEmailAt is a dependency on purpose. The timer captures
    // sendBriefingEmail from the render the effect ran on, and aiUsage may
    // still have been empty then — it loads from localStorage synchronously
    // but from Firestore async, so on a NEW device the first render has
    // nothing. Re-running when it arrives means the guard sees the real
    // value; when we then set it, the effect re-runs once more and returns
    // immediately, which costs nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientSession, isPremium, aiUsage.lastBriefingEmailAt]);

  // ---- Ask Yadira, by phone ----
  // The dashboard is only usable by someone sitting at it. This is the same
  // week, spoken, for the caregiver in a car or a corridor. It reuses the
  // insights the hub already generates rather than writing a second summary —
  // the call and the screen must never tell different stories.
  const [briefingCalling, setBriefingCalling] = useState(false);

  const requestBriefingCall = async () => {
    if (!helpCall.escalationPhone) {
      toastError('No number saved', 'Add your phone number in Settings, then Yadira can call you.');
      return;
    }
    if (!isPremium) {
      toastError('Caregiver Pro', 'Yadira calling you with the week is part of Caregiver Pro.');
      return;
    }
    // Said here as well as enforced on the server. A caregiver pressing a
    // button and being refused by a 402 has been told they were allowed to
    // press it; better to explain before the press than after.
    if (premium.trialing) {
      toastError(
        'Not in the trial',
        `Yadira calling you with the week starts when your ${TRIAL_LABEL || 'trial'} ends. The weekly email is on already — check your inbox.`
      );
      return;
    }
    setBriefingCalling(true);
    try {
      const res = await apiCall('/api/calls/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: helpCall.escalationPhone,
          region: helpCall.region,
          patientName,
          caregiverName: profile.caregiverName,
          isPremium,
          briefing: briefingText(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError('Could not place the call', data.error || 'Please try again.');
        return;
      }
      toastSuccess('Yadira is calling you', data.summary || 'Your phone should ring in a moment.');
    } catch {
      toastError('Could not place the call', 'Could not reach the server.');
    } finally {
      setBriefingCalling(false);
    }
  };

  // Keep the Ask Yadira log scrolled to the newest message.
  useEffect(() => {
    const el = caregiverLogRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [caregiverChat, caregiverTyping]);

  // Custom SVG theme icons for memory books
  const getThemeGradient = (theme: string) => {
    switch (theme) {
      case 'nature': return 'from-teal-100 to-emerald-200 text-teal-800 border-teal-200';
      case 'retro': return 'from-amber-100 to-orange-200 text-amber-900 border-amber-200';
      case 'wedding': return 'from-rose-100 to-pink-200 text-rose-800 border-rose-200';
      case 'home': return 'from-blue-100 to-indigo-200 text-blue-800 border-blue-200';
      default: return 'from-sage-100 to-green-200 text-sage-800 border-sage-200';
    }
  };

  return (
    <div className={`min-h-screen text-[#2C2C2A] font-sans antialiased flex flex-col transition-all duration-700 ${
      activeTab === 'patient' && patientMode === 'vivid'
        ? 'bg-[#FCF5F5]'
        : 'bg-[#F4F1EA]'
    } relative overflow-hidden`}>
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-20 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, var(--c-blob-a) 0%, var(--c-blob-b) 45%, transparent 72%)' }}
          animate={reduceMotion ? undefined : { x: [0, 28, -16, 0], y: [0, 18, -10, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -right-28 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, #ffd6e0 0%, #ff8fab 48%, transparent 74%)' }}
          animate={reduceMotion ? undefined : { x: [0, -22, 14, 0], y: [0, -16, 12, 0], scale: [1, 0.95, 1.07, 1] }}
          transition={reduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-28 left-1/4 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #dbeafe 0%, #93c5fd 45%, transparent 72%)' }}
          animate={reduceMotion ? undefined : { x: [0, 20, -18, 0], y: [0, -14, 10, 0], scale: [1, 1.05, 0.94, 1] }}
          transition={reduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      
      {/* Dynamic Header */}
      <header className="app-header relative z-10 bg-white/90 backdrop-blur-sm border-b border-[#E3DFC2] sticky top-0 px-4 md:px-8 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 md:gap-4 shadow-xs">
        {/* Branding — hidden on the patient/chat view to keep it calm and
            uncluttered; shown on the Caregiver Hub (and the login screen). */}
        {activeTab !== 'patient' && (
          <div className="flex min-w-[150px] items-center gap-3">
            {/* Width-based sizing: the global reset forces img height:auto, and
                in Tailwind v4 that unlayered rule beats the h-* utilities, so
                height classes silently no-op (the logo rendered at its natural
                600x327). Set width; height follows the aspect ratio (~52px ≈ 28px tall). */}
            <img
              src="/yadira-logo.png"
              alt="Yadira"
              id="app-logo-icon"
              onClick={handleLogoTap}
              className="w-[52px]"
            />
            <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F1EB] text-[#3A5D45] uppercase tracking-wider border border-[#CEDFCF]">
              Caregiver Hub
            </span>
          </div>
        )}

        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2 flex-wrap sm:ml-auto">
          {/* Global Tab Switcher — hidden entirely under Care Lock so a stray
              gesture can never reach the Hub's destructive controls */}
          {!isPatientSession && !careLocked && (
            <div className="tab-switcher flex flex-wrap gap-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E3DFC2] w-full sm:w-auto">
              <button
                id="tab-patient"
                onClick={() => { setActiveTab('patient'); playSoundCue('pop'); }}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
                  activeTab === 'patient'
                    ? 'bg-white text-[#3A5D45] shadow-xs scale-[1.02]'
                    : 'text-[#7E7D76] hover:text-[#3A5D45]'
                }`}
              >
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Preview Patient View</span>
              </button>
              <button
                id="tab-caregiver"
                onClick={() => { setActiveTab('caregiver'); playSoundCue('pop'); }}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
                  activeTab === 'caregiver'
                    ? 'bg-[#3A5D45] text-white shadow-xs font-bold scale-[1.02]'
                    : 'text-[#5E5D57] hover:text-[#3A5D45]'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Caregiver Hub</span>
              </button>
            </div>
          )}

          {/* Return to camp — Hattie's check-in, patient side.
              Once they've checked in today the tent carries a small check and
              warms to the "done" green. Someone who cannot remember whether
              they've already had their visit with Hattie can see that they
              have — and camp stays open either way, so a second visit is
              never refused. */}
          {activeTab === 'patient' && (
            <button
              id="btn-camp"
              onClick={() => setCampOpen(true)}
              className={`relative p-2 sm:p-2.5 rounded-xl border transition-all ${
                todaysCheckIn
                  ? 'border-[#CEDFCF] bg-[#E8F1EB] text-[#3A5D45]'
                  : 'border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF]'
              }`}
              title={todaysCheckIn ? "You've visited Hattie today" : 'Visit Hattie at camp'}
              aria-label={
                todaysCheckIn
                  ? "Visit Hattie at camp — today's check-in is done"
                  : 'Visit Hattie at camp'
              }
            >
              <Tent className="w-5 h-5" />
              {todaysCheckIn && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#3A5D45] border-2 border-white flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
                </span>
              )}
            </button>
          )}

          {/* Calming rooms button — patient side */}
          {activeTab === 'patient' && (
            <button
              id="btn-aurora"
              onClick={() => setShowRoomsMenu(true)}
              className="p-2 sm:p-2.5 rounded-xl border border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-indigo-500 hover:border-indigo-200 transition-all"
              title="Calming rooms — a gentle place to rest"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}

          {/* Hattie's Club — patient side, beside the calming rooms. Both are
              "somewhere else to be", which is why they sit together. */}
          {activeTab === 'patient' && (
            <button
              id="btn-hatties-club"
              onClick={() => setShowClubMenu(true)}
              className="p-1.5 sm:p-2 rounded-xl border border-[#E3DFC2] bg-white hover:border-[#CEDFCF] transition-all leading-none"
              title="Hattie's Club — a few games, nothing to lose"
            >
              <Hattie size={24} pose="waving" animated={false} />
            </button>
          )}

          {/* Larger text — device-wide, on every screen. Shown on both the
              patient view and the Caregiver Hub. */}
          <button
            id="btn-font-scale"
            onClick={() => { toggleLargeFont(); playSoundCue('pop'); }}
            aria-pressed={largeFont}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all ${
              largeFont
                ? 'bg-[#E8F1EB] text-[#3A5D45] border-[#CEDFCF]'
                : 'border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF]'
            }`}
            title={largeFont ? 'Normal text size' : 'Larger text'}
          >
            <ALargeSmall className="w-5 h-5" />
          </button>

          {/* Full screen — hides the browser's address bar and tabs. Pairs
              with Care Lock for a clean, kiosk-like patient screen. */}
          {fullscreenSupported && (
            <button
              id="btn-fullscreen"
              onClick={() => (isFullscreen ? exitFullscreen() : enterFullscreen())}
              className="p-2 sm:p-2.5 rounded-xl border border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF] transition-all"
              title={isFullscreen ? 'Exit full screen' : 'Full screen — hide the browser bars'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          )}

          {/* Reopen the walkthrough. Hidden on the patient's screen and under
              Care Lock, like every other caregiver control up here. */}
          {!isPatientSession && !careLocked && (
            <button
              id="btn-tour"
              onClick={() => setShowTour(true)}
              className="p-2 sm:p-2.5 rounded-xl border border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF] transition-all"
              title="How Yadira works — the caregiver walkthrough"
              aria-label="Open the caregiver walkthrough"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}

          {/* Care Lock — tap to lock this device to the patient view; press
              and hold 3s to unlock. A confused zoom gesture can't do either
              by accident. */}
          <button
            id="btn-care-lock"
            onClick={() => {
              if (careLocked) return; // unlocking is hold-only
              if (window.confirm(`Lock this screen to ${patientName || 'the patient'}'s view? Caregiver controls will be hidden on this device. To unlock later, press and HOLD the lock for 3 seconds.`)) {
                setCareLock(true);
                setActiveTab('patient');
                // Locking is a kiosk gesture — go full screen too, so the
                // browser's own bars stop being stray-tap targets.
                enterFullscreen();
                playSoundCue('chime');
                toastSuccess('Care Lock on', 'This device now shows only the companion. Press and hold the lock for 3 seconds to unlock.');
              }
            }}
            onPointerDown={() => { if (careLocked) beginUnlockHold(); }}
            onPointerUp={cancelUnlockHold}
            onPointerLeave={cancelUnlockHold}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all select-none ${
              careLocked
                ? unlockHolding
                  ? 'border-[#3A5D45] bg-[#E8F1EB] text-[#3A5D45] scale-110'
                  : 'border-[#CEDFCF] bg-[#F2FAF4] text-[#3A5D45]'
                : 'border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF]'
            }`}
            title={careLocked ? 'Care Lock is on — press and hold 3 seconds to unlock' : 'Lock this device to the patient view'}
          >
            {careLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>

          {/* Hand over — back to the role screen, still signed in.
              Sits immediately beside Log out because that is the button
              caregivers were reaching for: the only route to the role screen
              used to be signing out, which removes the account and so breaks
              the very connection they were trying to hand over. */}
          {!isPatientSession && !careLocked && (
            <button
              id="btn-hand-over"
              onClick={() => {
                if (
                  window.confirm(
                    `Hand this device to ${patientName || 'them'}?\n\nYou stay signed in — this only returns to the choose-your-role screen, where they can tap "I'm a Patient".\n\nFor their own tablet, the padlock (Care Lock) is better: it hides the caregiver controls entirely.`
                  )
                ) {
                  handOverDevice();
                }
              }}
              className="p-2 sm:p-2.5 rounded-xl border border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-[#3A5D45] hover:border-[#CEDFCF] transition-all"
              title="Hand this device over — back to the role screen, still signed in"
              aria-label="Hand this device over, staying signed in"
            >
              <UserRoundCheck className="w-5 h-5" />
            </button>
          )}

          {/* Log out — returns to the role-selection/login screen. Confirmed
              first so a patient can't accidentally end their own session.
              Hidden under Care Lock: ending the session IS destructive. */}
          {!careLocked && (
            <button
              id="btn-logout"
              onClick={async () => {
                // Logging out is what unlinks a patient's device, and it does
                // not look like it. The account on the device is the ONLY
                // thing putting it in your care circle: without it the help
                // button raises an alert nobody receives. Said here because
                // this is the moment it happens, and because the alternative
                // — Care Lock — is one button away and does the job properly.
                const message = isPatientSession
                  ? 'Return to the Yadira login screen? (Caregiver use only)'
                  : `Log out of Yadira and return to the login screen?\n\nIf this is ${patientName || 'the patient'}'s own device, logging out disconnects it from your care circle — their help button will stop reaching you.\n\nTo hand the device over instead, cancel and use the padlock (Care Lock).`;
                if (window.confirm(message)) {
                  await logout();
                }
              }}
              className="p-2 sm:p-2.5 rounded-xl border border-[#E3DFC2] bg-white text-[#A6A27B] hover:text-red-600 hover:border-red-200 transition-all"
              title="Log out and return to the login screen"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Calming rooms picker */}
      {showRoomsMenu && (
        <SensoryRoomsMenu
          isPremium={true}
          onSelect={openRoom}
          onClose={() => setShowRoomsMenu(false)}
        />
      )}

      {/* First-run care circle, and the caregiver's walkthrough.
          BOTH are gated on this not being the patient's screen. A modal that
          interrupts, demands a sequence and hands out instructions is the
          opposite of what the companion side is for — and under Care Lock the
          device IS the patient's, whatever the session role underneath says. */}
      {!isPatientSession && !careLocked && firstRunSetup && (
        <FamilySetup firstRun onClose={skipFirstRunSetup} onApply={applyFamilyPack} />
      )}
      {!isPatientSession && !careLocked && showTour && (
        <CaregiverTour
          patientName={patientName}
          onClose={closeTour}
          onOpenSettings={() => {
            setActiveTab('caregiver');
            setCaregiverTab('settings');
          }}
        />
      )}

      {/* Developer mode is LOUD. A protection that is silently absent is worse
          than one that was never there, because everyone downstream still
          believes in it. Rendered above everything, on every screen, for as
          long as it lasts — including the patient view, because if this is
          somehow on while a patient is using the device that is exactly when
          somebody needs to notice. */}
      {devActive && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-xs sm:text-sm font-bold shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Developer mode — the companion is not protected from breaking character. Not for use with a patient.</span>
          <button
            id="btn-end-dev-mode"
            onClick={endDevMode}
            className="shrink-0 px-3 py-1 rounded-full bg-amber-950 text-amber-50 font-bold hover:bg-amber-900 transition-colors"
          >
            Turn off
          </button>
        </div>
      )}

      {/* Aurora full-screen overlay — rendered above everything */}
      {auroraActive && (
        <AuroraScreen onExit={() => setAuroraActive(false)} />
      )}

      {/* Premium sensory rooms */}
      {premiumRoom === 'rain' && <RainyWindow onExit={() => setPremiumRoom(null)} />}
      {premiumRoom === 'leaves' && <AutumnLeaves onExit={() => setPremiumRoom(null)} />}
      {premiumRoom === 'canopy' && <ForestCanopy onExit={() => setPremiumRoom(null)} />}
      {premiumRoom === 'water' && <StillWater onExit={() => setPremiumRoom(null)} />}

      {showClubMenu && (
        <ClubMenu
          onClose={() => setShowClubMenu(false)}
          onSelect={(id) => { setClubGame(id); setShowClubMenu(false); }}
        />
      )}
      {clubGame === 'pairs' && (
        <MemoryPairs
          onExit={() => setClubGame(null)}
          // Their own album, so a match is a memory rather than a shape —
          // but only the captioned ones. A caption means a caregiver looked
          // at that photo and kept it, which is the closest thing to consent
          // this has. An uncaptioned upload has been seen by nobody.
          photos={galleryPhotos
            .filter((p) => p.dataUrl && (p.caption || '').trim())
            .map((p) => p.dataUrl)}
        />
      )}
      {clubGame === 'simon' && <HattiesTune onExit={() => setClubGame(null)} />}
      {clubGame === 'tiles' && <SlidingNumbers onExit={() => setClubGame(null)} />}

      {/* Call Mode full-screen overlay */}
      {isCallActive && (
        <CallScreen
          callerName={patientMode === 'vivid' ? (representedPersona || 'Beth') : 'Yadira'}
          isSpeaking={isSpeaking}
          onUserSpoke={handleCallMessage}
          onExit={endCallMode}
          onSkipSpeech={stopSpeaking}
          chatMessages={chatMessages}
        />
      )}

      {/* Updated-terms review modal (opened from the Hub banner) */}
      {showTermsReview && (
        <TermsModal onClose={() => setShowTermsReview(false)} onAccept={acceptUpdatedTerms} />
      )}

      {/* The family photo album — full-screen photobook */}
      <AnimatePresence>
        {isAlbumOpen && (
          <PhotoAlbum
            key="photo-album"
            photos={galleryPhotos}
            companionName={patientMode === 'vivid' ? (representedPersona || 'Beth') : 'Yadira'}
            onClose={() => setIsAlbumOpen(false)}
            onAskAbout={(photo) => {
              // Close the book and hand the photo to the companion — the
              // conversation picks up right where their eyes were.
              setIsAlbumOpen(false);
              handleSendMessage(
                "I'm looking at a photo in our album.",
                undefined,
                { description: photo.caption, emotion: photo.emotion || 'warm', suggestions: [] }
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* Camp — Hattie's daily check-in, shown before the patient reaches chat */}
      <AnimatePresence>
        {campOpen && (
          <CampCheckIn
            key="camp"
            patientName={patientName}
            personaLabel={patientMode === 'vivid' ? (representedPersona || 'Beth') : 'Yadira'}
            todaysMood={todaysCheckIn?.mood ?? null}
            streakDays={checkinStreak}
            soundEnabled={soundFeedback}
            onCheckIn={handleCampCheckIn}
            onLeave={() => setCampOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Stage */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-8 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {activeTab === 'patient' ? (
            
            /* ================================================================= */
            /*                          PATIENT VIEW                            */
            /* ================================================================= */
            <PatientView
              chatMessages={chatMessages}
              memories={memories}
              faqs={faqs}
              routine={routine}
              patientName={patientName}
              caregiverName={caregiverName}
              patientMode={patientMode}
              representedPersona={representedPersona}
              isCaregiverPreview={isCaregiverPreview}
              helpReachesCaregiver={helpReachesCaregiver}
              caregiverAlert={caregiverAlert}
              handlePatientAlert={handlePatientAlert}
              userInput={userInput}
              setUserInput={setUserInput}
              handleSendMessage={handleSendMessage}
              isTyping={isTyping}
              messageLogRef={messageLogRef}
              mountIdsRef={mountIdsRef as React.MutableRefObject<Set<string>>}
              scrollLogToBottom={scrollLogToBottom}
              voiceEnabled={voiceEnabled}
              setVoiceEnabled={setVoiceEnabled}
              soundFeedback={soundFeedback}
              setSoundFeedback={setSoundFeedback}
              isSpeaking={isSpeaking}
              speakText={speakText}
              speakTextDirect={speakTextDirect}
              stopSpeaking={stopSpeaking}
              playSoundCue={playSoundCue}
              playMemorySoundscape={playMemorySoundscape}
              getThemeGradient={getThemeGradient}
              toggleRoutine={toggleRoutine}
              setIsCallActive={setIsCallActive}
              setIsAlbumOpen={setIsAlbumOpen}
              addPhotoToGallery={addPhotoToGallery}
            />
          ) : (
            
            /* ================================================================= */
            /*                         CAREGIVER HUB                             */
            /* ================================================================= */
            <motion.div
              key="caregiver-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="caregiver-layout space-y-6 md:space-y-8 flex-1 min-w-0"
            >

              {/* Updated-terms review banner (Terms §9) */}
              {termsOutdated && (
                <div className="bg-[#F2FAF4] border border-[#CEDFCF] rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-[#3A5D45] flex-1">
                    <b>Our Terms &amp; Acknowledgements have been updated.</b> Please review and accept the new version — your acceptance is recorded with its date.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTermsReview(true)}
                    className="shrink-0 px-4 py-2.5 bg-[#3A5D45] text-white text-sm font-bold rounded-xl hover:bg-[#2B4633] transition-all"
                  >
                    Review &amp; accept
                  </button>
                </div>
              )}

              {/* Terminal lucidity — the most important banner in the app.
                  Reverent, not alarming: violet-gold, no flashing. It says one
                  thing: go be with them. */}
              {lucidityAlert.active && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#F5F1FA] border-2 border-[#8B7BB8] rounded-3xl p-5 flex flex-col gap-4 shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[#EAE3F5] text-[#6B5B98] shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-extrabold text-[#4A3D6E]">
                        {patientName || 'Your loved one'} may be having a rare moment of clarity
                        {lucidityAlert.at ? ` — noticed at ${new Date(lucidityAlert.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                      <p className="text-sm text-[#5E5480] mt-1 leading-relaxed">
                        They are speaking with unusual awareness — about people they've lost, about themselves,
                        or about what's real. In late-stage dementia these windows can be brief and deeply precious.
                        Yadira is answering with gentle honesty and will not steer them back into comfortable
                        fictions. <strong>If you can, go be with them now, in person.</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {patientMode === 'vivid' && (
                      <button
                        type="button"
                        onClick={() => { setPatientMode('lucid'); sendLucidityAlert(false); playSoundCue('chime'); }}
                        className="flex-1 px-5 py-3 bg-[#6B5B98] hover:bg-[#574A80] text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                        title="Vivid Mode is active — switching to Lucid lets Yadira be fully honest as herself"
                      >
                        Switch to Lucid Mode & clear
                      </button>
                    )}
                    <button
                      type="button"
                      id="btn-ack-lucidity"
                      onClick={() => sendLucidityAlert(false)}
                      className="flex-1 px-5 py-3 bg-white hover:bg-[#F0EBF7] text-[#4A3D6E] font-semibold border border-[#C9BCE0] rounded-xl transition-all active:scale-95 text-sm"
                    >
                      I'm going to them — clear this
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Patient help-button alert — impossible to miss, cleared by acknowledging */}
              {caregiverAlert.active && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-md"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0 animate-pulse">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-amber-900">
                        {patientName || 'The patient'} pressed the help button
                        {caregiverAlert.at ? ` at ${new Date(caregiverAlert.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                      <p className="text-sm text-amber-800 mt-0.5">
                        Please check on them now. If this may be a medical emergency, call emergency services first.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-ack-alert"
                    onClick={() => sendCaregiverAlert(false)}
                    className="shrink-0 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all active:scale-95"
                  >
                    I'm on it — clear alert
                  </button>
                </motion.div>
              )}

              {/* Vivid invite — surfaces when a person is mentioned VIVID_INVITE_THRESHOLD times */}
              {vividInviteAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#EAF3EC] border-2 border-[#5C8D71] rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-md"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2.5 rounded-xl bg-[#D6EBD9] text-[#3A5D45] shrink-0">
                      <HeartHandshake className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-[#1E3A2A]">
                        {patientName || 'Your loved one'} has mentioned {vividInviteAlert.name} {vividInviteAlert.count} time{vividInviteAlert.count !== 1 ? 's' : ''} today.
                      </p>
                      <p className="text-sm text-[#3A5D45] mt-0.5">
                        Would you like to invite {vividInviteAlert.name} into the conversation? Yadira can speak as {vividInviteAlert.name}, the way {patientName || 'they'} remembers them.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAcceptVividInvite(vividInviteAlert.name)}
                      className="px-5 py-3 bg-[#3A5D45] hover:bg-[#2B4633] text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                    >
                      Invite {vividInviteAlert.name} to chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setVividInviteAlert(null)}
                      className="px-5 py-3 bg-white hover:bg-[#F0F7F2] text-[#3A5D45] font-semibold border border-[#CEDFCF] rounded-xl transition-all active:scale-95 text-sm"
                    >
                      Not right now
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Header Profile Dashboard Card */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-8 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                  <div className="w-16 h-16 rounded-full bg-[#E8F1EB] text-[#3A5D45] flex items-center justify-center border border-[#CEDFCF]">
                    <User className="w-9 h-9" />
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#2C2C2A] flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-0">
                      {patientName}'s Clinical Profile
                      <span className="sm:ml-3 text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {patientStage} Stage
                      </span>
                    </h2>
                    <p className="text-sm text-[#5E5D57] mt-1.5 leading-relaxed">
                      Primary Caregiver: <strong className="text-[#3A5D45]">{caregiverName} ({caregiverRelationship})</strong>
                    </p>
                    <p className="text-xs text-[#8A8981] mt-0.5">
                      Hobbies: <span className="italic">{patientHobbies}</span>
                    </p>
                  </div>
                </div>
                
                {/* Diagnostic Settings Edit Button */}
                <div className="md:col-span-4 flex justify-center md:justify-end">
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                    {/* Routine Regenerator triggering key */}
                    <button
                      onClick={handleGenerateAiRoutine}
                      disabled={loadingRoutine}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 bg-white border border-[#3A5D45] hover:bg-emerald-50 text-[#3A5D45] rounded-xl font-bold transition-all shadow-xs disabled:opacity-50"
                    >
                      {loadingRoutine ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Regen Routine</span>
                    </button>
                    
                    <button
                      id="btn-family-setup"
                      onClick={() => setShowFamilySetup(true)}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3.5 bg-[#FCFAF5] border border-[#E3DFC2] text-[#5E5D57] rounded-xl hover:bg-[#EAE8DD] transition-all font-bold"
                      title="Switch families or create a new care circle"
                    >
                      <Users className="w-5 h-5" />
                      <span>Switch / New Family</span>
                    </button>
                  </div>
                </div>
              </div>
 
              {/* Caregiver Hub Secondary Navigation */}
              <div className="flex gap-1 p-1 bg-[#F4F1EA] rounded-2xl border border-[#E3DFC2] w-full">
                {([
                  { id: 'talk',     label: 'Talk to Yadira', icon: '💬' },
                  { id: 'lodge',    label: "Hattie's Lodge", icon: '🛖' },
                  { id: 'today',    label: 'Today',          icon: '📋' },
                  { id: 'memories', label: 'Memories',       icon: '📷' },
                  { id: 'settings', label: 'Settings',       icon: '⚙️' },
                ] as { id: CaregiverTab; label: string; icon: string }[]).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCaregiverTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      caregiverTab === t.id
                        ? 'bg-white text-[#3A5D45] shadow-sm border border-[#E3DFC2]'
                        : 'text-[#7E7D76] hover:text-[#3A5D45] hover:bg-white/50'
                    }`}
                    aria-current={caregiverTab === t.id ? 'page' : undefined}
                  >
                    <span aria-hidden="true">{t.icon}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Hattie's Lodge — the caregiver's own place (Caregiver Pro) */}
              {caregiverTab === 'lodge' && (
                <LodgeScreen
                  isPremium={isPremium}
                  premiumBusy={premiumBusy}
                  onUnlock={startPremiumCheckout}
                  caregiverName={caregiverName}
                  caregiverRelationship={profile.caregiverRelationship}
                  patientName={patientName}
                  soundEnabled={soundFeedback}
                />
              )}

              {/* Ask Yadira — the caregiver's co-pilot */}
              {caregiverTab === 'talk' && (
              <div className="bg-white rounded-3xl border border-[#E3DFC2] shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-[#EFECDD] flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-[#E8F1EB] text-[#3A5D45] shrink-0">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#2C2C2A] flex items-center gap-2">
                        Ask Yadira about {patientName || 'your loved one'}
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                      </h3>
                      <p className="text-xs text-[#7E7D76] mt-0.5 leading-relaxed max-w-lg">
                        Your private co-pilot. Ask about {patientName || 'her'}'s patterns, what to do in hard moments, or what {representedPersona || 'Beth'} remembers.
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isPremium ? 'bg-[#3A5D45] text-white' : 'bg-[#EAE8DD] text-[#7E7D76]'}`}>
                    {isPremium ? 'Pro' : `${Math.max(0, CAREGIVER_CHAT_FREE_LIMIT - (aiUsage.caregiverChatCount || 0))} free left`}
                  </span>
                </div>

                {/* Ask Yadira, away from the screen.
                    These first shipped as two 11px outline buttons stacked in
                    the header corner under the status badge. They rendered at
                    every width — measured — and were still missed by the person
                    who asked for the feature, who received the weekly email
                    without ever finding the button that sends it. A control
                    nobody can find is not a shipped feature, so it gets a row,
                    a heading, and room to say what it does. */}
                <div className="px-5 sm:px-6 py-3.5 bg-[#FCFAF5] border-b border-[#EFECDD]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7E7D76] mb-2">
                    Not at your desk?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      id="btn-briefing-call"
                      onClick={requestBriefingCall}
                      disabled={briefingCalling}
                      title={
                        helpCall.escalationPhone
                          ? 'Yadira calls your phone and tells you how the week went'
                          : 'Save your phone number in Settings first'
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A5D45] text-white text-sm font-bold hover:bg-[#2B4633] shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <Phone className="w-4 h-4 shrink-0" />
                      {briefingCalling ? 'Calling you…' : 'Call me with the week'}
                    </button>
                    <button
                      type="button"
                      id="btn-briefing-email"
                      onClick={() => sendBriefingEmail(false)}
                      title="Send the week to your inbox now"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E3DFC2] text-[#5E5D57] text-sm font-bold hover:bg-[#F4F1EA] transition-all active:scale-95"
                    >
                      <Mail className="w-4 h-4 shrink-0" />
                      Email me the week
                    </button>
                  </div>
                  <p className="text-[11px] text-[#A6A27B] mt-2 leading-snug">
                    Yadira reads you {patientName || 'their'} week down the phone, or sends it to your
                    inbox. The email also arrives on its own once a week.
                  </p>
                </div>

                <div ref={caregiverLogRef} className="px-5 sm:px-6 py-4 space-y-3 overflow-y-auto min-h-[180px] max-h-[360px]">
                  {caregiverChat.length === 0 ? (
                    <div className="py-4">
                      <p className="text-sm text-[#5E5D57] mb-3">Not sure where to start? Try:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          `How has ${patientName || 'she'} been sleeping?`,
                          `What should I do when ${patientName || 'she'} asks for someone who has passed?`,
                          `What does ${representedPersona || 'Beth'} remember about ${patientName || 'her'}?`,
                          `A few ways to connect with ${patientName || 'her'} today?`,
                        ].map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleCaregiverSend(s)}
                            className="text-left text-xs font-medium px-3 py-2 rounded-xl border border-[#E3DFC2] bg-[#FCFAF5] text-[#3A5D45] hover:bg-[#F2FAF4] hover:border-[#CEDFCF] transition-all"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    caregiverChat.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#3A5D45] text-white' : 'bg-[#F4F1EA] text-[#2C2C2A] border border-[#E3DFC2]'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {caregiverTyping && (
                    <div className="flex justify-start">
                      <div className="px-4 py-2.5 rounded-2xl bg-[#F4F1EA] border border-[#E3DFC2] text-[#7E7D76] text-sm flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Yadira is thinking…
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5 border-t border-[#EFECDD] bg-[#FCFAF5]">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCaregiverSend(caregiverInput); }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={caregiverInput}
                      onChange={(e) => setCaregiverInput(e.target.value)}
                      disabled={caregiverTyping}
                      placeholder={`Ask about ${patientName || 'your loved one'}…`}
                      className="flex-1 px-4 py-3 rounded-xl border border-[#C4C09E] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5C8D71] disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={caregiverTyping || !caregiverInput.trim()}
                      className="p-3 rounded-xl bg-[#3A5D45] text-white hover:bg-[#2B4633] transition-all disabled:opacity-40 shrink-0"
                      aria-label="Send"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                  {!isPremium && (aiUsage.caregiverChatCount || 0) >= CAREGIVER_CHAT_FREE_LIMIT && (
                    <p className="text-[11px] text-[#7E7D76] mt-2">
                      You've used your free messages. <span className="font-semibold text-[#3A5D45]">Caregiver Pro ({PRICE_SHORT})</span> unlocks unlimited caregiver chat.
                    </p>
                  )}
                  <p className="text-[10px] text-[#A6A27B] mt-2">Yadira can be wrong and isn't a doctor — for medical decisions, contact your clinician.</p>
                </div>
              </div>

              )}

              {/* ── SETTINGS TAB ─────────────────────────────────────────── */}
              {caregiverTab === 'settings' && (
                <SettingsTab
                  profile={profile}
                  patientMode={patientMode}
                  setPatientMode={setPatientMode}
                  representedPersona={representedPersona}
                  setRepresentedPersona={setRepresentedPersona}
                  representedVoiceId={representedVoiceId}
                  setRepresentedVoiceId={setRepresentedVoiceId}
                  setShowCloneVoice={setShowCloneVoice}
                  yadiraVoice={yadiraVoice}
                  setYadiraVoice={setYadiraVoice}
                  companionPersonality={companionPersonality}
                  setCompanionPersonality={setCompanionPersonality}
                  driftEnabled={driftEnabled}
                  setDriftEnabled={setDriftEnabled}
                  driftTimeoutSeconds={driftTimeoutSeconds}
                  setDriftTimeoutSeconds={setDriftTimeoutSeconds}
                  dashTheme={dashTheme}
                  setDashTheme={setDashTheme}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  setAuroraActive={setAuroraActive}
                  helpCall={helpCall}
                  setHelpCall={setHelpCall}
                  helpCallStatus={helpCallStatus}
                  sendTestCall={sendTestCall}
                  testingCall={testingCall}
                  isPremium={isPremium}
                  premium={premium}
                  premiumBusy={premiumBusy}
                  startPremiumCheckout={startPremiumCheckout}
                  openBillingPortal={openBillingPortal}
                  setPremium={setPremium}
                  playSoundCue={playSoundCue}
                />
              )}

              {/* ── TODAY TAB ────────────────────────────────────────────── */}
              {caregiverTab === 'today' && (
                <TodayTab
                  logs={logs}
                  faqs={faqs}
                  patientName={patientName}
                  todaysCheckIn={todaysCheckIn}
                  moodLabel={moodLabel}
                  aiInsights={aiInsights}
                  loadingInsights={loadingInsights}
                  handleGenerateInsights={handleGenerateInsights}
                  handleAddLog={handleAddLog}
                  handleDeleteLog={handleDeleteLog}
                  handleAddFaq={handleAddFaq}
                  handleDeleteFaq={handleDeleteFaq}
                  logConfusion={logConfusion}
                  setLogConfusion={setLogConfusion}
                  logMood={logMood}
                  setLogMood={setLogMood}
                  logHydration={logHydration}
                  setLogHydration={setLogHydration}
                  logSleep={logSleep}
                  setLogSleep={setLogSleep}
                  logMeds={logMeds}
                  setLogMeds={setLogMeds}
                  logNotes={logNotes}
                  setLogNotes={setLogNotes}
                  newFaqQuest={newFaqQuest}
                  setNewFaqQuest={setNewFaqQuest}
                  newFaqAns={newFaqAns}
                  setNewFaqAns={setNewFaqAns}
                />
              )}

              {/* ── MEMORIES TAB ─────────────────────────────────────────── */}
              {caregiverTab === 'memories' && (
                <MemoriesTab
                  memories={memories}
                  handleDeleteMemory={handleDeleteMemory}
                  setShowMemModal={setShowMemModal}
                  patientName={patientName}
                  representedPersona={representedPersona}
                  handleSendRedirection={handleSendRedirection}
                  handleStartFreshSession={handleStartFreshSession}
                  personaFile={personaFile}
                  setPersonaFile={setPersonaFile}
                  galleryPhotos={galleryPhotos}
                  setGalleryPhotos={setGalleryPhotos}
                  addPhotoToGallery={addPhotoToGallery}
                  editingPhotoId={editingPhotoId}
                  setEditingPhotoId={setEditingPhotoId}
                  editingCaption={editingCaption}
                  setEditingCaption={setEditingCaption}
                  saveCaption={saveCaption}
                  getThemeGradient={getThemeGradient}
                  playSoundCue={playSoundCue}
                  toastSuccess={toastSuccess}
                />
              )}

              {/* Add Memory Modal Dialog */}
              {showFamilySetup && (
                <FamilySetup onClose={() => setShowFamilySetup(false)} onApply={applyFamilyPack} />
              )}

              {showCloneVoice && (
                <CloneVoiceModal
                  currentValue={representedVoiceId}
                  onClose={() => setShowCloneVoice(false)}
                  onSave={setRepresentedVoiceId}
                />
              )}

              {showMemModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white max-w-md w-full p-6 rounded-3xl border border-[#E3DFC2] shadow-xl space-y-4"
                  >
                    <h3 className="text-xl font-bold text-[#2C2C2A]">Add Treasured Memory Card</h3>
                    <form onSubmit={handleAddMemory} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#5E5D57] mb-1">Memory Title</label>
                        <input
                          type="text"
                          required
                          value={newMemTitle}
                          onChange={(e) => setNewMemTitle(e.target.value)}
                          placeholder="Wedding Day, Family Dog..."
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#5E5D57] mb-1">Era or Person Reference</label>
                        <input
                          type="text"
                          value={newMemEra}
                          onChange={(e) => setNewMemEra(e.target.value)}
                          placeholder="e.g., Husband, Summer 1980"
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#5E5D57] mb-1">Detailed Narrative Story</label>
                        <textarea
                          required
                          rows={3}
                          value={newMemDesc}
                          onChange={(e) => setNewMemDesc(e.target.value)}
                          placeholder="Write a warm, sensory narrative story. Use active, cheerful phrasing."
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#5E5D57] mb-1">Card Graphic Theme</label>
                        <select
                          value={newMemTheme}
                          onChange={(e: any) => setNewMemTheme(e.target.value)}
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm"
                        >
                          <option value="family">Family (Warm, Home, Pets)</option>
                          <option value="nature">Nature (Scenic, Outdoors, Trips)</option>
                          <option value="wedding">Wedding (Romantic, Celebration)</option>
                          <option value="retro">Historical / Retro (Eras, Youth)</option>
                          <option value="home">Home (Daily Life, Comfort)</option>
                        </select>
                      </div>
                      <div className="flex space-x-3 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowMemModal(false)}
                          className="flex-1 py-3 bg-[#FCFAF5] hover:bg-[#EAE8DD] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#5E5D57]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold"
                        >
                          Create Memory Card
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 bg-white/90 backdrop-blur-sm border-t border-[#E3DFC2] py-6 px-4 text-center text-xs text-[#7E7D76] font-medium mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <HeartHandshake className="w-4 h-4 text-[#3A5D45]" />
            <span>Yadira — a companion for families navigating dementia</span>
          </div>
          <p className="text-xs">
            A comfort companion, not a medical device. In an emergency, always call emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Brief splash while auth resolves — same cream as the logo animation so the
// hand-off to the login intro (or the app) is one continuous surface. The
// full animation moment lives in LoginScreen, before logging in; signed-in
// users are never held up here.
function SplashScreen() {
  return (
    <div
      role="status"
      aria-label="Yadira is loading"
      className="min-h-screen bg-[#D5D1C2]"
    />
  );
}

// Wrapper component with Auth
function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AppContent />;
}

export default function AppWithProvider() {
  return (
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  );
}
