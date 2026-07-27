---
name: wellbeing-check-in-call
description: Place a short CALL-E wellbeing check-in call to a person who lives alone or is cognitively impaired, hold a warm non-clinical conversation, and return a structured readout — answered, mood, distress signals, and whether a human needs to go now. Use for daily welfare calls, post-discharge follow-up, elderly-relative check-ins, dementia companion calls, and any "call them and tell me how they actually sounded" workflow.
license: MIT
---

# Wellbeing Check-In Call

Use this skill when a caller wants to know **how someone actually is**, and the
person on the other end cannot reliably use an app.

A great many people who most need checking on are the least able to be checked
on by software. Someone in the middle stages of dementia often cannot operate a
tablet, but will still answer a ringing telephone — answering a phone is among
the last procedural habits to go. The same is true of an isolated elderly
relative, or a patient in the fortnight after discharge. This skill turns one
CALL-E call into a structured wellbeing signal a human can act on.

It is a **one-off call** wrapper. It does not create a provider-side recurring
schedule. For a daily cadence, pair it with the host's own scheduler (see
[`call-reminder`](../call-reminder/) for the scheduler-adapter pattern) and let
each scheduled run place exactly one call.

## When To Use

- daily or ad-hoc welfare calls to someone living alone
- companion check-in calls for a person living with dementia
- post-discharge or post-procedure follow-up where a *feeling* matters as much as a fact
- "call my mother and tell me how she sounded" requests
- any check-in where the useful output is a structured readout, not a transcript to read

## When Not To Use

Do not use this skill to:

- deliver medical advice, medication instructions, dosing, or symptom triage over the phone
- perform emergency or crisis response — it is not an alternative to emergency services
- conduct a cognitive assessment, memory test, or any kind of quiz
- call a number the requester has not explicitly provided and confirmed
- call a third party (pharmacy, clinic, insurer, neighbour) — that is a different workflow with different consent obligations
- impersonate a specific real person, living or dead, on the call
- record or transcribe the call where local law requires consent that has not been obtained

## Required Fields

Ask for anything missing. **Never** infer these from locale, IP address, UTC
offset, prior context, or the shape of the phone number:

| Field | Notes |
| --- | --- |
| `to_phone` | E.164, e.g. `+15551234567`. Validate; never guess a country code. |
| `recipient_name` | What the caller should be addressed as on the phone. |
| `timezone` | IANA, e.g. `America/New_York`. Decides whether a call is appropriate right now. |
| `authorizer` | Who authorized this call and their relationship to the recipient. |
| `escalation_contact` | Who to tell when the call surfaces distress. Required — a check-in with nowhere to escalate is not a check-in. |
| `language`, `region` | Optional. Pass only when explicitly known. |

## Consent

A wellbeing call is placed **to** a person, often one who cannot give
meaningful consent in the moment. Two things must both be true:

1. The recipient, or the person legally responsible for them, has agreed to
   receive these calls. Record who authorized it.
2. The recipient is told, in the first few seconds of every call, who is
   calling and that it is an automated companion — every call, not just the
   first, because they may not remember the first.

Automated and AI-voice calls are regulated differently across jurisdictions, and
prior express consent is commonly required. Treat the authorizer's agreement as
necessary but not automatically sufficient; check local obligations before
running this at scale. See [`references/consent-and-boundaries.md`](references/consent-and-boundaries.md).

## Core Workflow

1. Confirm the caller explicitly wants a phone call placed now.
2. Collect the required fields above; ask for any that are missing.
3. Check the local time in `timezone`. Do not place a wellbeing call in the
   recipient's night hours unless the caller explicitly insists.
4. Build the call goal from [`references/call-goal.md`](references/call-goal.md).
   Keep it short — a long brief dilutes the rules that matter.
5. Check CALL-E auth status.
6. Plan exactly one call to `to_phone`.
7. **Inspect the plan.** Continue only if it targets that one number and no
   other, and is not a recurring provider schedule.
8. Run the plan with the returned plan id and confirmation token, exactly as
   CALL-E returned them.
9. Fetch call status and produce the structured readout in
   [`references/result-schema.md`](references/result-schema.md).
10. If the readout sets `needs_human`, notify `escalation_contact` immediately —
    see [`references/escalation.md`](references/escalation.md). Do not wait to
    be asked for the result.

Use this shape:

```text
auth status -> call plan -> INSPECT -> call run -> call status -> readout -> escalate if needed
```

The inspect step is the safety gate, not a formality. `plan_call` deliberately
returns a plan *and* a confirmation token so an agent can see what would happen
before spending it. A misdialled wellbeing call is a stranger's phone ringing
with a synthetic voice on the other end.

## Conversation Rules

These belong in the call goal itself, not only in the agent's head:

- Say who is calling and why, at the start of every call.
- Short sentences, one idea at a time, generous silences. Let them set the pace.
- Ask about feelings, never memory. Never "do you remember".
- If they repeat themselves, answer with the same warmth as the first time.
- Never correct them about the date, the place, or who is alive. Meet the
  feeling instead of the fact.
- No medical content of any kind, even when asked directly. A person will help
  with that.
- If somebody else answers, say only that you are calling to say hello. Share
  nothing about the recipient's health.
- On voicemail: a short friendly message, no health information.
- Keep the call under about four minutes and end warmly.

## The Voice Is Not Yours

CALL-E runs its own voice runtime. There is no parameter for supplying your
product's own synthesized voice, and none for choosing a specific speaker. If
your app already speaks to this person in a particular voice, **the phone will
not sound like it.**

For a companion product this matters more than it first appears. To someone
whose recognition is failing, a familiar name in an unfamiliar voice is not the
same person — voice is often the last thread of recognition to fray, and a
mismatch on the phone can read as an impostor rather than a friend. Tell
caregivers plainly that the phone voice differs from the in-app one, rather than
letting them discover it on a call.

The one lever you do have is `locale`, set from the recipient's region. **Send
it.** With nothing set, CALL-E picks its own default, which is how a family in
one country gets a companion with another country's accent. Ask the caregiver
where the person is; do not infer it from the dialling code.

This limitation is also why a represented-person mode must not go down the
phone line. A generic voice claiming to be a named loved one is worse than no
call at all.

## Structured Result

The point of the call is the readout, not the transcript. Return at minimum
`answered`, `mood`, `distress_reasons`, `needs_human`, and a one-sentence
summary a non-clinician can read at a glance. Return the phone number **masked**.
Full schema and worked examples: [`references/result-schema.md`](references/result-schema.md).

When the recipient said nothing that clearly indicates mood, return `null`
rather than a guess. A confidently wrong wellbeing signal is worse than an
honest blank, because someone will act on it.

## Side Effects, Cancellation, Cost

- **Side effect:** one real outbound phone call to a real person, per invocation.
- **Cancellation:** there is nothing to cancel after a call connects. When
  paired with a host scheduler, cancelling means removing the scheduled job;
  this skill creates no provider-side recurrence to unwind.
- **Cost:** one call from the CALL-E account per invocation.
- **Dry run:** set `CALLE_DRY_RUN=1` in the reference implementation to exercise
  the entire pipeline — planning, parsing, readout, escalation — with no network
  call and no phone ringing. Use it for tests and demos.

## Reference Implementation

[Yadira](https://github.com/TONZHub/Yadira) — a dementia companion — uses this
skill for its check-in calls:

| Piece | File |
| --- | --- |
| CALL-E client (plan → inspect → run → status, dry run, masking) | `src/server/calle.ts` |
| Call brief and structured readout | `src/server/checkInCall.ts` |
| Route, and escalation into the caregiver's alerts | `src/server/index.ts` |
| Tests, including the refuse-to-dial cases | `src/server/checkInCall.test.ts` |

Its escalation path is worth copying: a window of lucidity or a distress signal
on a call raises the *same* alert the in-app help button raises, because on a
phone call nobody is in the room to notice.
