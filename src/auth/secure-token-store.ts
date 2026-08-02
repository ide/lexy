import * as SecureStore from "expo-secure-store";

import { createTokenStore, type KeyValueStorage, type TokenStore } from "@/auth/token-store";

// The native edge of the token store, kept in its own module so `token-store.ts`
// stays free of native imports and testable in plain Node (see AGENTS.md).
const KEYCHAIN_SERVICE = "app.ide.lexy";

export const secureStorage: KeyValueStorage = {
  // `SecureStore.getItem` is the synchronous Keychain read, and the launch
  // depends on it being one: it runs during the first render rather than in an
  // effect after it. Three small Keychain reads, all on the JS thread before
  // anything is on screen — there is no frame to drop yet.
  getItemSync: (key) => SecureStore.getItem(key, { keychainService: KEYCHAIN_SERVICE }),
  setItem: async (key, value) => {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      keychainService: KEYCHAIN_SERVICE,
    });
  },
  deleteItem: async (key) => {
    await SecureStore.deleteItemAsync(key, { keychainService: KEYCHAIN_SERVICE });
  },
};

export const secureTokenStore: TokenStore = createTokenStore(secureStorage);
