import { describe, expect, it } from 'vitest';

import {
  appendObservation,
  isFullSnapshot,
  mergeClosures,
  type ClosureLog,
} from './closure-log';
import type { Closure } from './vehicle';

const VIN = 'JTHGZ1B20M5000000';

// Shapes captured live 2026-07-29: a parked car reports everything with
// positions; after driving the same endpoint reports lock-only doors and no
// window/opening sections at all.
const fullClosures: Closure[] = [
  { label: 'Driver Door', state: 'Closed', locked: true },
  { label: 'Driver Window', state: 'Closed' },
  { label: 'Passenger Door', state: 'Closed', locked: true },
  { label: 'Passenger Window', state: 'Closed' },
  { label: 'Trunk', state: 'Closed' },
];

const sparseClosures: Closure[] = [
  { label: 'Driver Door', state: 'Closed', locked: true },
  { label: 'Passenger Door', locked: false },
];

const full = { occurredAt: '2026-07-29T16:41:00Z', closures: fullClosures };
const sparse = { occurredAt: '2026-07-29T20:08:00Z', closures: sparseClosures };

describe('isFullSnapshot', () => {
  it('keys off windows, which sparse snapshots never report', () => {
    expect(isFullSnapshot(fullClosures)).toBe(true);
    expect(isFullSnapshot(sparseClosures)).toBe(false);
  });
});

describe('appendObservation', () => {
  it('makes a full snapshot the new base, superseding the record', () => {
    let log = appendObservation(null, VIN, full);
    log = appendObservation(log, VIN, sparse);
    const fresh = { occurredAt: '2026-07-30T08:00:00Z', closures: fullClosures };
    log = appendObservation(log, VIN, fresh);
    expect(log.observations).toEqual([fresh]);
  });

  it('appends sparse observations and drops stale or duplicate ones', () => {
    let log = appendObservation(null, VIN, full);
    log = appendObservation(log, VIN, sparse);
    expect(log.observations).toHaveLength(2);
    // Same occurrenceDate again — a refetch of the same server snapshot.
    log = appendObservation(log, VIN, sparse);
    expect(log.observations).toHaveLength(2);
    // Older than the newest entry.
    log = appendObservation(log, VIN, {
      occurredAt: '2026-07-29T18:00:00Z',
      closures: sparseClosures,
    });
    expect(log.observations).toHaveLength(2);
  });

  it('starts fresh for a different VIN', () => {
    const log = appendObservation(appendObservation(null, VIN, full), 'OTHERVIN', sparse);
    expect(log.vin).toBe('OTHERVIN');
    expect(log.observations).toEqual([sparse]);
  });

  it('caps the record but always keeps the base', () => {
    let log = appendObservation(null, VIN, full);
    for (let i = 0; i < 60; i++) {
      log = appendObservation(log, VIN, {
        occurredAt: `2026-07-30T00:${String(i).padStart(2, '0')}:00Z`,
        closures: sparseClosures,
      });
    }
    expect(log.observations.length).toBeLessThanOrEqual(50);
    expect(log.observations[0]).toEqual(full);
  });
});

describe('mergeClosures', () => {
  it('overlays newer fields on the base without losing window positions', () => {
    let log: ClosureLog | null = appendObservation(null, VIN, full);
    log = appendObservation(log, VIN, sparse);
    const merged = mergeClosures(log);
    // The passenger door's lock came from the sparse observation; its position
    // and every window/opening survive from the base.
    expect(merged).toEqual([
      { label: 'Driver Door', state: 'Closed', locked: true },
      { label: 'Driver Window', state: 'Closed' },
      { label: 'Passenger Door', state: 'Closed', locked: false },
      { label: 'Passenger Window', state: 'Closed' },
      { label: 'Trunk', state: 'Closed' },
    ]);
  });

  it('is a pure function of the stored record (re-merge yields the same result)', () => {
    let log: ClosureLog | null = appendObservation(null, VIN, full);
    log = appendObservation(log, VIN, sparse);
    const roundTripped = JSON.parse(JSON.stringify(log)) as ClosureLog;
    expect(mergeClosures(roundTripped)).toEqual(mergeClosures(log));
  });

  it('includes closures first seen in sparse observations', () => {
    const log = appendObservation(null, VIN, sparse);
    expect(mergeClosures(log)).toEqual(sparseClosures);
  });
});
