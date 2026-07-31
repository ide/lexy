import { applyOptimisticLock, readClosures } from "@/data/closure-state";
import { loadClosureStore, saveClosureStore } from "@/data/closure-state-store";
import {
  ENGINE_POLL_COUNT,
  ENGINE_POLL_INTERVAL_MS,
  ENGINE_STATUS_QUERY_KEY,
} from "@/data/engine-status";
import { queryClient } from "@/data/query-client";
import type { RemoteCommand } from "@/data/remote-command";
import type { Vehicle } from "@/data/vehicle";

/**
 * Reflect a remote command the server just accepted (not completed) in local
 * state. For lock/unlock, optimistically fold the predicted lock state into
 * the closure store — flagged optimistic so the screen shows it as pending —
 * and push it into the cache for an instant reflection. (Engine start/stop
 * changes no closure, so there's nothing to predict there — it's confirmed by
 * polling engine-status instead.)
 */
export async function reflectAcceptedCommand(vin: string, command: RemoteCommand) {
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
      new Date().toISOString(),
    );
    await saveClosureStore(store);
    const closures = readClosures(store);
    queryClient.setQueryData<Vehicle>(["vehicle"], (old) => (old ? { ...old, closures } : old));
  }
  // Reconcile with the server via a non-waking status read: the plain
  // vehicle refetch GETs status without priming the telematics unit, and
  // the fold merges its (possibly partial, possibly stale) payload without
  // clobbering the optimistic value. A second pass a few seconds later
  // catches late propagation.
  queryClient.invalidateQueries({ queryKey: ["vehicle"] });
  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: ["vehicle"] });
  }, 5000);
}
