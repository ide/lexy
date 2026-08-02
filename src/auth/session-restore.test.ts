import { describe, expect, it, vi } from "vitest";

import type { LexusSession } from "@/auth/lexus-auth";
import { SessionInvalidError } from "@/auth/session-manager";
import { restoreSession } from "@/auth/session-restore";

const STORED: LexusSession = {
  accessToken: "stored-access",
  refreshToken: "stored-refresh",
  idToken: "stored-id",
  expiresAt: 0,
  tokenType: "Bearer",
};

const REFRESHED: LexusSession = { ...STORED, accessToken: "refreshed-access", expiresAt: 1 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function handlers() {
  return { onRestored: vi.fn(), onUnreadable: vi.fn() };
}

describe("restoreSession", () => {
  it("hands over the stored session without waiting for the refresh", async () => {
    // The whole point of the split: a launch whose access token has expired
    // must still paint on the Keychain read, not on the Lexus round trip.
    const refresh = deferred<LexusSession>();
    const manager = {
      setSession: vi.fn(),
      getSession: vi.fn(() => refresh.promise),
    };
    const on = handlers();

    const restore = restoreSession({ load: async () => STORED }, manager, on);
    await vi.waitFor(() => expect(on.onRestored).toHaveBeenCalledWith(STORED));

    // Still in flight — the app has already been told who is signed in.
    expect(manager.getSession).toHaveBeenCalledOnce();
    refresh.resolve(REFRESHED);
    await restore;
  });

  it("adopts the stored session into the manager before publishing it", async () => {
    // Ordering matters: `runAuthorized` reads the manager's session, not React
    // state, so a query that fires on the first painted frame must not find the
    // manager empty.
    const order: string[] = [];
    const manager = {
      setSession: vi.fn(() => {
        order.push("manager");
      }),
      getSession: vi.fn(async () => STORED),
    };
    const on = {
      onRestored: vi.fn(() => {
        order.push("published");
      }),
      onUnreadable: vi.fn(),
    };

    await restoreSession({ load: async () => STORED }, manager, on);

    expect(order).toEqual(["manager", "published"]);
    expect(manager.setSession).toHaveBeenCalledWith(STORED);
  });

  it("publishes a signed-out launch and starts no refresh", async () => {
    const manager = { setSession: vi.fn(), getSession: vi.fn() };
    const on = handlers();

    await restoreSession({ load: async () => null }, manager, on);

    expect(on.onRestored).toHaveBeenCalledWith(null);
    expect(manager.setSession).not.toHaveBeenCalled();
    expect(manager.getSession).not.toHaveBeenCalled();
  });

  it("keeps the restored session when the refresh fails transiently", async () => {
    // Offline at launch is not a reason to sign anyone out: the screen keeps
    // its cached data and the next authorized call retries the refresh.
    const manager = {
      setSession: vi.fn(),
      getSession: vi.fn(async () => {
        throw new Error("network request failed");
      }),
    };
    const on = handlers();

    await expect(
      restoreSession({ load: async () => STORED }, manager, on),
    ).resolves.toBeUndefined();

    expect(on.onRestored).toHaveBeenCalledWith(STORED);
    expect(on.onUnreadable).not.toHaveBeenCalled();
  });

  it("swallows a rejected grant, which the manager has already reported", async () => {
    // `onInvalid` inside the manager clears the session and sets the sign-in
    // message; restore must not double-report it or reject.
    const manager = {
      setSession: vi.fn(),
      getSession: vi.fn(async () => {
        throw new SessionInvalidError();
      }),
    };
    const on = handlers();

    await expect(
      restoreSession({ load: async () => STORED }, manager, on),
    ).resolves.toBeUndefined();

    expect(on.onUnreadable).not.toHaveBeenCalled();
  });

  it("reports an unreadable token store instead of publishing a session", async () => {
    const manager = { setSession: vi.fn(), getSession: vi.fn() };
    const on = handlers();
    const cause = new Error("keychain unavailable");

    await restoreSession(
      {
        load: async () => {
          throw cause;
        },
      },
      manager,
      on,
    );

    expect(on.onUnreadable).toHaveBeenCalledWith(cause);
    expect(on.onRestored).not.toHaveBeenCalled();
    expect(manager.getSession).not.toHaveBeenCalled();
  });
});
