import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { readSpeechResults, type ReadTranscript } from '../lib/speechTranscript';
import { PhoneOff, Mic, Volume2 } from 'lucide-react';
import type { Message } from '../types';

interface CallScreenProps {
  /** Who's on the call: the persona name in Vivid mode, or "Yadira" in Lucid. */
  callerName: string;
  isSpeaking: boolean;
  onUserSpoke: (text: string) => void;
  onExit: () => void;
  /** Cut the companion's speech short — listening resumes automatically. */
  onSkipSpeech?: () => void;
  chatMessages: Message[];
}

export default function CallScreen({
  callerName,
  isSpeaking,
  onUserSpoke,
  onExit,
  onSkipSpeech,
  chatMessages,
}: CallScreenProps) {
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [duration, setDuration] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringSourceRef = useRef<OscillatorNode[]>([]);
  const ringGainRef = useRef<GainNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);

  const personaName = callerName || 'Yadira';

  // 1. Synthesize Ringtone & Connection Sounds
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.2, ctx.currentTime);
      masterGain.connect(ctx.destination);
      ringGainRef.current = masterGain;

      // Pulse Ringtone: 2s on, 4s off
      const playRing = () => {
        if (!ctx || ctx.state === 'closed') return;
        const now = ctx.currentTime;
        
        // US Ring tone is a combination of 440Hz and 480Hz
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(1, now + 0.1);
        gainNode.gain.setValueAtTime(1, now + 1.8);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.1);
        osc2.stop(now + 2.1);

        ringSourceRef.current = [osc1, osc2];
      };

      // Play immediately and then repeat
      playRing();
      const ringInterval = window.setInterval(playRing, 6000);

      // Auto-connect after 4.5 seconds (roughly two rings)
      const connectTimeout = window.setTimeout(() => {
        window.clearInterval(ringInterval);
        
        // Stop any currently playing ring oscs
        try {
          ringSourceRef.current.forEach(osc => osc.stop());
        } catch (_) {}

        // Connection beep
        const now = ctx.currentTime;
        const beep = ctx.createOscillator();
        const beepGain = ctx.createGain();
        beep.frequency.value = 880; // pure C5 chime
        beepGain.gain.setValueAtTime(0.0001, now);
        beepGain.gain.linearRampToValueAtTime(0.4, now + 0.05);
        beepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        beep.connect(beepGain);
        beepGain.connect(masterGain);
        beep.start(now);
        beep.stop(now + 0.4);

        setCallState('connected');
        
        // Tell parent call connected so it can trigger initial voice prompt
        onUserSpoke('');
      }, 4500);

      return () => {
        window.clearInterval(ringInterval);
        window.clearTimeout(connectTimeout);
        try {
          ringSourceRef.current.forEach(osc => osc.stop());
        } catch (_) {}
        ctx.close().catch(() => {});
      };
    } catch (err) {
      console.warn('Web Audio not supported for ringtone:', err);
      setCallState('connected');
      onUserSpoke('');
    }
  }, []);

  // 2. Call duration timer
  useEffect(() => {
    if (callState !== 'connected') return;

    timerRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [callState]);

  // Format call duration
  const transcriptRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 3. Hands-free Speech Recognition Control
  useEffect(() => {
    if (callState !== 'connected') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    // The whole turn, rebuilt from event.results each time rather than
    // accumulated. Engines re-deliver earlier results with resultIndex back at
    // 0, and appending on redelivery is what produced "I'm I'm feeling I'm
    // feeling okay I'm feeling okay ..." in a real call. See
    // src/lib/speechTranscript.ts.
    let spoken: ReadTranscript = { final: '', interim: '', text: '' };

    rec.onstart = () => {
      setIsListening(true);
      setInterimSpeech('');
      spoken = { final: '', interim: '', text: '' };
    };

    rec.onresult = (event: any) => {
      spoken = readSpeechResults(event.results);
      setInterimSpeech(spoken.text);
    };

    rec.onend = () => {
      setIsListening(false);
      // Prefer confirmed final text; fall back to the interim tail if the
      // browser's VAD cut the session before a final result was delivered.
      const spokenText = spoken.final || spoken.interim;
      if (spokenText) {
        onUserSpoke(spokenText);
        setInterimSpeech('');
        // Cleared here as well as in onstart: a session can resume without
        // firing onstart, and a turn that carried over into the next one is
        // how this failure compounds.
        spoken = { final: '', interim: '', text: '' };
      } else {
        // No speech captured — restart recognition so the user can keep talking
        // without needing to tap anything (handles browser timeout on silence).
        try {
          rec.start();
        } catch (_) {}
      }
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.abort();
      } catch (_) {}
    };
  }, [callState]);

  // 4. Toggle Speech Recognition based on Yadira's speech state (hands-free turn-taking)
  useEffect(() => {
    if (callState !== 'connected' || !recognitionRef.current) return;

    if (isSpeaking) {
      // Companion is speaking, stop listening so we don't record our own voice
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    } else {
      // Companion finished speaking, start listening automatically
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Safe check for already running recognition
        console.warn('Failed to start speech recognition:', err);
      }
    }
  }, [isSpeaking, callState]);

  // The call's conversation. The cap used to be 4, which made "scroll back"
  // meaningless — there was nothing behind the fold to reach, so a long call
  // simply lost its beginning. Now it keeps enough to scroll through while
  // still bounding how many nodes a very long call renders.
  const callMessages = chatMessages
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .slice(-40);

  // Keep the newest bubble in view. Without this the scroll fix would be a
  // half-fix: scrollable, but silently parked on old text while the companion
  // talks below the fold.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [callMessages.length, interimSpeech]);

  return (
    <div className="fixed inset-0 z-50 bg-[#070b19] text-white flex flex-col justify-between p-6 select-none">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 bg-radial-at-t from-[#1b2d4a] via-[#070b19] to-[#04060d] opacity-80 pointer-events-none z-0" />

      {/* Top Section: Caller Info */}
      <div className="relative z-10 flex flex-col items-center mt-12">
        <motion.div
          animate={callState === 'ringing' ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-32 h-32 rounded-full bg-[#1b2a47] border-2 border-green-400 flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(74,222,128,0.2)] mb-6"
        >
          {personaName.charAt(0)}
        </motion.div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">{personaName}</h2>
        <p className="text-sm font-light uppercase tracking-[0.2em] text-green-400 min-h-[20px]">
          {callState === 'ringing' ? 'Calling...' : formatTime(duration)}
        </p>
      </div>

      {/* Middle Section: Captions & Live Transcription
          ------------------------------------------------------------------
          This used to be `justify-end` on the scrolling element itself, with a
          fixed 300px cap. Both were wrong once a call ran long:

            · justify-content: flex-end on an overflowing flex column puts the
              overflow at the TOP, where browsers will not let you scroll to
              it. The earliest bubbles were not merely off-screen, they were
              unreachable — "the call bubbles aren't scrollable so they still
              cut off".
            · 300px is 300px whether the phone is 667 or 1024 tall.

          Now the container flexes (min-h-0 so it may actually shrink) and the
          bottom-alignment comes from an `mt-auto` spacer INSIDE the scroll
          area — short calls still sit at the bottom, long ones scroll all the
          way back to the first thing that was said. */}
      <div className="relative z-10 flex-1 flex flex-col max-w-lg w-full mx-auto my-3 sm:my-8 min-h-0">
        <div
          ref={transcriptRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2 flex flex-col gap-4"
        >
          <div className="mt-auto" aria-hidden="true" />
          <AnimatePresence>
            {callState === 'connected' && callMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600/35 border border-blue-400/25 self-end text-blue-100'
                    : 'bg-[#FCFAF5]/10 border border-[#E3DFC2]/10 self-start text-[#FCFAF5]/90'
                }`}
              >
                {msg.text}
              </motion.div>
            ))}

            {/* Interim Speech (Real-time feedback as the patient speaks) */}
            {isListening && interimSpeech && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.8, y: 0 }}
                className="p-4 rounded-2xl max-w-[85%] text-sm bg-blue-600/20 border border-blue-400/10 self-end text-blue-200 italic"
              >
                {interimSpeech}...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Section: Controls */}
      <div className="relative z-10 flex flex-col items-center mb-10 gap-6">
        {/* Status indicator bar */}
        <div className="flex items-center gap-4 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          {isSpeaking ? (
            <>
              <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400 tracking-wider uppercase">Speaking</span>
              {onSkipSpeech && (
                <button
                  type="button"
                  onClick={onSkipSpeech}
                  className="ml-1 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white/90 hover:bg-white/20 transition-all active:scale-95"
                  title="Skip — your turn to talk"
                >
                  Skip
                </button>
              )}
            </>
          ) : isListening ? (
            <>
              <Mic className="w-4 h-4 text-blue-400 animate-bounce" />
              <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Listening</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-white/40 tracking-wider uppercase">Standby</span>
          )}
        </div>

        {/* End Call Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            // Stop any recognition
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch (_) {}
            }
            onExit();
          }}
          className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all"
          aria-label="End Call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
