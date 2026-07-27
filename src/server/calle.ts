// CALL-E client — the phone-call route for Yadira's check-in calls.
// ------------------------------------------------------------------
// Yadira's companion lives behind a tablet. A great many people living with
// moderate or advanced dementia cannot operate one — but they will still
// answer a ringing telephone, because answering a phone is among the last
// procedural habits to go. This module is how Yadira reaches them there.
//
// The flow is CALL-E's documented one:
//
//     auth status -> call plan -> INSPECT -> call run -> call status
//
// The inspect step is not optional and not a formality. `plan_call` returns a
// plan plus a confirmation token, deliberately separating "what would happen"
// from "do it". We refuse to spend the token unless the plan names exactly the
// number the caregiver configured. A misdialled companion call is a stranger's
// phone ringing with a synthetic voice on the other end.
//
// Safety rules encoded here (see also the SKILL.md under calle/):
//   • E.164 only, never inferred. No guessing country codes from locale.
//   • One call per request. This module cannot create a recurring provider
//     schedule; recurrence belongs to the host scheduler.
//   • Phone numbers are masked in every log line. Tokens are never logged.
//   • A dry run performs no network I/O at all, so the whole pipeline —
//     including result parsing and the escalation path — is testable without
//     spending a call or ringing a real person.

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** CALL-E identifies integrations through these; they carry no user data. */
const CALLE_ENV = {
  CALLE_SOURCE: 'yadira',
  CALLE_INTEGRATION: 'yadira-check-in-call',
  CALLE_INTEGRATION_VERSION: '0.1.0',
};

const DEFAULT_TIMEOUT_MS = 45_000;

export class CalleError extends Error {
  constructor(message: string, readonly step: string) {
    super(message);
    this.name = 'CalleError';
  }
}

// ---------------------------------------------------------------- config

/**
 * No real call is placed when this is on: every CALL-E command is answered
 * from a local fixture instead. The contribution guidelines require runnable
 * code to ship a no-call path, and it is also the only way this pipeline can
 * be exercised in CI or on a developer's laptop.
 */
export function isDryRun(): boolean {
  return process.env.CALLE_DRY_RUN === '1' || process.env.CALLE_DRY_RUN === 'true';
}

/**
 * Resolve the CALL-E CLI, following the documented resolver order:
 *   1. CALLE_CLI_COMMAND — an explicit override (space-separated).
 *   2. A repository-local checkout of the CLI package.
 *   3. A `calle` binary already on PATH.
 * The pinned-npx fallback is deliberately NOT attempted: it needs a known
 * version, and the bootstrap reference forbids resolving it to `latest`. Set
 * CALLE_CLI_COMMAND if you want the npx route.
 */
export function resolveCliCommand(): string[] {
  const override = (process.env.CALLE_CLI_COMMAND || '').trim();
  if (override) return override.split(/\s+/);
  const local = (process.env.CALLE_CLI_PATH || '').trim();
  if (local) return ['node', local];
  return ['calle'];
}

// ---------------------------------------------------------------- helpers

/** E.164: a leading + and 8–15 digits. Never inferred, only validated. */
export function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test((value || '').trim());
}

/** +15551234567 → +1555***4567. Used in every log line and API response. */
export function maskPhone(value: string): string {
  const raw = (value || '').trim();
  if (raw.length < 8) return '***';
  return `${raw.slice(0, 5)}***${raw.slice(-4)}`;
}

/**
 * CALL-E's JSON is read tolerantly: responses may nest the useful fields under
 * `data`/`result`, and may use snake_case or camelCase. Pulling the first key
 * that matches keeps this working across shapes rather than hard-failing on a
 * field rename we cannot see from here.
 */
export function pickField(payload: any, names: string[]): any {
  if (!payload || typeof payload !== 'object') return undefined;
  const scopes = [payload, payload.data, payload.result, payload.call, payload.plan].filter(
    (s) => s && typeof s === 'object'
  );
  for (const scope of scopes) {
    for (const name of names) {
      if (scope[name] !== undefined && scope[name] !== null) return scope[name];
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- transport

async function calleJson(args: string[], step: string): Promise<any> {
  const [bin, ...prefix] = resolveCliCommand();
  const argv = [...prefix, ...args];

  let stdout: string;
  try {
    const result = await execFileAsync(bin, argv, {
      env: { ...process.env, ...CALLE_ENV },
      timeout: Number(process.env.CALLE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      maxBuffer: 8 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err: any) {
    // Never surface raw stderr to a caller: it can carry a login URL.
    const detail = String(err?.code === 'ENOENT' ? 'CALL-E CLI not found on PATH' : err?.message || err)
      .split('\n')[0]
      .slice(0, 200);
    throw new CalleError(`CALL-E ${step} failed: ${detail}`, step);
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new CalleError(`CALL-E ${step} returned non-JSON output`, step);
  }
}

// ---------------------------------------------------------------- steps

export interface CallPlan {
  planId: string;
  confirmToken: string;
  /** Numbers the plan intends to dial, as CALL-E reported them. */
  targets: string[];
  raw: any;
}

/**
 * Verified against `@call-e/cli`, which answers with:
 *   { server_url, cache_path, cache_exists, pending_exists, usable,
 *     expires_at, pending_status, pending_login_url }
 * `usable` is the field that decides it. The others turn "not authorized" into
 * something the caregiver's log can act on — never logged in on this machine is
 * a different problem from a token that has aged out.
 */
export async function authStatus(): Promise<{ authorized: boolean; detail?: string }> {
  if (isDryRun()) return { authorized: true, detail: 'dry-run' };
  const payload = await calleJson(['auth', 'status'], 'auth status');

  const usable = pickField(payload, ['usable', 'is_usable', 'isUsable']);
  const fallback = pickField(payload, ['token', 'has_token', 'hasToken', 'authorized', 'valid']);
  if (Boolean(usable ?? fallback)) return { authorized: true };

  const cacheExists = pickField(payload, ['cache_exists', 'cacheExists']);
  const expiresAt = pickField(payload, ['expires_at', 'expiresAt']);
  const detail =
    cacheExists === false
      ? 'no CALL-E login on this machine'
      : expiresAt
        ? `the CALL-E token expired at ${expiresAt}`
        : 'no usable CALL-E token';
  // The login URL is deliberately not echoed — it is a credential.
  return { authorized: false, detail };
}

export async function planCall(opts: {
  toPhone: string;
  goal: string;
  timezone: string;
  language?: string;
  region?: string;
}): Promise<CallPlan> {
  if (!isE164(opts.toPhone)) {
    throw new CalleError('destination must be an E.164 number (e.g. +15551234567)', 'call plan');
  }

  if (isDryRun()) {
    return {
      planId: 'plan_dryrun_0001',
      confirmToken: 'token_dryrun_0001',
      targets: [opts.toPhone],
      raw: { dry_run: true, goal: opts.goal },
    };
  }

  const args = ['call', 'plan', '--to-phone', opts.toPhone, '--goal', opts.goal, '--timezone', opts.timezone];
  // Language and region are hints CALL-E only wants when actually known.
  if (opts.language) args.push('--language', opts.language);
  if (opts.region) args.push('--region', opts.region);

  const payload = await calleJson(args, 'call plan');
  const planId = pickField(payload, ['plan_id', 'planId', 'id']);
  const confirmToken = pickField(payload, ['confirm_token', 'confirmToken', 'confirmation_token']);
  if (!planId || !confirmToken) {
    throw new CalleError('CALL-E plan did not return a plan id and confirmation token', 'call plan');
  }

  const rawTargets =
    pickField(payload, ['to_phone', 'toPhone', 'to', 'phone_numbers', 'phoneNumbers', 'targets']) ?? [];
  const targets = (Array.isArray(rawTargets) ? rawTargets : [rawTargets])
    .map((t: any) => (typeof t === 'string' ? t : t?.phone || t?.number || ''))
    .filter(Boolean);

  return { planId: String(planId), confirmToken: String(confirmToken), targets, raw: payload };
}

/**
 * The gate between planning and dialling. A plan is only allowed to run when
 * it dials exactly the one number the caregiver configured — nothing else, and
 * nothing extra. When CALL-E does not echo the destination back, we accept the
 * plan (there is nothing to contradict) but say so, so the caller can log it.
 */
export function inspectPlan(plan: CallPlan, expectedPhone: string): { ok: boolean; reason: string } {
  if (!plan.planId || !plan.confirmToken) {
    return { ok: false, reason: 'plan is missing its id or confirmation token' };
  }
  if (plan.targets.length === 0) {
    return { ok: true, reason: 'plan did not echo a destination; proceeding on the configured number' };
  }
  const unexpected = plan.targets.filter((t) => t.replace(/[^\d+]/g, '') !== expectedPhone);
  if (unexpected.length > 0) {
    return { ok: false, reason: `plan targets an unexpected number (${maskPhone(unexpected[0])})` };
  }
  if (plan.targets.length > 1) {
    return { ok: false, reason: 'plan targets more than one number; a check-in call is always one call' };
  }
  return { ok: true, reason: 'plan targets the configured number' };
}

export async function runCall(opts: {
  planId: string;
  confirmToken: string;
  timezone: string;
}): Promise<{ runId: string; raw: any }> {
  if (isDryRun()) return { runId: 'run_dryrun_0001', raw: { dry_run: true } };

  const payload = await calleJson(
    ['call', 'run', '--plan-id', opts.planId, '--confirm-token', opts.confirmToken, '--timezone', opts.timezone],
    'call run'
  );
  const runId = pickField(payload, ['run_id', 'runId', 'id']);
  if (!runId) throw new CalleError('CALL-E run did not return a run id', 'call run');
  return { runId: String(runId), raw: payload };
}

export interface CallActivity {
  speaker: 'agent' | 'recipient' | 'system';
  text: string;
}

export interface CallStatus {
  runId: string;
  state: string;
  answered: boolean;
  activity: CallActivity[];
  raw: any;
}

/** Scripted transcript for dry runs, so the parsing and escalation paths are
 *  exercisable end to end. CALLE_DRY_RUN_TRANSCRIPT overrides it (newline
 *  separated, "agent:" / "recipient:" prefixes). */
function dryRunActivity(): CallActivity[] {
  const scripted = process.env.CALLE_DRY_RUN_TRANSCRIPT;
  if (scripted) {
    return scripted
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [head, ...rest] = line.split(':');
        const speaker = head.trim().toLowerCase();
        return {
          speaker: speaker === 'agent' || speaker === 'recipient' ? (speaker as any) : 'system',
          text: rest.join(':').trim() || line,
        };
      });
  }
  return [
    { speaker: 'agent', text: 'Hello Eleanor, it is Yadira. I was thinking of you this morning.' },
    { speaker: 'recipient', text: 'Oh, hello. I was just sitting with my tea.' },
    { speaker: 'agent', text: 'That sounds lovely. How are you feeling today?' },
    { speaker: 'recipient', text: 'A bit worried, I think. I could not find my glasses.' },
    { speaker: 'agent', text: 'That happens to all of us. You are safe, and they will turn up.' },
  ];
}

export async function getCallStatus(opts: { runId: string; timezone: string }): Promise<CallStatus> {
  if (isDryRun()) {
    return {
      runId: opts.runId,
      state: 'completed',
      answered: true,
      activity: dryRunActivity(),
      raw: { dry_run: true },
    };
  }

  const payload = await calleJson(
    ['call', 'status', '--run-id', opts.runId, '--timezone', opts.timezone],
    'call status'
  );
  const state = String(pickField(payload, ['state', 'status', 'call_status']) ?? 'unknown');
  const rawActivity = pickField(payload, ['activity', 'activities', 'transcript', 'events']) ?? [];

  const activity: CallActivity[] = (Array.isArray(rawActivity) ? rawActivity : []).map((entry: any) => {
    const speakerRaw = String(entry?.speaker ?? entry?.role ?? entry?.from ?? '').toLowerCase();
    const speaker: CallActivity['speaker'] =
      speakerRaw.includes('agent') || speakerRaw.includes('assistant') || speakerRaw.includes('bot')
        ? 'agent'
        : speakerRaw.includes('user') || speakerRaw.includes('recipient') || speakerRaw.includes('callee')
          ? 'recipient'
          : 'system';
    return { speaker, text: String(entry?.text ?? entry?.content ?? entry?.message ?? '').trim() };
  }).filter((a: CallActivity) => a.text);

  // "Answered" is reported when CALL-E says so; otherwise infer it from the
  // recipient having actually said something.
  const answeredField = pickField(payload, ['answered', 'was_answered', 'picked_up']);
  const answered =
    typeof answeredField === 'boolean' ? answeredField : activity.some((a) => a.speaker === 'recipient');

  return { runId: opts.runId, state, answered, activity, raw: payload };
}

/**
 * The whole documented flow, with the inspect gate in the middle. Returns the
 * run id and the settled status; the caller turns the transcript into
 * something the caregiver can read (see checkInCall.ts).
 */
export async function placeOneCall(opts: {
  toPhone: string;
  goal: string;
  timezone: string;
  language?: string;
  region?: string;
}): Promise<{ runId: string; status: CallStatus; inspection: string }> {
  const auth = await authStatus();
  if (!auth.authorized) {
    throw new CalleError(`CALL-E is not authorized (${auth.detail}). Run: calle auth login`, 'auth status');
  }

  const plan = await planCall(opts);
  const inspection = inspectPlan(plan, opts.toPhone);
  if (!inspection.ok) {
    throw new CalleError(`refusing to place the call — ${inspection.reason}`, 'inspect');
  }
  console.info(`[Yadira CALL-E] plan ${plan.planId} → ${maskPhone(opts.toPhone)} (${inspection.reason})`);

  const run = await runCall({ planId: plan.planId, confirmToken: plan.confirmToken, timezone: opts.timezone });
  const status = await getCallStatus({ runId: run.runId, timezone: opts.timezone });
  return { runId: run.runId, status, inspection: inspection.reason };
}
