// bun exact/lexy/session.check.ts
// Drives app.ts's session and vehicle reads through @exact/oauth against a
// fake Lexus realm: what Lexy asks of the package, and what it does with what
// the package says. The protocol itself is the package's cases' (exact2's
// packages/oauth/test).
import { strict as assert } from 'node:assert';
import { gateway, lexusRealm, memoryStorage, memoryStore, signIn } from './check-support';

const timeout = setTimeout((): never => { throw new Error('Session check did not finish within 10 seconds'); }, 10_000);
const gate = gateway(), { expired, reads } = gate;
const realm = lexusRealm(gate.answer);
// Every request the app makes, to Lexus or anywhere else
let requests = 0;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => { requests++; return realm.fetch(input, init); }) as typeof fetch;
const { answer } = await import('./app.ts');
const store = memoryStore();
const { storage, database } = memoryStorage();
const now = 1_790_900_000_000;
type Account = { signedIn: boolean; status: number; error: string; expiresAt: number };
const account = async (): Promise<Account> => answer('session', [now], store, storage, null) as Promise<Account>;
const garage = (rev: number, on: typeof store = store): Promise<{ ok: boolean; status: number; car: { vin: string } }> =>
  answer('garage', [true, rev, now], on, storage, null) as never;
const cars = (): number => Number(database.prepare('SELECT count(*) FROM cars').values()[0][0]);

// 1. Signed out with nothing saved: no notice to sign in again, and no
// request made first (the realm's endpoints are fixed: no discovery).
assert.deepEqual(await account(), { signedIn: false, demo: false, expiresAt: 0, status: 401, error: '' });
assert.equal(requests, 0);
console.log('1 nothing saved: signed out, with no notice and no request');

// 2. A read carries the access token and the ID token's guid.
await signIn(answer, store, storage);
assert.equal((await account()).signedIn, true);
assert.equal((await garage(0)).car.vin, 'VIN1');
assert.equal(reads[0].get('Authorization'), 'Bearer a-r1');
assert.equal(reads[0].get('X-GUID'), 'g');
console.log('2 a read carries the token and the X-GUID from the ID token');

// 3. Two reads the gateway refuses at once renew the token once, with the
// scope, and each answers.
expired.add('Bearer a-r1');
const [a, b] = await Promise.all([garage(1), garage(2)]);
assert.equal(a.ok && b.ok, true);
assert.equal(realm.refreshes, 1);
assert.equal(realm.refreshed[0].get('scope'), 'openid profile write');
assert.equal(reads.at(-1)!.get('Authorization'), 'Bearer a-r2');
// The refresh's new ID token passed its checks: the session and its guid stand
assert.equal(reads.at(-1)!.get('X-GUID'), 'g');
// The sign-in's exchange and the refresh keep the package's 60 s, not the tree's 15 s: Lexus spends the refresh token
// it is sent, so a reply given up on would sign the person out at the next refresh
assert.deepEqual(realm.deadlines, [['authorization_code', 60_000], ['refresh_token', 60_000]]);
// A 401 renews too
gate.refusal = 401;
expired.add('Bearer a-r2');
assert.equal((await garage(3)).ok, true);
assert.equal(realm.refreshes, 2);
gate.refusal = 403;
console.log('3 a 403 or 401 renews once for reads at once, with the scope, and each answers');

// 3b. A read with no reply says Lexus could not be reached, which the screens
// word as a network failure; a refresh Lexus answers 503 says its status.
const restBefore = realm.rest;
realm.rest = () => { throw new TypeError('The network connection was lost.'); };
const lost = await garage(4);
assert.deepEqual([lost.ok, lost.status], [false, 0]);
assert.match((lost as unknown as { error: string }).error, /^Couldn’t reach Lexus/);
realm.rest = restBefore;
expired.add('Bearer a-r3');
realm.next = { status: 503, body: { error: 'server_error' } };
assert.equal((await garage(5)).status, 503);
console.log('3b no reply reads as Lexus unreachable, and a refresh 503 as its status');

// 3c. These transient and unclassified failures keep the session and the cars, whatever the body says: a rate limit, a
// timeout, another refusal, an unreadable reply and a server error. 3b left `a-r3` refused.
const carsBefore = cars();
assert(carsBefore > 0, "the account has cars to keep");
const page = async (): Promise<Response> => new Response('<html>Gateway unavailable</html>', { status: 400, headers: { 'Content-Type': 'text/html' } });
for (const [i, reply] of [
  { status: 429, body: { error: 'slow_down' } },
  { status: 429, body: { error: 'invalid_grant' } },
  { status: 408, body: { error: 'request_timeout' } },
  { status: 403, body: { error: 'access_denied' } },
  { status: 401, body: { error: 'invalid_client' } },
  { status: 400, body: { error: 'invalid_request' } },
  page,
  { status: 503, body: { error: 'invalid_grant' } },
].entries()) {
  realm.next = reply;
  assert.equal((await garage(10 + i)).ok, false);
  const said = typeof reply === 'function' ? 'an HTML page' : `${reply.status} ${JSON.stringify(reply.body)}`;
  assert.equal((await account()).signedIn, true, `a refresh answered ${said} is no refusal of the token`);
  assert.equal(cars(), carsBefore);
}
console.log('3c a rate limit, a timeout, another refusal, an unreadable reply and a server error keep the session and the cars');

// 4. A refresh that gets no reply keeps the session: the read fails, retryable. 3b left `a-r3` refused.
realm.next = 'throw';
const unanswered = await garage(3);
assert.equal(unanswered.ok, false);
assert.equal(unanswered.status, 0);
assert.equal((await account()).signedIn, true);
console.log('4 a refresh with no reply keeps the session');

// 5. A refresh whose reply's turn has no store (LLP 1146 D3) keeps it too.
let unavailable = false;
const answerStore = {
  get: (k: string) => { if (unavailable) throw new Error('store.get: no store here'); return store.get(k); },
  set: (k: string, v: string) => { if (unavailable) throw new Error('store.set: no store here'); store.set(k, v); },
  forget: (k: string) => { if (unavailable) throw new Error('store.forget: no store here'); store.forget(k); },
} as typeof store;
realm.next = async () => {
  unavailable = true;
  return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
};
assert.equal((await garage(4, answerStore)).ok, false);
unavailable = false;
assert.equal((await account()).signedIn, true, 'a refusal read with no store signed the person out');
console.log('5 a refusal its turn cannot read the store for keeps the session');

// 5b. A refusal that stands after the refresh reads as a 401, whatever the gateway answered, and keeps the session.
gate.refuseAll = true;
const stood = await garage(30);
gate.refuseAll = false;
assert.deepEqual([stood.ok, stood.status], [false, 401]);
assert.equal((await account()).signedIn, true);
console.log('5b a refusal that stands after the refresh reads as a 401 and keeps the session');

// 6. Lexus ending the session ends it in Lexy, with a session error, for which the sign-in screen shows its notice,
// and the vehicle data gone: a refused refresh token, a refresh that asks for a new sign-in (OpenID Connect Core
// §3.1.2.6), and a refresh whose ID token is another issuer's. Each starts from a session with a car saved.
const issued = Math.floor(Date.now() / 1000);
const stranger = `e30.${Buffer.from(JSON.stringify({ iss: 'https://login.example', sub: 'user-1', aud: 'oneappsdkclient', iat: issued, exp: issued + 3600 })).toString('base64url')}.sig`;
for (const [i, reply] of [
  { status: 400, body: { error: 'invalid_grant' } },
  { status: 400, body: { error: 'login_required' } },
  { status: 200, body: { access_token: 'a-stranger', refresh_token: 'r-stranger', token_type: 'Bearer', expires_in: 3600, id_token: stranger } },
].entries()) {
  if (!(await account()).signedIn) {
    await signIn(answer, store, storage);
  }
  assert.equal((await garage(20 + 2 * i)).ok, true);
  assert(cars() > 0, 'the account has a car to forget');
  expired.add(`Bearer a-${realm.refresh}`);
  realm.next = reply;
  assert.equal((await garage(21 + 2 * i)).status, 401);
  const ended = await account();
  assert.equal(ended.signedIn, false);
  assert.equal(ended.status, 401);
  assert.notEqual(ended.error, '', `a session error says the session ended (${JSON.stringify(reply.body)})`);
  assert.equal(cars(), 0);
}
console.log('6 a refused refresh token, a sign-in asked again and another issuer\'s ID token sign out, with a session error and no vehicle data');

// 7. Sign-out revokes the session at Lexus and forgets it.
await signIn(answer, store, storage);
const refresh = realm.refresh;
await answer('signOut', [now], store, storage, null);
assert.deepEqual(realm.revoked, [refresh]);
assert.equal((await account()).signedIn, false);
assert.equal((await garage(6)).status, 401);
console.log('7 sign-out revokes the refresh token and forgets the session');

clearTimeout(timeout);
database.close();
