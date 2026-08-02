// Tests for the weekly briefing email.
//
// An email is not a phone call. It persists, it forwards, and — the part that
// matters — it is PREVIEWED. The subject and the preheader are visible on a
// lock screen in a waiting room, on a work laptop, in an inbox a spouse also
// reads. Nobody chose to see those; they chose to open the email.
//
// So the disclosure boundary sits between the preview and the body, and that
// is what most of this file is about.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderBriefingEmail,
  escapeHtml,
  weekKey,
  BRIEFING_SUBJECT,
  BRIEFING_PREHEADER,
  alreadySentThisWeek,
  markWeeklySent,
  clearWeeklySent,
  __resetWeeklySent,
} from './briefingEmail';

const at = new Date('2026-08-02T12:00:00Z').getTime();

const input = {
  patientName: 'Eleanor',
  caregiverName: 'Thomas',
  briefing: 'Eleanor was calm most days. Tuesday she was restless and asked for her mother twice.',
  alerts: ['Two nights of broken sleep in a row'],
  tips: ['Try the lake house photos when she is unsettled'],
  at,
};

describe('nothing is disclosed before someone chooses to open it', () => {
  test('the subject names nobody', () => {
    assert.doesNotMatch(BRIEFING_SUBJECT, /Eleanor/i);
    assert.doesNotMatch(BRIEFING_SUBJECT, /Thomas/i);
  });

  test('the subject does not vary with the week', () => {
    // "A difficult week for Eleanor" would leak the week's shape to anyone
    // glancing at a phone face-up on a table. Identical every time is the
    // point, not a missing feature.
    const calm = renderBriefingEmail({ ...input, briefing: 'A calm, steady week.', alerts: [] });
    const hard = renderBriefingEmail({
      ...input,
      briefing: 'A distressing week with several difficult nights.',
      alerts: ['Increasing agitation'],
    });
    assert.equal(calm.subject, hard.subject);
  });

  test('the preheader names nobody and says nothing', () => {
    assert.doesNotMatch(BRIEFING_PREHEADER, /Eleanor/i);
    assert.doesNotMatch(BRIEFING_PREHEADER, /restless|sleep|agitat|mood/i);
  });

  test('the preheader is what appears first in the HTML, ahead of any detail', () => {
    // Clients take the preview from the first text in the document. If the
    // briefing came first, the preview would be the briefing.
    const { html } = renderBriefingEmail(input);
    assert.ok(html.indexOf(BRIEFING_PREHEADER) < html.indexOf('restless'));
  });
});

describe('the detail is all there once it is opened', () => {
  const { html, text } = renderBriefingEmail(input);

  test('the briefing itself is in both parts', () => {
    assert.match(html, /asked for her mother twice/);
    assert.match(text, /asked for her mother twice/);
  });

  test('alerts and tips are carried through', () => {
    assert.match(html, /Two nights of broken sleep/);
    assert.match(text, /Try the lake house photos/);
  });

  test('it says plainly that it is not a medical assessment', () => {
    // The same line the phone briefing carries. A weekly summary of someone's
    // moods reads like a clinical document if nothing says otherwise.
    assert.match(html, /not a medical assessment/i);
    assert.match(text, /not a medical assessment/i);
    assert.match(text, /question for their doctor/i);
  });

  test('a week with nothing logged is not invented', () => {
    const empty = renderBriefingEmail({ ...input, briefing: '  ', alerts: [], tips: [] });
    assert.match(empty.text, /not enough recorded yet/i);
    assert.match(empty.text, /will not invent a week that did not happen/i);
  });

  test('works without a caregiver name', () => {
    const anon = renderBriefingEmail({ ...input, caregiverName: undefined });
    assert.match(anon.text, /^Hello,/);
    assert.doesNotMatch(anon.text, /undefined/);
  });

  test('empty alert and tip lists produce no empty headings', () => {
    const bare = renderBriefingEmail({ ...input, alerts: [], tips: [] });
    assert.doesNotMatch(bare.html, /Worth watching/);
    assert.doesNotMatch(bare.text, /A few things that might help/);
  });
});

describe('caregiver-written text cannot become markup', () => {
  // Patient names, log notes and AI-generated tips all reach this HTML, and
  // all of them originate in a text box a person types into.

  test('escapes the characters that would break out', () => {
    assert.equal(escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });

  test('a script tag in the patient name lands as text', () => {
    const nasty = renderBriefingEmail({
      ...input,
      patientName: '<script>alert(1)</script>',
    });
    assert.doesNotMatch(nasty.html, /<script>/);
    assert.match(nasty.html, /&lt;script&gt;/);
  });

  test('a script tag in an alert lands as text', () => {
    const nasty = renderBriefingEmail({ ...input, alerts: ['<img src=x onerror=alert(1)>'] });
    assert.doesNotMatch(nasty.html, /<img src=x/);
    assert.match(nasty.html, /&lt;img src=x/);
  });
});

describe('at most one digest a week, without a scheduler existing', () => {
  // The client asks on every app load. This is what makes "weekly" true.

  test('the same week is only sent once', () => {
    __resetWeeklySent();
    assert.equal(alreadySentThisWeek('circle-a', at), false);
    markWeeklySent('circle-a', at);
    // Same ISO week — `at` is a Sunday, so anything more than a few hours
    // later has already rolled into the next one. That is the intended
    // behaviour (weeks roll Monday), which is why the offset here is hours.
    assert.equal(alreadySentThisWeek('circle-a', at + 6 * 3600000), true);
  });

  test('the next week is a new send', () => {
    __resetWeeklySent();
    markWeeklySent('circle-a', at);
    assert.equal(alreadySentThisWeek('circle-a', at + 8 * 86400000), false);
  });

  test('one family never suppresses another', () => {
    __resetWeeklySent();
    markWeeklySent('circle-a', at);
    assert.equal(alreadySentThisWeek('circle-b', at), false);
  });

  test('a send that failed does not consume the week', () => {
    // Same lesson the call cooldowns learned. Otherwise one Resend outage
    // costs the family a whole week's update and nothing says so.
    __resetWeeklySent();
    markWeeklySent('circle-a', at);
    clearWeeklySent('circle-a');
    assert.equal(alreadySentThisWeek('circle-a', at), false);
  });

  test('the week key rolls on Monday, not on the seventh day after sending', () => {
    // 2026-08-02 is a Sunday; 2026-08-03 is the Monday after it.
    const sunday = weekKey(new Date('2026-08-02T12:00:00Z').getTime());
    const monday = weekKey(new Date('2026-08-03T12:00:00Z').getTime());
    assert.notEqual(sunday, monday);
    assert.equal(weekKey(new Date('2026-08-05T23:00:00Z').getTime()), monday);
  });
});
