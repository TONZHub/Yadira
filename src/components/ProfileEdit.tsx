// Editing the clinical profile after setup.
// ------------------------------------------------------------------
// These seven fields could be typed exactly once, in the Family Setup wizard,
// and never again. App.tsx has had setters for every one of them the whole
// time — setPatientHobbies, setPatientStage, setPatientWakeTime and the rest —
// wired to nothing. The only route back was Family Setup, which does not edit
// a profile: it REPLACES the care circle, taking the memories, the FAQs, the
// care log, the routine and the conversation with it. So correcting a hobby,
// or a stage that had progressed, or a name spelled wrong on the first night,
// cost a family everything they had written down.
//
// This edits the profile and nothing else. It touches no memories, no logs, no
// routine, and none of the settings that live in the Settings tab — mode,
// persona and voices have a home there already, and a field with two editors
// is a field with two answers.

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, UserRoundCheck } from 'lucide-react';
import type { CaregiverProfile } from '../types';

/** Only the fields this dialog owns — everything else is left untouched. */
export type ProfileEdits = Pick<
  CaregiverProfile,
  | 'patientName'
  | 'patientStage'
  | 'patientHobbies'
  | 'patientWakeTime'
  | 'patientSleepTime'
  | 'caregiverName'
  | 'caregiverRelationship'
>;

interface ProfileEditProps {
  profile: CaregiverProfile;
  onSave: (edits: ProfileEdits) => void;
  onClose: () => void;
}

export default function ProfileEdit({ profile, onSave, onClose }: ProfileEditProps) {
  const [patientName, setPatientName] = useState(profile.patientName);
  const [patientStage, setPatientStage] = useState(profile.patientStage);
  const [patientHobbies, setPatientHobbies] = useState(profile.patientHobbies);
  const [patientWakeTime, setPatientWakeTime] = useState(profile.patientWakeTime);
  const [patientSleepTime, setPatientSleepTime] = useState(profile.patientSleepTime);
  const [caregiverName, setCaregiverName] = useState(profile.caregiverName);
  const [caregiverRelationship, setCaregiverRelationship] = useState(profile.caregiverRelationship);

  // A name is the one field the companion says out loud. Blanking it would
  // have Yadira greeting an empty space, so it is the only one required.
  const canSave = patientName.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave({
      patientName: patientName.trim(),
      patientStage,
      // Everything else falls back to what was already there rather than to a
      // placeholder: an emptied field means "I didn't mean to change this",
      // and inventing hobbies for someone's mother is worse than keeping the
      // ones they gave us.
      patientHobbies: patientHobbies.trim() || profile.patientHobbies,
      patientWakeTime: patientWakeTime || profile.patientWakeTime,
      patientSleepTime: patientSleepTime || profile.patientSleepTime,
      caregiverName: caregiverName.trim() || profile.caregiverName,
      caregiverRelationship: caregiverRelationship.trim() || profile.caregiverRelationship,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DFC2] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Edit clinical profile"
      >
        <div className="sticky top-0 bg-white border-b border-[#E3DFC2] px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h3 className="text-xl font-bold text-[#2C2C2A]">Edit Profile</h3>
            <p className="text-xs text-[#7E7D76] mt-0.5">
              Memories, the care log and the routine are not touched.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A6A27B] hover:text-[#2C2C2A] hover:bg-[#F4F1EA] transition-all"
            aria-label="Close without saving"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Their name *">
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Margaret"
                className={inputCls}
              />
            </Field>
            <Field label="Stage">
              <select
                value={patientStage}
                onChange={(e) => setPatientStage(e.target.value)}
                className={inputCls}
              >
                <option>Mild</option>
                <option>Moderate</option>
                <option>Advanced</option>
              </select>
            </Field>
          </div>

          <Field label="Hobbies & interests">
            <input
              value={patientHobbies}
              onChange={(e) => setPatientHobbies(e.target.value)}
              placeholder="e.g. Knitting, big band music, crossword puzzles"
              className={inputCls}
            />
            <p className="text-[11px] text-[#7E7D76] leading-snug mt-1">
              What Yadira reaches for in conversation, and what the daily routine is built
              around. Worth updating as things change — a hobby that used to settle them can
              stop landing.
            </p>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Usually wakes">
              <input
                type="time"
                value={patientWakeTime}
                onChange={(e) => setPatientWakeTime(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Usually sleeps">
              <input
                type="time"
                value={patientSleepTime}
                onChange={(e) => setPatientSleepTime(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Your name">
              <input
                value={caregiverName}
                onChange={(e) => setCaregiverName(e.target.value)}
                placeholder="e.g. David"
                className={inputCls}
              />
            </Field>
            <Field label="Your relationship to them">
              <input
                value={caregiverRelationship}
                onChange={(e) => setCaregiverRelationship(e.target.value)}
                placeholder="e.g. Son, Daughter, Spouse"
                className={inputCls}
              />
            </Field>
          </div>

          <p className="text-[11px] leading-snug text-[#5E5D57] bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl px-3 py-2">
            Looking for Lucid/Vivid mode, the represented loved one, or their voice? Those live
            in <b>Settings</b>.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-white border border-[#E3DFC2] text-[#5E5D57] rounded-2xl font-bold hover:bg-[#F4F1EA] transition-all active:scale-98"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="flex-1 py-3.5 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <UserRoundCheck className="w-5 h-5" /> Save Changes
            </button>
          </div>
          {!canSave && (
            <p className="text-center text-xs text-[#A6A27B]">
              A name is needed — it is what Yadira calls them.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const inputCls =
  'w-full p-3 bg-white border border-[#C4C09E] rounded-xl text-sm text-[#2C2C2A] focus:outline-hidden focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#5E5D57] mb-1">{label}</label>
      {children}
    </div>
  );
}
