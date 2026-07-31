import { describe, expect, it, vi } from "vitest";

import { MOCK_VEHICLE, overrideIsOnline, overrideVehicleResult } from "@/debug/data-state";
import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError, vehicleContext } from "@/data/vehicle";
import type { VehicleQuery } from "@/hooks/use-vehicle";

// A stand-in for a live, successful result.
const refetch = vi.fn();
const live: VehicleQuery = {
  vehicle: PLACEHOLDER_VEHICLE,
  context: vehicleContext(PLACEHOLDER_VEHICLE),
  dataUpdatedAt: 123,
  error: null,
  isLoading: false,
  isFetching: false,
  refetch,
};

describe("overrideVehicleResult", () => {
  it("returns the query untouched for live", () => {
    expect(overrideVehicleResult(live, "live")).toBe(live);
  });

  it("preserves refetch across every override", () => {
    for (const state of [
      "skeleton",
      "offline-cached",
      "offline-empty",
      "error-cached",
      "error-empty",
      "no-vehicle",
    ] as const) {
      expect(overrideVehicleResult(live, state).refetch).toBe(refetch);
    }
  });

  it("skeleton clears the vehicle and reports loading", () => {
    const result = overrideVehicleResult(live, "skeleton");
    expect(result.vehicle).toBeUndefined();
    expect(result.error).toBeNull();
    expect(result.isLoading).toBe(true);
  });

  it("offline-empty clears the vehicle but is settled (not loading)", () => {
    const result = overrideVehicleResult(live, "offline-empty");
    expect(result.vehicle).toBeUndefined();
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
  });

  it("offline-cached surfaces the mock vehicle, settled and error-free", () => {
    const result = overrideVehicleResult({ ...live, vehicle: undefined }, "offline-cached");
    expect(result.vehicle).toBe(MOCK_VEHICLE);
    expect(result.isLoading).toBe(false);
    expect(result.isFetching).toBe(false);
    expect(result.error).toBeNull();
  });

  // Anything the screens address at the shown car has to address that same car:
  // a cached state whose context still pointed elsewhere would send commands and
  // primes to a vehicle the user isn't looking at.
  it("cached states carry a context matching the vehicle they show", () => {
    for (const state of ["offline-cached", "error-cached"] as const) {
      expect(overrideVehicleResult(live, state).context).toEqual(vehicleContext(MOCK_VEHICLE));
    }
  });

  // Nothing to address when there is no car to show.
  it("empty states clear the context", () => {
    for (const state of ["error-empty", "no-vehicle"] as const) {
      expect(overrideVehicleResult(live, state).context).toBeUndefined();
    }
  });

  // The mock vehicle renders unredacted, so unlike the loading placeholder it
  // carries a real render URL and a real (stand-in) parking spot — Apple Park —
  // while the placeholder keeps values that are never meant to be seen.
  it("the mock vehicle differs from the loading placeholder only where it shows", () => {
    expect(MOCK_VEHICLE.imageUrl).toMatch(/^https:/);
    expect(MOCK_VEHICLE.location).not.toEqual({ latitude: 0, longitude: 0 });
    expect(PLACEHOLDER_VEHICLE.imageUrl).toBe("");
    expect(PLACEHOLDER_VEHICLE.location).toEqual({ latitude: 0, longitude: 0 });
    expect({ ...MOCK_VEHICLE, imageUrl: "", location: { latitude: 0, longitude: 0 } }).toEqual(
      PLACEHOLDER_VEHICLE,
    );
  });

  it("error-empty surfaces a generic error, not a NoVehicleError", () => {
    const result = overrideVehicleResult(live, "error-empty");
    expect(result.vehicle).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(NoVehicleError);
    expect(result.isLoading).toBe(false);
  });

  // The banner-over-cached-data case: a failed refresh keeps the last good data
  // on screen, so the override has to report both at once.
  it("error-cached keeps the vehicle alongside the error", () => {
    const result = overrideVehicleResult({ ...live, vehicle: undefined }, "error-cached");
    expect(result.vehicle).toBe(MOCK_VEHICLE);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(NoVehicleError);
    expect(result.isLoading).toBe(false);
  });

  it("no-vehicle surfaces a NoVehicleError so the empty state shows", () => {
    const result = overrideVehicleResult(live, "no-vehicle");
    expect(result.error).toBeInstanceOf(NoVehicleError);
    expect(result.vehicle).toBeUndefined();
  });
});

describe("overrideIsOnline", () => {
  it("passes the real connectivity through for live", () => {
    expect(overrideIsOnline(true, "live")).toBe(true);
    expect(overrideIsOnline(false, "live")).toBe(false);
  });

  it("forces offline for the offline states regardless of the real value", () => {
    expect(overrideIsOnline(true, "offline-cached")).toBe(false);
    expect(overrideIsOnline(true, "offline-empty")).toBe(false);
  });

  it("forces online for error/empty/skeleton so those branches are reached", () => {
    expect(overrideIsOnline(false, "error-cached")).toBe(true);
    expect(overrideIsOnline(false, "error-empty")).toBe(true);
    expect(overrideIsOnline(false, "no-vehicle")).toBe(true);
    expect(overrideIsOnline(false, "skeleton")).toBe(true);
  });
});
