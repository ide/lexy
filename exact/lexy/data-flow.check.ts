// bun exact/lexy/data-flow.check.ts
// Only validated replies may replace cached vehicle data
import { strict as assert } from 'node:assert';
import type { Storage, Store } from './app.contract';

let body: unknown;
let statusCode = 200;
globalThis.fetch = (async (): Promise<Response> => new Response(JSON.stringify(body), { status: statusCode })) as typeof fetch;
const { answer } = await import('./app');
const memory = new Map<string, string>();
const store = {
  get: (key: string): string | null => memory.get(key) ?? null,
  set: (key: string, value: string): void => { memory.set(key, value); },
  forget: (key: string): void => { memory.delete(key); },
} as Store;
const disk = new Map<string, Uint8Array>();
const storage = { fs: {
  mkdir: async (): Promise<void> => {},
  readFile: async (path: string): Promise<ArrayBuffer> => {
    const bytes = disk.get(path);
    if (!bytes) {
      throw new Error('ENOENT');
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  },
  atomicWriteFile: async (path: string, bytes: Uint8Array): Promise<void> => { disk.set(path, new Uint8Array(bytes)); },
  rm: async (path: string): Promise<void> => { disk.delete(path); },
} } as Storage;
const at = 1_790_900_000_000;
memory.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: at + 3_600_000, tokenType: 'Bearer' }));

body = { payload: [{ vin: 'VIN1', nickName: 'My Car', image: 'https://example.com/car.png' }] };
const garage = await answer('garage', [true, at + 3_600_000, 0, at], store, storage, null);
assert.equal(garage.ok, true);
const savedGarage = disk.get('app:/data/lexy/garage.json');
for (const malformed of [{ message: 'Temporarily unavailable' }, { payload: {} }, { payload: [{}] }]) {
  body = malformed;
  const failed = await answer('garage', [true, at + 3_600_000, 1, at], store, storage, null);
  assert.equal(failed.ok, false);
  assert.equal(failed.car.vin, garage.car.vin);
  assert.equal(failed.car.image, garage.car.image);
  assert.deepEqual(disk.get('app:/data/lexy/garage.json'), savedGarage);
}

body = { payload: { status: {
  occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [], latitude: 37, longitude: -122,
  telemetry: { fugage: { value: 62 }, rage: { value: 214 }, odo: { value: 12482 } },
} } };
const status = await answer('status', [garage.car, 0, at], store, storage, null);
assert.equal(status.ok, true);
const savedStatus = disk.get('app:/data/lexy/status.json');
for (const malformed of [{ payload: {} }, { payload: { status: {} } }, {
  payload: { status: { occurrenceDate: '2026-10-01T11:00:00Z', vehicleStatus: [], telemetry: { fugage: { value: null } } } },
}]) {
  body = malformed;
  const failed = await answer('status', [garage.car, 1, at + 1], store, storage, null);
  assert.equal(failed.ok, true);
  assert.notEqual(failed.error, '');
  assert.equal(failed.fuel, 62);
  assert.equal(failed.latitude, 37);
  assert.equal(failed.longitude, -122);
  assert.deepEqual(disk.get('app:/data/lexy/status.json'), savedStatus);
}

// A first status failure is explicit, so the UI can offer retry without zeros
statusCode = 503;
body = { message: 'Temporarily unavailable' };
const missing = await answer('status', [{ ...garage.car, vin: 'VIN2' }, 2, at], store, storage, null);
assert.equal(missing.ok, false);
assert.equal(missing.status, 503);

// A valid empty vehicle list remains an authoritative empty result
statusCode = 200;
body = { payload: [] };
const empty = await answer('garage', [true, at + 3_600_000, 2, at], store, storage, null);
assert.equal(empty.ok, true);
assert.equal(empty.car.vin, '');
assert.deepEqual(empty.cars, []);
console.log('PASS: malformed replies preserve profile and telemetry; first failure and valid emptiness remain distinct');
