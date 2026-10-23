// bun exact/lexy/maps-preference.check.ts
import { strict as assert } from 'node:assert';
import { answer, overlay } from './app';
import type { NativeModule, Result, SQLCommand, SQLValue, Write } from './app.contract.d.ts';
import { memoryStorage, memoryStore } from './check-support';

const timeout = setTimeout((): never => { throw new Error('Maps preference check did not finish within 5 seconds'); }, 5_000);
const store = memoryStore();
const entered = Promise.withResolvers<void>();
const released = Promise.withResolvers<void>();
let pauseWrite = true;
let failWrite = false;
let choiceRead: (() => void) | null = null;
const { storage, database } = memoryStorage({
  afterQuery: (_sql: string, params: SQLValue[]): void => {
    if (params[0] === 'maps' && choiceRead) {
      const read = choiceRead;
      choiceRead = null;
      read();
    }
  },
  beforeWrite: async (commands: SQLCommand[]): Promise<void> => {
    if (!commands.some(command => command.params?.[0] === 'maps')) {
      return;
    }
    if (failWrite) {
      throw new Error('Disk full');
    }
    if (pauseWrite) {
      pauseWrite = false;
      entered.resolve();
      await released.promise;
    }
  },
});
const installed = {
  available: true,
  call: (): Record<string, never> => ({}),
  later: async (): Promise<Record<string, boolean>> => ({ apple: true, google: true, waze: true }),
  watch: (): void => {},
} satisfies NativeModule;
function saved(): string | null {
  const row = database.query<{ value: string }, []>("SELECT value FROM choices WHERE key = 'maps'").get();
  return row?.value ?? null;
}

const initial = await answer('mapsApp', [0], store, storage, null);
assert.equal(initial.provider, '');
const first = answer('setMapsApp', ['google'], store, storage, installed);
await entered.promise;
assert.equal(saved(), null);
const pending: Write = { id: 1, mutation: 'mapsChosen', source: 'setMapsApp', args: ['google'], answered: false, keep: (): void => {} };
assert.equal(overlay('mapsApp', [0], initial, [pending])?.provider, 'google');
const duringWrite = answer('mapsApp', [0], store, storage, null);
released.resolve();
assert.equal((await first).provider, 'google');
assert.equal((await duringWrite).provider, 'google');
assert.equal(saved(), 'google');

// An unavailable or failed native probe cannot establish that an app was removed
assert.equal((await answer('mapsApp', [0], store, storage, null)).provider, 'google');
const unavailable = { ...installed, available: false };
assert.equal((await answer('mapsApp', [0], store, storage, unavailable)).provider, 'google');
const failed = { ...installed, later: async (): Promise<never> => { throw new Error('Probe unavailable'); } };
assert.equal((await answer('mapsApp', [0], store, storage, failed)).provider, 'google');
assert.equal(saved(), 'google');

failWrite = true;
await assert.rejects(async (): Promise<void> => { await answer('setMapsApp', ['apple'], store, storage, installed); }, /Disk full/);
assert.equal(saved(), 'google');
failWrite = false;
assert.equal((await answer('mapsApp', [0], store, storage, installed)).provider, 'google');

const removed = { ...installed, later: async (): Promise<Record<string, boolean>> => ({ apple: true, google: false, waze: true }) };
assert.equal((await answer('mapsApp', [0], store, storage, removed)).provider, '');
assert.equal(saved(), '');
assert.equal((await answer('mapsApp', [0], store, storage, installed)).provider, '');

// Clearing a removed legacy choice must also prevent the Keychain fallback returning
store.set('lexy.maps', 'google');
database.run('DELETE FROM choices');
assert.equal((await answer('mapsApp', [0], store, storage, null)).provider, 'google');
assert.equal((await answer('mapsApp', [0], store, storage, removed)).provider, '');
assert.equal((await answer('mapsApp', [0], store, storage, null)).provider, '');

// Queue a new selection after an old read, before that read clears its removed app
await answer('setMapsApp', ['google'], store, storage, installed);
let selection: Result<'setMapsApp'> | Promise<Result<'setMapsApp'>> | undefined;
choiceRead = (): void => { selection = answer('setMapsApp', ['waze'], store, storage, installed); };
await answer('mapsApp', [0], store, storage, removed);
assert.ok(selection);
assert.equal((await selection).provider, 'waze');
assert.equal(saved(), 'waze');

await answer('signOut', [], store, storage, null);
assert.equal(saved(), 'waze');
assert.equal((await answer('mapsApp', [0], store, storage, installed)).provider, 'waze');
clearTimeout(timeout);
database.close();
console.log('PASS: optimistic maps choice, serialized reads, write failures, probe availability, removal, and sign-out');
