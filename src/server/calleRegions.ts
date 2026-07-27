// CALL-E's supported calling regions, and the voice locale each implies.
// ------------------------------------------------------------------
// CALL-E runs its own voice runtime — there is no parameter for supplying
// Yadira's Inworld voice, and none for picking a specific speaker. `locale` is
// the only lever over how the call sounds, and sending nothing at all leaves
// CALL-E on its own default, which is how a US family got an English accent.
//
// The region is CHOSEN by the caregiver, never inferred from the phone number,
// the browser, or the server clock. Guessing a country from a dialling code is
// exactly the kind of inference the skill's own rules forbid, and getting it
// wrong means a voice that sounds foreign to someone whose grip on the present
// is already loose.

export interface CalleRegion {
  /** CALL-E recipient region code. */
  code: string;
  label: string;
  /** Default spoken locale for that region. */
  locale: string;
}

/** Mirrors CALL-E's documented region/language table. */
export const CALLE_REGIONS: CalleRegion[] = [
  { code: 'US', label: 'United States', locale: 'en-US' },
  { code: 'GB', label: 'United Kingdom', locale: 'en-GB' },
  { code: 'CA', label: 'Canada', locale: 'en-CA' },
  { code: 'AU', label: 'Australia', locale: 'en-AU' },
  { code: 'IN', label: 'India', locale: 'en-IN' },
  { code: 'SG', label: 'Singapore', locale: 'en-SG' },
  { code: 'MY', label: 'Malaysia', locale: 'en-MY' },
  { code: 'PH', label: 'Philippines', locale: 'en-PH' },
  { code: 'ID', label: 'Indonesia', locale: 'en-ID' },
  { code: 'KE', label: 'Kenya', locale: 'en-KE' },
  { code: 'AE', label: 'United Arab Emirates', locale: 'en-AE' },
  { code: 'DE', label: 'Germany', locale: 'de-DE' },
  { code: 'FR', label: 'France', locale: 'fr-FR' },
  { code: 'JP', label: 'Japan', locale: 'ja-JP' },
  { code: 'VN', label: 'Vietnam', locale: 'vi-VN' },
  { code: 'MX', label: 'Mexico', locale: 'es-MX' },
  { code: 'BR', label: 'Brazil', locale: 'pt-BR' },
];

const BY_CODE = new Map(CALLE_REGIONS.map((r) => [r.code, r]));

export function isSupportedRegion(code: string): boolean {
  return BY_CODE.has((code || '').toUpperCase());
}

/**
 * The locale to speak in. An explicit locale always wins; otherwise it comes
 * from the chosen region. Returns undefined when the caregiver has chosen
 * nothing — CALL-E is left on its own default rather than us inventing one.
 */
export function localeFor(region?: string, explicitLocale?: string): string | undefined {
  const explicit = (explicitLocale || '').trim();
  if (explicit) return explicit;
  return BY_CODE.get((region || '').trim().toUpperCase())?.locale;
}
