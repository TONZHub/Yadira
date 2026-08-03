// CloneVoiceModal — guides a caregiver through cloning a loved one's voice on
// Inworld and pasting the resulting Voice ID for Vivid mode.
// ------------------------------------------------------------------
// This replaces a bare window.prompt() that asked for a "Custom Inworld Voice
// ID" with no explanation of where such an ID comes from. The reader is an
// exhausted family member — the steps are plain, honest, and gentle about the
// weight of hearing a lost voice again.

import React, { useState } from 'react';
import { isCustomPersonaVoice } from '../lib/voices';
import { X, ExternalLink, Check, Info } from 'lucide-react';

interface CloneVoiceModalProps {
  /** Current voice id, prefilled into the input so "Edit" round-trips. */
  currentValue: string;
  onClose: () => void;
  onSave: (voiceId: string) => void;
}

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDF3ED] text-sm font-bold text-[#3A5D45]">
      {n}
    </span>
    <div>
      <p className="text-sm font-bold text-[#2C2C2A]">{title}</p>
      <p className="text-[13px] leading-relaxed text-[#5E5D57]">{children}</p>
    </div>
  </li>
);

export const CloneVoiceModal: React.FC<CloneVoiceModalProps> = ({ currentValue, onClose, onSave }) => {
  const preset = !isCustomPersonaVoice(currentValue);
  const [value, setValue] = useState(preset ? '' : currentValue);
  const trimmed = value.trim();

  const save = () => {
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl border border-[#E3DFC2] shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create a custom voice with Inworld"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFECDD]">
          <h2 className="text-lg font-bold text-[#2C2C2A]">Give Yadira their voice</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-[#7E7D76] hover:bg-[#F4F1EA] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-sm leading-relaxed text-[#5E5D57]">
            In Vivid mode, Yadira can speak in the voice of the person your loved one is reaching
            for. You create that voice once on <b className="text-[#2C2C2A]">Inworld</b> — their free
            voice-cloning tool — then paste its ID here.
          </p>

          <ol className="mt-4 space-y-3.5">
            <Step n={1} title="Open Inworld's voice tool">
              Go to{' '}
              <a
                href="https://studio.inworld.ai/portal/tts/voices"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-[#3A5D45] underline"
              >
                Inworld TTS Studio <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and sign in (a free account is fine). Choose <b>Create Voice</b> → <b>Clone a voice</b>.
            </Step>
            <Step n={2} title="Upload a clear recording">
              A calm 30–60 second clip of them speaking — a voicemail, an old video, a birthday
              message — is plenty. Clear speech and little background noise clone best. Give it a
              name you'll recognize.
            </Step>
            <Step n={3} title="Copy the Voice ID">
              Once the voice is ready, open it and copy its <b>Voice ID</b> — a short code that looks
              like <code className="rounded bg-[#F4F1EA] px-1 py-0.5 text-[11px] text-[#3A5D45]">zippy-pecan-9151__design-voice-…</code>.
              That code <i>is</i> the voice.
            </Step>
            <Step n={4} title="Paste it below">
              Paste the Voice ID here and save. Yadira will speak in that voice whenever Vivid mode
              is on for this person.
            </Step>
          </ol>

          <div className="mt-4 flex gap-2 rounded-xl border border-[#DCEAF2] bg-[#F2F8FB] p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3A6B8A]" />
            <p className="text-[12px] leading-relaxed text-[#41627A]">
              Only clone a voice you have the right to use, and use it with care — hearing a loved
              one again can move a person deeply. You remain responsible for how the voice is used.
              The recording lives on Inworld; Yadira only ever stores the ID.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#5E5D57]">
              Inworld Voice ID
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
              placeholder="paste the Voice ID here"
              autoFocus
              className="w-full rounded-xl border border-[#C4C09E] bg-[#FCFAF5] px-3 py-2.5 font-mono text-sm text-[#2C2C2A] focus:outline-none focus:ring-2 focus:ring-[#3A5D45]"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EFECDD] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#7E7D76] hover:bg-[#F4F1EA] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!trimmed}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3A5D45] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#2B4633] disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            Save voice
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloneVoiceModal;
