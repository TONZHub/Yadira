// useStore — Yadira's universal persistence hook
// ------------------------------------------------------------------
// Drop-in replacement for the localStorage useState pattern.
//
// Behavior:
//   • No Firebase config  → behaves exactly like the old localStorage code
//   • Firebase configured → real-time Firestore sync across devices
//     (caregiver's phone + patient's tablet see the same data live)
//
// Usage (replaces the old pattern 1:1):
//   const [memories, setMemories] = useStoreList<Memory>('memories', INITIAL_MEMORIES);
//   const [profile, setProfile]   = useStoreDoc<CaregiverProfile>('profile', DEFAULT_PROFILE);
// ------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, getCircleId } from './firebase';
import { shouldApplySnapshot } from './snapshotRule';

// ---------- shared localStorage helpers ----------
// Keys are namespaced by care circle so two accounts sharing one browser
// can never see each other's cached data (a paying family's memories must
// not flash up for whoever logs in next on the same device).

// How long a caller gating on `synced` waits for Firestore before falling
// back to the local mirror. Long enough for a healthy connection on a slow
// tablet, short enough that a patient isn't left staring at a screen that
// was supposed to greet them.
const SYNC_SETTLE_MS = 3500;

function lsKey(key: string): string {
  return `yadira_${getCircleId()}_${key}`;
}

function readLocal<T>(key: string, fallback: T): T {
  return readLocalWithSource(key, fallback).value;
}

/**
 * The same read, plus where the value came from.
 *
 * `stored` is what lets the snapshot rule tell "this family has never written
 * anything" from "another device deleted everything while we were shut" — see
 * src/lib/snapshotRule.ts.
 */
function readLocalWithSource<T>(key: string, fallback: T): { value: T; stored: boolean } {
  try {
    const saved = localStorage.getItem(lsKey(key));
    if (saved === null) return { value: fallback, stored: false };
    return { value: JSON.parse(saved) as T, stored: true };
  } catch {
    return { value: fallback, stored: false };
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}


// ---------- LIST store (memories, faqs, logs, routine) ----------
// Items MUST have a stable `id` field (logs use `date` — see idField).

type Updater<T> = T[] | ((prev: T[]) => T[]);

export function useStoreList<T extends Record<string, any>>(
  key: string,
  initial: T[],
  idField: keyof T = 'id' as keyof T
): [T[], (next: Updater<T>) => void, boolean] {
  const initialRead = useRef<{ value: T[]; stored: boolean } | null>(null);
  if (initialRead.current === null) initialRead.current = readLocalWithSource(key, initial);
  const [items, setItems] = useState<T[]>(() => initialRead.current!.value);
  // Whether this device has ever held real data for this key. Becomes true the
  // moment we write, so a deletion elsewhere is authoritative from then on.
  const localWasStored = useRef(initialRead.current.stored);
  // Ref mirror so functional updaters resolve against latest state
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [synced, setSynced] = useState(false);
  // An empty remote collection is ambiguous on the FIRST snapshot: it means
  // either "this family has never written anything" (keep the local seed) or
  // "they deleted the last item" (apply it). Only the second is a deletion,
  // and only a snapshot after the first can be one.
  const seenSnapshot = useRef(false);

  // The family's isolated circle — resolved per mount, so it always reflects
  // the account that's actually signed in (AppContent remounts on login).
  const circleId = getCircleId();

  // Subscribe to Firestore (real-time, cross-device)
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    // A blocked or offline transport makes onSnapshot retry indefinitely
    // WITHOUT calling the error handler, so `synced` would never resolve and
    // anything gated on it never happens (camp's auto-open is the one that
    // matters — the patient simply never meets Hattie). Give the cloud a
    // moment, then commit to the local mirror; a late snapshot still applies
    // normally when it lands.
    const settleTimer = setTimeout(() => setSynced(true), SYNC_SETTLE_MS);

    const colRef = collection(db, 'careCircles', circleId, key);
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        // Our own optimistic write echoing back through the local listener.
        // This replaces a single boolean that skipped the NEXT snapshot
        // whatever it contained — so a genuine change from the other device,
        // arriving just after a local write, was discarded as our own echo and
        // never resent. Firestore already labels its own pending writes;
        // asking it is both correct and free.
        // `apply` already accounts for pending writes, so the extra early
        // return that used to sit here was both redundant and wrong: it
        // skipped marking the subscription as seen and settled, which left a
        // later empty snapshot looking like a first one. Raised in review.
        const apply = shouldApplySnapshot({
          empty: snap.empty,
          hasPendingWrites: snap.metadata.hasPendingWrites,
          seenSnapshot: seenSnapshot.current,
          localWasStored: localWasStored.current,
        });
        if (apply) {
          const remote = snap.docs.map((d) => d.data() as T);
          setItems(remote);
          writeLocal(key, remote); // keep local cache warm for offline
        }
        seenSnapshot.current = true;
        setSynced(true);
      },
      (err) => {
        // A failed listen still ANSWERS the question "what does the cloud
        // have?" — with "nothing reachable". Callers gate first paint on
        // `synced` (camp's auto-open, the premium restore), so leaving it
        // false on error hangs those features forever instead of falling
        // back to the local mirror. This is the same degradation the rest of
        // the app follows: no cloud is not an error state, it's local mode.
        console.warn(`[Yadira] Firestore listen failed for "${key}" — using the local mirror`, err);
        setSynced(true);
      }
    );
    return () => {
      clearTimeout(settleTimer);
      unsub();
    };
  }, [key, circleId]);

  const update = useCallback(
    (updater: Updater<T>) => {
      const prev = itemsRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setItems(next);
      writeLocal(key, next); // always mirror locally
      localWasStored.current = true;

      if (isFirebaseConfigured && db) {
        try {
          const batch = writeBatch(db);
          // Items removed from the list must have their Firestore docs deleted
          // too — set-only writes leave stale docs behind, and the snapshot
          // listener would resurrect every "deleted" item on the next load.
          const nextIds = new Set(next.map((item) => String(item[idField])));
          prev.forEach((item) => {
            const id = String(item[idField]);
            if (!nextIds.has(id)) {
              batch.delete(doc(db!, 'careCircles', circleId, key, id));
            }
          });
          next.forEach((item) => {
            const id = String(item[idField]);
            // Firestore rejects `undefined` field values (batch.set throws
            // SYNCHRONOUSLY, which would abort the caller mid-flow — e.g.
            // optional Message fields like `emotion`). JSON round-trip strips
            // them, matching what writeLocal already persists.
            const clean = JSON.parse(JSON.stringify(item));
            batch.set(doc(db!, 'careCircles', circleId, key, id), clean);
          });
          batch
            .commit()
            .catch((err) =>
              console.warn(`[Yadira] Firestore write failed for "${key}"`, err)
            );
        } catch (err) {
          // Cloud sync is best-effort — never let it break the UI flow.
          console.warn(`[Yadira] Firestore write failed for "${key}"`, err);
        }
      }
    },
    [key, idField, circleId]
  );

  return [items, update, synced];
}

// ---------- DOC store (caregiver profile, settings) ----------

export function useStoreDoc<T extends Record<string, any>>(
  key: string,
  initial: T
): [T, (next: T) => void, boolean] {
  const initialRead = useRef<{ value: T; stored: boolean } | null>(null);
  if (initialRead.current === null) initialRead.current = readLocalWithSource(key, initial);
  const [value, setValue] = useState<T>(() => initialRead.current!.value);
  const [synced, setSynced] = useState(false);
  const seenSnapshot = useRef(false);
  const localWasStored = useRef(initialRead.current.stored);
  const circleId = getCircleId();

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    // Same bounded wait as the list store — see the note there.
    const settleTimer = setTimeout(() => setSynced(true), SYNC_SETTLE_MS);

    const docRef = doc(db, 'careCircles', circleId, 'meta', key);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        // Same rule as the list store — skip only our OWN in-flight write,
        // never a real remote change that arrived just after it.
        const apply = shouldApplySnapshot({
          empty: !snap.exists(),
          hasPendingWrites: snap.metadata.hasPendingWrites,
          seenSnapshot: seenSnapshot.current,
          localWasStored: localWasStored.current,
        });
        if (apply) {
          if (snap.exists()) {
            const remote = snap.data() as T;
            setValue(remote);
            writeLocal(key, remote);
          } else {
            // A document that USED to exist and now does not is a deletion,
            // and the list store's bug had a twin here: `snap.exists()` was
            // the only branch, so the deleted doc stayed in state and in the
            // local mirror and never left this device. Raised in review.
            setValue(initial);
            writeLocal(key, initial);
          }
        }
        seenSnapshot.current = true;
        setSynced(true);
      },
      (err) => {
        // A failed listen still ANSWERS the question "what does the cloud
        // have?" — with "nothing reachable". Callers gate first paint on
        // `synced` (camp's auto-open, the premium restore), so leaving it
        // false on error hangs those features forever instead of falling
        // back to the local mirror. This is the same degradation the rest of
        // the app follows: no cloud is not an error state, it's local mode.
        console.warn(`[Yadira] Firestore listen failed for "${key}" — using the local mirror`, err);
        setSynced(true);
      }
    );
    return () => {
      clearTimeout(settleTimer);
      unsub();
    };
  }, [key, circleId]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeLocal(key, next);
      localWasStored.current = true;

      if (isFirebaseConfigured && db) {
        try {
          const clean = JSON.parse(JSON.stringify(next));
          setDoc(doc(db, 'careCircles', circleId, 'meta', key), clean).catch(
            (err) =>
              console.warn(`[Yadira] Firestore write failed for "${key}"`, err)
          );
        } catch (err) {
          console.warn(`[Yadira] Firestore write failed for "${key}"`, err);
        }
      }
    },
    [key, circleId]
  );

  return [value, update, synced];
}
