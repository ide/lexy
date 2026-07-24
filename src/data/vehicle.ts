import type { SFSymbol } from 'sf-symbols-typescript';

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
};

type Request = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<Response>;

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

export async function fetchVehicle(
  baseUrl: string,
  request: Request = globalThis.fetch,
  signal?: AbortSignal,
): Promise<Vehicle> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/vehicle`;
  const response = await request(endpoint, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Vehicle API request failed (${response.status})`);
  }

  return parseVehicle(await response.json());
}

export function updatedLabel(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
