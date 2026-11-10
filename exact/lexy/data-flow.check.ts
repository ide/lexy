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
assert.equal(garage.askedMs, at);
for (const malformed of [{ message: 'Temporarily unavailable' }, { payload: {} }, { payload: [{}] }]) {
  body = malformed;
  const failed = await answer('garage', [true, 1, at], store, storage, null);
  assert.equal(failed.ok, false);
  assert.equal(failed.car.vin, garage.car.vin);
  assert.equal(failed.car.image, garage.car.image);
  assert.equal(failed.askedMs, at, 'a failed vehicle list read says when it was asked');
}

const car = garage.car;
const telemetry = { fugage: { value: 62 }, rage: { value: 214 }, odo: { value: 12482 } };
body = { payload: { status: {
  occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [], latitude: 37, longitude: -122, telemetry,
} } };
const status = await answer('status', [car.vin, car, 0, at], store, storage, null);
assert.equal(status.ok, true);
assert.deepEqual([status.fetchedMs, status.askedMs], [at, at]);
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
  assert.deepEqual([failed.fetchedMs, failed.askedMs], [at, at + 1], 'a failed status read keeps the reading\'s age and says when it was asked');
}

body = { payload: { settingsOn: true, temperature: 72, temperatureUnit: 'F', minTemp: 60, maxTemp: 85, tempInterval: 1, acOperations: [] } };
const climate = await answer('climate', [car.vin, car, 0, at], store, storage, null);
assert.equal(climate.ok, true);
for (const malformed of [{ message: 'Temporarily unavailable' }, { payload: {} }, { payload: { settingsOn: 'on', temperature: 60 } }]) {
  body = malformed;
  assert.deepEqual(await answer('climate', [car.vin, car, 1, at + 1], store, storage, null), climate);
}
assert.equal((await answer('climate', ['VIN2', { ...car, vin: 'VIN2' }, 0, at], store, storage, null)).ok, false);

statusCode = 503;
body = { message: 'Temporarily unavailable' };
const missing = await answer('status', ['VIN2', { ...car, vin: 'VIN2' }, 2, at], store, storage, null);
assert.equal(missing.ok, false);
assert.equal(missing.status, 503);
assert.equal(missing.askedMs, at);

statusCode = 200;
body = { payload: [] };
const empty = await answer('garage', [true, 2, at], store, storage, null);
assert.equal(empty.ok, true);
assert.equal(empty.car.vin, '');
assert.equal(empty.carCount, 0);
database.close();
console.log('PASS: malformed replies preserve saved vehicle, telemetry and climate settings; first failure and valid emptiness remain distinct; each answer says when it was asked');
