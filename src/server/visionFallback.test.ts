// The vision-model fallback, exercised against a fake Gemini endpoint.
//
// GEMINI_VISION_MODEL is DERIVED — "flash" swapped for "pro" in the configured
// model name — which is a guess about what exists on a given account. When the
// guess is wrong, every photo fails instantly while the rest of the app works,
// because everything else uses the base model. Reported live as "I posted a
// picture for analyzing and it failed immediately".
//
// This drives the real @google/genai client at a local server that rejects the
// pro name the way the API does, and checks that a photo still comes back.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { GoogleGenAI } from '@google/genai';

const INSIGHT = {
  description: 'A man in a checked shirt leaning on a pale-blue pickup.',
  caption: 'Dad and the blue truck',
  emotion: 'nostalgic',
  suggestions: ['What did that truck sound like starting up?'],
};

let server: http.Server;
let baseUrl = '';
const seen: string[] = [];

before(async () => {
  server = http.createServer((req, res) => {
    const model = decodeURIComponent(req.url || '').match(/models\/([^:?]+)/)?.[1] || '';
    seen.push(model);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // Exactly how the API answers a model name that isn't real.
      if (model.includes('pro')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { code: 404, message: `models/${model} is not found` } }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(INSIGHT) }] } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
});

after(() => server.close());

/** The route's model-selection logic, verbatim in shape. */
async function analyse(visionModel: string, baseModel: string) {
  const genAI = new GoogleGenAI({ apiKey: 'test', httpOptions: { baseUrl } });
  const attempt = (model: string) =>
    genAI.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'describe' }] }],
      config: { responseMimeType: 'application/json' },
    });

  const candidates = [...new Set([visionModel, baseModel])];
  let response: any = null;
  let lastError: any = null;
  for (const model of candidates) {
    try {
      response = await attempt(model);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!response) throw lastError;
  return { text: response.text, tried: candidates };
}

describe('photo analysis survives a vision model that does not exist', () => {
  test('falls back to the base model and still returns an insight', async () => {
    seen.length = 0;
    const r = await analyse('gemini-3.5-pro', 'gemini-3.5-flash');
    assert.deepEqual(JSON.parse(r.text), INSIGHT);
    // It tried the good one first, then degraded rather than failing.
    assert.deepEqual(seen, ['gemini-3.5-pro', 'gemini-3.5-flash']);
  });

  test('a working vision model is never second-guessed', async () => {
    seen.length = 0;
    await analyse('gemini-3.5-flash', 'gemini-3.5-flash');
    assert.equal(seen.length, 1, 'must not call twice when the first call works');
  });

  test('a no-op derivation does not double the wait', async () => {
    // When GEMINI_VISION_MODEL === GEMINI_MODEL there is nothing to fall back
    // to, and retrying the same name is pure latency.
    seen.length = 0;
    await analyse('gemini-3.5-flash', 'gemini-3.5-flash');
    assert.deepEqual(seen, ['gemini-3.5-flash']);
  });

  test('when every model fails, the error is raised rather than swallowed', async () => {
    await assert.rejects(() => analyse('gemini-3.5-pro', 'gemini-4-pro'));
  });
});
