// bun exact/lexy/maps-preference.check.ts
import { strict as assert } from 'node:assert';
import { answer } from './app';

const path = 'app:/data/lexy/maps.json';
const disk = new Map<string, Uint8Array>();
const store = { get: (_key: string): null => null } as any;
let pauseWrite = true;
let finishWrite: (() => void) | null = null;
let writeEntered: (() => void) | null = null;
const storage = { fs: {
  mkdir: async (): Promise<void> => {},
  readFile: async (file: string): Promise<Uint8Array> => {
    const bytes = disk.get(file);
    if (!bytes) throw Object.assign(new Error('Missing file'), { code: 'ENOENT' });
    return bytes;
  },
  atomicWriteFile: async (file: string, bytes: Uint8Array): Promise<void> => {
    writeEntered?.();
    if (pauseWrite) await new Promise<void>((resolve): void => { finishWrite = resolve; });
    disk.set(file, bytes);
  },
} } as any;
const installed = { available: true, later: async (): Promise<object> => ({ apple: true, google: true, waze: false }) } as any;

const first = answer('setMapsApp', ['google'], store, storage, installed);
await new Promise<void>((resolve): void => { writeEntered = resolve; });
assert.equal(disk.has(path), false);
assert.equal((await answer('mapsApp', [], store, storage, null)).provider, '');
finishWrite?.();
pauseWrite = false;
assert.equal((await first).provider, 'google');
assert.equal(new TextDecoder().decode(disk.get(path)), 'google');

// A launch before the native probe connects cannot prove Google Maps was removed.
assert.equal((await answer('mapsApp', [], store, storage, null)).provider, 'google');
assert.equal(new TextDecoder().decode(disk.get(path)), 'google');
assert.equal((await answer('mapsApp', [], store, storage, installed)).provider, 'google');

const broken = { fs: { ...storage.fs, atomicWriteFile: async (): Promise<never> => {
  throw new Error('Disk full');
} } } as any;
await assert.rejects(answer('setMapsApp', ['apple'], store, broken, installed), /Disk full/);
assert.equal(new TextDecoder().decode(disk.get(path)), 'google');

const removed = { available: true, later: async (): Promise<object> => ({ apple: true, google: false, waze: false }) } as any;
assert.equal((await answer('mapsApp', [], store, storage, removed)).provider, '');
assert.equal(new TextDecoder().decode(disk.get(path)), '');
