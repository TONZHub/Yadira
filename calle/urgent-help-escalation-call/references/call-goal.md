# Call Goal Template

The message handed to `plan_call` / `POST /v1/calls`. Written as instructions to
a person making a call, because that is what CALL-E plans against.

Replace every variable. Resist adding to it — every extra sentence is something
said to whoever picked up the phone.

```text
Call {{recipient_name}} with an urgent but calm message. Say it in the first sentence — do not build up to it.

The message: "{{recipient_name}}, this is {{product_name}}. {{subject_name}} pressed the help button at {{local_time}} and is asking for you."

Speak clearly and calmly. Do not sound alarmed — panic does not help anyone get there faster.

Say nothing further about their health, their condition, or anything they said. You do not know why they pressed it, and you must not speculate.

Ask the person to confirm they have heard and are going to them.

If it goes to voicemail, leave the same short message and say the app also has an alert waiting.

If someone other than {{recipient_name}} answers, give the same message only if they say they are with the family; otherwise ask them to pass on that {{recipient_name}} should check the app.

Keep the whole call under a minute.
```

## Why each line is there

**"Say it in the first sentence — do not build up to it."** Without this, models
open with pleasantries. Someone woken at 3am needs the fact before the manners.

**A quoted message, not a summary.** Give the exact sentence. Left to paraphrase,
models add detail that was never provided — "she seems distressed", "it may be
urgent" — and the responder acts on an invention.

**"Do not sound alarmed."** An alarmed voice makes people rush, and rushing to a
frightened person is not the same as arriving calmly. The message is urgent; the
delivery should not be.

**"You must not speculate."** The single most important line. You know that a
button was pressed. You do not know why. A guess becomes what the responder
believes for the whole drive over.

**"Say nothing further about their health."** You cannot be certain who answered.
A neighbour, a child, a colleague, a wrong number. The subject's condition is
not theirs to learn.

**"Ask the person to confirm."** Turns the call from a broadcast into a handshake,
and it is what fills `acknowledged` in the result. Without it you know a phone
was answered, not that anyone is going.

**The wrong-person branch.** A number will eventually be answered by someone
else. Without explicit instruction the model will helpfully explain everything
to them.

**"Under a minute."** This call has one job. Length adds only risk of saying
something it should not.

## Adapting it

Swap "pressed the help button" for what actually happened — "did not get up this
morning", "triggered their duress alarm", "has not moved since 6am". Keep it
factual and observable. Never editorialise the trigger into a diagnosis.
