import type { IconName } from "@/components/ui/icon-registry";
import { hasNumber, isRecord } from "@/data/json";
import type { VehicleContext } from "@/data/lexus-api";
import { iconRegistry } from "@/components/ui/icon-registry";
import type { RemoteCapability } from "@/data/remote-capabilities";

export type Closure = {
  label: string;
  /**
   * Open/closed position. The status feed sometimes reports only the lock for
   * a closure (a sparse snapshot after driving, for example), so position is
   * optional — absent means unknown, not closed.
   */
  state?: "Closed" | "Open";
  locked?: boolean;
  /**
   * When each field was last observed (server occurrenceDate). Populated by the
   * closure store (closure-state.ts) so the UI can flag a reading that the
   * latest snapshot didn't refresh. Absent on freshly-mapped closures.
   */
  stateAt?: string;
  lockedAt?: string;
  /**
   * True when `locked` is a client-side optimistic prediction from a just-issued
   * lock/unlock command, not yet confirmed by a server reading (see
   * closure-state.ts). The UI shows these as pending ("Locking…"/"Unlocking…").
   */
  lockedOptimistic?: boolean;
};

export type Capability = {
  label: string;
  symbol: IconName;
};

export type Subscription = {
  name: string;
  status: string;
  /** Drives the status color: green when active, muted otherwise. */
  active: boolean;
  /** Drives the "Trial expires …" vs "Expires …" label. */
  trial: boolean;
  /** Formatted "Month YYYY"; absent when the service has no end date. */
  expires?: string;
};

/**
 * The unit every distance field (`range`, `odometer`, `tripA`, `tripB`) is
 * expressed in. The car decides: telemetry reports each distance as
 * `{ value, unit }` already converted to the unit configured on the vehicle, so
 * the app displays what the wire says and the numbers match the in-car dashboard.
 */
export type DistanceUnit = "mi" | "km";

export type TirePressure = {
  status: string;
  unit: string;
  positions: { label: string; value: number; low: boolean }[];
};

/**
 * Who the car is: identity, spec-sheet facts, and account-level services. This
 * changes on the timescale of ownership (a renamed vehicle, a renewed
 * subscription), so it loads and refreshes separately from — and much less
 * often than — `VehicleStatus`.
 */
export type VehicleProfile = {
  nickname: string;
  fullName: string;
  model: string;
  brand: string;
  color: string;
  vin: string;
  modelCode: string;
  region: string;
  generation: string;
  fuelType: string;
  transmission: string;
  drivetrain: string;
  headUnit: string;
  trim: string;
  imageUrl: string;
  inServiceDate: string;
  manufacturedDate: string;
  capabilities: Capability[];
  /**
   * Which remote actions this car will accept, from its discovery record —
   * what the controls are gated on, so a button is never offered for something
   * the vehicle would reject (remote-capabilities.ts).
   */
  remoteCapabilities: RemoteCapability[];
  subscriptions: Subscription[];
};

/**
 * What the car reports about itself right now: the live state the dashboard
 * renders and the only part of the vehicle data that goes stale in minutes.
 * Everything a refresh, a telematics prime, or a lock-command reconciliation
 * needs to re-read lives here — and nothing else does, so those paths never drag
 * the profile's discovery/spec/subscription reads along.
 */
export type VehicleStatus = {
  /** The car this snapshot describes — a status is never joined across VINs. */
  vin: string;
  updatedAt: string;
  fuelPercent: number;
  distanceUnit: DistanceUnit;
  range: number;
  odometer: number;
  cautionCount: number;
  tripA: number;
  tripB: number;
  location: {
    latitude: number;
    longitude: number;
  };
  closures: Closure[];
  tires?: TirePressure;
};

/** The merged view the screens render — purely a join of the two halves. */
export type Vehicle = VehicleProfile & VehicleStatus;

/**
 * Join a profile with a status snapshot, or refuse when the snapshot describes
 * a different car (a stale cache entry from before an account switch, say) —
 * the caller treats null as "still loading" rather than render a chimera.
 */
export function composeVehicle(profile: VehicleProfile, status: VehicleStatus): Vehicle | null {
  return profile.vin === status.vin ? { ...profile, ...status } : null;
}

/**
 * Thrown when vehicle discovery succeeds but the account has no car enrolled.
 * The UI treats this as a distinct empty state (guide the user to add a vehicle
 * in the Lexus app) rather than a generic load error.
 */
export class NoVehicleError extends Error {
  constructor() {
    super("No vehicle is associated with this Lexus account.");
    this.name = "NoVehicleError";
  }
}

/**
 * The vehicle-scoped request headers' worth of a loaded vehicle — what every
 * command, prime, and engine read needs to address this car.
 */
export function vehicleContext(vehicle: VehicleProfile): VehicleContext {
  return { vin: vehicle.vin, brand: vehicle.brand, generation: vehicle.generation };
}

const profileStringFields = [
  "nickname",
  "fullName",
  "model",
  "brand",
  "color",
  "vin",
  "modelCode",
  "region",
  "generation",
  "fuelType",
  "transmission",
  "drivetrain",
  "headUnit",
  "trim",
  "imageUrl",
  "inServiceDate",
  "manufacturedDate",
] as const;

const statusNumberFields = [
  "fuelPercent",
  "range",
  "odometer",
  "cautionCount",
  "tripA",
  "tripB",
] as const;

export function parseVehicleProfile(value: unknown): VehicleProfile {
  if (
    !isRecord(value) ||
    !profileStringFields.every((field) => typeof value[field] === "string") ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.every(namesAKnownIcon) ||
    !Array.isArray(value.remoteCapabilities) ||
    !Array.isArray(value.subscriptions)
  ) {
    throw new Error("Invalid vehicle profile");
  }
  return value as VehicleProfile;
}

/**
 * A capability's `symbol` is an icon-registry key, and it is persisted — so a
 * build that renames or re-scopes those keys leaves the old names sitting in a
 * returning user's cache, where they still look like perfectly good strings.
 * Checking them here is what turns that into a cold load instead of an
 * undefined glyph lookup at render. See CACHE_VERSION in persisted-cache.ts,
 * whose bump is the intended lever; this is the net under it.
 */
function namesAKnownIcon(capability: unknown): boolean {
  return (
    isRecord(capability) &&
    typeof capability.symbol === "string" &&
    capability.symbol in iconRegistry
  );
}

export function parseVehicleStatus(value: unknown): VehicleStatus {
  if (
    !isRecord(value) ||
    typeof value.vin !== "string" ||
    typeof value.updatedAt !== "string" ||
    !statusNumberFields.every((field) => hasNumber(value, field)) ||
    (value.distanceUnit !== "mi" && value.distanceUnit !== "km") ||
    !isRecord(value.location) ||
    !hasNumber(value.location, "latitude") ||
    !hasNumber(value.location, "longitude") ||
    !Array.isArray(value.closures)
  ) {
    throw new Error("Invalid vehicle status");
  }
  return value as VehicleStatus;
}
