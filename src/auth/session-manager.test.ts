import { describe, expect, it, vi } from "vitest";

import { LexusAuthError, type LexusSession } from "./lexus-auth";
import {
  createSessionManager,
  EXPIRY_MARGIN_MS,
  SessionInvalidError,
  type SessionManager,
} from "./session-manager";
import { LexusApiError } from "@/data/lexus-api";

const NOW = 1_700_000_000_000;

function makeSession(overrides: Partial<LexusSession> = {}): LexusSession {
  return {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    idToken: "id-1",
    expiresAt: NOW + 3_600_000,
    tokenType: "Bearer",
    ...overrides,
  };
}

// A session past the proactive-refresh margin, and the rotated session a
// successful refresh returns for it.
const STALE = makeSession({ expiresAt: NOW + EXPIRY_MARGIN_MS - 1 });
const ROTATED = makeSession({
  accessToken: "access-2",
  refreshToken: "refresh-2",
  idToken: "id-2",
  expiresAt: NOW + 3_600_000,
});

type Harness = {
  manager: SessionManager;
  refresh: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  onSession: ReturnType<typeof vi.fn>;
  onInvalid: ReturnType<typeof vi.fn>;
};

function makeManager(session: LexusSession | null = makeSession()): Harness {
  const refresh = vi.fn();
  const save = vi.fn().mockResolvedValue(undefined);
  const onSession = vi.fn();
  const onInvalid = vi.fn().mockResolvedValue(undefined);
  const manager = createSessionManager({
    store: { load: vi.fn(), save, clear: vi.fn() },
    refresh,
    now: () => NOW,
    onSession,
    onInvalid,
  });
  manager.setSession(session);
  return { manager, refresh, save, onSession, onInvalid };
}

// A promise whose resolution the test controls, for exercising in-flight races.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const rejection = () => new LexusAuthError("grant is invalid", "http_error", 400);
const networkFailure = () => new TypeError("Network request failed");

describe("getSession", () => {
  it("returns the current session untouched while it is fresh", async () => {
    const fresh = makeSession();
    const { manager, refresh } = makeManager(fresh);
    await expect(manager.getSession()).resolves.toBe(fresh);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("throws SessionInvalidError when signed out", async () => {
    const { manager, refresh } = makeManager(null);
    await expect(manager.getSession()).rejects.toBeInstanceOf(SessionInvalidError);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a session at/near expiry, persists it, and reports it", async () => {
    const { manager, refresh, save, onSession } = makeManager(STALE);
    refresh.mockResolvedValue(ROTATED);
    await expect(manager.getSession()).resolves.toBe(ROTATED);
    expect(refresh).toHaveBeenCalledExactlyOnceWith(STALE.refreshToken, expect.anything());
    expect(save).toHaveBeenCalledExactlyOnceWith(ROTATED);
    expect(onSession).toHaveBeenCalledExactlyOnceWith(ROTATED);
    // The refreshed session is now current: no second refresh.
    await expect(manager.getSession()).resolves.toBe(ROTATED);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    const { manager, refresh } = makeManager(STALE);
    const gate = deferred<LexusSession>();
    refresh.mockReturnValue(gate.promise);
    const first = manager.getSession();
    const second = manager.getSession();
    gate.resolve(ROTATED);
    await expect(first).resolves.toBe(ROTATED);
    await expect(second).resolves.toBe(ROTATED);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("signs out through onInvalid when the refresh token is rejected", async () => {
    const { manager, refresh, onInvalid, save } = makeManager(STALE);
    refresh.mockRejectedValue(rejection());
    await expect(manager.getSession()).rejects.toBeInstanceOf(SessionInvalidError);
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    // The session is gone: later callers are told to sign in, without another
    // refresh attempt against the dead grant.
    await expect(manager.getSession()).rejects.toBeInstanceOf(SessionInvalidError);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the session through a transient refresh failure", async () => {
    const { manager, refresh, onInvalid } = makeManager(STALE);
    refresh.mockRejectedValueOnce(networkFailure()).mockResolvedValueOnce(ROTATED);
    await expect(manager.getSession()).rejects.toBeInstanceOf(TypeError);
    expect(onInvalid).not.toHaveBeenCalled();
    // The session survived: the next caller retries the refresh and recovers.
    await expect(manager.getSession()).resolves.toBe(ROTATED);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not clobber a session adopted while a refresh was in flight", async () => {
    const { manager, refresh, onSession, save } = makeManager(STALE);
    const gate = deferred<LexusSession>();
    refresh.mockReturnValue(gate.promise);
    const pending = manager.getSession();
    // A fresh sign-in replaces the session mid-refresh.
    const reSignedIn = makeSession({ accessToken: "access-3", refreshToken: "refresh-3" });
    manager.setSession(reSignedIn);
    gate.resolve(ROTATED);
    await expect(pending).resolves.toBe(reSignedIn);
    expect(save).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
    await expect(manager.getSession()).resolves.toBe(reSignedIn);
  });

  it("reports sign-in required when the user signs out mid-refresh", async () => {
    const { manager, refresh, onSession } = makeManager(STALE);
    const gate = deferred<LexusSession>();
    refresh.mockReturnValue(gate.promise);
    const pending = manager.getSession();
    manager.setSession(null);
    gate.resolve(ROTATED);
    await expect(pending).rejects.toBeInstanceOf(SessionInvalidError);
    expect(onSession).not.toHaveBeenCalled();
  });

  it("does not sign out over a rejection that belongs to a replaced session", async () => {
    const { manager, refresh, onInvalid } = makeManager(STALE);
    const gate = deferred<LexusSession>();
    refresh.mockReturnValue(gate.promise);
    const pending = manager.getSession();
    const reSignedIn = makeSession({ accessToken: "access-3", refreshToken: "refresh-3" });
    manager.setSession(reSignedIn);
    gate.reject(rejection());
    await expect(pending).resolves.toBe(reSignedIn);
    expect(onInvalid).not.toHaveBeenCalled();
  });
});

describe("run", () => {
  it("passes a fresh session to the operation and returns its result", async () => {
    const fresh = makeSession();
    const { manager } = makeManager(fresh);
    const operation = vi.fn().mockResolvedValue("result");
    await expect(manager.run(operation)).resolves.toBe("result");
    expect(operation).toHaveBeenCalledExactlyOnceWith(fresh);
  });

  it("refreshes once and retries when the call fails with a 403", async () => {
    const { manager, refresh } = makeManager();
    refresh.mockResolvedValue(ROTATED);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new LexusApiError("Lexus request failed (403)", 403))
      .mockResolvedValueOnce("result");
    await expect(manager.run(operation)).resolves.toBe("result");
    expect(refresh).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenLastCalledWith(ROTATED);
  });

  it("retries a 401 the same way", async () => {
    const { manager, refresh } = makeManager();
    refresh.mockResolvedValue(ROTATED);
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new LexusApiError("Lexus request failed (401)", 401))
      .mockResolvedValueOnce("result");
    await expect(manager.run(operation)).resolves.toBe("result");
    expect(operation).toHaveBeenLastCalledWith(ROTATED);
  });

  it("retries at most once: a second auth failure surfaces", async () => {
    const { manager, refresh } = makeManager();
    refresh.mockResolvedValue(ROTATED);
    const failure = new LexusApiError("Lexus request failed (403)", 403);
    const operation = vi.fn().mockRejectedValue(failure);
    await expect(manager.run(operation)).rejects.toBe(failure);
    expect(refresh).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not refresh over non-auth failures", async () => {
    const { manager, refresh } = makeManager();
    const failure = new LexusApiError("Lexus request failed (500)", 500);
    const operation = vi.fn().mockRejectedValue(failure);
    await expect(manager.run(operation)).rejects.toBe(failure);
    expect(refresh).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledOnce();
  });

  it("does not treat plain errors mentioning 403 as auth failures", async () => {
    const { manager, refresh } = makeManager();
    const failure = new Error("Lexus request failed (403)");
    const operation = vi.fn().mockRejectedValue(failure);
    await expect(manager.run(operation)).rejects.toBe(failure);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shares one refresh across concurrent 403 retries", async () => {
    const { manager, refresh } = makeManager();
    const gate = deferred<LexusSession>();
    refresh.mockReturnValue(gate.promise);
    const operation = vi
      .fn()
      .mockImplementation((session: LexusSession) =>
        session.accessToken === ROTATED.accessToken
          ? Promise.resolve(session.accessToken)
          : Promise.reject(new LexusApiError("Lexus request failed (403)", 403)),
      );
    const first = manager.run(operation);
    const second = manager.run(operation);
    gate.resolve(ROTATED);
    await expect(first).resolves.toBe(ROTATED.accessToken);
    await expect(second).resolves.toBe(ROTATED.accessToken);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adopts a session refreshed by another caller instead of refreshing again", async () => {
    const { manager, refresh } = makeManager();
    const staleFailure = new LexusApiError("Lexus request failed (403)", 403);
    const operation = vi
      .fn()
      .mockImplementationOnce(async () => {
        // While this call is out, another caller's refresh already rotated the
        // session; this call's 403 must not burn the new refresh token.
        manager.setSession(ROTATED);
        throw staleFailure;
      })
      .mockResolvedValueOnce("result");
    await expect(manager.run(operation)).resolves.toBe("result");
    expect(refresh).not.toHaveBeenCalled();
    expect(operation).toHaveBeenLastCalledWith(ROTATED);
  });

  it("signs out when the retry's refresh is rejected", async () => {
    const { manager, refresh, onInvalid } = makeManager();
    refresh.mockRejectedValue(rejection());
    const operation = vi
      .fn()
      .mockRejectedValue(new LexusApiError("Lexus request failed (403)", 403));
    await expect(manager.run(operation)).rejects.toBeInstanceOf(SessionInvalidError);
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledOnce();
  });

  it("requires a session", async () => {
    const { manager } = makeManager(null);
    const operation = vi.fn();
    await expect(manager.run(operation)).rejects.toBeInstanceOf(SessionInvalidError);
    expect(operation).not.toHaveBeenCalled();
  });
});
