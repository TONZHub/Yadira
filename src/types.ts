// Shared data types for Yadira
// Used by App.tsx, the data layer, and (eventually) the server

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  emotion?: {
    emotion: string;
    confidence: number;
    tone: string;
    /** How it was known. 'voice' was heard in the audio itself — pace,
        tremor, breath, crying — and can contradict the words. 'text' was
        inferred from the wording, which reads a flat "I'm fine" and a bright
        one identically. Stored per message so a caregiver reading back
        through a day can tell which of the two they are looking at, and so
        the older messages recorded before this existed stay honest by
        simply having no source at all. */
    source?: 'voice' | 'text';
  };
  mediaInsight?: {
    description: string;
    emotion: string;
    suggestions: string[];
  };
}

export interface Memory {
  id: string;
  title: string;
  description: string;
  relationshipOrEra: string;
  imageTheme: 'family' | 'nature' | 'retro' | 'home' | 'wedding';
}

export interface CustomFAQ {
  id: string;
  question: string;
  answer: string;
}

// A real photo in the family's shared album. The image itself is stored as a
// compressed JPEG data URL (~640px longest side) so each photo stays well
// under Firestore's 1MB/doc limit and the localStorage mirror stays lean.
export interface GalleryPhoto {
  id: string;
  dataUrl: string;
  caption: string;           // starts as the AI's description; caregiver-editable
  emotion?: string;          // emotional tone detected at upload
  addedAt: number;           // ms epoch
  addedBy: 'patient' | 'caregiver';
}

// The patient's own daily emotional check-in with Hattie at camp. Kept
// separate from DailyLog so a one-tap mood never fabricates clinical numbers
// (sleep/hydration) and skews the caregiver's charts — it feeds mood + AI
// insights only. Keyed by `date` (MM-DD), matching DailyLog.
export interface MoodCheckIn {
  date: string;
  mood: 'peaceful' | 'anxious' | 'restless' | 'sad';
  at: number; // ms epoch
}

export interface DailyLog {
  date: string;
  confusionLevel: number; // 1 (Very Clear) to 5 (Highly Confused)
  mood: 'peaceful' | 'anxious' | 'restless' | 'sad';
  hydrationCups: number;
  sleepHours: number;
  medsTaken: boolean;
  notes: string;
}

export interface RoutineItem {
  id: string;
  time: string;
  title: string;
  description: string;
  caregiverTips: string;
  completed: boolean;
}

// The persona file — Yadira's session-to-session memory.
// Written to after every conversation, read before the next one.
// This is the continuity architecture: Beth remembers so the patient doesn't have to.
export interface SessionMoment {
  id: string;
  date: string;
  summary: string; // what the patient shared
  emotionalTone: string; // how they seemed when they shared it
}

export interface PersonaFile {
  lastSessionAt: string | null;
  lastSummary: string; // 1-2 sentence recap of the most recent visit
  recurringThreads: string[]; // what the patient keeps coming back to
  moments: SessionMoment[]; // accumulated things the patient has shared
  threadToPickUp: string; // a warm line the persona can open with next session
}

export const DEFAULT_PERSONA_FILE: PersonaFile = {
  lastSessionAt: null,
  lastSummary: '',
  recurringThreads: [],
  moments: [],
  threadToPickUp: '',
};

// Yadira's temperament in Lucid mode. Vivid mode is unaffected — there the
// companion's whole character IS the represented loved one.
export type CompanionPersonality = 'gentle' | 'sunny' | 'playful' | 'practical' | 'storyteller';

// ---------- Hattie's Lodge (the caregiver's own space, Caregiver Pro) ----------

/** The caregiver's daily "how heavy was today?" check-in at the lodge. */
export interface CaregiverCheckIn {
  /** ISO date (yyyy-mm-dd) — one check-in per day, id field for the store. */
  date: string;
  load: 'steady' | 'stretched' | 'heavy' | 'empty';
}

export interface HattieMessage {
  id: string;
  role: 'caregiver' | 'hattie';
  text: string;
  timestamp: number;
}

export interface CaregiverProfile {
  patientName: string;
  patientStage: string;
  patientHobbies: string;
  patientWakeTime: string;
  patientSleepTime: string;
  caregiverName: string;
  caregiverRelationship: string;
  patientMode: 'lucid' | 'vivid';
  representedPersona: string;
  representedVoiceId: string;
  driftTimeoutSeconds: number;
  driftEnabled: boolean;
  companionPersonality?: CompanionPersonality;
  /** Yadira's own voice in Lucid mode — Vivid mode uses representedVoiceId. */
  yadiraVoice?: 'female' | 'male';
}

export const DEFAULT_PROFILE: CaregiverProfile = {
  patientName: 'Eleanor',
  patientStage: 'Moderate',
  patientHobbies: 'Classical music, rose gardening, baking pies',
  patientWakeTime: '08:00',
  patientSleepTime: '21:00',
  caregiverName: 'Thomas',
  caregiverRelationship: 'Son',
  patientMode: 'lucid',
  representedPersona: 'Beth',
  representedVoiceId: 'zippy-pecan-9151__design-voice-233c4887',
  driftTimeoutSeconds: 25,
  driftEnabled: true,
  companionPersonality: 'gentle',
  yadiraVoice: 'female',
};
