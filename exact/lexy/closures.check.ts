// bun exact/lexy/closures.check.ts
// Drives app.ts's status source over a full snapshot, then a sparse one (the
// lock-only doors a drive leaves), and checks the fold keeps the windows;
// then a failed read, which keeps the last good reading; and the move of an
// earlier build's files into the database.
const L = import.meta.dir;
const telemetry = { fugage: { value: 62 }, rage: { value: 214 }, odo: { value: 12482 } };
const full = { occurrenceDate: '2026-10-01T10:00:00Z', telemetry, vehicleStatus: [
  { category: 'Driver Side', sections: [
    { section: 'Door', values: [{ value: 'Closed' }, { value: 'Locked' }] },
    { section: 'Window', values: [{ value: 'Closed' }] },
  ] },
  { category: 'Other', sections: [{ section: 'Trunk', values: [{ value: 'Closed' }, { value: 'Locked' }] }] },
] };
const sparse = { occurrenceDate: '2026-10-01T12:00:00Z', telemetry, vehicleStatus: [
  { category: 'Driver Side', sections: [{ section: 'Door', values: [{ value: 'Unlocked' }] }] },
] };
let next: object = full;
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: next } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
import { Database } from 'bun:sqlite';
const { answer } = await import(L + '/app.ts');
const mem = new Map<string, string>();
const store = { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v), forget: (k: string) => void mem.delete(k) } as any;
// An in-memory app:/data holding a build's files from before the database
// (a closure fold and a maps choice), and the database as bun:sqlite, with
// INTEGER results as bigint as the host's are.
const disk = new Map<string, Uint8Array>();
const utf8 = (o: unknown) => new TextEncoder().encode(typeof o === 'string' ? o : JSON.stringify(o));
disk.set('app:/data/lexy/closures.json', utf8({ vin: 'VIN0', seq: 1, rows: { 'Other/Hood': { category: 'Other', section: 'Hood', order: 0, position: { value: 'Closed', at: 5 } } } }));
disk.set('app:/data/lexy/maps.json', utf8('waze'));
const databases = new Map<string, Database>();
const storage = {
  fs: {
    readdir: async (p: string) => [...disk.keys()].filter(k => k.startsWith(p + '/')).map(k => k.slice(p.length + 1)),
    readFile: async (p: string) => { const b = disk.get(p); if (!b) throw new Error('ENOENT'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
    rm: async (p: string) => { for (const k of [...disk.keys()]) if (k === p || k.startsWith(p + '/')) disk.delete(k); },
  },
  sqlite: {
    open: async (path: string) => {
      const db = databases.get(path) ?? new Database(':memory:', { safeIntegers: true });
      databases.set(path, db);
      const run = (sql: string, params: unknown[] = []) => { const r = db.prepare(sql).run(...(params as any[])); return { changes: r.changes, lastInsertRowid: BigInt(r.lastInsertRowid) }; };
      return {
        execute: async (sql: string, params?: unknown[]) => run(sql, params),
        query: async (sql: string, params: unknown[] = []) => { const q = db.prepare(sql); return { columns: q.columnNames, rows: q.values(...(params as any[])) }; },
        transaction: async (commands: { sql: string; params?: unknown[] }[]) => db.transaction(() => commands.map(c => run(c.sql, c.params)))(),
        close: async () => {},
      };
    },
  },
} as any;
const now = 1_790_900_000_000;
mem.set('lexy.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'x', expiresAt: now + 3_600_000, tokenType: 'Bearer' }));
const car = { vin: 'VIN1', modelName: '', nickName: '', capabilities: [] };
const show = (s: any) => s.sections.map((x: any) => `${x.category}/${x.section}=${x.values.join('+')}`).join(' ');

const a = await answer('status', [car.vin, car, 0, now], store, storage, null);
console.log('1 full:  ', show(a), 'stale', a.closuresStaleMs);
next = sparse;
const b = await answer('status', [car.vin, car, 1, now], store, storage, null);
console.log('2 sparse:', show(b), 'stale', b.closuresStaleMs ? new Date(b.closuresStaleMs).toISOString() : 0);
// 3. A failed re-read answers the last good reading, with the failure.
globalThis.fetch = (async () => { throw new TypeError('offline'); }) as any;
const c = await answer('status', [car.vin, car, 2, now], store, storage, null);
console.log('3 failed:', show(c), 'ok', c.ok, 'status', c.status, 'error', JSON.stringify(c.error));
// 4. An older snapshot does not win over what is held.
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: { occurrenceDate: '2026-10-01T09:00:00Z', telemetry, vehicleStatus: [{ category: 'Driver Side', sections: [{ section: 'Window', values: [{ value: 'Open' }] }] }] } } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
const d = await answer('status', [car.vin, car, 3, now], store, storage, null);
console.log('4 older:', show(d));
// 5. The fold is the database's, per car, and a different car starts fresh;
// the earlier build's files were moved into it and removed.
const db = databases.get('app:/data/lexy.db')!;
const vins = (db.prepare('SELECT DISTINCT vin FROM closures ORDER BY vin').values() as unknown[][]).map(r => String(r[0]));
next = { occurrenceDate: '2026-10-02T09:00:00Z', telemetry, vehicleStatus: [{ category: 'Other', sections: [{ section: 'Hood’s', values: [{ value: 'Closed' }] }] }] };
globalThis.fetch = (async () => new Response(JSON.stringify({ payload: { status: next } }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
const e = await answer('status', ['VIN2', { ...car, vin: 'VIN2' }, 4, now], store, storage, null);
const maps = await answer('mapsApp', [], store, storage, null);
// 6. A host with no storage still answers what Lexus said.
const bare = await answer('status', ['VIN3', { ...car, vin: 'VIN3' }, 5, now], store, null, null);
console.log('5 vins:', vins.join(','), 'new car:', show(e), 'maps:', maps.provider, 'files left:', disk.size);
console.log('6 no storage:', bare.ok, show(bare));
const ok = bare.ok && show(bare) === 'Other/Hood’s=Closed' && show(d).includes('Driver Side/Window=Closed') && vins.join(',') === 'VIN0,VIN1' && show(e) === 'Other/Hood’s=Closed' && maps.provider === 'waze' && disk.size === 0 && c.ok && c.status === 0 && c.error !== '' && show(c) === show(b) && show(b) === 'Driver Side/Door=Closed+Unlocked Driver Side/Window=Closed Other/Trunk=Closed+Locked' && b.closuresStaleMs === Date.parse(full.occurrenceDate);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
