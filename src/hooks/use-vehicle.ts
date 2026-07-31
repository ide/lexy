import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "@/auth/auth-context";
import { SessionInvalidError } from "@/auth/session-manager";
import type { VehicleContext } from "@/data/lexus-api";
import { composeVehicle, NoVehicleError, type Vehicle } from "@/data/vehicle";
import { VEHICLE_PROFILE_QUERY_KEY, vehicleStatusQueryKey } from "@/data/vehicle-keys";
import { loadVehicleProfile, loadVehicleStatus } from "@/data/vehicle-load";
import { overrideVehicleResult } from "@/debug/data-state";
import { useDataStateOverride } from "@/debug/debug-overrides";

/**
 * How long the profile is considered current. Identity, spec sheet, and
 * subscriptions change on the scale of ownership, so React Query's own
 * mount/focus refetching is left on for this half: with a window this long it
 * amounts to "re-read about once a day, on a foreground", which is exactly
 * right and needs no policy of our own. The status half is the one that needs a
 * ladder (see use-vehicle-auto-refresh.ts).
 */
const PROFILE_STALE_TIME_MS = 24 * 60 * 60 * 1000;

// A dead session only recovers by signing in, and a settled "no vehicle on this
// account" is a definitive empty state — don't burn retries on either.
const retryUnlessTerminal = (failureCount: number, error: Error) =>
  !(error instanceof NoVehicleError) && !(error instanceof SessionInvalidError) && failureCount < 2;

/**
 * Who the car is. Also the source of the {@link VehicleContext} every other
 * vehicle call is scoped by, which is why it loads first and alone.
 */
export function useVehicleProfile() {
  const { session, runAuthorized } = useAuth();
  return useQuery({
    queryKey: VEHICLE_PROFILE_QUERY_KEY,
    enabled: session !== null,
    staleTime: PROFILE_STALE_TIME_MS,
    retry: retryUnlessTerminal,
    queryFn: ({ signal }) => runAuthorized((session) => loadVehicleProfile(session, signal)),
  });
}

/**
 * What the car reports right now, for the given car. Staleness is deliberately
 * not React Query's call here: how old is too old depends on how the data would
 * be refreshed (a cheap GET, or waking the telematics unit), so
 * `useVehicleAutoRefresh` owns mount and foreground refreshing for the whole
 * ladder. Reconnecting still refetches — that one is unambiguous.
 */
export function useVehicleStatus(context: VehicleContext | undefined) {
  const { session, runAuthorized } = useAuth();
  return useQuery({
    queryKey: vehicleStatusQueryKey(context?.vin ?? ""),
    enabled: session !== null && context !== undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: retryUnlessTerminal,
    queryFn: ({ signal }) =>
      runAuthorized((session) => loadVehicleStatus(session, context!, signal)),
  });
}

/**
 * What a vehicle screen renders, and everything it needs to reason about the
 * data behind it. Deliberately not a `UseQueryResult`: the screens read from two
 * queries whose roles differ (a profile that rarely changes, a status snapshot
 * that goes stale in minutes), and flattening them into one query's shape would
 * invite treating them as one — the coupling this split exists to remove.
 */
export type VehicleQuery = {
  /** The merged view, or undefined until both halves are present and agree. */
  vehicle: Vehicle | undefined;
  /**
   * The car every vehicle-scoped call addresses, available as soon as the
   * profile lands — before, and independently of, any status snapshot.
   */
  context: VehicleContext | undefined;
  /** When the *status* on screen was written: the freshness the user cares about. */
  dataUpdatedAt: number;
  error: Error | null;
  /** Nothing to show yet, and a load is in flight. */
  isLoading: boolean;
  /** Any vehicle read is in flight, first load included. */
  isFetching: boolean;
  refetch: () => void;
};

export function useVehicle(): VehicleQuery {
  const override = useDataStateOverride();
  const profile = useVehicleProfile();
  const context = profile.data?.context;
  const status = useVehicleStatus(context);

  // Both halves: this backs the error screens' Retry, where the user is asking
  // for the whole load again, not for a fresh snapshot.
  const refetchProfile = profile.refetch;
  const refetchStatus = status.refetch;
  const refetch = useCallback(() => {
    refetchProfile().catch(() => {});
    refetchStatus().catch(() => {});
  }, [refetchProfile, refetchStatus]);

  const vehicle =
    profile.data && status.data
      ? (composeVehicle(profile.data.profile, status.data) ?? undefined)
      : undefined;

  // A half is working when it has no data yet and something will come of that:
  // a fetch running, or one about to start. `paused` is the case that must not
  // count — offline with an empty cache, where nothing is on its way and the
  // screen should say so rather than spin. The status half only counts once a
  // context enables it, so a failed profile load isn't held behind a status
  // query that can never run.
  //
  // Written in terms of `fetchStatus` rather than `isLoading` because the two
  // halves hand off: for the render between the profile landing and the status
  // fetch starting, both report `isLoading: false` with nothing to show — and
  // reading that as "settled with no data" would flash the error screen.
  const profileWorking = profile.isPending && profile.fetchStatus !== "paused";
  const statusWorking =
    context !== undefined && status.isPending && status.fetchStatus !== "paused";

  const result: VehicleQuery = {
    vehicle,
    context,
    dataUpdatedAt: status.dataUpdatedAt,
    // The profile's failure outranks the status one: without a profile there is
    // no car to scope a status read to, so a status error in its shadow is a
    // consequence rather than the cause. NoVehicleError arrives this way too.
    error: profile.error ?? status.error,
    isLoading: !vehicle && !profile.error && !status.error && (profileWorking || statusWorking),
    isFetching: profile.isFetching || status.isFetching,
    refetch,
  };

  // In dev/preview, a Data State override rewrites the result so the screens can
  // preview each state; in production it is always 'live' and returns as-is.
  return overrideVehicleResult(result, override);
}
