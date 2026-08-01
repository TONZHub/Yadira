// Tests for local (unlinked) sessions.
//
// The bug behind this file: a patient device that nobody signed in on got the
// uid `local-patientyadiralocal`, derived from the email alone. Since a circle
// id IS the uid, that meant (a) it was never in the caregiver's circle, so the
// help button raised alerts nobody received and its phone call had no number
// to ring, and (b) the uid was a global constant, so every unlinked patient
// device in the world shared one server-side circle.
//
// (a) cannot be fixed here — only signing the device in fixes it — so the app
// detects it instead, via isUnlinkedPatientCircle, and stops promising help is
// on its way. (b) is fixed by the per-device suffix.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage, installed before the module under test reads it.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
(globalThis as any).localStorage = storage;

const { localUid, isLocalCircle, isUnlinkedPatientCircle, LOCAL_UID_PREFIX, UNLINKED_PATIENT_EMAIL } =
  await import('./localSession');

beforeEach(() => storage.clear());

describe('isLocalCircle — telling a demo apart from a real account', () => {
  test('a local uid is a local circle', () => {
    assert.equal(isLocalCircle('local-patientyadiralocal-a1b2c3d4'), true);
    assert.equal(isLocalCircle('local-patientyadiralocal'), true);
  });

  test('a real Firebase uid is not', () => {
    assert.equal(isLocalCircle('A1b2C3d4E5f6G7h8I9j0K1l2M3n4'), false);
  });

  test('no session is not a local session — it is no session', () => {
    assert.equal(isLocalCircle(null), false);
    assert.equal(isLocalCircle(undefined), false);
    assert.equal(isLocalCircle(''), false);
  });
});

describe('isUnlinkedPatientCircle — is there anyone at the other end?', () => {
  // This is what the help button consults before promising that a person has
  // been told and is coming. It must be true ONLY when that promise is false.

  test('the one-tap patient session is unlinked', () => {
    assert.equal(isUnlinkedPatientCircle(localUid(UNLINKED_PATIENT_EMAIL)), true);
    assert.equal(isUnlinkedPatientCircle('local-patientyadiralocal'), true); // legacy
  });

  test('a device handed over from a signed-in caregiver is NOT unlinked', () => {
    // Patient mode inherits the caregiver's uid, so it is inside their circle
    // and the alert genuinely reaches them.
    assert.equal(isUnlinkedPatientCircle('A1b2C3d4E5f6G7h8I9j0K1l2M3n4'), false);
  });

  test('a caregiver on a Firebase-less build is NOT unlinked either', () => {
    // The narrow case this predicate exists for: with Firebase disabled the
    // caregiver's own account is local too. Treating every local uid as cut
    // off would silence the help button for a family whose setup works.
    assert.equal(isUnlinkedPatientCircle(localUid('carer@example.com')), false);
  });

  test('no session at all is not treated as unlinked', () => {
    assert.equal(isUnlinkedPatientCircle(null), false);
    assert.equal(isUnlinkedPatientCircle(undefined), false);
  });
});

describe('localUid', () => {
  test('keeps the local- prefix the server insists on', () => {
    // firebaseToken.ts rejects an unsigned token whose uid lacks this, so a
    // forged one can never claim a real family's circle.
    assert.ok(localUid('patient@yadira.local').startsWith(LOCAL_UID_PREFIX));
  });

  test('is stable across sign-out and sign-in on one device', () => {
    // The storage keys are built from the uid. A demo caregiver who logs back
    // in must find their circle still there.
    const first = localUid('carer@example.com');
    assert.equal(localUid('carer@example.com'), first);
  });

  test('two devices do not land in the same circle', () => {
    const deviceA = localUid('patient@yadira.local');
    storage.clear(); // a different browser, with its own storage
    const deviceB = localUid('patient@yadira.local');
    assert.notEqual(deviceA, deviceB);
  });

  test('two people on one device do not share a circle', () => {
    assert.notEqual(localUid('carer@example.com'), localUid('someone@else.com'));
  });

  test('a device holding a legacy suffix-free uid keeps it', () => {
    // Re-deriving would change every storage key and orphan the data of
    // everyone who already used the app.
    const legacy = 'local-patientyadiralocal';
    assert.equal(localUid(UNLINKED_PATIENT_EMAIL, legacy), legacy);
  });

  test('a device holding a real uid is not handed it back', () => {
    // Passing a Firebase uid in must never produce a local session that
    // claims it — that is the exact escalation the prefix rule prevents.
    const real = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4';
    const uid = localUid('patient@yadira.local', real);
    assert.notEqual(uid, real);
    assert.ok(uid.startsWith(LOCAL_UID_PREFIX));
  });

  test('survives an email with nothing usable in it', () => {
    assert.ok(localUid('@@@').startsWith(`${LOCAL_UID_PREFIX}user`));
  });
});
