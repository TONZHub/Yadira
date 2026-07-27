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
  Phone,
  PhoneOff,
  Tent,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  ALargeSmall,
  Moon,
  Sun
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Message, Memory, CustomFAQ, DailyLog, RoutineItem, PersonaFile, SessionMoment, MoodCheckIn, GalleryPhoto } from './types';
import { DEFAULT_PROFILE, DEFAULT_PERSONA_FILE } from './types';
import { useStoreList, useStoreDoc } from './lib/useStore';
import { useLargeFont } from './lib/fontScale';
import { useTheme, THEMES } from './lib/theme';
import { getCircleId, isFirebaseConfigured } from './lib/firebase';
import { CALLE_REGIONS } from './server/calleRegions';
import { VoiceInput, MediaUpload, EmotionBadge, LoginScreen, AuroraScreen, DigestibleMessage, FamilySetup, SensoryRoomsMenu, RainyWindow, AutumnLeaves, ForestCanopy, CallScreen, CampCheckIn, TermsModal, TERMS_VERSION, PhotoAlbum, CloneVoiceModal } from './components';
import type { FamilyPackApply } from './components';
import type { RoomId } from './lib/sensoryRooms';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider, useToast } from './lib/ToastContext';
import { DEMO_MEMORIES, DEMO_FAQS, DEMO_LOGS, DEMO_ROUTINE } from './lib/demoData';
import { playMemorySoundscape } from './lib/soundscapes';
import { ChatMessageSkeleton, MemorySkeleton, RoutineSkeleton, LogSkeleton } from './components/LoadingSkeletons';
import LodgeScreen from './lodge/LodgeScreen';

// Realistic pre-populated clinical logs for a high-fidelity starting state (caregiver charts look populated immediately)
const INITIAL_LOGS: DailyLog[] = [
  { date: '07-02', confusionLevel: 2, mood: 'peaceful', hydrationCups: 6, sleepHours: 7.5, medsTaken: true, notes: 'Eleanor was very engaged in the morning. Had tea and talked about gardening.' },
  { date: '07-03', confusionLevel: 3, mood: 'anxious', hydrationCups: 4, sleepHours: 6.0, medsTaken: true, notes: 'Some sundowning agitation around 5 PM. Calmed down after hearing soft music.' },
  { date: '07-04', confusionLevel: 4, mood: 'restless', hydrationCups: 5, sleepHours: 5.5, medsTaken: true, notes: 'Slightly more confused today, asked for her mother twice. Grounded with old photos.' },
  { date: '07-05', confusionLevel: 2, mood: 'peaceful', hydrationCups: 7, sleepHours: 8.0, medsTaken: true, notes: 'Excellent day. Had family visit. Remained coherent and smiling.' },
  { date: '07-06', confusionLevel: 3, mood: 'sad', hydrationCups: 6, sleepHours: 6.5, medsTaken: true, notes: 'A bit quiet and withdrawn. Listened to old jazz records which cheered her up.' },
  { date: '07-07', confusionLevel: 2, mood: 'peaceful', hydrationCups: 8, sleepHours: 7.5, medsTaken: true, notes: 'Stable. Engaged in puzzle solving.' },
];

const INITIAL_MEMORIES: Memory[] = [
  {
    id: 'mem-1',
    title: 'Your Wedding with Edward (1974)',
    description: 'You married Edward on a beautiful sunny June day in the rose garden. You wore a white lace dress and danced to "Can\'t Help Falling in Love".',
    relationshipOrEra: 'Edward (Husband)',
    imageTheme: 'wedding'
  },
  {
    id: 'mem-2',
    title: 'Your Dog, Barnaby',
    description: 'Barnaby was a sweet golden retriever who loved running after tennis balls and sleeping right at the foot of your bed. He was your loyal companion.',
    relationshipOrEra: 'Pet',
    imageTheme: 'family'
  },
  {
    id: 'mem-3',
    title: 'Growing up in Lake Tahoe',
    description: 'You spent summers swimming in the crystal blue waters of Lake Tahoe and winters drinking hot cocoa with marshmallow by the stone fireplace.',
    relationshipOrEra: 'Childhood',
    imageTheme: 'nature'
  }
];

const INITIAL_FAQS: CustomFAQ[] = [
  {
    id: 'faq-1',
    question: 'Where is my family?',
    answer: 'Your son Thomas is currently at work, dear. He loves you very much and is coming over to have dinner with you at 5:30 PM. You are completely safe and warm here.'
  },
  {
    id: 'faq-2',
    question: 'Where am I?',
    answer: 'You are in your beautiful, cozy apartment in Portland. Your favorite green chair is right here, and your favorite tea is brewing. You are safe.'
  }
];

const DEFAULT_ROUTINE: RoutineItem[] = [
  {
    id: 'rout-1',
    time: '08:30 AM',
    title: 'Morning Sunshine & Warm Tea',
    description: 'Open the blinds for natural morning light to help establish circadian rhythm. Share a warm chamomile tea and a simple, nutritious breakfast.',
    caregiverTips: 'Speak in short, bright sentences. Use a cheerful tone to start the day positively.',
    completed: false
  },
  {
    id: 'rout-2',
    time: '10:00 AM',
    title: 'Memory Album Reminiscence',
    description: 'Flip through the Yadira Memory Book or physical albums. Ask open-ended sensory questions (e.g., "Doesn\'t that lake look beautiful and cool?").',
    caregiverTips: 'Do not test or quiz them ("Do you remember who this is?"). Instead, share the memory directly ("This is you and Edward at Tahoe!").',
    completed: false
  },
  {
    id: 'rout-3',
    time: '12:30 PM',
    title: 'Nourishing Lunch & Hydration Check',
    description: 'Serve a colourful lunch rich in Omega-3s. Fill a clear cup with water and gently encourage drinking.',
    caregiverTips: 'Place the cup directly in their line of sight. Hand-to-hand guidance is helpful if they forget to sip.',
    completed: false
  },
  {
    id: 'rout-4',
    time: '03:00 PM',
    title: 'Gentle Classical Music & Puzzle',
    description: 'Play soft piano or orchestral music (classical baroque or Chopin) while working on a simple tactile puzzle or folding warm linens.',
    caregiverTips: 'Music is incredibly powerful for memory. If they want to hum or move, join in gently.',
    completed: false
  },
  {
    id: 'rout-5',
    time: '06:00 PM',
    title: 'Calming Dinner & Grounding Conversation',
    description: 'Keep the dinner environment quiet and dim to counter any evening sundowning confusion. Reassure them that they are safe at home.',
    caregiverTips: 'Avoid noisy television or clattering dishes. Speak slowly and maintain reassuring eye contact.',
    completed: false
  }
];

function AppContent() {
  const { user, sessionRole, logout } = useAuth();
  const isPatientSession = sessionRole === 'patient';
  const { error: toastError, success: toastSuccess } = useToast();
  const [demoSeeded, setDemoSeeded] = useState(false);

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
  const personaFileRef = useRef(personaFile);
  personaFileRef.current = personaFile;

  // Seed demo data on first login
  useEffect(() => {
    if (user && !demoSeeded) {
      // Per-circle flag: each new family gets the sample content once, and a
      // second account on the same browser doesn't inherit the first's flag.
      const seededKey = `yadira_${getCircleId()}_seeded_demo`;
      const isFirstLogin = localStorage.getItem(seededKey) !== 'true';
      if (isFirstLogin) {
        setMemories(DEMO_MEMORIES);
        setFaqs(DEMO_FAQS);
        setLogs(DEMO_LOGS);
        setRoutine(DEMO_ROUTINE);
        localStorage.setItem(seededKey, 'true');
        setDemoSeeded(true);
        if (sessionRole === 'patient') {
          toastSuccess('Welcome back', `${patientName || 'Eleanor'}, you are safe and supported.`);
        } else {
          toastSuccess('Welcome, Thomas!', `${patientName || 'Eleanor'}'s profile is loaded and ready`);
        }
      }
    }
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
  const [aiUsage, setAiUsage] = useStoreDoc<{ lastInsightsAt?: number; lastRoutineAt?: number; caregiverChatCount?: number }>('aiUsage', {});

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

  // Renewal / lapse check: once the paid-through date (plus a 3-day retry
  // grace window) has passed, re-verify the subscription with Stripe and
  // downgrade if it was canceled. Skipped entirely for demo-toggled premium
  // (no subscriptionId) and on patient devices.
  useEffect(() => {
    if (isPatientSession || !premium.unlocked || !premium.subscriptionId || !premium.currentPeriodEnd) return;
    const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() < premium.currentPeriodEnd + GRACE_MS) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/stripe/subscription-status?subscription_id=${encodeURIComponent(premium.subscriptionId!)}`,
          { headers: authHeaders() }
        );
        if (!res.ok) return; // network/config hiccup — never downgrade blind
        const data = await res.json();
        if (data.active) {
          setPremium({ ...premium, currentPeriodEnd: data.currentPeriodEnd || premium.currentPeriodEnd });
        } else {
          setPremium({ ...premium, unlocked: false });
          toastError('Caregiver Pro ended', 'Your Caregiver Pro subscription is no longer active — the companion stays free for your family. You can re-subscribe any time from the Caregiver Hub.');
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
  const startPremiumCheckout = async () => {
    setPremiumBusy(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ circle: getCircleId() }),
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
      body: JSON.stringify({ active, circle: getCircleId() }),
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
            // Bail out when nothing changed — a fresh object every poll tick
            // re-renders the whole app every 1.5s for no reason.
            setCaregiverAlertState((prev) =>
              prev.active === data.active && prev.at === (data.at || 0)
                ? prev
                : { active: data.active, at: data.at || 0 }
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
  const handlePatientAlert = () => {
    if (caregiverAlert.active) return; // already raised
    sendCaregiverAlert(true);
    const name = caregiverName || 'Your caregiver';
    const comfort = `${name} has been told, ${patientName || 'dear'}. They will come to you soon. I'm right here with you until then.`;
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
    if (!window.confirm(`Load "${label}" into this care circle? This REPLACES the current profile, memories, FAQs, logs, and routine.`)) {
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
  const handleSendMessage = async (textToSend: string, emotion?: { emotion: string; confidence: number; tone: string }, mediaInsight?: { description: string; emotion: string; suggestions: string[] }) => {
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
        contextualMessage += ` [Detected emotion: ${emotion.emotion}]`;
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
        `The free plan includes one AI routine per week — the next is available in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Caregiver Pro ($5/week) generates them without limits.`
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
        `The free plan includes one AI insights report per week — the next is available in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Caregiver Pro ($5/week) has no limits.`
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
        `You've used your ${CAREGIVER_CHAT_FREE_LIMIT} free Ask Yadira messages. Caregiver Pro ($5/week) unlocks unlimited caregiver chat.`
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

          {/* Log out — returns to the role-selection/login screen. Confirmed
              first so a patient can't accidentally end their own session.
              Hidden under Care Lock: ending the session IS destructive. */}
          {!careLocked && (
            <button
              id="btn-logout"
              onClick={async () => {
                const message = isPatientSession
                  ? 'Return to the Yadira login screen? (Caregiver use only)'
                  : 'Log out of Yadira and return to the login screen?';
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

      {/* Aurora full-screen overlay — rendered above everything */}
      {auroraActive && (
        <AuroraScreen onExit={() => setAuroraActive(false)} />
      )}

      {/* Premium sensory rooms */}
      {premiumRoom === 'rain' && <RainyWindow onExit={() => setPremiumRoom(null)} />}
      {premiumRoom === 'leaves' && <AutumnLeaves onExit={() => setPremiumRoom(null)} />}
      {premiumRoom === 'canopy' && <ForestCanopy onExit={() => setPremiumRoom(null)} />}

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
            <motion.div
              key="patient-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1"
            >
              
              {/* Left Column: Yadira Core Conversation Window */}
              <div className={`lg:col-span-7 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden min-h-[550px] lg:min-h-[650px] transition-all duration-500 ${
                patientMode === 'vivid' ? 'border-rose-200 ring-2 ring-rose-500/5' : 'border-[#E3DFC2]'
              }`}>
                
                {/* Active Yadira Header — extra top padding so the avatar and
                    its pulsing halo sit clear of the card's clipped top edge */}
                <div className={`border-b px-6 pt-7 pb-4 flex items-center justify-between transition-all duration-500 ${
                  patientMode === 'vivid' ? 'bg-[#FCF6F6] border-rose-100' : 'bg-[#FAF9F5] border-[#E3DFC2]'
                }`}>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      {/* Gentle pulsating visual heartbeat matching respiration rate */}
                      <span className={`absolute inset-0 rounded-full opacity-20 animate-ping transition-all duration-500 ${
                        patientMode === 'vivid' ? 'bg-rose-500' : 'bg-[#5C8D71]'
                      }`}></span>
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-tr flex items-center justify-center text-white border-2 border-white shadow-sm relative transition-all duration-500 ${
                        patientMode === 'vivid' 
                          ? 'from-rose-400 to-pink-500' 
                          : 'from-[#5C8D71] to-[#92B4A1]'
                      }`}>
                        <HeartHandshake className="w-7 h-7" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[#2C2C2A] leading-tight">
                          {patientMode === 'vivid' ? representedPersona : 'Yadira'}
                        </h2>
                        {isCaregiverPreview && (
                          <span className="inline-flex items-center rounded-full border border-[#E3DFC2] bg-[#F7F3EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7E7D76]">
                            Preview
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-semibold flex items-center transition-all duration-500 ${
                        patientMode === 'vivid' ? 'text-rose-500' : 'text-[#5C8D71]'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-1.5 animate-pulse transition-all duration-500 ${
                          patientMode === 'vivid' ? 'bg-rose-500' : 'bg-[#5C8D71]'
                        }`}></span>
                        {patientMode === 'vivid' ? 'Right here with you' : 'Sitting right here with you'}
                      </p>
                    </div>
                  </div>

                  {/* Accessibility Audio Settings */}
                  <div className="flex items-center space-x-2">
                    {/* Stop talking — appears only while Yadira is speaking.
                        Big, labeled, and instant: "quiet, please" should never
                        require hunting for a mute setting. */}
                    <AnimatePresence>
                      {isSpeaking && (
                        <motion.button
                          key="stop-speaking"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          id="btn-stop-speaking"
                          onClick={() => { stopSpeaking(); if (soundFeedback) playSoundCue('pop'); }}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#C4877B] bg-[#FBF1EE] text-[#9C4A38] font-bold text-sm hover:bg-[#F6E3DE] transition-all active:scale-95"
                          title="Stop Yadira's voice right now"
                        >
                          <VolumeX className="w-5 h-5" />
                          Stop talking
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <button
                      id="toggle-voice"
                      onClick={() => { setVoiceEnabled(!voiceEnabled); playSoundCue('pop'); }}
                      className={`p-3 rounded-xl border transition-all ${
                        voiceEnabled 
                          ? 'bg-[#E8F1EB] text-[#3A5D45] border-[#CEDFCF]' 
                          : 'bg-[#F2EFE9] text-[#7E7D76] border-[#D8D5C4]'
                      }`}
                      title={voiceEnabled ? "Mute Yadira's Voice" : "Enable Yadira's Voice"}
                    >
                      {voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                    </button>
                    <button
                      id="toggle-chime"
                      onClick={() => { setSoundFeedback(!soundFeedback); playSoundCue('pop'); }}
                      className={`p-3 rounded-xl border transition-all ${
                        soundFeedback 
                          ? 'bg-[#E8F1EB] text-[#3A5D45] border-[#CEDFCF]' 
                          : 'bg-[#F2EFE9] text-[#7E7D76] border-[#D8D5C4]'
                      }`}
                      title={soundFeedback ? "Mute sound triggers" : "Enable sound triggers"}
                    >
                      <Music2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Subtitle / Big Screen Text Display */}
                <div className="bg-[#FAF9F5] border-b border-[#E3DFC2] px-6 py-2 text-center text-xs text-[#8A8981] font-medium tracking-wide">
                  CLINICAL ACCESSIBILITY STANDARD: SENSORY CONTRAST & SLOW DIALOGUE REASSURANCE
                </div>

                {/* Message Log */}
                <div ref={messageLogRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FCFAF5]">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'model' ? (
                        // Model replies land one thought per bubble, revealed at
                        // a human pace — a paragraph is a wall of text to a
                        // dementia patient; a sentence is a moment.
                        <DigestibleMessage
                          text={msg.text}
                          animate={!mountIdsRef.current?.has(msg.id)}
                          bubbleClassName="rounded-2xl p-5 shadow-xs transition-all bg-white text-[#2C2C2A] border border-[#E4E0C4] rounded-tl-none font-medium"
                          textClassName="text-lg md:text-xl leading-relaxed tracking-wide font-sans"
                          onChunkRevealed={scrollLogToBottom}
                          extras={
                            msg.mediaInsight ? (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-900">
                                  <span className="font-semibold">Photo:</span> {msg.mediaInsight.description}
                                </p>
                                <div className="mt-1">
                                  <EmotionBadge emotion={msg.mediaInsight.emotion} />
                                </div>
                              </div>
                            ) : undefined
                          }
                          footer={
                            <div className="flex items-center justify-between mt-3 text-xs text-[#8A8981]">
                              <span>{msg.timestamp}</span>
                              <button
                                onClick={() => speakText(msg.text)}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-[#F5F3EC] hover:bg-[#EAE8DD] rounded-md transition-all text-[#3A5D45]"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="font-semibold text-xs">Read to me</span>
                              </button>
                            </div>
                          }
                        />
                      ) : (
                        <div className="max-w-[85%] rounded-2xl p-5 shadow-xs transition-all bg-[#E3EFE7] text-[#25422F] border border-[#CEDFCE] rounded-tr-none">
                          {/* Huge easy-to-read text size for dementia patients */}
                          <p className="text-lg md:text-xl leading-relaxed tracking-wide font-sans">
                            {msg.text}
                          </p>

                          {msg.emotion && (
                            <div className="mt-2">
                              <EmotionBadge emotion={msg.emotion.emotion} confidence={msg.emotion.confidence} />
                            </div>
                          )}

                          {msg.mediaInsight && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm text-blue-900">
                                <span className="font-semibold">Photo:</span> {msg.mediaInsight.description}
                              </p>
                              <div className="mt-1">
                                <EmotionBadge emotion={msg.mediaInsight.emotion} />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 text-xs text-[#8A8981]">
                            <span>{msg.timestamp}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-[#E4E0C4] rounded-2xl rounded-tl-none p-5 shadow-xs">
                        <div className="flex items-center space-x-2 text-[#5C8D71]">
                          <span className="text-sm font-semibold tracking-wide animate-pulse">
                            {patientMode === 'vivid' ? `${representedPersona} is thinking gently...` : 'Yadira is thinking gently...'}
                          </span>
                          <div className="flex space-x-1">
                            <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                </div>

                {/* Pre-configured Helpful Anxious Cues */}
                <div className="bg-[#FAF9F5] border-t border-[#E3DFC2] p-4 flex flex-wrap gap-2.5">
                  <span className="text-xs text-[#7E7D76] w-full font-bold uppercase tracking-wider mb-1 px-1">
                    Tap to ask {patientMode === 'vivid' ? representedPersona : 'Yadira'}:
                  </span>
                  {faqs.map((faq) => (
                    <button
                      key={faq.id}
                      id={`patient-faq-${faq.id}`}
                      onClick={() => handleSendMessage(faq.question)}
                      disabled={isTyping}
                      className="px-4 py-2.5 bg-white border border-[#E3DFC2] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#EAE8DD] hover:border-[#C4C09E] transition-all duration-200 active:scale-95 text-left max-w-full truncate shadow-xs"
                    >
                      {faq.question}
                    </button>
                  ))}
                  <button
                    onClick={() => handleSendMessage("Tell me a comforting story.")}
                    disabled={isTyping}
                    className="px-4 py-2.5 bg-white border border-[#E3DFC2] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#EAE8DD] hover:border-[#C4C09E] transition-all duration-200 shadow-xs"
                  >
                    📖 Tell me a story
                  </button>
                  {/* Always visible — a feature that appears and disappears is
                      confusing for the patient and invisible in demos. The
                      album itself handles the empty state warmly. */}
                  <button
                    id="btn-open-album"
                    onClick={() => {
                      setIsAlbumOpen(true);
                      if (soundFeedback) playSoundCue('pop');
                    }}
                    className="px-4 py-2.5 bg-[#F2FAF4] border border-[#CEDFCF] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#E4F0E7] hover:border-[#9DBFA8] transition-all duration-200 shadow-xs"
                  >
                    📷 Look at our photos
                  </button>
                  <button
                    onClick={() => handleSendMessage("Help me feel calm, I am a bit anxious.")}
                    disabled={isTyping}
                    className="px-4 py-2.5 bg-[#FFF2F2] border border-[#FFD9D9] text-sm font-bold text-red-700 rounded-xl hover:bg-red-100 transition-all duration-200 shadow-xs"
                  >
                    ❤️ Help me feel calm
                  </button>

                  {/* The help button — always visible, full width, one tap
                      reaches a real human. Confirmation state stays until the
                      caregiver acknowledges from the Hub. */}
                  <button
                    id="btn-alert-caregiver"
                    onClick={handlePatientAlert}
                    disabled={caregiverAlert.active}
                    className={`w-full mt-1 px-4 py-3.5 rounded-2xl text-base font-extrabold transition-all duration-200 active:scale-[0.98] shadow-xs border-2 flex items-center justify-center gap-2.5 ${
                      caregiverAlert.active
                        ? 'bg-[#F2FAF4] border-[#CEDFCF] text-[#3A5D45]'
                        : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    }`}
                  >
                    {caregiverAlert.active ? (
                      <>
                        <Check className="w-5 h-5" />
                        {caregiverName || 'Your caregiver'} has been told — they're coming
                      </>
                    ) : (
                      <>
                        <HeartHandshake className="w-5 h-5" />
                        I need {caregiverName || 'my caregiver'} — please come
                      </>
                    )}
                  </button>
                </div>

                {/* Patient Chat Input */}
                <div className="p-4 bg-white border-t border-[#E3DFC2] flex flex-col gap-3">
                  {/* Voice and Media Controls */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 sm:min-w-[200px]">
                      <VoiceInput
                        onTranscript={(text, emotion) => handleSendMessage(text, emotion)}
                        disabled={isTyping}
                        isPremium={true}
                      />
                    </div>
                    <div className="flex-1 min-w-0 sm:min-w-[200px]">
                      <MediaUpload
                        onMediaAnalyzed={(insight, photoDataUrl) => {
                          // Keep the photo — it goes into the family's album
                          // instead of vanishing after analysis.
                          if (photoDataUrl) addPhotoToGallery(photoDataUrl, insight, 'patient');
                          const msg = `I see something interesting!`;
                          handleSendMessage(msg, undefined, insight);
                        }}
                        disabled={isTyping}
                        isPremium={true}
                      />
                    </div>
                  </div>

                  {/* Text Input */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)}
                      placeholder={`Type here to talk to ${patientMode === 'vivid' ? representedPersona : 'Yadira'}, ${patientName || 'dear'}...`}
                      disabled={isTyping}
                      className="flex-1 px-5 py-4 border border-[#C4C09E] rounded-2xl focus:outline-hidden focus:ring-3 focus:ring-[#5C8D71] focus:border-transparent text-lg md:text-xl font-medium bg-[#FCFAF5] shadow-inner"
                      id="patient-chat-input"
                    />
                    <button
                      id="btn-call-mode"
                      onClick={() => {
                        setIsCallActive(true);
                        playSoundCue('chime');
                      }}
                      className="w-full sm:w-auto p-4 rounded-2xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center sm:min-w-[60px] bg-blue-600 hover:bg-blue-700 text-white"
                      title="Start a hands-free Call Mode session"
                    >
                      <Phone className="w-7 h-7" />
                    </button>
                    <button
                      id="btn-send-message"
                      onClick={() => handleSendMessage(userInput)}
                      disabled={isTyping || !userInput.trim()}
                      className="w-full sm:w-auto p-4 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center sm:min-w-[60px]"
                    >
                      <Send className="w-7 h-7" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Routine Cues & Memory Book */}
              <div className="lg:col-span-5 flex flex-col space-y-8">
                
                {/* Daily Routine / Care Tasks Visual Checklist */}
                <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-[#2C2C2A]">Today's Warm Rituals</h3>
                    </div>
                    <span className="text-xs font-bold text-[#7E7D76] uppercase tracking-wider bg-[#F4F1EA] px-2.5 py-1 rounded-full border border-[#D5D2B3]">
                      Today
                    </span>
                  </div>

                  <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                    Checking these off plays comforting sound therapy cues and logs active mental engagement.
                  </p>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1.5">
                    {routine.map((task) => (
                      <button
                        key={task.id}
                        id={`task-item-${task.id}`}
                        onClick={() => toggleRoutine(task.id)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-4 transition-all duration-300 group ${
                          task.completed
                            ? 'bg-[#F2FAF4] border-[#CEDFCF] text-[#4F7359]'
                            : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-white hover:border-[#A6A27B]'
                        }`}
                      >
                        <div className={`mt-0.5 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                          task.completed
                            ? 'bg-[#3A5D45] border-[#3A5D45] text-white scale-105'
                            : 'border-[#A6A27B] bg-white group-hover:border-[#3A5D45]'
                        }`}>
                          {task.completed && <Check className="w-5 h-5 stroke-[3px]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-base font-bold ${task.completed ? 'line-through text-[#8A9C8E]' : 'text-[#2C2C2A]'}`}>
                              {task.title}
                            </span>
                            <span className="text-xs font-bold text-[#8A8981] flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {task.time}
                            </span>
                          </div>
                          <p className={`text-sm mt-1 leading-relaxed ${task.completed ? 'text-[#8A9C8E]' : 'text-[#5E5D57]'}`}>
                            {task.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Treasured Memory Album View */}
                <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 rounded-lg bg-[#FDF1F1] text-rose-500">
                        <Heart className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-[#2C2C2A]">Treasured Memory Album</h3>
                    </div>
                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                      {memories.length} Memories
                    </span>
                  </div>

                  <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                    Beautiful historical landmarks and personal history logs designed for comforting reminiscent triggers.
                  </p>

                  <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[350px] pr-1">
                    {memories.map((mem) => {
                      const grad = getThemeGradient(mem.imageTheme);
                      return (
                        <div
                          key={mem.id}
                          className="p-5 rounded-2xl bg-[#FCFAF5] border border-[#E3DFC2] flex flex-col shadow-xs"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                              🏷️ {mem.relationshipOrEra}
                            </span>
                            <button
                              onClick={() => {
                                // Sound first, words second — the soundscape
                                // (a public-domain melody + ambience matched to
                                // the memory's theme) opens the door, then the
                                // narration walks through it over a quiet bed.
                                const soundscape = playMemorySoundscape(mem.imageTheme);
                                window.setTimeout(() => {
                                  soundscape?.duck();
                                  // Use speakTextDirect so the narration works from
                                  // the caregiver tab regardless of voiceEnabled state.
                                  speakTextDirect(`Let me share this memory with you, dear. It is titled: ${mem.title}. ${mem.description}`);
                                }, soundscape ? 2800 : 0);
                              }}
                              className="flex items-center space-x-1.5 px-3 py-1 bg-[#3A5D45] text-white hover:bg-[#2B4633] rounded-lg transition-all text-xs font-semibold shadow-xs"
                            >
                              <Volume2 className="w-4 h-4" />
                              <span>Listen to Memory</span>
                            </button>
                          </div>

                          {/* Decorative memory visualization illustration */}
                          <div className={`mt-3 h-14 w-full rounded-lg bg-gradient-to-r ${grad} flex items-center justify-center border text-2xl`}>
                            {mem.imageTheme === 'wedding' && '💍🌹🌸'}
                            {mem.imageTheme === 'family' && '🏡🐾❤️'}
                            {mem.imageTheme === 'nature' && '🌲🏔️☀️'}
                            {mem.imageTheme === 'retro' && '📸⏳👴'}
                            {mem.imageTheme === 'home' && '🛋️☕🍽️'}
                          </div>

                          <h4 className="text-lg font-bold text-[#2C2C2A] mt-3">{mem.title}</h4>
                          <p className="text-sm text-[#5E5D57] leading-relaxed mt-1.5">
                            {mem.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </motion.div>
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
                      You've used your free messages. <span className="font-semibold text-[#3A5D45]">Caregiver Pro ($5/week)</span> unlocks unlimited caregiver chat.
                    </p>
                  )}
                  <p className="text-[10px] text-[#A6A27B] mt-2">Yadira can be wrong and isn't a doctor — for medical decisions, contact your clinician.</p>
                </div>
              </div>

              )}

              {/* ── SETTINGS TAB ─────────────────────────────────────────── */}
              {caregiverTab === 'settings' && (
              <div className="space-y-6">

              {/* Appearance — color-therapy themes + dark mode. Persisted per
                  device; recolors the whole dashboard, never the clinical
                  vivid-mode cues. */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-3">
                  <h3 className="text-lg font-bold text-[#2C2C2A] flex items-center">
                    <Sparkles className="w-5 h-5 text-[#3A5D45] mr-2" />
                    Appearance
                  </h3>
                  <button
                    type="button"
                    id="btn-dark-mode"
                    onClick={() => setDarkMode(!darkMode)}
                    aria-pressed={darkMode}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all active:scale-95 ${
                      darkMode
                        ? 'bg-[#3A5D45] text-white border-[#3A5D45]'
                        : 'bg-[#FCFAF5] text-[#5E5D57] border-[#E3DFC2] hover:border-[#CEDFCF]'
                    }`}
                  >
                    {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {darkMode ? 'Dark mode on' : 'Dark mode'}
                  </button>
                </div>
                <p className="text-xs text-[#7E7D76] mb-4 leading-relaxed">
                  Choose a color that feels right for your family. Some people find green isn't for them —
                  these palettes follow color therapy for calm, joy, or warmth. It changes the dashboard only.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEMES.map((t) => {
                    const active = dashTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        id={`btn-theme-${t.id}`}
                        onClick={() => { setDashTheme(t.id); playSoundCue('pop'); }}
                        aria-pressed={active}
                        className={`p-3 rounded-2xl border text-left transition-all duration-200 ${
                          active
                            ? 'border-[#3A5D45] ring-2 ring-[#3A5D45]/15 bg-[#F2FAF4] scale-[1.02]'
                            : 'border-[#E3DFC2] bg-[#FCFAF5] hover:bg-[#EAE8DD]'
                        }`}
                      >
                        <span
                          className="block w-full h-8 rounded-lg mb-2 border border-black/5"
                          style={{ background: t.swatch }}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-bold text-[#2C2C2A] block leading-tight">{t.label}</span>
                        <span className="text-[10px] text-[#7E7D76] block mt-0.5 leading-tight">{t.blurb}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clinical Session Control & Mode Settings */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Mode Control (Lucid vs Vivid) */}
                <div className="lg:col-span-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#2C2C2A] flex items-center mb-1.5">
                      <Sliders className="w-5 h-5 text-[#3A5D45] mr-2" />
                      Active Care Mode Control
                    </h3>
                    <p className="text-xs text-[#7E7D76] mb-4 leading-relaxed">
                      Toggle the companion mode in real time. Vivid Mode changes the interface, voice, and prompts to represent the chosen persona.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => { setPatientMode('lucid'); playSoundCue('pop'); }}
                        className={`flex-1 p-4 rounded-2xl border text-left flex items-start space-x-3 transition-all duration-300 ${
                          patientMode === 'lucid'
                            ? 'bg-[#E8F1EB] border-[#3A5D45] text-[#3A5D45] ring-2 ring-[#3A5D45]/10 font-bold scale-[1.02]'
                            : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
                        }`}
                      >
                        <div className="p-2 rounded-xl bg-white text-[#3A5D45] shadow-xs">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm block font-bold">Lucid Mode</span>
                          <span className="text-[11px] font-normal leading-tight block mt-0.5 text-[#5E5D57]">
                            Patient is grounded. Yadira acts as a helpful companion.
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setPatientMode('vivid'); playSoundCue('chime'); }}
                        className={`flex-1 p-4 rounded-2xl border text-left flex items-start space-x-3 transition-all duration-300 ${
                          patientMode === 'vivid'
                            ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/10 font-bold scale-[1.02]'
                            : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
                        }`}
                      >
                        <div className="p-2 rounded-xl bg-white text-rose-500 shadow-xs">
                          <Heart className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm block font-bold">Vivid Mode</span>
                          <span className="text-[11px] font-normal leading-tight block mt-0.5 text-[#5E5D57]">
                            Patient is reaching. {representedPersona || 'Beth'} steps forward.
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Yadira's personality — Lucid mode temperament. Not
                        everyone wants a soothing therapist; some want sunshine,
                        a joke, plain talk, or a story. */}
                    <div className="mt-4">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
                        Yadira's Personality
                      </label>
                      <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2.5">
                        How Yadira carries herself in Lucid Mode. Vivid Mode is unaffected — there she is {representedPersona || 'the loved one'} entirely.
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          { key: 'gentle', emoji: '🕊️', label: 'Gentle & soothing', blurb: 'Calm, soft, and reassuring — the classic Yadira.' },
                          { key: 'sunny', emoji: '☀️', label: 'Sunny & cheerful', blurb: 'Bright and delighted by little things.' },
                          { key: 'playful', emoji: '😄', label: 'Playful & witty', blurb: 'A gentle joke and a chuckle together.' },
                          { key: 'practical', emoji: '🧭', label: 'Plain & practical', blurb: 'Direct and steady — no "dear," no fuss.' },
                          { key: 'storyteller', emoji: '📖', label: 'Storyteller', blurb: 'Little vivid stories and warm rambles.' },
                        ] as const).map((p) => {
                          const active = (companionPersonality || 'gentle') === p.key;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              id={`btn-personality-${p.key}`}
                              onClick={() => { setCompanionPersonality(p.key); playSoundCue('pop'); }}
                              aria-pressed={active}
                              className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                                active
                                  ? 'bg-[#E8F1EB] border-[#3A5D45] ring-2 ring-[#3A5D45]/10 scale-[1.01]'
                                  : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-[#EAE8DD]'
                              }`}
                            >
                              <span className={`text-xs block font-bold ${active ? 'text-[#3A5D45]' : 'text-[#2C2C2A]'}`}>
                                {p.emoji} {p.label}
                              </span>
                              <span className="text-[10px] leading-tight block mt-0.5 text-[#7E7D76]">
                                {p.blurb}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Yadira's voice — hers alone. The persona's voice (Vivid
                        mode) is configured separately so the two identities
                        never share a sound. */}
                    <div className="mt-4">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
                        Yadira's Voice
                      </label>
                      <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2.5">
                        The voice Yadira speaks with in Lucid Mode. {representedPersona || 'The loved one'}'s Vivid voice is set separately below.
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'female', label: '🎙️ Female voice', blurb: 'Warm and steady' },
                          { key: 'male', label: '🎙️ Male voice', blurb: 'Calm and kind' },
                        ] as const).map((v) => {
                          const active = (yadiraVoice || 'female') === v.key;
                          return (
                            <button
                              key={v.key}
                              type="button"
                              id={`btn-yadira-voice-${v.key}`}
                              onClick={() => { setYadiraVoice(v.key); playSoundCue('pop'); }}
                              aria-pressed={active}
                              className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                                active
                                  ? 'bg-[#E8F1EB] border-[#3A5D45] ring-2 ring-[#3A5D45]/10 scale-[1.01]'
                                  : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-[#EAE8DD]'
                              }`}
                            >
                              <span className={`text-xs block font-bold ${active ? 'text-[#3A5D45]' : 'text-[#2C2C2A]'}`}>
                                {v.label}
                              </span>
                              <span className="text-[10px] leading-tight block mt-0.5 text-[#7E7D76]">
                                {v.blurb}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Persona & Drift Controls */}
                <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aurora — caregiver trigger */}
                  <button
                    type="button"
                    id="btn-caregiver-aurora"
                    onClick={() => setAuroraActive(true)}
                    className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50 text-left flex items-start space-x-3 hover:bg-indigo-100 active:scale-[0.98] transition-all duration-300"
                  >
                    <div className="p-2 rounded-xl bg-white text-indigo-500 shadow-xs shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm block font-bold text-indigo-700">Aurora</span>
                      <span className="text-[11px] font-normal leading-tight block mt-0.5 text-indigo-500">
                        Opens a soothing aurora screen on both devices. The soft “return” button below ends it.
                      </span>
                    </div>
                  </button>

                  {/* Help-button call — the patient presses "I need my
                      caregiver" and this number rings. Yadira does NOT phone
                      the patient: CALL-E speaks in its own voice, and a
                      familiar name in an unfamiliar voice is not the same
                      person to someone whose recognition is failing. A
                      caregiver knows exactly what the call is, so here it
                      costs nothing and gains everything. */}
                  <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 flex flex-col">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A] flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-rose-500" /> Call me when they need me
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          isPremium ? 'bg-[#3A5D45] text-white' : 'bg-[#EAE8DD] text-[#7E7D76]'
                        }`}
                      >
                        {isPremium ? 'Pro' : 'Pro only'}
                      </span>
                    </span>
                    <span className="text-[10px] text-[#5E5D57] leading-tight mt-1 block">
                      When {profile.patientName || 'they'} press the help button, Yadira raises the alert here{' '}
                      <i>and</i> rings your phone straight away. A banner is easy to miss; a ringing phone is not.
                    </span>
                    <label className="sr-only" htmlFor="help-call-phone">
                      Your own phone number, in full international form
                    </label>
                    <input
                      id="help-call-phone"
                      type="tel"
                      inputMode="tel"
                      value={helpCall.escalationPhone || ''}
                      onChange={(e) => setHelpCall({ ...helpCall, escalationPhone: e.target.value })}
                      placeholder="+15551234567"
                      className="mt-2.5 w-full text-sm px-3 py-2 rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                    />
                    <span className="text-[10px] text-[#7E7D76] leading-tight mt-1 block">
                      <b>Your number, not theirs.</b> Full international form, e.g. +15551234567.
                    </span>
                    <label className="sr-only" htmlFor="check-in-region">
                      Where you are — sets which line the call comes from
                    </label>
                    <select
                      id="check-in-region"
                      value={helpCall.region || ''}
                      onChange={(e) => setHelpCall({ ...helpCall, region: e.target.value })}
                      className="mt-2 w-full text-sm px-3 py-2 rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300/40"
                    >
                      <option value="">Where are you? (sets the calling line)</option>
                      {CALLE_REGIONS.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-[#7E7D76] leading-tight mt-2 block">
                      The call says only that {profile.patientName || 'they'} asked for you, and when. It never
                      discusses their health, and repeated presses will not ring you over and over.
                    </span>
                    {!isPremium && (
                      <div className="mt-2.5 text-[11px] leading-snug rounded-xl px-3 py-2 border border-[#E3DFC2] bg-[#FCFAF5] text-[#5E5D57]">
                        <b className="block mb-0.5">The alert is free. The phone call is Caregiver Pro.</b>
                        {profile.patientName || 'Their'} help button still reaches you here the moment it is
                        pressed — that never costs anything. Pro ($5/week) adds the phone ringing too, for the times
                        you are not looking at a screen.
                      </div>
                    )}
                  </div>

                  {/* Caregiver Pro — the whole companion is free; only the
                      caregiver's AI care reports are the paid tier. */}
                  <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isPremium ? 'border-[#CEDFCF] bg-[#F2FAF4]' : 'border-[#E3DFC2] bg-[#FCFAF5]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Caregiver Pro
                        </span>
                        <span className="text-[10px] text-[#7E7D76] leading-tight mt-1 block">
                          {isPremium
                            ? `Active — the help button rings your phone, plus unlimited AI care reports (routines & clinical insights) for this caregiver. The companion itself is free for your family, always.`
                            : `The companion is free for your family — ${representedPersona || 'the loved one'}'s natural voice, Call Mode, Session Memory, calming rooms, and photos, always. Caregiver Pro ($5/week) makes the help button ring your phone as well as the screen, and adds unlimited AI care reports; free includes one routine + one insights report each week. Run a care facility? Email partnerships@yadira.chat about a per-unit partnership.`}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isPremium ? 'bg-[#3A5D45] text-white' : 'bg-[#EAE8DD] text-[#7E7D76]'}`}>
                        {isPremium ? 'Pro' : 'Free'}
                      </span>
                    </div>
                    <button
                      type="button"
                      id="btn-toggle-premium"
                      disabled={premiumBusy}
                      onClick={() => {
                        if (!isPremium) {
                          startPremiumCheckout();
                        } else if (premium.customerId) {
                          openBillingPortal();
                        } else {
                          // Demo-toggled premium (no Stripe subscription behind it)
                          setPremium({ ...premium, unlocked: false });
                        }
                      }}
                      className={`mt-3 w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none ${
                        isPremium
                          ? 'bg-white border border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
                          : 'bg-[#3A5D45] text-white hover:bg-[#2B4633] shadow-xs'
                      }`}
                      title={
                        isPremium
                          ? premium.customerId
                            ? 'Opens Stripe billing portal to manage or cancel'
                            : 'Turn off demo Caregiver Pro'
                          : 'Secure checkout via Stripe — $5/week, cancel anytime'
                      }
                    >
                      {premiumBusy
                        ? 'One moment…'
                        : isPremium
                          ? premium.customerId
                            ? 'Manage subscription'
                            : 'Turn off Caregiver Pro'
                          : 'Get Caregiver Pro — $5/week'}
                    </button>
                  </div>

                  {/* Persona Configuration */}
                  <div className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
                        Represented Persona & Voice
                      </label>
                      <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2">
                        Configure who Yadira becomes and their voice preset.
                      </span>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-[#5E5D57] block mb-1">Name:</span>
                          <input
                            type="text"
                            value={representedPersona}
                            onChange={(e) => setRepresentedPersona(e.target.value)}
                            placeholder="e.g. Beth, Thomas"
                            className="w-full p-2 bg-white border border-[#C4C09E] rounded-xl text-xs font-bold text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-[#5E5D57] block mb-1">Inworld Voice Preset:</span>
                          <select
                            value={
                              ['Sarah', 'Ashley', 'Dennis'].includes(representedVoiceId)
                                ? representedVoiceId
                                : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== 'custom') {
                                setRepresentedVoiceId(val);
                              } else {
                                setShowCloneVoice(true);
                              }
                            }}
                            className="w-full p-2 bg-white border border-[#C4C09E] rounded-xl text-xs font-bold text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                          >
                            <option value="Sarah">Sarah (Warm Female - Default)</option>
                            <option value="Ashley">Ashley (Warm Female - Natural)</option>
                            <option value="Dennis">Dennis (Calm Male - Friendly)</option>
                            <option value="custom">Custom Inworld Voice ID...</option>
                          </select>

                          {/* Clone-a-voice helper — always available, so a caregiver can
                              learn how to make a loved one's voice before ever picking custom. */}
                          <button
                            type="button"
                            onClick={() => setShowCloneVoice(true)}
                            className="mt-1.5 text-[10px] font-bold text-[#3A5D45] hover:underline"
                          >
                            ✨ Clone a loved one's voice — how?
                          </button>

                          {!['Sarah', 'Ashley', 'Dennis'].includes(representedVoiceId) && (
                            <div className="mt-1.5 flex items-center space-x-1">
                              <span className="text-[9px] font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100 font-bold block truncate max-w-full">
                                Custom ID: {representedVoiceId}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowCloneVoice(true)}
                                className="text-[9px] text-[#3A5D45] hover:underline font-bold"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proactive Drift Controls */}
                  <div className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A]">
                          Proactive Reach
                        </span>
                        <span className="text-[10px] text-[#7E7D76] leading-tight mt-0.5">
                          Reach out during silence.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDriftEnabled(!driftEnabled)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-all ${
                          driftEnabled ? 'bg-[#3A5D45]' : 'bg-[#D8D5C4]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${
                          driftEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs font-bold text-[#5E5D57] mb-1">
                        <span>Drift Timeout:</span>
                        <span className="text-[#3A5D45] font-extrabold">{driftTimeoutSeconds}s</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        disabled={!driftEnabled}
                        value={driftTimeoutSeconds}
                        onChange={(e) => setDriftTimeoutSeconds(Number(e.target.value))}
                        className="w-full accent-[#3A5D45] h-1.5 bg-[#E3DFC2] rounded-lg appearance-none cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              </div>
              )}

              {/* ── TODAY TAB ────────────────────────────────────────────── */}
              {caregiverTab === 'today' && (
              <div className="space-y-6">

              {/* Grid 1: Symptom Logger & Custom FAQ Override */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Daily Symptom & Care Logger */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                  <div className="flex items-center space-x-2.5 mb-5">
                    <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                      <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#2C2C2A]">Today's Daily Care Log</h3>
                  </div>

                  {todaysCheckIn && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#CEDFCF] bg-[#F2FAF4] px-3.5 py-2.5">
                      <Tent className="w-4 h-4 text-[#3A5D45] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#3A5D45] leading-snug">
                        <b>{patientName || 'The patient'}</b> checked in at camp today feeling <b>{moodLabel(todaysCheckIn.mood)}</b>. We’ve pre-filled the mood below — adjust it if your own read differs.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleAddLog} className="space-y-4 flex-1 flex flex-col">
                    
                    {/* Confusion Level Tracker */}
                    <div>
                      <label className="block text-sm font-bold text-[#5E5D57] mb-2">
                        Cognitive Confusion Level: <span className="text-[#3A5D45] font-extrabold">{logConfusion} / 5</span>
                      </label>
                      <div className="flex space-x-2.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setLogConfusion(val)}
                            className={`flex-1 py-2.5 rounded-xl border text-base font-bold transition-all ${
                              logConfusion === val
                                ? 'bg-[#3A5D45] text-white border-[#3A5D45]'
                                : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
                            }`}
                          >
                            {val === 1 ? 'Clear' : val === 5 ? 'Severe' : val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mood Selector */}
                    <div>
                      <label className="block text-sm font-bold text-[#5E5D57] mb-1.5">Primary Patient Mood</label>
                      <select
                        value={logMood}
                        onChange={(e: any) => setLogMood(e.target.value)}
                        className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
                      >
                        <option value="peaceful">Peaceful & Pleasant</option>
                        <option value="anxious">Anxious & Agitated</option>
                        <option value="restless">Restless & Wandering</option>
                        <option value="sad">Sad & Quiet</option>
                      </select>
                    </div>

                    {/* Quick Stats: Hydration & Sleep */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-[#5E5D57] mb-1">Hydration (Cups)</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={logHydration}
                          onChange={(e) => setLogHydration(Number(e.target.value))}
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#5E5D57] mb-1">Sleep (Hours)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={logSleep}
                          onChange={(e) => setLogSleep(Number(e.target.value))}
                          className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Medication Compliance Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#2C2C2A]">Vitamins & Meds Taken</span>
                        <span className="text-xs text-[#7E7D76]">Confirm morning/evening compliance</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLogMeds(!logMeds)}
                        className={`w-14 h-8 rounded-full p-1 transition-all ${
                          logMeds ? 'bg-[#3A5D45]' : 'bg-[#D8D5C4]'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${
                          logMeds ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Clinical Notes */}
                    <div>
                      <label className="block text-sm font-bold text-[#5E5D57] mb-1">Caregiver Observation Notes</label>
                      <textarea
                        value={logNotes}
                        onChange={(e) => setLogNotes(e.target.value)}
                        placeholder="Detail behavior triggers, foods eaten, activities enjoyed..."
                        rows={3}
                        className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-98 flex items-center justify-center space-x-2"
                    >
                      <PlusCircle className="w-5 h-5" />
                      <span>Log Daily Observations</span>
                    </button>
                  </form>
                </div>

                {/* FAQ override settings (Patient Reassurance Mapping) */}
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-[#FDF1F1] text-rose-500">
                          <HelpCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-[#2C2C2A]">Empathetic Reassurance Settings</h3>
                      </div>
                      <span className="text-xs font-bold text-[#7E7D76] uppercase tracking-wider bg-[#F4F1EA] px-2.5 py-1 rounded-full border border-[#D5D2B3]">
                        FAQ Override
                      </span>
                    </div>

                    <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                      Dementia patients often repeat anxious questions. Yadira overrides generic AI responses with these tailored, personal reassurances whenever the questions are asked.
                    </p>

                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                      {faqs.map((faq) => (
                        <div key={faq.id} className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl relative">
                          <button
                            onClick={() => handleDeleteFaq(faq.id)}
                            className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-all"
                            title="Remove reassurance override"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#5C8D71]">Anxious Question:</p>
                          <p className="text-sm font-bold text-[#2C2C2A] mt-0.5">"{faq.question}"</p>
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mt-2.5">Yadira Reassuring Answer:</p>
                          <p className="text-sm text-[#5E5D57] italic mt-0.5 leading-relaxed">"{faq.answer}"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleAddFaq} className="border-t border-[#E3DFC2] pt-4 mt-4 space-y-3">
                    <p className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">Add New Patient FAQ Reassurance:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newFaqQuest}
                        onChange={(e) => setNewFaqQuest(e.target.value)}
                        placeholder="Patient repeats (e.g. Where is my key?)"
                        className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                      />
                      <input
                        type="text"
                        value={newFaqAns}
                        onChange={(e) => setNewFaqAns(e.target.value)}
                        placeholder="Reassuring answer (e.g. Your keys are safe with Thomas.)"
                        className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newFaqQuest || !newFaqAns}
                      className="w-full py-3 bg-[#3A5D45] hover:bg-[#2B4633] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Activate Reassurance Override</span>
                    </button>
                  </form>
                </div>

              </div>

              {/* Grid 2: SVG Trend Visualizations & AI Clinical Summarizer */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Custom SVG Interactive Dashboard Charts */}
                <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-[#2C2C2A]">Patient Symptom Trends</h3>
                      </div>
                      <span className="text-xs font-bold text-[#3A5D45] bg-[#E8F1EB] px-2 py-1 rounded-full">
                        7-Day Diagnostics
                      </span>
                    </div>

                    <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                      Custom clinical charts mapping cognitive confusion and physical rest patterns to detect Sundowning symptoms.
                    </p>

                    {/* interactive SVG chart rendering */}
                    <div className="w-full bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl p-4 flex flex-col space-y-4">
                      <div className="text-xs font-bold text-[#5E5D57] uppercase tracking-wider flex items-center justify-between">
                        <span>Cognitive Confusion Progress</span>
                        <span className="text-[#3A5D45]">1 (Clear) - 5 (Confused)</span>
                      </div>
                      
                      {/* Simple custom SVG chart */}
                      <div className="relative h-44 w-full">
                        <svg className="h-full w-full" viewBox="0 0 300 120">
                          {/* Grid Lines */}
                          <line x1="0" y1="20" x2="300" y2="20" stroke="#EAE6DA" strokeDasharray="3,3" />
                          <line x1="0" y1="55" x2="300" y2="55" stroke="#EAE6DA" strokeDasharray="3,3" />
                          <line x1="0" y1="90" x2="300" y2="90" stroke="#EAE6DA" strokeDasharray="3,3" />
                          
                          {/* Graph Path */}
                          <path
                            d={logs.map((l, idx) => {
                              const x = (idx / (logs.length - 1)) * 280 + 10;
                              // map confusion 1-5 to y coordinate 100 to 10
                              const y = 110 - ((l.confusionLevel - 1) / 4) * 90;
                              return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#3A5D45"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                          
                          {/* Graph Dots */}
                          {logs.map((l, idx) => {
                            const x = (idx / (logs.length - 1)) * 280 + 10;
                            const y = 110 - ((l.confusionLevel - 1) / 4) * 90;
                            return (
                              <g key={idx} className="group cursor-pointer">
                                <circle cx={x} cy={y} r="6" fill="#3A5D45" stroke="white" strokeWidth="2" />
                                <text x={x} y={y - 12} fontSize="8" fontWeight="bold" fill="#3A5D45" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1">
                                  {l.confusionLevel}
                                </text>
                              </g>
                            );
                          })}

                          {/* Labels */}
                          {logs.map((l, idx) => {
                            const x = (idx / (logs.length - 1)) * 280 + 10;
                            return (
                              <text key={idx} x={x} y="115" fontSize="8" fontWeight="bold" fill="#8A8981" textAnchor="middle">
                                {l.date}
                              </text>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Sleep & Hydration correlations */}
                      <div className="grid grid-cols-2 gap-4 border-t border-[#E3DFC2] pt-3 text-xs text-[#5E5D57]">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-[#3A5D45]"></div>
                          <span>Average Rest: <strong>{ (logs.reduce((sum, l) => sum + l.sleepHours, 0) / logs.length).toFixed(1) } hrs</strong></span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Avg Hydration: <strong>{ (logs.reduce((sum, l) => sum + l.hydrationCups, 0) / logs.length).toFixed(1) } cups</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historical Log list with delete controls */}
                  <div className="border-t border-[#E3DFC2] pt-4 mt-4">
                    <p className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider mb-2">Past Logs History:</p>
                    <div className="max-h-[140px] overflow-y-auto pr-1 space-y-2 text-xs">
                      {logs.slice().reverse().map((log) => (
                        <div key={log.date} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-[#2C2C2A] mr-2">{log.date}</span>
                            <span className="text-[#3A5D45] font-bold mr-2">Confusion: {log.confusionLevel}/5</span>
                            <span className="text-blue-600 font-bold mr-2">Hydration: {log.hydrationCups}c</span>
                            <span className="text-purple-600 font-bold mr-2">Sleep: {log.sleepHours}h</span>
                            <span className="text-[#7E7D76] block mt-1">"{log.notes}"</span>
                          </div>
                          <button
                            onClick={() => handleDeleteLog(log.date)}
                            className="text-red-400 hover:text-red-600 p-1"
                            title="Delete log"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI-Powered Clinical Advisor Insights Panel */}
                <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                          <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-[#2C2C2A]">AI Clinical insights Advisor</h3>
                      </div>
                      <button
                        onClick={handleGenerateInsights}
                        disabled={loadingInsights}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        {loadingInsights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>{aiInsights ? 'Refresh Analysis' : 'Synthesize Insights'}</span>
                      </button>
                    </div>

                    <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                      Utilizes clinical prompts to aggregate daily patient activity, mood logs, and medication compliance trends into structured geriatric advice.
                    </p>

                    <AnimatePresence mode="wait">
                      {loadingInsights ? (
                        <motion.div
                          key="loading-insights"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-8 text-center space-y-4"
                        >
                          <RefreshCw className="w-10 h-10 animate-spin text-[#3A5D45] mx-auto" />
                          <div>
                            <p className="text-base font-bold text-[#2C2C2A]">Analyzing Care Trends...</p>
                            <p className="text-xs text-[#7E7D76] mt-1">Cross-referencing sleep logs, mood triggers, and confusion coordinates.</p>
                          </div>
                        </motion.div>
                      ) : aiInsights ? (
                        <motion.div
                          key="results-insights"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-4"
                        >
                          {/* Clinical Overview */}
                          <div className="p-4 bg-[#F5FAF6] border border-[#CEDFCF] rounded-2xl">
                            <h4 className="text-sm font-bold text-[#3A5D45] uppercase tracking-wider flex items-center">
                              🩺 Clinical Diagnostic Summary
                            </h4>
                            <p className="text-sm text-[#2C2C2A] leading-relaxed mt-2 font-medium">
                              {aiInsights.clinicalSummary}
                            </p>
                          </div>

                          {/* Critical Warnings */}
                          {aiInsights.criticalAlerts && aiInsights.criticalAlerts.length > 0 && (
                            <div className="p-4 bg-[#FFF2F2] border border-[#FFD9D9] rounded-2xl">
                              <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-1.5" /> Critical Observation Triggers
                              </h4>
                              <ul className="list-disc list-inside text-xs font-bold text-red-900 mt-2 space-y-1">
                                {aiInsights.criticalAlerts.map((alert, i) => (
                                  <li key={i}>{alert}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Actionable Clinical Tips */}
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
                              Actionable Caregiver Interventions:
                            </h4>
                            <div className="space-y-2">
                              {aiInsights.actionableTips.map((tip, i) => (
                                <div key={i} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#5E5D57] leading-relaxed flex items-start space-x-2">
                                  <span className="font-extrabold text-[#3A5D45] mt-0.5">{i+1}.</span>
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="no-insights"
                          className="p-8 text-center bg-[#FCFAF5] border border-dashed border-[#C4C09E] rounded-2xl"
                        >
                          <Activity className="w-10 h-10 text-[#C4C09E] mx-auto mb-2" />
                          <p className="text-base font-bold text-[#5E5D57]">No Insights Generated</p>
                          <p className="text-xs text-[#8A8981] mt-1 max-w-xs mx-auto">
                            Click "Synthesize Insights" above to securely call Gemini and analyze your clinical patient logs.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="bg-[#FAF9F5] border-t border-[#E3DFC2] p-3 rounded-xl text-[11px] text-[#8A8981] italic mt-4 text-center">
                    Note: Yadira clinical outputs are generative and optimized to support familial caregiver comfort; they are not substitutes for certified geriatric practitioner prescriptions.
                  </div>
                </div>

              </div>

              </div>
              )}

              {/* ── MEMORIES TAB ─────────────────────────────────────────── */}
              {caregiverTab === 'memories' && (
              <div className="space-y-6">

              {/* Nurse Redirection Portal — moved to Memories: caregivers redirect
                  by recalling grounding memories, so it lives here */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-500">
                      <HeartHandshake className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#2C2C2A] break-words">Nurse Redirection Portal (Real-time Intervention)</h3>
                  </div>
                  <span className="self-start sm:self-auto text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                    Live Dispatch
                  </span>
                </div>

                <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                  If the patient becomes restless, wanders, or repeatedly asks to leave their room, select a clinical redirection cue below. Yadira will dynamically translate it into comforting, relationship-anchored guidance from {representedPersona || 'Beth'} and speak it to the patient.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => handleSendRedirection("Patient is asking to go home")}
                    className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
                  >
                    🏡 Trigger Home Grounding
                    <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
                      "Patient wants to leave room to go home."
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendRedirection(`Patient is looking for their spouse (${representedPersona})`)}
                    className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
                  >
                    🍳 Trigger Kitchen Redirect
                    <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
                      "Patient is looking for their spouse."
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendRedirection("Patient is highly anxious and restless")}
                    className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
                  >
                    ❤️ Trigger Calming Grounding
                    <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
                      "Patient is showing high sundowning agitation."
                    </span>
                  </button>
                </div>

                {/* Custom Redirection Text input */}
                <div className="nurse-dispatch-row flex flex-col sm:flex-row gap-3 border-t border-[#E3DFC2] pt-4">
                  <input
                    type="text"
                    id="nurse-custom-note"
                    placeholder="Type custom nurse observation / redirection instruction here (e.g. Eleanor wants to go bake a pie)..."
                    className="w-full min-w-0 flex-1 p-3.5 border border-[#C4C09E] rounded-xl text-sm bg-[#FCFAF5] focus:ring-2 focus:ring-[#3A5D45] text-[#2C2C2A] font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleSendRedirection(input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('nurse-custom-note') as HTMLInputElement;
                      if (input && input.value.trim()) {
                        handleSendRedirection(input.value);
                        input.value = '';
                      }
                    }}
                    className="w-full sm:w-auto px-4 sm:px-6 py-3.5 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95"
                  >
                    Dispatch Cue
                  </button>
                </div>
              </div>

              {/* Persona File — session-to-session memory (the continuity architecture) */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#2C2C2A] break-words">
                      Persona File — What {representedPersona || 'Beth'} Remembers
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleStartFreshSession}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
                      title="End the current conversation and start a new session — the persona file carries over"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Start Fresh Session</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Clear everything ${representedPersona || 'Beth'} remembers between sessions? This cannot be undone.`)) {
                          setPersonaFile(DEFAULT_PERSONA_FILE);
                        }
                      }}
                      className="p-2 bg-[#FCFAF5] border border-[#E3DFC2] text-[#A6A27B] hover:text-red-500 rounded-xl transition-all"
                      title="Clear persona file"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                  Written automatically after every conversation and read before the next one. A disconnection is a pause, not a forgetting —
                  ask {representedPersona || 'Beth'} if she remembers. She does.
                </p>

                {personaFile.moments.length === 0 && !personaFile.lastSummary ? (
                  <div className="p-8 text-center bg-[#FCFAF5] border border-dashed border-[#C4C09E] rounded-2xl">
                    <MessageSquare className="w-10 h-10 text-[#C4C09E] mx-auto mb-2" />
                    <p className="text-base font-bold text-[#5E5D57]">Nothing remembered yet</p>
                    <p className="text-xs text-[#8A8981] mt-1 max-w-sm mx-auto">
                      The persona file grows as {patientName || 'the patient'} talks with {representedPersona || 'Beth'}. After a few messages, what they share appears here — and {representedPersona || 'Beth'} carries it into every future session.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-4">
                      {personaFile.lastSummary && (
                        <div className="p-4 bg-[#F5FAF6] border border-[#CEDFCF] rounded-2xl">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3A5D45]">Last Visit</h4>
                          <p className="text-sm text-[#2C2C2A] leading-relaxed mt-1.5 font-medium">{personaFile.lastSummary}</p>
                          {personaFile.lastSessionAt && (
                            <p className="text-[10px] text-[#8A8981] mt-2">
                              Updated {new Date(personaFile.lastSessionAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      )}

                      {personaFile.recurringThreads.length > 0 && (
                        <div>
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
                            They keep coming back to:
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {personaFile.recurringThreads.map((thread, i) => (
                              <span key={i} className="px-3 py-1.5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-full text-xs font-bold text-[#3A5D45]">
                                {thread}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {personaFile.threadToPickUp && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-600">
                            {representedPersona || 'Beth'} will open the next session with:
                          </h4>
                          <p className="text-sm text-rose-900 italic leading-relaxed mt-1.5">
                            "{personaFile.threadToPickUp}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-7">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
                        Moments they shared ({personaFile.moments.length}):
                      </h4>
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {personaFile.moments.map((moment) => (
                          <div key={moment.id} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl flex items-start justify-between space-x-3">
                            <p className="text-sm text-[#2C2C2A] leading-relaxed flex-1">{moment.summary}</p>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                                {moment.emotionalTone}
                              </span>
                              <span className="text-[10px] text-[#8A8981] mt-1">{moment.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Memory Bank Editor */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#2C2C2A]">Memory Bank Editor</h3>
                  </div>
                  <button
                    id="btn-open-memory-modal"
                    onClick={() => { playSoundCue('pop'); setShowMemModal(true); }}
                    className="flex items-center space-x-1 px-4 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Memory Card</span>
                  </button>
                </div>

                <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                  Store and organize treasured moments. These memories directly ground Yadira AI's dialogue, helping to guide the patient through periods of forgetfulness.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {memories.map((mem) => {
                    const grad = getThemeGradient(mem.imageTheme);
                    return (
                      <div key={mem.id} className="p-5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between shadow-xs relative">
                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          className="absolute top-4 right-4 text-[#A6A27B] hover:text-red-500 transition-all p-1"
                          title="Delete memory"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                        <div>
                          <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                            {mem.relationshipOrEra}
                          </span>
                          <div className={`mt-3 h-14 w-full rounded-lg bg-gradient-to-r ${grad} flex items-center justify-center border text-2xl`}>
                            {mem.imageTheme === 'wedding' && '💍🌹🌸'}
                            {mem.imageTheme === 'family' && '🏡🐾❤️'}
                            {mem.imageTheme === 'nature' && '🌲🏔️☀️'}
                            {mem.imageTheme === 'retro' && '📸⏳👴'}
                            {mem.imageTheme === 'home' && '🛋️☕🍽️'}
                          </div>
                          <h4 className="text-lg font-bold text-[#2C2C2A] mt-3">{mem.title}</h4>
                          <p className="text-xs text-[#5E5D57] mt-2 leading-relaxed">{mem.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Photo Album Manager — the real photos behind "let's look at old photos" */}
              <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#2C2C2A]">Photo Album</h3>
                    <span className="text-xs font-bold text-[#5C8D71] uppercase tracking-wider bg-[#F2FAF4] px-2.5 py-1 rounded-full border border-[#CEDFCF]">
                      {galleryPhotos.length} Photo{galleryPhotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <MediaUpload
                    label="Add photo"
                    onMediaAnalyzed={(insight, photoDataUrl) => {
                      if (photoDataUrl) {
                        addPhotoToGallery(photoDataUrl, insight, 'caregiver');
                        toastSuccess('Photo added', 'It is now in the family album. Tap its caption to reword it.');
                      }
                    }}
                    isPremium={true}
                  />
                </div>

                <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
                  Real family photos, kept in one place. {patientName || 'The patient'} can open this album
                  from the companion screen ("📷 Look at our photos"), and Yadira uses the captions to talk
                  about the pictures. Photos shared during chat land here automatically. Tap a caption to
                  reword it — names and places help Yadira the most.
                </p>

                {galleryPhotos.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#FCFAF5] border border-dashed border-[#D5D2B3] text-center text-sm text-[#7E7D76]">
                    No photos yet. Add the first one above — a wedding photo, the old house, a beloved pet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...galleryPhotos].reverse().map((photo) => (
                      <div key={photo.id} className="rounded-2xl bg-[#FCFAF5] border border-[#E3DFC2] overflow-hidden shadow-xs relative flex flex-col">
                        <button
                          onClick={() => setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-[#A6A27B] hover:text-red-500 transition-all shadow-xs"
                          title="Remove photo from album"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                        <img src={photo.dataUrl} alt={photo.caption} className="w-full h-32 object-cover" />
                        <div className="p-3 flex-1 flex flex-col gap-1.5">
                          {editingPhotoId === photo.id ? (
                            <textarea
                              autoFocus
                              rows={3}
                              value={editingCaption}
                              onChange={(e) => setEditingCaption(e.target.value)}
                              onBlur={saveCaption}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCaption(); }
                                if (e.key === 'Escape') setEditingPhotoId(null);
                              }}
                              className="w-full p-2 bg-white border border-[#C4C09E] rounded-lg text-xs leading-relaxed"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEditingPhotoId(photo.id); setEditingCaption(photo.caption); }}
                              className="text-left text-xs text-[#5E5D57] leading-relaxed hover:text-[#2C2C2A] line-clamp-3"
                              title="Tap to edit caption"
                            >
                              {photo.caption}
                            </button>
                          )}
                          <span className="mt-auto text-[10px] font-bold uppercase tracking-wider text-[#A6A27B]">
                            {photo.addedBy === 'patient' ? 'Shared in chat' : 'Added by caregiver'} · {new Date(photo.addedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </div>
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
