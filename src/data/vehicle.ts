import type { SFSymbol } from 'sf-symbols-typescript';

import type { VehicleContext } from '@/data/lexus-api';

export type Closure = {
  label: string;
  state: 'Closed' | 'Open';
  locked?: boolean;
};

export type Capability = {
  label: string;
  symbol: SFSymbol;
};

export type Subscription = {
  name: string;
  status: string;
  expires: string;
};

export type Vehicle = {
  nickname: string;
  fullName: string;
  model: string;
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
  updatedAt: string;
  fuelPercent: number;
  rangeMiles: number;
  odometerMiles: number;
  cautionCount: number;
  tripAMiles: number;
  tripBMiles: number;
  location: {
    latitude: number;
    longitude: number;
  };
  climate: {
    temperatureF: number;
    minF: number;
    maxF: number;
  };
  closures: Closure[];
  capabilities: Capability[];
  subscriptions: Subscription[];
  tires?: TirePressure;
};

export type TirePressure = {
  status: string;
  unit: string;
  positions: { label: string; value: number; low: boolean }[];
};

const stringFields = [
  'nickname',
  'fullName',
  'model',
  'color',
  'vin',
  'modelCode',
  'region',
  'generation',
  'fuelType',
  'transmission',
  'drivetrain',
  'headUnit',
  'trim',
  'imageUrl',
  'inServiceDate',
  'manufacturedDate',
  'updatedAt',
] as const;

const numberFields = [
  'fuelPercent',
  'rangeMiles',
  'odometerMiles',
  'cautionCount',
  'tripAMiles',
  'tripBMiles',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNumber(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === 'number' && Number.isFinite(record[field]);
}

export function parseVehicle(value: unknown): Vehicle {
  if (
    !isRecord(value) ||
    !stringFields.every((field) => typeof value[field] === 'string') ||
    !numberFields.every((field) => hasNumber(value, field)) ||
    !isRecord(value.location) ||
    !hasNumber(value.location, 'latitude') ||
    !hasNumber(value.location, 'longitude') ||
    !isRecord(value.climate) ||
    !hasNumber(value.climate, 'temperatureF') ||
    !hasNumber(value.climate, 'minF') ||
    !hasNumber(value.climate, 'maxF') ||
    !Array.isArray(value.closures) ||
    !Array.isArray(value.capabilities) ||
    !Array.isArray(value.subscriptions)
  ) {
    throw new Error('Invalid vehicle response');
  }

  return value as Vehicle;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key]) {
      return record[key] as string;
    }
  }
  return undefined;
}

// Discovery (`/oneapi/v2/vehicle/guid`) returns the customer's vehicles as an
// array under `payload`; a single-vehicle account resolves to one entry.
export function parseVehicleContext(value: unknown): VehicleContext {
  const payload = isRecord(value) ? value.payload : value;
  const vehicles = Array.isArray(payload) ? payload.filter(isRecord) : [];
  if (vehicles.length !== 1) {
    throw new Error(`Vehicle discovery returned ${vehicles.length} vehicles`);
  }
  const record = vehicles[0];
  const vin = firstString(record, ['vin']);
  const brand = firstString(record, ['brand']);
  const generation = firstString(record, ['generation']);
  if (!vin || !brand || !generation) {
    throw new Error('Vehicle discovery response missing VIN, brand, or generation');
  }
  return { vin, brand, generation };
}

// ---- Production response mapping --------------------------------------------
// Composes the live Lexus responses (discovery + status + climate + spec) into
// the normalized Vehicle the UI renders. Field sources are noted inline; a few
// UI labels (headUnit) are derived from the telematics generation because the
// API does not expose them directly.

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}

const FUEL_TYPES: Record<string, string> = {
  G: 'Gasoline',
  H: 'Hybrid',
  E: 'Electric',
  P: 'Plug-in Hybrid',
  L: 'Plug-in Hybrid',
  F: 'Fuel Cell',
};

const HEAD_UNITS: Record<string, string> = {
  '21MM': 'Lexus Multimedia (21MM)',
  '24MM': 'Lexus Interface (24MM)',
};

function specValue(spec: unknown, dataName: string): string {
  const sections = ['vehicleSpecifications', 'additionalDetails'];
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
  return '';
}

function mapClosures(vehicleStatus: unknown[]): Closure[] {
  const closures: Closure[] = [];
  for (const category of vehicleStatus) {
    const cat = asRecord(category);
    const name = str(cat.category);
    if (name === 'Trip Details') {
      continue;
    }
    const prefix = name === 'Other' ? '' : `${name.replace(' Side', '')} `;
    const sections = Array.isArray(cat.sections) ? cat.sections : [];
    for (const section of sections) {
      const sec = asRecord(section);
      const values = Array.isArray(sec.values) ? sec.values.map(asRecord) : [];
      const position = str(values[0]?.value);
      if (position !== 'Open' && position !== 'Closed') {
        continue;
      }
      const lock = values.find((v) => v.value === 'Locked' || v.value === 'Unlocked');
      const closure: Closure = { label: `${prefix}${str(sec.section)}`.trim(), state: position };
      if (lock) {
        closure.locked = lock.value === 'Locked';
      }
      closures.push(closure);
    }
  }
  return closures;
}

function tripMiles(vehicleStatus: unknown[], sectionName: string): number {
  const trips = vehicleStatus.map(asRecord).find((c) => c.category === 'Trip Details');
  const sections = Array.isArray(trips?.sections) ? trips.sections : [];
  const section = sections.map(asRecord).find((s) => s.section === sectionName);
  const value = Array.isArray(section?.values) ? asRecord(section.values[0]).value : undefined;
  return typeof value === 'string' ? num(parseFloat(value)) : 0;
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
    unit: str(asRecord(p.flTirePressure).unit, 'psi'),
    positions: [
      position('flTirePressure', 'Front Left'),
      position('frTirePressure', 'Front Right'),
      position('rlTirePressure', 'Rear Left'),
      position('rrTirePressure', 'Rear Right'),
    ],
  };
}

export function mapVehicle(
  discovery: unknown,
  status: unknown,
  climate: unknown,
  spec: unknown,
  tires?: unknown,
): Vehicle {
  const list = asRecord(discovery).payload;
  const d = asRecord(Array.isArray(list) ? list[0] : undefined);
  const s = asRecord(asRecord(status).payload).status;
  const st = asRecord(s);
  const telemetry = asRecord(st.telemetry);
  const c = asRecord(asRecord(climate).payload);
  const vehicleStatus = Array.isArray(st.vehicleStatus) ? st.vehicleStatus : [];
  const generation = str(d.generation);

  return {
    nickname: str(d.nickName, str(d.modelName, 'My Lexus')),
    fullName: str(d.displayModelDescription, `${str(d.modelYear)} ${str(d.modelName)}`.trim()),
    model: str(d.modelName),
    color: str(d.color),
    vin: str(d.vin),
    modelCode: str(d.modelCode),
    region: str(d.region),
    generation,
    fuelType: FUEL_TYPES[str(d.fuelType)] ?? str(d.fuelType, 'Gasoline'),
    transmission: specValue(spec, 'Transmission') || '—',
    drivetrain: specValue(spec, 'Drive Type') || '—',
    headUnit: HEAD_UNITS[generation] ?? generation,
    trim: specValue(spec, 'Grade') || str(d.grade, '—'),
    imageUrl: str(d.image),
    inServiceDate: specValue(spec, 'Date of First Use') || '—',
    manufacturedDate: specValue(spec, 'Order Date') || '—',
    updatedAt: str(st.occurrenceDate, new Date().toISOString()),
    fuelPercent: Math.round(num(asRecord(telemetry.fugage).value)),
    rangeMiles: Math.round(num(asRecord(telemetry.range).value)),
    odometerMiles: Math.round(num(asRecord(telemetry.odo).value)),
    cautionCount: num(st.cautionOverallCount),
    tripAMiles: tripMiles(vehicleStatus, 'Trip A'),
    tripBMiles: tripMiles(vehicleStatus, 'Trip B'),
    location: { latitude: num(st.latitude), longitude: num(st.longitude) },
    climate: {
      temperatureF: num(c.temperature),
      minF: num(c.minTemp),
      maxF: num(c.maxTemp),
    },
    closures: mapClosures(vehicleStatus),
    capabilities: [
      { label: 'Lock & unlock', symbol: 'lock.fill' },
      { label: 'Engine start', symbol: 'power' },
      { label: 'Climate', symbol: 'thermometer.medium' },
      { label: 'Location', symbol: 'location.fill' },
    ],
    subscriptions: [],
    tires: mapTires(tires),
  };
}

export function updatedLabel(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// A plain, human "how long ago" for the server-reported vs client-checked
// timestamps on the dashboard. Accepts an ISO string (server occurrenceDate) or
// an epoch-ms number (TanStack Query's dataUpdatedAt).
export function relativeTime(from: string | number, now: number = Date.now()): string {
  const then = typeof from === 'number' ? from : new Date(from).getTime();
  if (!Number.isFinite(then)) {
    return 'unknown';
  }
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) {
    return 'just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
