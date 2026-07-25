import { describe, expect, it } from 'vitest';

import { buildUpdateEntries, shortUpdateId } from './update-utils';

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
