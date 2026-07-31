// Query keys for the two halves of the vehicle data (see vehicle.ts for why it
// is two halves). Kept in their own dependency-free module so anything — pure
// data code, the persister, hooks, dev tools — can name a vehicle query without
// importing the query wiring around it.
//
// Every key starts with VEHICLE_QUERY_PREFIX, so React Query's prefix matching
// covers "all vehicle data" in one call, and the recognizers below are the only
// place that knows how a key is shaped.

const VEHICLE = "vehicle";
const PROFILE = "profile";
const STATUS = "status";

/**
 * Matches *every* vehicle query, for operations that mean all of it: the dev
 * skeleton toggle's reset, a sign-out wipe.
 */
export const VEHICLE_QUERY_PREFIX = [VEHICLE] as const;

/** Identity, spec sheet, and subscriptions — changes on the scale of days. */
export const VEHICLE_PROFILE_QUERY_KEY = [VEHICLE, PROFILE] as const;

/**
 * The live status snapshot, keyed by the car it describes. VIN-scoped so a
 * snapshot can never be read back against the wrong car, and so a future
 * vehicle switcher gets per-car caching for free.
 */
export function vehicleStatusQueryKey(vin: string) {
  return [VEHICLE, STATUS, vin] as const;
}

export function isVehicleProfileKey(key: readonly unknown[]): boolean {
  return key[0] === VEHICLE && key[1] === PROFILE;
}

export function isVehicleStatusKey(key: readonly unknown[]): boolean {
  return key[0] === VEHICLE && key[1] === STATUS;
}
