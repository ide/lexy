import type { LexusSession } from "@/auth/lexus-auth";

const accounts = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  idToken: "id-token",
} as const;

// The access token, its type, and its expiry are written and refreshed as a unit,
// so they share one Keychain entry: a partial write can never leave the token
// paired with a stale type or expiry. The refresh and ID tokens have their own
// lifecycles and stay in separate entries.
type StoredAccessToken = {
  value: string;
  type: string;
  expiresAt: number;
};

/**
 * Reads are synchronous and writes are not, which is the asymmetry the launch
 * cares about: the session has to be in hand *before* the first render, so the
 * app can mount the right screen with no loading pass, while a write can settle
 * whenever it likes. See {@link TokenStore.load}.
 */
export type KeyValueStorage = {
  getItemSync: (key: string) => string | null;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
};

export type TokenStore = {
  /**
   * The stored session, read on the calling thread. Synchronous so the launch
   * can answer "who is signed in?" during the first render rather than after
   * it — an effect that resolves later would mean rendering one screen and
   * then replacing it, which is the flash this exists to avoid.
   *
   * This does not say the session is *fresh*; see session-restore.ts.
   */
  load: () => LexusSession | null;
  save: (session: LexusSession) => Promise<void>;
  clear: () => Promise<void>;
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
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.value !== "string" ||
    typeof record.type !== "string" ||
    typeof record.expiresAt !== "number" ||
    !Number.isFinite(record.expiresAt)
  ) {
    return null;
  }
  return { value: record.value, type: record.type, expiresAt: record.expiresAt };
}

export function createTokenStore(storage: KeyValueStorage): TokenStore {
  return {
    load() {
      const accessToken = parseAccessToken(storage.getItemSync(accounts.accessToken));
      const refreshToken = storage.getItemSync(accounts.refreshToken);
      const idToken = storage.getItemSync(accounts.idToken);
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
