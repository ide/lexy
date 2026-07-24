/**
 * Snapshot of the owner's 2026 Lexus IS 350, read from the Lexus OneApp API
 * (read-only) on 2026-07-24. The mobile app can't reach the telematics API
 * directly — that needs the account's OAuth session — so this is the last known
 * state, surfaced the way the native Lexus app shows it.
 *
 * Sensitive account/hardware identifiers (IMEI, eUICC, GUIDs, contract id) are
 * intentionally omitted; only owner-visible vehicle fields are kept.
 */

import type { SFSymbol } from 'sf-symbols-typescript';

export type Closure = {
  label: string;
  symbol: SFSymbol;
  state: 'Closed' | 'Open';
  locked?: boolean;
};

export type Capability = { label: string; symbol: SFSymbol };

export type Subscription = {
  name: string;
  status: string;
  expires: string;
};

export const is350 = {
  // Identity
  nickname: '2026 IS 350',
  fullName: '2026 Lexus IS 350',
  model: 'IS 350 4-Door Sedan',
  color: 'Cloudburst Grey',
  vin: 'DEMO0000000000001',
  modelCode: '9510',
  region: 'US',
  generation: '21MM',
  fuelType: 'Gasoline',
  transmission: 'Automatic',
  drivetrain: 'RWD',
  carline: 'IS',
  headUnit: 'Premium (21CY)',
  trim: 'Premium for US',
  imageUrl:
    'https://delivery.vcr.assetscs.toyota.com/adobe/assets/urn:aaid:aem:06327492-1484-4909-af33-b7c14b21edda/as/image.png?size=700,700',
  inServiceDate: '2026-04-01',
  manufacturedDate: '2026-03-01',

  // Live telemetry
  updatedAt: '2026-07-24T03:03:26Z',
  fuelPercent: 100,
  rangeMiles: 293,
  odometerMiles: 721,
  cautionCount: 0,
  tripAMiles: 257.4,
  tripBMiles: 720.4,

  // Location (last known)
  location: { latitude: 37.334606, longitude: -122.009102 },

  // Climate
  climate: {
    temperatureF: 71,
    minF: 65,
    maxF: 85,
    frontDefrost: true,
    rearDefrost: true,
  },

  // Closures / lock state
  closures: [
    { label: 'Driver Door', symbol: 'car.fill', state: 'Closed', locked: true },
    { label: 'Passenger Door', symbol: 'car.fill', state: 'Closed', locked: true },
    { label: 'Rear Driver', symbol: 'car.fill', state: 'Closed', locked: true },
    { label: 'Rear Passenger', symbol: 'car.fill', state: 'Closed', locked: true },
    { label: 'Windows', symbol: 'car.fill', state: 'Closed' },
    { label: 'Moonroof', symbol: 'car.fill', state: 'Closed' },
    { label: 'Trunk', symbol: 'car.fill', state: 'Closed' },
    { label: 'Hood', symbol: 'car.fill', state: 'Closed' },
  ] as Closure[],

  // Enabled remote capabilities for this VIN
  capabilities: [
    { label: 'Lock & Unlock', symbol: 'lock.fill' },
    { label: 'Engine Start/Stop', symbol: 'power' },
    { label: 'Remote Climate', symbol: 'fan.fill' },
    { label: 'Hazard Lights', symbol: 'exclamationmark.triangle.fill' },
    { label: 'Vehicle Finder', symbol: 'location.fill' },
    { label: 'Moonroof Close', symbol: 'car.fill' },
    { label: 'Trunk Lock/Unlock', symbol: 'shippingbox.fill' },
    { label: 'Guest Driver', symbol: 'person.2.fill' },
  ] as Capability[],

  // Subscriptions
  subscriptions: [
    { name: 'Remote Connect', status: 'Active', expires: 'Apr 23, 2029' },
    { name: 'Drive Connect', status: 'Active', expires: 'Apr 23, 2029' },
    { name: 'Safety Connect', status: 'Active', expires: 'Apr 23, 2036' },
  ] as Subscription[],
} as const;

export function updatedLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
