// Sensory rooms — calming full-screen experiences launched from the patient
// view. Aurora is free (the taste); the rest are Yadira Premium.
// All are pure canvas + Web Audio: no assets, no API cost, work offline.

export type RoomId = 'aurora' | 'rain' | 'leaves' | 'canopy' | 'water';

export interface RoomMeta {
  id: RoomId;
  label: string;
  blurb: string;
  premium: boolean;
  // Two-stop gradient for the picker card preview (CSS colors).
  preview: [string, string];
  emoji: string;
}

export const SENSORY_ROOMS: RoomMeta[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    blurb: 'Drifting northern lights you can stir with a touch.',
    premium: false,
    preview: ['#0b1e3a', '#3a1e5c'],
    emoji: '🌌',
  },
  {
    id: 'rain',
    label: 'Rainy Window',
    blurb: 'Raindrops sliding down the glass. Tap to send ripples through the pane.',
    premium: true,
    preview: ['#2b3a44', '#4a5a68'],
    emoji: '🌧️',
  },
  {
    id: 'leaves',
    label: 'Autumn Leaves',
    blurb: 'Leaves drifting down on a warm breeze. Swipe to send them dancing away.',
    premium: true,
    preview: ['#b5551d', '#e2a33c'],
    emoji: '🍂',
  },
  {
    id: 'water',
    label: 'Still Water',
    blurb: 'A quiet pond at dusk. Touch it and the rings spread out from your hand.',
    premium: true,
    preview: ['#0d1c24', '#2c5a66'],
    emoji: '💧',
  },
  {
    id: 'canopy',
    label: 'Forest Canopy',
    blurb: 'Soft dappled sunlight breaking gently through the trees.',
    premium: true,
    preview: ['#1e3b26', '#5c8d4e'],
    emoji: '🌲',
  },
];

export function getRoom(id: RoomId): RoomMeta {
  return SENSORY_ROOMS.find((r) => r.id === id) ?? SENSORY_ROOMS[0];
}
