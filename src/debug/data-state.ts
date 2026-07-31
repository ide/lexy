import type { UseQueryResult } from "@tanstack/react-query";

import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError, type Vehicle } from "@/data/vehicle";

/**
 * The vehicle the forced cached states show. Unlike the loading placeholder —
 * whose empty image and 0,0 location are never meant to be seen — this renders
 * unredacted, as if it were real cached data, so it carries the real IS 350
 * render from the discovery record and parks the car at Apple Park: a
 * recognizable, obviously stand-in spot instead of null island.
 */
export const MOCK_VEHICLE: Vehicle = {
  ...PLACEHOLDER_VEHICLE,
  imageUrl:
    "https://delivery.vcr.assetscs.toyota.com/adobe/assets/urn:aaid:aem:06327492-1484-4909-af33-b7c14b21edda/as/image.png?size=700,700",
  location: { latitude: 37.334606, longitude: -122.009102 },
};

/**
 * A developer-forced data state for the vehicle screens. `live` is the real
 * data (no override); the rest each pin one of the states the UI is designed to
 * handle so they can be exercised on demand from Settings > Dev Tools > Data
 * State, without having to disable Wi-Fi, sign into an empty account, or wait
 * for a failure to happen on its own.
 */
export type DataStateOverride =
  | "live"
  | "skeleton"
  | "offline-cached"
  | "offline-empty"
  | "error-cached"
  | "error-empty"
  | "no-vehicle";

type VehicleResult = UseQueryResult<Vehicle, Error>;

/**
 * Rewrite the `useVehicle` result so the real screens render `state` as if it
 * had come from the network. We keep everything else the hook returns
 * (`refetch`, etc.) and only swap the fields the screens branch on — `data`,
 * `error`, and the loading/settled flags — so each state drives the exact same
 * code path production does. `live` is returned untouched.
 */
export function overrideVehicleResult(
  query: VehicleResult,
  state: DataStateOverride,
): VehicleResult {
  if (state === "live") {
    return query;
  }
  switch (state) {
    // First-load: no data yet, still loading. The screens show the skeleton /
    // redacted layout.
    case "skeleton":
    case "offline-empty":
      return {
        ...query,
        data: undefined,
        error: null,
        // `offline-empty` is settled (nothing will load while offline);
        // `skeleton` is mid-flight. Either way there is no data — the offline
        // banner is what tells them apart, driven by the online override below.
        isLoading: state === "skeleton",
        isPending: true,
        isFetching: state === "skeleton",
        isError: false,
        isSuccess: false,
        status: "pending",
      } as VehicleResult;
    // Settled with data — paired with a forced-offline online state so the
    // screens show the cached dashboard behind the offline banner.
    case "offline-cached":
      return {
        ...query,
        data: MOCK_VEHICLE,
        error: null,
        isLoading: false,
        isPending: false,
        isFetching: false,
        isError: false,
        isSuccess: true,
        status: "success",
        dataUpdatedAt: query.dataUpdatedAt || Date.now(),
      } as VehicleResult;
    // A failed refresh that still has cached data behind it — React Query
    // keeps `data` and reports the error alongside it. The screens render the
    // cached dashboard under the "Couldn't refresh" banner.
    case "error-cached":
      return {
        ...failed(query, FORCED_ERROR),
        data: MOCK_VEHICLE,
        dataUpdatedAt: query.dataUpdatedAt || Date.now(),
      } as VehicleResult;
    // Settled failure (online) with nothing cached, so the screens show the
    // full-screen "Vehicle data unavailable" error rather than a skeleton.
    case "error-empty":
      return failed(query, FORCED_ERROR);
    // A settled NoVehicleError, which the screens render as the distinct
    // "No vehicle found" empty state.
    case "no-vehicle":
      return failed(query, new NoVehicleError());
  }
}

const FORCED_ERROR = new Error("Forced fetch error (dev override)");

function failed(query: VehicleResult, error: Error): VehicleResult {
  return {
    ...query,
    data: undefined,
    error,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: true,
    isSuccess: false,
    status: "error",
  } as VehicleResult;
}

/**
 * The online state the vehicle screens should see for `state`. The offline
 * states force `false` (that is what the override is for); the error and empty
 * states force `true` so the screens reach the error/empty branches instead of
 * the offline ones — offline outranks an error in the banner; `live` passes the
 * device's real connectivity through.
 */
export function overrideIsOnline(real: boolean, state: DataStateOverride): boolean {
  switch (state) {
    case "offline-cached":
    case "offline-empty":
      return false;
    case "skeleton":
    case "error-cached":
    case "error-empty":
    case "no-vehicle":
      return true;
    case "live":
      return real;
  }
}
