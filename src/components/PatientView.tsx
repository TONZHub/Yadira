// The patient's whole screen — the companion, the help button, camp, the
// calming rooms, and the chat input.
// ------------------------------------------------------------------
// The most important surface in the product, and until now it lived in the
// middle of a 4,900-line component that automated review would not open. If
// any file in this repo deserves to be read closely, it is this one.
//
// Nothing changed on the way out; the props are exactly what the JSX already
// closed over.

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Check, Clock, Heart, HeartHandshake, Music2, Phone, Send,
  Volume2, VolumeX,
} from 'lucide-react';
import type { Message, Memory, CustomFAQ, RoutineItem } from '../types';
import type { SoundscapeTheme, SoundscapeHandle } from '../lib/soundscapes';
import { VoiceInput } from './VoiceInput';
import { MediaUpload } from './MediaUpload';
import { EmotionBadge } from './EmotionBadge';
import DigestibleMessage from './DigestibleMessage';

export interface PatientViewProps {
  chatMessages: Message[];
  memories: Memory[];
  faqs: CustomFAQ[];
  routine: RoutineItem[];
  patientName: string;
  caregiverName: string;
  patientMode: 'lucid' | 'vivid';
  representedPersona: string;
  /** Preview inside the caregiver hub — a few controls behave differently. */
  isCaregiverPreview: boolean;
  /** False when this session is in no care circle, so the help button must
      not promise that anybody has been told. */
  helpReachesCaregiver: boolean;
  caregiverAlert: { active: boolean; at: number };
  handlePatientAlert: () => void;
  userInput: string;
  setUserInput: (s: string) => void;
  handleSendMessage: (text: string, emotion?: Message['emotion'], mediaInsight?: any) => void;
  isTyping: boolean;
  messageLogRef: React.RefObject<HTMLDivElement | null>;
  mountIdsRef: React.MutableRefObject<Set<string>>;
  scrollLogToBottom: () => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (b: boolean) => void;
  soundFeedback: boolean;
  setSoundFeedback: (b: boolean) => void;
  isSpeaking: boolean;
  speakText: (text: string) => void;
  speakTextDirect: (text: string) => void;
  stopSpeaking: () => void;
  playSoundCue: (type: 'chime' | 'pop') => void;
  playMemorySoundscape: (theme: SoundscapeTheme) => SoundscapeHandle | null;
  getThemeGradient: (theme: string) => string;
  toggleRoutine: (id: string) => void;
  setIsCallActive: (b: boolean) => void;
  setIsAlbumOpen: (b: boolean) => void;
  addPhotoToGallery: (dataUrl: string, insight: any, addedBy: 'patient' | 'caregiver') => void;
}

const PatientView: React.FC<PatientViewProps> = (props) => {
  const {
    chatMessages, memories, faqs, routine, patientName, caregiverName, patientMode,
    representedPersona, isCaregiverPreview, helpReachesCaregiver, caregiverAlert,
    handlePatientAlert, userInput, setUserInput, handleSendMessage, isTyping,
    messageLogRef, mountIdsRef, scrollLogToBottom, voiceEnabled, setVoiceEnabled,
    soundFeedback, setSoundFeedback, isSpeaking, speakText, speakTextDirect, stopSpeaking,
    playSoundCue, playMemorySoundscape, getThemeGradient, toggleRoutine,
    setIsCallActive, setIsAlbumOpen, addPhotoToGallery,
  } = props;
  return (
    <motion.div
      key="patient-view"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1"
    >
  
      {/* Left Column: Yadira Core Conversation Window */}
      <div className={`lg:col-span-7 flex flex-col bg-white rounded-3xl border shadow-sm overflow-hidden min-h-[550px] lg:min-h-[650px] transition-all duration-500 ${
        patientMode === 'vivid' ? 'border-rose-200 ring-2 ring-rose-500/5' : 'border-[#E3DFC2]'
      }`}>
    
        {/* Active Yadira Header — extra top padding so the avatar and
            its pulsing halo sit clear of the card's clipped top edge */}
        <div className={`border-b px-6 pt-7 pb-4 flex items-center justify-between transition-all duration-500 ${
          patientMode === 'vivid' ? 'bg-[#FCF6F6] border-rose-100' : 'bg-[#FAF9F5] border-[#E3DFC2]'
        }`}>
          <div className="flex items-center space-x-4">
            <div className="relative">
              {/* Gentle pulsating visual heartbeat matching respiration rate */}
              <span className={`absolute inset-0 rounded-full opacity-20 animate-ping transition-all duration-500 ${
                patientMode === 'vivid' ? 'bg-rose-500' : 'bg-[#5C8D71]'
              }`}></span>
              <div className={`w-14 h-14 rounded-full bg-gradient-to-tr flex items-center justify-center text-white border-2 border-white shadow-sm relative transition-all duration-500 ${
                patientMode === 'vivid' 
                  ? 'from-rose-400 to-pink-500' 
                  : 'from-[#5C8D71] to-[#92B4A1]'
              }`}>
                <HeartHandshake className="w-7 h-7" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#2C2C2A] leading-tight">
                  {patientMode === 'vivid' ? representedPersona : 'Yadira'}
                </h2>
                {isCaregiverPreview && (
                  <span className="inline-flex items-center rounded-full border border-[#E3DFC2] bg-[#F7F3EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7E7D76]">
                    Preview
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold flex items-center transition-all duration-500 ${
                patientMode === 'vivid' ? 'text-rose-500' : 'text-[#5C8D71]'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 animate-pulse transition-all duration-500 ${
                  patientMode === 'vivid' ? 'bg-rose-500' : 'bg-[#5C8D71]'
                }`}></span>
                {patientMode === 'vivid' ? 'Right here with you' : 'Sitting right here with you'}
              </p>
            </div>
          </div>

          {/* Accessibility Audio Settings */}
          <div className="flex items-center space-x-2">
            {/* Stop talking — appears only while Yadira is speaking.
                Big, labeled, and instant: "quiet, please" should never
                require hunting for a mute setting. */}
            <AnimatePresence>
              {isSpeaking && (
                <motion.button
                  key="stop-speaking"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  id="btn-stop-speaking"
                  onClick={() => { stopSpeaking(); if (soundFeedback) playSoundCue('pop'); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#C4877B] bg-[#FBF1EE] text-[#9C4A38] font-bold text-sm hover:bg-[#F6E3DE] transition-all active:scale-95"
                  title="Stop Yadira's voice right now"
                >
                  <VolumeX className="w-5 h-5" />
                  Stop talking
                </motion.button>
              )}
            </AnimatePresence>
            <button
              id="toggle-voice"
              onClick={() => { setVoiceEnabled(!voiceEnabled); playSoundCue('pop'); }}
              className={`p-3 rounded-xl border transition-all ${
                voiceEnabled 
                  ? 'bg-[#E8F1EB] text-[#3A5D45] border-[#CEDFCF]' 
                  : 'bg-[#F2EFE9] text-[#7E7D76] border-[#D8D5C4]'
              }`}
              title={voiceEnabled ? "Mute Yadira's Voice" : "Enable Yadira's Voice"}
            >
              {voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button
              id="toggle-chime"
              onClick={() => { setSoundFeedback(!soundFeedback); playSoundCue('pop'); }}
              className={`p-3 rounded-xl border transition-all ${
                soundFeedback 
                  ? 'bg-[#E8F1EB] text-[#3A5D45] border-[#CEDFCF]' 
                  : 'bg-[#F2EFE9] text-[#7E7D76] border-[#D8D5C4]'
              }`}
              title={soundFeedback ? "Mute sound triggers" : "Enable sound triggers"}
            >
              <Music2 className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Subtitle / Big Screen Text Display */}
        <div className="bg-[#FAF9F5] border-b border-[#E3DFC2] px-6 py-2 text-center text-xs text-[#8A8981] font-medium tracking-wide">
          CLINICAL ACCESSIBILITY STANDARD: SENSORY CONTRAST & SLOW DIALOGUE REASSURANCE
        </div>

        {/* Message Log */}
        <div ref={messageLogRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FCFAF5]">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' ? (
                // Model replies land one thought per bubble, revealed at
                // a human pace — a paragraph is a wall of text to a
                // dementia patient; a sentence is a moment.
                <DigestibleMessage
                  text={msg.text}
                  animate={!mountIdsRef.current?.has(msg.id)}
                  bubbleClassName="rounded-2xl p-5 shadow-xs transition-all bg-white text-[#2C2C2A] border border-[#E4E0C4] rounded-tl-none font-medium"
                  textClassName="text-lg md:text-xl leading-relaxed tracking-wide font-sans"
                  onChunkRevealed={scrollLogToBottom}
                  extras={
                    msg.mediaInsight ? (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">Photo:</span> {msg.mediaInsight.description}
                        </p>
                        <div className="mt-1">
                          <EmotionBadge emotion={msg.mediaInsight.emotion} />
                        </div>
                      </div>
                    ) : undefined
                  }
                  footer={
                    <div className="flex items-center justify-between mt-3 text-xs text-[#8A8981]">
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => speakText(msg.text)}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-[#F5F3EC] hover:bg-[#EAE8DD] rounded-md transition-all text-[#3A5D45]"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="font-semibold text-xs">Read to me</span>
                      </button>
                    </div>
                  }
                />
              ) : (
                <div className="max-w-[85%] rounded-2xl p-5 shadow-xs transition-all bg-[#E3EFE7] text-[#25422F] border border-[#CEDFCE] rounded-tr-none">
                  {/* Huge easy-to-read text size for dementia patients */}
                  <p className="text-lg md:text-xl leading-relaxed tracking-wide font-sans">
                    {msg.text}
                  </p>

                  {msg.emotion && (
                    <div className="mt-2">
                      <EmotionBadge
                        emotion={msg.emotion.emotion}
                        confidence={msg.emotion.confidence}
                        source={msg.emotion.source}
                        tone={msg.emotion.tone}
                      />
                    </div>
                  )}

                  {msg.mediaInsight && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Photo:</span> {msg.mediaInsight.description}
                      </p>
                      <div className="mt-1">
                        <EmotionBadge emotion={msg.mediaInsight.emotion} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 text-xs text-[#8A8981]">
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E4E0C4] rounded-2xl rounded-tl-none p-5 shadow-xs">
                <div className="flex items-center space-x-2 text-[#5C8D71]">
                  <span className="text-sm font-semibold tracking-wide animate-pulse">
                    {patientMode === 'vivid' ? `${representedPersona} is thinking gently...` : 'Yadira is thinking gently...'}
                  </span>
                  <div className="flex space-x-1">
                    <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2.5 h-2.5 bg-[#5C8D71] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            </div>
          )}
      
        </div>

        {/* Pre-configured Helpful Anxious Cues */}
        <div className="bg-[#FAF9F5] border-t border-[#E3DFC2] p-4 flex flex-wrap gap-2.5">
          <span className="text-xs text-[#7E7D76] w-full font-bold uppercase tracking-wider mb-1 px-1">
            Tap to ask {patientMode === 'vivid' ? representedPersona : 'Yadira'}:
          </span>
          {faqs.map((faq) => (
            <button
              key={faq.id}
              id={`patient-faq-${faq.id}`}
              onClick={() => handleSendMessage(faq.question)}
              disabled={isTyping}
              className="px-4 py-2.5 bg-white border border-[#E3DFC2] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#EAE8DD] hover:border-[#C4C09E] transition-all duration-200 active:scale-95 text-left max-w-full truncate shadow-xs"
            >
              {faq.question}
            </button>
          ))}
          <button
            onClick={() => handleSendMessage("Tell me a comforting story.")}
            disabled={isTyping}
            className="px-4 py-2.5 bg-white border border-[#E3DFC2] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#EAE8DD] hover:border-[#C4C09E] transition-all duration-200 shadow-xs"
          >
            📖 Tell me a story
          </button>
          {/* Always visible — a feature that appears and disappears is
              confusing for the patient and invisible in demos. The
              album itself handles the empty state warmly. */}
          <button
            id="btn-open-album"
            onClick={() => {
              setIsAlbumOpen(true);
              if (soundFeedback) playSoundCue('pop');
            }}
            className="px-4 py-2.5 bg-[#F2FAF4] border border-[#CEDFCF] text-sm font-bold text-[#3A5D45] rounded-xl hover:bg-[#E4F0E7] hover:border-[#9DBFA8] transition-all duration-200 shadow-xs"
          >
            📷 Look at our photos
          </button>
          <button
            onClick={() => handleSendMessage("Help me feel calm, I am a bit anxious.")}
            disabled={isTyping}
            className="px-4 py-2.5 bg-[#FFF2F2] border border-[#FFD9D9] text-sm font-bold text-red-700 rounded-xl hover:bg-red-100 transition-all duration-200 shadow-xs"
          >
            ❤️ Help me feel calm
          </button>

          {/* The help button — always visible, full width, one tap
              reaches a real human. Confirmation state stays until the
              caregiver acknowledges from the Hub.

              Deliberately NOT disabled once raised. Someone frightened
              presses again because they are not sure it worked, and a
              button that refuses to respond is the cruellest possible
              answer to that. It stays pressable, and every press is
              met with reassurance — the caregiver's phone is not rung
              again, but the person in the room is always answered. */}
          <button
            id="btn-alert-caregiver"
            onClick={handlePatientAlert}
            className={`w-full mt-1 px-4 py-3.5 rounded-2xl text-base font-extrabold transition-all duration-200 active:scale-[0.98] shadow-xs border-2 flex items-center justify-center gap-2.5 ${
              caregiverAlert.active
                ? 'bg-[#F2FAF4] border-[#CEDFCF] text-[#3A5D45]'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            {caregiverAlert.active ? (
              <>
                <Check className="w-5 h-5" />
                {helpReachesCaregiver
                  ? `${caregiverName || 'Your caregiver'} has been told — they're coming`
                  : "I'm right here with you"}
              </>
            ) : (
              <>
                <HeartHandshake className="w-5 h-5" />
                I need {caregiverName || 'my caregiver'} — please come
              </>
            )}
          </button>
        </div>

        {/* Patient Chat Input */}
        <div className="p-4 bg-white border-t border-[#E3DFC2] flex flex-col gap-3">
          {/* Voice and Media Controls */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <VoiceInput
                onTranscript={(text, emotion) => handleSendMessage(text, emotion)}
                disabled={isTyping}
                isPremium={true}
              />
            </div>
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <MediaUpload
                onMediaAnalyzed={(insight, photoDataUrl) => {
                  // Keep the photo — it goes into the family's album
                  // instead of vanishing after analysis.
                  if (photoDataUrl) addPhotoToGallery(photoDataUrl, insight, 'patient');
                  const msg = `I see something interesting!`;
                  handleSendMessage(msg, undefined, insight);
                }}
                disabled={isTyping}
                isPremium={true}
              />
            </div>
          </div>

          {/* Text Input */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(userInput)}
              placeholder={`Type here to talk to ${patientMode === 'vivid' ? representedPersona : 'Yadira'}, ${patientName || 'dear'}...`}
              disabled={isTyping}
              className="flex-1 px-5 py-4 border border-[#C4C09E] rounded-2xl focus:outline-hidden focus:ring-3 focus:ring-[#5C8D71] focus:border-transparent text-lg md:text-xl font-medium bg-[#FCFAF5] shadow-inner"
              id="patient-chat-input"
            />
            <button
              id="btn-call-mode"
              onClick={() => {
                setIsCallActive(true);
                playSoundCue('chime');
              }}
              className="w-full sm:w-auto p-4 rounded-2xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center sm:min-w-[60px] bg-blue-600 hover:bg-blue-700 text-white"
              title="Start a hands-free Call Mode session"
            >
              <Phone className="w-7 h-7" />
            </button>
            <button
              id="btn-send-message"
              onClick={() => handleSendMessage(userInput)}
              disabled={isTyping || !userInput.trim()}
              className="w-full sm:w-auto p-4 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center sm:min-w-[60px]"
            >
              <Send className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Routine Cues & Memory Book */}
      <div className="lg:col-span-5 flex flex-col space-y-8">
    
        {/* Daily Routine / Care Tasks Visual Checklist */}
        <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C2C2A]">Today's Warm Rituals</h3>
            </div>
            <span className="text-xs font-bold text-[#7E7D76] uppercase tracking-wider bg-[#F4F1EA] px-2.5 py-1 rounded-full border border-[#D5D2B3]">
              Today
            </span>
          </div>

          <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
            Checking these off plays comforting sound therapy cues and logs active mental engagement.
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1.5">
            {routine.map((task) => (
              <button
                key={task.id}
                id={`task-item-${task.id}`}
                onClick={() => toggleRoutine(task.id)}
                className={`w-full p-4 rounded-2xl border text-left flex items-start space-x-4 transition-all duration-300 group ${
                  task.completed
                    ? 'bg-[#F2FAF4] border-[#CEDFCF] text-[#4F7359]'
                    : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-white hover:border-[#A6A27B]'
                }`}
              >
                <div className={`mt-0.5 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                  task.completed
                    ? 'bg-[#3A5D45] border-[#3A5D45] text-white scale-105'
                    : 'border-[#A6A27B] bg-white group-hover:border-[#3A5D45]'
                }`}>
                  {task.completed && <Check className="w-5 h-5 stroke-[3px]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-base font-bold ${task.completed ? 'line-through text-[#8A9C8E]' : 'text-[#2C2C2A]'}`}>
                      {task.title}
                    </span>
                    <span className="text-xs font-bold text-[#8A8981] flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {task.time}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 leading-relaxed ${task.completed ? 'text-[#8A9C8E]' : 'text-[#5E5D57]'}`}>
                    {task.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Treasured Memory Album View */}
        <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-[#FDF1F1] text-rose-500">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C2C2A]">Treasured Memory Album</h3>
            </div>
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              {memories.length} Memories
            </span>
          </div>

          <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
            Beautiful historical landmarks and personal history logs designed for comforting reminiscent triggers.
          </p>

          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[350px] pr-1">
            {memories.map((mem) => {
              const grad = getThemeGradient(mem.imageTheme);
              return (
                <div
                  key={mem.id}
                  className="p-5 rounded-2xl bg-[#FCFAF5] border border-[#E3DFC2] flex flex-col shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-white border border-[#D5D2B3] text-[#5C8D71]">
                      🏷️ {mem.relationshipOrEra}
                    </span>
                    <button
                      onClick={() => {
                        // Sound first, words second — the soundscape
                        // (a public-domain melody + ambience matched to
                        // the memory's theme) opens the door, then the
                        // narration walks through it over a quiet bed.
                        const soundscape = playMemorySoundscape(mem.imageTheme);
                        window.setTimeout(() => {
                          soundscape?.duck();
                          // Use speakTextDirect so the narration works from
                          // the caregiver tab regardless of voiceEnabled state.
                          speakTextDirect(`Let me share this memory with you, dear. It is titled: ${mem.title}. ${mem.description}`);
                        }, soundscape ? 2800 : 0);
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1 bg-[#3A5D45] text-white hover:bg-[#2B4633] rounded-lg transition-all text-xs font-semibold shadow-xs"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>Listen to Memory</span>
                    </button>
                  </div>

                  {/* Decorative memory visualization illustration */}
                  <div className={`mt-3 h-14 w-full rounded-lg bg-gradient-to-r ${grad} flex items-center justify-center border text-2xl`}>
                    {mem.imageTheme === 'wedding' && '💍🌹🌸'}
                    {mem.imageTheme === 'family' && '🏡🐾❤️'}
                    {mem.imageTheme === 'nature' && '🌲🏔️☀️'}
                    {mem.imageTheme === 'retro' && '📸⏳👴'}
                    {mem.imageTheme === 'home' && '🛋️☕🍽️'}
                  </div>

                  <h4 className="text-lg font-bold text-[#2C2C2A] mt-3">{mem.title}</h4>
                  <p className="text-sm text-[#5E5D57] leading-relaxed mt-1.5">
                    {mem.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </motion.div>
  );
};

export default PatientView;
