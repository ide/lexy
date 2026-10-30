// bun exact/lexy/demo.check.ts
// Drives demo mode through app.ts against demo.ts's in-memory Lexus: the
// sign-in tree, the code exchange and its ID token, a read, the refresh an
// expired access token starts, a relaunch on the session kept, and sign-out.
// None of the sources' requests leaves the app (the screens' vehicle image, which this check does not render, is a
// remote one), and the demo's session is kept apart from Lexus's.
import { strict as assert } from 'node:assert';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { memoryStorage, memoryStore } from './check-support';

// Each request that would leave the app; the package's revocation would swallow a throw
const sent: string[] = [];
globalThis.fetch = (async (url: string | URL | Request): Promise<Response> => {
  sent.push(String(url));
  throw new Error(`The demo sent a request to ${String(url)}`);
}) as typeof fetch;
const { answer } = await import('./app.ts');
const store = memoryStore();
const { storage, database } = memoryStorage();
const at = 1_790_900_000_000;
const kept = (): { refreshToken: string } => JSON.parse(store.get('lexy.demo.session') ?? 'null');
// What a launch keeps of the demo
const KEYS = ['lexy.demo', 'lexy.demo.session'];

// 4, in a process of its own, as a relaunch is: on the store the launch kept, whose demo has seen no refresh token
// spent, a read uses the kept access token until it expires by the time it names, then refreshes it once.
const relaunch = process.argv[2];
if (relaunch) {
  for (const [key, value] of Object.entries(JSON.parse(await Bun.file(relaunch).text()) as Record<string, string | null>)) {
    if (value !== null) {
      store.set(key, value);
    }
  }
  const spent = kept().refreshToken;
  const unexpired = await answer('garage', [true, 0, at + 5_000_000], store, storage, null);
  assert.equal(unexpired.ok, true, unexpired.error);
  assert.equal(kept().refreshToken, spent, 'the kept access token answered without a refresh');
  const expired = await answer('garage', [true, 1, at + 7_500_000], store, storage, null);
  assert.equal(expired.ok, true, expired.error);
  assert.match(kept().refreshToken, /-3$/);
  assert.deepEqual(sent, []);
  database.close();
  process.exit(0);
}

// 1. The demo's sign-in: any email and password, under the demo's own key.
await answer('useDemo', [true], store, storage, null);
const started = await answer('authStart', [1, ''], store, storage, null);
const named = await answer('authAnswer', [1, '', started.raw, 'NameCallback', 'driver@example.com'], store, storage, null);
const passed = await answer('authAnswer', [1, '', named.raw, 'PasswordCallback', 'any password'], store, storage, null);
const finished = await answer('authFinish', [1, '', at], store, storage, null);
assert(finished.ok, finished.error);
const session = await answer('session', [at], store, storage, null);
assert.deepEqual([session.signedIn, session.demo], [true, true]);
assert.equal(session.expiresAt, at + 3600_000, 'the token reply\'s Date is the demo car\'s clock');
assert.equal(store.get('lexy.lexus'), null, 'the demo kept its session under its own key');
console.log('1 the demo signs in through the tree and the code exchange, under its own key');

// 2. A read answers the demo car.
const first = await answer('garage', [true, 0, at], store, storage, null);
assert.equal(first.ok, true, first.error);
assert.equal(first.carCount, 1);
console.log('2 a read answers the demo car');

// 3. An hour on, the demo gateway refuses the access token; one refresh
// renews it, rotating the refresh token, and the read answers.
const spent = kept().refreshToken;
const later = await answer('garage', [true, 1, at + 3_700_000], store, storage, null);
assert.equal(later.ok, true, later.error);
assert.notEqual(kept().refreshToken, spent);
assert.match(kept().refreshToken, /-2$/);
console.log('3 an expired access token is refreshed once, and the read answers');

// 4. A relaunch on the kept session: this check again, in a process of its own (above).
const file = `${tmpdir()}/lexy-demo-relaunch-${process.pid}.json`;
await Bun.write(file, JSON.stringify(Object.fromEntries(KEYS.map(key => [key, store.get(key)]))));
const relaunched = Bun.spawnSync([process.execPath, import.meta.path, file], { stdout: 'pipe', stderr: 'pipe' });
rmSync(file);
assert.equal(relaunched.exitCode, 0, relaunched.stderr.toString());
console.log('4 a relaunch reads with the kept access token until it expires, then refreshes it once');

// 5. Sign-out forgets the demo's session and leaves demo mode, and nothing the demo did left the app.
await answer('signOut', [at + 3_800_000], store, storage, null);
const out = await answer('session', [at + 3_800_000], store, storage, null);
assert.deepEqual([out.signedIn, out.demo], [false, false]);
assert.equal(store.get('lexy.demo.session'), null);
assert.deepEqual(sent, [], 'no source request left the app');
console.log('5 sign-out forgets the demo session and leaves demo mode, and no source request left the app');

database.close();
