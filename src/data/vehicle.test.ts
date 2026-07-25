import { describe, expect, it, vi } from 'vitest';

import { fetchVehicle, loadVehicle, parseVehicle } from './vehicle';

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

describe('fetchVehicle', () => {
  it('fetches the normalized vehicle from the configured backend', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(vehicle), { status: 200 }));

    await expect(fetchVehicle('https://lexy.example.test/', request)).resolves.toEqual(vehicle);
    expect(request).toHaveBeenCalledWith('https://lexy.example.test/vehicle', {
      headers: { Accept: 'application/json' },
      signal: undefined,
    });
  });

  it('surfaces backend errors', async () => {
    const request = vi.fn(async () => new Response('unavailable', { status: 503 }));

    await expect(fetchVehicle('https://lexy.example.test', request)).rejects.toThrow(
      'Vehicle API request failed (503)',
    );
  });
});

describe('loadVehicle', () => {
  it('uses bundled stub data when no backend is configured', async () => {
    const request = vi.fn();

    await expect(loadVehicle(undefined, request)).resolves.toMatchObject({
      fullName: '2026 Lexus IS 350',
      vin: 'DEMO0000000000001',
    });
    expect(request).not.toHaveBeenCalled();
  });
});
