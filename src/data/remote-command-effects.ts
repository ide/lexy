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
import { queryClient } from "@/data/query-client";
import type { RemoteCommand } from "@/data/remote-command";
import type { Vehicle } from "@/data/vehicle";

// When to re-read status after a lock/unlock, measured from acceptance. The
// car pushes its own status event once the actuation lands, but propagation
// into the non-waking GET takes anywhere from seconds to half a minute — the
// old two fixed refetches (0s/5s) routinely both saw the pre-command snapshot,
// and the pending "Unlocking…" then sat on screen until a manual refresh.
const LOCK_RECONCILE_AT_MS = [0, 5_000, 12_000, 25_000];

// And when to re-read after the `prime` escalation, measured from the prime
// returning. Waking the telematics unit is the strongest ask we have, but the
// car still needs a few seconds to answer it, so the reads that follow are what
// gives that ask a chance — a single immediate one lands before the wake does.
const LOCK_RECONCILE_AFTER_PRIME_MS = [3_000, 9_000, 18_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Re-read status on the given schedule (offsets from now), stopping as soon as
// the optimistic prediction is confirmed or corrected — each vehicle refetch
// folds the server reading into the closure store, see vehicle-load.ts.
// Returns whether the prediction settled.
async function pollUntilSettled(schedule: readonly number[]): Promise<boolean> {
  let elapsed = 0;
  for (const at of schedule) {
    await sleep(at - elapsed);
    elapsed = at;
    if (!hasOptimisticLock(await loadClosureStore())) {
      return true;
    }
    await queryClient.refetchQueries({ queryKey: ["vehicle"] });
    if (!hasOptimisticLock(await loadClosureStore())) {
      return true;
    }
  }
  return false;
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
async function abandonPrediction(sentAt: number) {
  const store = await loadClosureStore();
  if (!store) {
    return;
  }
  const now = Date.now();
  // Anything stamped at or before our send time is ours (or older); a newer
  // command's prediction outlives this one.
  const expired = expireOptimisticLocks(store, now, now - sentAt) ?? store;
  if (expired === store) {
    // Nothing of ours was still standing — it settled between the last read
    // and here, or a newer command already took the prediction over.
    return;
  }
  await saveClosureStore(expired);
  const closures = readClosures(expired);
  queryClient.setQueryData<Vehicle>(["vehicle"], (old) => (old ? { ...old, closures } : old));
}

// Re-read status until the optimistic lock prediction is confirmed or
// corrected. If the whole schedule passes and the store still holds a
// prediction, escalate once to `prime` — the same telematics wake that
// pull-to-refresh sends — and read the car again a few times. If it still
// hasn't reported, the command's outcome is genuinely unknown: expire the
// prediction rather than show it indefinitely.
async function reconcileLock(sentAt: number, prime?: () => Promise<boolean>) {
  if (await pollUntilSettled(LOCK_RECONCILE_AT_MS)) {
    return;
  }
  if (prime && (await prime().catch(() => false))) {
    if (await pollUntilSettled(LOCK_RECONCILE_AFTER_PRIME_MS)) {
      return;
    }
  }
  await abandonPrediction(sentAt);
}

/**
 * Reflect a remote command the server just accepted (not completed) in local
 * state. For lock/unlock, optimistically fold the predicted lock state into
 * the closure store — flagged optimistic so the screen shows it as pending —
 * and push it into the cache for an instant reflection. (Engine start/stop
 * changes no closure, so there's nothing to predict there — it's confirmed by
 * polling engine-status instead.) `primeStatus` should request a fresh
 * server-side snapshot from the car (refreshVehicleStatus); it backs the
 * reconciliation's last resort.
 */
export async function reflectAcceptedCommand(
  vin: string,
  command: RemoteCommand,
  primeStatus?: () => Promise<boolean>,
) {
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
  }
  if (command === "door-lock" || command === "door-unlock") {
    const store = applyOptimisticLock(
      await loadClosureStore(),
      vin,
      command === "door-lock",
      new Date(sentAt).toISOString(),
    );
    await saveClosureStore(store);
    const closures = readClosures(store);
    queryClient.setQueryData<Vehicle>(["vehicle"], (old) => (old ? { ...old, closures } : old));
    // Reconcile in the background — each refetch GETs status without waking
    // the car, and the fold merges its (possibly partial, possibly stale)
    // payload without clobbering the optimistic value. Not awaited: the
    // schedule spans a minute or so and the caller only needs acceptance.
    reconcileLock(sentAt, primeStatus).catch(() => {});
    return;
  }
  queryClient.invalidateQueries({ queryKey: ["vehicle"] });
}
