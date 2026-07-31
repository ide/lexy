// What to do about cached vehicle data when the app comes back to the
// foreground (or restores its cache on launch). The problem this answers: the
// dashboard renders whatever was last cached, and nothing about a card of
// numbers says how old it is — so data from yesterday reads exactly like data
// from a minute ago, and a user with no reason to suspect otherwise never
// thinks to pull to refresh.
//
// So the app refreshes itself, on a ladder rather than a single threshold,
// because the two ways of asking cost very different things:
//
//   fresh   — under a minute old; the screen is current, leave it alone.
//   refetch — GET the server's snapshot. Cheap, doesn't touch the car.
//   prime   — POST refresh-status first: wake the telematics unit and have
//             every module report. Costs the 12V battery and the cellular
//             link, so it is worth it only when the server's own snapshot is
//             likely as old as ours — which, after this long away, it is.
//
// (What the user sees while this runs is deliberately quiet — see
// RefreshingPill — because they didn't ask for it.)

/** Under this, the cached data is current enough to leave alone. */
export const RESUME_REFETCH_AFTER_MS = 60 * 1000;

/** Past this, a plain GET is likely to return the same stale snapshot. */
export const RESUME_PRIME_AFTER_MS = 15 * 60 * 1000;

export type ResumeRefreshPlan = "none" | "refetch" | "prime";

/**
 * How hard to refresh data last written at `dataUpdatedAt` (ms since epoch, as
 * React Query reports it). Nothing cached yet — or a clock that has moved
 * backwards — is "none": the query's own initial load covers the first case,
 * and a negative age is not evidence of staleness.
 */
export function resumeRefreshPlan(
  dataUpdatedAt: number,
  now: number = Date.now(),
): ResumeRefreshPlan {
  if (dataUpdatedAt <= 0) {
    return "none";
  }
  const age = now - dataUpdatedAt;
  if (age < RESUME_REFETCH_AFTER_MS) {
    return "none";
  }
  return age < RESUME_PRIME_AFTER_MS ? "refetch" : "prime";
}
