// Tests for the terminal-lucidity tripwire.
//
// This is the highest-stakes branch in the product: when it fires, the
// companion stops maintaining the frame and tells the truth, and the family
// is called to the room. A miss degrades to ordinary warm conversation; a
// false positive sends a family to sit with someone they love. The tests
// encode both directions so neither drifts.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectLucidity, lucidityGuidance } from './lucidity';

describe('detectLucidity — windows of clarity', () => {
  test('sees through the represented persona by name', () => {
    assert.equal(detectLucidity('Beth died years ago, didn\'t she', 'Beth'), 'persona-pierce');
  });

  test('recognises being told the companion is not really the persona', () => {
    assert.equal(detectLucidity("You're not really Beth", 'Beth'), 'persona-pierce');
  });

  test('recognises being named as a machine', () => {
    assert.equal(detectLucidity("You're just a computer", 'Beth'), 'persona-pierce');
  });

  test('recognises awareness of their own condition', () => {
    assert.equal(detectLucidity('I have dementia, I know it', 'Beth'), 'self-awareness');
    assert.equal(detectLucidity('My memory is going', 'Beth'), 'self-awareness');
  });

  test('recognises speaking clearly about the end', () => {
    assert.equal(detectLucidity('I am dying', 'Beth'), 'mortality');
    assert.equal(detectLucidity('I want to say goodbye', 'Beth'), 'mortality');
  });

  test('a punctuated persona name does not throw', () => {
    // Unescaped, "Beth (Mom)" built an invalid RegExp and took the whole
    // request down with it.
    assert.doesNotThrow(() => detectLucidity('Beth (Mom) passed away', 'Beth (Mom)'));
    assert.equal(detectLucidity('Beth (Mom) passed away', 'Beth (Mom)'), 'persona-pierce');
  });

  test('an empty persona name is handled', () => {
    assert.equal(detectLucidity('I am dying', ''), 'mortality');
    assert.equal(detectLucidity('Hello there', ''), null);
  });
});

describe('detectLucidity — ordinary conversation must stay ordinary', () => {
  const calm = [
    'Where is Beth? I would love to see her.',
    'The roses need water.',
    'I am tired today.',
    'Is it time for tea?',
    'I miss my mother.',
    'My memory is not what it was, but never mind.',
  ];
  for (const message of calm) {
    test(`does not fire on: ${message}`, () => {
      assert.equal(detectLucidity(message, 'Beth'), null);
    });
  }

  test('handles empty input', () => assert.equal(detectLucidity('', 'Beth'), null));
});

describe('lucidityGuidance', () => {
  test('outranks the stay-in-character rules explicitly', () => {
    const guidance = lucidityGuidance('Beth', true);
    assert.match(guidance, /outranks the STAYING IN CHARACTER rules/);
  });

  test('vivid mode is told to answer honestly about the persona', () => {
    const vivid = lucidityGuidance('Beth', true);
    assert.match(vivid, /you are not really Beth/);
    assert.match(vivid, /gentle honesty/);
  });

  test('lucid mode omits the persona-honesty clause', () => {
    const lucid = lucidityGuidance('Beth', false);
    assert.doesNotMatch(lucid, /you are not really Beth/);
  });

  test('never introduces clinical language into the reply', () => {
    for (const guidance of [lucidityGuidance('Beth', true), lucidityGuidance('Beth', false)]) {
      assert.match(guidance, /Never mention prognoses/);
      assert.match(guidance, /family is close/);
    }
  });
});
