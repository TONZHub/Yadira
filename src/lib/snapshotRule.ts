// When a Firestore snapshot should replace what the family is looking at.
// ------------------------------------------------------------------
// Its own module, with no imports, for two reasons. It encodes two bugs that
// were both silent data loss, so the rule deserves to be asserted rather than
// merely changed — and useStore.ts pulls in Firebase, which cannot be loaded
// outside a browser.

export interface SnapshotFacts {
  /** The remote collection/doc has nothing in it. */
  empty: boolean;
  /** Firestore says this snapshot carries our own un-acknowledged write. */
  hasPendingWrites: boolean;
  /** Have we already received a snapshot for this subscription? */
  seenSnapshot: boolean;
}

export function shouldApplySnapshot({
  empty,
  hasPendingWrites,
  seenSnapshot,
}: SnapshotFacts): boolean {
  // Our own optimistic write echoing back. The previous guard was a single
  // boolean that skipped the NEXT snapshot whatever it held — so a genuine
  // change from the other device, arriving just after a local write, was
  // discarded as our own echo and never resent. Firestore labels its own
  // pending writes; asking it is both correct and free.
  if (hasPendingWrites) return false;

  // An empty remote collection is ambiguous exactly once. On the FIRST
  // snapshot it means "this family has never written anything" — apply it and
  // the local seed is wiped before they have touched anything. On any later
  // snapshot it means the last item was deleted, and NOT applying it is how a
  // deletion fails to cross devices and then gets resurrected by the other
  // device's next write. A deletion that comes back is worse than one that
  // simply fails.
  if (empty && !seenSnapshot) return false;

  return true;
}
