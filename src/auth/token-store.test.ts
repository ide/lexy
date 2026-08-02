import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore, type KeyValueStorage } from "./token-store";

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  idToken: "id",
  expiresAt: 123_456,
  tokenType: "Bearer",
};

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: KeyValueStorage = {
    deleteItem: async (key) => {
      values.delete(key);
    },
    getItemSync: (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  return { storage, values };
}

describe("token store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the access token, type, and expiry as one atomic entry and restores the session", async () => {
    const { storage, values } = memoryStorage();
    const store = createTokenStore(storage);

    await store.save(session);

    expect(values.get("access-token")).toBe(
      JSON.stringify({
        value: session.accessToken,
        type: session.tokenType,
        expiresAt: session.expiresAt,
      }),
    );
    expect(values.get("refresh-token")).toBe(session.refreshToken);
    expect(values.get("id-token")).toBe(session.idToken);
    expect(values.size).toBe(3);
    expect(store.load()).toEqual(session);
  });

  it("clears every token entry", async () => {
    const { storage, values } = memoryStorage();
    const store = createTokenStore(storage);
    await store.save(session);

    await store.clear();

    expect(values.size).toBe(0);
    expect(store.load()).toBeNull();
  });

  it("rejects a partial stored session", async () => {
    const { storage } = memoryStorage();
    await storage.setItem("refresh-token", "refresh");

    expect(createTokenStore(storage).load()).toBeNull();
  });

  it("rejects a corrupt access-token entry", async () => {
    const { storage } = memoryStorage();
    await storage.setItem("access-token", "not json");
    await storage.setItem("refresh-token", "refresh");
    await storage.setItem("id-token", "id");

    expect(createTokenStore(storage).load()).toBeNull();
  });
});
