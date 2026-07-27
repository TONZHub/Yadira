// Phone-number handling shared by anything that dials.
// ------------------------------------------------------------------
// Extracted from the old CALL-E CLI client when the patient-facing check-in
// call was removed: the CLI transport went with it, but validating and masking
// numbers is needed by every call path and always will be.

/** E.164: a leading + and 8–15 digits. Never inferred, only validated. */
export function isE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test((value || '').trim());
}

/**
 * +15551234567 → +1555***4567.
 *
 * Used in every log line and every API response. A caregiver's number in a log
 * is a personal detail sitting somewhere it was never meant to be, and the
 * masked form is enough to tell two numbers apart while reading one.
 */
export function maskPhone(value: string): string {
  const raw = (value || '').trim();
  if (raw.length < 8) return '***';
  return `${raw.slice(0, 5)}***${raw.slice(-4)}`;
}
