import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { CLUB_GAMES, type GameId } from '../../lib/hattieClub';

// Hattie's Club — the picker.
//
// Same shape as the calming-rooms menu, including the lesson that one cost a
// PR: capped height, a scroll container SEPARATE from the grid so the cards
// keep their natural size, and the header pinned. Three games fit a phone
// today; a fourth would not, and this should not have to be fixed twice.
//
// Deliberately free. The games cost nothing to run — no server, no API call,
// no assets — and putting a paywall in front of the one part of the app that
// looks like fun would be charging for the cheapest thing here.
export default function ClubMenu({
  onSelect,
  onClose,
}: {
  onSelect: (id: GameId) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white max-w-lg w-full rounded-3xl border border-[#E3DFC2] shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="px-6 py-4 border-b border-[#E3DFC2] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-bold text-[#2C2C2A] flex items-center gap-2">
              <span aria-hidden="true">🦛</span> Hattie&rsquo;s Club
            </h3>
            <p className="text-xs text-[#7E7D76] mt-0.5">
              Nothing to win, nothing to lose. Hattie deals again when you want.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A6A27B] hover:text-[#2C2C2A] hover:bg-[#F4F1EA] transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CLUB_GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => onSelect(game.id)}
                className="text-left rounded-2xl overflow-hidden border border-[#E3DFC2] hover:border-[#3A5D45] active:scale-[0.98] transition-all"
              >
                <div
                  className="h-24 w-full relative"
                  style={{ background: `linear-gradient(135deg, ${game.preview[0]}, ${game.preview[1]})` }}
                >
                  <span className="absolute top-2 left-3 text-2xl drop-shadow" aria-hidden="true">
                    {game.emoji}
                  </span>
                </div>
                <div className="p-3 bg-[#FCFAF5]">
                  <p className="font-bold text-[#2C2C2A] text-sm">{game.label}</p>
                  <p className="text-[11px] text-[#7E7D76] leading-snug mt-0.5">{game.blurb}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
