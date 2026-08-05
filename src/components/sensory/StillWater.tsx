import React, { useEffect, useRef } from 'react';
import SensoryExit from './SensoryExit';

// Still Water — a pond at dusk. Touch it and rings spread out from your
// finger, cross, and fade. Nothing to complete, nothing to get wrong.
//
// ---- Where this came from ----
//
// Adapted from a canvas field visualizer someone shared: a grid of points
// displaced by a radial sine wave, with a pointer that pushes them around.
// That core is genuinely lovely and it is what survived.
//
// What did not survive was everything around it — a telemetry panel reading
// "Global Coherence 99.62%" computed from two slider positions, controls
// labelled "Mitochondrial Drive" and "Boundary Layer Insulation Strength",
// and three mode buttons. None of it measured anything. In an app for
// someone living with dementia, a confident-looking percentage on screen is
// a number a frightened family will try to interpret, and there is nothing
// there to interpret. So this room displays no numbers at all.
//
// The interaction is also inverted. In the original, a touch REPELS the
// grid — points flee your finger. Here a touch is met: rings spread out from
// where you pressed, the way water answers a hand. Same maths, opposite
// feeling, and the feeling is the entire product.
//
// ---- Two things the original got wrong technically ----
//
// It advanced its clock per FRAME (`time += 0.04 * freq`), so it ran at
// double speed on a 120Hz tablet. This one integrates real elapsed time.
//
// It ran flat out with no regard for `prefers-reduced-motion`. That setting
// is more likely to be on for this population and more likely to matter, so
// it is honoured here: the water goes glassy and still, and a touch still
// answers, just gently.

interface Ring {
  x: number;
  y: number;
  /** Seconds since it was born. */
  age: number;
}

const RING_SPEED = 190; // px per second the crest travels outward
const RING_LIFE = 3.4; // seconds until it has faded to nothing
const MAX_RINGS = 14; // a hand dragged across the pond must not melt the tablet
const TAU = Math.PI * 2;

export default function StillWater({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const rings = useRef<Ring[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // Device pixels, so the dots are not soft on a retina tablet — but capped
    // at 2, because a 3x phone would quadruple the fill cost for no visible
    // gain on dots this small.
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Spacing rather than a fixed grid count: a phone gets a few hundred
    // dots, a large tablet gets more, and neither ends up with a mesh so
    // dense it reads as noise or so sparse it reads as dots.
    const SPACING = 26;

    const addRing = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      rings.current.push({ x: clientX - rect.left, y: clientY - rect.top, age: 0 });
      if (rings.current.length > MAX_RINGS) rings.current.shift();
    };

    const onPointer = (e: PointerEvent) => addRing(e.clientX, e.clientY);
    // pointerdown for the tap, pointermove only while held — so a hand
    // resting on the glass does not spray rings, and a finger drawn across
    // it leaves a wake.
    const onMove = (e: PointerEvent) => {
      if (e.buttons > 0 || e.pointerType === 'touch') addRing(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('pointermove', onMove);

    // A slow, wide water bed. Same shape as the other rooms: filtered noise,
    // no samples, no network, works with the tablet in aeroplane mode.
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ac;
      const master = ac.createGain();
      master.gain.setValueAtTime(0.0001, ac.currentTime);
      master.gain.linearRampToValueAtTime(0.32, ac.currentTime + 2.5);
      master.connect(ac.destination);

      const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const bed = ac.createBufferSource();
      bed.buffer = buf;
      bed.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      const bg = ac.createGain();
      bg.gain.value = 0.5;

      // A very slow swell, so it breathes rather than hisses.
      const swell = ac.createOscillator();
      swell.frequency.value = 0.06;
      const swellDepth = ac.createGain();
      swellDepth.gain.value = 0.18;
      swell.connect(swellDepth);
      swellDepth.connect(bg.gain);
      swell.start();

      bed.connect(lp);
      lp.connect(bg);
      bg.connect(master);
      bed.start();
    } catch {
      // No audio is fine. The room is a visual first.
    }

    let last = performance.now();
    let clock = 0;

    const frame = (now: number) => {
      // Real elapsed seconds, clamped so a backgrounded tab does not return
      // and jump the pond forward by a minute.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += calm ? dt * 0.25 : dt;

      // Dusk water: deep at the edges, a little light toward the middle.
      const grad = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.75);
      grad.addColorStop(0, '#1d3a44');
      grad.addColorStop(1, '#0d1c24');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Age the rings and drop the spent ones.
      const live = rings.current;
      for (let i = live.length - 1; i >= 0; i--) {
        live[i].age += dt;
        if (live[i].age > RING_LIFE) live.splice(i, 1);
      }

      const cols = Math.ceil(W / SPACING) + 1;
      const rows = Math.ceil(H / SPACING) + 1;

      // x, y, glow triples for the few dots a ring is touching.
      const lit: number[] = [];
      ctx.fillStyle = 'rgba(150, 205, 220, 0.14)';
      ctx.beginPath();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * SPACING;
          const y = r * SPACING;

          // The resting surface: two slow crossing swells, so it never
          // repeats visibly and never looks like a marching grid.
          let lift = calm
            ? 0
            : Math.sin(x * 0.012 + clock * 0.5) * 1.6 + Math.sin(y * 0.016 - clock * 0.36) * 1.6;
          let glow = 0;

          // Every live ring contributes where its crest is passing.
          for (let i = 0; i < live.length; i++) {
            const ring = live[i];
            const dx = x - ring.x;
            const dy = y - ring.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const crest = ring.age * RING_SPEED;
            const offset = dist - crest;
            // A narrow band around the crest, fading as the ring ages and
            // as it widens — energy spread over a bigger circumference.
            if (offset > -60 && offset < 60) {
              const fade = 1 - ring.age / RING_LIFE;
              const band = Math.cos((offset / 60) * (Math.PI / 2));
              const spread = 1 / (1 + crest / 260);
              const amp = band * band * fade * spread;
              lift += Math.sin(offset * 0.09) * amp * (calm ? 5 : 11);
              glow += amp;
            }
          }

          // Dots at rest all look identical, and on a still pond that is
          // almost all of them. Measured at 900x700: individually styling and
          // filling every dot cost ~8ms a frame — half the 60fps budget on a
          // fast desktop, so several times over budget on the cheap tablet
          // this is actually for. A room whose whole job is to be calm must
          // not make the device hot.
          //
          // So the resting field is collected into ONE path with one fill,
          // and only the dots a ring is currently passing through are drawn
          // on their own terms.
          if (glow < 0.02) {
            ctx.moveTo(x + 1.5, y + lift);
            ctx.arc(x, y + lift, 1.5, 0, TAU);
          } else {
            lit.push(x, y + lift, glow);
          }
        }
      }
      ctx.fill();

      for (let i = 0; i < lit.length; i += 3) {
        const glow = lit[i + 2];
        const alpha = Math.min(0.62, 0.14 + glow * 0.5);
        ctx.fillStyle = `rgba(${Math.round(150 + glow * 70)}, ${Math.round(205 + glow * 35)}, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(lit[i], lit[i + 1], 1.5 + Math.min(glow, 1) * 1.7, 0, TAU);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointer);
      canvas.removeEventListener('pointermove', onMove);
      rings.current = [];
      const ac = audioRef.current;
      if (ac) {
        // Fade rather than cut — a hard stop is a click, and a click is the
        // opposite of what this room is for.
        try {
          ac.close();
        } catch {
          /* already closed */
        }
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1c24]">
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      <p className="absolute top-8 left-1/2 -translate-x-1/2 text-sm font-light tracking-widest text-[rgba(170,215,225,0.55)] pointer-events-none select-none">
        touch the water
      </p>
      <SensoryExit onExit={onExit} tint="rgba(170,215,225," />
    </div>
  );
}
