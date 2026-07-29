import { hashKey } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { describe, expect, it, vi } from 'vitest';

import { PLACEHOLDER_VEHICLE } from '@/data/placeholder-vehicle';
import { createValidatingPersister } from '@/data/persisted-cache';

function query(queryKey: unknown[], data: unknown) {
  return {
    queryKey,
    queryHash: hashKey(queryKey),
    state: { data },
  };
}

function client(queries: ReturnType<typeof query>[]): PersistedClient {
  return {
    timestamp: 0,
    buster: 'test',
    clientState: { mutations: [], queries: queries as never },
  };
}

function stubPersister(restored: PersistedClient | undefined): Persister {
  return {
    persistClient: vi.fn(),
    removeClient: vi.fn(),
    restoreClient: vi.fn(async () => restored),
  };
}

describe('createValidatingPersister', () => {
  it('keeps a persisted vehicle whose data still parses', async () => {
    const base = stubPersister(client([query(['vehicle'], PLACEHOLDER_VEHICLE)]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(1);
  });

  it('drops a persisted vehicle whose data no longer matches the shape', async () => {
    const stale = { ...PLACEHOLDER_VEHICLE, location: null };
    const base = stubPersister(client([query(['vehicle'], stale)]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  it('keeps valid queries and drops only the invalid ones', async () => {
    const base = stubPersister(
      client([
        query(['vehicle'], { not: 'a vehicle' }),
        query(['other'], { anything: true }),
      ]),
    );
    const restored = await createValidatingPersister(base).restoreClient();
    // The unknown key has no validator and survives; the bad vehicle is gone.
    expect(restored?.clientState.queries.map((q) => q.queryKey)).toEqual([['other']]);
  });

  it('passes through unknown query keys untouched', async () => {
    const base = stubPersister(client([query(['other'], { anything: true })]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(1);
  });

  it('returns undefined when there is nothing persisted', async () => {
    const restored = await createValidatingPersister(stubPersister(undefined)).restoreClient();
    expect(restored).toBeUndefined();
  });

  it('forwards persistClient and removeClient to the wrapped persister', async () => {
    const base = stubPersister(undefined);
    const wrapped = createValidatingPersister(base);
    await wrapped.removeClient();
    await wrapped.persistClient(client([]));
    expect(base.removeClient).toHaveBeenCalledOnce();
    expect(base.persistClient).toHaveBeenCalledOnce();
  });
});
