import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { queryClient } from "@/data/query-client";
import { resumeRefreshPlan } from "@/data/resume-refresh";
import { vehicleContext, type Vehicle } from "@/data/vehicle";
import { refreshVehicleData, type RunAuthorized } from "@/data/vehicle-refresh";

// One refresh at a time, across every screen that asks for one: both vehicle
// tabs run this hook and a foreground wakes them together.
let inFlight: Promise<void> | null = null;

function refreshOnce(prime: boolean, vehicle: Vehicle | undefined, runAuthorized: RunAuthorized) {
  inFlight ??= refreshVehicleData({
    prime,
    context: vehicle ? vehicleContext(vehicle) : null,
    runAuthorized,
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Keep the vehicle data current without being asked. The vehicle query opts out
 * of React Query's own focus/mount refetching (see use-vehicle.ts) so that this
 * is the single place deciding when cached data is too old to show — and so the
 * decision can escalate to a telematics prime, which React Query knows nothing
 * about. See resume-refresh.ts for the ladder.
 *
 * Runs when the app returns to the foreground, and whenever `dataUpdatedAt`
 * changes — which covers mount, including the launch where the persisted cache
 * restores a moment *after* the screen first renders. Passing it as an argument
 * (rather than reading it off the client) is what makes that a re-render the
 * hook can see; everything else is read live from the query client, so a fetch
 * settling can't re-trigger the effect that started it.
 */
export function useVehicleResume(dataUpdatedAt: number) {
  const { session, runAuthorized } = useAuth();

  useEffect(() => {
    if (!session) {
      return;
    }
    const evaluate = () => {
      const state = queryClient.getQueryState<Vehicle>(["vehicle"]);
      // A fetch already in flight is the refresh this would have started.
      if (!state || state.fetchStatus !== "idle") {
        return;
      }
      const plan = resumeRefreshPlan(state.dataUpdatedAt);
      if (plan === "none") {
        return;
      }
      refreshOnce(plan === "prime", state.data, runAuthorized).catch(() => {});
    };

    evaluate();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        evaluate();
      }
    });
    return () => subscription.remove();
  }, [dataUpdatedAt, runAuthorized, session]);
}
