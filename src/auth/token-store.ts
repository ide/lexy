import type { LexusSession } from '@/auth/lexus-auth';

const accounts = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  idToken: 'id-token',
} as const;

const KEYCHAIN_SERVICE = 'app.ide.lexy';

// The access token, its type, and its expiry are written and refreshed as a unit,
// so they share one Keychain entry: a partial write can never leave the token
// paired with a stale type or expiry. The refresh and ID tokens have their own
// lifecycles and stay in separate entries.
type StoredAccessToken = {
  value: string;
  type: string;
  expiresAt: number;
};

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
};

export type TokenStore = {
  load: () => Promise<LexusSession | null>;
  save: (session: LexusSession) => Promise<void>;
  clear: () => Promise<void>;
};

type SecureStoreModule = {
  deleteItemAsync: (
    key: string,
    options?: { keychainService?: string },
  ) => Promise<void>;
  getItemAsync: (
    key: string,
    options?: { keychainService?: string },
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
    options?: { keychainAccessible?: number; keychainService?: string },
  ) => Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: number;
};

function parseAccessToken(value: string | null): StoredAccessToken | null {
  if (!value) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.value !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.expiresAt !== 'number' ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }
  return { value: record.value, type: record.type, expiresAt: record.expiresAt };
}

export function createTokenStore(storage: KeyValueStorage): TokenStore {
  return {
    async load() {
      const [accessTokenValue, refreshToken, idToken] = await Promise.all([
        storage.getItem(accounts.accessToken),
        storage.getItem(accounts.refreshToken),
        storage.getItem(accounts.idToken),
      ]);
      const accessToken = parseAccessToken(accessTokenValue);
      if (!accessToken || !refreshToken || !idToken) {
        return null;
      }
      return {
        accessToken: accessToken.value,
        refreshToken,
        idToken,
        expiresAt: accessToken.expiresAt,
        tokenType: accessToken.type,
      };
    },

    async save(session) {
      const accessToken: StoredAccessToken = {
        value: session.accessToken,
        type: session.tokenType,
        expiresAt: session.expiresAt,
      };
      await Promise.all([
        storage.setItem(accounts.accessToken, JSON.stringify(accessToken)),
        storage.setItem(accounts.refreshToken, session.refreshToken),
        storage.setItem(accounts.idToken, session.idToken),
      ]);
    },

    async clear() {
      await Promise.all(Object.values(accounts).map((account) => storage.deleteItem(account)));
    },
  };
}

export function createSecureStorage(
  loadSecureStore: () => Promise<SecureStoreModule> = () => import('expo-secure-store'),
): KeyValueStorage {
  return {
    async getItem(key) {
      const SecureStore = await loadSecureStore();
      return SecureStore.getItemAsync(key, {
        keychainService: KEYCHAIN_SERVICE,
      });
    },
    async setItem(key, value) {
      const SecureStore = await loadSecureStore();
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        keychainService: KEYCHAIN_SERVICE,
      });
    },
    async deleteItem(key) {
      const SecureStore = await loadSecureStore();
      await SecureStore.deleteItemAsync(key, {
        keychainService: KEYCHAIN_SERVICE,
      });
    },
  };
}

export const secureTokenStore = createTokenStore(createSecureStorage());
