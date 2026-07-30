import type { Closure } from '@/data/vehicle';

// The Lexus status feed alternates between full snapshots (every door, window,
// and opening with positions — typically while the car sits parked) and sparse
// ones (lock-only doors, no window/opening sections at all — typically right
// after driving). Rendering a sparse snapshot alone loses most of the
// dashboard, so we keep a log: the last full snapshot as the base plus every
// distinct observation since, and merge them per closure/per field for
// display. The raw observations are what's persisted — not the merged result —
// so the merge can always be recomputed (or improved) from the record.

export type ClosureObservation = {
  /** Server occurrenceDate of the status snapshot. */
  occurredAt: string;
  closures: Closure[];
};

export type ClosureLog = {
  /** VIN the log belongs to — a different vehicle starts a fresh log. */
  vin: string;
  /** Oldest → newest; the first entry is the last full snapshot when one exists. */
  observations: ClosureObservation[];
};

// Bound the record: sparse observations arrive at most once per status fetch,
// and every full snapshot resets the log, so 50 is weeks of headroom.
const MAX_OBSERVATIONS = 50;

/**
 * Whether a snapshot is a full one. Windows only ever appear carrying a
 * position and sparse snapshots omit them entirely, so "reports any window
 * position" is the practical marker.
 */
export function isFullSnapshot(closures: Closure[]): boolean {
  return closures.some(
    (closure) => /window/i.test(closure.label) && closure.state !== undefined,
  );
}

function parseTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Fold a new observation into the log. A full snapshot becomes the new base
 * (everything older is superseded); a sparse one appends. Observations that
 * are not newer than the latest entry are dropped — a refetch of the same
 * server snapshot carries no new information.
 */
export function appendObservation(
  log: ClosureLog | null,
  vin: string,
  observation: ClosureObservation,
): ClosureLog {
  if (isFullSnapshot(observation.closures)) {
    return { vin, observations: [observation] };
  }
  const current = log && log.vin === vin ? log.observations : [];
  const newest = current[current.length - 1];
  if (newest && parseTime(observation.occurredAt) <= parseTime(newest.occurredAt)) {
    return { vin, observations: current };
  }
  const observations = [...current, observation];
  // When capping, always keep the base (index 0) — it holds the window and
  // opening positions that sparse entries never carry.
  if (observations.length > MAX_OBSERVATIONS) {
    observations.splice(1, observations.length - MAX_OBSERVATIONS);
  }
  return { vin, observations };
}

/**
 * The display state: every closure ever observed (base order first), with each
 * field taken from the most recent observation that reported it. A door whose
 * lock changed after the base keeps its base position with the newer lock.
 */
export function mergeClosures(log: ClosureLog | null): Closure[] {
  if (!log) {
    return [];
  }
  const byLabel = new Map<string, Closure>();
  for (const observation of log.observations) {
    for (const closure of observation.closures) {
      const merged = byLabel.get(closure.label);
      if (!merged) {
        byLabel.set(closure.label, { ...closure });
        continue;
      }
      if (closure.state !== undefined) {
        merged.state = closure.state;
      }
      if (closure.locked !== undefined) {
        merged.locked = closure.locked;
      }
    }
  }
  return [...byLabel.values()];
}

/** Runtime shape check for a persisted log (see closure-log-store.ts). */
export function parseClosureLog(value: unknown): ClosureLog | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ClosureLog).vin === 'string' &&
    Array.isArray((value as ClosureLog).observations)
  ) {
    return value as ClosureLog;
  }
  return null;
}
