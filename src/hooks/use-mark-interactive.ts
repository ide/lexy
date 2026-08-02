import { useObserve } from "expo-observe";
import { useEffect } from "react";

/**
 * Report this screen's shell as interactive to Observe, once on mount.
 *
 * TTI marks the UI becoming usable, not the data arriving — vehicle data
 * readiness is tracked separately by the load events.
 */
export function useMarkInteractive() {
  const { markInteractive } = useObserve();
  useEffect(() => {
    markInteractive();
  }, [markInteractive]);
}
