// bun exact/lexy/session-log.check.ts
// Drives app.ts's session sources over real SQLite and checks the session log
// they keep: what each event says, that it outlives sign-out, that it tells a
// lost Keychain item from a sign-out, that it holds no token, and that it keeps
// the newest 200.
import { strict as assert } from 'node:assert';
import { memoryStorage, memoryStore } from './check-support';

const timeout = setTimeout((): never => { throw new Error('Session log check did not finish within 10 seconds'); }, 10_000);
let current = 'r1';
let abortRefresh: Promise<void> | null = null;
const jwt = (o: object): string => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (url: string, init?: RequestInit): Promise<Response> => {
  const u = String(url);
  if (u.includes('/authorize')) {
    return new Response(null, { status: 302, headers: { Location: 'com.toyota.oneapp:/oauth2Callback?code=c1' } });
  }
  if (u.includes('access_token')) {
    const body = new URLSearchParams(String(init?.body ?? ''));
    if (body.get('grant_type') === 'authorization_code') {
      current = 'r1';
      return json(200, { access_token: 'a-r1', refresh_token: 'r1', id_token: jwt({ extension_tmsguid: 'g' }), expires_in: 3600, token_type: 'Bearer' });
    }
    if (abortRefresh) {
      await abortRefresh;
      throw Object.assign(new Error('the answer was let go before this reply; the request may already have been sent'), { kind: 'Aborted' });
    }
    if (body.get('refresh_token') !== current) {
      // Words a server chose can carry anything; the log must not keep them
      return json(400, { error: 'invalid_grant', error_description: `Refresh token ${body.get('refresh_token')} of driver@example.com is invalid` });
    }
    current = 'r' + (Number(current.slice(1)) + 1);
    return json(200, { access_token: 'a-' + current, refresh_token: current, id_token: jwt({ extension_tmsguid: 'g' }), expires_in: 3600, token_type: 'Bearer' });
  }
  if (u.includes('/vehicle/guid')) {
    const authorization = (init?.headers as Record<string, string>).Authorization ?? '';
    return authorization === 'Bearer stale' ? json(401, { error: 'invalid_token' }) : json(200, { payload: [{ vin: 'VIN1' }] });
  }
  throw new Error('unexpected ' + u);
}) as typeof fetch;

const { answer } = await import('./app.ts');
const { storage, database } = memoryStorage();
const store = memoryStore();
const now = 1_790_900_000_000;
const saved = (refreshToken: string, accessToken: string, expiresAt: number): string =>
  JSON.stringify({ accessToken, refreshToken, idToken: jwt({ extension_tmsguid: 'g' }), expiresAt, tokenType: 'Bearer' });
type Log = { ok: boolean; signedInAt: number; refreshes: number; lastRefreshAt: number; events: { at: number; kind: string; detail: string }[] };
// The log source reads after the events already logged have landed
const log = (): Promise<Log> => answer('sessionLog', [200, 1], store, storage, null) as Promise<Log>;
const kinds = (l: Log): string[] => l.events.map(e => e.kind);
const session = async (rev: number): Promise<boolean> =>
  (await answer('session', [rev, now], store, storage, null) as { signedIn: boolean }).signedIn;

// 1. An upgrade onto a saved session logs from its first event, with an empty
// table: a refused refresh token is the failure, the deletion and the sign-in
store.set('lexy.session', saved('r9', 'a-r9', now - 1000));
assert.equal(await session(0), false);
let l = await log();
assert.deepEqual(kinds(l), ['sign-in shown', 'session deleted', 'refresh failed']);
assert.equal(l.events[2].detail.endsWith('; HTTP 400 invalid_grant'), true, l.events[2].detail);
await session(1);
assert.equal((await log()).events.length, 3, 'a known sign-out was logged as a lost session');
console.log('1 a refused refresh token is logged in order from an empty log, and its sign-out once');

// 2. Sign-in, then a refresh: the refresh names both tokens by their prints
await answer('authFinish', [1, '', 'sso-token', now], store, storage, null);
assert.equal((await log()).events[0].kind, 'signed in');
store.set('lexy.session', saved('r1', 'a-r1', now - 1000));
assert.equal(await session(2), true);
l = await log();
assert.equal(l.events[0].kind, 'refreshed');
assert.match(l.events[0].detail, /^sent [0-9a-f]{6}, got [0-9a-f]{6}; the access token lasts 3600 s$/);
assert.equal(l.refreshes, 1);
assert.equal(l.signedInAt, now);
console.log('2 a sign-in and a refresh are logged, the refresh with both token prints');

// 3. A read the gateway refuses names its path
store.set('lexy.session', saved('r2', 'stale', now + 3_600_000));
await answer('garage', [true, now + 3_600_000, 0, now], store, storage, null);
l = await log();
assert.equal(l.events[0].kind, 'request refused');
assert.equal(l.events[0].detail, 'HTTP 401 on /oneapi/v2/vehicle/guid');
console.log('3 a refused request is logged with its path');

// 4. A session that vanishes while signed in is a lost Keychain item
store.forget('lexy.session');
assert.equal(await session(3), false);
assert.equal((await log()).events[0].kind, 'no saved session');
console.log('4 a session gone without a sign-out is logged as lost');

// 5. A refresh Exact cuts off says so; one that lands after a sign-out does not
// make the next launch look like a lost session
store.set('lexy.session', saved('r2', 'a-r2', now - 1000));
const { promise: cutOff, resolve: cutOffNow } = Promise.withResolvers<void>();
abortRefresh = cutOff;
const refreshing = session(4);
await answer('signOut', [now], store, storage, null);
cutOffNow();
assert.equal(await refreshing, true);
abortRefresh = null;
l = await log();
assert.deepEqual(kinds(l).slice(0, 2), ['refresh failed', 'signed out']);
assert.match(l.events[0].detail, /^sent [0-9a-f]{6}; no reply: Exact let the answer go/);
await session(5);
assert.equal((await log()).events[0].kind, 'refresh failed', 'a launch after a sign-out was logged as a lost session');
console.log('5 a cut-off refresh is logged as no reply, and sign-out still explains the next launch');

// 6. Signing out empties the vehicle data but keeps the log
assert.equal(kinds(await log()).includes('signed in'), true);
console.log('6 the log outlives sign-out');

// 7. No token, account or address appears anywhere in it
const details = database.prepare('SELECT detail FROM session_log').values().map(row => String(row[0]));
assert.equal(details.length, 9);
assert.equal(details.some(d => /\b(a-)?r\d+\b|stale|sso-token|c1|@|example/.test(d)), false, `a secret reached the session log: ${details.join(' | ')}`);
console.log('7 the log holds no token, account or address');

// 8. Only the newest 200 are kept
for (let i = 0; i < 250; i++) {
  database.prepare('INSERT INTO session_log (at, kind, detail) VALUES (?, ?, ?)').run(now, 'filler', String(i));
}
store.set('lexy.session', saved('r2', 'stale', now + 3_600_000));
await answer('garage', [true, now + 3_600_000, 1, now], store, storage, null);
assert.equal((await log()).events[0].kind, 'request refused');
assert.equal(Number(database.prepare('SELECT count(*) FROM session_log').values()[0][0]), 200);
console.log('8 the log keeps the newest 200 events');

clearTimeout(timeout);
