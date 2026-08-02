// Transactional email for Yadira — the post-signup welcome message.
// ------------------------------------------------------------------
// Same pattern as the Stripe/Inworld integrations: direct fetch against
// the provider's REST API (Resend), no SDK, and a graceful no-op when
// the env key is missing so signup never breaks on email problems.
//
// Env: RESEND_API_KEY (re_...) — see EMAIL-SETUP.md.
//      EMAIL_FROM (optional) — defaults to "Yadira <welcome@yadira.chat>";
//      the domain must be verified in Resend before real sends work.

import express from 'express';
import type { AuthenticatedRequest } from './auth';
import {
  renderBriefingEmail,
  alreadySentThisWeek,
  markWeeklySent,
  clearWeeklySent,
} from './briefingEmail';

const RESEND_API = 'https://api.resend.com/emails';

const resendKey = () => process.env.RESEND_API_KEY;
const isEmailConfigured = () => {
  const key = resendKey();
  return !!key && key.trim() !== '' && key !== 'MY_RESEND_API_KEY';
};
const fromAddress = () => process.env.EMAIL_FROM || 'Yadira <welcome@yadira.chat>';

// One welcome per address per server lifetime — guards double-fires
// (React re-renders, request retries), not a durable send record.
const alreadySent = new Set<string>();

// The welcome email. Table layout + inline styles for email-client
// compatibility; the logo is served from the production site because
// email clients need absolute image URLs.
const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Welcome to Yadira</title>

<style>
  /* Only what cannot inline. Many clients drop this — the email reads fully from inline styles. */
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  a { color:#3A5D45; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
    .stack { display:block !important; width:100% !important; padding:0 0 12px 0 !important; }
    .h1 { font-size:30px !important; line-height:1.18 !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#E7E1D3;">

  <!-- preheader -->
  <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all;">You’re in. Here’s how to introduce your loved one to Yadira — free for families, always.</span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#E7E1D3;">
    <tbody><tr>
      <td align="center" style="padding:32px 12px 40px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px; background-color:#FBF8F0; border-radius:20px; overflow:hidden;">

          <!-- brand bar -->
          <tbody><tr>
            <td align="center" class="px" style="padding:34px 48px 26px 48px; background-color:#FBF8F0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
                <td><a href="https://yadira.chat" target="_blank" style="text-decoration:none;"><img src="https://yadira.chat/yadira-logo.png" width="176" height="96" alt="Yadira" style="display:block; width:176px; height:96px; border:0;"></a></td>
              </tr></tbody></table>
            </td>
          </tr>

          <!-- hero -->
          <tr>
            <td class="px" style="padding:8px 56px 44px 56px; background-color:#FBF8F0;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr><td align="center">
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; color:#5C8D71; padding-bottom:18px;">Welcome to the family</div>
                <div class="h1" style="font-family:Georgia,'Times New Roman',serif; font-size:38px; line-height:1.18; color:#2F4A38; padding-bottom:18px;">You’re in. Now let’s make an introduction.</div>
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:17px; line-height:1.6; color:#6B6558;">Thank you for trusting us with someone you love. Yadira is a gentle, always-patient companion for people living with dementia — and a clear-eyed toolkit for the people caring for them.</div>
              </td></tr></tbody></table>
            </td>
          </tr>

          <!-- primary CTA -->
          <tr>
            <td align="center" class="px" style="padding:0 56px 44px 56px; background-color:#FBF8F0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
                <td align="center" bgcolor="#3A5D45" style="border-radius:999px;">
                  <a href="https://yadira.chat" target="_blank" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#FBF8F0; text-decoration:none; padding:16px 40px; border-radius:999px;">Set up your companion →</a>
                </td>
              </tr></tbody></table>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:13px; color:#8A8981; padding-top:14px;">Takes about 5 minutes · Free for families, always</div>
            </td>
          </tr>

          <!-- divider -->
          <tr><td class="px" style="padding:0 56px; background-color:#FBF8F0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr><td height="1" style="height:1px; background-color:#EBE4D3; line-height:1px; font-size:1px;">&nbsp;</td></tr></tbody></table></td></tr>

          <!-- getting started -->
          <tr>
            <td class="px" style="padding:40px 56px 8px 56px; background-color:#FBF8F0;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:24px; color:#2F4A38; padding-bottom:6px;">Getting started, gently</div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#6B6558; padding-bottom:26px;">Three small steps to a warmer first conversation.</div>
            </td>
          </tr>

          <!-- step 1 -->
          <tr><td class="px" style="padding:0 56px 20px 56px; background-color:#FBF8F0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
              <td width="52" valign="top" style="width:52px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td align="center" valign="middle" width="40" height="40" bgcolor="#EDF3ED" style="width:40px; height:40px; border-radius:50%; font-family:Georgia,serif; font-size:18px; color:#3A5D45;">1</td></tr></tbody></table>
              </td>
              <td valign="top" style="padding-left:14px;">
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#38352D; padding-bottom:3px;">Tell Yadira who they are</div>
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:14.5px; line-height:1.55; color:#6B6558;">Share a few stories, names, and touchstones — the blue Ford, the wedding waltz. Yadira meets them where they are.</div>
              </td>
            </tr></tbody></table>
          </td></tr>

          <!-- step 2 -->
          <tr><td class="px" style="padding:0 56px 20px 56px; background-color:#FBF8F0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
              <td width="52" valign="top" style="width:52px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td align="center" valign="middle" width="40" height="40" bgcolor="#EDF3ED" style="width:40px; height:40px; border-radius:50%; font-family:Georgia,serif; font-size:18px; color:#3A5D45;">2</td></tr></tbody></table>
              </td>
              <td valign="top" style="padding-left:14px;">
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#38352D; padding-bottom:3px;">Start a first conversation</div>
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:14.5px; line-height:1.55; color:#6B6558;">Open Call Mode and let it ring — a familiar phone call, answered by a warm, patient voice that never tires.</div>
              </td>
            </tr></tbody></table>
          </td></tr>

          <!-- step 3 -->
          <tr><td class="px" style="padding:0 56px 38px 56px; background-color:#FBF8F0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
              <td width="52" valign="top" style="width:52px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td align="center" valign="middle" width="40" height="40" bgcolor="#EDF3ED" style="width:40px; height:40px; border-radius:50%; font-family:Georgia,serif; font-size:18px; color:#3A5D45;">3</td></tr></tbody></table>
              </td>
              <td valign="top" style="padding-left:14px;">
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#38352D; padding-bottom:3px;">Check the caregiver dashboard</div>
                <div style="font-family:Arial,Helvetica,sans-serif; font-size:14.5px; line-height:1.55; color:#6B6558;">See gentle daily mood check-ins and insight reports — a clearer picture of how they’re really doing.</div>
              </td>
            </tr></tbody></table>
          </td></tr>

          <!-- reassurance card -->
          <tr>
            <td class="px" style="padding:0 56px 44px 56px; background-color:#FBF8F0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#F1F6F1" style="background-color:#F1F6F1; border-radius:16px;">
                <tbody><tr><td style="padding:26px 30px;">
                  <div style="font-family:Georgia,'Times New Roman',serif; font-style:italic; font-size:19px; line-height:1.5; color:#2F4A38; padding-bottom:10px;">“The need doesn’t go away when the person does. Yadira gives it somewhere to go.”</div>
                  <div style="font-family:Arial,Helvetica,sans-serif; font-size:13.5px; line-height:1.6; color:#6B6558;">Everything Yadira does is built on <b style="color:#38352D;">validation therapy</b> — comfort over correction. We’re honored to sit beside you in this.</div>
                </td></tr>
              </tbody></table>
            </td>
          </tr>

          <!-- help bar -->
          <tr>
            <td class="px" align="center" style="padding:30px 56px; background-color:#F4EFE4;">
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:14.5px; color:#6B6558; line-height:1.6;">Questions, or want to walk through setup with a person?</div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; padding-top:4px;"><a href="mailto:contact@yadira.chat" style="color:#3A5D45; text-decoration:none;">contact@yadira.chat</a></div>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td class="px" align="center" style="padding:28px 48px 34px 48px; background-color:#2F4A38;">
              <div style="font-family:Georgia,'Times New Roman',serif; font-size:20px; letter-spacing:1px; color:#FBF8F0; padding-bottom:14px;">Yadira</div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.7; color:#B9C9BC;">Yadira is a comfort and caregiving companion — <b style="color:#FBF8F0;">not a medical device</b>. In an emergency, always contact emergency services.</div>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.7; color:#8FA593; padding-top:14px;">
                <a href="mailto:contact@yadira.chat?subject=Email%20preferences" style="color:#B9C9BC; text-decoration:underline;">Email preferences</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="mailto:contact@yadira.chat?subject=Unsubscribe" style="color:#B9C9BC; text-decoration:underline;">Unsubscribe</a>
              </div>
            </td>
          </tr>

        </tbody></table>

      </td>
    </tr>
  </tbody></table>

</body></html>`;

export function registerEmailRoutes(app: express.Express) {
  // The week, as an email. Asked for on app load (auto=true, at most one a
  // week) and by the "Email me the week" button (auto=false, always sends).
  //
  // A weekly briefing CALL would need a scheduler this architecture does not
  // have; an inbox waits, so the digest arriving when the caregiver next opens
  // the app is still a weekly digest. The honest limitation: a caregiver who
  // never opens the app gets no email. That is a smaller failure than a phone
  // ringing at an arbitrary hour on a promise we could not keep.
  app.post('/api/email/briefing', async (req: AuthenticatedRequest, res: express.Response) => {
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'email_not_configured' });
    }

    // Always the authenticated account's own address. Never the body — an
    // endpoint that mails a person's health summary wherever a caller asks is
    // an exfiltration route with a friendly name.
    const to = req.user?.email;
    if (!to || !to.includes('@')) {
      return res.status(400).json({ error: 'The authenticated account has no email address' });
    }
    if (to.endsWith('@yadira.local')) return res.json({ ok: true, skipped: 'local-demo' });

    const circle = String((req as any).user?.uid || to).toLowerCase();
    const auto = req.body?.auto === true;
    if (auto && alreadySentThisWeek(circle)) {
      return res.json({ ok: true, skipped: 'already-sent-this-week' });
    }
    // Claimed before sending so two tabs loading at once cannot both send.
    if (auto) markWeeklySent(circle);

    try {
      const { subject, html, text } = renderBriefingEmail({
        patientName: String(req.body?.patientName || 'your loved one'),
        caregiverName: req.body?.caregiverName ? String(req.body.caregiverName) : undefined,
        briefing: String(req.body?.briefing || ''),
        alerts: Array.isArray(req.body?.alerts) ? req.body.alerts.map(String).slice(0, 8) : [],
        tips: Array.isArray(req.body?.tips) ? req.body.tips.map(String).slice(0, 8) : [],
        at: Date.now(),
      });

      const response = await fetch(RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text }),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || `Resend API error ${response.status}`);
      res.json({ ok: true, id: data?.id || null });
    } catch (err: any) {
      // A failed send must not consume the week, or one Resend outage costs
      // the family an update and nothing says so.
      if (auto) clearWeeklySent(circle);
      console.error('[Email] briefing send failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to send the weekly update' });
    }
  });

  // Sent by the client right after a successful signup (email/password, or a
  // first-time Google sign-in). The recipient is always the authenticated
  // account's own email — the endpoint takes no address from the body, so it
  // can't be used to spam arbitrary inboxes.
  app.post('/api/email/welcome', async (req: AuthenticatedRequest, res: express.Response) => {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: 'email_not_configured',
        message: 'RESEND_API_KEY is not set — welcome email skipped.',
      });
    }

    const to = req.user?.email;
    if (!to || !to.includes('@')) {
      return res.status(400).json({ error: 'The authenticated account has no email address' });
    }
    // Local demo accounts use fake @yadira.local addresses — nothing to send.
    if (to.endsWith('@yadira.local')) return res.json({ ok: true, skipped: 'local-demo' });

    const key = to.toLowerCase();
    if (alreadySent.has(key)) return res.json({ ok: true, deduped: true });

    try {
      const response = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [to],
          subject: 'Welcome to Yadira',
          html: WELCOME_HTML,
        }),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || `Resend API error ${response.status}`);
      }
      alreadySent.add(key);
      res.json({ ok: true, id: data?.id || null });
    } catch (err: any) {
      console.error('[Email] welcome send failed:', err.message || err);
      res.status(502).json({ error: err.message || 'Failed to send welcome email' });
    }
  });
}
