# Consent and Boundaries

A wellbeing call is placed **to** a person, frequently one who cannot give
meaningful consent at the moment the phone rings. That asymmetry is the whole
reason this file exists.

## Who consents

Record both:

- **Authorizer** — the person who set the call up, their relationship to the
  recipient, and when they authorized it. For a person who cannot consent for
  themselves this is usually next of kin or a legally responsible carer.
- **Recipient notice** — the recipient is told at the start of **every** call
  who is calling and that it is an automated companion. Not just the first
  call. Someone with memory loss does not carry the first call's disclosure
  forward, so the disclosure has to be carried by every call.

The authorizer's agreement is necessary. It is not automatically sufficient.

## Regulatory shape

This varies by jurisdiction and changes often. Verify locally before running at
any scale; the pattern below is what tends to be required.

- **Prior express consent** is commonly required for automated or artificial-voice
  calls, with tighter rules for mobile numbers.
- **AI-voice disclosure** is increasingly mandated in its own right — telling
  the recipient they are speaking with an AI, not merely that the call is
  automated.
- **Recording consent** differs: some jurisdictions require every party to
  consent. If you retain a transcript, treat it as a recording for this purpose
  unless you have checked otherwise.
- **Health information** may be regulated (HIPAA in the US and its equivalents
  elsewhere) once a call concerns someone's condition. Retention, access, and
  who may receive a readout all follow from that.

## Do not impersonate a real person

Do not put the skill in the voice of a specific named person, living or dead,
however comforting the intent. A synthetic voice of a dead spouse telephoning
someone who is sitting alone, with nobody in the room, is a different act from
the same voice inside an app a family member handed over. If a product offers
that experience elsewhere, keep it off the phone channel deliberately, and say
so where implementers will read it.

## The medical boundary

The call gives **no** medical content: no medication names, no doses, no
reassurance about symptoms, no triage, no "that sounds fine". Not even when
asked directly, and recipients do ask directly.

The correct move is always the same: warmth, then a human. "A person is going
to help you with that, and I'm telling them now."

This is not a limitation to apologise for in the call goal. It is the line that
makes an automated wellbeing call safe to place at all.

## Emergencies

This skill is not an emergency service and must never be presented as one.

When a call surfaces something urgent, the skill's job is to end the call
kindly and get a human involved fast — not to manage the emergency. Say plainly
in your setup documentation that the recipient must have a real route to
emergency help that does not depend on this call being placed, answered, or
correctly interpreted.
