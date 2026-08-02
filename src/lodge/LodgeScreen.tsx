// Hattie's Lodge — the caregiver's own place. Caregiver Pro's star feature.
// ------------------------------------------------------------------
// Camp, but fancier: up the hill from the patient's campfire, indoors,
// evening light. Everything else in the app is about the patient. The
// lodge is the one room that is about the person doing the caring.
//
//   • The check-in mirrors camp ("How heavy was today?") — four honest
//     answers, no wrong ones. Coming back daily feeds the hearth.
//   • Hattie TALKS here (she is a silent presence at camp) — a wellbeing
//     companion for the caregiver, via /api/hattie/chat.
//   • Self-contained module: owns its store keys (caregiverCheckIns,
//     hattieThread) through the same synced hooks as everything else.
//     App.tsx only mounts it.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Loader, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { PRICE_SHORT } from '../lib/pricing';
import type { CaregiverCheckIn, HattieMessage } from '../types';
import { Hattie } from '../components/Hattie';
import Hearth from './Hearth';
import { useStoreList, useStoreDoc } from '../lib/useStore';
import { startCampfireAmbience, type CampfireHandle } from '../lib/campSounds';
import { getCircleId } from '../lib/firebase';

// Hattie's own Inworld designed voice — hers alone, distinct from Yadira's
// voices and any Vivid persona voice.
const HATTIE_VOICE_ID = 'zippy-pecan-9151__design-voice-29a734a1';
const LODGE_VOICE_PREF = 'yadira_lodge_voice';

type Load = CaregiverCheckIn['load'];

const LOADS: { key: Load; label: string; emoji: string; reply: string }[] = [
  { key: 'steady', label: 'Steady', emoji: '🌿', reply: "I'm glad. Days like this are worth noticing too — they're what you're fighting for." },
  { key: 'stretched', label: 'Stretched thin', emoji: '🌗', reply: "That's most days, isn't it. You still came up the hill — sit a while." },
  { key: 'heavy', label: 'Heavy', emoji: '🌧️', reply: 'Then put it down here for a few minutes. The lodge can hold it.' },
  { key: 'empty', label: 'Running on empty', emoji: '🕯️', reply: "Thank you for telling me the truth. Empty is information, not failure — let's talk about it." },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// Consecutive-day streak ending today (or yesterday, so an evening visit
// before today's check-in doesn't read as a cold hearth).
function lodgeStreak(checkIns: CaregiverCheckIn[]): number {
  const dates = new Set(checkIns.map((c) => c.date));
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const eveningGreeting = (h: number) =>
  h < 12 ? 'The lodge is quiet this morning' : h < 17 ? 'The lodge is warm this afternoon' : 'The lamps are lit';

interface LodgeScreenProps {
  isPremium: boolean;
  premiumBusy: boolean;
  onUnlock: () => void;
  caregiverName: string;
  caregiverRelationship?: string;
  patientName: string;
  soundEnabled?: boolean;
}

export const LodgeScreen: React.FC<LodgeScreenProps> = ({
  isPremium,
  premiumBusy,
  onUnlock,
  caregiverName,
  caregiverRelationship,
  patientName,
  soundEnabled = true,
}) => {
  const [checkIns, setCheckIns] = useStoreList<CaregiverCheckIn>('caregiverCheckIns', [], 'date');
  const [thread, setThread] = useStoreDoc<{ messages: HattieMessage[] }>('hattieThread', { messages: [] });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem(LODGE_VOICE_PREF) !== 'off');
  const hattieAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleVoice = () => {
    setVoiceOn((v) => {
      const next = !v;
      localStorage.setItem(LODGE_VOICE_PREF, next ? 'on' : 'off');
      if (!next) {
        hattieAudioRef.current?.pause();
        hattieAudioRef.current = null;
      }
      return next;
    });
  };

  // Hattie speaks her replies in her own voice. Deliberately NO device-voice
  // fallback (unlike the patient companion): a stranger's voice would break
  // her more than silence does — the words are on screen either way.
  const speakAsHattie = async (text: string) => {
    if (!voiceOn) return;
    try {
      hattieAudioRef.current?.pause();
      const token = localStorage.getItem('yadira_token');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: text.replace(/\*+/g, '').slice(0, 1200),
          voiceId: HATTIE_VOICE_ID,
          circle: getCircleId(),
        }),
      });
      if (!res.ok) return;
      const objectUrl = URL.createObjectURL(await res.blob());
      const audio = new Audio(objectUrl);
      hattieAudioRef.current = audio;
      audio.addEventListener('ended', () => URL.revokeObjectURL(objectUrl));
      audio.addEventListener('error', () => URL.revokeObjectURL(objectUrl));
      await audio.play();
    } catch {
      /* silent — the text already landed */
    }
  };

  // Leaving the lodge stops her mid-sentence rather than letting the voice
  // follow the caregiver into another tab.
  useEffect(() => () => hattieAudioRef.current?.pause(), []);

  const todays = checkIns.find((c) => c.date === todayISO()) ?? null;
  const streak = useMemo(() => lodgeStreak(checkIns), [checkIns]);
  const pickedReply = todays ? LOADS.find((l) => l.key === todays.load)?.reply : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread.messages.length, thinking]);

  // The hearth crackles softly while the lodge is open — the same fire
  // voice as camp, banked down to indoor volume.
  const fireRef = useRef<CampfireHandle | null>(null);
  useEffect(() => {
    if (!isPremium || !soundEnabled) return;
    fireRef.current = startCampfireAmbience((Math.min(streak, 7) / 7) * 0.5);
    return () => {
      fireRef.current?.stop();
      fireRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, soundEnabled]);
  useEffect(() => {
    fireRef.current?.setIntensity((Math.min(streak, 7) / 7) * 0.5);
  }, [streak]);

  const checkIn = (load: Load) => {
    setCheckIns((prev) => [...prev.filter((c) => c.date !== todayISO()), { date: todayISO(), load }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const mine: HattieMessage = { id: `${Date.now()}-c`, role: 'caregiver', text, timestamp: Date.now() };
    // Keep the hearth-side thread bounded — Hattie's memory is the last stretch
    // of conversation, not a transcript archive.
    const withMine = [...thread.messages, mine].slice(-40);
    setThread({ messages: withMine });
    setThinking(true);
    try {
      const token = localStorage.getItem('yadira_token');
      const res = await fetch('/api/hattie/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: withMine.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          checkIns: checkIns.slice(-14),
          streakDays: streak,
          caregiverName,
          caregiverRelationship,
          patientName,
        }),
      });
      const data = await res.json();
      const reply: HattieMessage = {
        id: `${Date.now()}-h`,
        role: 'hattie',
        text: data.reply || "I'm here. Tell me again?",
        timestamp: Date.now(),
      };
      setThread({ messages: [...withMine, reply].slice(-40) });
      void speakAsHattie(reply.text);
    } catch {
      const offline: HattieMessage = {
        id: `${Date.now()}-h`,
        role: 'hattie',
        text: "The lodge lost the thread for a moment — I couldn't reach the hearth. Try me again?",
        timestamp: Date.now(),
      };
      setThread({ messages: [...withMine, offline].slice(-40) });
    } finally {
      setThinking(false);
    }
  };

  // ---------- The door (free caregivers see this, warmly) ----------
  if (!isPremium) {
    return (
      <div className="rounded-3xl border border-[#E3DFC2] shadow-sm overflow-hidden bg-gradient-to-b from-[#3B3128] to-[#241E18] text-center px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-md flex flex-col items-center">
          <Hattie size={116} />
          <h2 className="mt-4 font-serif text-2xl sm:text-3xl text-[#F3EBDD] font-bold">Hattie's Lodge</h2>
          <p className="mt-3 text-[#D8CDBB] leading-relaxed">
            Up the hill from {patientName ? `${patientName}'s` : 'the'} camp there's a lodge with a
            hearth, and it isn't for them — it's for <b className="text-[#F3EBDD]">you</b>. A daily
            check-in about <i>your</i> day. A companion who asks how the caregiver is doing, for once.
          </p>
          <p className="mt-2 text-[#D8CDBB] leading-relaxed italic">
            "This place is for you. Come sit down."
          </p>
          <button
            type="button"
            onClick={onUnlock}
            disabled={premiumBusy}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#C8A96A] hover:bg-[#B99855] px-7 py-3.5 font-extrabold text-[#241E18] shadow-lg transition-all active:scale-95 disabled:opacity-60"
          >
            {premiumBusy ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Open the lodge — {PRICE_SHORT}
          </button>
          <p className="mt-3 text-xs text-[#9C8F7B]">
            Caregiver Pro. Everything {patientName || 'your loved one'} uses stays free, always.
          </p>
        </div>
      </div>
    );
  }

  // ---------- Inside the lodge ----------
  return (
    <div className="rounded-3xl border border-[#E3DFC2] shadow-sm overflow-hidden bg-gradient-to-b from-[#3B3128] via-[#2E2620] to-[#241E18]">
      {/* Hearth-side header */}
      <div className="px-6 pt-8 pb-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C8A96A]">🛖 Hattie's Lodge</p>
        <div className="mt-4 flex items-end justify-center gap-1 sm:gap-3">
          <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
            <Hattie size={104} />
          </motion.div>
          <Hearth streak={streak} width={190} />
        </div>
        <p className="mt-2.5 text-xs font-semibold text-[#B99855]">
          {streak >= 2
            ? `The hearth is on day ${streak} — it grows warmer each day you come up.`
            : streak === 1
              ? 'You lit the hearth today. Come back tomorrow and it will grow.'
              : 'The embers are warm, ready for you.'}
        </p>
        <h2 className="mt-4 font-serif text-xl sm:text-2xl text-[#F3EBDD] font-bold">
          {eveningGreeting(new Date().getHours())}{caregiverName ? `, ${caregiverName}` : ''}.
        </h2>
      </div>

      {/* Your check-in — the mirror of camp */}
      <div className="px-5 sm:px-8 pb-6">
        <div className="rounded-2xl bg-[#443A2F]/60 border border-[#5C5148] p-4 sm:p-5">
          {!todays ? (
            <p className="text-center text-[#E8DCC0] font-semibold">How heavy was today?</p>
          ) : (
            <p className="text-center text-[#E8DCC0] leading-relaxed">
              <span className="font-semibold">Thank you for telling me.</span>{' '}
              <span className="text-[#D8CDBB]">{pickedReply}</span>
            </p>
          )}
          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {LOADS.map((l) => {
              const active = todays?.load === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => checkIn(l.key)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3.5 transition-all active:scale-95 ${
                    active
                      ? 'border-[#C8A96A] bg-[#C8A96A]/15 shadow-md scale-[1.02]'
                      : todays
                        ? 'border-[#5C5148] bg-[#2E2620]/60 opacity-60 hover:opacity-100'
                        : 'border-[#5C5148] bg-[#2E2620]/60 hover:border-[#C8A96A]'
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{l.emoji}</span>
                  <span className="text-xs sm:text-[13px] font-bold text-[#E8DCC0] leading-tight text-center">{l.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-center text-[11px] text-[#9C8F7B]">
            No wrong answers. This stays between you and Hattie — {patientName || 'your loved one'} never sees it.
          </p>
        </div>
      </div>

      {/* The conversation by the hearth */}
      <div className="px-5 sm:px-8 pb-7">
        <div className="rounded-2xl bg-[#443A2F]/60 border border-[#5C5148] overflow-hidden">
          <div ref={scrollRef} className="max-h-80 overflow-y-auto p-4 sm:p-5 space-y-3" aria-live="polite">
            {thread.messages.length === 0 && (
              <div className="flex items-start gap-2.5">
                <Hattie size={34} aria-hidden />
                <div className="rounded-2xl rounded-tl-sm bg-[#2E2620] border border-[#5C5148] px-4 py-3 text-[#E8DCC0] text-[15px] leading-relaxed">
                  Everyone else in this app asks about {patientName || 'your person'}. I'm going to ask
                  about you. How are you, really?
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {thread.messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-2.5 ${m.role === 'caregiver' ? 'justify-end' : ''}`}
                >
                  {m.role === 'hattie' && <Hattie size={34} aria-hidden />}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      m.role === 'caregiver'
                        ? 'rounded-tr-sm bg-[#C8A96A] text-[#241E18] font-medium'
                        : 'rounded-tl-sm bg-[#2E2620] border border-[#5C5148] text-[#E8DCC0]'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking && (
              <div className="flex items-start gap-2.5">
                <Hattie size={34} aria-hidden />
                <div className="rounded-2xl rounded-tl-sm bg-[#2E2620] border border-[#5C5148] px-4 py-3 text-[#9C8F7B] text-sm italic">
                  Hattie is listening…
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-[#5C5148] p-3 flex items-end gap-2 bg-[#2E2620]/60">
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voiceOn}
              aria-label={voiceOn ? "Mute Hattie's voice" : "Unmute Hattie's voice"}
              title={voiceOn ? "Hattie speaks her replies — tap to mute" : "Hattie is muted — tap to hear her"}
              className={`rounded-xl p-2.5 border transition-all active:scale-95 ${
                voiceOn
                  ? 'border-[#C8A96A] bg-[#C8A96A]/15 text-[#C8A96A]'
                  : 'border-[#5C5148] bg-[#241E18] text-[#8A7D68]'
              }`}
            >
              {voiceOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Say it like it is — she can take it"
              className="flex-1 resize-none rounded-xl bg-[#241E18] border border-[#5C5148] px-3.5 py-2.5 text-[15px] text-[#F3EBDD] placeholder-[#8A7D68] focus:outline-none focus:border-[#C8A96A]"
            />
            <button
              type="button"
              onClick={send}
              disabled={thinking || !input.trim()}
              aria-label="Send to Hattie"
              className="rounded-xl bg-[#C8A96A] hover:bg-[#B99855] p-2.5 text-[#241E18] transition-all active:scale-95 disabled:opacity-40"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-[#9C8F7B]">
          Hattie is a companion, not a therapist. If the weight ever feels like more than tiredness,
          call or text <b className="text-[#C8A96A]">988</b> (US) — any hour.
        </p>
      </div>
    </div>
  );
};

export default LodgeScreen;
