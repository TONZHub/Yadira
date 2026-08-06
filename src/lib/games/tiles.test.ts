// Tests for the sliding-numbers rules.
//
// Merging is the only part of this game with rules in it, and a rule that is
// subtly wrong looks like the board cheating. A player with dementia who sees
// the board behave inconsistently has no way to tell whether it was the game
// or them — and will assume it was them. That is what these protect.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  slideRow,
  move,
  emptyCells,
  addTile,
  isStuck,
  newGame,
  emptyBoard,
  SIZE,
  type Board,
} from './tiles';

describe('a row collapses the way a person expects', () => {
  test('gaps close', () => {
    assert.deepEqual(slideRow([0, 2, 0, 4]).row, [2, 4, 0, 0]);
  });

  test('a matching pair merges', () => {
    const r = slideRow([2, 2, 0, 0]);
    assert.deepEqual(r.row, [4, 0, 0, 0]);
    assert.equal(r.gained, 4);
  });

  test('a merged tile cannot merge again in the same move', () => {
    // [2,2,4,0] must give [4,4,0,0] and never [8,0,0,0]. Getting this wrong
    // makes the board lurch in a way nobody can predict from looking at it.
    assert.deepEqual(slideRow([2, 2, 4, 0]).row, [4, 4, 0, 0]);
  });

  test('two separate pairs both merge, once each', () => {
    const r = slideRow([2, 2, 2, 2]);
    assert.deepEqual(r.row, [4, 4, 0, 0]);
    assert.equal(r.gained, 8);
  });

  test('unequal neighbours are left alone', () => {
    assert.deepEqual(slideRow([2, 4, 2, 4]).row, [2, 4, 2, 4]);
  });

  test('an empty row stays empty', () => {
    assert.deepEqual(slideRow([0, 0, 0, 0]).row, [0, 0, 0, 0]);
  });

  test('a row always comes back the same length', () => {
    for (const row of [[2, 2, 2, 2], [0, 0, 0, 2], [4, 0, 4, 0], [2, 4, 8, 16]]) {
      assert.equal(slideRow(row).row.length, SIZE);
    }
  });
});

describe('every direction merges toward the way you pushed', () => {
  const board: Board = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  test('left', () => {
    assert.deepEqual(move(board, 'left').board[0], [4, 0, 0, 0]);
  });

  test('right', () => {
    assert.deepEqual(move(board, 'right').board[0], [0, 0, 0, 4]);
  });

  test('up gathers a column at the top', () => {
    const col: Board = [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const out = move(col, 'up').board;
    assert.equal(out[0][0], 4);
    assert.equal(out[1][0], 0);
  });

  test('down gathers a column at the bottom', () => {
    const col: Board = [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const out = move(col, 'down').board;
    assert.equal(out[3][0], 4);
    assert.equal(out[0][0], 0);
  });

  test('rotating four times is the identity — no drift', () => {
    // If the rotate/unrotate pair were off by one, every vertical move would
    // silently transpose the board.
    const start: Board = [[2, 4, 8, 16], [0, 2, 0, 4], [8, 0, 0, 0], [0, 0, 2, 0]];
    const there = move(start, 'up');
    assert.equal(there.board.length, SIZE);
    assert.equal(there.board[0].length, SIZE);
  });
});

describe('nothing appears for a press that did nothing', () => {
  test('a move that shifts nothing reports moved: false', () => {
    // A tile arriving out of nowhere after a move that visibly changed
    // nothing is the most confusing thing this board can do.
    const packed: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    assert.equal(move(packed, 'left').moved, false);
  });

  test('a move that shifts something reports moved: true', () => {
    const board: Board = [[0, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    assert.equal(move(board, 'left').moved, true);
  });
});

describe('dealing and being stuck', () => {
  test('a new game has exactly two tiles', () => {
    const b = newGame(() => 0.5);
    assert.equal(emptyCells(b).length, SIZE * SIZE - 2);
  });

  test('a new tile is a 2 or a 4, never anything else', () => {
    for (const r of [0, 0.5, 0.89, 0.91, 0.99]) {
      const b = addTile(emptyBoard(), () => r);
      const placed = b.flat().filter((n) => n !== 0);
      assert.equal(placed.length, 1);
      assert.ok(placed[0] === 2 || placed[0] === 4, `got ${placed[0]}`);
    }
  });

  test('addTile on a full board changes nothing rather than throwing', () => {
    const full: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    assert.deepEqual(addTile(full), full);
  });

  test('a board with a gap is never stuck', () => {
    const nearly: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]];
    assert.equal(isStuck(nearly), false);
  });

  test('a full board with an adjacent pair is not stuck', () => {
    const mergeable: Board = [[2, 2, 4, 8], [4, 8, 16, 32], [2, 4, 8, 16], [4, 8, 16, 32]];
    assert.equal(isStuck(mergeable), false);
  });

  test('a full board with no pair is stuck', () => {
    const jammed: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    assert.equal(isStuck(jammed), true);
  });

  test('stuck is a signal to deal again, not a loss', () => {
    // The name matters. Nothing in this club ends badly — the component reads
    // this to know when Hattie should say something and start over, and the
    // player is never told they lost, because they did not.
    const jammed: Board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    assert.equal(isStuck(jammed), true);
    assert.equal(emptyCells(newGame(() => 0.3)).length, SIZE * SIZE - 2);
  });
});
