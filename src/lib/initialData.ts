// What a care circle starts with before anyone has written anything.
// ------------------------------------------------------------------
// Module-level seed data, moved out of App.tsx so the component holds
// behaviour rather than fixtures. Note these are the SEEDS, not the sample
// family: a caregiver is asked which they want on first run (see App.tsx), and
// the richer demo content lives in src/lib/demoData.ts.

import type { DailyLog, Memory, CustomFAQ, RoutineItem } from '../types';

export const INITIAL_LOGS: DailyLog[] = [
  { date: '07-02', confusionLevel: 2, mood: 'peaceful', hydrationCups: 6, sleepHours: 7.5, medsTaken: true, notes: 'Eleanor was very engaged in the morning. Had tea and talked about gardening.' },
  { date: '07-03', confusionLevel: 3, mood: 'anxious', hydrationCups: 4, sleepHours: 6.0, medsTaken: true, notes: 'Some sundowning agitation around 5 PM. Calmed down after hearing soft music.' },
  { date: '07-04', confusionLevel: 4, mood: 'restless', hydrationCups: 5, sleepHours: 5.5, medsTaken: true, notes: 'Slightly more confused today, asked for her mother twice. Grounded with old photos.' },
  { date: '07-05', confusionLevel: 2, mood: 'peaceful', hydrationCups: 7, sleepHours: 8.0, medsTaken: true, notes: 'Excellent day. Had family visit. Remained coherent and smiling.' },
  { date: '07-06', confusionLevel: 3, mood: 'sad', hydrationCups: 6, sleepHours: 6.5, medsTaken: true, notes: 'A bit quiet and withdrawn. Listened to old jazz records which cheered her up.' },
  { date: '07-07', confusionLevel: 2, mood: 'peaceful', hydrationCups: 8, sleepHours: 7.5, medsTaken: true, notes: 'Stable. Engaged in puzzle solving.' },
];

export const INITIAL_MEMORIES: Memory[] = [
  {
    id: 'mem-1',
    title: 'Your Wedding with Edward (1974)',
    description: 'You married Edward on a beautiful sunny June day in the rose garden. You wore a white lace dress and danced to "Can\'t Help Falling in Love".',
    relationshipOrEra: 'Edward (Husband)',
    imageTheme: 'wedding'
  },
  {
    id: 'mem-2',
    title: 'Your Dog, Barnaby',
    description: 'Barnaby was a sweet golden retriever who loved running after tennis balls and sleeping right at the foot of your bed. He was your loyal companion.',
    relationshipOrEra: 'Pet',
    imageTheme: 'family'
  },
  {
    id: 'mem-3',
    title: 'Growing up in Lake Tahoe',
    description: 'You spent summers swimming in the crystal blue waters of Lake Tahoe and winters drinking hot cocoa with marshmallow by the stone fireplace.',
    relationshipOrEra: 'Childhood',
    imageTheme: 'nature'
  }
];

export const INITIAL_FAQS: CustomFAQ[] = [
  {
    id: 'faq-1',
    question: 'Where is my family?',
    answer: 'Your son Thomas is currently at work, dear. He loves you very much and is coming over to have dinner with you at 5:30 PM. You are completely safe and warm here.'
  },
  {
    id: 'faq-2',
    question: 'Where am I?',
    answer: 'You are in your beautiful, cozy apartment in Portland. Your favorite green chair is right here, and your favorite tea is brewing. You are safe.'
  }
];

export const DEFAULT_ROUTINE: RoutineItem[] = [
  {
    id: 'rout-1',
    time: '08:30 AM',
    title: 'Morning Sunshine & Warm Tea',
    description: 'Open the blinds for natural morning light to help establish circadian rhythm. Share a warm chamomile tea and a simple, nutritious breakfast.',
    caregiverTips: 'Speak in short, bright sentences. Use a cheerful tone to start the day positively.',
    completed: false
  },
  {
    id: 'rout-2',
    time: '10:00 AM',
    title: 'Memory Album Reminiscence',
    description: 'Flip through the Yadira Memory Book or physical albums. Ask open-ended sensory questions (e.g., "Doesn\'t that lake look beautiful and cool?").',
    caregiverTips: 'Do not test or quiz them ("Do you remember who this is?"). Instead, share the memory directly ("This is you and Edward at Tahoe!").',
    completed: false
  },
  {
    id: 'rout-3',
    time: '12:30 PM',
    title: 'Nourishing Lunch & Hydration Check',
    description: 'Serve a colourful lunch rich in Omega-3s. Fill a clear cup with water and gently encourage drinking.',
    caregiverTips: 'Place the cup directly in their line of sight. Hand-to-hand guidance is helpful if they forget to sip.',
    completed: false
  },
  {
    id: 'rout-4',
    time: '03:00 PM',
    title: 'Gentle Classical Music & Puzzle',
    description: 'Play soft piano or orchestral music (classical baroque or Chopin) while working on a simple tactile puzzle or folding warm linens.',
    caregiverTips: 'Music is incredibly powerful for memory. If they want to hum or move, join in gently.',
    completed: false
  },
  {
    id: 'rout-5',
    time: '06:00 PM',
    title: 'Calming Dinner & Grounding Conversation',
    description: 'Keep the dinner environment quiet and dim to counter any evening sundowning confusion. Reassure them that they are safe at home.',
    caregiverTips: 'Avoid noisy television or clattering dishes. Speak slowly and maintain reassuring eye contact.',
    completed: false
  }
];
