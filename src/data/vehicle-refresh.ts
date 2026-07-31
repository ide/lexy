import type { LexusSession } from "@/auth/lexus-auth";
import type { VehicleContext } from "@/data/lexus-api";
import { queryClient } from "@/data/query-client";
import { refreshVehicleStatus } from "@/data/refresh-status-sender";
import { CLIMATE_SETTINGS_QUERY_KEY } from "@/hooks/use-climate-settings";

/** `runAuthorized` from the auth context: run an operation with a live session. */
export type RunAuthorized = <T>(operation: (session: LexusSession) => Promise<T>) => Promise<T>;

/**
 * What "refresh the dashboard" means, in one place: optionally prime the car
 * for a fresh snapshot, then re-read the vehicle and the climate settings
 * together. Climate lives in its own query and can change out from under us
 * (the official Lexus app edits the same settings), so it refreshes alongside.
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
  prime = false,
}: {
  context: VehicleContext | null;
  runAuthorized: RunAuthorized | null;
  prime?: boolean;
}): Promise<void> {
  if (prime && context && runAuthorized) {
    // The prime signals auth failures (401/403) so runAuthorized can refresh
    // the token and retry it once; any other failure — including a dead
    // session — still falls through to the plain re-read below, which surfaces
    // the real state.
    await runAuthorized((session) => refreshVehicleStatus(session, context)).catch(() => {});
  }
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["vehicle"] }),
    queryClient.refetchQueries({ queryKey: CLIMATE_SETTINGS_QUERY_KEY }),
  ]);
}
