import type { SessionManager } from "@/auth/session-manager";

/**
 * Bring a restored session up to date, after the app is already on screen.
 *
 * The session itself is read synchronously at launch (`TokenStore.load`), which
 * is all the first render needs: it says who is signed in, so the right screen
 * mounts immediately with whatever the cache already holds. Whether that token
 * is still *fresh* is a separate and much more expensive question — at or near
 * expiry it costs a round trip to Lexus, and on about a third of launches it
 * did: 0.26s at the median, 0.63s at the worst. None of that belongs in front
 * of a screen the app can already draw.
 *
 * So it runs here instead, behind the painted UI. Nothing downstream needs it
 * to have finished first: every authorized call goes through `manager.run()`,
 * which starts from this same `getSession()` and shares its one in-flight
 * refresh, so the vehicle loads join this refresh rather than racing it or
 * starting a second one — which, with refresh token rotation, would be fatal.
 */
export async function freshenSession(manager: Pick<SessionManager, "getSession">): Promise<void> {
  try {
    await manager.getSession();
  } catch {
    // A rejected grant has already dropped the session and explained itself
    // through the manager's `onInvalid`, which flips the stack to sign-in.
    //
    // A transient failure is swallowed on purpose: the restored session stays
    // in place, the screen keeps its cached data, and the next authorized call
    // retries the refresh — the same handling a failure mid-session gets.
    // Signing someone out because the network was down for their launch is the
    // worse answer, and it is what awaiting this used to do.
  }
}
