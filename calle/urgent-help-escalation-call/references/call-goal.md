# Call Goal Template

The message handed to `POST /v1/calls`. Written as instructions to a person
making a call, because that is what CALL-E plans against.

**Identity first, message second.** This is the single most important thing on
this page, and it is the mistake most implementations make — including this one,
until a real call was tried.

```text
Call {{recipient_name}}. Before you say anything about why you are calling, confirm you are speaking to the right person.

Follow these steps in order:
1. Open with exactly this: "Hello, this is {{product_name}}. Am I speaking with {{recipient_name}}?"
2. If they say no, or they are evasive, or you are not certain it is {{recipient_name}}: say only "Sorry to have troubled you. Goodbye," and end the call. Do NOT say why you are calling. Do NOT name anyone. Do NOT ask them to pass on a message. A wrong number learns only that somebody called.
3. Once they confirm they are {{recipient_name}}, say: "{{subject_name}} has pressed their help button and is asking for you. Please go to them when you can."
4. Ask them to confirm they have heard you.
5. Say thank you and end the call.

Throughout:
Speak clearly and calmly. Do not sound alarmed — panic does not help anyone get there faster.
Say nothing about their health, their condition, or anything they said. You do not know why they pressed it, and you must not speculate.
If the call reaches voicemail, do not name {{subject_name}} and do not say why you are calling — a voicemail can be played aloud to a room. Leave only: "This is {{product_name}} calling for {{recipient_name}}. There is an alert waiting in your app. Please check it now."
Keep the whole call under a minute.
```

## Why the ordering

The obvious design leads with the message, to save time. It is wrong.

A phone number will eventually be answered by somebody else: a neighbour, a
partner, a child, a colleague, a stranger with a recycled number, a phone left
on a kitchen table. Lead with the message and you have already told them that a
named, vulnerable person has asked for help — before knowing who is listening.
Nothing downstream can un-say it.

A "if it turns out to be the wrong person, don't say more" branch does not fix
this. By the time the model reaches that branch, it has spoken.

The gate costs about one second.

## Why each line is there

**"Open with exactly this."** Give the sentence verbatim. Left to improvise, a
model will pad the opening with context — which is the disclosure you were
trying to gate.

**"or they are evasive, or you are not certain."** Without it, an ambiguous
"uh, who's asking?" gets treated as confirmation. Ambiguity must fail closed.

**"Do NOT ask them to pass on a message."** Asking a stranger to relay it is a
disclosure with extra steps. It feels helpful, which is why it needs forbidding
explicitly.

**A quoted message, not a summary.** Left to paraphrase, models add detail that
was never provided — "she sounded distressed", "it may be urgent" — and the
responder acts on an invention.

**"Do not sound alarmed."** An alarmed voice makes people rush, and rushing to a
frightened person is not the same as arriving calmly.

**"You must not speculate."** You know a button was pressed. You do not know why.
A guess becomes what the responder believes for the whole drive over.

**"Ask them to confirm they have heard you."** Turns a broadcast into a
handshake, and it is what fills `acknowledged` in the result. Without it you
know a phone was answered, not that anyone is coming.

**The voicemail line names nobody.** Voicemail is the case where the identity
gate cannot run — there is no one to answer the question. So the message must be
safe for anyone to hear, which means it carries no name and no reason. Point
them at the app, which is behind their login.

**"Under a minute."** This call has one job. Length adds only the risk of saying
something it should not.

## Adapting it

Swap "pressed their help button" for what actually happened — "triggered their
duress alarm", "has not moved since six this morning". Keep it factual and
observable, and never editorialise a trigger into a diagnosis.

Keep the gate exactly as it is. Everything else here is adjustable; that is not.
