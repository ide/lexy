import { Observe } from "expo-observe";
import { fetch } from "expo/fetch";

import type { LexusSession } from "@/auth/lexus-auth";
import {
  LexusApiError,
  VEHICLE_DISCOVERY_ENDPOINT,
  VEHICLE_SPEC_ENDPOINT,
  VEHICLE_STATUS_ENDPOINT,
  VEHICLE_TIRES_ENDPOINT,
  businessHeaders,
  vehicleHeaders,
  type VehicleContext,
} from "@/data/lexus-api";
import { applyObservation, expireOptimisticLocks, readClosures } from "@/data/closure-state";
import { loadClosureStore, saveClosureStore } from "@/data/closure-state-store";
import { OPTIMISTIC_LOCK_MAX_AGE_MS } from "@/data/lock-reconcile";
import { fetchVehicleSubscriptions } from "@/data/subscriptions";
import {
  mapVehicleProfile,
  mapVehicleStatus,
  NoVehicleError,
  parseSubscriptionVehicle,
  parseVehicleContexts,
  parseVehicleProfile,
  parseVehicleStatus,
  type VehicleProfile,
  type VehicleStatus,
} from "@/data/vehicle";

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new LexusApiError(`Lexus request failed (${response.status})`, response.status);
  }
  return response.json();
}

/**
 * Who the car is: discovery, the spec sheet, and connected services. Slow-
 * moving data, loaded once per app run and refreshed on the scale of days —
 * see vehicle.ts for the split. Nothing here is worth re-reading to answer
 * "did my lock command land?", which is exactly why it is not in the status
 * load below.
 *
 * Returns the profile alongside the request context every other vehicle call
 * needs, so callers don't have to re-derive it (or re-run discovery to get it).
 */
export async function loadVehicleProfile(
  session: LexusSession,
  signal: AbortSignal,
): Promise<{ profile: VehicleProfile; context: VehicleContext }> {
  const startedAt = performance.now();
  try {
    const discovery = await getJson(VEHICLE_DISCOVERY_ENDPOINT, businessHeaders(session), signal);
    const contexts = parseVehicleContexts(discovery);
    const context = contexts[0];
    if (!context) {
      throw new NoVehicleError();
    }
    // The first vehicle is the primary until a switcher exists; a 2+ car
    // account still loads and works, it just shows this one for now.
    const scoped = vehicleHeaders(session, context);
    // Connected-services subscriptions are non-critical: a failure (or a
    // discovery record missing the region/ASI/hardware fields the v3 list
    // requires) leaves the card empty rather than failing the whole load.
    const subscriptionVehicle = parseSubscriptionVehicle(discovery);
    const [spec, subscriptions] = await Promise.all([
      getJson(VEHICLE_SPEC_ENDPOINT, scoped, signal),
      subscriptionVehicle
        ? fetchVehicleSubscriptions(session, subscriptionVehicle, {
            request: (url, init) => fetch(url, { ...init, signal }),
          }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const profile = parseVehicleProfile(mapVehicleProfile(discovery, spec, subscriptions));
    Observe.logEvent("vehicle.profile.load.completed", {
      attributes: { source: "lexus", durationMs: Math.round(performance.now() - startedAt) },
    });
    return { profile, context };
  } catch (error) {
    logLoadFailure("vehicle.profile.load.failed", error, signal, startedAt);
    throw error;
  }
}

/**
 * What the car reports right now: the status snapshot and tire pressures. This
 * is the read every refresh, prime, and lock reconciliation runs, so it stays
 * as small as the dashboard's live state actually is.
 */
export async function loadVehicleStatus(
  session: LexusSession,
  context: VehicleContext,
  signal: AbortSignal,
): Promise<VehicleStatus> {
  const startedAt = performance.now();
  try {
    const scoped = vehicleHeaders(session, context);
    const [status, tires] = await Promise.all([
      getJson(VEHICLE_STATUS_ENDPOINT, scoped, signal),
      getJson(VEHICLE_TIRES_ENDPOINT, scoped, signal).catch(() => null),
    ]);
    const mapped = mapVehicleStatus(context.vin, status, tires);
    // The status feed alternates between full and sparse snapshots (see
    // closure-state.ts). Fold this observation into the persisted
    // last-known-state store and render the materialized view, so a lock-only
    // snapshot after a drive doesn't blank out the doors/windows grid — and
    // each field keeps the time it was last observed.
    //
    // Drop any optimistic lock prediction that has outlived its window before
    // folding: the run that made it (remote-command-effects.ts) expires its
    // own, but a backgrounded or relaunched app leaves one behind, and a guess
    // must never outlive the attempt to confirm it.
    const store = applyObservation(
      expireOptimisticLocks(await loadClosureStore(), OPTIMISTIC_LOCK_MAX_AGE_MS),
      mapped.vin,
      { occurredAt: mapped.updatedAt, closures: mapped.closures },
    );
    await saveClosureStore(store);
    const vehicleStatus = parseVehicleStatus({ ...mapped, closures: readClosures(store) });
    Observe.logEvent("vehicle.status.load.completed", {
      attributes: { source: "lexus", durationMs: Math.round(performance.now() - startedAt) },
    });
    return vehicleStatus;
  } catch (error) {
    logLoadFailure("vehicle.status.load.failed", error, signal, startedAt);
    throw error;
  }
}

// Aborts happen when the screen unmounts or a refetch supersedes this request;
// they are lifecycle noise, not load failures.
function logLoadFailure(event: string, error: unknown, signal: AbortSignal, startedAt: number) {
  if (signal.aborted) {
    return;
  }
  Observe.logEvent(event, {
    severity: "error",
    body: error instanceof Error ? error.message : "Unknown error loading vehicle data",
    attributes: { source: "lexus", durationMs: Math.round(performance.now() - startedAt) },
  });
}
