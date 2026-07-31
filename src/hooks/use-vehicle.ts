import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/auth-context";
import { SessionInvalidError } from "@/auth/session-manager";
import { NoVehicleError } from "@/data/vehicle";
import { loadVehicle } from "@/data/vehicle-load";
import { overrideVehicleResult } from "@/debug/data-state";
import { useDataStateOverride } from "@/debug/debug-overrides";

export function useVehicle() {
  const { session, runAuthorized } = useAuth();
  const override = useDataStateOverride();
  const query = useQuery({
    queryKey: ["vehicle"],
    enabled: session !== null,
    // A settled "no vehicle on this account" is a definitive empty state, and a
    // dead session only recovers by signing in — don't burn retries on either.
    // Everything else keeps the default two retries.
    retry: (failureCount, error) =>
      !(error instanceof NoVehicleError) &&
      !(error instanceof SessionInvalidError) &&
      failureCount < 2,
    queryFn: ({ signal }) => runAuthorized((session) => loadVehicle(session, signal)),
  });
  // In dev/preview, a Data State override rewrites the result so the screens can
  // preview each state; in production it is always 'live' and returns as-is.
  return overrideVehicleResult(query, override);
}
