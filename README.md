# Yadira

**The companion who remembers, for the people who forget.**

Yadira is an AI companion for people living with dementia, paired with a working
toolkit for the people caring for them. The companion talks, listens, remembers,
and reassures — by text or in a natural voice, with the same patience at 3am as
at noon. The caregiver side turns those conversations into something usable:
mood check-ins, routines, clinical insight reports, and a co-pilot grounded in
their loved one's actual records.

Built for the XPRIZE "Build with Gemini" challenge, as part of Project Anamnesia.

> Yadira is a comfort and caregiving companion — **not a medical device**. It
> does not diagnose or treat any condition. In an emergency, always contact
> emergency services.

---

## The idea

When someone with dementia reaches for a person from their past, correcting them
causes pain; meeting them where they are brings peace. That principle —
validation therapy — has guided memory care for decades, and everything here is
built on it.

Most tools in this space address **loneliness**. Yadira addresses **the loss of
being known**: the particular cruelty that the person who knew about the blue
Ford, the eggs soft in the middle, the sixty years, is the person who is gone.

## Two modes

| Mode | Who the companion is |
| --- | --- |
| **Lucid** | Yadira, openly herself — a warm companion with a caregiver-chosen temperament |
| **Vivid** | The loved one the patient keeps reaching for, in their voice, with the caregiver's explicit consent |

Vivid mode is discovered rather than configured: when the patient mentions
someone repeatedly, the caregiver is asked whether to invite them in.

**Vivid never goes down the phone line.** On a tablet the caregiver consented and
is nearby. A synthetic voice of a dead spouse telephoning someone sitting alone
is a different act.

---

## What's built

### For the person living with dementia

- **The companion** — validation-first conversation that never corrects, never
  quizzes, and answers the hundredth repetition as warmly as the first. Replies
  are capped short, because a wall of text overwhelms.
- **Session memory** — a persona file written after every conversation and read
  before the next. A disconnection is a pause, not a forgetting.
- **Natural voice** — Inworld TTS, with a per-circle daily budget; past it the
  device voice takes over, so the companion never goes silent.
- **Camp with Hattie** — a daily one-tap mood check-in with a pygmy hippo.
  (Hattie → *hippo*campus, the brain's memory-keeper and the first region
  dementia takes.) The tent in the header carries a check once today's visit is
  done, so nobody has to remember whether they went.
- **Call Mode** — a familiar in-app phone-call experience: it rings, they answer,
  they just talk.
- **Calming rooms** — Aurora (free, synced across both devices) plus rainy
  window, autumn leaves, and forest canopy.
- **Photo album & memories** — real family photos with AI-written captions the
  caregiver can edit.
- **Help button** — one tap that reaches a real human. See below.
- **A companion that hears *how* it was said** — emotion used to be read from
  the transcript, which meant "I'm fine" read as fine whether it was said
  brightly, flatly, or through tears. Gemini takes the audio itself, so the
  same call that transcribes also reports pace, steadiness, breath and effort.
  The companion is told which signal it got and to trust the voice over the
  wording when they disagree. See `src/server/vocalTone.ts`.
- **Dictation that stays silent when they did** — Whisper-family models invent
  fluent text over silence rather than returning nothing, so a fumbled tap
  became words the patient never said. Recordings are checked for duration and
  microphone level before being sent, and known artifacts are dropped on the way
  back. See `src/server/transcription.ts`.
- **Accessibility throughout** — large-text mode applied before first paint,
  colour themes, dark mode, reduced-motion support, and a lockable full-screen
  patient view.

### For the caregiver

- **The hub** — clinical profile, daily logs, mood and confusion trends.
- **Ask Yadira** — a co-pilot answering questions about sleep, moods, and hard
  moments, grounded in the patient's own records.
- **AI routines & insight reports** — generated from real logs.
- **Hattie's Lodge** — the caregiver's own space, with Hattie in her own voice.
  Ask Yadira stays on patient care; the Lodge is where caregiver wellbeing goes.
- **Live alerts** — the help button and the lucidity tripwire, polled across
  devices.
- **Voice cloning** — a guided flow for giving a represented persona the real
  person's voice.
- **A first run that asks** — a new caregiver chooses between a sample family
  and setting up their own, then gets a short walkthrough. Neither is ever
  shown on the patient's screen or under Care Lock; the walkthrough reopens
  from the **?** in the header.

### The lucidity tripwire

In late-stage dementia a person sometimes surfaces into a sudden window of
clarity: they know a loved one has died, or what the companion is, or what is
happening to them.

Two things must be true in that moment. The companion must **never** argue them
back into a comforting unreality, and the family must find out immediately.
`src/server/lucidity.ts` is the tripwire for both — and the guidance it injects
deliberately outranks the stay-in-character rules, with the anti-jailbreak net
bypassed so an honest reply cannot be swapped for a warm deflection.

### The help button rings a phone

An in-app alert is only as good as somebody looking at a screen — and the
moments the button exists for are exactly the moments that assumption fails.

```
patient presses help
  → banner raised on the caregiver's screen     (every family, free)
  → CALL-E rings the caregiver's phone          (Caregiver Pro)
  → readout: reached / voicemail / no answer, and can they get there
```

The call confirms who answered *before* disclosing anything, says only who asked
for them and when, and never rings twice for repeated presses. Full design in
[`calle/`](calle/), which also holds the reusable Agent Skill.

**One setup step decides whether any of it works:** on the patient's device,
sign in with the caregiver's account and then press the padlock — **Care
Lock** — to hand it over. *Do not log out.* If you only want the role screen
back, the **hand-over** button beside the padlock does that while keeping you
signed in; until it existed, logging out was the only way there, which meant
the obvious path to handing a device over was also the one that broke it. The circle id is the account's
uid, so the account staying on the device is the only thing putting it in the
family's circle; log out and the patient button becomes a demo in a circle of its own, where
the alert reaches nobody and there is no number to ring. The role screen names
the account it is actually carrying — "Signed in as ruth@example.com" — because
a claim you can check beats one you have to trust, and a leftover demo token
used to be enough to make the device say it was connected. The app also warns
in the caregiver's help-call card and in the logout confirmation itself — and an unlinked device never tells the patient that someone has been
told and is coming. A promise nobody can keep is worse than silence.

---

## Architecture

A React 19 SPA and an Express server, bundled together and served from one
process.

```
src/
  App.tsx              the app — patient view and caregiver hub
  components/          patient-facing UI, sensory rooms, Hattie
  lodge/               Hattie's Lodge (the caregiver's own space)
  lib/                 auth, per-circle store, theme, sound, demo data
  server/
    index.ts           API routes and the companion's prompts
    lucidity.ts        the terminal-lucidity tripwire
    textSafety.ts      reply hygiene: cleaning, brevity, frame integrity
    helpCall.ts        the help-button phone call
    vocalTone.ts       how it sounded, not just what was said
    calleApi.ts        CALL-E Developer API transport
    auth.ts            Firebase ID token verification (RS256)
    stripe.ts          Caregiver Pro billing
    email.ts           welcome email (Resend)
calle/                 CALL-E integration docs + the Agent Skill
public/about.html      the landing page (single static file)
```

**Data** lives in per-family "care circles" in Firestore, keyed by the account's
uid, with a localStorage mirror so the app works fully offline. See
[FIREBASE-SETUP.md](FIREBASE-SETUP.md) for the security rules — paste them
before taking real customers.

**Models**, each chosen for a job:

| Job | Provider |
| --- | --- |
| Companion conversation, drift, redirection | OpenRouter (`poolside/laguna-xs-2.1` by default) |
| Routines, clinical insights, transcription **and vocal tone** | Gemini (`gemini-3.5-flash`) |
| Family-photo analysis | Gemini pro-class (`gemini-3.5-pro`) — flash misses the detail that unlocks a memory |
| Natural voice | Inworld TTS |
| Phone calls | CALL-E |

Gemini was deliberately kept off the companion's own voice — it read as "a cold
computer in a cage" in testing.

---

## Getting started

```bash
npm install
cp .env.example .env      # fill in what you need; everything is optional
npm run dev               # vite dev server
```

Nothing is required to start. With no API keys the companion runs in simulation
mode; with no Firebase config it runs entirely on localStorage.

```bash
npm run build             # client + bundled server
npm start                 # serve on PORT (default 3000)
npm run lint              # tsc --noEmit
npm test                  # 180 tests, node:test
```

### Configuration

| Variable | What it enables |
| --- | --- |
| `OPENROUTER_API_KEY` | The companion's conversation. Without it, simulation mode. |
| `OPENROUTER_MODEL` | Override the chat model. |
| `GEMINI_API_KEY` | Routines, insights, media analysis, transcription fallback. |
| `GEMINI_MODEL` | Override the Gemini model. Defaults to `gemini-3.5-flash` on both routes. |
| `GEMINI_VISION_MODEL` | Photo analysis. Defaults to the pro sibling of `GEMINI_MODEL`; falls back to `GEMINI_MODEL` if that name doesn't exist. |
| `GEMINI_BASE_URL` | Point Gemini at a local stand-in for testing. Empty in production. |
| `GEMINI_ENTERPRISE_API_KEY` / `GOOGLE_CLOUD_PROJECT` | Route Gemini through the Enterprise Agent Platform instead. |
| `INWORLD_API_KEY` | Natural voice. Without it, the device voice. |
| `CALLE_API_KEY` | The help button rings a phone. Without it, the alert still raises. |
| `HELP_CALL_COOLDOWN_MS` | Gap before the same circle can trigger another call. Default 10 min; `0` disables it for demos. |
| `STRIPE_SECRET_KEY` | Caregiver Pro checkout. See [STRIPE-SETUP.md](STRIPE-SETUP.md). |
| `RESEND_API_KEY` | Post-signup welcome email. See [EMAIL-SETUP.md](EMAIL-SETUP.md). |
| `FIREBASE_PROJECT_ID` | Server-side token verification, if not the committed project. |
| `VITE_FIREBASE_*` | Point the client at a different Firebase project. `off` disables it. |

Full annotated list in [.env.example](.env.example).

### Testing without side effects

The tests never touch a network. The CALL-E transport is exercised against a
local fake server serving the documented shapes:

```bash
node calle/urgent-help-escalation-call/scripts/fake-calle-api.mjs voicemail &
CALLE_API_KEY=test CALLE_API_BASE_URL=http://127.0.0.1:9099 npm start
```

Scenarios: `acknowledged`, `heardNotGoing`, `voicemail`, `noAnswer`, `stranger`.

## Deploying

[`render.yaml`](render.yaml) builds with `npm ci && npm run build` and starts
with `npm start`. Set the keys you want as environment variables — nothing is
read from a committed file, and `.env` is gitignored.

---

## Decisions worth knowing

Some of these look like limitations and are load-bearing:

- **Free for families, always.** The companion, its voice, session memory, call
  mode, calming rooms and photos cost nothing. Caregiver Pro ($5/week) funds it
  by covering the caregiver's professional tooling.
- **The help *alert* is free; the *call* is Pro.** Nobody loses the help button.
  What payment buys is the phone ringing as well as the screen lighting up.
- **The phone call is not Yadira's voice.** CALL-E speaks in its own, with no way
  to supply ours. That is fine for reaching a caregiver, which is why the phone
  is used only for that — a familiar name in an unfamiliar voice is not the same
  person to someone whose recognition is failing.
- **Sample data is chosen, never assumed.** A new circle used to be seeded with
  a sample family silently — and those logs feed the AI care reports and Ask
  Yadira, which the app calls "grounded in the patient's own records". A real
  caregiver could therefore generate a clinical report about a fictional woman
  on day one, indistinguishable from a real one. Caregivers are now asked; the
  demo path still seeds itself, because a companion with no memories is not a
  demo of anything.
- **Mood is never guessed.** Where the patient said nothing clear, the record
  says so. A fabricated wellbeing signal gets charted and acted on. The vocal
  tone read is held to the same rule: `unclear` is a first-class answer, a
  low-confidence reading is dropped rather than shown weakly, and an emotion
  outside the known set is refused rather than approximated.
- **Heard is not measured.** A vocal tone reading is a model's impression of a
  voice, with no clinical validation behind it, so it travels with its
  provenance and the badge says "heard" — never implying it was measured. It
  also never takes the transcript down with it: a malformed mood costs a
  badge, not the patient's words.
- **Distress checks are a union, not a delegation.** If either the provider's
  structured result *or* our own patterns see distress, the caregiver is told.
- **Reply cleaning is never destructive.** If every heuristic fires and leaves
  nothing, the original text is returned — an over-eager filter once blanked real
  replies.

## Documentation

| Doc | What's in it |
| --- | --- |
| [FIREBASE-SETUP.md](FIREBASE-SETUP.md) | Care circles, security rules, server-side token verification |
| [STRIPE-SETUP.md](STRIPE-SETUP.md) | Caregiver Pro billing |
| [EMAIL-SETUP.md](EMAIL-SETUP.md) | Welcome email via Resend |
| [calle/README.md](calle/README.md) | The help-button call, and submitting the Agent Skill |
| [calle/FEEDBACK.md](calle/FEEDBACK.md) | What building on CALL-E surfaced, measured on live calls |
| [SPONSORS.md](SPONSORS.md) | Why sponsorship keeps this free for families |
| [docs/demo/](docs/demo/) | Demo reel script, FAQ video script, camera-ready seeding |

## License

© 2026 Yadira · Part of Project Anamnesia
