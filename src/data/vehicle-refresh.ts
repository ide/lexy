import { Observe } from "expo-observe";

import type { LexusSession } from "@/auth/lexus-auth";
import { CLIMATE_SETTINGS_QUERY_KEY } from "@/data/climate-settings";
import type { VehicleContext } from "@/data/lexus-api";
import { queryClient } from "@/data/query-client";
import { refreshVehicleStatus } from "@/data/refresh-status-sender";
import { createSingleFlight } from "@/data/single-flight";
import { VEHICLE_PROFILE_QUERY_KEY, vehicleStatusQueryKey } from "@/data/vehicle-keys";

/** `runAuthorized` from the auth context: run an operation with a live session. */
export type RunAuthorized = <T>(operation: (session: LexusSession) => Promise<T>) => Promise<T>;

/**
 * Who asked for this refresh. `manual` is a deliberate gesture (pull-to-
 * refresh); `auto` is the app deciding on its own that what it is showing is
 * too old (use-vehicle-auto-refresh.ts). Recorded with each prime, because
 * whether unprompted primes are worth their 12V cost — and whether the age
 * threshold that triggers them is right — is a product question that should be
 * answered with evidence rather than re-argued.
 */
export type RefreshTrigger = "auto" | "manual";

/**
 * What "refresh the dashboard" means, in one place: optionally prime the car
 * for a fresh snapshot, then re-read the live data — the status snapshot and
 * the climate settings, which live in their own query and can change out from
 * under us (the official Lexus app edits the same settings).
 *
 * The profile rides along on a *manual* refresh only. On an automatic one it
 * would be waste: identity, spec sheet, and subscriptions don't go stale on
 * the timescale the app decides to re-read for itself, and putting discovery,
 * spec, and subscriptions back on that path would run all three on every
 * foreground and after every lock command.
 *
 * A pull-to-refresh is a different question. It means "everything on this
 * screen", and some of that screen is profile data the *car* never reports —
 * the vehicle's name is edited from the official Lexus app. Without discovery
 * on this path, such a rename stays invisible until the profile's own day-long
 * window elapses (PROFILE_STALE_TIME_MS), with the refresh gesture that should
 * have fixed it appearing to do nothing.
 *
 * `prime` POSTs `refresh-status`, which wakes the telematics unit and asks
 * every body module to report — expensive for the 12V battery, so it is
 * rate-limited per VIN (refresh-status.ts) and reserved for a deliberate
 * refresh: a pull-to-refresh, or opening the app to data old enough that the
 * plain GET would likely return the same stale snapshot.
 *
 * The re-read always runs. A prime is an escalation *before* it, never a
 * substitute for it — one that is rate-limited, fails, or has no session to run
 * under just falls through, so a pull-to-refresh always fetches.
 */
export async function refreshVehicleData({
  context,
  runAuthorized,
  trigger,
  prime = false,
}: {
  context: VehicleContext | null;
  runAuthorized: RunAuthorized | null;
  trigger: RefreshTrigger;
  prime?: boolean;
}): Promise<void> {
  if (prime && context && runAuthorized) {
    // The prime signals auth failures (401/403) so runAuthorized can refresh
    // the token and retry it once; any other failure — including a dead
    // session — still falls through to the plain re-read below, which surfaces
    // the real state.
    const sent = await runAuthorized((session) => refreshVehicleStatus(session, context)).catch(
      () => false,
    );
    // `sent` is false when the per-VIN rate limiter declined it, which is the
    // interesting half of the measurement: it is how an automatic prime taking
    // the window from a later pull-to-refresh would show up.
    Observe.logEvent("vehicle.prime", { attributes: { trigger, sent } });
  }
  await Promise.all([
    // Without a context there is no car to scope a status read to, so there is
    // nothing to refetch — the profile load that produces one is already in
    // flight, and its arrival is what starts the first status read.
    context
      ? queryClient.refetchQueries({ queryKey: vehicleStatusQueryKey(context.vin) })
      : Promise.resolve(),
    queryClient.refetchQueries({ queryKey: CLIMATE_SETTINGS_QUERY_KEY }),
    trigger === "manual"
      ? queryClient.refetchQueries({ queryKey: VEHICLE_PROFILE_QUERY_KEY })
      : Promise.resolve(),
  ]);
}

// ---- Automatic refreshes ----------------------------------------------------
// A refresh the user didn't ask for is the only kind worth announcing on screen
// (RefreshingNote), and the only kind that must not stack.
//
// Both are facts about this one call, so its in-flight state is tracked here
// rather than inferred from a query's `isFetching` — which is also true for a
// pull-to-refresh, whose own spinner is already the indicator, and for each of
// the re-reads a lock command's reconciliation fires, which are not a refresh
// of stale data at all.

const autoRefresh = createSingleFlight();

/**
 * Run `refresh` as *the* automatic refresh: at most one at a time, with
 * {@link isAutoRefreshing} true for its duration. A call made while one is
 * already running joins it rather than starting a second.
 */
export const runAutoRefresh = autoRefresh.run;

/** Whether an automatic refresh is running right now. */
export const isAutoRefreshing = autoRefresh.isRunning;

export const subscribeAutoRefresh = autoRefresh.subscribe;
