// Tests for token verification — specifically the rejection paths that
// close the "anyone can be any family" hole. All of these resolve before any
// network call to Google, so the suite runs offline.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyFirebaseToken } from './firebaseToken';

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

const token = (header: unknown, payload: unknown, sig = 'sig') =>
  `${b64url(header)}.${b64url(payload)}.${sig}`;

describe('verifyFirebaseToken — malformed input', () => {
  test('rejects an empty token', async () => {
    assert.equal(await verifyFirebaseToken(''), null);
  });

  test('rejects a token without three segments', async () => {
    assert.equal(await verifyFirebaseToken('not.a-token'), null);
  });

  test('rejects undecodable segments', async () => {
    assert.equal(await verifyFirebaseToken('%%%.%%%.%%%'), null);
  });

  test('rejects a payload with no uid', async () => {
    assert.equal(
      await verifyFirebaseToken(token({ alg: 'RS256' }, { email: 'a@b.com' })),
      null
    );
  });
});

describe('verifyFirebaseToken — the local demo token', () => {
  test('accepts a local-dev token whose uid is local-scoped', async () => {
    const result = await verifyFirebaseToken(
      token({ alg: 'none' }, { uid: 'local-someone', email: 'a@b.com', iss: 'yadira-local-dev' })
    );
    assert.equal(result?.tier, 'local');
    assert.equal(result?.uid, 'local-someone');
  });

  test('REJECTS a local-dev token claiming a real Firebase uid', async () => {
    // This is the whole point: the demo token is unsigned, so it must never
    // be able to name a cloud-synced family's circle.
    assert.equal(
      await verifyFirebaseToken(
        token({ alg: 'none' }, { uid: 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4', iss: 'yadira-local-dev' })
      ),
      null
    );
  });
});

describe('verifyFirebaseToken — real Firebase tokens', () => {
  test('rejects a token minted for another project (wrong audience)', async () => {
    assert.equal(
      await verifyFirebaseToken(
        token(
          { alg: 'RS256', kid: 'whatever' },
          {
            uid: 'someone',
            aud: 'some-other-project',
            iss: 'https://securetoken.google.com/some-other-project',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }
        )
      ),
      null
    );
  });

  test('rejects an unsigned token that claims our project', async () => {
    // The old middleware accepted exactly this and handed over the account.
    const projectId = process.env.FIREBASE_PROJECT_ID || 'yadira-1c1dd';
    const result = await verifyFirebaseToken(
      token(
        { alg: 'none', kid: 'made-up' },
        {
          uid: 'victim-uid',
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
      )
    );
    // Either rejected outright, or — on a server that has never reached
    // Google's certs — marked unverified, which auth.ts confines to the
    // resilience paths. It must never come back as a trusted identity.
    assert.notEqual(result?.tier, 'verified');
    assert.notEqual(result?.tier, 'stale');
  });
});
