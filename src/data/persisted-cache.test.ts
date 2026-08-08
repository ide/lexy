import { hashKey } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";

import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { CACHE_VERSION, readPersistedClient } from "@/data/persisted-cache";
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

function client(
  queries: ReturnType<typeof query>[],
  buster: string = CACHE_VERSION,
): PersistedClient {
  return {
    timestamp: 0,
    buster,
    clientState: { mutations: [], queries: queries as never },
  };
}

/** What the SQLite row actually holds: the serialized client. */
function stored(value: PersistedClient): string {
  return JSON.stringify(value);
}

describe("readPersistedClient", () => {
  it("keeps persisted halves whose data still parses", () => {
    const restored = readPersistedClient(
      stored(
        client([
          query([...VEHICLE_PROFILE_QUERY_KEY], persistedProfile),
          query([...STATUS_KEY], PLACEHOLDER_VEHICLE),
        ]),
      ),
    );
    expect(restored?.clientState.queries).toHaveLength(2);
  });

  it("drops a persisted profile whose data no longer matches the shape", () => {
    const stale = { profile: { ...PLACEHOLDER_VEHICLE, subscriptions: null } };
    const restored = readPersistedClient(
      stored(client([query([...VEHICLE_PROFILE_QUERY_KEY], stale)])),
    );
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  // The regression this file exists for: a cache written before the icon
  // registry, whose capability symbols name SF Symbols ("lock.fill") rather
  // than registry keys ("lock"). The shape is still a perfectly good array of
  // {label, symbol} strings, so only the symbol check catches it — and without
  // it the names reach a registry lookup that resolves to undefined and throws
  // while rendering, which on a returning user's device is a crash at launch.
  it("drops a persisted profile whose capability symbols predate the icon registry", () => {
    const stale = {
      profile: {
        ...PLACEHOLDER_VEHICLE,
        capabilities: [{ label: "Lock & unlock", symbol: "lock.fill" }],
      },
    };
    const restored = readPersistedClient(
      stored(client([query([...VEHICLE_PROFILE_QUERY_KEY], stale)])),
    );
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  // The status key carries a VIN, so it is matched structurally rather than by
  // hash — a snapshot for any car still gets validated.
  it("drops a persisted status whose data no longer matches the shape", () => {
    const stale = { ...PLACEHOLDER_VEHICLE, location: null };
    const restored = readPersistedClient(stored(client([query([...STATUS_KEY], stale)])));
    expect(restored?.clientState.queries).toHaveLength(0);
  });

  it("keeps valid queries and drops only the invalid ones", () => {
    const restored = readPersistedClient(
      stored(
        client([
          query([...STATUS_KEY], { not: "a status" }),
          query(["other"], { anything: true }),
          query([...VEHICLE_PROFILE_QUERY_KEY], persistedProfile),
        ]),
      ),
    );
    // The unknown key has no validator and survives; the bad status is gone.
    expect(restored?.clientState.queries.map((entry) => entry.queryKey)).toEqual([
      ["other"],
      [...VEHICLE_PROFILE_QUERY_KEY],
    ]);
  });

  it("passes through unknown query keys untouched", () => {
    const restored = readPersistedClient(stored(client([query(["other"], { anything: true })])));
    expect(restored?.clientState.queries).toHaveLength(1);
  });

  it("returns null when there is nothing persisted", () => {
    expect(readPersistedClient(null)).toBeNull();
  });

  // The buster check the persist provider used to do on our behalf. Without it
  // an older build's cache would hydrate into a shape this build cannot read.
  it("rejects a cache written by a build with a different version stamp", () => {
    const value = stored(
      client([query([...VEHICLE_PROFILE_QUERY_KEY], persistedProfile)], "vehicle-v2"),
    );
    expect(readPersistedClient(value)).toBeNull();
  });

  it("reads corrupt storage as an empty cache rather than throwing", () => {
    // A truncated row costs a cold load. Throwing here would happen at module
    // scope, before the app has rendered anything at all.
    expect(readPersistedClient("{not json")).toBeNull();
    expect(readPersistedClient("null")).toBeNull();
    expect(readPersistedClient(JSON.stringify({ buster: CACHE_VERSION }))).toBeNull();
  });
});
