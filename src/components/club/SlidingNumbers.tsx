import React, { useEffect, useRef, useState } from 'react';
import SensoryExit from '../sensory/SensoryExit';
import { Hattie } from '../Hattie';
import { restartLine } from '../../lib/hattieClub';
import { newGame, move, addTile, isStuck, type Board, type Direction } from '../../lib/games/tiles';

// Sliding Numbers — 2048, with the losing taken out.
//
// When the board jams, Hattie says something and deals again. There is no
// game-over screen, no final score, and no comparison to a previous attempt.
// A person who used to reach 2048 and now reaches 64 is not shown that.
//
// The running total is deliberately absent too. It is the same information as
// a score, and a number that only ever gets smaller across sessions is the
// thing this whole club exists to avoid.

const TILE_COLORS: Record<number, string> = {
  2: '#EFEAD9', 4: '#E7DFC4', 8: '#E2A33C', 16: '#DD8C2E',
  32: '#D97327', 64: '#C85B22', 128: '#B5551D', 256: '#A04A1A',
  512: '#8C4017', 1024: '#783614', 2048: '#5C8D71',
};

export default function SlidingNumbers({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Board>(() => newGame());
  const [saying, setSaying] = useState<string | null>(null);
  const lastLine = useRef<string | undefined>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const push = (dir: Direction) => {
    setBoard((current) => {
      const result = move(current, dir);
      // Nothing shifted, so nothing new arrives. A tile appearing after a
      // press that visibly changed nothing is unreadable.
      if (!result.moved) return current;
      const next = addTile(result.board);
      if (isStuck(next)) {
        const line = restartLine(lastLine.current);
        lastLine.current = line;
        setSaying(line);
        // Long enough to read without feeling like a penalty box.
        setTimeout(() => { setBoard(newGame()); setSaying(null); }, 2200);
      }
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const)[
        e.key as 'ArrowLeft'
      ];
      if (dir) { e.preventDefault(); push(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    // A generous threshold: an unsteady hand should not fire a move it did
    // not intend, and a deliberate swipe should never be missed.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2A2418] flex flex-col items-center justify-center p-4">
      <p className="text-[#C8A96A] text-sm font-light tracking-widest mb-4 select-none">
        slide the tiles together
      </p>

      <div
        className="grid grid-cols-4 gap-2 p-2 rounded-2xl bg-[#3B3324] touch-none select-none"
        style={{ width: 'min(92vw, 420px)', aspectRatio: '1' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {board.flat().map((value, i) => (
          <div
            key={i}
            className="rounded-xl flex items-center justify-center font-extrabold transition-all duration-150"
            style={{
              background: value ? TILE_COLORS[value] || '#5C8D71' : 'rgba(255,255,255,0.05)',
              color: value > 4 ? '#FFF8EC' : '#5E5D57',
              fontSize: value >= 1024 ? '1.4rem' : value >= 128 ? '1.8rem' : '2.2rem',
            }}
          >
            {value || ''}
          </div>
        ))}
      </div>

      {/* Arrows, because a swipe is not obvious to everyone and a keyboard is
          not present on a tablet. Big targets, always visible. */}
      <div className="mt-5 grid grid-cols-3 gap-2" style={{ width: 'min(70vw, 260px)' }}>
        <span />
        <ArrowKey label="▲" onPress={() => push('up')} />
        <span />
        <ArrowKey label="◀" onPress={() => push('left')} />
        <ArrowKey label="▼" onPress={() => push('down')} />
        <ArrowKey label="▶" onPress={() => push('right')} />
      </div>

      {/* Hattie, when the board jams. Not a modal — it does not block, it does
          not need dismissing, and it never says what went wrong. */}
      {saying && (
        <div className="mt-5 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#3B3324] border border-[#C8A96A]/40">
          <Hattie size={34} pose="calm" />
          <span className="text-[#E8DCC0] text-sm">{saying}</span>
        </div>
      )}

      <SensoryExit onExit={onExit} tint="rgba(200,169,106," />
    </div>
  );
}

function ArrowKey({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="py-4 rounded-xl bg-[#3B3324] border border-[#C8A96A]/30 text-[#C8A96A] text-xl active:scale-95 active:bg-[#4A4030] transition-all"
    >
      {label}
    </button>
  );
}
