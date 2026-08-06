// Sliding Numbers — the 2048 move rules, as pure functions.
// ------------------------------------------------------------------
// Separated from the component because merging is the part with actual rules
// in it, and rules that are wrong in a subtle way (a row merging twice in one
// move, a merge happening in the wrong direction) look like the game
// cheating. Someone with dementia who sees a board behave inconsistently has
// no way to tell whether it was the game or them, and will assume it was
// them. That is the whole reason this is tested.

export type Board = number[][];

export const SIZE = 4;

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

/**
 * Collapse one row leftward.
 *
 * Returns the new row and how much was merged. A tile that has just merged
 * cannot merge again in the same move — [2,2,4,0] gives [4,4,0,0], never
 * [8,0,0,0]. Getting that wrong makes the board lurch in a way a player
 * cannot predict.
 */
export function slideRow(row: number[]): { row: number[]; gained: number } {
  const packed = row.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;

  for (let i = 0; i < packed.length; i++) {
    if (packed[i] === packed[i + 1]) {
      const merged = packed[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // consumed the partner, so it cannot merge again
    } else {
      out.push(packed[i]);
    }
  }

  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

const rotate = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]).reverse());

/** Rotate n quarter-turns clockwise. */
function turn(b: Board, n: number): Board {
  let out = b;
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) out = rotate(out);
  return out;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

const TURNS: Record<Direction, number> = { left: 0, up: 3, right: 2, down: 1 };

/**
 * Apply a move. `moved` is false when nothing shifted, which is what stops a
 * new tile appearing for a press that did nothing — a tile arriving out of
 * nowhere after a move that visibly changed nothing is the single most
 * confusing thing this board can do.
 */
export function move(board: Board, dir: Direction): { board: Board; gained: number; moved: boolean } {
  const t = TURNS[dir];
  const rotated = turn(board, t);
  let gained = 0;
  const slid = rotated.map((row) => {
    const r = slideRow(row);
    gained += r.gained;
    return r.row;
  });
  const out = turn(slid, 4 - t);
  const moved = JSON.stringify(out) !== JSON.stringify(board);
  return { board: out, gained, moved };
}

/** Every empty cell, as [row, col]. */
export function emptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (board[r][c] === 0) cells.push([r, c]);
  }
  return cells;
}

/** Drop a 2 (or occasionally a 4) into a random empty cell. */
export function addTile(board: Board, rng: () => number = Math.random): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const [r, c] = cells[Math.floor(rng() * cells.length)];
  const next = board.map((row) => [...row]);
  next[r][c] = rng() < 0.9 ? 2 : 4;
  return next;
}

/**
 * Is the board stuck — no empty cell and no possible merge?
 *
 * Deliberately NOT called "isGameOver". Nothing here is over. The component
 * reads this to know when to have Hattie say something and deal again, and
 * the player is never told they lost, because they did not.
 */
export function isStuck(board: Board): boolean {
  if (emptyCells(board).length > 0) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c];
      if (c + 1 < SIZE && board[r][c + 1] === v) return false;
      if (r + 1 < SIZE && board[r + 1][c] === v) return false;
    }
  }
  return true;
}

export function newGame(rng: () => number = Math.random): Board {
  return addTile(addTile(emptyBoard(), rng), rng);
}
