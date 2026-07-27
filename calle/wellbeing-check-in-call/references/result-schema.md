# Structured Result Schema

The readout is the product of the call. A transcript is evidence; this is the
thing a busy person reads at a glance and acts on.

```json
{
  "run_id": "run_123",
  "answered": true,
  "state": "completed",
  "phone": "+1555***4567",
  "mood": "anxious",
  "distress_reasons": ["reported a fall"],
  "lucidity": null,
  "needs_human": true,
  "summary": "Eleanor answered, and this call needs you: they reported a fall.",
  "transcript": [{ "speaker": "recipient", "text": "I fell this morning" }]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `run_id` | string | CALL-E run identifier, for status lookups. |
| `answered` | boolean | From CALL-E when reported; otherwise inferred from the recipient having spoken. |
| `state` | string | CALL-E's own call state, passed through unchanged. |
| `phone` | string | **Masked.** Never return the full number to a client. |
| `mood` | enum \| null | One of `peaceful`, `anxious`, `restless`, `sad`, or `null`. |
| `distress_reasons` | string[] | Plain-language reasons, safe to show a caregiver. Empty when none. |
| `lucidity` | string \| null | Domain-specific; omit if your use case has no equivalent. |
| `needs_human` | boolean | True when any distress reason fired. Drives escalation. |
| `summary` | string | One or two sentences. No jargon, no percentages, no diagnosis. |
| `transcript` | array | Speaker-tagged. Store per your own retention and consent rules. |

## Rules

**Interpret only the recipient's words.** The agent's own turns must never feed
mood or distress detection — an agent asking "are you worried?" is not the
recipient being worried. Filter to `speaker === "recipient"` first.

**Return `null`, never a guess.** When nothing clear was said, `mood` is `null`
and the interface shows "not recorded". A fabricated wellbeing signal gets
charted, trended, and acted on.

**Distress outranks politeness.** "I'm fine, just a bit frightened" is
`anxious`, not `peaceful`. People minimise on the phone, especially to someone
they think is checking up on them. Evaluate distress cues before contentment
cues.

**Mask the number everywhere**, including log lines and error messages, not just
the response body.

**Never put clinical language in `summary`.** It is read by family, not
clinicians, and it is not a diagnosis. "Sounded low" — not "presented with
depressive affect".
