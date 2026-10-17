// bun exact/lexy/independent-reads.check.ts
// Exercise two overlapping tire reads: a late old reply must not replace the
// newer cached answer, and only independent reads request Exact's HTTP lane.
import { strict as assert } from 'node:assert';

const pending: Array<(value: Response) => void> = [];
const discoveryPending: Array<(value: Response) => void> = [];
let holdDiscovery = false;
const requests: Array<{ url: string; init: RequestInit & { exactIndependentHttp?: { maxResponseBytes: number } } }> = [];
globalThis.fetch = ((url: string, init: RequestInit): Promise<Response> => {
  requests.push({ url, init });
  if (url.includes('tires/pressure')) return new Promise<Response>((resolve): void => { pending.push(resolve); });
  if (holdDiscovery && url.includes('vehicle/guid')) return new Promise<Response>((resolve): void => { discoveryPending.push(resolve); });
  const payload = url.includes('route/status') ? { status: { occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [] } } : {};
  return Promise.resolve(new Response(JSON.stringify({ payload }), { status: 200 }));
}) as typeof fetch;

const { answer } = await import('./app');
const memory = new Map<string, string>();
const store = {
  get: (key: string): string | null => memory.get(key) ?? null,
  set: (key: string, value: string): void => { memory.set(key, value); },
  forget: (key: string): void => { memory.delete(key); },
} as any;
const disk = new Map<string, Uint8Array>();
const storage = { fs: {
  mkdir: async (): Promise<void> => {},
  readFile: async (path: string): Promise<ArrayBuffer> => {
    const bytes = disk.get(path);
    if (!bytes) throw new Error('ENOENT');
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  },
  atomicWriteFile: async (path: string, bytes: Uint8Array): Promise<void> => { disk.set(path, new Uint8Array(bytes)); },
  rm: async (path: string): Promise<void> => { disk.delete(path); },
} } as any;
const at = 1_790_900_000_000;
memory.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: at + 3_600_000, tokenType: 'Bearer' }));
const car = { vin: 'VIN1', brand: 'L', generation: '', capabilities: [] } as any;
const tireResponse = (value: number): Response => new Response(JSON.stringify({ payload: {
  tirePressureStatus: 'normal',
  flTirePressure: { value, unit: 'psi' },
} }), { status: 200 });

const older = answer('tires', [car, 1, at], store, storage, null);
const newer = answer('tires', [car, 2, at + 1], store, storage, null);
await Promise.resolve();
assert.equal(pending.length, 2);
pending[1](tireResponse(35));
assert.equal((await newer).tires[0].value, 35);
pending[0](tireResponse(30));
assert.equal((await older).tires[0].value, 30);
const cached = JSON.parse(new TextDecoder().decode(disk.get('app:/data/lexy/tires.json')));
assert.equal(cached.answer.tires[0].value, 35);
assert.equal(requests[0].init.exactIndependentHttp?.maxResponseBytes, 4 * 1024 * 1024);

await answer('prime', [car, at], store, storage, null);
await answer('status', [car, 0, at], store, storage, null);
assert.equal(requests.at(-2)?.init.exactIndependentHttp, undefined);
assert.equal(requests.at(-1)?.init.exactIndependentHttp, undefined);
assert.equal(requests.at(-2)?.init.method, 'POST');
assert.equal(requests.at(-1)?.init.method, 'GET');
await answer('garage', [true, at + 3_600_000, 0, at], store, storage, null);
assert.equal(requests.at(-1)?.init.exactIndependentHttp?.maxResponseBytes, 4 * 1024 * 1024);
holdDiscovery = true;
const oldGarage = answer('garage', [true, at + 3_600_000, 1, at], store, storage, null);
const newGarage = answer('garage', [true, at + 3_600_000, 2, at + 1], store, storage, null);
await Promise.resolve();
assert.equal(discoveryPending.length, 2);
discoveryPending[1](new Response(JSON.stringify({ payload: [{ vin: 'VIN1', nickName: 'Current' }] }), { status: 200 }));
assert.equal((await newGarage).car.nickName, 'Current');
discoveryPending[0](new Response(JSON.stringify({ payload: [{ vin: 'VIN1', nickName: 'Old' }] }), { status: 200 }));
assert.equal((await oldGarage).car.nickName, 'Old');
const cachedGarage = JSON.parse(new TextDecoder().decode(disk.get('app:/data/lexy/garage.json')));
assert.equal(cachedGarage.answer.car.nickName, 'Current');
console.log('PASS');
