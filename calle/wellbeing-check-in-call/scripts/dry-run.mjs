#!/usr/bin/env node
// Exercise the whole check-in pipeline with no network call and no phone
// ringing: goal construction, readout parsing, and the escalation decision.
//
//   node scripts/dry-run.mjs
//   node scripts/dry-run.mjs --say "I fell this morning"
//
// The contribution guidelines require runnable code to ship a no-call path.
// This is also the honest way to demo the skill: every transcript below is
// fictional, and the sample number is a reserved fictional one.

const args = process.argv.slice(2);
const sayIndex = args.indexOf('--say');
const customUtterance = sayIndex !== -1 ? args[sayIndex + 1] : null;

const RECIPIENT = 'Eleanor';
const TO_PHONE = '+15551234567'; // reserved fictional range

const maskPhone = (v) => (v.length < 8 ? '***' : `${v.slice(0, 5)}***${v.slice(-4)}`);
const isE164 = (v) => /^\+[1-9]\d{7,14}$/.test(v);

const MOOD_CUES = [
  { mood: 'sad', patterns: [/\bmiss(ing)?\b/i, /\blonely\b/i, /\balone\b/i, /\bsad\b/i] },
  { mood: 'anxious', patterns: [/\bworri(ed|es)\b/i, /\bafraid\b/i, /\bscared\b/i, /\bfrightened\b/i] },
  { mood: 'restless', patterns: [/\brestless\b/i, /\bcan'?t settle\b/i, /\bagitated\b/i] },
  { mood: 'peaceful', patterns: [/\b(well|fine|good|lovely|happy|content|peaceful)\b/i, /\ball right\b/i] },
];

const DISTRESS = [
  { pattern: /\b(help me|i need help|please help)\b/i, reason: 'asked for help' },
  { pattern: /\bi (fell|have fallen|had a fall)\b/i, reason: 'reported a fall' },
  { pattern: /\bi can'?t (breathe|get up|stand)\b/i, reason: 'reported being unable to breathe or get up' },
  { pattern: /\bi('m| am) (frightened|terrified|scared)\b/i, reason: 'said they were frightened' },
  { pattern: /\bi don'?t know where i am\b/i, reason: 'did not know where they were' },
];

const SCENARIOS = customUtterance
  ? [{ label: 'custom', utterance: customUtterance }]
  : [
      { label: 'a settled day', utterance: 'Oh, I am quite well thank you. Just having my tea.' },
      { label: 'a worried day', utterance: 'I am fine, just a bit frightened about tonight.' },
      { label: 'needs a human now', utterance: 'Please help me, I fell this morning.' },
      { label: 'nothing clear said', utterance: 'The postman came at ten.' },
    ];

// Step 1 — validate. Never inferred, only checked.
if (!isE164(TO_PHONE)) {
  console.error('destination must be E.164');
  process.exit(1);
}

// Step 2 — the plan/inspect gate, simulated.
const plan = { planId: 'plan_dryrun_0001', confirmToken: 'token_dryrun_0001', targets: [TO_PHONE] };
const inspectionOk = plan.targets.length === 1 && plan.targets[0] === TO_PHONE;
console.log(`plan ${plan.planId} → ${maskPhone(TO_PHONE)}`);
console.log(`inspect: ${inspectionOk ? 'targets the configured number — safe to run' : 'MISMATCH — refusing'}\n`);
if (!inspectionOk) process.exit(1);

// Step 3 — readouts for each scenario.
for (const { label, utterance } of SCENARIOS) {
  // Only the recipient's words are interpreted; the agent's turns are ignored.
  const activity = [
    { speaker: 'agent', text: `Hello ${RECIPIENT}, it is Yadira. How are you feeling today?` },
    { speaker: 'recipient', text: utterance },
  ];
  const said = activity.filter((a) => a.speaker === 'recipient').map((a) => a.text).join(' ');

  const distress = DISTRESS.filter(({ pattern }) => pattern.test(said)).map(({ reason }) => reason);
  const mood = MOOD_CUES.find(({ patterns }) => patterns.some((p) => p.test(said)))?.mood ?? null;
  const needsHuman = distress.length > 0;

  console.log(`── ${label}`);
  console.log(`   they said: "${utterance}"`);
  console.log(
    '   readout:  ' +
      JSON.stringify({ answered: true, phone: maskPhone(TO_PHONE), mood, distress_reasons: distress, needs_human: needsHuman })
  );
  console.log(`   action:   ${needsHuman ? 'ESCALATE to the escalation contact now' : 'record only'}\n`);
}

console.log('No call was placed. No number was dialled. Every transcript above is fictional.');
