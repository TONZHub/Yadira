// The caregiver hub's Memories tab.
// ------------------------------------------------------------------
// Lifted out of App.tsx, which was a single 4,750-line component — large
// enough that automated review skipped it entirely ("code objects exceed size
// limit"). The largest file in the repo was getting no review at all, which is
// the opposite of where scrutiny belongs.
//
// Nothing here changed on the way out. Props are the exact values the JSX was
// already closing over, made explicit so the seam is visible and typed.

import React from 'react';
import { motion } from 'motion/react';
import {
  BookOpen, Plus, Trash2, Trash, Send, Sparkles, RefreshCw, Image as ImageIcon,
  Camera, Mic, Heart, Loader, HeartHandshake, MessageSquare,
} from 'lucide-react';
import type { Memory, GalleryPhoto, PersonaFile } from '../../types';
import { DEFAULT_PERSONA_FILE } from '../../types';
import { MediaUpload } from '../MediaUpload';

export interface MemoriesTabProps {
  memories: Memory[];
  handleDeleteMemory: (id: string) => void;
  setShowMemModal: (open: boolean) => void;
  patientName: string;
  representedPersona: string;
  handleSendRedirection: () => void;
  handleStartFreshSession: () => void;
  personaFile: PersonaFile;
  setPersonaFile: (next: PersonaFile) => void;
  galleryPhotos: GalleryPhoto[];
  setGalleryPhotos: (next: GalleryPhoto[]) => void;
  addPhotoToGallery: (dataUrl: string, insight: any, addedBy: 'patient' | 'caregiver') => void;
  editingPhotoId: string | null;
  setEditingPhotoId: (id: string | null) => void;
  editingCaption: string;
  setEditingCaption: (caption: string) => void;
  saveCaption: (id: string) => void;
  getThemeGradient: (theme: Memory['imageTheme']) => string;
  playSoundCue: (cue: string) => void;
  toastSuccess: (title: string, message?: string) => void;
}

const MemoriesTab: React.FC<MemoriesTabProps> = (props) => {
  const {
    memories, handleDeleteMemory, setShowMemModal, patientName, representedPersona,
    handleSendRedirection, handleStartFreshSession, personaFile, setPersonaFile,
    galleryPhotos, setGalleryPhotos, addPhotoToGallery, editingPhotoId, setEditingPhotoId,
    editingCaption, setEditingCaption, saveCaption, getThemeGradient, playSoundCue,
    toastSuccess,
  } = props;
  return (
    <div className="space-y-6">

    {/* Nurse Redirection Portal — moved to Memories: caregivers redirect
        by recalling grounding memories, so it lives here */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-500">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#2C2C2A] break-words">Nurse Redirection Portal (Real-time Intervention)</h3>
        </div>
        <span className="self-start sm:self-auto text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
          Live Dispatch
        </span>
      </div>

      <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
        If the patient becomes restless, wanders, or repeatedly asks to leave their room, select a clinical redirection cue below. Yadira will dynamically translate it into comforting, relationship-anchored guidance from {representedPersona || 'Beth'} and speak it to the patient.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <button
          type="button"
          onClick={() => handleSendRedirection("Patient is asking to go home")}
          className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
        >
          🏡 Trigger Home Grounding
          <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
            "Patient wants to leave room to go home."
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSendRedirection(`Patient is looking for their spouse (${representedPersona})`)}
          className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
        >
          🍳 Trigger Kitchen Redirect
          <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
            "Patient is looking for their spouse."
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSendRedirection("Patient is highly anxious and restless")}
          className="p-4 bg-[#FCFAF5] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-[#E3DFC2] rounded-2xl text-left text-xs font-bold transition-all active:scale-95 shadow-xs"
        >
          ❤️ Trigger Calming Grounding
          <span className="block font-normal mt-1 text-[#7E7D76] hover:text-rose-600">
            "Patient is showing high sundowning agitation."
          </span>
        </button>
      </div>

      {/* Custom Redirection Text input */}
      <div className="nurse-dispatch-row flex flex-col sm:flex-row gap-3 border-t border-[#E3DFC2] pt-4">
        <input
          type="text"
          id="nurse-custom-note"
          placeholder="Type custom nurse observation / redirection instruction here (e.g. Eleanor wants to go bake a pie)..."
          className="w-full min-w-0 flex-1 p-3.5 border border-[#C4C09E] rounded-xl text-sm bg-[#FCFAF5] focus:ring-2 focus:ring-[#3A5D45] text-[#2C2C2A] font-medium"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              if (input.value.trim()) {
                handleSendRedirection(input.value);
                input.value = '';
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            const input = document.getElementById('nurse-custom-note') as HTMLInputElement;
            if (input && input.value.trim()) {
              handleSendRedirection(input.value);
              input.value = '';
            }
          }}
          className="w-full sm:w-auto px-4 sm:px-6 py-3.5 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95"
        >
          Dispatch Cue
        </button>
      </div>
    </div>

    {/* Persona File — session-to-session memory (the continuity architecture) */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#2C2C2A] break-words">
            Persona File — What {representedPersona || 'Beth'} Remembers
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleStartFreshSession}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
            title="End the current conversation and start a new session — the persona file carries over"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Start Fresh Session</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Clear everything ${representedPersona || 'Beth'} remembers between sessions? This cannot be undone.`)) {
                setPersonaFile(DEFAULT_PERSONA_FILE);
              }
            }}
            className="p-2 bg-[#FCFAF5] border border-[#E3DFC2] text-[#A6A27B] hover:text-red-500 rounded-xl transition-all"
            title="Clear persona file"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
        Written automatically after every conversation and read before the next one. A disconnection is a pause, not a forgetting —
        ask {representedPersona || 'Beth'} if she remembers. She does.
      </p>

      {personaFile.moments.length === 0 && !personaFile.lastSummary ? (
        <div className="p-8 text-center bg-[#FCFAF5] border border-dashed border-[#C4C09E] rounded-2xl">
          <MessageSquare className="w-10 h-10 text-[#C4C09E] mx-auto mb-2" />
          <p className="text-base font-bold text-[#5E5D57]">Nothing remembered yet</p>
          <p className="text-xs text-[#8A8981] mt-1 max-w-sm mx-auto">
            The persona file grows as {patientName || 'the patient'} talks with {representedPersona || 'Beth'}. After a few messages, what they share appears here — and {representedPersona || 'Beth'} carries it into every future session.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            {personaFile.lastSummary && (
              <div className="p-4 bg-[#F5FAF6] border border-[#CEDFCF] rounded-2xl">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3A5D45]">Last Visit</h4>
                <p className="text-sm text-[#2C2C2A] leading-relaxed mt-1.5 font-medium">{personaFile.lastSummary}</p>
                {personaFile.lastSessionAt && (
                  <p className="text-[10px] text-[#8A8981] mt-2">
                    Updated {new Date(personaFile.lastSessionAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}

            {personaFile.recurringThreads.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
                  They keep coming back to:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {personaFile.recurringThreads.map((thread, i) => (
                    <span key={i} className="px-3 py-1.5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-full text-xs font-bold text-[#3A5D45]">
                      {thread}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {personaFile.threadToPickUp && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-600">
                  {representedPersona || 'Beth'} will open the next session with:
                </h4>
                <p className="text-sm text-rose-900 italic leading-relaxed mt-1.5">
                  "{personaFile.threadToPickUp}"
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
              Moments they shared ({personaFile.moments.length}):
            </h4>
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {personaFile.moments.map((moment) => (
                <div key={moment.id} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl flex items-start justify-between space-x-3">
                  <p className="text-sm text-[#2C2C2A] leading-relaxed flex-1">{moment.summary}</p>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                      {moment.emotionalTone}
                    </span>
                    <span className="text-[10px] text-[#8A8981] mt-1">{moment.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Memory Bank Editor */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-[#2C2C2A]">Memory Bank Editor</h3>
        </div>
        <button
          id="btn-open-memory-modal"
          onClick={() => { playSoundCue('pop'); setShowMemModal(true); }}
          className="flex items-center space-x-1 px-4 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Memory Card</span>
        </button>
      </div>

      <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
        Store and organize treasured moments. These memories directly ground Yadira AI's dialogue, helping to guide the patient through periods of forgetfulness.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {memories.map((mem) => {
          const grad = getThemeGradient(mem.imageTheme);
          return (
            <div key={mem.id} className="p-5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between shadow-xs relative">
              <button
                onClick={() => handleDeleteMemory(mem.id)}
                className="absolute top-4 right-4 text-[#A6A27B] hover:text-red-500 transition-all p-1"
                title="Delete memory"
              >
                <Trash className="w-4 h-4" />
              </button>
              <div>
                <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                  {mem.relationshipOrEra}
                </span>
                <div className={`mt-3 h-14 w-full rounded-lg bg-gradient-to-r ${grad} flex items-center justify-center border text-2xl`}>
                  {mem.imageTheme === 'wedding' && '💍🌹🌸'}
                  {mem.imageTheme === 'family' && '🏡🐾❤️'}
                  {mem.imageTheme === 'nature' && '🌲🏔️☀️'}
                  {mem.imageTheme === 'retro' && '📸⏳👴'}
                  {mem.imageTheme === 'home' && '🛋️☕🍽️'}
                </div>
                <h4 className="text-lg font-bold text-[#2C2C2A] mt-3">{mem.title}</h4>
                <p className="text-xs text-[#5E5D57] mt-2 leading-relaxed">{mem.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Photo Album Manager — the real photos behind "let's look at old photos" */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-[#2C2C2A]">Photo Album</h3>
          <span className="text-xs font-bold text-[#5C8D71] uppercase tracking-wider bg-[#F2FAF4] px-2.5 py-1 rounded-full border border-[#CEDFCF]">
            {galleryPhotos.length} Photo{galleryPhotos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <MediaUpload
          label="Add photo"
          onMediaAnalyzed={(insight, photoDataUrl) => {
            if (photoDataUrl) {
              addPhotoToGallery(photoDataUrl, insight, 'caregiver');
              toastSuccess('Photo added', 'It is now in the family album. Tap its caption to reword it.');
            }
          }}
          // The caregiver is the only person who can fix a bad
          // model name, so they are the one who gets told what broke.
          showTechnicalErrors
          isPremium={true}
        />
      </div>

      <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
        Real family photos, kept in one place. {patientName || 'The patient'} can open this album
        from the companion screen ("📷 Look at our photos"), and Yadira uses the captions to talk
        about the pictures. Photos shared during chat land here automatically. Tap a caption to
        reword it — names and places help Yadira the most.
      </p>

      {galleryPhotos.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#FCFAF5] border border-dashed border-[#D5D2B3] text-center text-sm text-[#7E7D76]">
          No photos yet. Add the first one above — a wedding photo, the old house, a beloved pet.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...galleryPhotos].reverse().map((photo) => (
            <div key={photo.id} className="rounded-2xl bg-[#FCFAF5] border border-[#E3DFC2] overflow-hidden shadow-xs relative flex flex-col">
              <button
                onClick={() => setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-[#A6A27B] hover:text-red-500 transition-all shadow-xs"
                title="Remove photo from album"
              >
                <Trash className="w-4 h-4" />
              </button>
              <img src={photo.dataUrl} alt={photo.caption} className="w-full h-32 object-cover" />
              <div className="p-3 flex-1 flex flex-col gap-1.5">
                {editingPhotoId === photo.id ? (
                  <textarea
                    autoFocus
                    rows={3}
                    value={editingCaption}
                    onChange={(e) => setEditingCaption(e.target.value)}
                    onBlur={saveCaption}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveCaption(); }
                      if (e.key === 'Escape') setEditingPhotoId(null);
                    }}
                    className="w-full p-2 bg-white border border-[#C4C09E] rounded-lg text-xs leading-relaxed"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingPhotoId(photo.id); setEditingCaption(photo.caption); }}
                    className="text-left text-xs text-[#5E5D57] leading-relaxed hover:text-[#2C2C2A] line-clamp-3"
                    title="Tap to edit caption"
                  >
                    {photo.caption}
                  </button>
                )}
                <span className="mt-auto text-[10px] font-bold uppercase tracking-wider text-[#A6A27B]">
                  {photo.addedBy === 'patient' ? 'Shared in chat' : 'Added by caregiver'} · {new Date(photo.addedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    </div>
  );
};

export default MemoriesTab;
