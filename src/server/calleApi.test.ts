// Tests for the CALL-E Developer API transport, against a local fake server.
//
// The contribution guidelines rule out "apps that depend on private services
// without a local fake-server or dry-run path", and the reasoning applies to us
// first: nobody should have to spend a real call — or ring a real person — to
// find out whether the parsing works.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import { createCall, getCall, isTerminal, hasApiKey } from './calleApi';
import { summariseApiCall, RECIPIENT_RESULT_SCHEMA, type CheckInCallRequest } from './checkInCall';

const req: CheckInCallRequest = {
  toPhone: '+15551234567',
  patientName: 'Eleanor',
  timezone: 'America/New_York',
};

// What the fake server should answer with next.
let nextGet: any = {};
let lastPost: { body: any; headers: http.IncomingHttpHeaders } | null = null;

let server: http.Server;
let savedKey: string | undefined;
let savedBase: string | undefined;

before(async () => {
  server = http.createServer((rq, rs) => {
    const chunks: Buffer[] = [];
    rq.on('data', (c) => chunks.push(c));
    rq.on('end', () => {
      if (rq.method === 'POST' && rq.url === '/v1/calls') {
        lastPost = { body: JSON.parse(Buffer.concat(chunks).toString() || '{}'), headers: rq.headers };
        rs.writeHead(200, { 'Content-Type': 'application/json' });
        rs.end(JSON.stringify({ call_id: 'call_test_1', status: 'queued' }));
        return;
      }
      if (rq.method === 'GET' && rq.url?.startsWith('/v1/calls/')) {
        rs.writeHead(200, { 'Content-Type': 'application/json' });
        rs.end(JSON.stringify(nextGet));
        return;
      }
      rs.writeHead(404, { 'Content-Type': 'application/json' });
      rs.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  savedKey = process.env.CALLE_API_KEY;
  savedBase = process.env.CALLE_API_BASE_URL;
  process.env.CALLE_API_KEY = 'calle_test_key';
  process.env.CALLE_API_BASE_URL = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (savedKey === undefined) delete process.env.CALLE_API_KEY;
  else process.env.CALLE_API_KEY = savedKey;
  if (savedBase === undefined) delete process.env.CALLE_API_BASE_URL;
  else process.env.CALLE_API_BASE_URL = savedBase;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** The documented terminal response shape, with a scripted transcript. */
const completed = (structured: Record<string, any>, userSaid: string[]) => ({
  status: 'completed',
  task_completed: true,
  completion_confidence: { score: 0.92, label: 'high' },
  evidence: ['sample evidence'],
  recipients: [
    {
      structured_result: structured,
      attempts: [
        {
          transcript_turns: [
            { offset_seconds: 0, speaker: 'bot', text: 'Hello Eleanor, it is Yadira.' },
            ...userSaid.map((text, i) => ({ offset_seconds: 4 + i, speaker: 'user', text })),
          ],
        },
      ],
    },
  ],
});

describe('createCall', () => {
  test('sends the task, the recipient, and our result schema', async () => {
    const id = await createCall({
      task: 'Call Eleanor and see how she is.',
      phone: '+15551234567',
      region: 'US',
      recipientResultSchema: RECIPIENT_RESULT_SCHEMA as any,
      idempotencyKey: 'key-1',
    });
    assert.equal(id, 'call_test_1');
    assert.equal(lastPost?.body.recipients[0].phones[0], '+15551234567');
    assert.equal(lastPost?.body.recipients[0].region, 'US');
    assert.match(lastPost?.body.task, /Eleanor/);
    assert.equal(lastPost?.body.recipient_result_schema.properties.mood.enum.includes('unclear'), true);
  });

  test('authorizes with the bearer key and passes the idempotency key', async () => {
    await createCall({ task: 't', phone: '+15551234567', idempotencyKey: 'key-2' });
    assert.equal(lastPost?.headers.authorization, 'Bearer calle_test_key');
    assert.equal(lastPost?.headers['idempotency-key'], 'key-2');
  });

  test('hasApiKey reflects the environment', () => {
    assert.equal(hasApiKey(), true);
  });
});

describe('isTerminal', () => {
  for (const s of ['completed', 'failed', 'canceled', 'expired']) {
    test(`${s} is terminal`, () => assert.equal(isTerminal(s), true));
  }
  for (const s of ['queued', 'in_progress', 'dialing', 'something_new']) {
    // An unrecognised status keeps polling rather than being treated as done —
    // a new status name upstream should delay a readout, never fake one.
    test(`${s} is not terminal`, () => assert.equal(isTerminal(s), false));
  }
});

describe('reading the documented response shape', () => {
  test('pulls status, evidence, structured result and transcript turns', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'peaceful', distress: 'none' }, ['I am quite well']);
    const result = await getCall('call_test_1');
    assert.equal(result.status, 'completed');
    assert.equal(result.confidence?.label, 'high');
    assert.deepEqual(result.evidence, ['sample evidence']);
    assert.equal(result.recipientResult?.mood, 'peaceful');
    assert.equal(result.turns.length, 2);
  });

  test('a call with no recipients yet does not throw', async () => {
    nextGet = { status: 'queued' };
    const result = await getCall('call_test_1');
    assert.equal(result.status, 'queued');
    assert.equal(result.recipientResult, null);
    assert.deepEqual(result.turns, []);
  });
});

describe('summariseApiCall — vendor result and our own checks combined', () => {
  test('a calm call needs nobody', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'peaceful', distress: 'none' }, ['I am quite well thank you']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.needsCaregiver, false);
    assert.equal(out.mood, 'peaceful');
    assert.equal(out.answered, true);
  });

  test("CALL-E's urgent distress escalates", async () => {
    nextGet = completed(
      { answered: 'recipient', mood: 'anxious', distress: 'urgent', distress_detail: 'She said she had fallen.' },
      ['oh dear']
    );
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.needsCaregiver, true);
    assert.match(out.summary, /She said she had fallen/);
  });

  test('OUR patterns escalate even when CALL-E reported no distress', async () => {
    // The safety-critical case: a supplier saying "none" must not be able to
    // silence the caregiver alert when the person asked for help in words.
    nextGet = completed({ answered: 'recipient', mood: 'peaceful', distress: 'none' }, ['Please help me, I fell']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.needsCaregiver, true);
    assert.match(out.reasons.join(' '), /asked for help|reported a fall/);
  });

  test('the lucidity tripwire runs on the raw words, not on the vendor verdict', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'peaceful', distress: 'none' }, ['I know I have dementia']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.lucidity, 'self-awareness');
    assert.equal(out.needsCaregiver, true);
  });

  test('"unclear" falls back to our own reading rather than inventing a mood', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'unclear', distress: 'none' }, ['I am a bit worried']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.mood, 'anxious');
  });

  test('"unclear" with nothing to go on stays null', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'unclear', distress: 'none' }, ['The postman came at ten']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.mood, null);
  });

  test('someone else answering is surfaced, and no health detail is implied', async () => {
    nextGet = completed({ answered: 'someone_else', mood: 'unclear', distress: 'none' }, []);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.answered, false);
    assert.match(out.summary, /Someone else answered/);
    assert.match(out.summary, /Nothing about their health was shared/);
  });

  test('voicemail is distinguished from no answer', async () => {
    nextGet = completed({ answered: 'voicemail', mood: 'unclear', distress: 'none' }, []);
    const out = summariseApiCall(await getCall('c'), req);
    assert.match(out.summary, /did not pick up/);
    assert.match(out.summary, /nothing about their health/i);
  });

  test('wanting company is passed on to the caregiver', async () => {
    nextGet = completed(
      { answered: 'recipient', mood: 'sad', distress: 'none', wanted_company: 'yes' },
      ['I do miss him']
    );
    const out = summariseApiCall(await getCall('c'), req);
    assert.match(out.summary, /would like someone with them/);
  });

  test('never returns the full phone number', async () => {
    nextGet = completed({ answered: 'recipient', mood: 'peaceful', distress: 'none' }, ['hello']);
    const out = summariseApiCall(await getCall('c'), req);
    assert.equal(out.phone, '+1555***4567');
    assert.doesNotMatch(JSON.stringify(out), /\+15551234567/);
  });
});
