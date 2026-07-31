import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError, vehicleContext, type Vehicle } from "@/data/vehicle";
import type { VehicleQuery } from "@/hooks/use-vehicle";

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

const FORCED_ERROR = new Error("Forced fetch error (dev override)");

/**
 * Rewrite the `useVehicle` result so the real screens render `state` as if it
 * had come from the network. Only the fields the screens branch on are swapped,
 * so each state drives the same code path production does; `refetch` and the
 * rest pass through. `live` is returned untouched.
 */
export function overrideVehicleResult(query: VehicleQuery, state: DataStateOverride): VehicleQuery {
  switch (state) {
    case "live":
      return query;
    // First load: nothing to show yet. `skeleton` is mid-flight;
    // `offline-empty` is settled (nothing will load while offline). Either way
    // there is no data — the offline banner is what tells them apart, driven by
    // the online override below.
    case "skeleton":
    case "offline-empty":
      return {
        ...query,
        vehicle: undefined,
        error: null,
        isLoading: state === "skeleton",
        isFetching: state === "skeleton",
      };
    // Settled with data — paired with a forced-offline online state so the
    // screens show the cached dashboard behind the offline banner.
    case "offline-cached":
      return { ...query, ...cached(query), error: null };
    // A failed refresh that still has cached data behind it: React Query keeps
    // `data` and reports the error alongside it, and the screens render the
    // cached dashboard under the "Couldn't refresh" banner.
    case "error-cached":
      return { ...query, ...cached(query), error: FORCED_ERROR };
    // Settled failures with nothing cached: the screens show the full-screen
    // error, or — for NoVehicleError — the distinct "No vehicle found" state.
    case "error-empty":
      return failed(query, FORCED_ERROR);
    case "no-vehicle":
      return failed(query, new NoVehicleError());
  }
}

// The mock car, settled, with a plausible freshness stamp. A context to match,
// so anything the screens address at the shown vehicle addresses the same one.
function cached(query: VehicleQuery) {
  return {
    vehicle: MOCK_VEHICLE,
    context: vehicleContext(MOCK_VEHICLE),
    dataUpdatedAt: query.dataUpdatedAt || Date.now(),
    isLoading: false,
    isFetching: false,
  };
}

function failed(query: VehicleQuery, error: Error): VehicleQuery {
  return {
    ...query,
    vehicle: undefined,
    context: undefined,
    error,
    isLoading: false,
    isFetching: false,
  };
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
