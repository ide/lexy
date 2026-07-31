import { hashKey } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { describe, expect, it, vi } from "vitest";

import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { createValidatingPersister } from "@/data/persisted-cache";
import { VEHICLE_PROFILE_QUERY_KEY, vehicleStatusQueryKey } from "@/data/vehicle-keys";

// What each half is persisted as: the profile query caches the request context
// alongside the profile, the status query caches the snapshot bare.
const persistedProfile = {
  profile: PLACEHOLDER_VEHICLE,
  context: { vin: PLACEHOLDER_VEHICLE.vin },
};
const STATUS_KEY = vehicleStatusQueryKey(PLACEHOLDER_VEHICLE.vin);

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
    buster: "test",
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

describe("createValidatingPersister", () => {
  it("keeps persisted halves whose data still parses", async () => {
    const base = stubPersister(
      client([
        query([...VEHICLE_PROFILE_QUERY_KEY], persistedProfile),
        query([...STATUS_KEY], PLACEHOLDER_VEHICLE),
      ]),
    );
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(2);
  });

  it("drops a persisted profile whose data no longer matches the shape", async () => {
    const stale = { profile: { ...PLACEHOLDER_VEHICLE, subscriptions: null } };
    const base = stubPersister(client([query([...VEHICLE_PROFILE_QUERY_KEY], stale)]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  // The status key carries a VIN, so it is matched structurally rather than by
  // hash — a snapshot for any car still gets validated.
  it("drops a persisted status whose data no longer matches the shape", async () => {
    const stale = { ...PLACEHOLDER_VEHICLE, location: null };
    const base = stubPersister(client([query([...STATUS_KEY], stale)]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  it("keeps valid queries and drops only the invalid ones", async () => {
    const base = stubPersister(
      client([
        query([...STATUS_KEY], { not: "a status" }),
        query(["other"], { anything: true }),
        query([...VEHICLE_PROFILE_QUERY_KEY], persistedProfile),
      ]),
    );
    const restored = await createValidatingPersister(base).restoreClient();
    // The unknown key has no validator and survives; the bad status is gone.
    expect(restored?.clientState.queries.map((q) => q.queryKey)).toEqual([
      ["other"],
      [...VEHICLE_PROFILE_QUERY_KEY],
    ]);
  });

  it("passes through unknown query keys untouched", async () => {
    const base = stubPersister(client([query(["other"], { anything: true })]));
    const restored = await createValidatingPersister(base).restoreClient();
    expect(restored?.clientState.queries).toHaveLength(1);
  });

  it("returns undefined when there is nothing persisted", async () => {
    const restored = await createValidatingPersister(stubPersister(undefined)).restoreClient();
    expect(restored).toBeUndefined();
  });

  it("forwards persistClient and removeClient to the wrapped persister", async () => {
    const base = stubPersister(undefined);
    const wrapped = createValidatingPersister(base);
    await wrapped.removeClient();
    await wrapped.persistClient(client([]));
    expect(base.removeClient).toHaveBeenCalledOnce();
    expect(base.persistClient).toHaveBeenCalledOnce();
  });
});
