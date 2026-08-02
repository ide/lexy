import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItem: vi.fn(),
  setItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

vi.mock("expo-secure-store", () => secureStore);

const { secureStorage, secureTokenStore } = await import("./secure-token-store");

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  idToken: "id",
  expiresAt: 123_456,
  tokenType: "Bearer",
};

const KEYCHAIN = { keychainService: "app.ide.lexy" };

describe("secure token store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the token entries in the device-only iOS Keychain service", async () => {
    await secureTokenStore.save(session);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "access-token",
      JSON.stringify({
        value: session.accessToken,
        type: session.tokenType,
        expiresAt: session.expiresAt,
      }),
      { keychainAccessible: 1, ...KEYCHAIN },
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith("refresh-token", session.refreshToken, {
      keychainAccessible: 1,
      ...KEYCHAIN,
    });
  });

  it("reads through the synchronous Keychain API", () => {
    // The launch depends on this being `getItem` and not `getItemAsync`: the
    // session has to be in hand during the first render, not after it.
    secureStore.getItem.mockReturnValue("stored");

    expect(secureStorage.getItemSync("refresh-token")).toBe("stored");
    expect(secureStore.getItem).toHaveBeenCalledWith("refresh-token", KEYCHAIN);
  });

  it("restores a whole session without awaiting anything", () => {
    secureStore.getItem.mockImplementation((key: string) =>
      key === "access-token"
        ? JSON.stringify({
            value: session.accessToken,
            type: session.tokenType,
            expiresAt: session.expiresAt,
          })
        : key === "refresh-token"
          ? session.refreshToken
          : session.idToken,
    );

    expect(secureTokenStore.load()).toEqual(session);
  });

  it("scopes deletes to the same Keychain service", async () => {
    await secureTokenStore.clear();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("access-token", KEYCHAIN);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("refresh-token", KEYCHAIN);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("id-token", KEYCHAIN);
  });
});
