// bun exact/lexy/independent-reads.check.ts
import { strict as assert } from 'node:assert';
import { setImmediate as nextTurn } from 'node:timers/promises';
import type { NativeModule, SQLCommand } from './app.contract.d.ts';
import { memoryStorage, memoryStore } from './check-support';

type Request = { url: string; init: RequestInit; reply: (response: Response) => void };
const pending: Request[] = [];
let requested: (() => void) | undefined;
globalThis.fetch = ((url: string, init: RequestInit): Promise<Response> => new Promise<Response>((resolve): void => {
  pending.push({ url, init, reply: resolve });
  requested?.();
})) as typeof fetch;
const { answer } = await import('./app');

async function nextRequest(): Promise<Request> {
  if (pending.length === 0) {
    await new Promise<void>((resolve): void => { requested = resolve; });
  }
  return pending.shift()!;
}
function respond(request: Request, payload: unknown): void {
  request.reply(new Response(JSON.stringify({ payload }), { status: 200 }));
}
function tires(value: number): unknown {
  return { tirePressureStatus: 'normal', flTirePressure: { value, unit: 'psi' } };
}
function cars(nickName: string, vin = 'VIN1'): unknown {
  return [{ vin, nickName, region: 'US', asiCode: 'A', hwType: 'H' }];
}
function lane(request: Request, independent: boolean, path: string, method = 'GET'): void {
  assert.equal(new URL(request.url).pathname.endsWith(path), true);
  assert.equal(request.init.method, method);
  if (method === 'GET') {
    assert.equal(request.init.exactTimeout, 15000);
  }
  assert.deepEqual(request.init.exactIndependentHttp, independent ? { maxResponseBytes: 4 * 1024 * 1024 } : undefined);
}

const timeout = setTimeout((): never => { throw new Error('Independent read check did not finish within 5 seconds'); }, 5_000);
const store = memoryStore();
let writeGate: { entered: ReturnType<typeof Promise.withResolvers<void>>; released: ReturnType<typeof Promise.withResolvers<void>> } | null = null;
const { storage, database } = memoryStorage({
  beforeWrite: async (commands: SQLCommand[]): Promise<void> => {
    if (writeGate && commands.some(command => command.sql.startsWith('INSERT INTO cars'))) {
      const gate = writeGate;
      writeGate = null;
      gate.entered.resolve();
      await gate.released.promise;
    }
  },
});
const at = 1_790_900_000_000;
function signIn(): void {
  store.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: at + 3_600_000, tokenType: 'Bearer' }));
}
function savedName(): string | null {
  const row = database.query<{ car: string }, []>('SELECT car FROM cars').get();
  return row ? JSON.parse(row.car).nickName : null;
}
function savedPressure(vin = 'VIN1'): number {
  const row = database.query<{ answer: string }, [string]>("SELECT answer FROM readings WHERE kind = 'tires' AND vin = ?").get(vin);
  assert.ok(row);
  return JSON.parse(row.answer).tires[0].value;
}
function pauseGarageWrite(): NonNullable<typeof writeGate> {
  writeGate = { entered: Promise.withResolvers<void>(), released: Promise.withResolvers<void>() };
  return writeGate;
}
signIn();
const initial = answer('garage', [true, at + 3_600_000, 0, at], store, storage, null);
const discovery = await nextRequest();
lane(discovery, true, '/vehicle/guid');
respond(discovery, cars('Initial'));
const car = (await initial).car;

const older = answer('tires', [car.vin, car, 1, at], store, storage, null);
const newer = answer('tires', [car.vin, car, 2, at + 1], store, storage, null);
const oldTires = await nextRequest();
const newTires = await nextRequest();
lane(oldTires, true, '/tires/pressure');
lane(newTires, true, '/tires/pressure');
respond(newTires, tires(35));
assert.equal((await newer).tires[0].value, 35);
respond(oldTires, tires(30));
assert.equal((await older).tires[0].value, 30);
assert.equal(savedPressure(), 35);

// Reads for different cars must not invalidate each other's saved answers
const otherCar = { ...car, vin: 'VIN2' };
const firstCar = answer('tires', [car.vin, car, 3, at + 2], store, storage, null);
const secondCar = answer('tires', [otherCar.vin, otherCar, 3, at + 2], store, storage, null);
const firstRequest = await nextRequest();
const secondRequest = await nextRequest();
respond(secondRequest, tires(36));
await secondCar;
respond(firstRequest, tires(34));
await firstCar;
assert.equal(savedPressure('VIN1'), 34);
assert.equal(savedPressure('VIN2'), 36);

const prime = answer('prime', [car, at], store, storage, null);
const wake = await nextRequest();
lane(wake, false, '/refresh-status', 'POST');
respond(wake, {});
await prime;
const status = answer('status', [car.vin, car, 0, at], store, storage, null);
const snapshot = await nextRequest();
lane(snapshot, false, '/route/status');
respond(snapshot, { status: { telemetry: { fugage: { value: 62 }, rage: { value: 214 }, odo: { value: 12482 } }, occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [] } });
assert.equal((await status).ok, true);
const engineCar = { ...car, capabilities: ['remoteEngineStartStop'] };
const engine = answer('engine', [car.vin, engineCar, 0, at], store, storage, null);
const engineRequest = await nextRequest();
lane(engineRequest, true, '/engine-status');
respond(engineRequest, { status: '0', date: '', timer: 0 });
assert.equal((await engine).fetchedMs, at);

// Older installations have no engine request timestamp in their saved reading
const legacy = { ok: true, status: '0', startedMs: 0, timer: 0 };
database.query('UPDATE readings SET answer = ? WHERE kind = ? AND vin = ?').run(JSON.stringify(legacy), 'engine', car.vin);
const failedEngine = answer('engine', [car.vin, engineCar, 1, at + 1], store, storage, null);
(await nextRequest()).reply(new Response('{}', { status: 503 }));
assert.deepEqual(await failedEngine, { ...legacy, fetchedMs: 0 });

assert.equal((await answer('climate', ['', car, 0, at], store, storage, null)).ok, false);
assert.equal(pending.length, 0, 'Deferred climate sends no HTTP before the primary snapshot');

const feedback: string[] = [];
const native: NativeModule = {
  available: true,
  call(request): Record<string, unknown> { feedback.push(String(request.style)); return {}; },
  async later(): Promise<Record<string, unknown>> { return {}; },
  watch(): void {},
};
for (const [statusCode, returnCode] of [[200, '000000'], [200, 'denied'], [503, '']] as const) {
  const command = answer('command', [car, 'door-lock', at], store, storage, native);
  const request = await nextRequest();
  lane(request, false, '/route/command', 'POST');
  request.reply(new Response(JSON.stringify({ payload: { returnCode } }), { status: statusCode }));
  const result = await command;
  assert.equal(result.ok, statusCode === 200);
  assert.deepEqual(feedback, [], 'The request handler leaves haptic timing to the screen');
}
await answer('feel', ['error'], store, storage, native);
assert.deepEqual(feedback, ['error'], 'The explicit feedback action owns one native haptic');

for (const source of ['spec', 'services'] as const) {
  const reading = answer(source, [car.vin, car, at], store, storage, null);
  const request = await nextRequest();
  lane(request, true, source === 'spec' ? '/vehicle-spec' : '/vehicle-subscriptions');
  respond(request, {});
  assert.equal((await reading).ok, true);
}

const oldGarage = answer('garage', [true, at + 3_600_000, 1, at], store, storage, null);
const newGarage = answer('garage', [true, at + 3_600_000, 2, at + 1], store, storage, null);
const oldDiscovery = await nextRequest();
const newDiscovery = await nextRequest();
respond(newDiscovery, cars('Current'));
assert.equal((await newGarage).car.nickName, 'Current');
respond(oldDiscovery, cars('Old'));
assert.equal((await oldGarage).car.nickName, 'Old');
assert.equal(savedName(), 'Current');

// Hold the first transaction until the newer response is ready to save
const gate = pauseGarageWrite();
const beforeWrite = answer('garage', [true, at + 3_600_000, 3, at + 2], store, storage, null);
respond(await nextRequest(), cars('Before'));
await gate.entered.promise;
const afterWrite = answer('garage', [true, at + 3_600_000, 4, at + 3], store, storage, null);
respond(await nextRequest(), cars('After'));
// Drain response decoding so the second write reaches the held database queue
await nextTurn();
gate.released.resolve();
await Promise.all([beforeWrite, afterWrite]);
assert.equal(savedName(), 'After');

// Recheck freshness after waiting for another resource's transaction
const queuedGate = pauseGarageWrite();
const heldGarage = answer('garage', [true, at + 3_600_000, 5, at + 4], store, storage, null);
respond(await nextRequest(), cars('Held'));
await queuedGate.entered.promise;
const queuedTires = answer('tires', [car.vin, car, 4, at + 3], store, storage, null);
respond(await nextRequest(), tires(33));
await nextTurn();
const failedTires = answer('tires', [car.vin, car, 5, at + 4], store, storage, null);
(await nextRequest()).reply(new Response('{}', { status: 503 }));
await nextTurn();
queuedGate.released.resolve();
await heldGarage;
assert.equal((await queuedTires).tires[0].value, 33);
assert.equal((await failedTires).tires[0].value, 34);
assert.equal(savedPressure(), 34);

const signOutGate = pauseGarageWrite();
const readDuringSignOut = answer('garage', [true, at + 3_600_000, 6, at + 5], store, storage, null);
respond(await nextRequest(), cars('Signing out'));
await signOutGate.entered.promise;
const signOut = answer('signOut', [], store, storage, null);
await nextTurn();
signOutGate.released.resolve();
await Promise.all([readDuringSignOut, signOut]);
assert.equal(savedName(), null);
assert.equal(database.query<{ count: bigint }, []>('SELECT COUNT(*) AS count FROM readings').get()?.count, 0n);
assert.equal(store.get('lexy.session'), null);

signIn();
const late = answer('garage', [true, at + 3_600_000, 7, at + 6], store, storage, null);
const lateRequest = await nextRequest();
await answer('signOut', [], store, storage, null);
respond(lateRequest, cars('Late'));
await late;
assert.equal(savedName(), null);
assert.equal(pending.length, 0);
clearTimeout(timeout);
database.close();
console.log('PASS: HTTP lanes, newest saved reads, per-car isolation, queued writes, and sign-out during writes and HTTP');
