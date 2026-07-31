import type { Closure } from "@/data/vehicle";

// The Lexus status feed alternates between full snapshots (every door, window,
// and opening with positions — while the car sits parked) and sparse ones
// (lock-only doors, no window/opening sections — right after a drive; see
// docs/vehicle-status-and-control.md). Rendering a sparse snapshot alone loses
// most of the dashboard.
//
// So we keep a *materialized* last-known state, not an event log: for each
// closure, the most recent value of each field and when it was observed.
// Every snapshot folds in once — per field, newest observation wins — so the
// store is constant-size, folding is O(closures in the snapshot), and nothing
// a full snapshot established ever disappears when a sparse one arrives. Each
// field carries its own timestamp so the UI can show honest "as of" staleness
// instead of presenting an old reading as current.

export type FieldRecord<T> = {
  value: T;
  /** Server occurrenceDate of the snapshot this value came from. */
  at: string;
  /**
   * True while this is a client-side optimistic prediction (from a just-accepted
   * lock/unlock command) awaiting a server reading that confirms or corrects it.
   * See applyOptimisticLock and the reconciliation in foldLocked.
   */
  optimistic?: boolean;
  /**
   * The last real server reading an optimistic prediction is standing in for.
   * A prediction the vehicle never confirms expires back to this rather than
   * to another guess — see expireOptimisticLocks. Absent on settled values.
   */
  previous?: { value: T; at: string };
};

export type ClosureRecord = {
  label: string;
  state?: FieldRecord<"Closed" | "Open">;
  locked?: FieldRecord<boolean>;
  /** First-seen index, so display order is stable across folds. */
  order: number;
};

export type ClosureStore = {
  /** VIN the store belongs to — a different vehicle starts fresh. */
  vin: string;
  /** Keyed by closure label. */
  closures: Record<string, ClosureRecord>;
  /** Monotonic counter backing `order`. */
  seq: number;
};

export type ClosureObservation = {
  /** Server occurrenceDate of the status snapshot. */
  occurredAt: string;
  closures: Closure[];
};

function parseTime(value: string | undefined): number {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

// A field updates when the incoming observation is at least as recent as what
// we hold. `>=` (not `>`) lets a same-timestamp re-report refresh a value
// harmlessly and keeps the fold idempotent.
function isAtLeastAsRecent(incoming: string, held: string | undefined): boolean {
  return held === undefined || parseTime(incoming) >= parseTime(held);
}

const emptyStore = (vin: string): ClosureStore => ({ vin, closures: {}, seq: 0 });

// Fold a real server lock reading over what we hold. A held *optimistic*
// prediction is confirmed (its flag cleared) by any reading that agrees, and
// corrected by a reading strictly newer than the prediction's stamp. A stale
// reading that merely disagrees — its occurrenceDate predates the command we
// optimistically applied — is ignored, so a non-waking GET returning the car's
// pre-command state can't flicker the lock back. A non-optimistic value follows
// the usual newest-wins rule.
function foldLocked(
  held: FieldRecord<boolean> | undefined,
  incoming: boolean,
  at: string,
): FieldRecord<boolean> {
  if (!held) {
    return { value: incoming, at };
  }
  if (held.optimistic) {
    if (held.value === incoming || parseTime(at) > parseTime(held.at)) {
      return { value: incoming, at };
    }
    return held;
  }
  return isAtLeastAsRecent(at, held.at) ? { value: incoming, at } : held;
}

/**
 * Fold one status observation into the store: for each closure it reports,
 * overwrite a field only when the observation is newer than the stored one.
 * A different VIN resets the store.
 */
export function applyObservation(
  store: ClosureStore | null,
  vin: string,
  observation: ClosureObservation,
): ClosureStore {
  const base = store && store.vin === vin ? store : emptyStore(vin);
  const closures: Record<string, ClosureRecord> = { ...base.closures };
  let seq = base.seq;
  const at = observation.occurredAt;

  for (const closure of observation.closures) {
    const existing = closures[closure.label];
    const record: ClosureRecord = existing
      ? { ...existing }
      : { label: closure.label, order: seq++ };
    if (closure.state !== undefined && isAtLeastAsRecent(at, record.state?.at)) {
      record.state = { value: closure.state, at };
    }
    if (closure.locked !== undefined) {
      record.locked = foldLocked(record.locked, closure.locked, at);
    }
    closures[closure.label] = record;
  }

  return { vin, closures, seq };
}

/**
 * How long an unconfirmed prediction may stand before it expires back to the
 * last real reading. The in-app reconciliation (remote-command-effects.ts) runs
 * well inside this and expires its own prediction the moment it gives up; this
 * is the backstop for a prediction that outlived the run that made it — the app
 * was backgrounded mid-reconcile, or killed and relaunched — so a guess can
 * never be rendered as state indefinitely.
 */
export const OPTIMISTIC_LOCK_MAX_AGE_MS = 90 * 1000;

/**
 * Optimistically set the lock state of every door to the value a just-accepted
 * lock/unlock command should produce — flagged optimistic and stamped `at` (the
 * client's send time, ISO). A "door" is any closure that already carries a lock
 * reading; closures without one are left untouched, since we only predict what
 * we can name. The next server reading reconciles each prediction via the fold
 * in applyObservation (confirm / correct / ignore-if-stale). A different VIN
 * resets the store.
 *
 * The reading the prediction displaces is kept as `previous`, so a command the
 * vehicle never confirms can fall back to the last thing it actually told us.
 */
export function applyOptimisticLock(
  store: ClosureStore | null,
  vin: string,
  locked: boolean,
  at: string,
): ClosureStore {
  const base = store && store.vin === vin ? store : emptyStore(vin);
  const closures: Record<string, ClosureRecord> = {};
  for (const [label, record] of Object.entries(base.closures)) {
    const held = record.locked;
    if (held === undefined) {
      closures[label] = record;
      continue;
    }
    // A second command issued before the first settles keeps the original
    // server reading as the fallback — never the earlier prediction.
    const previous = held.optimistic ? held.previous : { value: held.value, at: held.at };
    closures[label] = {
      ...record,
      locked: { value: locked, at, optimistic: true, ...(previous ? { previous } : {}) },
    };
  }
  return { vin, closures, seq: base.seq };
}

/** Whether any closure still carries an unconfirmed optimistic lock prediction. */
export function hasOptimisticLock(store: ClosureStore | null): boolean {
  return Object.values(store?.closures ?? {}).some((record) => record.locked?.optimistic);
}

/**
 * Drop every optimistic lock prediction stamped at least `maxAgeMs` before
 * `now`, restoring the reading it displaced (or leaving the closure's lock
 * unknown, if there was none). The vehicle accepting a command is not the
 * vehicle performing it — a lock the car refuses (an open door, say) is simply
 * never reported back, and the fold has no newer reading to correct the
 * prediction with, so without an expiry "Locking…" stands until the car
 * happens to push a fresh snapshot.
 *
 * Returns the store unchanged (same reference) when nothing expired, so callers
 * can tell a no-op from a revert. An unparseable stamp counts as expired.
 */
export function expireOptimisticLocks(
  store: ClosureStore | null,
  now: number = Date.now(),
  maxAgeMs: number = OPTIMISTIC_LOCK_MAX_AGE_MS,
): ClosureStore | null {
  if (!store) {
    return store;
  }
  const closures: Record<string, ClosureRecord> = {};
  let expired = false;
  for (const [label, record] of Object.entries(store.closures)) {
    const held = record.locked;
    if (!held?.optimistic || now - parseTime(held.at) < maxAgeMs) {
      closures[label] = record;
      continue;
    }
    expired = true;
    const reverted: ClosureRecord = { ...record };
    if (held.previous) {
      reverted.locked = { ...held.previous };
    } else {
      delete reverted.locked;
    }
    closures[label] = reverted;
  }
  return expired ? { ...store, closures } : store;
}

/**
 * The materialized display state: every closure ever observed, in first-seen
 * order, each field carrying its value and observation time. This is what the
 * dashboard renders.
 */
export function readClosures(store: ClosureStore | null): Closure[] {
  if (!store) {
    return [];
  }
  return Object.values(store.closures)
    .sort((a, b) => a.order - b.order)
    .map((record) => {
      const closure: Closure = { label: record.label };
      if (record.state) {
        closure.state = record.state.value;
        closure.stateAt = record.state.at;
      }
      if (record.locked) {
        closure.locked = record.locked.value;
        closure.lockedAt = record.locked.at;
        if (record.locked.optimistic) {
          closure.lockedOptimistic = true;
        }
      }
      return closure;
    });
}

/** Runtime shape check for a persisted store (see closure-state-store.ts). */
export function parseClosureStore(value: unknown): ClosureStore | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ClosureStore).vin === "string" &&
    typeof (value as ClosureStore).seq === "number" &&
    typeof (value as ClosureStore).closures === "object" &&
    (value as ClosureStore).closures !== null
  ) {
    return value as ClosureStore;
  }
  return null;
}
