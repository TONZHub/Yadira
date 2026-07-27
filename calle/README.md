# CALL-E — Yadira's check-in calls

Yadira's companion lives behind a tablet. A great many people living with
moderate or advanced dementia cannot operate one — but they will still answer a
ringing telephone, because answering a phone is among the last procedural habits
to go. This is how Yadira reaches them there.

One press places one short, warm call. What comes back is not a transcript to
read but a readout to act on: did they answer, how did they sound, and does
someone need to go now.

## What's here

| Path | What it is |
| --- | --- |
| `wellbeing-check-in-call/` | The reusable Agent Skill, ready to submit to [awesome-phone-call-agents](https://github.com/CALLE-AI/awesome-phone-call-agents) |
| `../src/server/calle.ts` | CALL-E client: `auth status → call plan → INSPECT → call run → call status`, with masking and a dry-run path |
| `../src/server/checkInCall.ts` | The call brief, and the transcript → structured readout |
| `../src/server/checkInCall.test.ts` | Tests, including every refuse-to-dial case |
| `../src/App.tsx` | The caregiver's Check-in call card (Settings tab) |

## Try it without ringing anybody

`CALLE_DRY_RUN=1` answers every CALL-E command from a local fixture. No network
call, no phone rings, and the entire pipeline still runs — planning, the inspect
gate, parsing, the readout, and the escalation into the caregiver's alerts.

```bash
# the skill on its own
node calle/wellbeing-check-in-call/scripts/dry-run.mjs

# the whole app
CALLE_DRY_RUN=1 npm run build && CALLE_DRY_RUN=1 npm start
```

Then open the caregiver hub → **Settings** → **Check-in call**.

To rehearse a specific moment, script what the patient says:

```bash
CALLE_DRY_RUN=1 CALLE_DRY_RUN_TRANSCRIPT='recipient: I know I have dementia' npm start
```

That one raises the lucidity alert — the same violet banner the tablet raises —
because on a phone call nobody is in the room to notice.

## Real calls

The CLI resolves as `calle` on `PATH`, which is where a global install puts it —
verified end to end against `@call-e/cli`.

```bash
npm install -g @call-e/cli

# Attribution env vars; they carry no user data.
env CALLE_SOURCE=yadira CALLE_INTEGRATION=yadira-check-in-call CALLE_INTEGRATION_VERSION=0.1.0 \
  calle auth login          # finish authorization in the browser

env CALLE_SOURCE=yadira CALLE_INTEGRATION=yadira-check-in-call CALLE_INTEGRATION_VERSION=0.1.0 \
  calle auth status         # expect "usable": true
```

Then leave `CALLE_DRY_RUN` unset and the app places real calls. Until a token
exists the route refuses cleanly and dials nothing:

```json
{ "error": "CALL-E is not authorized (no CALL-E login on this machine). Run: calle auth login" }
```

Point the app at the CLI if it isn't on `PATH`:

| Variable | Purpose |
| --- | --- |
| `CALLE_DRY_RUN` | `1` to place no real calls. Unset for live calls. |
| `CALLE_CLI_COMMAND` | Explicit CLI command, e.g. `npx -y @call-e/cli@1.2.3`. Overrides everything. |
| `CALLE_CLI_PATH` | Path to a repository-local `packages/cli/bin/calle.js`. |
| `CALLE_TIMEOUT_MS` | Per-command timeout. Default 45000. |
| `CALLE_DRY_RUN_TRANSCRIPT` | Scripted dry-run transcript, `speaker: text` per line. |

The pinned-`npx` route is deliberately not auto-resolved: it needs a known
version, and CALL-E's bootstrap reference forbids resolving it to `latest`. Set
`CALLE_CLI_COMMAND` if you want it.

## Submitting the skill

The skill folder here is already in the shape that repository expects
(`SKILL.md`, `references/`, `scripts/`).

```bash
# fork CALLE-AI/awesome-phone-call-agents, then:
cp -r calle/wellbeing-check-in-call <fork>/skills/wellbeing-check-in-call
cd <fork>
python3 scripts/check_branch_name.py --branch feat/wellbeing-check-in-call
git switch -c feat/wellbeing-check-in-call
python3 scripts/validate_repository.py     # must pass before the PR
```

Add the README list entry alongside the other skills, then open the PR and put
its URL in the Devpost submission.

Two things to double-check before submitting, because they are the repository's
own rules and the easiest marks to drop: every sample number is fictional and
masked, and the contribution ships a no-call path. Both hold here.

## What this deliberately does not do

- **No Vivid mode on the phone.** On the tablet the caregiver consented and is
  nearby. A synthetic voice of a dead spouse telephoning someone sitting alone
  is a different act, and Yadira should not make it by accident.
- **No medical content**, even when asked directly — and people do ask directly.
  Distress escalates to a human instead.
- **No provider-side recurrence.** One call per request. A daily cadence belongs
  to the caregiver's own scheduler, so cancelling means removing a job rather
  than unwinding something at the provider.
- **No emergency handling.** This is not an emergency service and must never be
  presented as one. It also cannot tell "not home" from "on the floor" — see
  `wellbeing-check-in-call/references/escalation.md`.
