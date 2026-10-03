// An in-memory Lexus: the identity tree and the REST plane, answering the same
// wire shapes the real hosts do (modelled on src/auth/preview-lexus-backend.ts
// and the fixtures in src/data/vehicle-mapping.test.ts). app.ts routes every
// request here in demo mode, so the decoders and all of Contract run unchanged.
//
// The fake car acts on commands a few seconds after accepting them, so the
// app's lock reconciliation has something to wait for.
//
// Sign-in: any email and password sign straight in (the demo is one tap);
// the password "wrong" is rejected. The choice and code nodes stay for a
// drive that answers them.

export type Reply = {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

// How long the demo car takes to act on an accepted command (start, stop,
// lock, unlock). A climate setting persists within its round trip.
const ACT_AFTER_MS = 3000;
// Every call to the vehicle plane takes a second, as the real one does: an
// instant answer made "Refreshing…" a flicker. Sign-in stays quick (the demo
// is one tap).
const ROUND_TRIP_MS = 1000;

const reply = (status: number, body: unknown, location?: string): Reply => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: name => (name.toLowerCase() === 'location' ? location ?? null : null) },
  json: () => Promise.resolve(body),
});

type Car = {
  locked: boolean;
  trunkOpen: boolean;
  engineSince: number;
  nickName: string;
  pending: { command: string; at: number }[];
  // When the car last reported (the snapshot's occurrenceDate): a minute and
  // a half before the first read, then whenever it acts on a command or is
  // asked to report. A read never moves it, as a real car's doesn't.
  reportedAt: number;
};

const car: Car = { locked: true, trunkOpen: false, engineSince: 0, nickName: 'IS 350', pending: [], reportedAt: 0 };

function settle(at: number) {
  const due = car.pending.filter(p => p.at + ACT_AFTER_MS <= at);
  car.pending = car.pending.filter(p => p.at + ACT_AFTER_MS > at);
  for (const { command, at: sent } of due) {
    if (command === 'door-lock') car.locked = true;
    if (command === 'door-unlock') car.locked = false;
    if (command === 'trunk-unlock') car.trunkOpen = true;
    if (command === 'trunk-lock') car.trunkOpen = false;
    if (command === 'engine-start') car.engineSince = sent + ACT_AFTER_MS;
    if (command === 'engine-stop') car.engineSince = 0;
    car.reportedAt = Math.max(car.reportedAt, sent + ACT_AFTER_MS);
  }
}

// A read while a command is in flight answers once the command has acted,
// as a car reporting back would: the app re-reads status as soon as the
// command is accepted (stamped with that moment), so its pending label
// lasts ACT_AFTER_MS, not until its next 5 s tick.
async function untilDue(at: number, wait: Wait): Promise<number> {
  if (car.pending.length === 0) return at;
  const due = Math.max(...car.pending.map(p => p.at + ACT_AFTER_MS));
  if (due > at) await wait(due - at);
  return Math.max(at, due);
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const b64url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// --- Identity ----------------------------------------------------------------

const prompt = (value: string) => ({ name: 'prompt', value });
const nodes: Record<string, unknown> = {
  username: { authId: 'demo-username', callbacks: [{ type: 'NameCallback', output: [prompt('User Name')], input: [{ name: 'IDToken1', value: '' }] }] },
  password: { authId: 'demo-password', callbacks: [{ type: 'PasswordCallback', output: [prompt('Password')], input: [{ name: 'IDToken1', value: '' }] }] },
  choice: {
    authId: 'demo-choice',
    callbacks: [{
      type: 'ChoiceCallback',
      output: [prompt('How would you like to receive your code?'), { name: 'choices', value: ['Email', 'Text message'] }, { name: 'defaultChoice', value: 0 }],
      input: [{ name: 'IDToken1', value: 0 }],
    }],
  },
  otp: {
    authId: 'demo-otp',
    callbacks: [{ type: 'TextInputCallback', output: [prompt('Enter the verification code we sent you.'), { name: 'value', value: '' }], input: [{ name: 'IDToken1', value: '' }] }],
  },
};

function authenticate(posted: Record<string, any>): Reply {
  const answer = posted.callbacks?.[0]?.input?.[0]?.value;
  switch (posted.authId) {
    case 'demo-username':
      return reply(200, nodes.password);
    case 'demo-password':
      return answer === 'wrong'
        ? reply(401, { message: 'The email or password you entered is incorrect.' })
        : reply(200, { tokenId: 'demo-sso-token' });
    case 'demo-choice':
      return reply(200, nodes.otp);
    case 'demo-otp':
      return answer === '000000'
        ? reply(401, { message: 'That verification code is incorrect or has expired.' })
        : reply(200, { tokenId: 'demo-sso-token' });
    default:
      return reply(200, nodes.username);
  }
}

const idToken = `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify({ extension_tmsguid: 'demo-guid' }))}.`;
const tokens = { access_token: 'demo-access', refresh_token: 'demo-refresh', id_token: idToken, token_type: 'Bearer', expires_in: 3600 };

// --- The car -------------------------------------------------------------------

const VIN = 'DEMO0000000000000';
const discovery = () => ({
  payload: [{
    vin: VIN, brand: 'L', generation: '21MM', region: 'US', asiCode: 'JG', hwType: '211',
    nickName: car.nickName, modelName: 'IS 350', modelYear: '2026', displayModelDescription: '2026 Lexus IS 350 F SPORT',
    color: 'Cloudburst Grey', fuelType: 'G', grade: 'F SPORT', modelCode: '9510',
    image: 'https://delivery.vcr.assetscs.toyota.com/adobe/assets/urn:aaid:aem:06327492-1484-4909-af33-b7c14b21edda/as/image.png?size=700,700',
    extendedCapabilities: {
      doorLockUnlockCapable: true, remoteEngineStartStop: true, trunkLockUnlockCapable: true,
      hornCapable: true, buzzerCapable: true, hazardCapable: true, lightsCapable: true,
    },
  }],
});

const v = (value: string) => ({ value, status: 0 });
function status(at: number) {
  settle(at);
  if (car.reportedAt === 0) car.reportedAt = at - 90_000;
  const lock = v(car.locked ? 'Locked' : 'Unlocked');
  return {
    payload: {
      status: {
        occurrenceDate: iso(car.reportedAt),
        cautionOverallCount: 0,
        latitude: 37.334606,
        longitude: -122.009102,
        telemetry: { fugage: { value: 62, unit: '%' }, rage: { value: 214, unit: 'Mile' }, odo: { value: 12482, unit: 'Mile' } },
        vehicleStatus: [
          { category: 'Driver Side', sections: [
            { section: 'Door', values: [v('Closed'), lock] },
            { section: 'Rear Door', values: [v('Closed'), lock] },
            { section: 'Window', values: [v('Closed')] },
            { section: 'Rear Window', values: [v('Closed')] },
          ] },
          { category: 'Passenger Side', sections: [
            { section: 'Door', values: [v('Closed'), lock] },
            { section: 'Rear Door', values: [v('Closed'), lock] },
            { section: 'Window', values: [v('Open')] },
            { section: 'Rear Window', values: [v('Closed')] },
          ] },
          { category: 'Other', sections: [
            { section: 'Moonroof', values: [v('Closed')] },
            { section: 'Trunk', values: [v(car.trunkOpen ? 'Open' : 'Closed')] },
            { section: 'Hood', values: [v('Closed')] },
          ] },
          { category: 'Trip Details', sections: [
            { section: 'Trip A', values: [v('272.1 miles')] },
            { section: 'Trip B', values: [v('735.1 miles')] },
          ] },
        ],
      },
    },
  };
}

const pressure = (value: number) => ({ value, unit: 'psi', displayLowTirePressureWarning: value < 33 });
const tires = { payload: { tirePressureStatus: 'Normal', flTirePressure: pressure(36), frTirePressure: pressure(36), rlTirePressure: pressure(35), rrTirePressure: pressure(32) } };

const spec = {
  payload: {
    vehicleSpecifications: { dataItems: [
      { dataName: 'Transmission', dataValue: '8-Speed Automatic' },
      { dataName: 'Drive Type', dataValue: 'RWD' },
      { dataName: 'Grade', dataValue: 'F SPORT' },
    ] },
    additionalDetails: { dataItems: [
      { dataName: 'Date of First Use', dataValue: 'April 1, 2026' },
      { dataName: 'Order Date', dataValue: '03/2026' },
    ] },
  },
};

const climate = {
  settingsOn: true, temperature: 72, temperatureUnit: 'F', minTemp: 65, maxTemp: 85, tempInterval: 1,
  acOperations: [{ categoryName: 'defrost', categoryDisplayName: 'Defrost', available: true, acParameters: [
    { name: 'frontDefrost', displayName: 'Front Defrost', iconUrl: null, available: true, enabled: false },
    { name: 'rearDefrost', displayName: 'Rear Defrost', iconUrl: null, available: true, enabled: false },
  ] }],
} as Record<string, unknown>;

const subscriptions = {
  payload: {
    paidSubscriptions: [{ displayProductName: 'Remote Connect', status: 'ACTIVE', subscriptionEndDate: '2028-04-01' }],
    trialSubscriptions: [{ displayProductName: 'Drive Connect', status: 'ACTIVE', subscriptionEndDate: '2027-04-01' }],
    complimentarySubscriptions: [{ displayProductName: 'Service Connect', status: 'ACTIVE', subscriptionEndDate: '2036-04-01' }],
  },
};

// A wait the host keeps (TypeScript sources have no timers): the native
// module's `wait`, or none where there is no module.
export type Wait = (ms: number) => Promise<void>;

// Settings → Simulate Server Errors: every write (a command, a climate
// setting, a name) fails as a 500 does, after its usual latency, so the app's
// error paths and the state it restores can be tried. Reads still answer.
export const demoServer = { failing: false };
const failure = () => reply(500, { message: 'The demo server is simulating an error.' });

export async function demoFetch(url: string, init: RequestInit, at: number, wait: Wait): Promise<Reply> {
  const path = new URL(url).pathname;
  const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : {};
  if (path.endsWith('/authenticate')) return authenticate(body);
  if (path.endsWith('/authorize')) return reply(302, '', 'com.toyota.oneapp:/oauth2Callback?code=demo-code');
  if (path.endsWith('/access_token')) return reply(200, tokens);
  await wait(ROUND_TRIP_MS);
  at += ROUND_TRIP_MS;
  if (path === '/oneapi/v2/vehicle/guid') return reply(200, discovery());
  if (path === '/v1/remote/route/status') {
    const ready = await untilDue(at, wait);
    return reply(200, status(ready));
  }
  if (path === '/v1/remote/route/refresh-status') {
    car.reportedAt = Math.max(car.reportedAt, at);
    return reply(200, { payload: { returnCode: '000000' } });
  }
  if (path === '/v1/remote/route/engine-status') {
    at = await untilDue(at, wait);
    settle(at);
    return reply(200, { payload: { vin: VIN, status: car.engineSince ? '1' : '0', date: car.engineSince ? iso(car.engineSince) : '', timer: 20 } });
  }
  if (path === '/oneapi/v1/telemetry/tires/pressure') return reply(200, tires);
  if (path === '/oneapi/v1/vehicle/vehicle-spec') return reply(200, spec);
  if (path === '/oneapi/v3/vehicle-subscriptions') return reply(200, subscriptions);
  if (path === '/v1/remote/route/climate-settings') {
    if (init.method === 'PUT') {
      if (demoServer.failing) return failure();
      Object.assign(climate, body);
    }
    return reply(200, { payload: climate });
  }
  if (path === '/v1/remote/route/command') {
    if (demoServer.failing) return failure();
    car.pending.push({ command: String(body.command), at });
    return reply(200, { payload: { returnCode: '000000' } });
  }
  if (path === '/oneapi/v1/vehicle-association/vehicle') {
    if (demoServer.failing) return failure();
    car.nickName = String(body.nickName);
    return reply(200, { payload: {} });
  }
  return reply(404, { message: `The demo has no ${path}` });
}

// --- Login Flow preview ----------------------------------------------------------

// Settings → Developer Tools → Login Flow: the real sign-in screen and the
// real step machine against a mock tree, never the Keychain (the session
// stays as it is). Each scenario steers where the walk succeeds or fails,
// as src/auth/preview-lexus-backend.ts does for the Expo app. Stateless: the
// step rides in the node's authId, as ForgeRock threads its own.
export const PREVIEW_SCENARIOS = ['success-multi', 'success-single', 'wrong-password', 'wrong-code', 'network-error'] as const;
export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number];

const previewNode = (step: keyof typeof nodes) => ({ ...(nodes[step] as Record<string, unknown>), authId: `preview-${step}` });

function previewAuthenticate(posted: Record<string, any>, scenario: PreviewScenario): Reply {
  switch (Array.isArray(posted.callbacks) ? posted.authId : 'start') {
    case 'preview-username':
      return reply(200, previewNode('password'));
    case 'preview-password':
      if (scenario === 'wrong-password') return reply(401, { message: 'The email or password you entered is incorrect.' });
      return reply(200, previewNode(scenario === 'success-single' ? 'otp' : 'choice'));
    case 'preview-choice':
      return reply(200, previewNode('otp'));
    case 'preview-otp':
      if (scenario === 'wrong-code') return reply(401, { message: 'That verification code is incorrect or has expired.' });
      return reply(200, { tokenId: 'preview-sso-token' });
    default:
      return reply(200, previewNode('username'));
  }
}

// A beat of latency, so the busy labels ("Signing In…") show as they would.
const PREVIEW_LATENCY_MS = 350;

export async function previewFetch(scenario: PreviewScenario, url: string, init: RequestInit, wait: Wait): Promise<Reply> {
  await wait(PREVIEW_LATENCY_MS);
  // Before any endpoint answers, so the failure surfaces where an outage's would.
  if (scenario === 'network-error') throw new TypeError('The Internet connection appears to be offline.');
  const path = new URL(url).pathname;
  const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : {};
  if (path.endsWith('/authenticate')) return previewAuthenticate(body, scenario);
  if (path.endsWith('/authorize')) return reply(302, '', 'com.toyota.oneapp:/oauth2Callback?code=preview-code');
  if (path.endsWith('/access_token')) return reply(200, tokens);
  return reply(404, { message: `The preview has no ${path}` });
}
