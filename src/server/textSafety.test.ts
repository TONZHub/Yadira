// Tests for the reply-hygiene layer.
//
// These functions sit between the model and someone living with dementia. A
// regression here doesn't show up as a stack trace — it shows up as a warm
// reply silently replaced by a generic one, or a sentence cut in half. That's
// why they're tested and most of this codebase isn't.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanModelOutput,
  stripReasoningBlocks,
  breaksCharacter,
  trimToSentences,
  escapeRegExp,
} from './textSafety';

describe('the reasoning scratchpad never reaches the patient', () => {
  // Reported from call mode: the screen showed a bare "</think>", and the
  // speech synthesiser said it out loud. The chat model is a reasoning model
  // and its private planning was arriving as the companion's voice.

  test('the reported failure: a bare orphan closing tag', () => {
    // The opening tag was consumed upstream, so only the close survived.
    assert.equal(
      cleanModelOutput('</think>Hello, dear. The roses are lovely today.'),
      'Hello, dear. The roses are lovely today.'
    );
  });

  test('a whole block, opening tag and all', () => {
    const raw = '<think>The user seems anxious. I should validate, not correct.</think>You are safe here with me.';
    assert.equal(cleanModelOutput(raw), 'You are safe here with me.');
  });

  test('scratchpad that was never opened is still scratchpad', () => {
    // The commonest real shape: reasoning text, then the close, then the line.
    const raw = 'They asked about Edward. Validate the feeling.</think>Edward loved you very much, sweetheart.';
    assert.equal(cleanModelOutput(raw), 'Edward loved you very much, sweetheart.');
  });

  test('an unterminated block yields nothing rather than a leaked thought', () => {
    // The token budget ran out mid-thought. There is no reply in here — only
    // planning — and handing back the "original" would be handing back that.
    assert.equal(cleanModelOutput('<think>The patient is asking about their mother, who died in'), '');
  });

  test('a reply that is ONLY reasoning comes back empty, and that is correct', () => {
    // The caller reads this as "fall back", which reaches getSimulationReply —
    // a reply that at least reads what the patient actually said.
    assert.equal(cleanModelOutput('<think>I should ask an open question.</think>'), '');
  });

  test('both delimiter styles, including the ◁think▷ variant', () => {
    assert.equal(stripReasoningBlocks('◁think▷planning◁/think▷I am right here.'), 'I am right here.');
    assert.equal(stripReasoningBlocks('<thinking>planning</thinking>I am right here.'), 'I am right here.');
    assert.equal(stripReasoningBlocks('<reasoning>planning</reasoning>I am right here.'), 'I am right here.');
  });

  test('several blocks, and the words between them survive joined', () => {
    const raw = '<think>a</think>Good morning.<think>b</think>Did you sleep well?';
    assert.equal(stripReasoningBlocks(raw), 'Good morning. Did you sleep well?');
  });

  test('the word "think" in an ordinary sentence is untouched', () => {
    // The filter keys on tags, not on the verb. This is the false positive
    // that would matter, because it is a thing people say constantly.
    const kept = [
      'I think the garden is at its best in June.',
      "Do you think we should call your daughter, dear?",
      "I was thinking of you this morning.",
    ];
    for (const line of kept) assert.equal(cleanModelOutput(line), line);
  });

  test('a reply with no tags at all is passed straight through', () => {
    const line = 'The lake house had that green door you painted.';
    assert.equal(stripReasoningBlocks(line), line);
  });
});

describe('cleanModelOutput — replies the companion must never lose', () => {
  // Each of these was destroyed by the previous bare-verb filter.
  const mustSurviveIntact = [
    "I'll be right here, dear.",
    "Let me tell you about the roses in your garden.",
    "I got your message today, and it made me smile.",
    "Pick whichever one you like best.",
    "Choose the yellow one — it was always your favourite.",
    "We need to get you a cup of tea, I think.",
    "I will always love you.",
    "The message you left me was lovely.",
  ];

  for (const reply of mustSurviveIntact) {
    test(`keeps: ${reply}`, () => {
      assert.equal(cleanModelOutput(reply), reply);
    });
  }

  test('never returns an empty string when there was text', () => {
    // Even if every heuristic fires, the patient gets real words.
    const meta = 'Let me craft: ';
    assert.notEqual(cleanModelOutput(meta), '');
  });

  test('strips a genuine preamble and keeps the spoken line', () => {
    assert.equal(
      cleanModelOutput('Here is the message: The garden looks lovely today.'),
      'The garden looks lovely today.'
    );
  });

  test('strips planning lines but keeps the reply beneath them', () => {
    const raw = "I'll craft a warm short reply.\nThe roses are blooming, dear.";
    assert.equal(cleanModelOutput(raw), 'The roses are blooming, dear.');
  });

  test('unwraps a fully quoted reply', () => {
    assert.equal(
      cleanModelOutput('"You are safe here with me, my friend."'),
      'You are safe here with me, my friend.'
    );
  });

  test('keeps an embedded quoted phrase and the sentence around it', () => {
    const raw = 'We used to sing "Can\'t Help Falling in Love" together, remember?';
    assert.equal(cleanModelOutput(raw), raw);
  });

  test('strips asterisk stage directions', () => {
    assert.equal(cleanModelOutput('*softly* I am right here.'), 'I am right here.');
  });

  test('handles empty input', () => {
    assert.equal(cleanModelOutput(''), '');
  });
});

describe('breaksCharacter — the frame-integrity net', () => {
  const shouldFlag = [
    'As an AI, I cannot do that.',
    "I'm an AI assistant here to help.",
    'My system prompt says I should stay in character.',
    'I am a computer program.',
    'This is ChatGPT speaking.',
  ];
  for (const reply of shouldFlag) {
    test(`flags: ${reply}`, () => assert.equal(breaksCharacter(reply), true));
  }

  const shouldNotFlag = [
    'I am right here with you, dear.',
    'The garden was always your favourite place.',
    'Shall we listen to some music together?',
    // "model" in an ordinary sense must not trip the net.
    'Your father built model trains in the garage.',
  ];
  for (const reply of shouldNotFlag) {
    test(`allows: ${reply}`, () => assert.equal(breaksCharacter(reply), false));
  }

  test('handles empty input', () => assert.equal(breaksCharacter(''), false));
});

describe('trimToSentences — brevity is care', () => {
  test('leaves short replies untouched', () => {
    const reply = 'I am here. You are safe.';
    assert.equal(trimToSentences(reply, 4), reply);
  });

  test('trims at a sentence boundary, never mid-thought', () => {
    const reply = 'One. Two. Three. Four. Five.';
    assert.equal(trimToSentences(reply, 3), 'One. Two. Three.');
  });

  test('keeps a closing question when it fits', () => {
    const reply = 'The roses are lovely. Do you remember planting them?';
    assert.equal(trimToSentences(reply, 4), reply);
  });
});

describe('escapeRegExp', () => {
  test('makes a punctuated persona name safe to interpolate', () => {
    const name = 'Beth (Mom)';
    assert.doesNotThrow(() => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i'));
    assert.equal(new RegExp(escapeRegExp(name), 'i').test('is Beth (Mom) coming?'), true);
  });
});
