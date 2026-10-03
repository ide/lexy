// bun exact/lexy/closures.check.ts
// Drives app.ts's status source over a full snapshot, then a sparse one (the
// lock-only doors a drive leaves), and checks the fold keeps the windows;
// then a failed read, which keeps the last good reading.
const L = import.meta.dir;
const full = { occurrenceDate: '2026-10-01T10:00:00Z', vehicleStatus: [
  { category: 'Driver Side', sections: [
    { section: 'Door', values: [{ value: 'Closed' }, { value: 'Locked' }] },
    { section: 'Window', values: [{ value: 'Closed' }] },
  ] },
  { category: 'Other', sections: [{ section: 'Trunk', values: [{ value: 'Closed' }, { value: 'Locked' }] }] },
] };
const sparse = { occurrenceDate: '2026-10-01T12:00:00Z', vehicleStatus: [
  { category: 'Driver Side', sections: [{ section: 'Door', values: [{ value: 'Unlocked' }] }] },
] };
let next: object = full;
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: next } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
const { answer } = await import(L + '/app.ts');
const mem = new Map<string, string>();
const store = { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v), forget: (k: string) => void mem.delete(k) } as any;
// An in-memory app:/data, so the files round-trip through the UTF-8 code.
const disk = new Map<string, Uint8Array>();
const storage = { fs: {
  mkdir: async () => {},
  readFile: async (p: string) => { const b = disk.get(p); if (!b) throw new Error('ENOENT'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
  atomicWriteFile: async (p: string, d: Uint8Array) => { disk.set(p, new Uint8Array(d)); },
  rm: async (p: string) => { disk.delete(p); },
} } as any;
const now = 1_790_900_000_000;
mem.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: now + 3_600_000, tokenType: 'Bearer' }));
const car = { vin: 'VIN1', modelName: '', nickName: '', capabilities: [] };
const show = (s: any) => s.sections.map((x: any) => `${x.category}/${x.section}=${x.values.join('+')}`).join(' ');

const a = await answer('status', [car, 0, now], store, storage, null);
console.log('1 full:  ', show(a), 'stale', a.closuresStaleMs);
next = sparse;
const b = await answer('status', [car, 1, now], store, storage, null);
console.log('2 sparse:', show(b), 'stale', b.closuresStaleMs ? new Date(b.closuresStaleMs).toISOString() : 0);
// 3. A failed re-read answers the last good reading, with the failure.
globalThis.fetch = (async () => { throw new TypeError('offline'); }) as any;
const c = await answer('status', [car, 2, now], store, storage, null);
console.log('3 failed:', show(c), 'ok', c.ok, 'status', c.status, 'error', JSON.stringify(c.error));
// 4. An older snapshot does not win over what is held.
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: { occurrenceDate: '2026-10-01T09:00:00Z', vehicleStatus: [{ category: 'Driver Side', sections: [{ section: 'Window', values: [{ value: 'Open' }] }] }] } } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
const d = await answer('status', [car, 3, now], store, storage, null);
console.log('4 older:', show(d));
// 5. What was written is UTF-8 JSON on disk, and a different car starts fresh.
const onDisk = JSON.parse(new TextDecoder().decode(disk.get('app:/data/lexy/closures.json')!));
next = { occurrenceDate: '2026-10-02T09:00:00Z', vehicleStatus: [{ category: 'Other', sections: [{ section: 'Hood’s', values: [{ value: 'Closed' }] }] }] };
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: next } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
const e = await answer('status', [{ ...car, vin: 'VIN2' }, 4, now], store, storage, null);
const reread = JSON.parse(new TextDecoder().decode(disk.get('app:/data/lexy/closures.json')!));
console.log('5 disk:', onDisk.vin, Object.keys(onDisk.rows).length, 'rows; new car:', show(e), reread.vin);
const ok = show(d).includes('Driver Side/Window=Closed') && onDisk.vin === 'VIN1' && show(e) === 'Other/Hood’s=Closed' && reread.vin === 'VIN2' && c.ok && c.status === 0 && c.error !== '' && show(c) === show(b) && show(b) === 'Driver Side/Door=Closed+Unlocked Driver Side/Window=Closed Other/Trunk=Closed+Locked' && b.closuresStaleMs === Date.parse(full.occurrenceDate);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
