# Escalation Ladder

What to do when the call does not land. An escalation that stops at the first
unanswered phone has done nothing except create the feeling that somebody was
told.

## The rungs

1. **Primary recipient.** One call. If `reached: caregiver` and
   `acknowledged: yes`, stop — somebody is going.
2. **Voicemail or no answer → the backup contact**, if one is configured. Same
   message, same rules. Do not wait long between rungs; the reason you are on
   this ladder is that the first rung failed.
3. **Nobody reachable → say so loudly in the product.** The in-app alert should
   change state to something like "we could not reach anyone by phone", not sit
   there looking identical to a delivered escalation. This is the state most
   likely to be silently wrong, and the one a family most needs to know about.
4. **Stop.** Do not loop the ladder indefinitely. Each pass costs money and none
   of them are reaching anybody.

## Never

**Never call the subject back.** They are already frightened, already waiting.
A ringing phone from the system that was supposed to fetch help is not reassurance.

**Never re-ring a recipient who acknowledged.** They said they are going. Calling
again while they are driving there is actively unhelpful.

**Never suppress an escalation because a similar one happened yesterday.**
Repetition across days is information — surface the pattern, but escalate each
one. Suppression belongs inside the [cooldown window](repeat-triggers.md), not
across incidents.

**Never send the raw provider payload, credentials, or the full phone number**
into whatever channel carries the escalation onward.

## Timing, honestly

Placing a call is not instantaneous. Between queueing, dialling, and someone
picking up, expect tens of seconds at best and minutes in practice.

Write your product copy accordingly. "You will be called" is true. "You will be
called instantly" is not, and the gap between them is where trust is lost.

If the trigger is genuinely time-critical — a fall, a cardiac event — this skill
is an addition to an emergency route, never a substitute for one.

## Recording it

For every rung, keep: who was called (masked), when, what came back, and what
you did next. When a family asks "did anyone actually try to reach me", that
record is the answer, and reconstructing it afterwards from provider logs is
both slow and incomplete.
