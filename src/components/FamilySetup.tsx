import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, Heart, Sparkles, X, Plus, Trash } from 'lucide-react';
import type { CaregiverProfile, Memory, CustomFAQ, DailyLog, RoutineItem } from '../types';
import { DEFAULT_PROFILE } from '../types';
import { PROFILE_PACKS, type ProfilePack } from '../lib/demoProfiles';

export interface FamilyPackApply {
  profile: CaregiverProfile;
  memories: Memory[];
  faqs: CustomFAQ[];
  logs: DailyLog[];
  routine: RoutineItem[];
}

interface FamilySetupProps {
  onClose: () => void;
  onApply: (pack: FamilyPackApply, label: string) => void;
  /**
   * Opened as the first question a new caregiver is asked, rather than reached
   * from a menu. Only the wording changes — the choice, and both code paths
   * behind it, are the same. Closing without choosing means "start empty",
   * which the copy says out loud so nobody thinks they cancelled something.
   */
  firstRun?: boolean;
}

type Tab = 'samples' | 'create';

interface SeedMemory {
  title: string;
  description: string;
  relationshipOrEra: string;
  imageTheme: Memory['imageTheme'];
}

// A gentle default day, personalized with the patient's name. Real families
// can regenerate a tailored routine with one click in the hub afterward.
function starterRoutine(name: string): RoutineItem[] {
  const who = name || 'your loved one';
  return [
    { id: `rt-${Date.now()}-1`, time: '08:30 AM', title: 'Morning Light & Warm Drink', description: `Open the blinds for natural light and share a warm, familiar drink to help ${who} start the day grounded.`, caregiverTips: 'Speak in short, bright sentences. A calm, cheerful start sets the tone for the whole day.', completed: false },
    { id: `rt-${Date.now()}-2`, time: '10:30 AM', title: 'Memory & Connection', description: 'Look through the memory album together, or play music from their era. Reminiscence, never quizzing.', caregiverTips: 'Share the memory directly ("This is you at the lake!") rather than asking "Do you remember?"', completed: false },
    { id: `rt-${Date.now()}-3`, time: '12:30 PM', title: 'Lunch & Hydration', description: 'A simple, familiar lunch with water kept in clear sight. A natural moment to check medication.', caregiverTips: 'Offer a choice between two options. Keep the space quiet and unhurried.', completed: false },
    { id: `rt-${Date.now()}-4`, time: '04:30 PM', title: 'Pre-Evening Wind-Down', description: 'Begin calming activities before late-afternoon restlessness can build. Soft music, gentle company.', caregiverTips: 'Get ahead of sundowning — start calm before agitation begins, not after.', completed: false },
    { id: `rt-${Date.now()}-5`, time: '08:00 PM', title: 'Evening Calm & Bedtime', description: 'Dim the lights, lower voices, and move toward a consistent, reassuring bedtime.', caregiverTips: 'A steady routine and a warm nightlight ease nighttime disorientation.', completed: false },
  ];
}

const THEME_OPTIONS: { value: Memory['imageTheme']; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'wedding', label: 'Wedding / Romance' },
  { value: 'nature', label: 'Nature / Travel' },
  { value: 'home', label: 'Home / Daily life' },
  { value: 'retro', label: 'Youth / Era' },
];

export default function FamilySetup({ onClose, onApply, firstRun = false }: FamilySetupProps) {
  const [tab, setTab] = useState<Tab>('samples');

  // ---- create-your-own form state ----
  const [patientName, setPatientName] = useState('');
  const [patientStage, setPatientStage] = useState('Moderate');
  const [patientHobbies, setPatientHobbies] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverRelationship, setCaregiverRelationship] = useState('');
  const [patientMode, setPatientMode] = useState<'lucid' | 'vivid'>('lucid');
  const [representedPersona, setRepresentedPersona] = useState('');
  const [representedVoiceId, setRepresentedVoiceId] = useState('Sarah');
  const [seedMemories, setSeedMemories] = useState<SeedMemory[]>([
    { title: '', description: '', relationshipOrEra: '', imageTheme: 'family' },
  ]);

  const canCreate = patientName.trim() && caregiverName.trim();

  const updateSeed = (i: number, patch: Partial<SeedMemory>) =>
    setSeedMemories((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const applySample = (pack: ProfilePack) => {
    onApply(
      { profile: pack.profile, memories: pack.memories, faqs: pack.faqs, logs: pack.logs, routine: pack.routine },
      pack.label,
    );
  };

  const applyCreated = () => {
    if (!canCreate) return;
    const profile: CaregiverProfile = {
      ...DEFAULT_PROFILE,
      patientName: patientName.trim(),
      patientStage,
      patientHobbies: patientHobbies.trim() || 'Music, family photographs, gentle conversation',
      caregiverName: caregiverName.trim(),
      caregiverRelationship: caregiverRelationship.trim() || 'Family',
      patientMode,
      representedPersona: (representedPersona.trim() || caregiverName.trim() || 'Beth'),
      representedVoiceId,
    };
    const memories: Memory[] = seedMemories
      .filter((m) => m.title.trim() && m.description.trim())
      .map((m, i) => ({
        id: `mem-new-${Date.now()}-${i}`,
        title: m.title.trim(),
        description: m.description.trim(),
        relationshipOrEra: m.relationshipOrEra.trim() || 'Family',
        imageTheme: m.imageTheme,
      }));
    onApply(
      { profile, memories, faqs: [], logs: [], routine: starterRoutine(profile.patientName) },
      `${profile.patientName}'s family`,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DFC2] shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E3DFC2] px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h3 className="text-xl font-bold text-[#2C2C2A]">
              {firstRun ? 'Welcome — how would you like to start?' : 'Set Up a Care Circle'}
            </h3>
            <p className="text-xs text-[#7E7D76] mt-0.5">
              {firstRun
                ? 'Explore a sample family, or set up the person you actually care for.'
                : 'Load a sample family, or create your own from scratch.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#A6A27B] hover:text-[#2C2C2A] hover:bg-[#F4F1EA] transition-all" aria-label={firstRun ? 'Start with an empty care circle' : 'Close'}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {firstRun && (
          <div className="px-6 pt-4">
            <p className="text-[11px] leading-snug text-[#5E5D57] bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl px-3 py-2">
              A sample family fills the hub with a complete history so you can see how everything
              works. <b>It is not real</b> — the care reports and Ask Yadira read these logs, so
              anything they say about a sample is about the sample. Set up your own person when you
              are ready; you can switch at any time from Family Setup.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex space-x-1 p-1 bg-[#F4F1EA] rounded-xl border border-[#E3DFC2] w-full">
            <button
              onClick={() => setTab('samples')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'samples' ? 'bg-white text-[#3A5D45] shadow-xs' : 'text-[#7E7D76] hover:text-[#3A5D45]'}`}
            >
              <Users className="w-4 h-4" /> Sample Families
            </button>
            <button
              onClick={() => setTab('create')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'create' ? 'bg-white text-[#3A5D45] shadow-xs' : 'text-[#7E7D76] hover:text-[#3A5D45]'}`}
            >
              <UserPlus className="w-4 h-4" /> Create Your Own
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === 'samples' ? (
            <div className="space-y-4">
              <p className="text-sm text-[#5E5D57] leading-relaxed">
                Each sample is a complete family — profile, memories, reassurances, care log, and daily routine —
                showing a different kind of relationship Yadira can hold.
              </p>
              {PROFILE_PACKS.map((pack) => (
                <div key={pack.id} className="p-4 rounded-2xl border border-[#E3DFC2] bg-[#FCFAF5] flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${pack.profile.patientMode === 'vivid' ? 'bg-rose-50 text-rose-500' : 'bg-[#E8F1EB] text-[#3A5D45]'}`}>
                      {pack.profile.patientMode === 'vivid' ? <Heart className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#2C2C2A]">{pack.label}</p>
                      <p className="text-xs text-[#7E7D76] leading-snug mt-0.5">{pack.tagline}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-[#A6A27B] mt-1">
                        {pack.profile.patientStage} stage · {pack.profile.patientMode} mode · {pack.memories.length} memories
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => applySample(pack)}
                    className="shrink-0 px-4 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Patient's name *">
                  <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Margaret" className={inputCls} />
                </Field>
                <Field label="Stage">
                  <select value={patientStage} onChange={(e) => setPatientStage(e.target.value)} className={inputCls}>
                    <option>Mild</option><option>Moderate</option><option>Advanced</option>
                  </select>
                </Field>
              </div>

              <Field label="Hobbies & interests">
                <input value={patientHobbies} onChange={(e) => setPatientHobbies(e.target.value)} placeholder="e.g. Knitting, big band music, crossword puzzles" className={inputCls} />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Caregiver's name *">
                  <input value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)} placeholder="e.g. David" className={inputCls} />
                </Field>
                <Field label="Relationship to patient">
                  <input value={caregiverRelationship} onChange={(e) => setCaregiverRelationship(e.target.value)} placeholder="e.g. Son, Daughter, Spouse" className={inputCls} />
                </Field>
              </div>

              <div className="p-4 rounded-2xl border border-[#E3DFC2] bg-[#FCFAF5] space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57]">Who does Yadira become?</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPatientMode('lucid')} className={`flex-1 p-3 rounded-xl border text-left transition-all ${patientMode === 'lucid' ? 'bg-[#E8F1EB] border-[#3A5D45] text-[#3A5D45] font-bold' : 'bg-white border-[#E3DFC2] text-[#5E5D57]'}`}>
                    <span className="text-sm block font-bold">Lucid</span>
                    <span className="text-[11px] leading-tight block mt-0.5">A warm companion. Grounded in the present.</span>
                  </button>
                  <button type="button" onClick={() => setPatientMode('vivid')} className={`flex-1 p-3 rounded-xl border text-left transition-all ${patientMode === 'vivid' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' : 'bg-white border-[#E3DFC2] text-[#5E5D57]'}`}>
                    <span className="text-sm block font-bold">Vivid</span>
                    <span className="text-[11px] leading-tight block mt-0.5">Becomes a specific loved one, and meets them where they are.</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Represented loved one">
                    <input value={representedPersona} onChange={(e) => setRepresentedPersona(e.target.value)} placeholder="e.g. Beth (defaults to caregiver)" className={inputCls} />
                  </Field>
                  <Field label="Voice">
                    <select value={representedVoiceId} onChange={(e) => setRepresentedVoiceId(e.target.value)} className={inputCls}>
                      <option value="Sarah">Sarah (warm female)</option>
                      <option value="Ashley">Ashley (natural female)</option>
                      <option value="Dennis">Dennis (calm male)</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* Seed memories */}
              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57]">Anchor memories (optional, add more anytime)</p>
                {seedMemories.map((m, i) => (
                  <div key={i} className="p-3 rounded-2xl border border-[#E3DFC2] bg-[#FCFAF5] space-y-2 relative">
                    {seedMemories.length > 1 && (
                      <button type="button" onClick={() => setSeedMemories((prev) => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-[#A6A27B] hover:text-red-500" aria-label="Remove memory">
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                    <input value={m.title} onChange={(e) => updateSeed(i, { title: e.target.value })} placeholder="Memory title (e.g. The blue Ford)" className={inputCls} />
                    <textarea value={m.description} onChange={(e) => updateSeed(i, { description: e.target.value })} rows={2} placeholder="A warm, sensory description in the second person ('You and Beth drove to the coast...')" className={inputCls} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={m.relationshipOrEra} onChange={(e) => updateSeed(i, { relationshipOrEra: e.target.value })} placeholder="Person or era (e.g. Beth, Wife)" className={inputCls} />
                      <select value={m.imageTheme} onChange={(e) => updateSeed(i, { imageTheme: e.target.value as Memory['imageTheme'] })} className={inputCls}>
                        {THEME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setSeedMemories((prev) => [...prev, { title: '', description: '', relationshipOrEra: '', imageTheme: 'family' }])} className="flex items-center gap-1.5 text-sm font-bold text-[#3A5D45] hover:underline">
                  <Plus className="w-4 h-4" /> Add another memory
                </button>
              </div>

              <button
                onClick={applyCreated}
                disabled={!canCreate}
                className="w-full py-4 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" /> Create This Care Circle
              </button>
              {!canCreate && (
                <p className="text-center text-xs text-[#A6A27B]">A patient name and caregiver name are required to begin.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const inputCls =
  'w-full p-3 bg-white border border-[#C4C09E] rounded-xl text-sm text-[#2C2C2A] focus:outline-hidden focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#5E5D57] mb-1">{label}</label>
      {children}
    </div>
  );
}
