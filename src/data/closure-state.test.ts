import { describe, expect, it } from "vitest";

import {
  applyObservation,
  applyOptimisticLock,
  expireOptimisticLocks,
  hasOptimisticLock,
  parseClosureStore,
  readClosures,
  type ClosureStore,
} from "./closure-state";
import type { Closure } from "./vehicle";

const VIN = "JTHGZ1B20M5000000";

// Shapes captured live 2026-07-29: a parked car reports everything with
// positions; after driving the same endpoint reports lock-only doors and no
// window/opening sections at all.
const fullClosures: Closure[] = [
  { label: "Driver Door", state: "Closed", locked: true },
  { label: "Driver Window", state: "Closed" },
  { label: "Passenger Door", state: "Closed", locked: true },
  { label: "Passenger Window", state: "Closed" },
  { label: "Trunk", state: "Closed" },
];

const sparseClosures: Closure[] = [
  { label: "Driver Door", state: "Closed", locked: true },
  { label: "Passenger Door", locked: false },
];

const FULL_AT = "2026-07-29T16:41:00Z";
const SPARSE_AT = "2026-07-29T20:08:00Z";
const full = { occurredAt: FULL_AT, closures: fullClosures };
const sparse = { occurredAt: SPARSE_AT, closures: sparseClosures };

describe("applyObservation + readClosures", () => {
  it("overlays a sparse observation on the last full snapshot without losing fields", () => {
    let store: ClosureStore | null = applyObservation(null, VIN, full);
    store = applyObservation(store, VIN, sparse);
    expect(readClosures(store)).toEqual([
      // The driver door was in both snapshots, so both its fields advance to
      // the sparse time. The passenger door's lock came from the sparse
      // snapshot but its position (and every window/opening) survives from the
      // full one — those keep the full-snapshot timestamp.
      {
        label: "Driver Door",
        state: "Closed",
        stateAt: SPARSE_AT,
        locked: true,
        lockedAt: SPARSE_AT,
      },
      { label: "Driver Window", state: "Closed", stateAt: FULL_AT },
      {
        label: "Passenger Door",
        state: "Closed",
        stateAt: FULL_AT,
        locked: false,
        lockedAt: SPARSE_AT,
      },
      { label: "Passenger Window", state: "Closed", stateAt: FULL_AT },
      { label: "Trunk", state: "Closed", stateAt: FULL_AT },
    ]);
  });

  it("never regresses a field to an older observation", () => {
    let store: ClosureStore | null = applyObservation(null, VIN, full);
    // A stale sparse snapshot (older than the full one) must not overwrite.
    store = applyObservation(store, VIN, {
      occurredAt: "2026-07-29T09:00:00Z",
      closures: [{ label: "Passenger Door", locked: false }],
    });
    const passenger = readClosures(store).find((c) => c.label === "Passenger Door");
    expect(passenger).toEqual({
      label: "Passenger Door",
      state: "Closed",
      stateAt: FULL_AT,
      locked: true,
      lockedAt: FULL_AT,
    });
  });

  it("is constant-size: repeated folds do not grow the store", () => {
    let store: ClosureStore | null = applyObservation(null, VIN, full);
    const labelCount = Object.keys(store.closures).length;
    for (let i = 0; i < 20; i++) {
      store = applyObservation(store, VIN, {
        occurredAt: `2026-07-30T00:${String(i).padStart(2, "0")}:00Z`,
        closures: sparseClosures,
      });
    }
    expect(Object.keys(store.closures).length).toBe(labelCount);
  });

  it("preserves first-seen order, including closures first seen while sparse", () => {
    let store: ClosureStore | null = applyObservation(null, VIN, sparse);
    store = applyObservation(store, VIN, full);
    expect(readClosures(store).map((c) => c.label)).toEqual([
      "Driver Door",
      "Passenger Door",
      "Driver Window",
      "Passenger Window",
      "Trunk",
    ]);
  });

  it("resets for a different VIN", () => {
    const store = applyObservation(applyObservation(null, VIN, full), "OTHERVIN", sparse);
    expect(store.vin).toBe("OTHERVIN");
    expect(readClosures(store)).toEqual([
      {
        label: "Driver Door",
        state: "Closed",
        stateAt: SPARSE_AT,
        locked: true,
        lockedAt: SPARSE_AT,
      },
      { label: "Passenger Door", locked: false, lockedAt: SPARSE_AT },
    ]);
  });

  it("is a pure function of the stored record (survives a JSON round-trip)", () => {
    let store: ClosureStore | null = applyObservation(null, VIN, full);
    store = applyObservation(store, VIN, sparse);
    const roundTripped = JSON.parse(JSON.stringify(store)) as ClosureStore;
    expect(readClosures(roundTripped)).toEqual(readClosures(store));
  });
});

describe("applyOptimisticLock", () => {
  // Stamped after both snapshots so a later real reading can be either older
  // (stale, pre-command) or newer (post-command) relative to it.
  const OPT_AT = "2026-07-29T21:00:00Z";

  it("predicts every door and flags it optimistic, leaving lock-less closures alone", () => {
    const store = applyOptimisticLock(applyObservation(null, VIN, full), VIN, false, OPT_AT);
    expect(readClosures(store)).toEqual([
      // Doors flip to the predicted state at OPT_AT, marked optimistic; their
      // position and every lock-less closure (windows, trunk) are untouched.
      {
        label: "Driver Door",
        state: "Closed",
        stateAt: FULL_AT,
        locked: false,
        lockedAt: OPT_AT,
        lockedOptimistic: true,
      },
      { label: "Driver Window", state: "Closed", stateAt: FULL_AT },
      {
        label: "Passenger Door",
        state: "Closed",
        stateAt: FULL_AT,
        locked: false,
        lockedAt: OPT_AT,
        lockedOptimistic: true,
      },
      { label: "Passenger Window", state: "Closed", stateAt: FULL_AT },
      { label: "Trunk", state: "Closed", stateAt: FULL_AT },
    ]);
  });

  it("hasOptimisticLock tracks pending predictions across folds", () => {
    let store = applyObservation(null, VIN, full);
    expect(hasOptimisticLock(store)).toBe(false);
    store = applyOptimisticLock(store, VIN, false, OPT_AT);
    expect(hasOptimisticLock(store)).toBe(true);
    // A stale disagreeing reading leaves the prediction pending...
    store = applyObservation(store, VIN, {
      occurredAt: FULL_AT,
      closures: [
        { label: "Driver Door", locked: true },
        { label: "Passenger Door", locked: true },
      ],
    });
    expect(hasOptimisticLock(store)).toBe(true);
    // ...and a newer confirming one settles every door.
    store = applyObservation(store, VIN, {
      occurredAt: "2026-07-30T00:00:00Z",
      closures: [
        { label: "Driver Door", locked: false },
        { label: "Passenger Door", locked: false },
      ],
    });
    expect(hasOptimisticLock(store)).toBe(false);
    expect(hasOptimisticLock(null)).toBe(false);
  });

  it("a confirming server reading clears the optimistic flag even when its timestamp is older", () => {
    let store = applyOptimisticLock(applyObservation(null, VIN, full), VIN, false, OPT_AT);
    // A stale (pre-command) GET that happens to agree confirms the prediction.
    store = applyObservation(store, VIN, {
      occurredAt: "2026-07-29T18:00:00Z",
      closures: [{ label: "Driver Door", locked: false }],
    });
    const driver = readClosures(store).find((c) => c.label === "Driver Door");
    expect(driver?.locked).toBe(false);
    expect(driver?.lockedOptimistic).toBeUndefined();
  });

  it("keeps a pending prediction when a stale reading disagrees, but adopts a newer one", () => {
    const base = applyOptimisticLock(applyObservation(null, VIN, full), VIN, false, OPT_AT);
    // Stale disagreeing reading (from before the command) is ignored — the door
    // stays optimistically unlocked and pending.
    const stale = applyObservation(base, VIN, {
      occurredAt: "2026-07-29T18:00:00Z",
      closures: [{ label: "Driver Door", locked: true }],
    });
    const staleDoor = readClosures(stale).find((c) => c.label === "Driver Door");
    expect(staleDoor?.locked).toBe(false);
    expect(staleDoor?.lockedOptimistic).toBe(true);

    // A reading newer than the command corrects the prediction (command didn't
    // take, or state changed since) and clears the flag.
    const fresh = applyObservation(base, VIN, {
      occurredAt: "2026-07-29T21:30:00Z",
      closures: [{ label: "Driver Door", locked: true }],
    });
    const freshDoor = readClosures(fresh).find((c) => c.label === "Driver Door");
    expect(freshDoor?.locked).toBe(true);
    expect(freshDoor?.lockedOptimistic).toBeUndefined();
  });

  it("starts a fresh store for a different VIN", () => {
    const store = applyOptimisticLock(applyObservation(null, VIN, full), "OTHERVIN", true, OPT_AT);
    expect(store.vin).toBe("OTHERVIN");
    expect(readClosures(store)).toEqual([]);
  });
});

describe("expireOptimisticLocks", () => {
  const OPT_AT = "2026-07-29T21:00:00Z";
  const sentAt = new Date(OPT_AT).getTime();
  const pending = () => applyOptimisticLock(applyObservation(null, VIN, full), VIN, false, OPT_AT);

  it("leaves a prediction alone inside its window", () => {
    const store = pending();
    expect(expireOptimisticLocks(store, 90_000, sentAt + 30_000)).toBe(store);
    expect(expireOptimisticLocks(null, 90_000, sentAt)).toBeNull();
  });

  it("reverts an expired prediction to the reading it displaced", () => {
    // The vehicle accepted the unlock and never reported it — the doors were
    // locked before, and locked is what they are known to be.
    const expired = expireOptimisticLocks(pending(), 90_000, sentAt + 90_000);
    expect(hasOptimisticLock(expired)).toBe(false);
    expect(readClosures(expired).find((c) => c.label === "Driver Door")).toEqual({
      label: "Driver Door",
      state: "Closed",
      stateAt: FULL_AT,
      locked: true,
      lockedAt: FULL_AT,
    });
  });

  it("leaves the lock unknown when there is no reading to fall back to", () => {
    // A prediction persisted by a build that didn't keep what it displaced.
    // Unknown is the honest answer; a guess is not improved by keeping it.
    const store: ClosureStore = {
      vin: VIN,
      seq: 1,
      closures: {
        "Driver Door": {
          label: "Driver Door",
          order: 0,
          state: { value: "Closed", at: FULL_AT },
          locked: { value: false, at: OPT_AT, optimistic: true },
        },
      },
    };
    const expired = expireOptimisticLocks(store, 90_000, sentAt + 90_000);
    expect(readClosures(expired)).toEqual([
      { label: "Driver Door", state: "Closed", stateAt: FULL_AT },
    ]);
  });

  it("keeps the original reading as the fallback across a second command", () => {
    // Lock, then unlock before either settles: the fallback is the last thing
    // the vehicle actually said, never the first prediction.
    const relocked = applyOptimisticLock(pending(), VIN, true, "2026-07-29T21:00:20Z");
    const expired = expireOptimisticLocks(relocked, 90_000, sentAt + 120_000);
    const driver = readClosures(expired).find((c) => c.label === "Driver Door");
    expect(driver?.locked).toBe(true);
    expect(driver?.lockedAt).toBe(FULL_AT);
    expect(driver?.lockedOptimistic).toBeUndefined();
  });

  it("expires only predictions at least as old as the command that gave up", () => {
    // How remote-command-effects stands its own prediction down without
    // touching one from a command the user issued seconds ago.
    const now = sentAt + 60_000;
    const newer = applyOptimisticLock(pending(), VIN, true, new Date(now - 5_000).toISOString());
    expect(expireOptimisticLocks(newer, now - sentAt, now)).toBe(newer);
  });

  it("treats an unparseable stamp as expired rather than eternal", () => {
    const store = applyOptimisticLock(applyObservation(null, VIN, full), VIN, false, "not a date");
    expect(hasOptimisticLock(expireOptimisticLocks(store, 90_000, sentAt))).toBe(false);
  });

  it("survives a JSON round-trip (the store is persisted)", () => {
    const store = JSON.parse(JSON.stringify(pending())) as ClosureStore;
    const expired = expireOptimisticLocks(store, 90_000, sentAt + 90_000);
    expect(readClosures(expired).find((c) => c.label === "Driver Door")?.locked).toBe(true);
  });
});

describe("parseClosureStore", () => {
  it("accepts a well-formed store and rejects junk", () => {
    const store = applyObservation(null, VIN, full);
    expect(parseClosureStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    expect(parseClosureStore(null)).toBeNull();
    expect(parseClosureStore({ vin: VIN })).toBeNull();
  });
});
