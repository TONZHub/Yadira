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
  /**
   * Did the local value come from localStorage, rather than being the
   * untouched built-in seed?
   *
   * This is the difference between the two things an empty first snapshot can
   * mean, and without it the rule guesses. See below.
   */
  localWasStored: boolean;
}

export function shouldApplySnapshot({
  empty,
  hasPendingWrites,
  seenSnapshot,
  localWasStored,
}: SnapshotFacts): boolean {
  // Our own optimistic write echoing back. The previous guard was a single
  // boolean that skipped the NEXT snapshot whatever it held — so a genuine
  // change from the other device, arriving just after a local write, was
  // discarded as our own echo and never resent. Firestore labels its own
  // pending writes; asking it is both correct and free.
  if (hasPendingWrites) return false;

  // A later empty snapshot is unambiguous: something was there and now is not.
  if (!empty || seenSnapshot) return true;

  // An empty FIRST snapshot is the hard case, and it has two causes:
  //
  //   · This family has never written anything. Applying it would wipe the
  //     sample family the caregiver just chose, before they touched it.
  //   · Another device deleted everything while this one was offline or shut.
  //     NOT applying it leaves stale items here — and this device's next write
  //     puts them back for the whole family. A deletion that comes back is
  //     worse than one that simply fails.
  //
  // `seenSnapshot` alone cannot tell those apart, which is a gap this rule
  // shipped with and review caught. What separates them is where the local
  // value came from: the built-in seed means nothing has ever been written
  // here, while a value read out of localStorage means this device HAS held
  // real data — so an authoritative empty cloud is news, not absence.
  return localWasStored;
}
