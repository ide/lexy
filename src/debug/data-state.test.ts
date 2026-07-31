import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { overrideIsOnline, overrideVehicleResult } from "@/debug/data-state";
import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError, type Vehicle } from "@/data/vehicle";

// A stand-in for a live, successful query result. Only the fields the vehicle
// screens read matter; the override rewrites the rest.
const refetch = vi.fn();
const live = {
  data: PLACEHOLDER_VEHICLE,
  error: null,
  isLoading: false,
  isPending: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  status: "success",
  dataUpdatedAt: 123,
  refetch,
} as unknown as UseQueryResult<Vehicle, Error>;

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

  it("skeleton clears data and reports loading", () => {
    const result = overrideVehicleResult(live, "skeleton");
    expect(result.data).toBeUndefined();
    expect(result.error).toBeNull();
    expect(result.isLoading).toBe(true);
  });

  it("offline-empty clears data but is settled (not loading)", () => {
    const result = overrideVehicleResult(live, "offline-empty");
    expect(result.data).toBeUndefined();
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
  });

  it("offline-cached surfaces placeholder data as a success", () => {
    const result = overrideVehicleResult(
      { ...live, data: undefined } as typeof live,
      "offline-cached",
    );
    expect(result.data).toBe(PLACEHOLDER_VEHICLE);
    expect(result.isSuccess).toBe(true);
    expect(result.error).toBeNull();
  });

  it("error-empty surfaces a generic error, not a NoVehicleError", () => {
    const result = overrideVehicleResult(live, "error-empty");
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(NoVehicleError);
    expect(result.isError).toBe(true);
  });

  // The banner-over-cached-data case: React Query keeps `data` when a refetch
  // fails, so the override has to report both at once.
  it("error-cached keeps data alongside the error", () => {
    const result = overrideVehicleResult(
      { ...live, data: undefined } as typeof live,
      "error-cached",
    );
    expect(result.data).toBe(PLACEHOLDER_VEHICLE);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(NoVehicleError);
    expect(result.isError).toBe(true);
    expect(result.isLoading).toBe(false);
  });

  it("no-vehicle surfaces a NoVehicleError so the empty state shows", () => {
    const result = overrideVehicleResult(live, "no-vehicle");
    expect(result.error).toBeInstanceOf(NoVehicleError);
    expect(result.data).toBeUndefined();
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
