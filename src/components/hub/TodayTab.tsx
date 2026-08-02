// The caregiver hub's Today tab — logs, trends, and the daily record.
// ------------------------------------------------------------------
// Lifted out of App.tsx for the same reason as its siblings: the component was
// large enough that automated review skipped it outright, so the repo's
// biggest file was its least examined. Nothing changed on the way out; the
// props are exactly what the JSX already closed over.

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, AlertTriangle, HelpCircle, Plus, PlusCircle, RefreshCw, Shield,
  Sparkles, Tent, Trash, TrendingUp,
} from 'lucide-react';
import type { DailyLog, CustomFAQ, MoodCheckIn } from '../../types';

export interface TodayTabProps {
  logs: DailyLog[];
  faqs: CustomFAQ[];
  patientName: string;
  todaysCheckIn: MoodCheckIn | null | undefined;
  moodLabel: Record<string, string> | ((mood: string) => string);
  aiInsights: string;
  loadingInsights: boolean;
  handleGenerateInsights: () => void;
  handleAddLog: (e: React.FormEvent) => void;
  handleDeleteLog: (date: string) => void;
  handleAddFaq: (e: React.FormEvent) => void;
  handleDeleteFaq: (id: string) => void;
  logConfusion: number;
  setLogConfusion: (n: number) => void;
  logMood: DailyLog['mood'];
  setLogMood: (m: DailyLog['mood']) => void;
  logHydration: number;
  setLogHydration: (n: number) => void;
  logSleep: number;
  setLogSleep: (n: number) => void;
  logMeds: boolean;
  setLogMeds: (b: boolean) => void;
  logNotes: string;
  setLogNotes: (s: string) => void;
  newFaqQuest: string;
  setNewFaqQuest: (s: string) => void;
  newFaqAns: string;
  setNewFaqAns: (s: string) => void;
}

const TodayTab: React.FC<TodayTabProps> = (props) => {
  const {
    logs, faqs, patientName, todaysCheckIn, moodLabel, aiInsights, loadingInsights,
    handleGenerateInsights, handleAddLog, handleDeleteLog, handleAddFaq, handleDeleteFaq,
    logConfusion, setLogConfusion, logMood, setLogMood, logHydration, setLogHydration,
    logSleep, setLogSleep, logMeds, setLogMeds, logNotes, setLogNotes,
    newFaqQuest, setNewFaqQuest, newFaqAns, setNewFaqAns,
  } = props;
  return (
    <div className="space-y-6">

    {/* Grid 1: Symptom Logger & Custom FAQ Override */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
  
      {/* Daily Symptom & Care Logger */}
      <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col">
        <div className="flex items-center space-x-2.5 mb-5">
          <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-[#2C2C2A]">Today's Daily Care Log</h3>
        </div>

        {todaysCheckIn && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#CEDFCF] bg-[#F2FAF4] px-3.5 py-2.5">
            <Tent className="w-4 h-4 text-[#3A5D45] shrink-0 mt-0.5" />
            <p className="text-xs text-[#3A5D45] leading-snug">
              <b>{patientName || 'The patient'}</b> checked in at camp today feeling <b>{moodLabel(todaysCheckIn.mood)}</b>. We’ve pre-filled the mood below — adjust it if your own read differs.
            </p>
          </div>
        )}

        <form onSubmit={handleAddLog} className="space-y-4 flex-1 flex flex-col">
      
          {/* Confusion Level Tracker */}
          <div>
            <label className="block text-sm font-bold text-[#5E5D57] mb-2">
              Cognitive Confusion Level: <span className="text-[#3A5D45] font-extrabold">{logConfusion} / 5</span>
            </label>
            <div className="flex space-x-2.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setLogConfusion(val)}
                  className={`flex-1 py-2.5 rounded-xl border text-base font-bold transition-all ${
                    logConfusion === val
                      ? 'bg-[#3A5D45] text-white border-[#3A5D45]'
                      : 'bg-[#FCFAF5] border-[#E3DFC2] text-[#5E5D57] hover:bg-[#EAE8DD]'
                  }`}
                >
                  {val === 1 ? 'Clear' : val === 5 ? 'Severe' : val}
                </button>
              ))}
            </div>
          </div>

          {/* Mood Selector */}
          <div>
            <label className="block text-sm font-bold text-[#5E5D57] mb-1.5">Primary Patient Mood</label>
            <select
              value={logMood}
              onChange={(e: any) => setLogMood(e.target.value)}
              className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
            >
              <option value="peaceful">Peaceful & Pleasant</option>
              <option value="anxious">Anxious & Agitated</option>
              <option value="restless">Restless & Wandering</option>
              <option value="sad">Sad & Quiet</option>
            </select>
          </div>

          {/* Quick Stats: Hydration & Sleep */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#5E5D57] mb-1">Hydration (Cups)</label>
              <input
                type="number"
                min="0"
                max="20"
                value={logHydration}
                onChange={(e) => setLogHydration(Number(e.target.value))}
                className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#5E5D57] mb-1">Sleep (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={logSleep}
                onChange={(e) => setLogSleep(Number(e.target.value))}
                className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm font-bold text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
              />
            </div>
          </div>

          {/* Medication Compliance Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#2C2C2A]">Vitamins & Meds Taken</span>
              <span className="text-xs text-[#7E7D76]">Confirm morning/evening compliance</span>
            </div>
            <button
              type="button"
              onClick={() => setLogMeds(!logMeds)}
              className={`w-14 h-8 rounded-full p-1 transition-all ${
                logMeds ? 'bg-[#3A5D45]' : 'bg-[#D8D5C4]'
              }`}
            >
              <div className={`w-6 h-6 rounded-full bg-white transition-all transform ${
                logMeds ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Clinical Notes */}
          <div>
            <label className="block text-sm font-bold text-[#5E5D57] mb-1">Caregiver Observation Notes</label>
            <textarea
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Detail behavior triggers, foods eaten, activities enjoyed..."
              rows={3}
              className="w-full p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-sm text-[#2C2C2A] focus:ring-2 focus:ring-[#3A5D45] focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-2xl font-bold shadow-md transition-all active:scale-98 flex items-center justify-center space-x-2"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Log Daily Observations</span>
          </button>
        </form>
      </div>

      {/* FAQ override settings (Patient Reassurance Mapping) */}
      <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-[#FDF1F1] text-rose-500">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C2C2A]">Empathetic Reassurance Settings</h3>
            </div>
            <span className="text-xs font-bold text-[#7E7D76] uppercase tracking-wider bg-[#F4F1EA] px-2.5 py-1 rounded-full border border-[#D5D2B3]">
              FAQ Override
            </span>
          </div>

          <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
            Dementia patients often repeat anxious questions. Yadira overrides generic AI responses with these tailored, personal reassurances whenever the questions are asked.
          </p>

          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-4 bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl relative">
                <button
                  onClick={() => handleDeleteFaq(faq.id)}
                  className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-all"
                  title="Remove reassurance override"
                >
                  <Trash className="w-4 h-4" />
                </button>
                <p className="text-xs font-bold uppercase tracking-wider text-[#5C8D71]">Anxious Question:</p>
                <p className="text-sm font-bold text-[#2C2C2A] mt-0.5">"{faq.question}"</p>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mt-2.5">Yadira Reassuring Answer:</p>
                <p className="text-sm text-[#5E5D57] italic mt-0.5 leading-relaxed">"{faq.answer}"</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleAddFaq} className="border-t border-[#E3DFC2] pt-4 mt-4 space-y-3">
          <p className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider">Add New Patient FAQ Reassurance:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={newFaqQuest}
              onChange={(e) => setNewFaqQuest(e.target.value)}
              placeholder="Patient repeats (e.g. Where is my key?)"
              className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
            />
            <input
              type="text"
              value={newFaqAns}
              onChange={(e) => setNewFaqAns(e.target.value)}
              placeholder="Reassuring answer (e.g. Your keys are safe with Thomas.)"
              className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#2C2C2A] focus:ring-1 focus:ring-[#3A5D45]"
            />
          </div>
          <button
            type="submit"
            disabled={!newFaqQuest || !newFaqAns}
            className="w-full py-3 bg-[#3A5D45] hover:bg-[#2B4633] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Activate Reassurance Override</span>
          </button>
        </form>
      </div>

    </div>

    {/* Grid 2: SVG Trend Visualizations & AI Clinical Summarizer */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
  
      {/* Custom SVG Interactive Dashboard Charts */}
      <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C2C2A]">Patient Symptom Trends</h3>
            </div>
            <span className="text-xs font-bold text-[#3A5D45] bg-[#E8F1EB] px-2 py-1 rounded-full">
              7-Day Diagnostics
            </span>
          </div>

          <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
            Custom clinical charts mapping cognitive confusion and physical rest patterns to detect Sundowning symptoms.
          </p>

          {/* interactive SVG chart rendering */}
          <div className="w-full bg-[#FCFAF5] border border-[#E3DFC2] rounded-2xl p-4 flex flex-col space-y-4">
            <div className="text-xs font-bold text-[#5E5D57] uppercase tracking-wider flex items-center justify-between">
              <span>Cognitive Confusion Progress</span>
              <span className="text-[#3A5D45]">1 (Clear) - 5 (Confused)</span>
            </div>
        
            {/* Simple custom SVG chart */}
            <div className="relative h-44 w-full">
              <svg className="h-full w-full" viewBox="0 0 300 120">
                {/* Grid Lines */}
                <line x1="0" y1="20" x2="300" y2="20" stroke="#EAE6DA" strokeDasharray="3,3" />
                <line x1="0" y1="55" x2="300" y2="55" stroke="#EAE6DA" strokeDasharray="3,3" />
                <line x1="0" y1="90" x2="300" y2="90" stroke="#EAE6DA" strokeDasharray="3,3" />
            
                {/* Graph Path */}
                <path
                  d={logs.map((l, idx) => {
                    const x = (idx / (logs.length - 1)) * 280 + 10;
                    // map confusion 1-5 to y coordinate 100 to 10
                    const y = 110 - ((l.confusionLevel - 1) / 4) * 90;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#3A5D45"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
            
                {/* Graph Dots */}
                {logs.map((l, idx) => {
                  const x = (idx / (logs.length - 1)) * 280 + 10;
                  const y = 110 - ((l.confusionLevel - 1) / 4) * 90;
                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle cx={x} cy={y} r="6" fill="#3A5D45" stroke="white" strokeWidth="2" />
                      <text x={x} y={y - 12} fontSize="8" fontWeight="bold" fill="#3A5D45" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1">
                        {l.confusionLevel}
                      </text>
                    </g>
                  );
                })}

                {/* Labels */}
                {logs.map((l, idx) => {
                  const x = (idx / (logs.length - 1)) * 280 + 10;
                  return (
                    <text key={idx} x={x} y="115" fontSize="8" fontWeight="bold" fill="#8A8981" textAnchor="middle">
                      {l.date}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Sleep & Hydration correlations */}
            <div className="grid grid-cols-2 gap-4 border-t border-[#E3DFC2] pt-3 text-xs text-[#5E5D57]">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#3A5D45]"></div>
                <span>Average Rest: <strong>{ (logs.reduce((sum, l) => sum + l.sleepHours, 0) / logs.length).toFixed(1) } hrs</strong></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Avg Hydration: <strong>{ (logs.reduce((sum, l) => sum + l.hydrationCups, 0) / logs.length).toFixed(1) } cups</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Log list with delete controls */}
        <div className="border-t border-[#E3DFC2] pt-4 mt-4">
          <p className="text-xs font-bold text-[#2C2C2A] uppercase tracking-wider mb-2">Past Logs History:</p>
          <div className="max-h-[140px] overflow-y-auto pr-1 space-y-2 text-xs">
            {logs.slice().reverse().map((log) => (
              <div key={log.date} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#2C2C2A] mr-2">{log.date}</span>
                  <span className="text-[#3A5D45] font-bold mr-2">Confusion: {log.confusionLevel}/5</span>
                  <span className="text-blue-600 font-bold mr-2">Hydration: {log.hydrationCups}c</span>
                  <span className="text-purple-600 font-bold mr-2">Sleep: {log.sleepHours}h</span>
                  <span className="text-[#7E7D76] block mt-1">"{log.notes}"</span>
                </div>
                <button
                  onClick={() => handleDeleteLog(log.date)}
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Delete log"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI-Powered Clinical Advisor Insights Panel */}
      <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-[#E3DFC2] shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-[#E8F1EB] text-[#3A5D45]">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C2C2A]">AI Clinical insights Advisor</h3>
            </div>
            <button
              onClick={handleGenerateInsights}
              disabled={loadingInsights}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#3A5D45] hover:bg-[#2B4633] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingInsights ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{aiInsights ? 'Refresh Analysis' : 'Synthesize Insights'}</span>
            </button>
          </div>

          <p className="text-sm text-[#7E7D76] mb-5 leading-relaxed">
            Utilizes clinical prompts to aggregate daily patient activity, mood logs, and medication compliance trends into structured geriatric advice.
          </p>

          <AnimatePresence mode="wait">
            {loadingInsights ? (
              <motion.div
                key="loading-insights"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 text-center space-y-4"
              >
                <RefreshCw className="w-10 h-10 animate-spin text-[#3A5D45] mx-auto" />
                <div>
                  <p className="text-base font-bold text-[#2C2C2A]">Analyzing Care Trends...</p>
                  <p className="text-xs text-[#7E7D76] mt-1">Cross-referencing sleep logs, mood triggers, and confusion coordinates.</p>
                </div>
              </motion.div>
            ) : aiInsights ? (
              <motion.div
                key="results-insights"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Clinical Overview */}
                <div className="p-4 bg-[#F5FAF6] border border-[#CEDFCF] rounded-2xl">
                  <h4 className="text-sm font-bold text-[#3A5D45] uppercase tracking-wider flex items-center">
                    🩺 Clinical Diagnostic Summary
                  </h4>
                  <p className="text-sm text-[#2C2C2A] leading-relaxed mt-2 font-medium">
                    {aiInsights.clinicalSummary}
                  </p>
                </div>

                {/* Critical Warnings */}
                {aiInsights.criticalAlerts && aiInsights.criticalAlerts.length > 0 && (
                  <div className="p-4 bg-[#FFF2F2] border border-[#FFD9D9] rounded-2xl">
                    <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1.5" /> Critical Observation Triggers
                    </h4>
                    <ul className="list-disc list-inside text-xs font-bold text-red-900 mt-2 space-y-1">
                      {aiInsights.criticalAlerts.map((alert, i) => (
                        <li key={i}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actionable Clinical Tips */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#5E5D57] mb-2">
                    Actionable Caregiver Interventions:
                  </h4>
                  <div className="space-y-2">
                    {aiInsights.actionableTips.map((tip, i) => (
                      <div key={i} className="p-3 bg-[#FCFAF5] border border-[#E3DFC2] rounded-xl text-xs text-[#5E5D57] leading-relaxed flex items-start space-x-2">
                        <span className="font-extrabold text-[#3A5D45] mt-0.5">{i+1}.</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-insights"
                className="p-8 text-center bg-[#FCFAF5] border border-dashed border-[#C4C09E] rounded-2xl"
              >
                <Activity className="w-10 h-10 text-[#C4C09E] mx-auto mb-2" />
                <p className="text-base font-bold text-[#5E5D57]">No Insights Generated</p>
                <p className="text-xs text-[#8A8981] mt-1 max-w-xs mx-auto">
                  Click "Synthesize Insights" above to securely call Gemini and analyze your clinical patient logs.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    
        <div className="bg-[#FAF9F5] border-t border-[#E3DFC2] p-3 rounded-xl text-[11px] text-[#8A8981] italic mt-4 text-center">
          Note: Yadira clinical outputs are generative and optimized to support familial caregiver comfort; they are not substitutes for certified geriatric practitioner prescriptions.
        </div>
      </div>

    </div>

    </div>
  );
};

export default TodayTab;
