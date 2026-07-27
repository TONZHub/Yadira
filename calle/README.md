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

Two transports. **The Developer API is preferred and is what a deployment should
use** — set `CALLE_API_KEY` and the CLI is not involved at all:

```bash
export CALLE_API_KEY="calle_live_..."   # from your CALL-E account
npm run build && npm start
```

A static key deploys: no browser login on the host, nothing cached in a
container that a redeploy will wipe, no binary to locate. It also lets us
declare a `recipient_result_schema`, so CALL-E returns a validated readout
rather than us inferring one from a transcript.

The route uses `POST /v1/calls` then polls `GET /v1/calls/{id}` until the call
reaches a terminal state. An unrecognised status keeps polling rather than being
treated as finished, so a new status name upstream delays a readout instead of
faking one. `CALLE_WEBHOOK_URL` is passed through when set, but polling still
runs — a laptop has no publicly reachable URL.

### Testing it without the live service

`node scripts/fake-calle-api.mjs` (in `wellbeing-check-in-call/scripts/`) serves
the documented shapes locally:

```bash
node calle/wellbeing-check-in-call/scripts/fake-calle-api.mjs vendorMissedIt &
CALLE_API_KEY=test CALLE_API_BASE_URL=http://127.0.0.1:9099 npm start
```

### CLI fallback

With no `CALLE_API_KEY`, the app falls back to the CLI.
`@call-e/cli` is a **project dependency**, so `npm install` provides it and the
server finds it at `node_modules/.bin/calle`. Nothing needs installing globally
— that was the original design and it meant a fresh deploy, which only runs
`npm ci`, had no CLI at all.

You still have to log in once on the machine that will place calls, because the
token is cached per machine (`~/.calle-mcp/cli`):

```bash
# Attribution env vars; they carry no user data.
env CALLE_SOURCE=yadira CALLE_INTEGRATION=yadira-check-in-call CALLE_INTEGRATION_VERSION=0.1.0 \
  ./node_modules/.bin/calle auth login     # finish authorization in the browser

env CALLE_SOURCE=yadira CALLE_INTEGRATION=yadira-check-in-call CALLE_INTEGRATION_VERSION=0.1.0 \
  ./node_modules/.bin/calle auth status    # expect "usable": true
```

On a host with no browser, `calle auth login --start-only --no-browser-open`
prints the authorization URL to open elsewhere, then re-run
`calle auth login --no-browser-open` to finish the pending login.

Then leave `CALLE_DRY_RUN` unset and the app places real calls. Until a token
exists the route refuses cleanly and dials nothing:

```json
{ "error": "CALL-E is not authorized (no CALL-E login on this machine). Run: calle auth login" }
```

### Resolution order

1. `CALLE_CLI_COMMAND` — explicit override.
2. `CALLE_CLI_PATH` — a repository-local checkout, run through `node`.
3. `node_modules/.bin/calle` — the project dependency. **This is the normal path.**
4. `calle` on `PATH` — a global install, if someone has one.

If none resolve, the route says so and names what it looked at rather than
failing with a bare ENOENT.

| Variable | Purpose |
| --- | --- |
| `CALLE_DRY_RUN` | `1` to place no real calls. Unset for live calls. |
| `CALLE_CLI_COMMAND` | Explicit CLI command, e.g. `npx -y @call-e/cli@0.3.6`. Overrides everything. |
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
