// The caregiver hub's Settings tab — the profile, the help-call number, the
// calming rooms, Caregiver Pro, and the Vivid-mode consent flow.
// ------------------------------------------------------------------
// The largest of the tabs, and the one carrying the most consequential
// controls in the app: the number the help button rings, and the switch that
// gives a synthetic voice to someone's dead spouse. Both were living inside a
// component too big for review tooling to open.
//
// Nothing changed on the way out.

import React from 'react';
import { motion } from 'motion/react';
import { Brain, Heart, Moon, Phone, RefreshCw, Sliders, Sparkles, Sun } from 'lucide-react';
import { PLANS, PRICE_SHORT, PRICE_BOTH, ANNUAL_SAVING, TRIAL_DAYS, TRIAL_LABEL, hasTrial, type Plan } from '../../lib/pricing';
import {
  personaVoiceChoice,
  personaVoiceId,
  isCustomPersonaVoice,
  type PersonaVoiceChoice,
} from '../../lib/voices';
import { CALLE_REGIONS } from '../../server/calleRegions';
import { THEMES } from '../../lib/theme';
import ReferralCard from '../ReferralCard';
import type { CaregiverProfile, CompanionPersonality } from '../../types';

export interface SettingsTabProps {
  profile: CaregiverProfile;
  patientMode: 'lucid' | 'vivid';
  setPatientMode: (m: 'lucid' | 'vivid') => void;
  representedPersona: string;
  setRepresentedPersona: (s: string) => void;
  representedVoiceId: string;
  setRepresentedVoiceId: (s: string) => void;
  setShowCloneVoice: (open: boolean) => void;
  yadiraVoice: 'female' | 'male';
  setYadiraVoice: (v: 'female' | 'male') => void;
  companionPersonality: CompanionPersonality;
  setCompanionPersonality: (p: CompanionPersonality) => void;
  driftEnabled: boolean;
  setDriftEnabled: (b: boolean) => void;
  driftTimeoutSeconds: number;
  setDriftTimeoutSeconds: (n: number) => void;
  dashTheme: string;
  setDashTheme: (t: string) => void;
  darkMode: boolean;
  setDarkMode: (b: boolean) => void;
  setAuroraActive: (b: boolean) => void;
  helpCall: { escalationPhone?: string; region?: string };
  setHelpCall: (next: { escalationPhone?: string; region?: string }) => void;
  helpCallStatus: { status: string; detail: string; at: number } | null;
  sendTestCall: () => void;
  testingCall: boolean;
  isPremium: boolean;
  premium: {
    unlocked: boolean;
    /** Premium via a free trial rather than a paid subscription. */
    trialing?: boolean;
    subscriptionId?: string;
    customerId?: string;
    currentPeriodEnd?: number;
  };
  premiumBusy: boolean;
  startPremiumCheckout: (plan?: Plan) => void;
  openBillingPortal: () => void;
  setPremium: (next: any) => void;
  playSoundCue: (cue: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = (props) => {
  const {
    profile, patientMode, setPatientMode, representedPersona, setRepresentedPersona,
    representedVoiceId, setRepresentedVoiceId, setShowCloneVoice, yadiraVoice, setYadiraVoice,
    companionPersonality, setCompanionPersonality, driftEnabled, setDriftEnabled,
    driftTimeoutSeconds, setDriftTimeoutSeconds, dashTheme, setDashTheme, darkMode, setDarkMode,
    setAuroraActive, helpCall, setHelpCall, helpCallStatus, sendTestCall, testingCall,
    isPremium, premium, premiumBusy, startPremiumCheckout, openBillingPortal, setPremium,
    playSoundCue,
  } = props;
  return (
    <div className="space-y-6">

    {/* Appearance — color-therapy themes + dark mode. Persisted per
        device; recolors the whole dashboard, never the clinical
        vivid-mode cues. */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm">
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-3">
        <h3 className="text-lg font-bold text-[#2C2C2A] flex items-center">
          <Sparkles className="w-5 h-5 text-[#3A5D45] mr-2" />
          Appearance
        </h3>
        <button
          type="button"
          id="btn-dark-mode"
          onClick={() => setDarkMode(!darkMode)}
          aria-pressed={darkMode}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all active:scale-95 ${
            darkMode
              ? 'bg-[#3A5D45] text-white border-[#3A5D45]'
              : 'bg-[#FCFAF5] text-[#5E5D57] border-[#E3DFC2] hover:border-[#CEDFCF]'
          }`}
        >
          {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {darkMode ? 'Dark mode on' : 'Dark mode'}
        </button>
      </div>
      <p className="text-xs text-[#7E7D76] mb-4 leading-relaxed">
        Choose a color that feels right for your family. Some people find green isn't for them —
        these palettes follow color therapy for calm, joy, or warmth. It changes the dashboard only.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {THEMES.map((t) => {
          const active = dashTheme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              id={`btn-theme-${t.id}`}
              onClick={() => { setDashTheme(t.id); playSoundCue('pop'); }}
              aria-pressed={active}
              className={`p-3 rounded-2xl border text-left transition-all duration-200 ${
                active
                  ? 'border-[#3A5D45] ring-2 ring-[#3A5D45]/15 bg-[#F2FAF4] scale-[1.02]'
                  : 'border-[#E3DFC2] bg-[#FCFAF5] hover:bg-[#EAE8DD]'
              }`}
            >
              <span
                className="block w-full h-8 rounded-lg mb-2 border border-black/5"
                style={{ background: t.swatch }}
                aria-hidden="true"
              />
              <span className="text-xs font-bold text-[#2C2C2A] block leading-tight">{t.label}</span>
              <span className="text-[10px] text-[#7E7D76] block mt-0.5 leading-tight">{t.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* Clinical Session Control & Mode Settings */}
    <div className="bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Mode Control (Lucid vs Vivid) */}
      <div className="lg:col-span-6 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#2C2C2A] flex items-center mb-1.5">
            <Sliders className="w-5 h-5 text-[#3A5D45] mr-2" />
            Active Care Mode Control
          </h3>
          <p className="text-xs text-[#7E7D76] mb-4 leading-relaxed">
            Toggle the companion mode in real time. Vivid Mode changes the interface, voice, and prompts to represent the chosen persona.
          </p>
      
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => { setPatientMode('lucid'); playSoundCue('pop'); }}
              className={`flex-1 p-4 rounded-2xl border text-left flex items-start space-x-3 transition-all duration-300 ${
                patientMode === 'lucid'
                  ? 'bg-[#E8F1EB] border-[#3A5D45] text-[#3A5D45] ring-2 ring-[#3A5D45]/10 font-bold scale-[1.02]'
                  : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
              }`}
            >
              <div className="p-2 rounded-xl bg-white text-[#3A5D45] shadow-xs">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm block font-bold">Lucid Mode</span>
                <span className="text-[11px] font-normal leading-tight block mt-0.5 text-[#5E5D57]">
                  Patient is grounded. Yadira acts as a helpful companion.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setPatientMode('vivid'); playSoundCue('chime'); }}
              className={`flex-1 p-4 rounded-2xl border text-left flex items-start space-x-3 transition-all duration-300 ${
                patientMode === 'vivid'
                  ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/10 font-bold scale-[1.02]'
                  : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
              }`}
            >
              <div className="p-2 rounded-xl bg-white text-rose-500 shadow-xs">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm block font-bold">Vivid Mode</span>
                <span className="text-[11px] font-normal leading-tight block mt-0.5 text-[#5E5D57]">
                  Patient is reaching. {representedPersona || 'Beth'} steps forward.
                </span>
              </div>
            </button>
          </div>

          {/* Yadira's personality — Lucid mode temperament. Not
              everyone wants a soothing therapist; some want sunshine,
              a joke, plain talk, or a story. */}
          <div className="mt-4">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
              Yadira's Personality
            </label>
            <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2.5">
              How Yadira carries herself in Lucid Mode. Vivid Mode is unaffected — there she is {representedPersona || 'the loved one'} entirely.
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { key: 'gentle', emoji: '🕊️', label: 'Gentle & soothing', blurb: 'Calm, soft, and reassuring — the classic Yadira.' },
                { key: 'sunny', emoji: '☀️', label: 'Sunny & cheerful', blurb: 'Bright and delighted by little things.' },
                { key: 'playful', emoji: '😄', label: 'Playful & witty', blurb: 'A gentle joke and a chuckle together.' },
                { key: 'practical', emoji: '🧭', label: 'Plain & practical', blurb: 'Direct and steady — no "dear," no fuss.' },
                { key: 'storyteller', emoji: '📖', label: 'Storyteller', blurb: 'Little vivid stories and warm rambles.' },
              ] as const).map((p) => {
                const active = (companionPersonality || 'gentle') === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    id={`btn-personality-${p.key}`}
                    onClick={() => { setCompanionPersonality(p.key); playSoundCue('pop'); }}
                    aria-pressed={active}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                      active
                        ? 'bg-[#E8F1EB] border-[#3A5D45] ring-2 ring-[#3A5D45]/10 scale-[1.01]'
                        : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-[#EAE8DD]'
                    }`}
                  >
                    <span className={`text-xs block font-bold ${active ? 'text-[#3A5D45]' : 'text-[#2C2C2A]'}`}>
                      {p.emoji} {p.label}
                    </span>
                    <span className="text-[10px] leading-tight block mt-0.5 text-[#7E7D76]">
                      {p.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Yadira's voice — hers alone. The persona's voice (Vivid
              mode) is configured separately so the two identities
              never share a sound. */}
          <div className="mt-4">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
              Yadira's Voice
            </label>
            <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2.5">
              The voice Yadira speaks with in Lucid Mode. {representedPersona || 'The loved one'}'s Vivid voice is set separately below.
            </span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'female', label: '🎙️ Female voice', blurb: 'Warm and steady' },
                { key: 'male', label: '🎙️ Male voice', blurb: 'Calm and kind' },
              ] as const).map((v) => {
                const active = (yadiraVoice || 'female') === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    id={`btn-yadira-voice-${v.key}`}
                    onClick={() => { setYadiraVoice(v.key); playSoundCue('pop'); }}
                    aria-pressed={active}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                      active
                        ? 'bg-[#E8F1EB] border-[#3A5D45] ring-2 ring-[#3A5D45]/10 scale-[1.01]'
                        : 'bg-[#FCFAF5] border-[#E3DFC2] hover:bg-[#EAE8DD]'
                    }`}
                  >
                    <span className={`text-xs block font-bold ${active ? 'text-[#3A5D45]' : 'text-[#2C2C2A]'}`}>
                      {v.label}
                    </span>
                    <span className="text-[10px] leading-tight block mt-0.5 text-[#7E7D76]">
                      {v.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Persona & Drift Controls */}
      <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aurora — caregiver trigger */}
        <button
          type="button"
          id="btn-caregiver-aurora"
          onClick={() => setAuroraActive(true)}
          className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50 text-left flex items-start space-x-3 hover:bg-indigo-100 active:scale-[0.98] transition-all duration-300"
        >
          <div className="p-2 rounded-xl bg-white text-indigo-500 shadow-xs shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm block font-bold text-indigo-700">Aurora</span>
            <span className="text-[11px] font-normal leading-tight block mt-0.5 text-indigo-500">
              Opens a soothing aurora screen on both devices. The soft “return” button below ends it.
            </span>
          </div>
        </button>

        {/* Help-button call — the patient presses "I need my
            caregiver" and this number rings. Yadira does NOT phone
            the patient: CALL-E speaks in its own voice, and a
            familiar name in an unfamiliar voice is not the same
            person to someone whose recognition is failing. A
            caregiver knows exactly what the call is, so here it
            costs nothing and gains everything. */}
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 flex flex-col">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A] flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-rose-500" /> Call me when they need me
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                isPremium ? 'bg-[#3A5D45] text-white' : 'bg-[#EAE8DD] text-[#7E7D76]'
              }`}
            >
              {isPremium ? 'Pro' : 'Pro only'}
            </span>
          </span>
          <span className="text-[10px] text-[#5E5D57] leading-tight mt-1 block">
            When {profile.patientName || 'they'} press the help button, Yadira raises the alert here{' '}
            <i>and</i> calls your phone. A banner is easy to miss; a ringing phone is not. The call
            usually takes a minute or two to come through, so the banner is always first.
          </span>
          <label className="sr-only" htmlFor="help-call-phone">
            Your own phone number, in full international form
          </label>
          <input
            id="help-call-phone"
            type="tel"
            inputMode="tel"
            value={helpCall.escalationPhone || ''}
            onChange={(e) => setHelpCall({ ...helpCall, escalationPhone: e.target.value })}
            placeholder="+15551234567"
            className="mt-2.5 w-full text-sm px-3 py-2 rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300/40"
          />
          <span className="text-[10px] text-[#7E7D76] leading-tight mt-1 block">
            <b>Your number, not theirs.</b> Full international form, e.g. +15551234567.
          </span>
          <label className="sr-only" htmlFor="check-in-region">
            Where you are — sets which line the call comes from
          </label>
          <select
            id="check-in-region"
            value={helpCall.region || ''}
            onChange={(e) => setHelpCall({ ...helpCall, region: e.target.value })}
            className="mt-2 w-full text-sm px-3 py-2 rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300/40"
          >
            <option value="">Where are you? (sets the calling line)</option>
            {CALLE_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            id="btn-test-help-call"
            onClick={sendTestCall}
            disabled={testingCall}
            className="mt-2 w-full flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl border-2 border-rose-300 bg-white text-rose-700 disabled:opacity-60 hover:bg-rose-50 transition-colors"
          >
            {testingCall ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {testingCall ? 'Calling you…' : 'Send me a test call'}
          </button>
          <span className="text-[10px] text-[#7E7D76] leading-tight mt-1 block">
            Hear it once now, so you know what it sounds like. The test says plainly that nothing is
            wrong.
          </span>
          <span className="text-[10px] text-[#7E7D76] leading-tight mt-2 block">
            The call says only that {profile.patientName || 'they'} asked for you, and when. It never
            discusses their health, and repeated presses will not ring you over and over.
          </span>
          {/* The number is NOT stable — three test calls came from three
              different area codes. Telling a caregiver to save it as a contact
              was advice that could not work, and worse, advice that would
              leave them believing they were covered. What actually protects
              them is the phone setting, which works whatever number calls. */}
          <div className="mt-2.5 text-[11px] leading-snug rounded-xl px-3 py-2 border border-amber-200 bg-amber-50/60 text-[#5E5D57]">
            <b className="block mb-0.5">The number changes every time — do not rely on saving it.</b>
            Yadira calls from a different number each time, so it cannot be added as a contact. If
            your phone silences or filters unknown callers, turn that off, or a real call at four in
            the morning will never reach you. <span className="block mt-1">iPhone: Settings → Apps →
            Phone → <i>Silence Unknown Callers</i>, off. Android: Phone app → Settings → <i>Caller ID
            &amp; spam</i>, off.</span>
          </div>
          {/* The one setup step nothing else can do for them. A test
              call proves this number rings; it proves nothing about
              the tablet in the other room, which reaches you only if
              it is signed in to this same account. */}
          <div className="mt-2.5 text-[11px] leading-snug rounded-xl px-3 py-2 border border-[#E3DFC2] bg-[#FCFAF5] text-[#5E5D57]">
            <b className="block mb-0.5">
              {profile.patientName || 'Their'} device has to stay signed in to this account.
            </b>
            On their tablet: sign in as <i>you</i>, then press <b>hand over</b> in the header.
            That returns to the role screen with your account still on the device, so when they
            tap <b>I'm a Patient</b> they land inside your circle. Add the <b>padlock</b>
            (Care Lock) as well for a device that stays with them — it hides the caregiver
            controls so a stray touch cannot reach them.
            <span className="block mt-1">
              <b>Do not log out first.</b> Logging out is what disconnects the device — after it,
              the patient button becomes <b>Try the companion</b> — a demo whose help button never
              reaches you.
            </span>
          </div>
          {helpCallStatus && (
            <div
              className={`mt-2.5 text-[11px] leading-snug rounded-xl px-3 py-2 border ${
                helpCallStatus.status === 'placed'
                  ? 'border-[#CEDFCF] bg-[#F2FAF4] text-[#3A5D45]'
                  : helpCallStatus.status === 'failed'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : 'border-[#E3DFC2] bg-[#FCFAF5] text-[#5E5D57]'
              }`}
            >
              <b className="block mb-0.5">
                Last help press ·{' '}
                {new Date(helpCallStatus.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </b>
              {helpCallStatus.detail}
            </div>
          )}
          {!isPremium && (
            <div className="mt-2.5 text-[11px] leading-snug rounded-xl px-3 py-2 border border-[#E3DFC2] bg-[#FCFAF5] text-[#5E5D57]">
              <b className="block mb-0.5">The alert is free. The phone call is Caregiver Pro.</b>
              {profile.patientName || 'Their'} help button still reaches you here the moment it is
              pressed — that never costs anything. Pro (${PRICE_SHORT}) adds the phone ringing too, for the times
              you are not looking at a screen.
            </div>
          )}
        </div>

        {/* Caregiver Pro — the whole companion is free; only the
            caregiver's AI care reports are the paid tier. */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isPremium ? 'border-[#CEDFCF] bg-[#F2FAF4]' : 'border-[#E3DFC2] bg-[#FCFAF5]'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Caregiver Pro
              </span>
              {isPremium ? (
                <span className="text-[10px] text-[#7E7D76] leading-tight mt-1 block">
                  {premium.trialing && (
                    <b className="block text-[#3A5D45] mb-0.5">
                      {TRIAL_LABEL} — Yadira calling you with the week starts when it ends. The
                      weekly email is on already.
                    </b>
                  )}
                  Active — the help button rings your phone, plus unlimited AI care reports
                  (routines &amp; clinical insights) for this caregiver. The companion itself is
                  free for your family, always.
                </span>
              ) : (
                <>
                  {/* The price used to sit on its own next to a generous free
                      tier, which framed Pro as the thing you pay for to stop
                      being limited. It is not — it is the caregiver's half of
                      the product, and a companion that only talks to the
                      patient cannot do any of it. Naming those three things
                      beside the number is the whole argument. */}
                  <span className="text-[10px] text-[#5E5D57] leading-tight mt-1 block font-semibold">
                    A companion keeps them company. Pro keeps you in the loop.
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {[
                      [
                        'The call, not just the banner',
                        `When ${profile.patientName || 'they'} press the help button it rings your actual phone — at four in the morning, from another state, with your screen face-down.`,
                      ],
                      [
                        'Reports from real days',
                        'Routines and clinical insights written from what was actually logged that week — the thing you bring to the neurologist.',
                      ],
                      [
                        'Unlimited Ask Yadira',
                        'Ask about their week, their moods, their sleep, as often as you need. Free includes five messages and one report a week.',
                      ],
                    ].map(([title, body]) => (
                      <li key={title} className="flex gap-1.5 text-[10px] leading-snug text-[#7E7D76]">
                        <span className="text-[#5C8D71] font-bold shrink-0">·</span>
                        <span>
                          <b className="text-[#2C2C2A]">{title}</b> — {body}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span className="text-[10px] text-[#7E7D76] leading-tight mt-1.5 block">
                    Everything {representedPersona || 'your loved one'} touches stays free forever —
                    their natural voice, Call Mode, Session Memory, the calming rooms, the photos.
                    Pro ({PRICE_BOTH}) is the caregiver&rsquo;s side, and it runs on the tablet you
                    already own. Run a care facility?{' '}
                    <a href="mailto:partnerships@yadira.chat" className="underline">
                      partnerships@yadira.chat
                    </a>
                    .
                  </span>
                </>
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isPremium ? 'bg-[#3A5D45] text-white' : 'bg-[#EAE8DD] text-[#7E7D76]'}`}>
              {isPremium ? 'Pro' : 'Free'}
            </span>
          </div>
          {/* Two plans, both shown. A caregiver deciding whether this is worth
              it should not have to click through to Stripe to find out what
              the annual option costs. */}
          {!isPremium ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-toggle-premium"
                  disabled={premiumBusy}
                  onClick={() => startPremiumCheckout('monthly')}
                  title={`Secure checkout via Stripe — ${PLANS.monthly.label}, cancel anytime`}
                  className="py-2.5 px-2 rounded-xl text-xs font-bold bg-[#3A5D45] text-white hover:bg-[#2B4633] shadow-xs transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {premiumBusy ? 'One moment…' : hasTrial() ? 'Start free trial' : PLANS.monthly.label}
                  {hasTrial() && !premiumBusy && (
                    <span className="block text-[9px] font-semibold opacity-80 leading-tight">
                      then {PLANS.monthly.label}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  id="btn-premium-annual"
                  disabled={premiumBusy}
                  onClick={() => startPremiumCheckout('annual')}
                  title={`Secure checkout via Stripe — ${PLANS.annual.label}, cancel anytime`}
                  className="relative py-2.5 px-2 rounded-xl text-xs font-bold bg-white border border-[#3A5D45] text-[#3A5D45] hover:bg-[#F2FAF4] transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {premiumBusy ? 'One moment…' : PLANS.annual.label}
                  <span className="block text-[9px] font-semibold text-[#5C8D71] leading-tight">
                    {PLANS.annual.perMonth}/mo · save {ANNUAL_SAVING}
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-[#7E7D76] text-center leading-snug">
                {hasTrial()
                  ? `Free for ${TRIAL_DAYS} days, then the plan you picked. Card required; cancel any time before it ends and you are not charged.`
                  : 'Secure checkout via Stripe. Cancel anytime.'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              id="btn-toggle-premium"
              disabled={premiumBusy}
              onClick={() => {
                if (premium.customerId) {
                  openBillingPortal();
                } else {
                  // Demo-toggled premium (no Stripe subscription behind it)
                  setPremium({ ...premium, unlocked: false });
                }
              }}
              className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none bg-white border border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]"
              title={
                premium.customerId
                  ? 'Opens Stripe billing portal to manage or cancel'
                  : 'Turn off demo Caregiver Pro'
              }
            >
              {premiumBusy
                ? 'One moment…'
                : premium.customerId
                  ? 'Manage subscription'
                  : 'Turn off Caregiver Pro'}
            </button>
          )}
        </div>

        {/* Persona Configuration */}
        <div className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between space-y-3">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-1">
              Represented Persona & Voice
            </label>
            <span className="text-[10px] text-[#7E7D76] leading-tight block mb-2">
              Configure who Yadira becomes and their voice preset.
            </span>
        
            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-bold text-[#5E5D57] block mb-1">Name:</span>
                <input
                  type="text"
                  value={representedPersona}
                  onChange={(e) => setRepresentedPersona(e.target.value)}
                  placeholder="e.g. Beth, Thomas"
                  className="w-full p-2 bg-white border border-[#C4C09E] rounded-xl text-xs font-bold text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                />
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#5E5D57] block mb-1">Their voice:</span>
                {/* Female, male, or a cloned voice. It used to offer Sarah,
                    Ashley and Dennis — two of which were the same answer under
                    different names, and none of which is a question a
                    caregiver setting up their late wife's voice can answer. */}
                <select
                  value={personaVoiceChoice(representedVoiceId)}
                  onChange={(e) => {
                    const id = personaVoiceId(e.target.value as PersonaVoiceChoice);
                    if (id) setRepresentedVoiceId(id);
                    else setShowCloneVoice(true);
                  }}
                  className="w-full p-2 bg-white border border-[#C4C09E] rounded-xl text-xs font-bold text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
                >
                  <option value="female">Female voice</option>
                  <option value="male">Male voice</option>
                  <option value="custom">Their actual voice (cloned)…</option>
                </select>

                {/* Clone-a-voice helper — always available, so a caregiver can
                    learn how to make a loved one's voice before ever picking custom. */}
                <button
                  type="button"
                  onClick={() => setShowCloneVoice(true)}
                  className="mt-1.5 text-[10px] font-bold text-[#3A5D45] hover:underline"
                >
                  ✨ Clone a loved one's voice — how?
                </button>

                {isCustomPersonaVoice(representedVoiceId) && (
                  <div className="mt-1.5 flex items-center space-x-1">
                    <span className="text-[9px] font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100 font-bold block truncate max-w-full">
                      Custom ID: {representedVoiceId}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCloneVoice(true)}
                      className="text-[9px] text-[#3A5D45] hover:underline font-bold"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Proactive Drift Controls */}
        <div className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#2C2C2A]">
                Proactive Reach
              </span>
              <span className="text-[10px] text-[#7E7D76] leading-tight mt-0.5">
                Reach out during silence.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDriftEnabled(!driftEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition-all ${
                driftEnabled ? 'bg-[#3A5D45]' : 'bg-[#D8D5C4]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${
                driftEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#5E5D57] mb-1">
              <span>Drift Timeout:</span>
              <span className="text-[#3A5D45] font-extrabold">{driftTimeoutSeconds}s</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              disabled={!driftEnabled}
              value={driftTimeoutSeconds}
              onChange={(e) => setDriftTimeoutSeconds(Number(e.target.value))}
              className="w-full accent-[#3A5D45] h-1.5 bg-[#E3DFC2] rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>
      </div>
    </div>

    {/* The referral link. Last, and quiet: a caregiver comes to this tab to
        set the number their loved one's help button rings, not to market for
        us. It renders nothing at all unless there's a real account behind it. */}
    <ReferralCard />

    </div>
  );
};

export default SettingsTab;
