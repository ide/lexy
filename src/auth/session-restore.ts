import type { LexusSession } from "@/auth/lexus-auth";
import type { SessionManager } from "@/auth/session-manager";
import type { TokenStore } from "@/auth/token-store";

type RestoreHandlers = {
  /**
   * The stored tokens were read back: `null` when nobody is signed in. This is
   * what the launch waits for, and the app paints as soon as it lands.
   */
  onRestored: (stored: LexusSession | null) => void;
  /** The token store could not be read at all — there is nothing to restore. */
  onUnreadable: (cause: unknown) => void;
};

/**
 * Bring a stored session back at launch, in the two steps their costs call for.
 *
 * Reading the Keychain answers the question the first paint depends on — is
 * anyone signed in? — and it is local and fast, so `onRestored` fires the
 * moment it lands. Establishing that the token is still *fresh* can cost a
 * network round trip to Lexus, so it runs after, with the screen already up.
 *
 * Nothing downstream needs the refresh to have finished first: every authorized
 * call runs through `manager.run()`, which begins with the same `getSession()`
 * and shares its single in-flight refresh — so the vehicle loads join this
 * refresh rather than racing it or starting a second one (which, with refresh
 * token rotation, would be fatal).
 *
 * Resolves once the background half has settled too, so a caller that wants the
 * whole sequence — a test, mostly — can await it. The launch path does not.
 */
export async function restoreSession(
  store: Pick<TokenStore, "load">,
  manager: Pick<SessionManager, "setSession" | "getSession">,
  handlers: RestoreHandlers,
): Promise<void> {
  let stored: LexusSession | null;
  try {
    stored = await store.load();
  } catch (cause) {
    handlers.onUnreadable(cause);
    return;
  }

  if (stored) {
    manager.setSession(stored);
  }
  handlers.onRestored(stored);

  if (!stored) {
    return;
  }

  // Refreshes when the stored token is at/near expiry, persists any rotated
  // tokens, and signs out through the manager's `onInvalid` when the grant was
  // rejected while the app was gone.
  //
  // A rejected grant explains itself that way, which flips the stack to
  // sign-in. A transient failure is swallowed on purpose: the restored session
  // stays in place, the screen keeps its cached data, and the next authorized
  // call retries the refresh — the same handling a failure mid-session gets.
  // Kicking the user to sign-in because the network happened to be down for
  // the launch would be the worse answer, and it is what awaiting this did.
  await manager.getSession().catch(() => {});
}
