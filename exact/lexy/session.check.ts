// bun exact/lexy/session.check.ts
// Drives app.ts's session source against a fake rotating-token server.
import { strict as assert } from 'node:assert';
const L = import.meta.dir;
let current = 'r1', calls = 0, delay = 30;
let tokenFailure: { status: number; body: unknown } | null = null;
let omitIdToken = false;
const jwt = (o: object) => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
const vehicleAuthorizations: string[] = [];
let rejectFirstVehicleRead = false;
// The gateway accepts only the access token issued with the current refresh token
let requireCurrentToken = false;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.includes('access_token')) {
    calls++;
    if (tokenFailure) {
      return new Response(typeof tokenFailure.body === 'string' ? tokenFailure.body : JSON.stringify(tokenFailure.body), { status: tokenFailure.status });
    }
    const body = new URLSearchParams(String(init?.body ?? ''));
    await new Promise(r => setTimeout(r, delay));
    if (body.get('refresh_token') !== current) {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    const next = 'r' + (Number(current.slice(1)) + 1);
    current = next;
    return new Response(JSON.stringify({ access_token: 'a-' + next, refresh_token: next, ...(omitIdToken ? {} : { id_token: jwt({ extension_tmsguid: 'g' }) }), expires_in: 3600, token_type: 'Bearer' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('/vehicle/guid')) {
    vehicleAuthorizations.push((init?.headers as Record<string, string>).Authorization ?? '');
    const authorization = (init?.headers as Record<string, string>).Authorization ?? '';
    if (rejectFirstVehicleRead || (requireCurrentToken && authorization !== 'Bearer a-' + current)) {
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
const buildSession = await answer('session', [4, now], store, null, null);
assert.equal(buildSession.signedIn, false);
const liveStorage = { fs: { readFile: async (): Promise<never> => {
  throw Object.assign(new Error('missing probe'), { code: 'ENOENT' });
} } } as any;
const empty = await answer('session', [5, now], store, liveStorage, null);
assert.equal(empty.signedIn, false);
assert.equal(empty.status, 401);
console.log('4 bake deferred; live empty session signed out');

// 5. A vehicle read asked while the session refreshes waits for that refresh,
// and a vehicle read never starts one: only the session source writes the
// rotated token (see `refreshing` in app.ts).
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
mem.set('lexy.session', expired('r11'));
calls = 0;
const expiredGarage = await answer('garage', [true, now - 1000, 1, now], store, null, null);
assert.equal(calls, 0);
assert.equal(expiredGarage.car.vin, 'VIN1');
console.log('5 a vehicle read joins the session refresh and never starts one');

// 6. A token rejected before its expiry fails the read without a refresh; the
// next session answer refreshes it, and the read then succeeds.
current = 'r11';
calls = 0;
vehicleAuthorizations.length = 0;
rejectFirstVehicleRead = true;
mem.set('lexy.session', JSON.stringify({ accessToken: 'a-stale', refreshToken: 'r11', idToken: jwt({ extension_tmsguid: 'g' }), expiresAt: now + 3_600_000, tokenType: 'Bearer' }));
const rejectedGarage = await answer('garage', [true, now + 3_600_000, 1, now], store, null, null);
assert.equal(rejectedGarage.status, 401);
assert.equal(calls, 0);
const rerefreshed = await answer('session', [12, now], store, null, null);
assert.equal(rerefreshed.signedIn, true);
assert.equal(calls, 1);
const retriedGarage = await answer('garage', [true, rerefreshed.expiresAt, 1, now], store, null, null);
assert.equal(retriedGarage.car.vin, 'VIN1');
assert.deepEqual(vehicleAuthorizations, ['Bearer a-stale', 'Bearer a-r12']);
console.log('6 a rejected access token fails the read and the next session answer refreshes it');

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

// Only a confirmed refresh-token rejection can remove a saved session
for (const reply of [
  { status: 429, body: { error: 'slow_down' } },
  { status: 408, body: { error: 'request_timeout' } },
  { status: 403, body: { error: 'access_denied' } },
  { status: 401, body: { error: 'invalid_client' } },
  { status: 400, body: { error: 'invalid_request' } },
  { status: 400, body: '<html>Gateway unavailable</html>' },
  { status: 503, body: { error: 'invalid_grant' } },
]) {
  tokenFailure = reply;
  const saved = expired('r14');
  mem.set('lexy.session', saved);
  const account = await answer('session', [9, now], store, null, null);
  assert.equal(account.signedIn, true, `HTTP ${reply.status} is not a confirmed revocation`);
  assert.equal(account.status, reply.status);
  assert.equal(mem.get('lexy.session'), saved);
}
tokenFailure = null;
console.log('9 retryable and unclassified refresh failures preserve the session');

// A refresh can rotate its token without returning another ID token
current = 'r20';
omitIdToken = true;
mem.set('lexy.session', expired(current));
const resumed = await answer('session', [10, now], store, null, null);
assert.equal(resumed.signedIn, true);
assert.equal(resumed.error, '');
const rotated = JSON.parse(mem.get('lexy.session')!);
assert.equal(rotated.refreshToken, 'r21');
assert.equal(rotated.idToken, 'x');
const resumedAgain = await answer('session', [11, now + 3_600_001], store, null, null);
assert.equal(resumedAgain.signedIn, true);
assert.equal(resumedAgain.error, '');
assert.equal(JSON.parse(mem.get('lexy.session')!).refreshToken, 'r22');
console.log('10 omitted ID tokens do not lose a rotated refresh token');

// 11. Exact lets go an answer whose resource it asks again, and rejects the
// fetches that answer made; the rejection runs between answers, where store
// reads are empty and writes throw (exact2 js/src/prelude.js `__exact_forget`,
// js/src/door.rs). A refresh so cut off is not a sign-out.
let betweenAnswers = false;
const answerStore = {
  get: (k: string) => (betweenAnswers ? null : mem.get(k) ?? null),
  set: (k: string, v: string) => {
    if (betweenAnswers) throw new Error('store.set: no store');
    mem.set(k, v);
  },
  forget: (k: string) => {
    if (betweenAnswers) throw new Error('store.forget: no store');
    mem.delete(k);
  },
} as any;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (String(url).includes('access_token')) {
    calls++;
    await new Promise(r => setTimeout(r, delay));
    betweenAnswers = true;
    throw Object.assign(new Error('the answer was let go before this reply; the request may already have been sent'), { kind: 'Aborted' });
  }
  return realFetch(url, init);
}) as any;
omitIdToken = false;
current = 'r30';
calls = 0;
const kept = expired('r30');
mem.set('lexy.session', kept);
const [cutOff, cutOffGarage] = await Promise.all([
  answer('session', [13, now], answerStore, null, null),
  answer('garage', [true, now - 1000, 3, now], answerStore, null, null),
]);
betweenAnswers = false;
assert.equal(calls, 1);
assert.equal(cutOff.signedIn, true, 'a refresh let go signed the user out');
assert.notEqual(cutOff.status, 401);
assert.notEqual(cutOffGarage.status, 401, 'a read waiting on a refresh let go reported a sign-out');
assert.equal(mem.get('lexy.session'), kept);
console.log('11 a refresh let go between answers keeps the session');
globalThis.fetch = realFetch;
