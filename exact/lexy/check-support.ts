import { Database } from 'bun:sqlite';
import type { Answer, Database as Connection, SQLCommand, SQLExecution, SQLRows, SQLValue, Storage, Store } from './app.contract.d.ts';

export function memoryStorage(options: {
  files?: Map<string, Uint8Array>;
  beforeWrite?: (commands: SQLCommand[]) => Promise<void>;
  afterQuery?: (sql: string, params: SQLValue[]) => void;
} = {}): { storage: Storage; database: Database } {
  const database = new Database(':memory:', { safeIntegers: true });
  const files = options.files ?? new Map<string, Uint8Array>();

  function run(sql: string, params: SQLValue[] = []): SQLExecution {
    const result = database.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: BigInt(result.lastInsertRowid) };
  }

  function query(sql: string, params: SQLValue[] = []): SQLRows {
    const statement = database.prepare(sql);
    return { columns: statement.columnNames, rows: statement.values(...params) as SQLValue[][] };
  }

  const storage = {
    fs: {
      readdir: async (path: string): Promise<string[]> => [...files.keys()]
        .filter(key => key.startsWith(path + '/')).map(key => key.slice(path.length + 1)),
      readFile: async (path: string): Promise<ArrayBuffer> => {
        const bytes = files.get(path);
        if (!bytes) {
          throw new Error('ENOENT');
        }
        return bytes.slice().buffer;
      },
      rm: async (path: string): Promise<void> => {
        for (const key of files.keys()) {
          if (key === path || key.startsWith(path + '/')) {
            files.delete(key);
          }
        }
      },
    } as Storage['fs'],
    sqlite: {
      open: async (_path: string): Promise<Connection> => ({
        execute: async (sql: string, params?: SQLValue[]): Promise<SQLExecution> => {
          await options.beforeWrite?.([{ sql, params }]);
          return run(sql, params);
        },
        query: async (sql: string, params: SQLValue[] = []): Promise<SQLRows> => {
          const result = query(sql, params);
          options.afterQuery?.(sql, params);
          return result;
        },
        transaction: async (commands: SQLCommand[]): Promise<SQLExecution[]> => {
          await options.beforeWrite?.(commands);
          return database.transaction((): SQLExecution[] => commands.map(command => run(command.sql, command.params)))();
        },
        // Keep the in-memory database alive between the app's connections
        close: async (): Promise<void> => {},
      } as Connection),
    },
  } satisfies Storage;
  return { storage, database };
}

export function memoryStore(): Store {
  const values = new Map<string, string>();
  return {
    get: (key: string): string | null => values.get(key) ?? null,
    set: (key: string, value: string): void => { values.set(key, value); },
    forget: (key: string): void => { values.delete(key); },
  } as Store;
}

const ISSUER = 'https://login.lexusdriverslogin.com/oauth2/realms/root/realms/tmna-native';
const jwt = (claims: object): string => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const reply = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', Date: new Date().toUTCString(), ...headers } });

/**
 * A Lexus realm as Lexy and @exact/oauth meet it (exact2's PROVIDERS.md FR-1
 * to FR-3): the sign-in tree (`tree`, one step that ends in an SSO token
 * unless a check replaces it), discovery, the authorization POST with the SSO
 * token, the code exchange, refreshes that rotate the refresh token and carry
 * a new ID token, as Lexus's do, and revocation. Every other request goes to
 * `rest`, the check's own Lexus, which it may replace. Install `fetch` as the
 * global one; `realm` says what it saw (discovery, each authorization POST,
 * code exchange and refresh) and steers its next refresh's reply.
 */
export function lexusRealm(rest: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const realm = {
    rest,
    tree: (_url: string, _init: RequestInit): Response | Promise<Response> => reply(200, { tokenId: 'sso-token' }),
    discovered: 0,
    refreshed: [] as URLSearchParams[],
    // Each token request's `exactTimeout`, by its grant
    deadlines: [] as [string, unknown][],
    refresh: '',
    refreshes: 0,
    revoked: [] as string[],
    authorized: [] as { form: URLSearchParams; headers: Headers }[],
    exchanged: [] as URLSearchParams[],
    // The next refresh's reply instead of a new token: a status and body, or `throw` for no reply
    next: null as null | { status: number; body: unknown } | 'throw' | (() => Promise<Response>),
    // The next refresh, held from its arrival (`entered`) until `released`, then answered as any other
    hold: null as null | { entered: () => void; released: Promise<void> },
    nonce: '',
    fetch: async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
      const url = String(input), form = new URLSearchParams(typeof init.body === 'string' ? init.body : '');
      if (url.includes('/json/realms/root/realms/tmna-native/authenticate')) return realm.tree(url, init);
      if (!url.startsWith(ISSUER)) return realm.rest(url, init);
      if (url.endsWith('/.well-known/openid-configuration')) {
        realm.discovered++;
        return reply(200, { issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/access_token`, revocation_endpoint: `${ISSUER}/token/revoke` });
      }
      if (url.endsWith('/authorize')) {
        realm.authorized.push({ form, headers: new Headers(init.headers) });
        realm.nonce = form.get('nonce') ?? '';
        const back = new URL(form.get('redirect_uri') ?? '');
        back.searchParams.set('code', 'test-code');
        back.searchParams.set('state', form.get('state') ?? '');
        return new Response(null, { status: 302, headers: { Location: back.toString() } });
      }
      if (url.endsWith('/token/revoke')) {
        realm.revoked.push(form.get('token') ?? '');
        return new Response(null, { status: 200 });
      }
      if (form.has('grant_type')) realm.deadlines.push([form.get('grant_type') ?? '', (init as { exactTimeout?: number }).exactTimeout]);
      if (form.get('grant_type') === 'refresh_token') {
        realm.refreshes++;
        realm.refreshed.push(form);
        const hold = realm.hold;
        realm.hold = null;
        if (hold) {
          hold.entered();
          await hold.released;
        }
        const next = realm.next;
        realm.next = null;
        if (next === 'throw') throw Object.assign(new Error('no reply'), { kind: 'Network' });
        if (typeof next === 'function') return next();
        if (next) return reply(next.status, next.body);
        if (form.get('refresh_token') !== realm.refresh) return reply(400, { error: 'invalid_grant' });
      } else {
        realm.exchanged.push(form);
      }
      const n = Number(realm.refresh.slice(1) || 0) + 1;
      realm.refresh = `r${n}`;
      const now = Math.floor(Date.now() / 1000);
      // The exchange's ID token carries the request's nonce; a refresh's, none
      const nonce = form.get('grant_type') === 'authorization_code' ? { nonce: realm.nonce } : {};
      const idToken = jwt({ iss: ISSUER, sub: 'user-1', aud: 'oneappsdkclient', iat: now, exp: now + 3600, ...nonce, extension_tmsguid: 'g' });
      return reply(200, { access_token: `a-r${n}`, refresh_token: realm.refresh, token_type: 'Bearer', expires_in: 3600, id_token: idToken });
    },
  };
  return realm;
}

/**
 * Lexus's vehicle gateway for `lexusRealm`'s `rest`: each read answers one
 * car, and refuses with `refusal` (403, as Lexus's gateway refuses a lapsed
 * token, FR-4, and sometimes 401) an access token in `expired`, or every one
 * while `refuseAll`. `reads` keeps each read's headers.
 */
export function gateway() {
  const g = {
    expired: new Set<string>(),
    refuseAll: false,
    refusal: 403,
    reads: [] as Headers[],
    answer: async (_url: string, init: RequestInit): Promise<Response> => {
      const headers = new Headers(init.headers);
      g.reads.push(headers);
      if (g.refuseAll || g.expired.has(headers.get('Authorization') ?? '')) return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: g.refusal });
      return new Response(JSON.stringify({ payload: [{ vin: 'VIN1' }] }), { status: 200 });
    },
  };
  return g;
}

/** A session made as the app makes one, with `lexusRealm`'s fetch installed: the tree, then the authorization step with its SSO token, then the exchange. */
export async function signIn(answer: Answer, store: Store, storage: Storage, at = Date.now()): Promise<void> {
  const tree = await answer('authStart', [1, ''], store, storage, null);
  const done = await answer('authFinish', [1, '', at], store, storage, null);
  if (!done.ok) throw new Error(`sign-in failed: ${done.error}`);
}
