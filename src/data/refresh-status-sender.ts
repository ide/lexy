import { fetch } from "expo/fetch";

import type { LexusSession } from "@/auth/lexus-auth";
import {
  LexusApiError,
  VEHICLE_REFRESH_STATUS_ENDPOINT,
  vehicleHeaders,
  type VehicleContext,
} from "@/data/lexus-api";
import { canRefreshStatus, recordPrime, releasePrime } from "@/data/refresh-status";

/**
 * Prime a fresh full snapshot from the car, if not rate-limited. Fire-and-await
 * before the normal refetch: it makes the server-side status current so the
 * subsequent GET returns complete state instead of the last sparse push. The
 * official app POSTs `{ autoFixPopup: false }` and treats the response as the
 * new snapshot. Returns whether a prime was actually sent. Only an auth failure
 * (401/403) throws — as `LexusApiError`, so `runAuthorized` can refresh the
 * token and retry the prime — every other failure just falls back to the plain
 * refetch.
 */
export async function refreshVehicleStatus(
  session: LexusSession,
  context: VehicleContext,
): Promise<boolean> {
  if (!canRefreshStatus(context.vin)) {
    return false;
  }
  // Record before awaiting so rapid repeat pulls can't stack primes.
  recordPrime(context.vin);
  let response;
  try {
    response = await fetch(VEHICLE_REFRESH_STATUS_ENDPOINT, {
      method: "POST",
      headers: vehicleHeaders(session, context),
      body: JSON.stringify({ autoFixPopup: false }),
    });
  } catch {
    releasePrime(context.vin);
    return false;
  }
  if (!response.ok) {
    // A rejected prime shouldn't burn the interval — let the user retry.
    releasePrime(context.vin);
    if (response.status === 401 || response.status === 403) {
      throw new LexusApiError(
        `Refreshing vehicle status failed (${response.status})`,
        response.status,
      );
    }
    return false;
  }
  return true;
}
