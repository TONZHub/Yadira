// Developer mode, client side.
// ------------------------------------------------------------------
// The server decides whether this is possible at all (DEV_MODE_SECRET, see
// src/server/devMode.ts). Everything here is about making it hard to enter by
// accident and impossible to forget you are in.
//
// sessionStorage, deliberately: closing the tab ends developer mode. A
// character protection that stays off across days because somebody tested
// something on Tuesday is the failure this is designed around.

const KEY = 'yadira_dev_token';

/** Taps on the logo needed to open the prompt. */
export const DEV_TAP_COUNT = 7;

/** Taps must land within this window of each other, or the count resets. */
export const DEV_TAP_WINDOW_MS = 3000;

export function devToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDevToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch { /* storage blocked — developer mode simply stays off */ }
}

export function clearDevToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
}

/**
 * Counts taps toward the gesture.
 *
 * Kept as a pure function so the reducer-ish behaviour is testable without a
 * DOM: pass the previous state and the moment of the tap, get the next state.
 */
export interface TapState {
  count: number;
  lastAt: number;
}

export function registerTap(prev: TapState, now: number): { next: TapState; opened: boolean } {
  const withinWindow = now - prev.lastAt <= DEV_TAP_WINDOW_MS;
  const count = withinWindow ? prev.count + 1 : 1;
  if (count >= DEV_TAP_COUNT) return { next: { count: 0, lastAt: 0 }, opened: true };
  return { next: { count, lastAt: now }, opened: false };
}
