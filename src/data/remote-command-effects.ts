import {
  applyOptimisticLock,
  expireOptimisticLocks,
  hasOptimisticLock,
  readClosures,
} from "@/data/closure-state";
import { loadClosureStore, saveClosureStore } from "@/data/closure-state-store";
import {
  ENGINE_POLL_COUNT,
  ENGINE_POLL_INTERVAL_MS,
  ENGINE_STATUS_QUERY_KEY,
} from "@/data/engine-status";
import type { VehicleContext } from "@/data/lexus-api";
import { reconcileLock } from "@/data/lock-reconcile";
import { queryClient } from "@/data/query-client";
import type { RemoteCommand } from "@/data/remote-command";
import type { VehicleStatus } from "@/data/vehicle";
import { vehicleStatusQueryKey } from "@/data/vehicle-keys";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Put the closure store's materialized view into the status query, so a change
 * the store made — a prediction applied, or one stood down — shows on screen
 * without a round trip.
 */
function publishClosures(vin: string, closures: VehicleStatus["closures"]) {
  queryClient.setQueryData<VehicleStatus>(vehicleStatusQueryKey(vin), (old) =>
    old ? { ...old, closures } : old,
  );
}

/**
 * Stand the prediction down: put the last real reading back, rather than leave
 * a guess on screen as though it were state. Only predictions at least as old
 * as this command expire, so a newer command that is still reconciling keeps
 * its own.
 *
 * Quietly — the row simply returns to what the vehicle last reported. The
 * pending label going away is the whole message: there is nothing to act on
 * that pulling to refresh (or looking at the car) doesn't already cover.
 */
async function abandonPrediction(vin: string, sentAt: number) {
  const store = await loadClosureStore();
  if (!store) {
    return;
  }
  const now = Date.now();
  // Anything stamped at or before our send time is ours (or older); a newer
  // command's prediction outlives this one.
  const expired = expireOptimisticLocks(store, now - sentAt, now) ?? store;
  if (expired === store) {
    // Nothing of ours was still standing — it settled between the last read
    // and here, or a newer command already took the prediction over.
    return;
  }
  await saveClosureStore(expired);
  publishClosures(vin, readClosures(expired));
}

/**
 * Reflect a remote command the server just accepted (not completed) in local
 * state. For lock/unlock, optimistically fold the predicted lock state into the
 * closure store — flagged optimistic so the screen shows it as pending — and
 * push it into the cache for an instant reflection. (Engine start/stop changes
 * no closure, so there's nothing to predict there — it's confirmed by polling
 * engine-status instead.) `primeStatus` should request a fresh server-side
 * snapshot from the car (refreshVehicleStatus); it backs the reconciliation's
 * last resort.
 */
export async function reflectAcceptedCommand(
  context: VehicleContext,
  command: RemoteCommand,
  primeStatus?: () => Promise<boolean>,
) {
  const { vin } = context;
  const sentAt = Date.now();
  if (command === "engine-start" || command === "engine-stop") {
    // Engine state lives on its own route, and a remote start takes a while to
    // actually turn over — so confirm the way the official app does, by polling
    // engine-status four times at 20s rather than trusting the acceptance. The
    // first pass is immediate so a fast car reflects right away.
    for (let poll = 0; poll < ENGINE_POLL_COUNT; poll++) {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ENGINE_STATUS_QUERY_KEY });
      }, poll * ENGINE_POLL_INTERVAL_MS);
    }
    return;
  }
  if (command === "door-lock" || command === "door-unlock") {
    const store = applyOptimisticLock(
      await loadClosureStore(),
      vin,
      command === "door-lock",
      new Date(sentAt).toISOString(),
    );
    await saveClosureStore(store);
    publishClosures(vin, readClosures(store));
    // Reconcile in the background — each re-read GETs status without waking the
    // car, and the fold merges its (possibly partial, possibly stale) payload
    // without clobbering the optimistic value. Not awaited: the schedule spans
    // a minute or so and the caller only needs acceptance.
    //
    // The schedule and its control flow live in lock-reconcile.ts, where they
    // are testable; what is bound here is only what each step *means* in this
    // app.
    reconcileLock({
      sleep,
      // Just the status snapshot: the question is whether the car has reported
      // the new lock state, and nothing in the profile can answer it.
      readStatus: async () => {
        await queryClient.refetchQueries({ queryKey: vehicleStatusQueryKey(vin) });
      },
      hasPrediction: async () => hasOptimisticLock(await loadClosureStore()),
      prime: primeStatus,
      abandon: () => abandonPrediction(vin, sentAt),
    }).catch(() => {});
    return;
  }
  queryClient.invalidateQueries({ queryKey: vehicleStatusQueryKey(vin) });
}
