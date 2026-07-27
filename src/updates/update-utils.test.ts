import { describe, expect, it } from 'vitest';

import {
  buildUpdateEntries,
  describeKnownUpdate,
  describeNativeLog,
  mergeUpdateActivity,
  resolveLastCheck,
  shortUpdateId,
  sortNewestFirst,
  type UpdateActivityEvent,
} from './update-utils';

describe('buildUpdateEntries', () => {
  it('shows the running update and a downloaded next-launch update without duplicating it', () => {
    const running = {
      updateId: '11111111-1111-1111-1111-111111111111',
      createdAt: new Date('2026-07-24T20:00:00Z'),
      isEmbeddedLaunch: false,
    };
    const next = {
      updateId: '22222222-2222-2222-2222-222222222222',
      createdAt: new Date('2026-07-25T06:00:00Z'),
    };

    expect(
      buildUpdateEntries({
        running,
        available: next,
        downloaded: next,
      }),
    ).toEqual([
      expect.objectContaining({ id: running.updateId, state: 'Running now' }),
      expect.objectContaining({ id: next.updateId, state: 'Downloaded · launches next' }),
    ]);
  });

  it('identifies the embedded update when no OTA update id exists', () => {
    expect(
      buildUpdateEntries({
        running: { isEmbeddedLaunch: true },
      }),
    ).toEqual([
      expect.objectContaining({
        id: 'embedded',
        state: 'Running now',
        source: 'Embedded in build',
      }),
    ]);
  });

  it('does not invent a next-launch update when nothing is downloaded', () => {
    expect(
      buildUpdateEntries({
        running: {
          updateId: '11111111-1111-1111-1111-111111111111',
          isEmbeddedLaunch: false,
        },
      }),
    ).toHaveLength(1);
  });
});

describe('shortUpdateId', () => {
  it('makes update ids scannable without losing the full selectable value elsewhere', () => {
    expect(shortUpdateId('22222222-2222-2222-2222-222222222222')).toBe('22222222');
    expect(shortUpdateId(undefined)).toBe('Embedded');
  });
});

describe('sortNewestFirst', () => {
  it('sorts without relying on Array.toSorted or mutating native log results', () => {
    const entries = [{ timestamp: 1 }, { timestamp: 3 }, { timestamp: 2 }];

    expect(sortNewestFirst(entries).map((entry) => entry.timestamp)).toEqual([3, 2, 1]);
    expect(entries.map((entry) => entry.timestamp)).toEqual([1, 3, 2]);
  });
});

describe('mergeUpdateActivity', () => {
  it('keeps one persistent event per update state and newest events first', () => {
    const older: UpdateActivityEvent = {
      id: 'running:first',
      timestamp: 1,
      title: 'Ran update',
      detail: 'First',
      updateId: 'first',
    };
    const newer: UpdateActivityEvent = {
      id: 'downloaded:second',
      timestamp: 2,
      title: 'Downloaded update',
      detail: 'Second',
      updateId: 'second',
    };

    expect(mergeUpdateActivity([older], [newer, { ...older, timestamp: 3 }])).toEqual([
      newer,
      older,
    ]);
  });
});

describe('describeNativeLog', () => {
  it('turns state-machine dumps into a readable event', () => {
    expect(
      describeNativeLog({
        code: 'None',
        level: 'info',
        message:
          'Updates state change: state = check, event = checkComplete, context = {"isChecking":false,"downloadProgress":0}',
      }),
    ).toEqual({
      title: 'Check complete',
      summary: 'Update state changed to check.',
    });
  });

  it('uses the error code as the title and keeps a concise message', () => {
    expect(
      describeNativeLog({
        code: 'UpdateServerUnreachable',
        level: 'error',
        message: 'Could not contact the update server because the request timed out.',
      }),
    ).toEqual({
      title: 'Update server unreachable',
      summary: 'Could not contact the update server because the request timed out.',
    });
  });
});

describe('resolveLastCheck', () => {
  it('uses the exact session check when expo-updates reports one', () => {
    const checkedAt = new Date('2026-07-24T22:00:00Z');
    expect(resolveLastCheck(checkedAt, 'ON_LOAD')).toEqual({ checkedAt });
  });

  it('explains automatic startup checks instead of saying unknown', () => {
    expect(resolveLastCheck(undefined, 'ON_LOAD')).toEqual({
      detail: 'At startup',
    });
    expect(resolveLastCheck(undefined, 'NEVER')).toEqual({
      detail: 'Not checked yet',
    });
  });
});

describe('describeKnownUpdate', () => {
  it('explains the device state rather than repeating implementation terms', () => {
    expect(describeKnownUpdate('Running now')).toEqual({
      badge: 'CURRENT',
      title: 'Running update',
      detail: 'This JavaScript bundle is active now.',
    });
    expect(describeKnownUpdate('Downloaded · launches next')).toEqual({
      badge: 'READY NEXT',
      title: 'Downloaded update',
      detail: 'Stored on this device. Reload to activate it.',
    });
  });
});
