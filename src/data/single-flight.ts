/**
 * One operation at a time, with its in-flight state observable.
 *
 * Two needs, met by the same object because they are the same fact. Callers
 * that would start a second run while one is going join the first instead —
 * every vehicle screen runs the same refresh policy, and a foreground wakes
 * them together. And what is running is exactly what the UI wants to announce,
 * so `subscribe`/`isRunning` form a `useSyncExternalStore` source rather than
 * leaving the screen to infer it from something adjacent (a query's
 * `isFetching`, say, which is also true for reads this never started).
 *
 * Pure and store-agnostic — see vehicle-refresh.ts for the instance that
 * matters.
 */
export type SingleFlight = {
  /** Run `operation`, or join the run already in progress. */
  run: (operation: () => Promise<void>) => Promise<void>;
  isRunning: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

export function createSingleFlight(): SingleFlight {
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    run(operation) {
      if (inFlight) {
        return inFlight;
      }
      // Settled in a `finally` so a rejected operation still clears the slot:
      // a failure that left this latched would block every later run and pin
      // the indicator on forever. The rejection itself is the caller's.
      inFlight = operation().finally(() => {
        inFlight = null;
        notify();
      });
      notify();
      return inFlight;
    },
    isRunning: () => inFlight !== null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
