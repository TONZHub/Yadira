# CALL-E — the help button that rings a phone

When the patient presses **I need my caregiver**, Yadira raises the in-app alert
and rings the caregiver's phone at the same moment.

The alert on its own is only as good as somebody looking at a screen, and the
moments it exists for are exactly the moments that assumption fails: the middle
of the night, a shower, a meeting, a commute. A ringing phone is the one channel
that reliably interrupts.

```
patient presses help
  → banner raised on the caregiver's screen     (every family, free)
  → CALL-E rings the caregiver's phone          (Caregiver Pro)
  → readout: reached / voicemail / no answer, and did they acknowledge
```

## What's here

| Path | What it is |
| --- | --- |
| `urgent-help-escalation-call/` | The reusable Agent Skill, ready to submit to [awesome-phone-call-agents](https://github.com/CALLE-AI/awesome-phone-call-agents) |
| `../src/server/helpCall.ts` | The call, the message, the cooldown |
| `../src/server/calleApi.ts` | CALL-E Developer API transport |
| `../src/server/index.ts` | Trigger wiring, fire-and-forget from the alert route |
| `../src/server/helpCall.test.ts` | Tests, including "never dial the patient" |

## Try it without ringing anybody

The skill ships a fake CALL-E serving the documented shapes:

```bash
node calle/urgent-help-escalation-call/scripts/fake-calle-api.mjs voicemail &
CALLE_API_KEY=test CALLE_API_BASE_URL=http://127.0.0.1:9099 npm run build && npm start
```

Scenarios: `acknowledged`, `heardNotGoing`, `voicemail`, `noAnswer`, `stranger`.
The `voicemail` one is worth running — a message exists but nobody has heard it,
which is the outcome most easily mistaken for success.

## Real calls

```bash
export CALLE_API_KEY="calle_live_..."   # from your CALL-E account
npm run build && npm start
```

A static key deploys: no browser login on the host, nothing cached in a
container a redeploy will wipe. Set it in Render's environment variables, or a
local `.env` (already gitignored — never commit it).

| Variable | Purpose |
| --- | --- |
| `CALLE_API_KEY` | Developer API key. Without it the help button still raises the alert; it just cannot ring anyone. |
| `CALLE_API_BASE_URL` | Override the API host. Point it at the fake server for testing. |
| `CALLE_WEBHOOK_URL` | Optional. Polling runs regardless — a laptop has no reachable URL. |
| `HELP_CALL_COOLDOWN_MS` | How long before the same circle can trigger another call. Default 600000. |

## Configuring it as a caregiver

Caregiver hub → **Settings** → **Call me when they need me**. One field for
*your own* number and where you are. There is deliberately nowhere to put the
patient's number: Yadira does not phone the patient.

## Submitting the skill

The folder is already in the shape the repository expects (`SKILL.md`,
`references/`, `scripts/`).

```bash
# fork CALLE-AI/awesome-phone-call-agents, then:
cp -r calle/urgent-help-escalation-call <fork>/skills/urgent-help-escalation-call
cd <fork>
python3 scripts/check_branch_name.py --branch feat/urgent-help-escalation-call
git switch -c feat/urgent-help-escalation-call
python3 scripts/validate_repository.py     # must pass before the PR
```

Add the README list entry alongside the other skills, then open the PR and put
its URL in the Devpost submission.

Two easy marks to check first, because they are the repository's own rules:
every sample number is fictional and masked, and the contribution ships a
no-call path. Both hold.

## Feedback for the CALL-E team

[FEEDBACK.md](FEEDBACK.md) — what building this actually surfaced, measured on
live calls: an unknown caller ID being the biggest practical problem, ~2 minutes
to ring, no voice control, and the parts of the API that shaped the design in
good ways.

## What this deliberately does not do

- **It does not phone the patient.** CALL-E speaks in its own voice with no way
  to supply Yadira's, and to someone whose recognition is failing a familiar
  name in an unfamiliar voice is not the same person. A caregiver knows what the
  call is, so the same limitation costs nothing here.
- **It says only who asked for you, and when.** Never a condition, never a
  guess at why, never anything about the patient's health — you cannot be sure
  who answered.
- **It is not an emergency service** and must never be presented as one. It
  reaches one nominated person who may be asleep or unreachable, and it assesses
  nothing.
- **It does not ring repeatedly.** A frightened person may press the button many
  times; the caregiver gets one call.
