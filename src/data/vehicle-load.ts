import { Observe } from "expo-observe";
import { fetch } from "expo/fetch";

import type { LexusSession } from "@/auth/lexus-auth";
import {
  LexusApiError,
  VEHICLE_CLIMATE_ENDPOINT,
  VEHICLE_DISCOVERY_ENDPOINT,
  VEHICLE_SPEC_ENDPOINT,
  VEHICLE_STATUS_ENDPOINT,
  VEHICLE_TIRES_ENDPOINT,
  businessHeaders,
  vehicleHeaders,
} from "@/data/lexus-api";
import { applyObservation, expireOptimisticLocks, readClosures } from "@/data/closure-state";
import { loadClosureStore, saveClosureStore } from "@/data/closure-state-store";
import { fetchVehicleSubscriptions } from "@/data/subscriptions";
import {
  mapVehicle,
  NoVehicleError,
  parseSubscriptionVehicle,
  parseVehicle,
  parseVehicleContexts,
  type Vehicle,
} from "@/data/vehicle";

async function getJson(url: string, headers: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new LexusApiError(`Lexus request failed (${response.status})`, response.status);
  }
  return response.json();
}

/**
 * The full vehicle load: discovery, the five scoped reads, the map into the UI
 * shape, and the closure-store fold. useVehicle owns only the query wiring.
 */
export async function loadVehicle(session: LexusSession, signal: AbortSignal): Promise<Vehicle> {
  const startedAt = performance.now();
  try {
    // Discover the car (VIN + brand + generation), then read status,
    // climate, spec, and tires with vehicle-scoped headers and map into the
    // UI shape.
    const discovery = await getJson(VEHICLE_DISCOVERY_ENDPOINT, businessHeaders(session), signal);
    const contexts = parseVehicleContexts(discovery);
    if (contexts.length === 0) {
      throw new NoVehicleError();
    }
    // The first vehicle is the primary until a switcher exists; a 2+ car
    // account still loads and works, it just shows this one for now.
    const scoped = vehicleHeaders(session, contexts[0]);
    // Connected-services subscriptions are non-critical: a failure (or a
    // discovery record missing the region/ASI/hardware fields the v3 list
    // requires) leaves the card empty rather than failing the whole load.
    const subscriptionVehicle = parseSubscriptionVehicle(discovery);
    const [status, climate, spec, tires, subscriptions] = await Promise.all([
      getJson(VEHICLE_STATUS_ENDPOINT, scoped, signal),
      getJson(VEHICLE_CLIMATE_ENDPOINT, scoped, signal),
      getJson(VEHICLE_SPEC_ENDPOINT, scoped, signal),
      getJson(VEHICLE_TIRES_ENDPOINT, scoped, signal).catch(() => null),
      subscriptionVehicle
        ? fetchVehicleSubscriptions(session, subscriptionVehicle, {
            request: (url, init) => fetch(url, { ...init, signal }),
          }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const mapped = mapVehicle(discovery, status, climate, spec, tires, subscriptions);
    // The status feed alternates between full and sparse snapshots (see
    // closure-state.ts). Fold this observation into the persisted
    // last-known-state store and render the materialized view, so a
    // lock-only snapshot after a drive doesn't blank out the doors/windows
    // grid — and each field keeps the time it was last observed.
    // Drop any optimistic lock prediction that has outlived its window before
    // folding — the run that made it (remote-command-effects.ts) expires its
    // own, but a backgrounded or relaunched app leaves one behind, and a guess
    // must never outlive the attempt to confirm it.
    const store = applyObservation(expireOptimisticLocks(await loadClosureStore()), mapped.vin, {
      occurredAt: mapped.updatedAt,
      closures: mapped.closures,
    });
    await saveClosureStore(store);
    const vehicle = parseVehicle({ ...mapped, closures: readClosures(store) });
    Observe.logEvent("vehicle.load.completed", {
      attributes: { source: "lexus", durationMs: Math.round(performance.now() - startedAt) },
    });
    return vehicle;
  } catch (error) {
    // Aborts happen when the screen unmounts or a refetch supersedes this
    // request; they are lifecycle noise, not load failures.
    if (!signal.aborted) {
      Observe.logEvent("vehicle.load.failed", {
        severity: "error",
        body: error instanceof Error ? error.message : "Unknown error loading vehicle data",
        attributes: { source: "lexus", durationMs: Math.round(performance.now() - startedAt) },
      });
    }
    throw error;
  }
}
