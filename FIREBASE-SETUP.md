# Yadira — Firebase Setup Guide

**Cloud sync is on by default.** The production Firebase web config
(project `yadira-1c1dd`) is committed in `src/lib/firebase.ts`, so every
build — local dev, Render, anywhere — syncs to Firestore in real time
without any env vars. (Web config is safe to commit; security lives in
the Firestore rules below.)

Setting `VITE_FIREBASE_*` env vars overrides the committed config, e.g.
to point a dev build at a separate test project. Steps 1–4 below are the
original guide for creating a project from scratch — you only need them
for a new/override project.

## Step 0 — Protect your $300 credits FIRST

Before creating anything:

1. Go to Google Cloud Console → **Billing** → **Budgets & alerts**
2. Create a budget: **$25/month** with email alerts at 50% / 90% / 100%
3. This is a prototype — if you ever see more than a few dollars of spend, something is misconfigured

Firestore free tier alone covers a prototype easily: 50K reads + 20K writes **per day**, free. You will likely spend $0.

## Step 1 — Create the Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Name it `yadira` (link it to your existing Google Cloud billing account)
3. Skip Google Analytics (not needed)

## Step 2 — Add a Web App

1. Project Overview → **</>** (Web) icon → register app as `yadira-web`
2. It shows you a `firebaseConfig` object — keep that tab open

## Step 3 — Enable Firestore

1. Build → **Firestore Database** → Create database
2. Choose **Start in test mode** for now (we lock it down when Auth lands)
3. Region: `us-east1` or whatever is closest

## Step 4 — Wire the config into the app

Copy `.env.example` to `.env` and fill in from the config object:

```
VITE_FIREBASE_API_KEY="AIza..."
VITE_FIREBASE_AUTH_DOMAIN="yadira-xxxx.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="yadira-xxxx"
VITE_FIREBASE_STORAGE_BUCKET="yadira-xxxx.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abc123"
```

Restart the dev server. Console will say:
`[Yadira] Firebase connected — cloud sync active.`

## Step 5 — Verify the magic

Open the app in **two different browsers** (or your phone + laptop). Add a memory in one — watch it appear in the other in real time. That's the caregiver-phone / patient-tablet story, live.

## What changed in the code

- `src/types.ts` — shared interfaces (extracted from App.tsx)
- `src/lib/firebase.ts` — Firebase init with graceful fallback
- `src/lib/useStore.ts` — `useStoreList` / `useStoreDoc` hooks (Firestore + localStorage mirror)
- `src/App.tsx` — four localStorage blocks replaced with hooks; **caregiver profile now persists** (it previously reset to Eleanor/Thomas on every refresh)

## Step 6 — Per-family care circles (built) + security rules (paste these!)

Every signed-in account now gets its own isolated circle: the circle id IS the
Firebase Auth uid. `default-circle` remains only as the anonymous demo space.
A patient device joins the family's circle by being signed in with the
caregiver's account (enter patient mode from the signed-in device — the uid,
and therefore the circle, carries over).

**Before taking real customers**, replace the test-mode Firestore rules
(Firestore Database → Rules) with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each family's circle is readable/writable ONLY by that account.
    match /careCircles/{circleId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == circleId;
    }
    // The anonymous demo circle stays open so the public demo keeps working.
    match /careCircles/default-circle/{document=**} {
      allow read, write: if true;
    }
  }
}
```

Known limitation: local demo sessions (the no-Firebase fallback and "I'm a
Patient" without a signed-in caregiver) are not Firebase-authenticated, so
under these rules their cloud sync silently stays off and they run on
localStorage only. That's the correct trade: paying families are isolated
and authenticated; the demo still works.

### Setting up the patient's device

This follows directly from "the circle id IS the uid", and it is the one
step nothing in the app can do on the family's behalf:

> **Sign in on the patient's device with the caregiver's account, then press
> the padlock (Care Lock) to hand it over. Do not log out.**

Care Lock is the supported handover. It pins the device to the patient view,
hides the tab switcher and the logout button so no destructive control is
reachable by a stray touch, and goes full screen — all while the caregiver's
account stays on the device, which is the part that matters here.

**Logging out is what breaks the link**, and it does not look like it. Once
the account is gone, "I'm a Patient" mints a local session in a circle of its
own. It looks identical, but the help button raises an alert the caregiver
never receives, the escalation number saved on the caregiver's device is not
there, and the circle is on nobody's subscription — so the CALL-E call has
neither a number to ring nor a Pro entitlement to ring it with. This is why
the same help button "works in Preview Patient View and not on the patient's
tablet".

The app now says so at each of the three points where it can:

| Where | What it says |
| --- | --- |
| Role screen, no account on the device | Sign in first, then use the padlock |
| Caregiver's help-call card | The handover, and "do not log out first" |
| The logout confirmation itself | Logging out disconnects this device |

And since a promise nobody can keep is worse than silence, an unlinked
patient session never tells the patient that someone has been told and is
coming. See `src/lib/localSession.ts`.

## Step 7 — Server-side token verification (built)

Firestore rules protect the *database*, but the Express API in `src/server`
has its own door. It now verifies Firebase ID tokens properly
(`src/server/firebaseToken.ts`): RS256 signature checked against Google's
published signing certificates, plus issuer, audience and expiry. Previously
the payload was base64-decoded and trusted, so anyone could present
`{"uid":"<any family>"}` and be that family — which meant free use of the
AI routes on our bill and the ability to drive another family's alerts.

No extra setup is needed: the project id defaults to the same `yadira-1c1dd`
committed in `src/lib/firebase.ts`, and the certificates are public. Set
`FIREBASE_PROJECT_ID` only when pointing the server at a different project.
The server needs outbound access to `www.googleapis.com`.

Three trust tiers, so a care product never goes dark on an aged token:

| Tier | Meaning | Where it's accepted |
|---|---|---|
| `verified` | signature, issuer, audience, expiry all good | everywhere |
| `stale` | genuinely signed by Google, expiry passed (≤30 days) | help button, lucidity alert, TTS, mode sync |
| `local` | the unsigned local-demo token; uid must be `local-*` | everywhere, but only ever reaches a `local-*` circle |

The circle a request touches is now derived from the verified identity, not
from the `circle` field in the body — that field was previously enough to
read another family's sync state or silently acknowledge their help alert.

## Next up (not yet built)

- Stripe subscription gating per circle
- Google Calendar integration on the server layer
