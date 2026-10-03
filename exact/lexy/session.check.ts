// bun exact/lexy/session.check.ts
// Drives app.ts's session source against a fake rotating-token server.
const L = import.meta.dir;
let current = 'r1', calls = 0, delay = 30;
const jwt = (o: object) => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes('access_token')) throw new Error('unexpected ' + u);
  calls++;
  const body = new URLSearchParams(String(init?.body ?? ''));
  await new Promise(r => setTimeout(r, delay));
  if (body.get('refresh_token') !== current) {
    return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const next = 'r' + (Number(current.slice(1)) + 1);
  current = next;
  return new Response(JSON.stringify({ access_token: 'a-' + next, refresh_token: next, id_token: jwt({ extension_tmsguid: 'g' }), expires_in: 3600, token_type: 'Bearer' }), { status: 200, headers: { 'content-type': 'application/json' } });
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

// 2. A refresh rejected because another already rotated the token keeps the session.
calls = 0;
mem.set('lexy.session', expired('r1'));           // the ask still holds r1 …
const ask = answer('session', [2, now], store, null, null);
mem.set('lexy.session', JSON.stringify({ ...JSON.parse(expired('r9')), expiresAt: now + 3_600_000 })); // … while r9 landed
const c = await ask;
console.log('2 stale rejection:', c.signedIn ? 'still signed in' : 'SIGNED OUT', 'stored', mem.has('lexy.session') ? JSON.parse(mem.get('lexy.session')!).refreshToken : 'none');

// 3. A real revocation signs out.
current = 'zz'; calls = 0;
mem.set('lexy.session', expired('r3'));
const d = await answer('session', [3, now], store, null, null);
console.log('3 revoked:', d.signedIn ? 'STILL SIGNED IN' : 'signed out', mem.has('lexy.session') ? 'KEPT' : 'forgotten');
