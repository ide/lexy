/**
 * Which side of the auth boundary a launch renders, and whether it can render
 * anything at all yet.
 *
 * Two local reads stand between a cold launch and its first pixel: the
 * persisted query cache (SQLite) and the stored session (Keychain). Only the
 * first is worth waiting for unconditionally.
 *
 * The Keychain read exists to answer "is anyone signed in?", and a populated
 * vehicle cache already answers it — signing out wipes that cache in the same
 * breath as the tokens (`clearVehicleCache`, from both `signOut` and the
 * manager's `onInvalid`), so data on disk means the last thing this install did
 * was be signed in. When the cache has a car in it, the launch renders it and
 * lets the Keychain confirm behind the screen.
 *
 * When it doesn't, waiting costs nothing visible: with no cached car the
 * signed-in side renders its skeleton, which is what the hold already looks
 * like — so the launch waits and renders the *right* screen instead of
 * gambling and risking a sign-in flash.
 *
 * The presumption is only ever load-bearing for the ~100ms until the tokens
 * land. After that the tokens are authoritative, cache or no cache: a stale
 * cache left behind by a sign-out that failed to finish loses to them, and the
 * stack swaps to sign-in.
 */

export type LaunchGateInput = {
  /** The restored session, or null when the Keychain says nobody is signed in. */
  session: unknown;
  /** The Keychain read has not answered yet. */
  isReadingTokens: boolean;
  /** The persisted query cache has not finished hydrating. */
  isRestoringCache: boolean;
  /**
   * The hydrated cache holds a vehicle — the evidence that stands in for the
   * session until the Keychain answers. Only meaningful once the cache has
   * finished restoring.
   */
  hasCachedVehicle: boolean;
};

export type LaunchGate = {
  /** Render nothing yet: there is no answer, and nothing worth showing without one. */
  hold: boolean;
  /** Render the signed-in side of the stack. */
  signedIn: boolean;
};

export function launchGate({
  session,
  isReadingTokens,
  isRestoringCache,
  hasCachedVehicle,
}: LaunchGateInput): LaunchGate {
  // Nothing is known until the cache has hydrated — not even whether there is
  // a car to fall back on. This hold is a local SQLite read, tens of ms.
  if (isRestoringCache) {
    return { hold: true, signedIn: false };
  }

  // The tokens have landed and outrank everything below.
  if (!isReadingTokens) {
    return { hold: false, signedIn: session !== null };
  }

  return { hold: !hasCachedVehicle, signedIn: hasCachedVehicle };
}
