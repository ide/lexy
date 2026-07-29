import type { Vehicle } from '@/data/vehicle';

/**
 * Stand-in vehicle rendered through the real screen components while the first
 * load is in flight (see `Redacted`). The values are never readable — redacted
 * text draws as neutral bars — but their *lengths* set the bar widths and the
 * array sizes set the row/cell counts, so keep them the shape of typical real
 * data. Everything else (fonts, paddings, line heights) comes from the real
 * components, which is the point: there is no separate skeleton layout to
 * drift.
 */
export const PLACEHOLDER_VEHICLE: Vehicle = {
  nickname: 'My Lexus',
  fullName: '2026 Lexus IS 350',
  model: 'IS 350',
  brand: 'L',
  color: 'Cloudburst Grey',
  vin: 'JTHGZ1B20M5000000',
  modelCode: '9510',
  region: 'US',
  generation: '21MM',
  fuelType: 'Gasoline',
  transmission: '8AT-F',
  drivetrain: '2WD',
  headUnit: 'Lexus Multimedia',
  trim: 'F SPORT',
  imageUrl: '',
  inServiceDate: 'April 1, 2026',
  manufacturedDate: '03/2026',
  updatedAt: '2026-01-01T00:00:00Z',
  fuelPercent: 100,
  rangeMiles: 300,
  odometerMiles: 1200,
  cautionCount: 0,
  tripAMiles: 120,
  tripBMiles: 450,
  location: { latitude: 0, longitude: 0 },
  climate: { temperatureF: 72, minF: 60, maxF: 85 },
  closures: [
    { label: 'Front driver door', state: 'Closed', locked: true },
    { label: 'Front passenger door', state: 'Closed', locked: true },
    { label: 'Rear driver door', state: 'Closed', locked: true },
    { label: 'Rear passenger door', state: 'Closed', locked: true },
    { label: 'Front driver window', state: 'Closed' },
    { label: 'Front passenger window', state: 'Closed' },
    { label: 'Rear driver window', state: 'Closed' },
    { label: 'Rear passenger window', state: 'Closed' },
  ],
  capabilities: [
    { label: 'Lock & unlock', symbol: 'lock.fill' },
    { label: 'Engine start', symbol: 'power' },
    { label: 'Climate', symbol: 'thermometer.medium' },
    { label: 'Location', symbol: 'location.fill' },
  ],
  // Empty to match production, where the vehicle mapping returns no
  // subscriptions yet — the Connected Services section is hidden for now, so
  // the loading skeleton must not reserve space for it either. Restore
  // representative rows here once vehicle-subscriptions is wired up.
  subscriptions: [],
  tires: {
    status: 'Normal',
    unit: 'psi',
    positions: [
      { label: 'Front left', value: 36, low: false },
      { label: 'Front right', value: 36, low: false },
      { label: 'Rear left', value: 35, low: false },
      { label: 'Rear right', value: 35, low: false },
    ],
  },
};
