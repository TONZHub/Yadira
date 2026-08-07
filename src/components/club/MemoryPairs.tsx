import React, { useEffect, useRef, useState } from 'react';
import SensoryExit from '../sensory/SensoryExit';
import { Hattie } from '../Hattie';
import { delightLine } from '../../lib/hattieClub';

// Matching Pairs — the one that is reminiscence rather than a test.
//
// Matching games with familiar images are actually used in dementia care, and
// the reason is the images, not the matching. So when the family has added
// photos, this deals from THEIR album: turning over a card and finding the
// lake house twice is a different act from finding two identical triangles.
//
// Six pairs, not eight or ten. Twelve cards fits a tablet without shrinking
// them, and a board that takes ten minutes stops being pleasant.
//
// Only CAPTIONED photos are dealt (the caller filters). A caption means a
// caregiver looked at that photo and kept it. An album can also hold a test
// upload, a medical photo, or a picture of someone who has died — things a
// person browses deliberately but would not choose to have flipped at them
// at random. In the album you go looking; here it arrives.
//
// There is no move counter, no timer, and no way to lose. A wrong pair turns
// back over and that is all that happens. The board simply finishes, and
// finishing is the only outcome it has.

const FALLBACK = ['🌻', '🐦', '🍎', '🌙', '🐝', '🌲', '🫖', '🕊️'];
const PAIRS = 6;

interface Card {
  key: number;
  face: string;
  isPhoto: boolean;
  faceUp: boolean;
  matched: boolean;
}

function deal(photos: string[]): Card[] {
  // Prefer the family's own photos, topped up with symbols if there are not
  // yet six. A half-familiar board is still better than none.
  const faces = [...photos.slice(0, PAIRS)];
  const isPhoto = faces.map(() => true);
  for (let i = 0; faces.length < PAIRS; i++) {
    faces.push(FALLBACK[i % FALLBACK.length]);
    isPhoto.push(false);
  }

  const cards: Card[] = [];
  faces.forEach((face, i) => {
    for (let copy = 0; copy < 2; copy++) {
      cards.push({ key: i * 2 + copy, face, isPhoto: isPhoto[i], faceUp: false, matched: false });
    }
  });

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export default function MemoryPairs({
  onExit,
  photos = [],
}: {
  onExit: () => void;
  /** Data URLs from the family's album, if any have been added. */
  photos?: string[];
}) {
  const [cards, setCards] = useState<Card[]>(() => deal(photos));
  const [saying, setSaying] = useState<string | null>(null);
  const busy = useRef(false);
  const lastLine = useRef<string | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const done = cards.length > 0 && cards.every((c) => c.matched);

  const flip = (key: number) => {
    if (busy.current) return;
    const card = cards.find((c) => c.key === key);
    if (!card || card.faceUp || card.matched) return;

    const turned = cards.map((c) => (c.key === key ? { ...c, faceUp: true } : c));
    const open = turned.filter((c) => c.faceUp && !c.matched);
    setCards(turned);
    if (open.length < 2) return;

    busy.current = true;
    if (open[0].face === open[1].face) {
      const line = delightLine(lastLine.current);
      lastLine.current = line;
      setSaying(line);
      later(() => {
        setCards((cs) => cs.map((c) => (c.faceUp ? { ...c, matched: true } : c)));
        setSaying(null);
        busy.current = false;
      }, 620);
    } else {
      // No comment, no sound, no counter. It simply turns back over — the
      // absence of a reaction is what keeps this from being a test.
      later(() => {
        setCards((cs) => cs.map((c) => (c.matched ? c : { ...c, faceUp: false })));
        busy.current = false;
      }, 1050);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#16281E] flex flex-col items-center justify-center p-4">
      <p className="text-[#8FD5A8] text-sm font-light tracking-widest mb-4 select-none">
        {done ? 'all found' : 'find the pairs'}
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" style={{ width: 'min(92vw, 460px)' }}>
        {cards.map((card) => {
          const showing = card.faceUp || card.matched;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => flip(card.key)}
              aria-label={showing ? 'Turned over' : 'Face down card'}
              className="rounded-2xl transition-all duration-300 active:scale-95 overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: '1',
                background: showing ? '#F4F1EA' : '#264A34',
                border: `2px solid ${card.matched ? '#8FD5A8' : 'rgba(143,213,168,0.25)'}`,
                opacity: card.matched ? 0.75 : 1,
              }}
            >
              {showing ? (
                card.isPhoto ? (
                  <img
                    src={card.face}
                    alt=""
                    // contain, not cover. Cover crops to a square and scales
                    // to fill, which turns any face in a photo into a
                    // close-up pressed against the frame — a bushbaby at
                    // maximum eye, in the case that found this. The album
                    // shows these whole; the game should not zoom them.
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-4xl">{card.face}</span>
                )
              ) : (
                <span className="text-2xl opacity-30" aria-hidden="true">🌿</span>
              )}
            </button>
          );
        })}
      </div>

      {done ? (
        <button
          type="button"
          onClick={() => setCards(deal(photos))}
          className="mt-5 px-6 py-3 rounded-2xl bg-[#264A34] border border-[#8FD5A8]/40 text-[#D6F0DF] text-sm font-bold active:scale-95"
        >
          <Hattie size={22} pose="reading" className="inline-block align-middle mr-1.5" /> Shall we do another?
        </button>
      ) : (
        saying && (
          <div className="mt-5 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#264A34] border border-[#8FD5A8]/40">
            <Hattie size={34} pose="reading" />
            <span className="text-[#D6F0DF] text-sm">{saying}</span>
          </div>
        )
      )}

      <SensoryExit onExit={onExit} tint="rgba(143,213,168," />
    </div>
  );
}
