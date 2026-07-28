import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSecureStorage, createTokenStore, type KeyValueStorage } from './token-store';

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  idToken: 'id',
  expiresAt: 123_456,
  tokenType: 'Bearer',
};

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: KeyValueStorage = {
    deleteItem: async (key) => {
      values.delete(key);
    },
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  return { storage, values };
}

describe('token store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the access token, type, and expiry as one atomic entry and restores the session', async () => {
    const { storage, values } = memoryStorage();
    const store = createTokenStore(storage);

    await store.save(session);

    expect(values.get('access-token')).toBe(
      JSON.stringify({ value: session.accessToken, type: session.tokenType, expiresAt: session.expiresAt }),
    );
    expect(values.get('refresh-token')).toBe(session.refreshToken);
    expect(values.get('id-token')).toBe(session.idToken);
    expect(values.size).toBe(3);
    await expect(store.load()).resolves.toEqual(session);
  });

  it('clears every token entry', async () => {
    const { storage, values } = memoryStorage();
    const store = createTokenStore(storage);
    await store.save(session);

    await store.clear();

    expect(values.size).toBe(0);
    await expect(store.load()).resolves.toBeNull();
  });

  it('rejects a partial stored session', async () => {
    const { storage } = memoryStorage();
    await storage.setItem('refresh-token', 'refresh');

    await expect(createTokenStore(storage).load()).resolves.toBeNull();
  });

  it('rejects a corrupt access-token entry', async () => {
    const { storage } = memoryStorage();
    await storage.setItem('access-token', 'not json');
    await storage.setItem('refresh-token', 'refresh');
    await storage.setItem('id-token', 'id');

    await expect(createTokenStore(storage).load()).resolves.toBeNull();
  });

  it('persists the token entries in the device-only iOS Keychain service', async () => {
    const store = createTokenStore(createSecureStorage(async () => secureStore));
    await store.save(session);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'access-token',
      JSON.stringify({ value: session.accessToken, type: session.tokenType, expiresAt: session.expiresAt }),
      {
        keychainAccessible: 1,
        keychainService: 'app.ide.lexy',
      },
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('refresh-token', session.refreshToken, {
      keychainAccessible: 1,
      keychainService: 'app.ide.lexy',
    });
  });
});
