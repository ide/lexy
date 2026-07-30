import type { Closure } from '@/data/vehicle';

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
};

export type ClosureRecord = {
  label: string;
  state?: FieldRecord<'Closed' | 'Open'>;
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
    if (closure.locked !== undefined && isAtLeastAsRecent(at, record.locked?.at)) {
      record.locked = { value: closure.locked, at };
    }
    closures[closure.label] = record;
  }

  return { vin, closures, seq };
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
      }
      return closure;
    });
}

/** Runtime shape check for a persisted store (see closure-state-store.ts). */
export function parseClosureStore(value: unknown): ClosureStore | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ClosureStore).vin === 'string' &&
    typeof (value as ClosureStore).seq === 'number' &&
    typeof (value as ClosureStore).closures === 'object' &&
    (value as ClosureStore).closures !== null
  ) {
    return value as ClosureStore;
  }
  return null;
}
