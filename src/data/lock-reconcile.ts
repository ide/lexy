// The confirmation schedule for a lock/unlock command, and the loop that runs
// it. Pure: every effect (sleeping, re-reading status, checking the store,
// priming, abandoning) is injected, so the schedule and its control flow are
// unit-testable in Node — the queryClient/SQLite binding lives in
// remote-command-effects.ts.
//
// Why a schedule at all: the server accepting a lock command says nothing
// about the car performing it (docs/vehicle-status-and-control.md, "Command
// lifecycle"), and the 21MM REST plane has no command-status endpoint — the
// only instrument is re-reading status until the optimistic prediction is
// confirmed or corrected. A refusal (locking with the trunk open) is reported
// by *never reporting the change*, so a run that exhausts the schedule must
// abandon the prediction rather than show a guess indefinitely.

/**
 * When to re-read status, measured from acceptance. The car pushes its own
 * status event once the actuation lands, but propagation into the non-waking
 * GET takes anywhere from seconds to half a minute — two quick fixed refetches
 * routinely both saw the pre-command snapshot.
 */
export const LOCK_RECONCILE_AT_MS = [0, 5_000, 12_000, 25_000] as const;

/**
 * And when to re-read after the `prime` escalation, measured from the prime
 * returning. Waking the telematics unit is the strongest ask we have, but the
 * car still needs a few seconds to answer it — a single immediate read lands
 * before the wake does.
 */
export const LOCK_RECONCILE_AFTER_PRIME_MS = [3_000, 9_000, 18_000] as const;

/** A generous bound on how long the prime POST itself may take. */
const PRIME_ALLOWANCE_MS = 15_000;

/**
 * How long a reconciliation can possibly run before it abandons its
 * prediction: the full pre-prime schedule, the prime itself, then the full
 * post-prime schedule. Derived, not written down — so stretching a schedule
 * above can never silently outgrow the expiry window below.
 */
export const LOCK_RECONCILE_HORIZON_MS =
  LOCK_RECONCILE_AT_MS[LOCK_RECONCILE_AT_MS.length - 1]! +
  PRIME_ALLOWANCE_MS +
  LOCK_RECONCILE_AFTER_PRIME_MS[LOCK_RECONCILE_AFTER_PRIME_MS.length - 1]!;

/**
 * How long an unconfirmed prediction may stand before vehicle-load.ts expires
 * it on sight. The reconciliation abandons its own prediction the moment it
 * gives up (inside the horizon above); this is the backstop for a prediction
 * that outlived the run that made it — the app was backgrounded mid-reconcile
 * (JS timers suspend) or killed and relaunched — so a guess can never be
 * rendered as state indefinitely. The margin keeps a *live* run's prediction
 * safely out of the backstop's reach.
 */
export const OPTIMISTIC_LOCK_MAX_AGE_MS = LOCK_RECONCILE_HORIZON_MS + 30_000;

export type LockReconcileEffects = {
  sleep: (ms: number) => Promise<void>;
  /** Re-read status from the server and fold it into the closure store. */
  readStatus: () => Promise<void>;
  /** Whether the store still holds an unconfirmed optimistic prediction. */
  hasPrediction: () => Promise<boolean>;
  /**
   * Request a fresh server-side snapshot from the car (the telematics prime).
   * Resolves to whether a prime was actually sent; absent when the caller has
   * no way to prime.
   */
  prime?: (() => Promise<boolean>) | undefined;
  /** Stand the prediction down — the run is giving up. */
  abandon: () => Promise<void>;
};

// Walk one schedule (offsets from its start), re-reading status at each step
// and stopping as soon as the prediction settles. Returns whether it did.
async function pollUntilSettled(
  effects: LockReconcileEffects,
  schedule: readonly number[],
): Promise<boolean> {
  let elapsed = 0;
  for (const at of schedule) {
    await effects.sleep(at - elapsed);
    elapsed = at;
    if (!(await effects.hasPrediction())) {
      return true;
    }
    await effects.readStatus();
    if (!(await effects.hasPrediction())) {
      return true;
    }
  }
  return false;
}

/**
 * Re-read status until the optimistic lock prediction is confirmed or
 * corrected. If the whole schedule passes and the prediction still stands,
 * escalate once to `prime` — the same telematics wake pull-to-refresh sends —
 * and read again a few times. If the car still hasn't reported, the command's
 * outcome is genuinely unknown: abandon the prediction rather than show it
 * indefinitely.
 */
export async function reconcileLock(effects: LockReconcileEffects): Promise<void> {
  if (await pollUntilSettled(effects, LOCK_RECONCILE_AT_MS)) {
    return;
  }
  if (effects.prime && (await effects.prime().catch(() => false))) {
    if (await pollUntilSettled(effects, LOCK_RECONCILE_AFTER_PRIME_MS)) {
      return;
    }
  }
  await effects.abandon();
}
