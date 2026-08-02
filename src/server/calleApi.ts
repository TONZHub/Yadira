// CALL-E Developer API — the transport a server should actually use.
// ------------------------------------------------------------------
// The CLI route (calle.ts) shells out to a binary that caches a per-machine
// OAuth token under ~/.calle-mcp/cli. That is fine on a laptop and wrong for a
// deployment: the token cannot be shipped, does not survive a redeploy, and
// the binary has to exist on the host. This transport is plain HTTPS with a
// static Bearer key, so a deploy needs one environment variable and nothing
// else — no child process, no binary to find, no login per machine.
//
// It is also a better fit for what a check-in call is FOR. `recipient_result_schema`
// lets us declare the readout we want and get it back validated, instead of
// inferring a person's state from a transcript with regular expressions.
//
//   POST /v1/calls           create the task
//   GET  /v1/calls/{id}      status, structured_result, transcripts
//
// Preferred whenever CALLE_API_KEY is set; calle.ts remains the fallback.

const DEFAULT_BASE_URL = 'https://api.heycall-e.com';

export class CalleApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'CalleApiError';
  }
}

export function apiBaseUrl(): string {
  return (process.env.CALLE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function hasApiKey(): boolean {
  const key = (process.env.CALLE_API_KEY || '').trim();
  return key.length > 0 && key !== 'MY_CALLE_API_KEY';
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${(process.env.CALLE_API_KEY || '').trim()}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) }, signal: controller.signal });
  } catch (err: any) {
    throw new CalleApiError(`CALL-E API unreachable: ${String(err?.message || err).split('\n')[0]}`);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text();
  let body: any;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new CalleApiError(`CALL-E API returned non-JSON (HTTP ${res.status})`, res.status);
  }
  if (!res.ok) {
    // Surface the API's own message; it never contains our key.
    const detail = body?.error?.message || body?.message || `HTTP ${res.status}`;
    throw new CalleApiError(`CALL-E API error: ${detail}`, res.status);
  }
  return body;
}

// ---------------------------------------------------------------- types

/** Documented transcript turn. Speakers are "bot" and "user". */
export interface TranscriptTurn {
  offset_seconds?: number;
  speaker?: string;
  text?: string;
}

export interface CalleCallResult {
  callId: string;
  status: string;
  taskCompleted?: boolean;
  confidence?: { score?: number; label?: string };
  evidence: string[];
  /** Validated against the recipient_result_schema we sent. */
  recipientResult: Record<string, any> | null;
  turns: TranscriptTurn[];
  raw: any;
}

export interface CreateCallOptions {
  task: string;
  phone: string;
  region?: string;
  locale?: string;
  recipientResultSchema?: Record<string, any>;
  /** Makes a retried request safe — the same key never places a second call. */
  idempotencyKey?: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------- calls

export async function createCall(opts: CreateCallOptions): Promise<string> {
  const body: Record<string, any> = {
    task: opts.task,
    recipients: [
      {
        phones: [opts.phone],
        ...(opts.region ? { region: opts.region } : {}),
        ...(opts.locale ? { locale: opts.locale } : {}),
      },
    ],
  };
  if (opts.recipientResultSchema) body.recipient_result_schema = opts.recipientResultSchema;
  if (opts.webhookUrl) body.webhook_url = opts.webhookUrl;
  if (opts.metadata) body.metadata = opts.metadata;

  const payload = await apiFetch('/v1/calls', {
    method: 'POST',
    headers: opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {},
    body: JSON.stringify(body),
  });

  const callId = payload?.call_id || payload?.id || payload?.data?.call_id;
  if (!callId) throw new CalleApiError('CALL-E did not return a call id');
  return String(callId);
}

/** Statuses we stop polling on. Anything unrecognised keeps polling until the
 *  overall deadline, so a new status name delays rather than breaks a call. */
const TERMINAL = new Set(['completed', 'failed', 'canceled', 'cancelled', 'expired', 'error']);

export function isTerminal(status: string): boolean {
  return TERMINAL.has((status || '').toLowerCase());
}

export async function getCall(callId: string): Promise<CalleCallResult> {
  const payload = await apiFetch(`/v1/calls/${encodeURIComponent(callId)}`, { method: 'GET' });
  const recipient = Array.isArray(payload?.recipients) ? payload.recipients[0] : undefined;
  const attempts = Array.isArray(recipient?.attempts) ? recipient.attempts : [];

  // Turns across every attempt, in order — a redial is still the same call.
  const turns: TranscriptTurn[] = attempts.flatMap((a: any) =>
    Array.isArray(a?.transcript_turns) ? a.transcript_turns : []
  );

  return {
    callId,
    status: String(payload?.status ?? 'unknown'),
    taskCompleted: payload?.task_completed,
    confidence: payload?.completion_confidence,
    evidence: Array.isArray(payload?.evidence) ? payload.evidence.map(String) : [],
    recipientResult: recipient?.structured_result ?? null,
    turns,
    raw: payload,
  };
}

/**
 * Create the call and wait for it to finish.
 *
 * Polling rather than webhooks: a webhook needs a publicly reachable URL, which
 * a caregiver's laptop and a local dev server do not have. `webhook_url` is
 * still passed through when configured, so a deployment can use both.
 */
export async function placeCallAndWait(
  opts: CreateCallOptions & { pollIntervalMs?: number; maxWaitMs?: number }
): Promise<CalleCallResult> {
  const callId = await createCall(opts);
  const interval = opts.pollIntervalMs ?? 5_000;
  const deadline = Date.now() + (opts.maxWaitMs ?? 10 * 60_000);

  let last = await getCall(callId);
  while (!isTerminal(last.status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    last = await getCall(callId);
  }
  return last;
}
