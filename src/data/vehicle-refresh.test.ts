import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLIMATE_SETTINGS_QUERY_KEY } from "@/data/climate-settings";
import type { VehicleContext } from "@/data/lexus-api";
import { VEHICLE_PROFILE_QUERY_KEY, vehicleStatusQueryKey } from "@/data/vehicle-keys";

const refetchQueries = vi.fn((_filters: { queryKey: readonly unknown[] }) => Promise.resolve());
const refreshVehicleStatus = vi.fn((_session: unknown, _context: VehicleContext) =>
  Promise.resolve(true),
);

vi.mock("@/data/query-client", () => ({
  get queryClient() {
    return { refetchQueries };
  },
}));
vi.mock("@/data/refresh-status-sender", () => ({
  refreshVehicleStatus: (session: unknown, context: VehicleContext) =>
    refreshVehicleStatus(session, context),
}));
vi.mock("expo-observe", () => ({ Observe: { logEvent: vi.fn() } }));

const { refreshVehicleData } = await import("./vehicle-refresh");

const context: VehicleContext = { vin: "VIN1", brand: "L", generation: "21MM" };
const runAuthorized = <T>(operation: (session: never) => Promise<T>) =>
  operation(undefined as never);

/** The query keys a refresh asked React Query to re-read, in no order. */
function refetched(): readonly (readonly unknown[])[] {
  return refetchQueries.mock.calls.map(([filters]) => filters.queryKey);
}

beforeEach(() => {
  refetchQueries.mockClear();
  refreshVehicleStatus.mockClear();
});

describe("refreshVehicleData", () => {
  it("re-reads the profile on a manual refresh, so a rename made in the official app lands", async () => {
    await refreshVehicleData({ context, runAuthorized, trigger: "manual" });

    expect(refetched()).toContainEqual([...VEHICLE_PROFILE_QUERY_KEY]);
  });

  it("leaves the profile alone on an automatic refresh", async () => {
    await refreshVehicleData({ context, runAuthorized, trigger: "auto" });

    expect(refetched()).not.toContainEqual([...VEHICLE_PROFILE_QUERY_KEY]);
  });

  it("always re-reads the live halves, whoever asked", async () => {
    for (const trigger of ["manual", "auto"] as const) {
      refetchQueries.mockClear();
      await refreshVehicleData({ context, runAuthorized, trigger });

      expect(refetched()).toContainEqual([...vehicleStatusQueryKey("VIN1")]);
      expect(refetched()).toContainEqual([...CLIMATE_SETTINGS_QUERY_KEY]);
    }
  });

  it("primes the car only when asked to", async () => {
    await refreshVehicleData({ context, runAuthorized, trigger: "manual" });
    expect(refreshVehicleStatus).not.toHaveBeenCalled();

    await refreshVehicleData({ context, runAuthorized, trigger: "manual", prime: true });
    expect(refreshVehicleStatus).toHaveBeenCalledOnce();
  });

  it("still refreshes when a failed prime leaves nothing to show for it", async () => {
    refreshVehicleStatus.mockRejectedValueOnce(new Error("rate limited"));

    await refreshVehicleData({ context, runAuthorized, trigger: "manual", prime: true });

    expect(refetched()).toContainEqual([...vehicleStatusQueryKey("VIN1")]);
    expect(refetched()).toContainEqual([...VEHICLE_PROFILE_QUERY_KEY]);
  });
});
