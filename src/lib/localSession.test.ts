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

const { localUid, isLocalCircle, isUnlinkedPatientCircle, readDeviceAccount, LOCAL_UID_PREFIX, UNLINKED_PATIENT_EMAIL } =
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

describe('readDeviceAccount — the role screen must not claim a connection it lacks', () => {
  // Reported from a phone: the screen said "I'm a Patient — Connected to your
  // care circle" on a device that was connected to nothing. The check behind
  // it asked only "is there a token?" — and the demo button MINTS a token. So
  // one tap of "Try the companion" made the device claim to be linked for
  // ever after, and the claim got more convincing the longer it sat there.
  //
  // atob exists in node 22; these tokens are unsigned, which is fine because
  // this reads identity for display, never for authorisation.
  const jwt = (payload: Record<string, unknown>) =>
    `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

  test('a demo session\'s leftovers are NOT a connection', () => {
    const uid = localUid(UNLINKED_PATIENT_EMAIL);
    const token = jwt({ uid, email: UNLINKED_PATIENT_EMAIL });
    assert.deepEqual(readDeviceAccount(token, uid), { state: 'demo' });
  });

  test('the legacy suffix-free demo uid is caught too', () => {
    const uid = 'local-patientyadiralocal';
    assert.deepEqual(readDeviceAccount(jwt({ uid }), uid), { state: 'demo' });
  });

  test('a real Firebase account is linked, and names itself', () => {
    const uid = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4';
    const account = readDeviceAccount(jwt({ uid, email: 'ruth@example.com' }), uid);
    assert.deepEqual(account, { state: 'linked', email: 'ruth@example.com' });
  });

  test('a caregiver on a Firebase-less build is linked as well', () => {
    // Their circle is local, but it is THEIR circle — the patient device
    // inheriting it really does reach them.
    const uid = localUid('carer@example.com');
    const account = readDeviceAccount(jwt({ uid, email: 'carer@example.com' }), uid);
    assert.equal(account.state, 'linked');
  });

  test('no token is no account', () => {
    assert.deepEqual(readDeviceAccount(null, null), { state: 'none' });
    assert.deepEqual(readDeviceAccount('', 'local-carer'), { state: 'none' });
  });

  test('a token with no identity in it is not treated as an account', () => {
    assert.deepEqual(readDeviceAccount(jwt({ iat: 1 }), null), { state: 'none' });
    assert.deepEqual(readDeviceAccount('not-a-jwt', null), { state: 'none' });
  });

  test('the stored uid wins over the token payload', () => {
    // The uid in localStorage is what getCircleId() actually uses, so it is
    // the one that decides whether this device is in anybody's circle.
    const account = readDeviceAccount(jwt({ uid: 'A1b2C3d4E5f6G7h8I9j0' }), localUid(UNLINKED_PATIENT_EMAIL));
    assert.equal(account.state, 'demo');
  });
});
