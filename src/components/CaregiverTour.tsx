import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft, ArrowRight, Phone, Lock, Tent, Sparkles, Users } from 'lucide-react';

// The caregiver's first five minutes.
// ------------------------------------------------------------------
// Deliberately CAREGIVER-ONLY. A modal walkthrough placed in front of someone
// with dementia is the opposite of what this app is for — it interrupts,
// demands sequence, and quizzes. App.tsx gates this on the caregiver hub, and
// nothing here should ever be rendered into the patient view.
//
// The steps are ordered by what goes wrong when nobody explains it, not by
// what is most impressive. The two that have actually bitten a real family in
// testing — the escalation number and the padlock handover — come first.

export interface TourStep {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}

/** Per-circle, so a second family on the same browser gets its own tour. */
export function tourSeenKey(circleId: string): string {
  return `yadira_${circleId}_tour_seen`;
}

interface CaregiverTourProps {
  patientName?: string;
  onClose: () => void;
  /** Jump the caregiver to the settings tab, where the phone number lives. */
  onOpenSettings?: () => void;
}

const CaregiverTour: React.FC<CaregiverTourProps> = ({ patientName, onClose, onOpenSettings }) => {
  const them = patientName || 'your loved one';
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      icon: <Phone className="w-5 h-5 text-rose-500" />,
      title: 'Save your phone number first',
      body: (
        <>
          When {them} presses the help button, Yadira raises a banner here <i>and</i> rings your
          phone. The call needs one thing from you: your own number, in{' '}
          <b>Settings → Call me when they need me</b>.
          <span className="block mt-2">
            Send yourself a test call while you are there. It arrives from an unfamiliar number —
            worth saving as a contact now, so it is not silenced at four in the morning.
          </span>
        </>
      ),
    },
    {
      icon: <Lock className="w-5 h-5 text-[#3A5D45]" />,
      title: 'Handing over their tablet',
      body: (
        <>
          On {them}&rsquo;s own device, sign in as <i>you</i> first — your account staying on it is
          the only thing connecting their help button to your phone. Then use <b>hand over</b> in
          the header and let them tap <b>I&rsquo;m a Patient</b>.
          <span className="block mt-2">
            For a tablet that lives with them, add the <b>padlock</b> too: it pins the screen to the
            companion and hides every caregiver control, so a stray touch cannot reach anything.
          </span>
          <span className="block mt-2">
            <b>Never log out on that device.</b> That is the one action that disconnects it — and
            it looks like an ordinary sign-out, which is why it catches people.
          </span>
        </>
      ),
    },
    {
      icon: <Users className="w-5 h-5 text-[#5C8D71]" />,
      title: 'Their profile is the whole thing',
      body: (
        <>
          Everything the companion says comes from what you put in <b>Memories</b> — the dog&rsquo;s
          name, the lake house, how they take their eggs. Add a few real ones and the difference
          is immediate.
          <span className="block mt-2">
            Photos go in the album with AI-written captions you can reword. The companion talks
            about the real ones.
          </span>
        </>
      ),
    },
    {
      icon: <Tent className="w-5 h-5 text-amber-600" />,
      title: 'Camp with Hattie',
      body: (
        <>
          A one-tap daily mood check-in with a pygmy hippo, on {them}&rsquo;s side. The tent in the
          header carries a check once today&rsquo;s visit is done, so nobody has to remember
          whether they went.
          <span className="block mt-2">
            Where they said nothing clear, the record says so. Yadira never guesses a mood.
          </span>
        </>
      ),
    },
    {
      icon: <Sparkles className="w-5 h-5 text-indigo-500" />,
      title: 'Reports come from real days',
      body: (
        <>
          <b>Ask Yadira</b> and the AI care reports read {them}&rsquo;s actual logs. They are worth
          running once a week or so has been recorded — before that there is nothing real for
          them to summarise.
          <span className="block mt-2">
            You can reopen this walkthrough any time from the <b>?</b> in the header.
          </span>
        </>
      ),
    },
  ];

  const last = index === steps.length - 1;
  const step = steps[index];

  // Focus the dialog on open so the keyboard lands somewhere sensible, and
  // let Escape close it — this is an overlay, not a gate.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1);
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, last, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DFC2] shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#F4F1EA] border border-[#E3DFC2]">{step.icon}</div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#7E7D76]">
                Getting started · {index + 1} of {steps.length}
              </p>
              <h3 id="tour-title" className="text-lg font-bold text-[#2C2C2A]">
                {step.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close the walkthrough"
            className="p-2 rounded-xl text-[#A6A27B] hover:text-[#2C2C2A] hover:bg-[#F4F1EA] transition-all shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            className="px-6 py-4 text-sm text-[#5E5D57] leading-relaxed"
          >
            {step.body}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-1">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-[#3A5D45]' : 'w-1.5 bg-[#E3DFC2]'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E3DFC2] text-sm font-semibold text-[#5E5D57] hover:bg-[#F4F1EA]"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {index === 0 && (
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-[#7E7D76] hover:text-[#2C2C2A]"
              >
                Skip
              </button>
            )}
            <button
              onClick={() => {
                if (last) {
                  // Land them where the one unskippable setup step lives,
                  // rather than on a hub they now have to go hunting through.
                  onOpenSettings?.();
                  onClose();
                } else {
                  setIndex((i) => i + 1);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3A5D45] text-white text-sm font-bold hover:bg-[#2B4633] transition-all"
            >
              {last ? 'Take me to Settings' : 'Next'}
              {!last && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CaregiverTour;
