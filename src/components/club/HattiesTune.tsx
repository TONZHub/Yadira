import React, { useEffect, useRef, useState } from 'react';
import SensoryExit from '../sensory/SensoryExit';
import { restartLine } from '../../lib/hattieClub';

// Hattie's Tune — Simon, with the test taken out.
//
// The sequence never resets to one on a mistake. It goes back by a single
// step and plays again, so a wobble costs you one note rather than the whole
// tune. And the length is never shown: "you reached 4" is a score, and a
// score that shrinks across months is the exact thing this club exists to
// avoid putting in front of someone.
//
// Four pads with distinct COLOURS and distinct PITCHES, because colour alone
// excludes anyone with the colour vision changes that often come with age,
// and pitch alone excludes anyone hard of hearing. Either channel is enough
// to play by.

const PADS = [
  { id: 0, hue: '#5C8D71', lit: '#8FD5A8', hz: 329.63 }, // E4
  { id: 1, hue: '#4A5A8D', lit: '#8FA3E0', hz: 392.0 }, // G4
  { id: 2, hue: '#C8A96A', lit: '#F0D9A0', hz: 493.88 }, // B4
  { id: 3, hue: '#B5551D', lit: '#E89A5E', hz: 587.33 }, // D5
];

type Phase = 'watching' | 'your-turn' | 'resetting';

export default function HattiesTune({ onExit }: { onExit: () => void }) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('watching');
  const [saying, setSaying] = useState<string | null>(null);
  const step = useRef(0);
  const lastLine = useRef<string | undefined>(undefined);
  const audio = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const tone = (hz: number, ms = 380) => {
    try {
      if (!audio.current) {
        audio.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ac = audio.current;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      // Shaped rather than switched — a square-edged note clicks, and a click
      // is startling on a device somebody is holding close.
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, ac.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + ms / 1000 + 0.05);
    } catch {
      /* silent is fine — the colours carry it */
    }
  };

  const playBack = (seq: number[]) => {
    setPhase('watching');
    seq.forEach((pad, i) => {
      later(() => {
        setLit(pad);
        tone(PADS[pad].hz);
        later(() => setLit(null), 380);
      }, 700 * i + 500);
    });
    later(() => {
      step.current = 0;
      setPhase('your-turn');
    }, 700 * seq.length + 700);
  };

  const grow = (from: number[]) => {
    const next = [...from, Math.floor(Math.random() * PADS.length)];
    setSequence(next);
    playBack(next);
  };

  useEffect(() => {
    grow([]);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      audio.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = (pad: number) => {
    if (phase !== 'your-turn') return;
    setLit(pad);
    tone(PADS[pad].hz);
    later(() => setLit(null), 200);

    if (sequence[step.current] === pad) {
      step.current += 1;
      if (step.current === sequence.length) later(() => grow(sequence), 700);
      return;
    }

    // A wobble. Step back by one and play it again — the tune never restarts
    // from the beginning, and nothing on screen says a mistake was made.
    const line = restartLine(lastLine.current);
    lastLine.current = line;
    setSaying(line);
    setPhase('resetting');
    const shorter = sequence.slice(0, Math.max(1, sequence.length - 1));
    later(() => {
      setSaying(null);
      setSequence(shorter);
      playBack(shorter);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#141A2A] flex flex-col items-center justify-center p-4">
      <p className="text-[#8FA3E0] text-sm font-light tracking-widest mb-5 select-none h-5">
        {phase === 'your-turn' ? 'your turn' : phase === 'watching' ? 'listen' : ''}
      </p>

      <div className="grid grid-cols-2 gap-3" style={{ width: 'min(88vw, 380px)' }}>
        {PADS.map((pad) => (
          <button
            key={pad.id}
            type="button"
            onClick={() => press(pad.id)}
            disabled={phase !== 'your-turn'}
            aria-label={`Pad ${pad.id + 1}`}
            className="rounded-3xl transition-all duration-150 active:scale-95 disabled:cursor-default"
            style={{
              aspectRatio: '1',
              background: lit === pad.id ? pad.lit : pad.hue,
              boxShadow: lit === pad.id ? `0 0 40px ${pad.lit}` : 'none',
              opacity: phase === 'your-turn' || lit === pad.id ? 1 : 0.55,
            }}
          />
        ))}
      </div>

      {saying && (
        <div className="mt-5 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#1E2740] border border-[#8FA3E0]/40">
          <span className="text-2xl" aria-hidden="true">🦛</span>
          <span className="text-[#D6DEF5] text-sm">{saying}</span>
        </div>
      )}

      <SensoryExit onExit={onExit} tint="rgba(143,163,224," />
    </div>
  );
}
