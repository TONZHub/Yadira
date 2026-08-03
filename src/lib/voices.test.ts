// Tests for the persona voice choice.
//
// The stakes here are not cosmetic. This id decides what a person with
// dementia hears when the companion speaks as their late spouse, and the
// value is persisted per family — so a change to the PICKER must never
// silently change the VOICE of a family already set up.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONA_VOICES,
  personaVoiceChoice,
  personaVoiceId,
  isCustomPersonaVoice,
} from './voices';

describe('the caregiver is asked a question they can answer', () => {
  test('the two presets round-trip', () => {
    assert.equal(personaVoiceChoice(personaVoiceId('female')!), 'female');
    assert.equal(personaVoiceChoice(personaVoiceId('male')!), 'male');
  });

  test('nothing set reads as female, matching the old default', () => {
    // 'Sarah' was the default before this change. A family part-way through
    // setup must not have the answer change under them.
    assert.equal(personaVoiceChoice(undefined), 'female');
    assert.equal(personaVoiceChoice(''), 'female');
    assert.equal(PERSONA_VOICES.female, 'Sarah');
  });
});

describe('families already set up keep the voice they chose', () => {
  test('Ashley — the option this change removes — still reads as female', () => {
    // The picker no longer offers it, but the stored id is what gets sent to
    // Inworld, so the voice a family already hears does not change. Showing
    // "custom" here would also be a lie, and would push them toward the
    // clone flow for no reason.
    assert.equal(personaVoiceChoice('Ashley'), 'female');
  });

  test('a cloned voice is never mistaken for a preset', () => {
    // This is the one that would hurt: a family who cloned their mother's
    // actual voice, shown "Female voice", and one careless save later it is
    // gone and replaced by a stranger's.
    const cloned = 'zippy-pecan-9151__design-voice-6cd2e59a';
    assert.equal(personaVoiceChoice(cloned), 'custom');
    assert.equal(isCustomPersonaVoice(cloned), true);
  });

  test('choosing custom returns no id, so the cloned one is not overwritten', () => {
    assert.equal(personaVoiceId('custom'), null);
  });
});

describe('Yadira and the loved one never share a voice', () => {
  test('the persona presets are not the companion voice ids', () => {
    // If these ever collide the identities blur for someone already
    // struggling to hold them apart.
    const yadira = ['zippy-pecan-9151__design-voice-6cd2e59a', 'zippy-pecan-9151__design-voice-87c0a467'];
    for (const id of Object.values(PERSONA_VOICES)) {
      assert.ok(!yadira.includes(id), `${id} is Yadira's own voice`);
    }
  });
});
