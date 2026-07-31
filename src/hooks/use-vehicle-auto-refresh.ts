import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { queryClient } from "@/data/query-client";
import { resumeRefreshPlan } from "@/data/resume-refresh";
import type { VehicleStatus } from "@/data/vehicle";
import { vehicleStatusQueryKey } from "@/data/vehicle-keys";
import {
  isAutoRefreshing,
  refreshVehicleData,
  runAutoRefresh,
  subscribeAutoRefresh,
} from "@/data/vehicle-refresh";
import { useVehicleProfile, useVehicleStatus } from "@/hooks/use-vehicle";

/**
 * Keep the vehicle's live data current without being asked.
 *
 * Mounted once, by the tabs layout — not by the screens. The policy is about
 * the data, not about who happens to be looking at it, so hanging it off a
 * screen hook would leave whichever screens forgot to call it uncovered (the
 * location sheet reads the vehicle query directly, for one) and would re-run
 * the same policy once per mounted screen. One owner, for as long as the app is
 * showing vehicle data.
 *
 * Reads the queries directly rather than through `useVehicle`, so a Data State
 * override — which rewrites what the *screens* see — can't make the app refresh
 * against a previewed state instead of the real one.
 *
 * The status query opts out of React Query's own focus/mount refetching (see
 * use-vehicle.ts) so this is the single place deciding when what's on screen is
 * too old — and so the decision can escalate to a telematics prime, which React
 * Query knows nothing about. See resume-refresh.ts for the ladder.
 *
 * Runs when the app returns to the foreground, and whenever the status query's
 * `dataUpdatedAt` changes — which covers mount, including the launch where the
 * persisted cache restores a moment *after* the first render. Deliberately not
 * keyed on `isFetching`: a failed refresh leaves `dataUpdatedAt` untouched, so
 * there is no retry storm — at the cost that a failure isn't retried until the
 * next foreground, which the "Couldn't refresh" banner already explains.
 */
export function useVehicleAutoRefresh() {
  const { session, runAuthorized } = useAuth();
  const { data: profile } = useVehicleProfile();
  const context = profile?.context;
  const { dataUpdatedAt } = useVehicleStatus(context);

  useEffect(() => {
    if (!session || !context) {
      return;
    }
    const evaluate = () => {
      const state = queryClient.getQueryState<VehicleStatus>(vehicleStatusQueryKey(context.vin));
      // A fetch already in flight is the refresh this would have started.
      if (!state || state.fetchStatus !== "idle") {
        return;
      }
      const plan = resumeRefreshPlan(state.dataUpdatedAt);
      if (plan === "none") {
        return;
      }
      runAutoRefresh(() =>
        refreshVehicleData({
          trigger: "auto",
          prime: plan === "prime",
          context,
          runAuthorized,
        }),
      ).catch(() => {});
    };

    evaluate();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        evaluate();
      }
    });
    return () => subscription.remove();
  }, [context, dataUpdatedAt, runAuthorized, session]);
}

/**
 * Whether an automatic refresh is running — what `RefreshingNote` renders.
 * Reads the refresh itself rather than any query's `isFetching`, so the note
 * describes only refreshes the user didn't ask for: a pull-to-refresh has its
 * own spinner, and the re-reads that confirm a lock command are not a refresh
 * of stale data at all.
 */
export function useIsAutoRefreshing(): boolean {
  return useSyncExternalStore(subscribeAutoRefresh, isAutoRefreshing, isAutoRefreshing);
}
