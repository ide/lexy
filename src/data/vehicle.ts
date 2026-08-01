import type { SFSymbol } from "sf-symbols-typescript";

import type { VehicleContext } from "@/data/lexus-api";
import {
  summarizeSubscriptions,
  type SubscriptionVehicle,
  type VehicleSubscriptionsPayload,
} from "./subscriptions";

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
  symbol: SFSymbol;
};

export type Subscription = {
  name: string;
  status: string;
  // Drives the status color: green when active, muted otherwise.
  active: boolean;
  // Drives the "Trial expires …" vs "Expires …" label.
  trial: boolean;
  // Formatted "Month YYYY"; absent when the service has no end date.
  expires?: string;
};

/**
 * The unit every distance field (`range`, `odometer`, `tripA`, `tripB`) is
 * expressed in. The car decides: telemetry reports each distance as
 * `{ value, unit }` with values already converted to the unit configured on
 * the vehicle, so the app displays what the wire says rather than guessing
 * from the device locale — the numbers always match the in-car dashboard.
 */
export type DistanceUnit = "mi" | "km";

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
  subscriptions: Subscription[];
};

/**
 * What the car reports about itself right now: the live state the dashboard
 * renders and the only part of the vehicle data that goes stale in minutes.
 * Everything that a refresh, a telematics prime, or a lock-command
 * reconciliation needs to re-read lives here — and nothing else does, so those
 * paths never drag the profile's discovery/spec/subscription reads along.
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

/**
 * The merged view the screens render. Purely a join of the two halves —
 * see `composeVehicle`.
 */
export type Vehicle = VehicleProfile & VehicleStatus;

/**
 * Join a profile with a status snapshot, or refuse when the snapshot describes
 * a different car (a stale cache entry from before an account switch, say) —
 * the caller treats null as "still loading" rather than render a chimera.
 */
export function composeVehicle(profile: VehicleProfile, status: VehicleStatus): Vehicle | null {
  return profile.vin === status.vin ? { ...profile, ...status } : null;
}

export type TirePressure = {
  status: string;
  unit: string;
  positions: { label: string; value: number; low: boolean }[];
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNumber(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === "number" && Number.isFinite(record[field]);
}

export function parseVehicleProfile(value: unknown): VehicleProfile {
  if (
    !isRecord(value) ||
    !profileStringFields.every((field) => typeof value[field] === "string") ||
    !Array.isArray(value.capabilities) ||
    !Array.isArray(value.subscriptions)
  ) {
    throw new Error("Invalid vehicle profile");
  }
  return value as VehicleProfile;
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

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) {
      return record[key] as string;
    }
  }
  return undefined;
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

// Discovery (`/oneapi/v2/vehicle/guid`) returns the customer's vehicles as an
// array under `payload`. Most accounts have exactly one; return every entry
// that carries the fields we need to scope vehicle calls, in Lexus's order.
// The first is treated as the primary vehicle until a vehicle switcher lands.
/**
 * The vehicle-scoped request headers' worth of a loaded vehicle — what every
 * command, prime, and engine read needs to address this car.
 */
export function vehicleContext(vehicle: VehicleProfile): VehicleContext {
  return { vin: vehicle.vin, brand: vehicle.brand, generation: vehicle.generation };
}

export function parseVehicleContexts(value: unknown): VehicleContext[] {
  const payload = isRecord(value) ? value.payload : value;
  const records = Array.isArray(payload) ? payload.filter(isRecord) : [];
  const contexts: VehicleContext[] = [];
  for (const record of records) {
    const vin = firstString(record, ["vin"]);
    const brand = firstString(record, ["brand"]);
    const generation = firstString(record, ["generation"]);
    if (vin && brand && generation) {
      contexts.push({ vin, brand, generation });
    }
  }
  return contexts;
}

// The v3 subscriptions list needs REGION/ASI-CODE/HW-TYPE on top of the plain
// vehicle context, and 400s without them (docs/subscriptions.md). Those come
// from the same discovery record. Scoped to the primary (first) vehicle, to
// match the context the rest of the load uses; return null when the record or
// any required field is absent so the caller can skip the optional
// subscriptions read rather than fire a guaranteed 400.
export function parseSubscriptionVehicle(value: unknown): SubscriptionVehicle | null {
  const payload = isRecord(value) ? value.payload : value;
  const vehicles = Array.isArray(payload) ? payload.filter(isRecord) : [];
  const record = vehicles[0];
  if (!record) {
    return null;
  }
  const vin = firstString(record, ["vin"]);
  const brand = firstString(record, ["brand"]);
  const generation = firstString(record, ["generation"]);
  const region = firstString(record, ["region"]);
  const asiCode = firstString(record, ["asiCode"]);
  const hwType = firstString(record, ["hwType"]);
  if (!vin || !brand || !generation || !region || !asiCode || !hwType) {
    return null;
  }
  return { vin, brand, generation, region, asiCode, hwType };
}

// ---- Production response mapping --------------------------------------------
// Composes the live Lexus responses into the two normalized halves the UI
// renders: discovery + spec + subscriptions into the profile, status + tires
// into the status snapshot. Field sources are noted inline; a few UI labels
// (headUnit) are derived from the telematics generation because the API does
// not expose them directly.

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

const FUEL_TYPES: Record<string, string> = {
  G: "Gasoline",
  H: "Hybrid",
  E: "Electric",
  P: "Plug-in Hybrid",
  L: "Plug-in Hybrid",
  F: "Fuel Cell",
};

const HEAD_UNITS: Record<string, string> = {
  "21MM": "Lexus Multimedia (21MM)",
  "24MM": "Lexus Interface (24MM)",
};

function specValue(spec: unknown, dataName: string): string {
  const sections = ["vehicleSpecifications", "additionalDetails"];
  const payload = asRecord(asRecord(spec).payload ?? spec);
  for (const key of sections) {
    const items = asRecord(payload[key]).dataItems;
    if (Array.isArray(items)) {
      const hit = items.find((item) => asRecord(item).dataName === dataName);
      if (hit) {
        return str(asRecord(hit).dataValue);
      }
    }
  }
  return "";
}

function mapClosures(vehicleStatus: unknown[]): Closure[] {
  const closures: Closure[] = [];
  for (const category of vehicleStatus) {
    const cat = asRecord(category);
    const name = str(cat.category);
    if (name === "Trip Details") {
      continue;
    }
    const prefix = name === "Other" ? "" : `${name.replace(" Side", "")} `;
    const sections = Array.isArray(cat.sections) ? cat.sections : [];
    for (const section of sections) {
      const sec = asRecord(section);
      const values = Array.isArray(sec.values) ? sec.values.map(asRecord) : [];
      // A section can carry a position, a lock, or both — sparse snapshots
      // (e.g. right after driving) often report only "Locked" for a door.
      // Keep whatever is known; drop only sections that say nothing.
      const position = values.find((v) => v.value === "Open" || v.value === "Closed");
      const lock = values.find((v) => v.value === "Locked" || v.value === "Unlocked");
      if (!position && !lock) {
        continue;
      }
      const closure: Closure = { label: `${prefix}${str(sec.section)}`.trim() };
      if (position) {
        closure.state = position.value as "Open" | "Closed";
      }
      if (lock) {
        closure.locked = lock.value === "Locked";
      }
      closures.push(closure);
    }
  }
  return closures;
}

// The wire spells the unit out ("Mile"/"Miles" or "Kilometer"/"Km" depending on
// the vehicle's region and head-unit setting); normalize to the two-letter
// display unit and default to miles when telemetry omits it.
function mapDistanceUnit(telemetry: Record<string, unknown>): DistanceUnit {
  const unit = str(asRecord(telemetry.rage).unit, str(asRecord(telemetry.odo).unit));
  return /k/i.test(unit) ? "km" : "mi";
}

function tripDistance(vehicleStatus: unknown[], sectionName: string): number {
  const trips = vehicleStatus.map(asRecord).find((c) => c.category === "Trip Details");
  const sections = Array.isArray(trips?.sections) ? trips.sections : [];
  const section = sections.map(asRecord).find((s) => s.section === sectionName);
  const value = Array.isArray(section?.values) ? asRecord(section.values[0]).value : undefined;
  return typeof value === "string" ? num(parseFloat(value)) : 0;
}

function mapTires(tires: unknown): TirePressure | undefined {
  const p = asRecord(asRecord(tires).payload);
  if (!p.tirePressureStatus) {
    return undefined;
  }
  const position = (key: string, label: string) => {
    const tire = asRecord(p[key]);
    return { label, value: num(tire.value), low: tire.displayLowTirePressureWarning === true };
  };
  return {
    status: str(p.tirePressureStatus),
    unit: str(asRecord(p.flTirePressure).unit, "psi"),
    positions: [
      position("flTirePressure", "Front left"),
      position("frTirePressure", "Front right"),
      position("rlTirePressure", "Rear left"),
      position("rrTirePressure", "Rear right"),
    ],
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The list carries ISO `YYYY-MM-DD` end dates; the card shows "Month YYYY".
// Returns undefined when there is no parseable date, so the caller can omit the
// expiry line entirely rather than print a placeholder.
function formatExpiry(endDate: string | undefined): string | undefined {
  const match = endDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate) : null;
  if (!match) {
    return undefined;
  }
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : undefined;
}

// Server statuses are upper-case and mixed-case (ACTIVE, INACTIVE); the card
// shows a single title-cased word.
function formatStatus(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Unknown";
}

// Flatten the paid/trial/complimentary buckets of a v3 vehicle-subscriptions
// payload into the connected-services rows the Details screen renders. Accepts
// either the unwrapped payload or a `{ payload }` envelope; missing/failed data
// yields an empty list (the card simply shows nothing).
function mapSubscriptions(subscriptions: unknown): Subscription[] {
  const payload = asRecord(
    asRecord(subscriptions).payload ?? subscriptions,
  ) as VehicleSubscriptionsPayload;
  return summarizeSubscriptions(payload).map((service) => {
    const expires = formatExpiry(service.endDate);
    return {
      name: service.name,
      status: formatStatus(service.status),
      active: service.active,
      trial: service.bucket === "trial",
      ...(expires ? { expires } : {}),
    };
  });
}

export function mapVehicleProfile(
  discovery: unknown,
  spec: unknown,
  subscriptions?: unknown,
): VehicleProfile {
  const list = asRecord(discovery).payload;
  const d = asRecord(Array.isArray(list) ? list[0] : undefined);
  const generation = str(d.generation);

  return {
    nickname: str(d.nickName, str(d.modelName, "My Vehicle")),
    fullName: str(d.displayModelDescription, `${str(d.modelYear)} ${str(d.modelName)}`.trim()),
    model: str(d.modelName),
    brand: str(d.brand, "L"),
    color: str(d.color),
    vin: str(d.vin),
    modelCode: str(d.modelCode),
    region: str(d.region),
    generation,
    fuelType: FUEL_TYPES[str(d.fuelType)] ?? str(d.fuelType, "Gasoline"),
    transmission: specValue(spec, "Transmission") || "—",
    drivetrain: specValue(spec, "Drive Type") || "—",
    headUnit: HEAD_UNITS[generation] ?? generation,
    trim: specValue(spec, "Grade") || str(d.grade, "—"),
    imageUrl: str(d.image),
    inServiceDate: specValue(spec, "Date of First Use") || "—",
    manufacturedDate: specValue(spec, "Order Date") || "—",
    capabilities: [
      { label: "Lock & unlock", symbol: "lock.fill" },
      { label: "Engine start", symbol: "power" },
      { label: "Climate", symbol: "thermometer.medium" },
      { label: "Location", symbol: "location.fill" },
    ],
    subscriptions: mapSubscriptions(subscriptions),
  };
}

/**
 * `vin` comes from the request context (the car the status endpoint was asked
 * about), not from the payload — the response doesn't reliably echo it, and the
 * stamp exists to say who was *asked*.
 */
export function mapVehicleStatus(vin: string, status: unknown, tires?: unknown): VehicleStatus {
  const s = asRecord(asRecord(status).payload).status;
  const st = asRecord(s);
  const telemetry = asRecord(st.telemetry);
  const vehicleStatus = Array.isArray(st.vehicleStatus) ? st.vehicleStatus : [];

  return {
    vin,
    updatedAt: str(st.occurrenceDate, new Date().toISOString()),
    fuelPercent: Math.round(num(asRecord(telemetry.fugage).value)),
    distanceUnit: mapDistanceUnit(telemetry),
    // The live 21MM REST telemetry key is `rage` (not the `range` the docs list);
    // reading `range` returns 0 in production, so trust the wire, not the docs.
    range: Math.round(num(asRecord(telemetry.rage).value)),
    odometer: Math.round(num(asRecord(telemetry.odo).value)),
    cautionCount: num(st.cautionOverallCount),
    tripA: tripDistance(vehicleStatus, "Trip A"),
    tripB: tripDistance(vehicleStatus, "Trip B"),
    location: { latitude: num(st.latitude), longitude: num(st.longitude) },
    closures: mapClosures(vehicleStatus),
    tires: mapTires(tires),
  };
}

// The precise timestamp shown in the dashboard tooltips, formatted in the
// device's local time zone. Accepts an ISO string (server occurrenceDate) or an
// epoch-ms number (TanStack Query's dataUpdatedAt).
export function absoluteLocalTime(from: string | number): string {
  const then = typeof from === "number" ? from : new Date(from).getTime();
  if (!Number.isFinite(then)) {
    return "Unknown time";
  }
  return new Date(then).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * A vehicle-reported timestamp, placed on the device's clock, never claiming to
 * be more recent than the read that delivered it.
 *
 * The car stamps its own events (`occurrenceDate`) from its own clock; the app
 * renders "how long ago" against the phone's. Those two clocks disagree — car
 * clocks drift by minutes — and when the car's runs ahead, its snapshot reads
 * as *newer* than the fetch that carried it. On the dashboard footer that came
 * out as two adjacent lines contradicting each other: "Lexy has data from 2
 * hours 35 minutes ago", directly under "Vehicle last synced with Lexus 2 hours
 * 32 minutes ago" — the car apparently reporting after we last heard from it.
 *
 * We cannot know about a sync later than our own read, so the read is the
 * ceiling. Display-only: the stored `occurrenceDate` stays exactly as the car
 * sent it, because the closure fold orders snapshots against each other and has
 * to keep doing that in the car's own clock (see closure-state.ts).
 *
 * Returns NaN for an unparseable stamp, which `relativeTime` renders as
 * "unknown", and leaves the stamp alone when there is no read to bound it by.
 */
export function observedAt(at: string | undefined, fetchedAt: number): number {
  const time = at ? new Date(at).getTime() : NaN;
  if (!Number.isFinite(time)) {
    return NaN;
  }
  return fetchedAt > 0 ? Math.min(time, fetchedAt) : time;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

// A plain, human "how long ago" for the vehicle-sync and data-freshness
// timestamps on the dashboard. Accepts an ISO string (server occurrenceDate) or
// an epoch-ms number (TanStack Query's dataUpdatedAt). Reads down to seconds and
// pairs the two largest units (e.g. "2 hours 5 minutes ago") so recent syncs
// stay legible.
export function relativeTime(from: string | number, now: number = Date.now()): string {
  const then = typeof from === "number" ? from : new Date(from).getTime();
  if (!Number.isFinite(then)) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${plural(seconds, "second")} ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${plural(minutes, "minute")} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMinutes = minutes % 60;
    return remMinutes === 0
      ? `${plural(hours, "hour")} ago`
      : `${plural(hours, "hour")} ${plural(remMinutes, "minute")} ago`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0
    ? `${plural(days, "day")} ago`
    : `${plural(days, "day")} ${plural(remHours, "hour")} ago`;
}
