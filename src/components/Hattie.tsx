// Hattie — Yadira's mascot: a pygmy hippo in camp gear.
// ------------------------------------------------------------------
// The name is the point: Hattie → *hippo*campus, the brain's memory-keeper
// and the first region dementia takes. The camp gear makes the pun visible;
// the warmth is what matters to the person looking at her. The purple ribbon
// on her vest is the Alzheimer's one.
//
// The hand-built placeholder SVG that used to live here has been replaced by
// commissioned art, exactly as its own comment promised: same props, so no
// check-in or camp logic changed. `pose` is the only addition, and it has a
// default, so every existing call site kept working untouched.
//
// ---- What had to be done to the art before it could ship ----
//
// The originals were seven 1254x1254 PNGs, 7.04 MB in total, in RGB with no
// alpha — a cream background baked in. Two problems:
//
//   · 7 MB against a 1.3 MB client bundle is a five-fold increase, on a
//     tablet, for a family who may be on poor wifi.
//   · A baked cream background is a pale square around her on every dark
//     surface, and all three game screens are dark.
//
// Both fixed at 400px WebP with a real alpha channel: 7.04 MB -> 102 KB, and
// she now sits on the dark screens with nothing behind her. The ground
// shadow went too — it read as a white puddle once the background was gone.
//
// 400px is 2x the largest place she appears (132px in Camp), so she stays
// crisp on a retina tablet without carrying pixels nobody sees.

import React from 'react';
import calm from '../assets/hattie/hattie-calm.webp';
import campfire from '../assets/hattie/hattie-campfire.webp';
import lantern from '../assets/hattie/hattie-lantern.webp';
import reading from '../assets/hattie/hattie-reading.webp';
import ready from '../assets/hattie/hattie-ready.webp';
import thinking from '../assets/hattie/hattie-thinking.webp';
import waving from '../assets/hattie/hattie-waving.webp';

export type HattiePose =
  | 'calm'
  | 'campfire'
  | 'lantern'
  | 'reading'
  | 'ready'
  | 'thinking'
  | 'waving';

const POSES: Record<HattiePose, string> = {
  calm,
  campfire,
  lantern,
  reading,
  ready,
  thinking,
  waving,
};

interface HattieProps {
  /** Rendered width/height in px (she's square). Default 200. */
  size?: number;
  /** Gentle breathing idle animation. Default true. */
  animated?: boolean;
  /**
   * Which Hattie.
   *
   * 'ready' by default because it is the neutral one — she is simply there.
   * The others are for moments that have a shape: 'calm' when something is
   * starting over, 'reading' beside the photo game, 'waving' on arrival.
   */
  pose?: HattiePose;
  className?: string;
  'aria-hidden'?: boolean;
}

export const Hattie: React.FC<HattieProps> = ({
  size = 200,
  animated = true,
  pose = 'ready',
  className,
  'aria-hidden': ariaHidden,
}) => {
  return (
    <img
      src={POSES[pose] ?? POSES.ready}
      width={size}
      height={size}
      // Decorative in every current placement — she sits beside text that
      // already says whatever she is there for, and a screen reader
      // announcing "hippopotamus illustration" in the middle of a mood
      // check-in is noise.
      alt=""
      aria-hidden={ariaHidden ?? true}
      draggable={false}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        // Breathing, not bouncing. Reduced-motion is honoured in index.css
        // alongside the other idle animations.
        animation: animated ? 'hattie-breathe 4.5s ease-in-out infinite' : undefined,
      }}
    />
  );
};

export default Hattie;
