// bun exact/lexy/auth.check.ts
import assert from 'node:assert/strict';
import { memoryStorage, memoryStore } from './check-support';
import { answer } from './app';

const store = memoryStore();
const { storage, database } = memoryStorage();
const requests: { url: string; init: RequestInit }[] = [];
const json = (body: unknown, status = 200, headers = {}): Response => new Response(JSON.stringify(body), { status, headers });
let respond = (_url: string, _init: RequestInit): Response => json({});
globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
  requests.push({ url: String(url), init });
  assert.equal(init.exactTimeout, 15000, 'identity exchanges bound headers and body');
  return respond(String(url), init);
}) as typeof fetch;

function node(type: string, output: unknown[] = []): object {
  return { authId: 'test-flow', callbacks: [{ type, output, input: [{ name: 'answer', value: '' }] }] };
}
const at = 1_790_900_000_000;
let verifier = '';
let challenge = '';
respond = (url: string, init: RequestInit): Response => {
  if (url.includes('/authorize')) {
    challenge = new URLSearchParams(String(init.body)).get('code_challenge') ?? '';
    return new Response(null, { status: 302, headers: { Location: 'com.toyota.oneapp:/oauth2Callback?code=test-code' } });
  }
  if (url.includes('/access_token')) {
    const body = new URLSearchParams(String(init.body));
    assert.equal(body.get('code'), 'test-code');
    verifier = body.get('code_verifier') ?? '';
    return json({ access_token: 'test-access', refresh_token: 'test-refresh', id_token: 'test-id', expires_in: 3600 });
  }
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
};
const started = await answer('authStart', [1, ''], store, storage, null);
assert(started.ok && started.attempt === 1);
const named = await answer('authAnswer', [1, '', started.raw, 'NameCallback', 'driver@example.com'], store, storage, null);
const passed = await answer('authAnswer', [1, '', named.raw, 'PasswordCallback', 'test-password'], store, storage, null);
assert.deepEqual(passed.choices, ['Email', 'SMS']);
const chose = await answer('authChoose', [1, '', passed.raw, 1], store, storage, null);
assert(chose.asksCode, 'OTP prompts are classified case-insensitively');
const verified = await answer('authAnswer', [1, '', chose.raw, 'TextInputCallback', '123456'], store, storage, null);
const finished = await answer('authFinish', [1, '', verified.tokenId, at], store, storage, null);
assert(finished.ok && finished.attempt === 1);
assert.equal(JSON.parse(store.get('lexy.session')!).accessToken, 'test-access');
assert.equal(challenge, Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url'));
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
  respond = (): Response => json(body);
  const result = await answer('authStart', [3, ''], store, storage, null);
  assert(!result.ok && result.status === 200, 'unsupported successful responses are protocol failures');
}
for (const status of [401, 429, 503]) {
  respond = (): Response => json({ message: 'Test rejection' }, status);
  const result = await answer('authStart', [4, ''], store, storage, null);
  assert(!result.ok && result.status === status);
}
respond = (): never => { throw new TypeError('Test connection timeout'); };
assert.equal((await answer('authStart', [5, ''], store, storage, null)).status, 0);

// A failed token exchange and a successful preview preserve the existing session
const saved = store.get('lexy.session');
respond = (url: string): Response => url.includes('/authorize')
  ? new Response(null, { status: 302, headers: { Location: 'com.toyota.oneapp:/oauth2Callback?code=test-code' } })
  : json({ access_token: 'incomplete' });
const incomplete = await answer('authFinish', [6, '', 'test-token', at], store, storage, null);
assert(!incomplete.ok && incomplete.status === 200, 'Incomplete tokens are a protocol failure, not an offline error');
respond = (): Response => new Response(null, { status: 302 });
const redirect = await answer('authFinish', [6, '', 'test-token', at], store, storage, null);
assert(!redirect.ok && redirect.status === 200, 'Missing redirects are a protocol failure');
assert.equal(store.get('lexy.session'), saved);
assert.equal((await answer('authFinish', [7, 'success-single', 'preview-token', at], store, storage, null)).ok, true);
assert.equal(store.get('lexy.session'), saved);
database.close();
console.log('PASS auth: callback validation, cookies, PKCE, deadlines, failures, and preview isolation');
