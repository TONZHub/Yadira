// Which voice speaks, and how the caregiver is asked to choose it.
// ------------------------------------------------------------------
// Two voices exist in this app and they must never be the same one:
//
//   · YADIRA's own voice — the companion, in Lucid mode. Two custom designed
//     Inworld voices, chosen in Settings as simply Female or Male.
//   · The REPRESENTED PERSONA's voice — who Yadira becomes in Vivid mode.
//
// If those two ever collide, the identities blur for someone who is already
// struggling to hold them apart. That is why the persona list here shares no
// id with YADIRA_VOICES.
//
// ---- Why this file exists ----
//
// The persona picker asked the caregiver to choose between "Sarah", "Ashley"
// and "Dennis" — three Inworld preset names, offered in both first-run setup
// and Settings, while everything else in the app had moved to Female/Male.
//
// It is also the wrong question. A caregiver setting up the voice of their
// late wife is not choosing between Sarah and Ashley; they are telling us
// whether the person was a woman or a man. Two of those three options were
// the same answer wearing different names, and the third was a coin flip
// nobody had information to make.

/** The persona presets, as ids Inworld accepts. */
export const PERSONA_VOICES: Record<'female' | 'male', string> = {
  female: 'Sarah',
  male: 'Dennis',
};

export type PersonaVoiceChoice = 'female' | 'male' | 'custom';

/**
 * What the picker should show for a stored id.
 *
 * Back-compatible on purpose. Families already set up with 'Ashley' — the
 * option this change removes — must not silently lose their voice or land on
 * a picker showing the wrong thing. Ashley was a female voice, so it reads as
 * female, and it keeps working because the stored id is what gets sent.
 */
export function personaVoiceChoice(voiceId: string | undefined): PersonaVoiceChoice {
  const id = (voiceId || '').trim();
  if (!id || id === PERSONA_VOICES.female || id === 'Ashley') return 'female';
  if (id === PERSONA_VOICES.male) return 'male';
  return 'custom';
}

/**
 * The id to store for a choice. 'custom' returns null — the caller keeps
 * whatever cloned id is already set rather than overwriting it.
 */
export function personaVoiceId(choice: PersonaVoiceChoice): string | null {
  return choice === 'custom' ? null : PERSONA_VOICES[choice];
}

/** Is this a cloned or hand-entered id rather than one of the two presets? */
export function isCustomPersonaVoice(voiceId: string | undefined): boolean {
  return personaVoiceChoice(voiceId) === 'custom';
}
