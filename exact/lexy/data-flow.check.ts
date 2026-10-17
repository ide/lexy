// bun exact/lexy/data-flow.check.ts
// Only validated replies may replace the saved vehicle and status snapshot
import { strict as assert } from 'node:assert';
import { Database } from 'bun:sqlite';
import type { Storage, Store } from './app.contract.d.ts';

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
const databases = new Map<string, Database>();
const storage = {
  fs: { readdir: async (): Promise<string[]> => [], readFile: async (): Promise<never> => { throw new Error('ENOENT'); }, rm: async (): Promise<void> => {} },
  sqlite: {
    open: async (path: string) => {
      const db = databases.get(path) ?? new Database(':memory:', { safeIntegers: true });
      databases.set(path, db);
      const run = (sql: string, params: unknown[] = []) => {
        const result = db.prepare(sql).run(...(params as any[]));
        return { changes: result.changes, lastInsertRowid: BigInt(result.lastInsertRowid) };
      };
      return {
        execute: async (sql: string, params?: unknown[]) => run(sql, params),
        query: async (sql: string, params: unknown[] = []) => {
          const statement = db.prepare(sql);
          return { columns: statement.columnNames, rows: statement.values(...(params as any[])) };
        },
        transaction: async (commands: { sql: string; params?: unknown[] }[]) => db.transaction(() => commands.map(command => run(command.sql, command.params)))(),
        close: async (): Promise<void> => {},
      };
    },
  },
} as Storage;
const at = 1_790_900_000_000;
memory.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: at + 3_600_000, tokenType: 'Bearer' }));

body = { payload: [{ vin: 'VIN1', nickName: 'My Car', image: 'https://example.com/car.png' }] };
const garage = await answer('garage', [true, at + 3_600_000, 0, at], store, storage, null);
assert.equal(garage.ok, true);
for (const malformed of [{ message: 'Temporarily unavailable' }, { payload: {} }, { payload: [{}] }]) {
  body = malformed;
  const failed = await answer('garage', [true, at + 3_600_000, 1, at], store, storage, null);
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
const empty = await answer('garage', [true, at + 3_600_000, 2, at], store, storage, null);
assert.equal(empty.ok, true);
assert.equal(empty.car.vin, '');
assert.equal(empty.carCount, 0);
console.log('PASS: malformed replies preserve saved vehicle and telemetry; first failure and valid emptiness remain distinct');
