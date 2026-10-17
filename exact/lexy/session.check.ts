// bun exact/lexy/session.check.ts
// Drives app.ts's session source against a fake rotating-token server.
import { strict as assert } from 'node:assert';
const L = import.meta.dir;
let current = 'r1', calls = 0, delay = 30;
const jwt = (o: object) => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
const vehicleAuthorizations: string[] = [];
let rejectFirstVehicleRead = false;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.includes('access_token')) {
    calls++;
    const body = new URLSearchParams(String(init?.body ?? ''));
    await new Promise(r => setTimeout(r, delay));
    if (body.get('refresh_token') !== current) {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    const next = 'r' + (Number(current.slice(1)) + 1);
    current = next;
    return new Response(JSON.stringify({ access_token: 'a-' + next, refresh_token: next, id_token: jwt({ extension_tmsguid: 'g' }), expires_in: 3600, token_type: 'Bearer' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/vehicle/guid')) {
    vehicleAuthorizations.push((init?.headers as Record<string, string>).Authorization ?? '');
    if (rejectFirstVehicleRead) {
      rejectFirstVehicleRead = false;
      return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ payload: [{ vin: 'VIN1' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected ' + u);
}) as any;
const { answer } = await import(L + '/app.ts');
const mem = new Map<string, string>();
const store = { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v), forget: (k: string) => void mem.delete(k) } as any;
const now = 1_790_900_000_000;
const expired = (rt: string) => JSON.stringify({ accessToken: 'a0', refreshToken: rt, idToken: 'x', expiresAt: now - 1000, tokenType: 'Bearer' });

// 1. Two launches' asks at once share one refresh.
mem.set('lexy.session', expired('r1'));
const [a, b] = await Promise.all([answer('session', [0, now], store, null, null), answer('session', [1, now], store, null, null)]);
console.log('1 concurrent:', calls === 1 ? 'one refresh' : `${calls} refreshes`, a.signedIn && b.signedIn ? 'both signed in' : 'SIGNED OUT', 'stored', JSON.parse(mem.get('lexy.session')!).refreshToken);
assert.equal(calls, 1);
assert.equal(a.signedIn && b.signedIn, true);

// 2. A refresh rejected because another already rotated the token keeps the session.
current = 'r9'; calls = 0;
mem.set('lexy.session', expired('r1'));           // the ask still holds r1 …
const ask = answer('session', [2, now], store, null, null);
mem.set('lexy.session', JSON.stringify({ accessToken: 'a-r9', refreshToken: 'r9', idToken: jwt({ extension_tmsguid: 'g' }), expiresAt: now + 3_600_000, tokenType: 'Bearer' })); // … while r9 landed
const c = await ask;
assert.equal(c.signedIn, true);
assert.equal(calls, 1);
assert.equal(JSON.parse(mem.get('lexy.session')!).refreshToken, 'r9');
console.log('2 stale rejection keeps the rotated session');

// 3. A real revocation signs out.
current = 'zz'; calls = 0;
mem.set('lexy.session', expired('r3'));
const d = await answer('session', [3, now], store, null, null);
console.log('3 revoked:', d.signedIn ? 'STILL SIGNED IN' : 'signed out', mem.has('lexy.session') ? 'KEPT' : 'forgotten');
assert.equal(d.signedIn, false);
assert.equal(mem.has('lexy.session'), false);

// 4. An empty build-time store must not bake a signed-out first frame.
const bakeStorage = { fs: { readFile: async (): Promise<never> => {
  throw Object.assign(new Error('storage is unavailable during bake'), { code: 'bake' });
} } } as any;
await assert.rejects(answer('session', [4, now], store, bakeStorage, null), { code: 'bake' });
const liveStorage = { fs: { readFile: async (): Promise<never> => {
  throw Object.assign(new Error('missing probe'), { code: 'ENOENT' });
} } } as any;
const empty = await answer('session', [5, now], store, liveStorage, null);
assert.equal(empty.signedIn, false);
assert.equal(empty.status, 401);
console.log('4 bake deferred; live empty session signed out');

// 5. Vehicle reads wait for the shared refresh, even when they are asked
// independently while the account resource is still resolving.
current = 'r10';
calls = 0;
vehicleAuthorizations.length = 0;
mem.set('lexy.session', expired('r10'));
const [refreshedAccount, refreshedGarage] = await Promise.all([
  answer('session', [6, now], store, null, null),
  answer('garage', [true, now - 1000, 0, now], store, null, null),
]);
assert.equal(refreshedAccount.signedIn, true);
assert.equal(refreshedGarage.car.vin, 'VIN1');
assert.equal(calls, 1);
assert.deepEqual(vehicleAuthorizations, ['Bearer a-r11']);
console.log('5 concurrent vehicle read waited for the one token refresh');

// 6. A token rejected before its expiry is refreshed once and the request is
// retried with the rotated token.
current = 'r11';
calls = 0;
vehicleAuthorizations.length = 0;
rejectFirstVehicleRead = true;
mem.set('lexy.session', JSON.stringify({ accessToken: 'a-stale', refreshToken: 'r11', idToken: jwt({ extension_tmsguid: 'g' }), expiresAt: now + 3_600_000, tokenType: 'Bearer' }));
const retriedGarage = await answer('garage', [true, now + 3_600_000, 1, now], store, null, null);
assert.equal(retriedGarage.car.vin, 'VIN1');
assert.equal(calls, 1);
assert.deepEqual(vehicleAuthorizations, ['Bearer a-stale', 'Bearer a-r12']);
console.log('6 a rejected access token refreshes once and retries the read');

// 7. An old refresh must not restore a session after sign-out.
current = 'r12';
mem.set('lexy.session', expired('r12'));
const signingOut = answer('session', [7, now], store, null, null);
await answer('signOut', [], store, null, null);
assert.equal((await signingOut).signedIn, false);
assert.equal(mem.has('lexy.session'), false);
console.log('7 an in-flight refresh cannot undo sign-out');

// 8. A successful old refresh must not overwrite a newer sign-in either.
current = 'r13';
mem.set('lexy.session', expired('r13'));
const signingIn = answer('session', [8, now], store, null, null);
const newSession = JSON.stringify({ accessToken: 'new-account', refreshToken: 'new-refresh', idToken: jwt({ extension_tmsguid: 'new-account' }), expiresAt: now + 3_600_000, tokenType: 'Bearer' });
mem.set('lexy.session', newSession);
assert.equal((await signingIn).signedIn, true);
assert.equal(mem.get('lexy.session'), newSession);
console.log('8 an in-flight refresh cannot overwrite a newer sign-in');
