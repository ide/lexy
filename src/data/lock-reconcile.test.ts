import { describe, expect, it, vi } from "vitest";

import {
  LOCK_RECONCILE_AFTER_PRIME_MS,
  LOCK_RECONCILE_AT_MS,
  LOCK_RECONCILE_HORIZON_MS,
  OPTIMISTIC_LOCK_MAX_AGE_MS,
  reconcileLock,
  type LockReconcileEffects,
} from "./lock-reconcile";

/**
 * A run with every effect recorded and time collapsed. `settleAfter` is how
 * many status reads the (imaginary) car takes to report the new lock state —
 * Infinity for the vehicle that never does, which is the case this whole
 * module exists for.
 */
function run({
  settleAfter = Infinity,
  prime,
}: { settleAfter?: number; prime?: () => Promise<boolean> } = {}) {
  const slept: number[] = [];
  let reads = 0;
  const abandon = vi.fn(async () => {});
  const effects: LockReconcileEffects = {
    sleep: async (ms) => {
      slept.push(ms);
    },
    readStatus: async () => {
      reads++;
    },
    hasPrediction: async () => reads < settleAfter,
    prime,
    abandon,
  };
  return { effects, slept, abandon, reads: () => reads };
}

describe("reconcileLock", () => {
  it("re-reads on the schedule until the car reports", async () => {
    const { effects, slept, abandon, reads } = run({ settleAfter: 2 });
    await reconcileLock(effects);
    // Stops the moment the prediction settles: two reads, and only the sleeps
    // that preceded them.
    expect(reads()).toBe(2);
    expect(slept).toEqual([LOCK_RECONCILE_AT_MS[0], LOCK_RECONCILE_AT_MS[1]]);
    expect(abandon).not.toHaveBeenCalled();
  });

  it("sleeps to each offset from the start, not between reads", async () => {
    // The schedule is offsets from acceptance, so consecutive waits are the
    // gaps between them — a schedule read as gaps would drift later and later.
    const { effects, slept } = run();
    await reconcileLock(effects);
    const gaps = LOCK_RECONCILE_AT_MS.map((at, i) => at - (LOCK_RECONCILE_AT_MS[i - 1] ?? 0));
    expect(slept.slice(0, gaps.length)).toEqual(gaps);
  });

  it("escalates to a prime once the plain re-reads are exhausted", async () => {
    const prime = vi.fn(async () => true);
    // Settles only after the prime's reads have started.
    const { effects, abandon, reads } = run({
      settleAfter: LOCK_RECONCILE_AT_MS.length + 1,
      prime,
    });
    await reconcileLock(effects);
    expect(prime).toHaveBeenCalledOnce();
    expect(reads()).toBe(LOCK_RECONCILE_AT_MS.length + 1);
    expect(abandon).not.toHaveBeenCalled();
  });

  it("abandons the prediction when the car never reports", async () => {
    const prime = vi.fn(async () => true);
    const { effects, abandon, reads } = run({ prime });
    await reconcileLock(effects);
    expect(prime).toHaveBeenCalledOnce();
    expect(reads()).toBe(LOCK_RECONCILE_AT_MS.length + LOCK_RECONCILE_AFTER_PRIME_MS.length);
    expect(abandon).toHaveBeenCalledOnce();
  });

  // A declined prime (the per-VIN rate limiter) means the strongest ask never
  // reached the car, so reading again would only re-read the same snapshot.
  it("skips the post-prime reads when the prime was not sent", async () => {
    const { effects, abandon, reads } = run({ prime: async () => false });
    await reconcileLock(effects);
    expect(reads()).toBe(LOCK_RECONCILE_AT_MS.length);
    expect(abandon).toHaveBeenCalledOnce();
  });

  it("abandons rather than propagates when the prime throws", async () => {
    const { effects, abandon } = run({
      prime: async () => {
        throw new Error("network");
      },
    });
    await expect(reconcileLock(effects)).resolves.toBeUndefined();
    expect(abandon).toHaveBeenCalledOnce();
  });

  it("abandons after the plain schedule when there is no way to prime", async () => {
    const { effects, abandon, reads } = run();
    await reconcileLock(effects);
    expect(reads()).toBe(LOCK_RECONCILE_AT_MS.length);
    expect(abandon).toHaveBeenCalledOnce();
  });

  // The store may have settled between the last read and giving up.
  it("checks the prediction before each read, not only after", async () => {
    const { effects, abandon, reads } = run({ settleAfter: 0 });
    await reconcileLock(effects);
    expect(reads()).toBe(0);
    expect(abandon).not.toHaveBeenCalled();
  });
});

describe("the expiry windows", () => {
  // The backstop in vehicle-load.ts expires any prediction older than
  // OPTIMISTIC_LOCK_MAX_AGE_MS on sight. If a live reconciliation could still be
  // running at that age, the loader would pull the prediction out from under it
  // — the label reverting while the app is still actively confirming it. This is
  // why the backstop is derived from the schedule rather than written down
  // beside it: stretching the schedule can't silently break the relationship.
  it("leaves a running reconciliation inside the backstop window", () => {
    expect(OPTIMISTIC_LOCK_MAX_AGE_MS).toBeGreaterThan(LOCK_RECONCILE_HORIZON_MS);
  });

  it("bounds the horizon by both schedules", () => {
    expect(LOCK_RECONCILE_HORIZON_MS).toBeGreaterThan(
      LOCK_RECONCILE_AT_MS[LOCK_RECONCILE_AT_MS.length - 1]! +
        LOCK_RECONCILE_AFTER_PRIME_MS[LOCK_RECONCILE_AFTER_PRIME_MS.length - 1]!,
    );
  });
});
