// bun exact/lexy/data-flow.check.ts
// Only validated replies may replace the saved vehicle and status snapshot
import { strict as assert } from 'node:assert';
import { lexusRealm, memoryStorage, memoryStore, signIn } from './check-support';

let body: unknown;
let statusCode = 200;
const realm = lexusRealm(async (): Promise<Response> => new Response(JSON.stringify(body), { status: statusCode }));
globalThis.fetch = realm.fetch as typeof fetch;
const { answer } = await import('./app');
const store = memoryStore();
const { storage, database } = memoryStorage();
const at = 1_790_900_000_000;
await signIn(answer, store, storage);

body = { payload: [{ vin: 'VIN1', nickName: 'My Car', image: 'https://example.com/car.png' }] };
const garage = await answer('garage', [true, 0, at], store, storage, null);
assert.equal(garage.ok, true);
for (const malformed of [{ message: 'Temporarily unavailable' }, { payload: {} }, { payload: [{}] }]) {
  body = malformed;
  const failed = await answer('garage', [true, 1, at], store, storage, null);
  assert.equal(failed.ok, false);
  assert.equal(failed.car.vin, garage.car.vin);
  assert.equal(failed.car.image, garage.car.image);
}

const car = garage.car;
const telemetry = { fugage: { value: 62 }, rage: { value: 214 }, odo: { value: 12482 } };
body = { payload: { status: {
  occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [], latitude: 37, longitude: -122, telemetry,
} } };
const status = await answer('status', [car.vin, car, 0, at], store, storage, null);
assert.equal(status.ok, true);
for (const malformed of [{ payload: {} }, { payload: { status: {} } }, {
  payload: { status: { occurrenceDate: '2026-10-01T11:00:00Z', vehicleStatus: [], telemetry: { fugage: { value: null } } } },
}]) {
  body = malformed;
  const failed = await answer('status', [car.vin, car, 1, at + 1], store, storage, null);
  assert.equal(failed.ok, true);
  assert.notEqual(failed.error, '');
  assert.equal(failed.fuel, 62);
  assert.equal(failed.latitude, 37);
  assert.equal(failed.longitude, -122);
}

statusCode = 503;
body = { message: 'Temporarily unavailable' };
const missing = await answer('status', ['VIN2', { ...car, vin: 'VIN2' }, 2, at], store, storage, null);
assert.equal(missing.ok, false);
assert.equal(missing.status, 503);

statusCode = 200;
body = { payload: [] };
const empty = await answer('garage', [true, 2, at], store, storage, null);
assert.equal(empty.ok, true);
assert.equal(empty.car.vin, '');
assert.equal(empty.carCount, 0);
database.close();
console.log('PASS: malformed replies preserve saved vehicle and telemetry; first failure and valid emptiness remain distinct');
