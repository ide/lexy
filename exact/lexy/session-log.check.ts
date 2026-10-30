// bun exact/lexy/session-log.check.ts
// Drives app.ts's session sources over real SQLite against a fake Lexus realm
// and checks the session log they keep from @exact/oauth's events: what each
// says, that it outlives sign-out, that it tells a lost Keychain item from a
// sign-out, that it holds no token, that it keeps the newest 200, that it
// explains the first launch after an earlier build's session, and that it tells
// a refresh with no reply from one with an unusable reply.
import { strict as assert } from 'node:assert';
import { gateway, lexusRealm, memoryStorage, memoryStore, signIn } from './check-support';

const timeout = setTimeout((): never => { throw new Error('Session log check did not finish within 10 seconds'); }, 10_000);
const gate = gateway();
const realm = lexusRealm(gate.answer);
globalThis.fetch = realm.fetch as typeof fetch;

const { answer } = await import('./app.ts');
const { storage, database } = memoryStorage();
const store = memoryStore();
const now = 1_790_900_000_000;
type Log = { ok: boolean; signedInAt: number; refreshes: number; lastRefreshAt: number; events: { at: number; kind: string; detail: string }[] };
const log = (): Promise<Log> => answer('sessionLog', [200, 1], store, storage, null) as Promise<Log>;
const kinds = (l: Log): string[] => l.events.map(e => e.kind);
// The package says what happened once a token's print is made: wait, a
// second at most, for the log to hold `n` events, or for `kind` to be the newest
const logged = async (n: number, kind?: string): Promise<Log> => {
  for (let i = 0; i < 200; i++) {
    const l = await log();
    if (kind ? l.events[0]?.kind === kind : l.events.length >= n) return l;
    await Bun.sleep(5);
  }
  throw new Error(`the session log never held ${kind ?? `${n} events`}: ${kinds(await log()).slice(0, 12).join(', ')}`);
};
const session = async (): Promise<boolean> => (await answer('session', [now], store, storage, null)).signedIn;
const garage = (rev: number): Promise<unknown> => answer('garage', [true, rev, now], store, storage, null);

// 1. A launch with nothing saved logs a lost session once.
assert.equal(await session(), false);
assert.equal(await session(), false);
assert.deepEqual(kinds(await logged(1)), ['no saved session']);
console.log('1 a launch with nothing saved is logged once');

// 2. A sign-in, then a refresh the gateway's 403 started: the refresh names
// both tokens by their prints.
await signIn(answer, store, storage, now);
let l = await logged(2);
assert.equal(l.events[0].kind, 'signed in');
assert.match(l.events[0].detail, /^refresh token [0-9a-f]{6}$/);
gate.expired.add('Bearer a-r1');
await garage(0);
l = await logged(3);
assert.equal(l.events[0].kind, 'refreshed');
assert.match(l.events[0].detail, /^sent [0-9a-f]{6}, got [0-9a-f]{6}; the access token lasts 3600 s$/);
assert.equal(l.events[0].detail.slice(5, 11), l.events[1].detail.slice(14), 'the refresh sent the token the sign-in kept');
assert.equal(l.refreshes, 1);
assert.equal(l.signedInAt, now);
console.log('2 a sign-in and a refresh are logged, the refresh with both token prints');

// 3. A refresh that gets no reply says so.
gate.expired.add('Bearer a-r2');
realm.next = 'throw';
await garage(1);
l = await logged(4);
assert.equal(l.events[0].kind, 'refresh failed');
assert.match(l.events[0].detail, /^sent [0-9a-f]{6}; no reply/);
console.log('3 a refresh with no reply is logged as such');

// 4. A read the gateway refuses again after a refresh names its path.
gate.refuseAll = true;
await garage(2);
l = await logged(6);
assert.deepEqual(kinds(l).slice(0, 2), ['request refused', 'refreshed']);
assert.equal(l.events[0].detail, 'HTTP 403 on /oneapi/v2/vehicle/guid');
gate.refuseAll = false;
console.log('4 a refused request is logged with its path');

// 5. Lexus refusing the refresh token deletes the session, and the next
// launch is not a lost one.
gate.expired.add('Bearer a-r3');
realm.next = { status: 400, body: { error: 'invalid_grant' } };
await garage(3);
l = await logged(7);
assert.equal(l.events[0].kind, 'session deleted');
assert.equal(l.events[0].detail, 'the session ended (invalid_grant)');
assert.equal(await session(), false);
assert.equal((await log()).events.length, 7, 'a session Lexus ended was logged as lost');
console.log('5 a refused refresh token is logged, and its sign-out explains the next launch');

// 6. Signing out is logged, explains the next launch, and keeps the log.
await signIn(answer, store, storage, now);
await answer('signOut', [now], store, storage, null);
l = await logged(9);
assert.deepEqual(kinds(l).slice(0, 2), ['signed out', 'signed in']);
assert.equal(await session(), false);
assert.equal((await log()).events.length, 9, 'a launch after a sign-out was logged as a lost session');
console.log('6 sign-out is logged, explains the next launch, and the log outlives it');

// 7. No token, account or address appears anywhere in it.
const details = database.prepare('SELECT detail FROM session_log').values().map(row => String(row[0]));
assert.equal(details.some(d => /\b(a-)?r\d+\b|sso-token|test-code|@|example/.test(d)), false, `a secret reached the session log: ${details.join(' | ')}`);
console.log('7 the log holds no token, account or address');

// 8. Only the newest 200 are kept.
for (let i = 0; i < 250; i++) {
  database.prepare('INSERT INTO session_log (at, kind, detail) VALUES (?, ?, ?)').run(now, 'filler', String(i));
}
await signIn(answer, store, storage, now);
await logged(0, 'signed in');
assert.equal(Number(database.prepare('SELECT count(*) FROM session_log').values()[0][0]), 200);
console.log('8 the log keeps the newest 200 events');

// 9. A session an earlier build kept is forgotten at the first launch, with
// the vehicle data it read, which is logged as a sign-out, not as a lost session.
await answer('signOut', [now], store, storage, null);
await logged(0, 'signed out');
store.set('lexy.session', JSON.stringify({ refreshToken: 'r-old', accessToken: 'a-old' }));
store.set('lexy.demo', '1');
database.prepare("INSERT INTO cars (account, vin, position, car) VALUES ('old', 'VIN0', 0, '{}')").run();
database.prepare("INSERT INTO readings VALUES ('VIN0', 'tires', '{}')").run();
database.prepare("INSERT INTO closures VALUES ('VIN0', 'door', 'front-left', 0, 'closed', 1, 'locked', 1)").run();
assert.equal(await session(), false);
assert.equal(await session(), false);
assert.deepEqual([store.get('lexy.session'), store.get('lexy.demo')], [null, null], "the earlier build's session or demo mode is still kept");
for (const table of ['cars', 'readings', 'closures']) {
  assert.equal(Number(database.prepare(`SELECT count(*) FROM ${table}`).values()[0][0]), 0, `the earlier account's ${table} are still kept`);
}
const earlier = 'this build keeps the session differently: sign in again';
l = await log();
assert.deepEqual(l.events.slice(0, 2).map(e => [e.kind, e.detail]), [['signed out', earlier], ['signed out', 'from Settings']]);
console.log("9 an earlier build's session and vehicle data (cars, readings, closures) are forgotten at launch, logged as a sign-out");

// 10. A refresh answered with a token reply the package cannot use says so, not that no reply came.
await signIn(answer, store, storage, now);
gate.refuseAll = true;
realm.next = { status: 200, body: { token_type: 'Bearer' } };
await garage(4);
gate.refuseAll = false;
l = await logged(0, 'refresh failed');
assert.match(l.events[0].detail, /^sent [0-9a-f]{6}; an unusable reply invalid_response$/);
console.log('10 a refresh with an unusable reply is logged as such');

clearTimeout(timeout);
database.close();
