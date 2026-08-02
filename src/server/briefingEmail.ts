// The week, as an email.
// ------------------------------------------------------------------
// A weekly briefing CALL needs a scheduler this architecture does not have —
// the server holds no durable state, so "every Sunday" would really mean
// "whenever they next open the app", and a phone ringing at an arbitrary
// moment is not a thing to be casual about.
//
// An inbox waits. A digest that arrives when the caregiver next opens the app
// is still a weekly digest, because it sits there until read. Same content as
// the phone briefing, no timing promise to break.
//
// ---- What an email is that a phone call is not ----
//
// Persistent, forwardable, and previewed. It lands on a lock screen in a
// waiting room, syncs to a work laptop, and sits in an inbox a spouse also
// reads. So the disclosure rule is the voicemail rule, one step stricter:
//
//   · the SUBJECT names nobody and says nothing
//   · the PREHEADER — the grey line clients show next to the subject — names
//     nobody either, because it is visible without opening anything
//   · the detail starts below the fold, where opening it was a choice
//
// The recipient is always the authenticated account's own address. It is
// never read from the request body: an endpoint that emails a person's health
// summary to an address a caller supplies is an exfiltration route with a
// friendly name.

export interface BriefingEmailInput {
  patientName: string;
  caregiverName?: string;
  /** Prose, from the same insights the hub shows on screen. */
  briefing: string;
  /** "Worth watching" items, if an insights report has been run. */
  alerts?: string[];
  tips?: string[];
  /** When the week ends — used for the dedupe key and the dateline. */
  at: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Caregiver-supplied text reaches this HTML. Escape everything. */
export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ISO-week key, so the client can ask on every app load and at most one
 * digest goes out per week without any scheduler existing.
 */
export function weekKey(at: number): string {
  const d = new Date(at);
  d.setUTCHours(0, 0, 0, 0);
  // Thursday of the current week decides the ISO year.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7)
  );
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * The subject line.
 *
 * Names nobody, describes nothing, and is identical every week. A subject
 * that varied with the content — "A difficult week for Eleanor" — would leak
 * the week's shape to anyone glancing at a phone on a table.
 */
export const BRIEFING_SUBJECT = 'Your Yadira weekly update';

/**
 * The preheader, which clients display beside the subject without opening.
 * Held to the same rule for the same reason.
 */
export const BRIEFING_PREHEADER = 'A summary of the week is ready to read.';

export function renderBriefingEmail(input: BriefingEmailInput): RenderedEmail {
  const them = input.patientName || 'your loved one';
  const hello = input.caregiverName ? `Hello ${input.caregiverName},` : 'Hello,';
  const dateline = new Date(input.at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const hasContent = Boolean((input.briefing || '').trim());
  const body = hasContent
    ? input.briefing.trim()
    : `There is not enough recorded yet to draw anything from. Once a few more days are logged, this update will have something real in it — Yadira will not invent a week that did not happen.`;

  const alerts = (input.alerts || []).filter(Boolean);
  const tips = (input.tips || []).filter(Boolean);

  const text = [
    hello,
    '',
    `Here is how ${them}'s week went, to ${dateline}.`,
    '',
    body,
    ...(alerts.length ? ['', 'Worth watching:', ...alerts.map((a) => `  - ${a}`)] : []),
    ...(tips.length ? ['', 'A few things that might help:', ...tips.map((t) => `  - ${t}`)] : []),
    '',
    'This is a summary, not a medical assessment. Anything that worries you is a question for their doctor.',
    '',
    '— Yadira',
  ].join('\n');

  const list = (items: string[]) =>
    items
      .map(
        (i) =>
          `<li style="margin:0 0 6px;color:#5E5D57;font-size:14px;line-height:1.6">${escapeHtml(i)}</li>`
      )
      .join('');

  const html = `<div style="background:#F4F1EA;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(BRIEFING_PREHEADER)}</span>
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E3DFC2;border-radius:20px;padding:28px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7E7D76">Yadira · weekly update</p>
    <p style="margin:0 0 18px;font-size:12px;color:#A6A27B">to ${escapeHtml(dateline)}</p>
    <p style="margin:0 0 14px;font-size:15px;color:#2C2C2A">${escapeHtml(hello)}</p>
    <p style="margin:0 0 14px;font-size:15px;color:#2C2C2A">Here is how ${escapeHtml(them)}&rsquo;s week went.</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#5E5D57">${escapeHtml(body)}</p>
    ${
      alerts.length
        ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#2C2C2A">Worth watching</p><ul style="margin:0;padding-left:18px">${list(alerts)}</ul>`
        : ''
    }
    ${
      tips.length
        ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#2C2C2A">A few things that might help</p><ul style="margin:0;padding-left:18px">${list(tips)}</ul>`
        : ''
    }
    <p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #EFECDD;font-size:12px;line-height:1.6;color:#7E7D76">
      This is a summary, not a medical assessment. Anything that worries you is a question for ${escapeHtml(them)}&rsquo;s doctor.
    </p>
  </div>
</div>`;

  return { subject: BRIEFING_SUBJECT, html, text };
}

// ---- Weekly dedupe -------------------------------------------------------
// The client may ask on every app load. At most one digest goes out per
// circle per ISO week, which is what makes "weekly" true without a scheduler.

const sentWeeks = new Map<string, string>();

export function alreadySentThisWeek(circle: string, at = Date.now()): boolean {
  return sentWeeks.get(circle) === weekKey(at);
}

export function markWeeklySent(circle: string, at = Date.now()): void {
  sentWeeks.set(circle, weekKey(at));
}

/** A send that failed must not consume the week. */
export function clearWeeklySent(circle: string): void {
  sentWeeks.delete(circle);
}

export function __resetWeeklySent(): void {
  sentWeeks.clear();
}
