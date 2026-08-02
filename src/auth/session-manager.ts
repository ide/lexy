import {
  LexusAuthError,
  refreshSession,
  type LexusSession,
  type RequestLike,
} from "@/auth/lexus-auth";
import type { TokenStore } from "@/auth/token-store";
import { isAuthFailure } from "@/data/lexus-api";

// How close to expiry an access token is treated as already expired. Covers
// clock skew and the window between building headers and the gateway checking
// the token.
export const EXPIRY_MARGIN_MS = 60_000;

/**
 * Thrown when there is no usable session — the refresh token was rejected or
 * the user is signed out — and only signing in again can recover.
 */
export class SessionInvalidError extends Error {
  constructor() {
    super("Your Lexus session expired. Please sign in again.");
    this.name = "SessionInvalidError";
  }
}

export type SessionManager = {
  /** Adopt a signed-in session (or drop it on sign-out). */
  setSession: (session: LexusSession | null) => void;
  /**
   * Whether there is a session at all, without asking for one. `getSession`
   * throws when there isn't, which is the wrong shape for "is there anything
   * here to freshen?" — a question the launch asks before it has any reason to
   * treat the answer as a failure.
   */
  hasSession: () => boolean;
  /**
   * The current session, refreshed first when it is at/near expiry. Concurrent
   * callers share one in-flight refresh — refresh-token rotation makes parallel
   * refreshes fatal (the first wins, the rest burn an already-rotated token).
   */
  getSession: () => Promise<LexusSession>;
  /**
   * Run an authorized Lexus call with a live session. Refreshes proactively via
   * getSession, and when the call still fails with a 401/403 `LexusApiError`
   * (the server can invalidate a token before its stated expiry) refreshes once
   * and retries the call. Throws `SessionInvalidError` once sign-in is required.
   */
  run: <T>(operation: (session: LexusSession) => Promise<T>) => Promise<T>;
};

type Dependencies = {
  /** Persists refreshed sessions so a relaunch restores the rotated tokens. */
  store: TokenStore;
  request?: RequestLike;
  refresh?: typeof refreshSession;
  now?: () => number;
  /** A refresh produced a new session — adopt it in app state. */
  onSession: (session: LexusSession) => void;
  /** The refresh token was rejected: the session is gone and sign-in is required. */
  onInvalid: () => void | Promise<void>;
};

// Whether the identity server rejected the grant itself (`invalid_grant` and
// kin arrive as 4xx from the token endpoint) — sign-in required — as opposed to
// a transient transport/server failure that should not sign the user out.
function isRefreshRejection(error: unknown): boolean {
  return (
    error instanceof LexusAuthError &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  );
}

export function createSessionManager({
  store,
  request = globalThis.fetch,
  refresh = refreshSession,
  now = Date.now,
  onSession,
  onInvalid,
}: Dependencies): SessionManager {
  let current: LexusSession | null = null;
  let inflight: Promise<LexusSession> | null = null;

  function refreshCurrent(): Promise<LexusSession> {
    if (!inflight) {
      const stale = current;
      inflight = (async () => {
        if (!stale) {
          throw new SessionInvalidError();
        }
        let refreshed: LexusSession;
        try {
          refreshed = await refresh(stale.refreshToken, request);
        } catch (error) {
          if (current !== stale) {
            // The session changed while refreshing (sign-out or a fresh
            // sign-in) — this failure belongs to a session that no longer
            // exists, so neither invalidate nor report it.
            if (current) {
              return current;
            }
            throw new SessionInvalidError();
          }
          if (isRefreshRejection(error)) {
            current = null;
            await onInvalid();
            throw new SessionInvalidError();
          }
          throw error;
        }
        if (current !== stale) {
          // Same race on the success path: never clobber a newer session with
          // the result of a refresh that started before it existed.
          if (current) {
            return current;
          }
          throw new SessionInvalidError();
        }
        current = refreshed;
        await store.save(refreshed);
        onSession(refreshed);
        return refreshed;
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  async function getSession(): Promise<LexusSession> {
    if (inflight) {
      return inflight;
    }
    if (!current) {
      throw new SessionInvalidError();
    }
    if (current.expiresAt > now() + EXPIRY_MARGIN_MS) {
      return current;
    }
    return refreshCurrent();
  }

  return {
    setSession(session) {
      current = session;
    },

    hasSession() {
      return current !== null;
    },

    getSession,

    async run(operation) {
      const session = await getSession();
      try {
        return await operation(session);
      } catch (error) {
        if (!isAuthFailure(error)) {
          throw error;
        }
        // A concurrent caller may have already refreshed past the token this
        // call failed on; adopt that session instead of burning another
        // (rotated) refresh token.
        const retrySession =
          current && current.accessToken !== session.accessToken ? current : await refreshCurrent();
        return operation(retrySession);
      }
    },
  };
}
