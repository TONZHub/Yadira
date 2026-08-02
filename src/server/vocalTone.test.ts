// Tests for the vocal tone reading.
//
// Almost all of these are about NOT producing a reading. That is the point:
// the failure mode worth engineering against is not a missing badge, it is a
// confident wrong one. A fabricated mood is charted, trended, and acted on by
// an exhausted person at midnight — and the app's own rule is that mood is
// never guessed.
//
// The second half guards the other direction: a real reading must survive,
// and a malformed emotion must never cost the patient their words.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVocalTone,
  parseTranscriptWithTone,
  stripJsonFence,
  MIN_CONFIDENCE,
  KNOWN_EMOTIONS,
} from './vocalTone';

const reply = (o: Record<string, unknown>) => JSON.stringify(o);

describe('parseVocalTone — silence is the safe answer', () => {
  test('"unclear" is honoured, not rounded to neutral', () => {
    // The prompt asks for this whenever the audio is short, quiet, noisy or
    // ambiguous. Coercing it to a mood would defeat the entire instruction.
    assert.equal(parseVocalTone(reply({ emotion: 'unclear', confidence: 0.9, tone: 'too quiet' })), null);
  });

  test('a low-confidence reading is dropped rather than shown weakly', () => {
    const low = reply({ emotion: 'sad', confidence: MIN_CONFIDENCE - 0.01, tone: 'maybe flat' });
    assert.equal(parseVocalTone(low), null);
  });

  test('an emotion the app cannot render is refused, not approximated', () => {
    for (const invented of ['melancholic', 'agitated', 'distressed', 'fine', '']) {
      assert.equal(parseVocalTone(reply({ emotion: invented, confidence: 0.95, tone: 'x' })), null);
    }
  });

  test('a missing or non-numeric confidence is not treated as certainty', () => {
    assert.equal(parseVocalTone(reply({ emotion: 'happy', tone: 'bright' })), null);
    assert.equal(parseVocalTone(reply({ emotion: 'happy', confidence: 'high', tone: 'bright' })), null);
  });

  test('unparseable output yields nothing rather than a default', () => {
    assert.equal(parseVocalTone('I heard someone speaking softly.'), null);
    assert.equal(parseVocalTone(''), null);
    assert.equal(parseVocalTone('{'), null);
  });
});

describe('parseVocalTone — a real reading survives', () => {
  test('a confident reading comes through with its provenance attached', () => {
    const t = parseVocalTone(reply({ emotion: 'sad', confidence: 0.82, tone: 'quiet and a little shaky' }));
    assert.deepEqual(t, {
      emotion: 'sad',
      confidence: 0.82,
      tone: 'quiet and a little shaky',
      source: 'voice',
    });
  });

  test('every emotion the badge can draw is accepted', () => {
    for (const emotion of KNOWN_EMOTIONS) {
      assert.equal(parseVocalTone(reply({ emotion, confidence: 0.9, tone: 'x' }))?.emotion, emotion);
    }
  });

  test('case and whitespace from the model do not lose a reading', () => {
    assert.equal(parseVocalTone(reply({ emotion: '  Anxious ', confidence: 0.7, tone: 'fast' }))?.emotion, 'anxious');
  });

  test('the markdown fence models add anyway is stripped', () => {
    const fenced = '```json\n' + reply({ emotion: 'peaceful', confidence: 0.9, tone: 'slow, easy' }) + '\n```';
    assert.equal(parseVocalTone(fenced)?.emotion, 'peaceful');
    assert.equal(stripJsonFence('```\n{"a":1}\n```'), '{"a":1}');
  });

  test('confidence is clamped rather than trusted blindly', () => {
    assert.equal(parseVocalTone(reply({ emotion: 'happy', confidence: 1.4, tone: 'x' }))?.confidence, 1);
  });

  test('a reading with no phrase still says something honest', () => {
    assert.equal(parseVocalTone(reply({ emotion: 'happy', confidence: 0.9 }))?.tone, 'heard in their voice');
  });
});

describe('parseTranscriptWithTone — the words matter more than the mood', () => {
  test('pulls both out of one reply', () => {
    const r = parseTranscriptWithTone(
      reply({ text: 'I miss him', emotion: 'sad', confidence: 0.88, tone: 'quiet, trailing off' })
    );
    assert.equal(r.text, 'I miss him');
    assert.equal(r.tone?.emotion, 'sad');
    assert.equal(r.tone?.source, 'voice');
  });

  test('a broken emotion never costs the patient their words', () => {
    // The single most important case here. The transcript is what the patient
    // said; the mood is a nicety. One must not be able to take the other down.
    const r = parseTranscriptWithTone(reply({ text: 'Is it Tuesday?', emotion: 'quizzical', confidence: 0.9 }));
    assert.equal(r.text, 'Is it Tuesday?');
    assert.equal(r.tone, null);
  });

  test('a model that ignored the format and just transcribed is still understood', () => {
    // Falling back to the raw reply is right: the likeliest reason for
    // unparseable output is that it answered the older, simpler instruction.
    const r = parseTranscriptWithTone('I would like a cup of tea');
    assert.equal(r.text, 'I would like a cup of tea');
    assert.equal(r.tone, null);
  });

  test('silence transcribed as an empty string stays empty', () => {
    const r = parseTranscriptWithTone(reply({ text: '', emotion: 'unclear', confidence: 0.2, tone: '' }));
    assert.equal(r.text, '');
    assert.equal(r.tone, null);
  });

  test('an unclear mood alongside real speech keeps the speech', () => {
    const r = parseTranscriptWithTone(
      reply({ text: 'Where is Beth?', emotion: 'unclear', confidence: 0.9, tone: 'hard to tell' })
    );
    assert.equal(r.text, 'Where is Beth?');
    assert.equal(r.tone, null);
  });
});
