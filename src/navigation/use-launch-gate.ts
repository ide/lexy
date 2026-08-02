import { useIsRestoring, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/auth/auth-context";
import { launchGate, type LaunchGate } from "@/auth/launch-gate";
import { VEHICLE_PROFILE_QUERY_KEY } from "@/data/vehicle-keys";

/**
 * The launch's answer to "render what, and can we yet" — see launch-gate.ts for
 * the policy. Both the root stack and the `/` redirect read it, so they cannot
 * disagree about which side of the auth boundary this launch is on.
 */
export function useLaunchGate(): LaunchGate {
  const { session, isLoading } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();

  // Read rather than subscribed, deliberately. This only decides anything
  // while the Keychain read is outstanding, and across that window the cache
  // is already hydrated (`isRestoring` is false) and no vehicle query can have
  // run yet — the queries are gated on a session that does not exist yet. The
  // one thing that *can* change it, a `clearVehicleCache()` from a rejected
  // grant, arrives with a `session` change that re-renders this anyway.
  const hasCachedVehicle =
    !isRestoring && queryClient.getQueryData(VEHICLE_PROFILE_QUERY_KEY) !== undefined;

  return launchGate({
    session,
    isReadingTokens: isLoading,
    isRestoringCache: isRestoring,
    hasCachedVehicle,
  });
}
