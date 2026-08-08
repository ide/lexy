// Composes the live Lexus responses into the two normalized halves the UI
// renders: discovery + spec + subscriptions into the profile, status + tires
// into the status snapshot. Field sources are noted inline; a few UI labels
// (headUnit) are derived from the telematics generation because the API does
// not expose them directly.

import { asRecord, firstString, isRecord, num, str } from "@/data/json";
import type { VehicleContext } from "@/data/lexus-api";
import { parseRemoteCapabilities } from "@/data/remote-capabilities";
import {
  summarizeSubscriptions,
  type SubscriptionVehicle,
  type VehicleSubscriptionsPayload,
} from "@/data/subscriptions";
import type {
  Closure,
  DistanceUnit,
  Subscription,
  TirePressure,
  VehicleProfile,
  VehicleStatus,
} from "@/data/vehicle";

/**
 * Discovery (`/oneapi/v2/vehicle/guid`) returns the customer's vehicles as an
 * array under `payload`. Most accounts have exactly one; return every entry
 * carrying the fields we need to scope vehicle calls, in Lexus's order. The
 * first is treated as the primary vehicle until a vehicle switcher lands.
 */
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

/**
 * The v3 subscriptions list needs REGION/ASI-CODE/HW-TYPE on top of the plain
 * vehicle context and 400s without them (docs/subscriptions.md); those come from
 * the same discovery record. Scoped to the primary (first) vehicle, to match the
 * context the rest of the load uses. Returns null when the record or any
 * required field is absent, so the caller can skip the optional subscriptions
 * read rather than fire a guaranteed 400.
 */
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
      { label: "Lock & unlock", symbol: "lock" },
      { label: "Engine start", symbol: "power" },
      { label: "Climate", symbol: "climate" },
      { label: "Location", symbol: "location" },
    ],
    remoteCapabilities: parseRemoteCapabilities(d),
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
