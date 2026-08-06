// Hattie's Club — the games, and the one rule they all obey.
// ------------------------------------------------------------------
// This app ships a routine card that says "Reminiscence, never quizzing", and
// a tour that says to share a memory directly rather than asking "do you
// remember?". Games are quizzes with scores, which is the exact thing that
// text warns against — a person who used to reach 2048 and now reaches 64 is
// being handed a number that measures their decline.
//
// So there is no losing here. Not a softer loss, not an easier level: no
// game in this club can end badly. When a board fills or a sequence breaks,
// Hattie says something and it starts again. The player is never told they
// failed, never shown a final score, and never asked to compare themselves
// to a previous attempt.
//
// What is kept is the good part — the pleasure of a thing that responds, a
// pattern that resolves, a pair that matches. That works at every stage.

export type GameId = 'pairs' | 'simon' | 'tiles';

export interface GameMeta {
  id: GameId;
  label: string;
  blurb: string;
  emoji: string;
  /** Two-stop gradient for the picker card. */
  preview: [string, string];
}

export const CLUB_GAMES: GameMeta[] = [
  {
    id: 'pairs',
    label: 'Matching Pairs',
    blurb: 'Turn over two cards and find the ones that go together. Your own photos, if you have added some.',
    emoji: '🃏',
    preview: ['#3A5D45', '#5C8D71'],
  },
  {
    id: 'simon',
    label: "Hattie's Tune",
    blurb: 'Hattie plays a few notes. Play them back, and she adds one more.',
    emoji: '🎵',
    preview: ['#4A5A8D', '#7E8FC4'],
  },
  {
    id: 'tiles',
    label: 'Sliding Numbers',
    blurb: 'Slide the tiles together and watch the numbers grow.',
    emoji: '🔢',
    preview: ['#B5551D', '#E2A33C'],
  },
];

/**
 * What Hattie says when a game resets.
 *
 * Written for an adult. The failure mode of "encouragement" in this context
 * is sounding like a nursery teacher — a person with dementia is not a
 * child, and being spoken to as one is the single most reliable way to
 * make someone feel their standing has slipped. None of these praise
 * effort, none say "good try", and none mention what went wrong.
 *
 * They also never reference a score, a level, or a previous attempt.
 */
const RESTART_LINES = [
  "Let's go round again.",
  'Shall we have another?',
  "I'll set it up again.",
  'One more, I think.',
  "Here's a fresh one.",
  'Round again — I like this bit.',
  "Let's start over, it's no trouble.",
];

/**
 * A line, avoiding the one just used.
 *
 * Repeating the same sentence twice in a row is what makes a warm line read
 * as a canned one, and this is the moment the player is most likely to
 * notice.
 */
export function restartLine(previous?: string): string {
  const options = RESTART_LINES.filter((l) => l !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

/** Something to say on a good moment, without turning it into praise. */
const DELIGHT_LINES = [
  'There it is.',
  'Oh, lovely.',
  'That is the one.',
  'Yes — just there.',
  'Good, good.',
];

export function delightLine(previous?: string): string {
  const options = DELIGHT_LINES.filter((l) => l !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

/** Nothing in this club is allowed to say a person lost. */
export const NO_FAIL_STATE = true;
