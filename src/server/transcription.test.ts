// Tests for transcription hygiene.
//
// The failure this guards against is not a crash: it is the app telling a
// person with dementia that they said something they did not say. Reported from
// a live session — "double o seven" and "The system is down" — both invented
// over silence.
//
// The tests come in two halves, and the second half matters more: the filter
// must never delete real speech.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  looksLikeSilence,
  isTranscriptionArtifact,
  cleanTranscript,
  MIN_AUDIO_BYTES,
} from './transcription';

describe('looksLikeSilence — never hand silence to a model', () => {
  const real = { bytes: 40_000, durationMs: 3000, peakAmplitude: 0.4 };

  test('lets a normal recording through', () => {
    assert.equal(looksLikeSilence(real), false);
  });

  test('rejects a container with no audio in it', () => {
    // The old floor was 200 bytes, which a webm header clears by itself.
    assert.equal(looksLikeSilence({ ...real, bytes: 300 }), true);
    assert.equal(looksLikeSilence({ ...real, bytes: MIN_AUDIO_BYTES - 1 }), true);
  });

  test('rejects a fumbled tap', () => {
    assert.equal(looksLikeSilence({ ...real, durationMs: 120 }), true);
  });

  test('rejects a silent room, however long the recording', () => {
    assert.equal(looksLikeSilence({ ...real, durationMs: 8000, peakAmplitude: 0.002 }), true);
  });

  test('trusts a client that reports no hints, apart from the byte floor', () => {
    // An older build should degrade to today's behaviour, not have its
    // dictation silently refused.
    assert.equal(looksLikeSilence({ bytes: 40_000 }), false);
    assert.equal(looksLikeSilence({ bytes: 100 }), true);
  });
});

describe('the guard must not refuse real speech — how it broke dictation', () => {
  // Reported live: "whisper isn't detecting my mic at all". Not intermittent —
  // total, on one device.
  //
  // The level feeding this guard came from a browser meter that had only ever
  // been decoration for the waveform bar, so every way it could fail failed
  // quietly and reported 0. Safari has no `window.AudioContext`, only the
  // webkit-prefixed one, so constructing it threw and the level never moved
  // off 0; an unresumed context returns zeros without erroring at all. The
  // guard read 0 as "silent room" and refused every recording, for good, with
  // nothing in the UI to say why.
  //
  // So the rule these tests pin down: an absent reading is UNKNOWN, and
  // unknown must transcribe. Only a measured, genuinely dead signal is
  // refused.

  const speech = (peakAmplitude: number) =>
    looksLikeSilence({ bytes: 40_000, durationMs: 3000, peakAmplitude });

  test('a quiet, frail voice at arm’s length still gets transcribed', () => {
    assert.equal(speech(0.05), false);
    assert.equal(speech(0.03), false);
    assert.equal(speech(0.02), false); // the exact value the old threshold cut
  });

  test('ordinary and loud speech obviously get through', () => {
    for (const peak of [0.1, 0.3, 0.6, 0.95]) assert.equal(speech(peak), false);
  });

  test('only a genuinely dead signal is refused', () => {
    assert.equal(speech(0.009), true);
    assert.equal(speech(0), true);
  });

  test('an unmeasurable level is not the same as a silent one', () => {
    // THE regression. Safari and unresumed contexts cannot measure; the client
    // now omits the field rather than sending the 0 that broke this. A real
    // microphone in a quiet room has a noise floor, so a hard 0 means the
    // plumbing failed — the client treats that as unmeasured too, and never
    // sends it. Sending nothing must always transcribe.
    assert.equal(looksLikeSilence({ bytes: 40_000, durationMs: 3000 }), false);
    assert.equal(looksLikeSilence({ bytes: 40_000 }), false);
  });

  test('the old field name is ignored rather than misread', () => {
    // A cached older build sends `peakLevel`, measured differently. It must
    // not be read as a peak amplitude — it falls through to duration and size.
    const legacy = { bytes: 40_000, durationMs: 3000, peakLevel: 0.004 } as any;
    assert.equal(looksLikeSilence(legacy), false);
  });
});

describe('isTranscriptionArtifact — what models invent over silence', () => {
  const invented = [
    'The system is down',
    'The system is down.',
    'Thanks for watching!',
    'Thank you for watching.',
    'Please subscribe',
    'like and subscribe',
    'Subtitles by the Amara.org community',
    'Transcription by CastingWords',
    'you',
    'Um.',
    '♪',
    '...',
    '007',
    'double o seven',
  ];
  for (const text of invented) {
    test(`drops: ${JSON.stringify(text)}`, () => {
      assert.equal(isTranscriptionArtifact(text), true);
      assert.equal(cleanTranscript(text), '');
    });
  }

  test('drops empty and whitespace', () => {
    assert.equal(isTranscriptionArtifact(''), true);
    assert.equal(isTranscriptionArtifact('   '), true);
  });
});

describe('it must never delete something the patient actually said', () => {
  const real = [
    // "Thank you" is a classic Whisper silence artifact AND a completely
    // ordinary thing for a patient to say. It is deliberately not filtered —
    // the silence check catches it by looking at the audio instead.
    'Thank you',
    'Thank you, dear',
    'Hello',
    'Yes',
    'No',
    'I miss him',
    'Where is Beth?',
    'I would like a cup of tea',
    'Is it Tuesday?',
    'The system is down, I think the telly is broken',
    'I was watching and thanks for watching came up on the screen',
    'I am seven years older than him',
    'He was in the army, double o seven he used to joke',
    'Please help me',
    'I fell this morning',
    'I know I have dementia',
  ];
  for (const text of real) {
    test(`keeps: ${JSON.stringify(text)}`, () => {
      assert.equal(isTranscriptionArtifact(text), false);
      assert.equal(cleanTranscript(text), text.trim());
    });
  }

  test('a stock phrase inside a longer sentence is genuine speech', () => {
    // Whole-reply matching only. Truncating a real sentence would be worse
    // than the artifact this is guarding against.
    const said = 'I told him the system is down but he would not listen';
    assert.equal(cleanTranscript(said), said);
  });

  test('the distress and lucidity phrases survive, since they must reach a human', () => {
    for (const urgent of ['Please help me', 'I am dying', 'I know I have dementia']) {
      assert.equal(cleanTranscript(urgent), urgent);
    }
  });
});
