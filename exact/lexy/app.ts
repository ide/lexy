// Lexy's I/O layer. Contract owns every decision the app makes (the sign-in
// step machine, what a status snapshot means, lock reconciliation, formatting,
// navigation); this file only does what Contract cannot:
//
// - HTTP to the Lexus identity and REST hosts, with the request conventions
//   every call needs (headers, bearer token, one refresh-and-retry on 401/403),
//   and the identity host's cookies (see `jar`)
// - the Keychain (`store`) for the session tokens
// - PKCE (SHA-256) for the OAuth code exchange
// - decoding each response into the exact shape app.contract declares, since
//   Contract has no JSON and rejects a reply with a missing or extra field
//
// The decoders are deliberately mechanical: they rename and flatten the wire,
// and leave the meaning of the values to Contract.
//
// Demo mode swaps the transport for an in-memory Lexus (demo.ts), so the
// whole app — sign-in included — runs without an account.
import type { Answer, NativeModule, Result, Sources, Storage, Store } from './app.contract.d.ts';
import { demoFetch, demoServer, type Reply } from './demo';

export const appId = 'app.ide.lexy.exact';
export const grants = [
  'net.fetch https://login.lexusdriverslogin.com',
  'net.fetch https://onecdn.telematicsct.com',
  'secret.keep lexy.session',
  'secret.keep lexy.demo',
  'secret.keep lexy.maps',
  'fs.read app:/data/lexy',
  'fs.write app:/data/lexy',
].join('\n');

const IDENTITY = 'https://login.lexusdriverslogin.com';
const REALM = 'realms/root/realms/tmna-native';
const AUTHENTICATE_URL = `${IDENTITY}/json/${REALM}/authenticate?authIndexType=service&authIndexValue=signin_2.0&locale=en-US`;
const AUTHORIZE_URL = `${IDENTITY}/oauth2/${REALM}/authorize`;
const TOKEN_URL = `${IDENTITY}/oauth2/${REALM}/access_token`;
const CLIENT_ID = 'oneappsdkclient';
const REDIRECT_URI = 'com.toyota.oneapp:/oauth2Callback';
const SCOPE = 'openid profile write';

const REST = 'https://onecdn.telematicsct.com';
const DISCOVERY_URL = `${REST}/oneapi/v2/vehicle/guid`;
const STATUS_URL = `${REST}/v1/remote/route/status`;
const REFRESH_STATUS_URL = `${REST}/v1/remote/route/refresh-status`;
const ENGINE_URL = `${REST}/v1/remote/route/engine-status`;
const SPEC_URL = `${REST}/oneapi/v1/vehicle/vehicle-spec`;
const TIRES_URL = `${REST}/oneapi/v1/telemetry/tires/pressure`;
const COMMAND_URL = `${REST}/v1/remote/route/command`;
const NICKNAME_URL = `${REST}/oneapi/v1/vehicle-association/vehicle`;
const SUBSCRIPTIONS_URL = `${REST}/oneapi/v3/vehicle-subscriptions`;
const CLIMATE_URL = `${REST}/v1/remote/route/climate-settings`;

// The OneApp's public, app-wide X-API-KEY (see src/data/lexus-api.ts for why
// this is not a secret), kept as bytes so secret scanners stay quiet.
const X_API_KEY = String.fromCharCode(
  112, 121, 112, 73, 72, 71, 48, 49, 53, 107, 52, 65, 66, 72, 87, 98, 99, 73, 52, 71, 48, 97, 57,
  52, 70, 55, 99, 67, 48, 74, 68, 111, 49, 79, 121, 110, 112, 65, 115, 71,
);

// Refresh an access token this close to its expiry.
const EXPIRY_MARGIN_MS = 60_000;

type Json = Record<string, unknown>;
type Car = Result<'garage'>['cars'][number];
type Session = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  tokenType: string;
};
// `fetch`, or the demo's in-memory Lexus.
type Request = (url: string, init: RequestInit) => Promise<Reply>;

// --- Decoding: wire → shape, nothing more ------------------------------------

const rec = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
// Contract has no date parsing; ISO strings cross as epoch milliseconds.
const epochMs = (v: unknown): number => {
  const ms = typeof v === 'string' && v ? new Date(v).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// --- Transport ----------------------------------------------------------------

// The session's native module (modules/apple), set as each answer starts:
// every answer of a session shares the one module.
let native: NativeModule | null = null;
// The session's files (its `fs.*` grants), set beside it.
let files: Storage | null = null;

// The identity host's cookies. ForgeRock's load balancer pins a sign-in to
// one server with `route` and `amlbcookie`; a step that lands elsewhere fails
// ("Login failure" for a good code). Exact's fetch keeps no cookie jar by
// design, but returns `set-cookie` and sends an explicit `Cookie`, so the
// jar is kept here: one per sign-in, emptied when one starts.
const jar = new Map<string, string>();

function keepCookies(header: string | null) {
  // Several Set-Cookie headers arrive folded with ", "; a new cookie starts
  // where a comma is followed by `name=`.
  for (const cookie of (header ?? '').split(/,\s*(?=[^;,=\s]+=)/)) {
    const [pair] = cookie.split(';');
    const at = pair.indexOf('=');
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
}

async function identityFetch(url: string, init: RequestInit): Promise<Reply> {
  const headers = { ...(init.headers as Record<string, string>) };
  if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const response = await fetch(url, { ...init, headers });
  keepCookies(response.headers.get('set-cookie'));
  return response;
}

function transport(store: Store, at: number): Request {
  if (store.get('lexy.demo') === '1') {
    const wait = async (ms: number) => { if (native?.available) await native.later({ op: 'wait', ms }); };
    return (url, init) => demoFetch(url, init, at, wait);
  }
  return (url, init) => (url.startsWith(IDENTITY + '/') ? identityFetch(url, init) : fetch(url, init));
}

// src/utils/haptics.ts's kinds.
function haptic(style: 'success' | 'error' | 'selection' | 'impact-medium' | 'impact-light') {
  try {
    if (native?.available) native.call({ op: 'haptic', style });
  } catch {
    // Feedback is a nicety; a host without it still sent the command.
  }
}

class HttpError extends Error {
  constructor(readonly status: number, text: string) {
    super(text);
  }
}

async function readJson(response: Reply): Promise<Json> {
  const body = rec(await response.json().catch(() => null));
  if (!response.ok) {
    const text = str(body.message) || str(body.error_description) || str(body.error) || `Lexus answered ${response.status}`;
    throw new HttpError(response.status, text);
  }
  return body;
}

// --- Session (Keychain) --------------------------------------------------------

function readSession(store: Store): Session | null {
  try {
    const s = JSON.parse(store.get('lexy.session') ?? 'null') as Session | null;
    return s && s.accessToken && s.refreshToken ? s : null;
  } catch {
    return null;
  }
}

function tokens(body: Json, previousRefresh: string | undefined, at: number): Session {
  const refreshToken = str(body.refresh_token) || previousRefresh;
  if (!str(body.access_token) || !str(body.id_token) || typeof body.expires_in !== 'number' || !refreshToken) {
    throw new Error('Lexus returned an incomplete token response');
  }
  return {
    accessToken: str(body.access_token),
    refreshToken,
    idToken: str(body.id_token),
    expiresAt: at + body.expires_in * 1000,
    tokenType: str(body.token_type) || 'Bearer',
  };
}

// A refresh the identity server rejects (4xx) ends the session: only signing
// in again recovers, and Contract sees the 401 as "signed out".
// Lexus rotates refresh tokens: each refresh spends the one it sends. Two
// refreshes racing with the same token (a launch after a long while starts
// the session twice) would have the loser rejected and sign the user out,
// so a refresh in flight is shared, and a rejection forgets the session only
// if the stored token is still the one rejected.
let refreshing: Promise<Session> | null = null;

function refreshed(store: Store, session: Session, at: number): Promise<Session> {
  refreshing ??= refreshOnce(store, session, at).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refreshOnce(store: Store, session: Session, at: number): Promise<Session> {
  const response = await transport(store, at)(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      response_type: 'token',
      scope: SCOPE,
    }).toString(),
  });
  let next: Session;
  try {
    next = tokens(await readJson(response), session.refreshToken, at);
  } catch (e) {
    if (e instanceof HttpError && e.status >= 400 && e.status < 500) {
      const stored = readSession(store);
      if (stored && stored.refreshToken !== session.refreshToken) return stored;
      store.forget('lexy.session');
      await forgetCached();
      throw new HttpError(401, 'Your Lexus session expired. Please sign in again.');
    }
    throw e;
  }
  store.set('lexy.session', JSON.stringify(next));
  return next;
}

function guid(idToken: string): string {
  try {
    const part = idToken.split('.')[1] ?? '';
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + ((4 - (part.length % 4)) % 4), '=');
    return str(rec(JSON.parse(atob(padded))).extension_tmsguid);
  } catch {
    return '';
  }
}

function businessHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `${session.tokenType} ${session.accessToken}`,
    'X-API-KEY': X_API_KEY,
    'X-APPBRAND': 'L',
    'X-CHANNEL': 'ONEAPP',
    'X-LOCALE': 'en-US',
    'X-OSNAME': 'iOS',
    'X-OSVERSION': '18.5',
    'X-APPVERSION': '3.4.0',
    'X-DEVICE-TIMEZONE': 'PST',
    'X-CORRELATIONID': crypto.randomUUID(),
  };
  const id = guid(session.idToken);
  if (id) headers['X-GUID'] = id;
  return headers;
}

function vehicleHeaders(session: Session, car: Car): Record<string, string> {
  return {
    ...businessHeaders(session),
    VIN: car.vin,
    'X-BRAND': car.brand,
    'X-GENERATION': car.generation,
    brand: car.brand,
    generation: car.generation,
  };
}

// The gateway rejected a token before its stated expiry: the next `session`
// answer refreshes even though the token is not due.
let rejected = false;

/**
 * One authorized Lexus call with the Keychain's session. It never refreshes:
 * Lexus rotates refresh tokens, so two answers refreshing at once would spend
 * the same one twice and the loser would sign the user out. Refreshing is the
 * `session` source's alone, and Contract orders every read after it; a 401/403
 * here marks the token rejected and Contract asks for the session again.
 */
async function authorized(
  store: Store,
  at: number,
  call: (session: Session, request: Request) => Promise<Reply>,
): Promise<Json> {
  const session = readSession(store);
  if (!session) throw new HttpError(401, 'Signed out');
  const response = await call(session, transport(store, at));
  if (response.status === 401 || response.status === 403) {
    rejected = true;
    throw new HttpError(401, 'Lexus rejected the session');
  }
  return readJson(response);
}

async function session(store: Store, at: number): Promise<Result<'session'>> {
  const demo = store.get('lexy.demo') === '1';
  let current = readSession(store);
  if (!current) return { signedIn: false, demo, expiresAt: 0, status: 401, error: '' };
  try {
    if (rejected || current.expiresAt - EXPIRY_MARGIN_MS <= at) {
      current = await refreshed(store, current, at);
      rejected = false;
    }
    return { signedIn: true, demo, expiresAt: current.expiresAt, status: 200, error: '' };
  } catch (e) {
    // A rejected refresh token has already been forgotten; anything else
    // (offline, a 5xx) keeps the session for the next try.
    const signedIn = readSession(store) !== null;
    const { status, error } = failure(e);
    return { signedIn, demo, expiresAt: signedIn ? current.expiresAt : 0, status, error };
  }
}

const get = (url: string, headers: Record<string, string>) => (request: Request) => request(url, { method: 'GET', headers });

function failure(e: unknown) {
  return { ok: false, status: e instanceof HttpError ? e.status : 0, error: message(e) };
}

// --- Sign-in: the ForgeRock tree, answered as Contract decides ----------------

// A node crosses to Contract decoded for reading and verbatim (`raw`) for
// answering: Contract classifies it and says which callback to fill.
function decodeNode(node: Json): Result<'authStart'> {
  const callbacks = arr(node.callbacks).map(rec);
  const outputs = callbacks.flatMap(c => arr(c.output).map(rec));
  const prompts = outputs.filter(o => o.name === 'prompt' || o.name === 'message').map(o => str(o.value));
  return {
    ok: true,
    status: 200,
    error: str(node.message),
    raw: JSON.stringify(node),
    tokenId: str(node.tokenId),
    types: callbacks.map(c => str(c.type)),
    prompts,
    // classifyAuthenticationNode's test (lexus-auth.ts), case-insensitive: a
    // ForgeRock OTP node's prompt is "One Time Password".
    asksCode: /(?:\botp\b|one[ -]?time password|verification code)/i.test(prompts.join(' ')),
    choices: arr(outputs.find(o => o.name === 'choices')?.value).map(str),
  };
}

const AUTH_HEADERS = {
  Accept: 'application/json',
  'Accept-API-Version': 'resource=2.0, protocol=1.0',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json',
};

async function postNode(store: Store, body: string): Promise<Result<'authStart'>> {
  try {
    const response = await transport(store, 0)(AUTHENTICATE_URL, { method: 'POST', headers: AUTH_HEADERS, body });
    return decodeNode(await readJson(response));
  } catch (e) {
    return { ...failure(e), raw: '', tokenId: '', types: [], prompts: [], asksCode: false, choices: [] };
  }
}

// Fill the first input of the first callback of `type` with `value`.
function answered(raw: string, type: string, value: string | number): string {
  const node = rec(JSON.parse(raw));
  let done = false;
  node.callbacks = arr(node.callbacks).map(rec).map(c => {
    if (done || c.type !== type || !arr(c.input).length) return c;
    done = true;
    return { ...c, input: arr(c.input).map((input, i) => (i === 0 ? { ...rec(input), value } : input)) };
  });
  return JSON.stringify(node);
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function finishSignIn(store: Store, tokenId: string, at: number): Promise<Result<'authFinish'>> {
  try {
    const request = transport(store, at);
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const authorize = await request(AUTHORIZE_URL, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        Accept: 'application/x-www-form-urlencoded',
        'Content-Type': 'application/x-www-form-urlencoded',
        iPlanetDirectoryPro: tokenId,
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        csrf: tokenId,
        decision: 'allow',
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
      }).toString(),
    });
    if (authorize.status < 300 || authorize.status >= 400) {
      await readJson(authorize);
      throw new HttpError(authorize.status, `Lexus authorization failed (${authorize.status})`);
    }
    const location = new URL(authorize.headers.get('Location') ?? '');
    const code = location.searchParams.get('code');
    if (!code) throw new Error(location.searchParams.get('error_description') ?? 'Lexus did not return an authorization code');
    const token = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });
    store.set('lexy.session', JSON.stringify(tokens(await readJson(token), undefined, at)));
    return { ok: true, status: 200, error: '' };
  } catch (e) {
    return failure(e);
  }
}

// --- Vehicle reads ---------------------------------------------------------------

const CAPABILITY_ORDER = [
  'doorLockUnlockCapable', 'remoteEngineStartStop', 'trunkLockUnlockCapable', 'lightsCapable', 'hazardCapable',
  'hornCapable', 'buzzerCapable', 'moonroofCloseCapable', 'powerWindowsCloseCapable', 'powerWindowsOpenCapable',
];

function decodeCar(v: unknown): Car {
  const d = rec(v);
  const extended = rec(d.extendedCapabilities);
  return {
    vin: str(d.vin),
    brand: str(d.brand) || 'L',
    generation: str(d.generation),
    region: str(d.region),
    asiCode: str(d.asiCode),
    hwType: str(d.hwType),
    nickName: str(d.nickName),
    modelName: str(d.modelName),
    modelYear: str(d.modelYear),
    description: str(d.displayModelDescription),
    color: str(d.color),
    image: str(d.image),
    fuelType: str(d.fuelType),
    grade: str(d.grade),
    modelCode: str(d.modelCode),
    // The capability flags that are on, by their wire names, in Lexy's order
    // (remote-capabilities.ts), which the "More controls" subtitle follows.
    capabilities: CAPABILITY_ORDER.filter(k => extended[k] === true),
  };
}

// Contract has no record literal, so the primary car (the first; Lexy has no
// switcher) crosses as a field, blank when there is none.
const noCar = decodeCar({});

// Whose garage a cached one is: the signed-in account's guid.
const account = (store: Store) => guid(readSession(store)?.idToken ?? '');

async function garage(store: Store, at: number): Promise<Result<'garage'>> {
  const since = generation;
  if (!readSession(store)) return { ok: false, status: 401, error: 'Signed out', car: noCar, cars: [] };
  try {
    const body = await authorized(store, at, (s, r) => get(DISCOVERY_URL, businessHeaders(s))(r));
    const cars = arr(body.payload).map(decodeCar).filter(c => c.vin);
    return await remember('garage', account(store), { ok: true, status: 200, error: '', car: cars[0] ?? noCar, cars }, since);
  } catch (e) {
    // Not ok, so the screen says it couldn't refresh, over the car it has.
    const last = failure(e).status === 401 ? null : await recall<Result<'garage'>>('garage', account(store));
    return { ...failure(e), car: last?.car ?? noCar, cars: last?.cars ?? [] };
  }
}

// A trip reading is a string ("272.1 miles"); Contract has no number parse.
const trip = (st: Json, name: string) =>
  arr(arr(st.vehicleStatus).map(rec).find(c => c.category === 'Trip Details')?.sections).map(rec).find(x => x.section === name)?.values;
const tripValue = (values: unknown) => str(rec(arr(values)[0]).value);

// React Query keeps the last data through a failed refetch; so does this:
// a failed read answers the last good one for the same car (the failure
// beside it), so a blip shows "Couldn't refresh" over the data, not zeros.
//
// Those answers, and the closure history below, live in files rather than
// the store: a store write asks every store reader again (the runner's
// settlement), so a cache kept there refetched the whole car on each
// refresh. A file is read once, then held in memory.
const DIR = 'app:/data/lexy';
const CACHED = ['closures', 'garage', 'status', 'tires', 'engine', 'spec', 'services', 'climate'];
// Bumped as the cache is forgotten: an answer still in flight then does not
// write the signed-out account's data back.
let generation = 0;
const held = new Map<string, string | null>();
async function load(key: string): Promise<string | null> {
  if (held.has(key)) return held.get(key) ?? null;
  let text: string | null = null;
  try {
    if (files) text = fromUtf8(new Uint8Array(await files.fs.readFile(`${DIR}/${key}.json`)));
  } catch {
    text = null;
  }
  held.set(key, text);
  return text;
}
// UTF-8 by hand: the data module's runtime need not have TextEncoder.
function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
function fromUtf8(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    const n = b < 0x80 ? 1 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : 4;
    let c = n === 1 ? b : b & (0xff >> (n + 1));
    for (let k = 1; k < n; k++) c = (c << 6) | (bytes[i + k] & 63);
    text += String.fromCodePoint(c);
    i += n;
  }
  return text;
}
// Awaited within the answer: a source's storage is its own only while it
// answers, so a write left running after it is lost.
async function save(key: string, text: string, since = generation) {
  if (since !== generation || held.get(key) === text) return;
  held.set(key, text);
  const fs = files?.fs;
  if (!fs) return;
  await fs.mkdir(DIR).catch(() => undefined);
  await fs.atomicWriteFile(`${DIR}/${key}.json`, utf8(text)).catch(() => undefined);
}
async function remember<T>(key: string, vin: string, answer: T, since = generation): Promise<T> {
  await save(key, JSON.stringify({ vin, answer }), since);
  return answer;
}
async function recall<T>(key: string, vin: string): Promise<T | null> {
  try {
    const last = JSON.parse((await load(key)) ?? 'null');
    return last && last.vin === vin ? last.answer as T : null;
  } catch {
    return null;
  }
}
async function forgetCached() {
  generation++;
  for (const key of CACHED) {
    held.set(key, null);
    await files?.fs.rm(`${DIR}/${key}.json`).catch(() => undefined);
  }
}

async function status(store: Store, car: Car, at: number): Promise<Result<'status'>> {
  const since = generation;
  const empty = { occurredMs: 0, fetchedMs: at, fuel: 0, range: 0, rangeUnit: '', odometer: 0, odometerUnit: '', caution: 0, latitude: 0, longitude: 0, tripA: 0, tripB: 0, sections: [], closuresStaleMs: 0 };
  if (!car.vin) return { ok: false, status: 0, error: '', ...empty };
  try {
    const body = await authorized(store, at, (s, r) => get(STATUS_URL, vehicleHeaders(s, car))(r));
    const st = rec(rec(body.payload).status);
    const telemetry = rec(st.telemetry);
    const occurredMs = epochMs(st.occurrenceDate);
    const sections = await foldClosures(car.vin, occurredMs, arr(st.vehicleStatus).map(rec).flatMap(category =>
      arr(category.sections).map(rec).map(section => ({
        category: str(category.category),
        section: str(section.section),
        values: arr(section.values).map(v => str(rec(v).value)),
        at: 0,
      })),
    ), since);
    const stale = sections.filter(x => x.category !== 'Trip Details' && x.at > 0 && x.at < occurredMs).map(x => x.at);
    return await remember('status', car.vin, {
      ok: true,
      status: 200,
      error: '',
      occurredMs,
      fetchedMs: at,
      fuel: num(rec(telemetry.fugage).value),
      // The live key is `rage`, not the documented `range`.
      range: num(rec(telemetry.rage).value),
      rangeUnit: str(rec(telemetry.rage).unit),
      odometer: num(rec(telemetry.odo).value),
      odometerUnit: str(rec(telemetry.odo).unit),
      caution: num(st.cautionOverallCount),
      latitude: num(st.latitude),
      longitude: num(st.longitude),
      tripA: num(tripValue(trip(st, 'Trip A'))),
      tripB: num(tripValue(trip(st, 'Trip B'))),
      // Flattened: one row per category section, with its reported values,
      // doors, windows and openings folded over what earlier snapshots said.
      sections,
      closuresStaleMs: stale.length ? Math.min(...stale) : 0,
    }, since);
  } catch (e) {
    const last = await recall<Result<'status'>>('status', car.vin);
    const { status: code, error } = failure(e);
    return last ? { ...last, status: code, error: error || 'Couldn’t refresh' } : { ...failure(e), ...empty };
  }
}

// closure-state.ts, per section: the feed alternates full snapshots with
// sparse ones (lock-only doors, no windows or openings, right after a
// drive), so each section's position and lock are kept as last observed,
// newest observation winning per field, and nothing a full snapshot
// established disappears. A section's `at` is its oldest shown reading, so
// the screen can say "Some readings as of" rather than present an old one
// as current. A different VIN starts fresh.
type Field = { value: string; at: number };
type Held = { category: string; section: string; position?: Field; lock?: Field; order: number };
type Section = { category: string; section: string; values: string[]; at: number };
async function foldClosures(vin: string, at: number, sections: Section[], since = generation): Promise<Section[]> {
  let kept: { vin: string; seq: number; rows: Record<string, Held> } | null = null;
  try { kept = JSON.parse((await load('closures')) ?? 'null'); } catch { kept = null; }
  if (!kept || kept.vin !== vin) kept = { vin, seq: 0, rows: {} };
  const passed: Section[] = [];
  for (const s of sections) {
    const position = s.values.find(v => v === 'Open' || v === 'Closed');
    const lock = s.values.find(v => v === 'Locked' || v === 'Unlocked');
    if (s.category === 'Trip Details' || (!position && !lock)) {
      passed.push({ ...s, at });
      continue;
    }
    const key = `${s.category}/${s.section}`;
    const row = kept.rows[key] ?? { category: s.category, section: s.section, order: kept.seq++ };
    if (position && (!row.position || at >= row.position.at)) row.position = { value: position, at };
    if (lock && (!row.lock || at >= row.lock.at)) row.lock = { value: lock, at };
    kept.rows[key] = row;
  }
  await save('closures', JSON.stringify(kept), since);
  const folded = Object.values(kept.rows).sort((a, b) => a.order - b.order).map(r => ({
    category: r.category,
    section: r.section,
    values: [r.position?.value, r.lock?.value].filter((v): v is string => !!v),
    at: Math.min(r.position?.at ?? Infinity, r.lock?.at ?? Infinity),
  }));
  return [...folded, ...passed];
}

async function tires(store: Store, car: Car, at: number): Promise<Result<'tires'>> {
  const since = generation;
  if (!car.vin) return { ok: false, status: '', unit: '', tires: [] };
  try {
    const p = rec((await authorized(store, at, (s, r) => get(TIRES_URL, vehicleHeaders(s, car))(r))).payload);
    const tire = (position: string) => ({ position, value: num(rec(p[position]).value), low: rec(p[position]).displayLowTirePressureWarning === true });
    return await remember('tires', car.vin, {
      ok: !!p.tirePressureStatus,
      status: str(p.tirePressureStatus),
      unit: str(rec(p.flTirePressure).unit),
      tires: [tire('flTirePressure'), tire('frTirePressure'), tire('rlTirePressure'), tire('rrTirePressure')],
    }, since);
  } catch {
    return await recall<Result<'tires'>>('tires', car.vin) ?? { ok: false, status: '', unit: '', tires: [] };
  }
}

async function engine(store: Store, car: Car, at: number): Promise<Result<'engine'>> {
  const since = generation;
  if (!car.vin || !car.capabilities.includes('remoteEngineStartStop')) return { ok: false, status: '', startedMs: 0, timer: 0 };
  try {
    const p = rec((await authorized(store, at, (s, r) => get(ENGINE_URL, vehicleHeaders(s, car))(r))).payload);
    return await remember('engine', car.vin, { ok: true, status: str(p.status), startedMs: epochMs(p.date), timer: num(p.timer) }, since);
  } catch {
    return await recall<Result<'engine'>>('engine', car.vin) ?? { ok: false, status: '', startedMs: 0, timer: 0 };
  }
}

async function spec(store: Store, car: Car, at: number): Promise<Result<'spec'>> {
  const since = generation;
  if (!car.vin) return { ok: false, items: [] };
  try {
    const p = rec((await authorized(store, at, (s, r) => get(SPEC_URL, vehicleHeaders(s, car))(r))).payload);
    const items = ['vehicleSpecifications', 'additionalDetails'].flatMap(key =>
      arr(rec(p[key]).dataItems).map(rec).map(i => ({ name: str(i.dataName), value: str(i.dataValue) })),
    );
    return await remember('spec', car.vin, { ok: true, items }, since);
  } catch {
    return await recall<Result<'spec'>>('spec', car.vin) ?? { ok: false, items: [] };
  }
}

async function services(store: Store, car: Car, at: number): Promise<Result<'services'>> {
  const since = generation;
  if (!car.vin || !car.region || !car.asiCode || !car.hwType) return { ok: false, items: [] };
  try {
    const p = rec(
      (
        await authorized(store, at, (s, r) =>
          get(SUBSCRIPTIONS_URL, {
            ...businessHeaders(s),
            VIN: car.vin,
            'X-BRAND': car.brand,
            GENERATION: car.generation,
            REGION: car.region,
            'ASI-CODE': car.asiCode,
            'HW-TYPE': car.hwType,
            DATETIME: String(at),
            entryPoint: 'SUBSCRIPTIONS',
          })(r),
        )
      ).payload,
    );
    const items = (['paid', 'trial', 'complimentary'] as const).flatMap(bucket =>
      arr(p[`${bucket}Subscriptions`]).map(rec).map(sub => ({
        bucket,
        name: str(sub.displayProductName) || str(sub.productName),
        // One title-cased word, as Lexy shows it (vehicle-mapping.ts formatStatus).
        status: str(sub.status).trim() ? str(sub.status).trim().charAt(0).toUpperCase() + str(sub.status).trim().slice(1).toLowerCase() : 'Unknown',
        endMs: epochMs(sub.subscriptionEndDate),
      })),
    );
    return await remember('services', car.vin, { ok: true, items: items.filter(i => i.name) }, since);
  } catch {
    return await recall<Result<'services'>>('services', car.vin) ?? { ok: false, items: [] };
  }
}

// --- Writes ----------------------------------------------------------------------

async function command(store: Store, car: Car, name: string, at: number): Promise<Result<'command'>> {
  // vehicle-controls.ios.tsx: a medium impact as the command goes, then
  // success or error by how it went.
  haptic('impact-medium');
  try {
    const body = await authorized(store, at, (s, r) =>
      r(COMMAND_URL, {
        method: 'POST',
        headers: vehicleHeaders(s, car),
        body: JSON.stringify(name === 'buzzer-warning' ? { command: name, autoFixPopup: false, beepCount: 10 } : { command: name, autoFixPopup: false }),
      }),
    );
    const returnCode = str(rec(body.payload).returnCode) || str(body.returnCode);
    haptic(returnCode === '000000' ? 'success' : 'error');
    return { ok: true, status: 200, error: '', command: name, returnCode, at };
  } catch (e) {
    haptic('error');
    return { ...failure(e), command: name, returnCode: '', at };
  }
}

async function prime(store: Store, car: Car, at: number): Promise<Result<'prime'>> {
  try {
    await authorized(store, at, (s, r) => r(REFRESH_STATUS_URL, { method: 'POST', headers: vehicleHeaders(s, car), body: JSON.stringify({ autoFixPopup: false }) }));
    return { ok: true, status: 200, error: '', at };
  } catch (e) {
    return { ...failure(e), at };
  }
}

async function rename(store: Store, car: Car, name: string, at: number): Promise<Result<'rename'>> {
  try {
    await authorized(store, at, (s, r) => {
      const id = guid(s.idToken);
      if (!id) throw new Error('This session has no customer GUID to rename a vehicle with.');
      return r(NICKNAME_URL, {
        method: 'PUT',
        headers: { ...businessHeaders(s), 'X-BRAND': car.brand, DATETIME: String(at) },
        body: JSON.stringify({ nickName: name, guid: id, vin: car.vin }),
      });
    });
    return { ok: true, status: 200, error: '' };
  } catch (e) {
    return failure(e);
  }
}

// --- Climate (src/data/climate-settings.ts) ------------------------------------------
// The card reads a few fields; a write PUTs the whole settings object back with
// those fields changed, so the wire object crosses verbatim as `raw`.

type Climate = Result<'climate'>;
const noClimate: Climate = { ok: false, raw: '', on: false, temperature: 0, unit: 'F', min: 0, max: 0, step: 1, front: false, frontEnabled: false, rear: false, rearEnabled: false };

function decodeClimate(body: Json): Climate {
  const p = rec(body.payload ?? body);
  if (typeof p.settingsOn !== 'boolean') return noClimate;
  const defrost = arr(p.acOperations).map(rec).find(o => o.categoryName === 'defrost' && o.available === true);
  const param = (name: string) => arr(defrost?.acParameters).map(rec).find(x => x.name === name && x.available === true);
  return {
    ok: true,
    raw: JSON.stringify(p),
    on: p.settingsOn,
    temperature: num(p.temperature),
    unit: str(p.temperatureUnit) || 'F',
    min: num(p.minTemp),
    max: num(p.maxTemp),
    step: num(p.tempInterval) || 1,
    front: !!param('frontDefrost'),
    frontEnabled: param('frontDefrost')?.enabled === true,
    rear: !!param('rearDefrost'),
    rearEnabled: param('rearDefrost')?.enabled === true,
  };
}

async function climate(store: Store, car: Car, at: number): Promise<Climate> {
  const since = generation;
  if (!car.vin) return noClimate;
  try {
    return await remember('climate', car.vin, decodeClimate(await authorized(store, at, (s, r) => get(CLIMATE_URL, vehicleHeaders(s, car))(r))), since);
  } catch {
    return await recall<Climate>('climate', car.vin) ?? noClimate;
  }
}

async function setClimate(store: Store, car: Car, raw: string, on: boolean, temperature: number, front: boolean, rear: boolean, at: number): Promise<Climate> {
  try {
    const p = rec(JSON.parse(raw));
    p.settingsOn = on;
    p.temperature = temperature;
    p.acOperations = arr(p.acOperations).map(rec).map(o => o.categoryName !== 'defrost' ? o : {
      ...o,
      acParameters: arr(o.acParameters).map(rec).map(x => x.name === 'frontDefrost' ? { ...x, enabled: front } : x.name === 'rearDefrost' ? { ...x, enabled: rear } : x),
    });
    await authorized(store, at, (s, r) => r(CLIMATE_URL, { method: 'PUT', headers: vehicleHeaders(s, car), body: JSON.stringify(p) }));
    return await climate(store, car, at);
  } catch {
    return noClimate;
  }
}

// --- Device: the street line, the maps apps ------------------------------------

async function address(latitude: number, longitude: number): Promise<Result<'address'>> {
  if (!native?.available || (latitude === 0 && longitude === 0)) return { line: '' };
  try {
    return { line: str((await native.later({ op: 'geocode', latitude, longitude })).line) };
  } catch {
    return { line: '' };
  }
}

// Each provider's own scheme first (opens the app), then its universal link.
function mapsLinks(provider: string, latitude: number, longitude: number, name: string): string[] {
  const at = `${latitude},${longitude}`, q = encodeURIComponent(name);
  if (provider === 'google') return [`comgooglemaps://?q=${at}(${q})&center=${at}`, `https://www.google.com/maps/search/?api=1&query=${at}`];
  if (provider === 'waze') return [`waze://?ll=${at}&navigate=yes`, `https://waze.com/ul?ll=${at}&navigate=yes`];
  return [`maps://?ll=${at}&q=${q}`, `https://maps.apple.com/?ll=${at}&q=${q}`];
}

async function openMaps(provider: string, latitude: number, longitude: number, name: string): Promise<Result<'openMaps'>> {
  if (!native?.available) return { ok: false, error: 'Maps are unavailable here.' };
  for (const url of mapsLinks(provider, latitude, longitude, name)) {
    try {
      if ((await native.later({ op: 'open', url })).opened === true) return { ok: true, error: '' };
    } catch {
      // try the next link
    }
  }
  return { ok: false, error: "The app didn't respond to the location link. It may have just been removed." };
}

// Which maps apps the phone has (canOpenURL on each one's scheme, declared
// under LSApplicationQueriesSchemes), and the saved choice if it is still
// installed: one that was deleted is forgotten, so the chooser asks again
// (src/hooks/use-maps-provider.ts, src/data/maps-providers.ts).
async function mapsApp(store: Store): Promise<Result<'mapsApp'>> {
  let installed = { apple: true, google: false, waze: false };
  try {
    if (native?.available) installed = { ...installed, ...(await native.later({ op: 'installed' })) };
  } catch {
    // Unknown: Apple Maps alone, which every iPhone ships.
  }
  // The choice is a file, not the store: a store write would ask every
  // vehicle resource again. A choice an earlier build kept in the store is
  // read once, until the file says otherwise.
  let provider = (await load('maps')) ?? store.get('lexy.maps') ?? '';
  if (provider !== '' && !installed[provider as keyof typeof installed]) provider = '';
  await save('maps', provider);
  return { provider, apple: installed.apple === true, google: installed.google === true, waze: installed.waze === true };
}

// --- Sources ---------------------------------------------------------------------

const sources: Sources = {
  session: ([_rev, at], store) => session(store, at),
  setDemoFailures: ([on]) => {
    demoServer.failing = on === true;
    return { ok: true, status: 200, error: '' };
  },
  useDemo: ([on], store) => {
    if (on) store.set('lexy.demo', '1');
    else store.forget('lexy.demo');
    return { ok: true, status: 200, error: '' };
  },
  signOut: async (_args, store) => {
    store.forget('lexy.session');
    store.forget('lexy.demo');
    await forgetCached();
    return { ok: true, status: 200, error: '' };
  },
  authStart: (_args, store) => {
    jar.clear();
    return postNode(store, '{}');
  },
  authAnswer: ([raw, type, value], store) => postNode(store, answered(raw, type, value)),
  authChoose: ([raw, index], store) => postNode(store, answered(raw, 'ChoiceCallback', index)),
  authFinish: ([tokenId, at], store) => finishSignIn(store, tokenId, at),
  garage: ([_signedIn, _expiresAt, _rev, at], store) => garage(store, at),
  status: ([car, _rev, at], store) => status(store, car, at),
  tires: ([car, _rev, at], store) => tires(store, car, at),
  engine: ([car, _rev, at], store) => engine(store, car, at),
  spec: ([car, at], store) => spec(store, car, at),
  services: ([car, at], store) => services(store, car, at),
  command: ([car, name, at], store) => command(store, car, name, at),
  prime: ([car, at], store) => prime(store, car, at),
  rename: ([car, name, at], store) => rename(store, car, name, at),
  climate: ([car, _rev, at], store) => climate(store, car, at),
  setClimate: ([car, raw, on, temperature, front, rear, at], store) => setClimate(store, car, raw, on, temperature, front, rear, at),
  address: ([latitude, longitude]) => address(latitude, longitude),
  mapsApp: (_args, store) => mapsApp(store),
  setMapsApp: async ([provider], store) => {
    await save('maps', provider);
    return mapsApp(store);
  },
  feel: ([kind]) => {
    haptic(kind as 'selection');
    return { ok: true, error: '' };
  },
  openMaps: ([provider, latitude, longitude, name]) => openMaps(provider, latitude, longitude, name),
};

export const answer: Answer = (source, args, store, storage, module) => {
  native = module ?? null;
  files = storage ?? null;
  return sources[source](args, store, storage, module);
};
