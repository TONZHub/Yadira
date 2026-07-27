# Escalation

A wellbeing call that notices something and tells nobody is worse than no call
at all, because it manufactures the feeling that someone is being watched over.

`escalation_contact` is therefore a **required** field. Refuse to place the call
without one.

## When to escalate

Escalate immediately when the readout sets `needs_human`:

- the recipient asked for help
- reported a fall, pain, injury, or being unable to get up or breathe
- said they were frightened, or did not know where they were
- reported someone in the house
- any domain-specific signal your implementation adds

Escalate on **the recipient's own words only**. The agent asking "are you all
right?" is not a distress signal.

## The ladder

1. **Push the readout to the escalation contact now.** Not at the end of a
   digest, not on next open. Whatever channel actually reaches them.
2. **If your product has an in-app alert, raise the same one.** This matters
   more than it sounds: on a phone call nobody is in the room, so the signal
   that would have been noticed by a person present has to be carried entirely
   by the alert.
3. **If the first contact does not acknowledge**, fall through to a backup
   contact if the caller configured one.
4. **Never** escalate by calling the recipient back repeatedly. A ringing phone
   is distressing to someone already frightened.

## What not to do

- Do not attempt to resolve the situation on the call. End warmly and get a
  human moving.
- Do not tell the recipient that an alert has been raised in words that sound
  alarming. "Someone who loves you is on their way" lands very differently from
  "I have flagged this."
- Do not include the full phone number, credentials, or raw provider payloads in
  an escalation message.
- Do not suppress an escalation because the same signal fired yesterday.
  Repetition is information, not noise.

## Unanswered calls

A missed call is not by itself an emergency — people are out, asleep, or in the
bath. Treat repeated misses as the signal instead: surface a pattern
("no answer three days running") rather than paging someone the first time a
phone rings out. Say plainly in your setup documentation that this skill cannot
distinguish "not home" from "on the floor", and must not be relied on to.
