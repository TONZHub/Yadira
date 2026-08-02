// Tests for reading the Web Speech API.
//
// The failure these exist for was reported from a live call and is one of the
// worst this app can produce: the patient's own words, multiplied, put on
// their screen and sent to the companion as though they had said all of it.
//
//   "I'm I'm feeling I'm feeling okay I'm feeling okay I'm feeling okay
//    I I'm feeling okay I was I'm feeling okay I was just ..."
//
// Cause: the handler appended finalised segments to a running string. Engines
// re-deliver earlier results — `resultIndex` goes back to 0 on mobile — and
// every redelivery appended the same words on top of everything already there.
//
// The property that fixes it is idempotence: reading the same results twice
// must produce the same string. Most of what follows is that one property,
// approached from different angles.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readSpeechResults, MAX_UTTERANCE_CHARS, type SpeechResultLike } from './speechTranscript';

/** Build a results list the way the browser hands it over. */
const results = (...segments: [string, boolean][]): ArrayLike<SpeechResultLike> =>
  segments.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } }));

describe('readSpeechResults — the same event twice is the same words once', () => {
  test('reading the identical results repeatedly never grows the transcript', () => {
    // THE regression. The old code appended, so this loop is what ran away.
    const list = results(['I am feeling okay', true]);
    const first = readSpeechResults(list).text;
    for (let i = 0; i < 25; i++) {
      assert.equal(readSpeechResults(list).text, first);
    }
    assert.equal(first, 'I am feeling okay');
  });

  test('a redelivered final segment is not counted twice', () => {
    // Mobile engines resend earlier results with resultIndex back at 0. The
    // list is the whole session, so it must be read as the whole session.
    const grown = results(['I am feeling okay', true], ['I was just testing this out', true]);
    assert.equal(readSpeechResults(grown).text, 'I am feeling okay I was just testing this out');
  });

  test('the interim tail replaces itself rather than piling up', () => {
    const step1 = readSpeechResults(results(['I am feeling okay', true], ['I', false]));
    const step2 = readSpeechResults(results(['I am feeling okay', true], ['I was', false]));
    const step3 = readSpeechResults(results(['I am feeling okay', true], ['I was just', false]));
    assert.equal(step1.text, 'I am feeling okay I');
    assert.equal(step2.text, 'I am feeling okay I was');
    assert.equal(step3.text, 'I am feeling okay I was just');
    // The reported bug was step3 containing step1 containing the final twice.
    assert.equal((step3.text.match(/I am feeling okay/g) || []).length, 1);
  });

  test('final and interim are reported apart, since they are trusted differently', () => {
    // onend prefers confirmed final text and falls back to the interim tail
    // when the browser's VAD cut the turn short.
    const r = readSpeechResults(results(['Where is Beth', true], ['I would like', false]));
    assert.equal(r.final, 'Where is Beth');
    assert.equal(r.interim, 'I would like');
  });
});

describe('it must still carry ordinary speech faithfully', () => {
  test('keeps the words, in order, exactly once', () => {
    const r = readSpeechResults(
      results(['I miss him', true], ['Is it Tuesday', true], ['I would like a cup of tea', false])
    );
    assert.equal(r.text, 'I miss him Is it Tuesday I would like a cup of tea');
  });

  test('genuine repetition by the patient is preserved', () => {
    // Repeating yourself is a symptom, not a glitch — this app answers the
    // hundredth repetition as warmly as the first, so it must not be
    // deduplicated away.
    const r = readSpeechResults(results(['Where is Beth', true], ['Where is Beth', true]));
    assert.equal(r.text, 'Where is Beth Where is Beth');
  });

  test('spacing between segments is tidied, not the content', () => {
    const r = readSpeechResults(results(['  Hello   dear  ', true], ['   how are you', false]));
    assert.equal(r.text, 'Hello dear how are you');
  });

  test('empty and absent results are simply empty', () => {
    assert.equal(readSpeechResults(results()).text, '');
    assert.equal(readSpeechResults(null).text, '');
    assert.equal(readSpeechResults(undefined).text, '');
    assert.equal(readSpeechResults(results(['', true], ['', false])).text, '');
  });

  test('a malformed result does not take the rest of the turn down', () => {
    const broken = [{ isFinal: true } as any, { isFinal: true, 0: { transcript: 'I fell this morning' } }];
    assert.equal(readSpeechResults(broken).text, 'I fell this morning');
  });
});

describe('the ceiling', () => {
  test('one utterance cannot grow without bound', () => {
    const long = results([`${'word '.repeat(2000)}`, true]);
    const r = readSpeechResults(long);
    assert.ok(r.text.length <= MAX_UTTERANCE_CHARS, `${r.text.length} chars`);
  });

  test('but a normal sentence is nowhere near it', () => {
    const r = readSpeechResults(results(['I know I have dementia and I am frightened', true]));
    assert.equal(r.text, 'I know I have dementia and I am frightened');
  });
});
