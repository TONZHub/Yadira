# Feedback for the CALL-E team

Findings from building a real escalation feature on CALL-E: a help button in a
dementia companion that rings the caregiver's phone. Everything here was
measured on live calls, not inferred from the docs.

Ordered by how much it affected the product.

---

## 1. An unknown caller ID is the biggest practical problem

**Measured, across three consecutive calls to the same caregiver:**

| Call | Caller ID | Area |
| --- | --- | --- |
| 1 | `+1 214-295-5547` | Dallas, TX |
| 2 | `+1 832-590-3283` | Houston, TX |
| 3 | `+1 504-433-7012` | New Orleans, LA |

Three calls, three numbers, three cities — none of them the caregiver's own
area code. **The caller ID is not stable across calls**, which is worse than it
being merely unfamiliar, and it is the single finding from this integration
that changed our product copy.

We had shipped a "send me a test call" feature whose stated purpose was so the
caregiver could *save the number as a contact* before the night they need it.
That advice was in the UI twice and in the test call's own script. It could
never have worked — and worse, a caregiver who followed it would have believed
they were protected while nothing had changed. All of it has been replaced with
the only advice that survives a rotating caller ID: turn off your phone's
"silence unknown callers" setting, because you cannot allowlist what you cannot
predict.

This is the one call in the product that must not be missed, and it arrives
looking exactly like the 4am spam call people are trained to decline. Many
phones now silence unknown numbers by default. Do Not Disturb rules routinely
allow contacts only.

The mitigations available to us are all bad: we cannot tell the caregiver which
number to save, because we do not know it in advance and — now measured — it
differs on every call.

**What would help, roughly in order of usefulness:**

- a **stable outbound number per account**, surfaced in the API, so a product
  can tell users "save this contact" during setup
- caller ID / CNAM configuration, so it displays a name rather than a city
- if neither is possible, returning the number that *was* used on the call
  object, so at least the app can show "we called you from …" after the fact

For urgent escalation this is not a nice-to-have. A call that gets declined as
spam has failed at the only job it had.

## 2. Time to ring is ~2 minutes, and it is undocumented

**Measured:** help button pressed at **04:04**, phone rang at **04:06**.
Consistent with an earlier test call that took about the same.

That is fine for many use cases and significant for ours, but the issue is that
it is not written down anywhere. We shipped copy saying the phone rings
"straight away" because nothing suggested otherwise, and had to correct it after
seeing a real call.

**What would help:**

- a documented expected time-to-ring, even as a rough range
- a status on the call object that distinguishes *queued* from *dialling*, so an
  app can show "calling you now" honestly rather than guessing
- if the delay is queue depth rather than fixed overhead, saying so, so
  implementers know whether it varies under load

## 3. No control over the voice

There is no parameter to supply your own synthesized voice, and none to select a
speaker. `region` changes the outbound line but not the voice — we set `US`,
received a Texas number, and still heard an English accent.

We designed around it, and the reasoning may be useful to you: our companion
speaks to the patient in a specific cloned voice, and to someone whose
recognition is failing, a familiar name in an unfamiliar voice reads as an
impostor rather than a friend. So we **removed** our patient-facing call feature
entirely and kept CALL-E only for calling the caregiver, where the voice does
not matter.

That is a whole use case CALL-E lost to a missing parameter. Voice selection —
even a small fixed set, even just per-account — would have kept it.

## 4. `locale` and voice are conflated in the docs

Related to the above: the docs present `region` and `locale` as recipient
settings, which reads as "this controls how the call sounds". It appears to
control the outbound line and possibly the language, but not the accent.

Worth separating explicitly in the reference: *this affects the number you call
from, this affects the language spoken, this affects the voice* — with a plain
statement where a control does not exist.

## 5. Documentation reachability

Small but it cost real time: `docs.heycall-e.com` and the install guide at
`open.heycall-e.com` were unreachable from our build environment, while
`raw.githubusercontent.com` was not. We built the first integration by reading
`call-e-integrations` and `awesome-phone-call-agents` raw from GitHub.

Keeping the CLI reference and API examples in-repo, as you already largely do,
made that possible. Worth continuing deliberately — it is the difference between
an agent being able to integrate and not.

## 6. What worked well, and why

Worth saying, since these shaped the design in good ways:

- **`recipient_result_schema` is the best thing in the API.** Declaring the
  readout and getting it back validated replaced a pile of regex over
  transcripts. Being able to put `"unclear"` and `"unknown"` in the enums
  mattered more than it sounds: it gave the model an honest way out, so it never
  had to invent a wellbeing signal that would then get charted and acted on.
- **The plan/confirm split in the CLI** is a genuinely good safety primitive.
  Being able to inspect a plan before spending the confirmation token is exactly
  the gate a product like ours needs, and we built our refuse-to-dial check on
  it.
- **`Idempotency-Key`** meant a retried request could not ring a frightened
  person's carer twice. Present, documented, worked.
- **`auth status` returning `cache_exists` separately from `usable`** let us tell
  "never logged in here" from "token expired" in an error message. Small,
  thoughtful.

---

*Compiled while building [Yadira](https://github.com/TONZHub/Yadira), an AI
companion for people living with dementia. Happy to expand on any of this.*
