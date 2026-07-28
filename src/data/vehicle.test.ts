import { describe, expect, it } from 'vitest';

import {
  absoluteLocalTime,
  mapVehicle,
  parseVehicle,
  parseVehicleContext,
  relativeTime,
} from './vehicle';

const vehicle = {
  nickname: 'Daily driver',
  fullName: '2025 Lexus Example',
  model: 'Example sedan',
  color: 'Silver',
  vin: 'TESTVIN1234567890',
  modelCode: '0000',
  region: 'US',
  generation: '21MM',
  fuelType: 'Gasoline',
  transmission: 'Automatic',
  drivetrain: 'RWD',
  headUnit: 'Premium',
  trim: 'Premium',
  imageUrl: 'https://example.com/vehicle.png',
  inServiceDate: '2025-01-02',
  manufacturedDate: '2024-12-01',
  updatedAt: '2026-07-24T17:03:10Z',
  fuelPercent: 75,
  rangeMiles: 250,
  odometerMiles: 12_345,
  cautionCount: 0,
  tripAMiles: 10.2,
  tripBMiles: 20.4,
  location: { latitude: 37.5, longitude: -122.2 },
  climate: { temperatureF: 72, minF: 65, maxF: 85 },
  closures: [{ label: 'Driver Door', state: 'Closed', locked: true }],
  capabilities: [{ label: 'Lock & Unlock', symbol: 'lock.fill' }],
  subscriptions: [{ name: 'Remote Connect', status: 'Active', expires: 'Jan 2, 2028' }],
};

describe('parseVehicle', () => {
  it('accepts a normalized vehicle API response', () => {
    expect(parseVehicle(vehicle)).toEqual(vehicle);
  });

  it('rejects malformed responses instead of caching them', () => {
    expect(() => parseVehicle({ ...vehicle, location: null })).toThrow('Invalid vehicle response');
  });
});

describe('parseVehicleContext', () => {
  it('pulls VIN, brand, and generation from the single discovery entry', () => {
    const body = { payload: [{ vin: 'TESTVIN1234567890', brand: 'L', generation: '21MM' }] };
    expect(parseVehicleContext(body)).toEqual({
      vin: 'TESTVIN1234567890',
      brand: 'L',
      generation: '21MM',
    });
  });

  it('throws when discovery does not resolve to exactly one vehicle', () => {
    expect(() => parseVehicleContext({ payload: [] })).toThrow('returned 0 vehicles');
  });

  it('throws when the discovery entry is missing required fields', () => {
    expect(() => parseVehicleContext({ payload: [{ vin: 'V1' }] })).toThrow(
      'missing VIN, brand, or generation',
    );
  });
});

describe('mapVehicle', () => {
  // Fixtures captured from live production responses for the account's IS 350.
  const discovery = {
    payload: [
      {
        vin: 'JTHGZ1B25T5100335',
        nickName: '2026 IS 350',
        displayModelDescription: '2026 Lexus IS 350 4-DOOR SEDAN',
        modelName: 'IS 350 4-DOOR SEDAN',
        modelYear: '2026',
        modelCode: '9510',
        color: 'Cloudburst Grey',
        region: 'US',
        generation: '21MM',
        brand: 'L',
        fuelType: 'G',
        image: 'https://img.example/is350.png',
      },
    ],
  };
  const status = {
    payload: {
      status: {
        driverPosition: 'LEFT',
        vehicleStatus: [
          {
            category: 'Driver Side',
            sections: [
              { section: 'Door', values: [{ value: 'Closed', status: 0 }, { value: 'Locked', status: 0 }] },
              { section: 'Window', values: [{ value: 'Closed', status: 0 }] },
            ],
          },
          { category: 'Other', sections: [{ section: 'Trunk', values: [{ value: 'Open', status: 1 }] }] },
          {
            category: 'Trip Details',
            sections: [
              { section: 'Trip A', values: [{ value: '272.1 miles', status: 0 }] },
              { section: 'Trip B', values: [{ value: '735.1 miles', status: 0 }] },
            ],
          },
        ],
        telemetry: {
          fugage: { value: 100, unit: '%' },
          rage: { value: 281, unit: 'Mile' },
          odo: { value: 735, unit: 'Mile' },
        },
        occurrenceDate: '2026-07-28T01:23:50Z',
        cautionOverallCount: 0,
        latitude: 37.41144,
        longitude: -122.12686,
      },
    },
  };
  const climate = { payload: { temperature: 71, temperatureUnit: 'F', minTemp: 65, maxTemp: 85 } };
  const spec = {
    payload: {
      vehicleSpecifications: {
        dataItems: [
          { dataName: 'Drive Type', dataValue: '2WD' },
          { dataName: 'Grade', dataValue: 'F SPORT' },
          { dataName: 'Transmission', dataValue: '8AT-F' },
          { dataName: 'Date of First Use', dataValue: 'April 23, 2026' },
        ],
      },
      additionalDetails: { dataItems: [{ dataName: 'Order Date', dataValue: '03/2026' }] },
    },
  };

  const tires = {
    payload: {
      vin: 'JTHGZ1B25T5100335',
      tirePressureStatus: 'Good',
      flTirePressure: { value: 39, unit: 'psi', displayLowTirePressureWarning: false },
      frTirePressure: { value: 39, unit: 'psi', displayLowTirePressureWarning: false },
      rlTirePressure: { value: 40, unit: 'psi', displayLowTirePressureWarning: false },
      rrTirePressure: { value: 33, unit: 'psi', displayLowTirePressureWarning: true },
    },
  };

  it('composes the live responses into the UI vehicle shape', () => {
    const mapped = mapVehicle(discovery, status, climate, spec, tires);
    expect(mapped.tires).toEqual({
      status: 'Good',
      unit: 'psi',
      positions: [
        { label: 'Front Left', value: 39, low: false },
        { label: 'Front Right', value: 39, low: false },
        { label: 'Rear Left', value: 40, low: false },
        { label: 'Rear Right', value: 33, low: true },
      ],
    });
    expect(mapped).toMatchObject({
      nickname: '2026 IS 350',
      fullName: '2026 Lexus IS 350 4-DOOR SEDAN',
      model: 'IS 350 4-DOOR SEDAN',
      color: 'Cloudburst Grey',
      vin: 'JTHGZ1B25T5100335',
      modelCode: '9510',
      generation: '21MM',
      fuelType: 'Gasoline',
      transmission: '8AT-F',
      drivetrain: '2WD',
      trim: 'F SPORT',
      headUnit: 'Lexus Multimedia (21MM)',
      inServiceDate: 'April 23, 2026',
      fuelPercent: 100,
      rangeMiles: 281,
      odometerMiles: 735,
      tripAMiles: 272.1,
      tripBMiles: 735.1,
      location: { latitude: 37.41144, longitude: -122.12686 },
      climate: { temperatureF: 71, minF: 65, maxF: 85 },
    });
    expect(mapped.closures).toEqual([
      { label: 'Driver Door', state: 'Closed', locked: true },
      { label: 'Driver Window', state: 'Closed' },
      { label: 'Trunk', state: 'Open' },
    ]);
  });

  it('produces a value that passes parseVehicle validation', () => {
    expect(() => parseVehicle(mapVehicle(discovery, status, climate, spec))).not.toThrow();
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-07-28T12:00:00Z');
  const ago = (ms: number) => relativeTime(now - ms, now);
  const sec = 1000;
  const min = 60 * sec;
  const hour = 60 * min;
  const day = 24 * hour;

  it('says "just now" for the last few seconds', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(4 * sec)).toBe('just now');
  });

  it('counts seconds', () => {
    expect(ago(5 * sec)).toBe('5 seconds ago');
    expect(ago(59 * sec)).toBe('59 seconds ago');
  });

  it('counts minutes', () => {
    expect(ago(1 * min)).toBe('1 minute ago');
    expect(ago(59 * min + 59 * sec)).toBe('59 minutes ago');
  });

  it('pairs hours with leftover minutes', () => {
    expect(ago(2 * hour)).toBe('2 hours ago');
    expect(ago(1 * hour)).toBe('1 hour ago');
    expect(ago(2 * hour + 5 * min)).toBe('2 hours 5 minutes ago');
    expect(ago(1 * hour + 1 * min)).toBe('1 hour 1 minute ago');
  });

  it('pairs days with leftover hours', () => {
    expect(ago(1 * day)).toBe('1 day ago');
    expect(ago(3 * day + 2 * hour)).toBe('3 days 2 hours ago');
  });

  it('returns "unknown" for unparseable input', () => {
    expect(relativeTime('not a date', now)).toBe('unknown');
  });
});

describe('absoluteLocalTime', () => {
  it('formats a timestamp and rejects garbage', () => {
    expect(absoluteLocalTime(Date.parse('2026-07-28T12:00:00Z'))).toMatch(/2026/);
    expect(absoluteLocalTime('not a date')).toBe('Unknown time');
  });
});
