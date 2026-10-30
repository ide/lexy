// bun exact/lexy/auth.check.ts
import assert from 'node:assert/strict';
import { lexusRealm, memoryStorage, memoryStore } from './check-support';

const store = memoryStore();
const { storage, database } = memoryStorage();
const requests: { url: string; init: RequestInit }[] = [];
const json = (body: unknown, status = 200, headers = {}): Response => new Response(JSON.stringify(body), { status, headers });

function node(type: string, output: unknown[] = []): object {
  return { authId: 'test-flow', callbacks: [{ type, output, input: [{ name: 'answer', value: '' }] }] };
}
const at = 1_790_900_000_000;
// The sign-in tree, answered step by step
function tree(_url: string, init: RequestInit): Response {
  const body = JSON.parse(String(init.body));
  const callback = body.callbacks?.[0];
  if (!callback) {
    assert.equal((init.headers as Record<string, string>).Cookie, undefined, 'new attempts clear the cookie jar');
    return json(node('NameCallback'), 200, { 'set-cookie': 'route=test; HttpOnly' });
  }
  assert.equal((init.headers as Record<string, string>).Cookie, 'route=test', 'later steps keep server affinity');
  if (callback.type === 'NameCallback') {
    assert.equal(callback.input[0].value, 'driver@example.com');
    return json(node('PasswordCallback'));
  }
  if (callback.type === 'PasswordCallback') {
    assert.equal(callback.input[0].value, 'test-password');
    return json(node('ChoiceCallback', [{ name: 'choices', value: ['Email', 'SMS'] }]));
  }
  if (callback.type === 'ChoiceCallback') {
    assert.equal(callback.input[0].value, 1);
    return json(node('TextInputCallback', [{ name: 'prompt', value: 'One Time Password' }]));
  }
  assert.equal(callback.input[0].value, '123456');
  return json({ tokenId: 'test-token' });
}
const realm = lexusRealm((): Response => json({}));
realm.tree = tree;
// A reply that stands in for the realm's, for the failures below
let instead = (_url: string, _init: RequestInit): Response | null => null;
globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
  requests.push({ url: String(url), init });
  // The tree's steps and the authorization POST wait 15 s; the token endpoint's requests keep the package's deadline
  const token = /\/(access_token|token\/revoke)$/.test(String(url));
  assert.equal(init.exactTimeout, token ? 60_000 : 15000, 'identity exchanges bound headers and body');
  return instead(String(url), init) ?? realm.fetch(url, init);
}) as typeof fetch;
const { answer } = await import('./app');

const started = await answer('authStart', [1, ''], store, storage, null);
assert(started.ok && started.attempt === 1);
const named = await answer('authAnswer', [1, '', started.raw, 'NameCallback', 'driver@example.com'], store, storage, null);
const passed = await answer('authAnswer', [1, '', named.raw, 'PasswordCallback', 'test-password'], store, storage, null);
assert.deepEqual(passed.choices, ['Email', 'SMS']);
const chose = await answer('authChoose', [1, '', passed.raw, 1], store, storage, null);
assert(chose.asksCode, 'OTP prompts are classified case-insensitively');
const verified = await answer('authAnswer', [1, '', chose.raw, 'TextInputCallback', '123456'], store, storage, null);
// The SSO token stays in app.ts: Contract hears only that the tree is done
assert.equal(verified.done, true);
assert.equal(JSON.stringify(verified).includes('test-token'), false, 'the SSO token reached an answer');
const finished = await answer('authFinish', [1, '', at], store, storage, null);
assert(finished.ok && finished.attempt === 1, finished.error);
assert.equal((await answer('session', [at], store, storage, null)).signedIn, true);
// The SSO token goes in the authorization POST ForgeRock takes, consent given (FR-2)
const [{ form: authorized, headers: authorizedHeaders }] = realm.authorized;
const verifier = realm.exchanged[0].get('code_verifier') ?? '';
assert.equal(realm.exchanged[0].get('code'), 'test-code');
assert.equal(authorizedHeaders.get('iPlanetDirectoryPro'), 'test-token');
assert.equal(authorized.get('csrf'), 'test-token');
assert.equal(authorized.get('decision'), 'allow');
assert.deepEqual([authorized.get('client_id'), authorized.get('redirect_uri'), authorized.get('scope'), authorized.get('response_type')], ['oneappsdkclient', 'com.toyota.oneapp:/oauth2Callback', 'openid profile write', 'code']);
assert.equal(authorized.get('code_challenge_method'), 'S256');
assert.equal(authorized.get('code_challenge'), Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url'));
assert(verifier.length >= 43, 'PKCE uses a fresh full-length verifier');
assert.equal((await answer('authStart', [2, ''], store, storage, null)).ok, true, 'A new attempt starts without the old cookies');

const beforeInvalid = requests.length;
for (const raw of ['{', '{}', JSON.stringify(node('NameCallback')), JSON.stringify({ callbacks: [{ type: 'PasswordCallback', input: [{}] }] })]) {
  const result = await answer('authAnswer', [2, '', raw, 'PasswordCallback', 'test-password'], store, storage, null);
  assert(!result.ok && result.attempt === 2 && result.status === 200, 'malformed or mismatched callbacks return a protocol failure');
}
for (const index of [-1, 2, 0.5]) {
  assert.equal((await answer('authChoose', [2, '', passed.raw, index], store, storage, null)).ok, false);
}
assert.equal(requests.length, beforeInvalid, 'invalid answers never post unchanged callbacks');
for (const body of [{}, { callbacks: [{ type: 'UnknownCallback' }] }, node('ChoiceCallback', [{ name: 'choices', value: [''] }])]) {
  realm.tree = (): Response => json(body);
  const result = await answer('authStart', [3, ''], store, storage, null);
  assert(!result.ok && result.status === 200, 'unsupported successful responses are protocol failures');
}
for (const status of [401, 429, 503]) {
  realm.tree = (): Response => json({ message: 'Test rejection' }, status);
  const result = await answer('authStart', [4, ''], store, storage, null);
  assert(!result.ok && result.status === status);
}
realm.tree = (): never => { throw new TypeError('Test connection timeout'); };
assert.equal((await answer('authStart', [5, ''], store, storage, null)).status, 0);
// An authorization step whose tree is not this attempt's sends nothing
realm.tree = (): Response => json({ tokenId: 'test-token' });
await answer('authStart', [5, ''], store, storage, null);
const stale = await answer('authFinish', [4, '', at], store, storage, null);
assert.deepEqual([stale.ok, realm.authorized.length], [false, 1]);
// and leaves the attempt's own step to it
const own = await answer('authFinish', [5, '', at], store, storage, null);
assert.deepEqual([own.ok, realm.authorized.length], [true, 2]);

// A failed authorization step or token exchange, and a successful preview,
// keep the existing session; each failure's status words the sign-in screen's notice
const saved = store.get('lexy.lexus');
// Each through a tree of its own, which ends at once
const finish = async (): Promise<{ ok: boolean; status: number }> => {
  const done = await answer('authStart', [6, ''], store, storage, null);
  return answer('authFinish', [6, '', at], store, storage, null);
};
instead = (url: string): Response | null => url.endsWith('/access_token')
  ? json({ access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'Bearer', expires_in: 3600 })
  : null;
const incomplete = await finish();
assert(!incomplete.ok && incomplete.status === 200, 'Initial sign-in requires its own ID token even when a session is saved');
instead = (url: string): Response | null => url.endsWith('/access_token') ? json({ error: 'invalid_grant' }, 400) : null;
assert.equal((await finish()).status, 400, 'A refused code reads as Lexus refusing the sign-in');
instead = (url: string): Response | null => url.endsWith('/authorize') ? new Response(null, { status: 302 }) : null;
const redirect = await finish();
assert(!redirect.ok && redirect.status === 200, 'Missing redirects are a protocol failure');
for (const status of [401, 429, 503]) {
  instead = (url: string): Response | null => url.endsWith('/authorize') ? json({ message: 'Test rejection' }, status) : null;
  assert.equal((await finish()).status, status, 'An authorization step that fails says its status');
}
instead = (url: string): never | null => { if (url.endsWith('/authorize')) throw new TypeError('Test connection timeout'); return null; };
assert.equal((await finish()).status, 0, 'An authorization step with no reply reads as Lexus unreachable');
instead = (): null => null;
assert.equal(store.get('lexy.lexus'), saved);
// The Login Flow preview's tree: a name, a password, a code. It signs in on a store of its own, so it keeps no
// session and logs nothing.
const logged = async (): Promise<number> => ((await answer('sessionLog', [200, 1], store, storage, null)) as { events: unknown[] }).events.length;
const loggedBefore = await logged();
const step = (n: { raw: string }, type: string, value: string) => answer('authAnswer', [7, 'success-single', n.raw, type, value], store, storage, null);
const previewed = await step(await step(await step(await answer('authStart', [7, 'success-single'], store, storage, null), 'NameCallback', 'driver@example.com'), 'PasswordCallback', 'pw'), 'TextInputCallback', '123456');
assert.equal((await answer('authFinish', [7, 'success-single', at], store, storage, null)).ok, true);
assert.equal(store.get('lexy.lexus'), saved);
assert.equal(store.get('lexy.preview'), null, 'the preview kept a session');
// The package logs a sign-in once its token's print is made
await Bun.sleep(50);
assert.equal(await logged(), loggedBefore, 'the preview logged an event');
database.close();
console.log('PASS auth: callback validation, cookies, the authorization POST, PKCE, deadlines, failures, and preview isolation');
