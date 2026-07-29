import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { overrideIsOnline } from '@/debug/data-state';
import { useDataStateOverride } from '@/debug/debug-overrides';

/**
 * Tracks whether the device currently has a usable internet connection.
 *
 * This reads from React Query's `onlineManager`, which `query-client.tsx`
 * already drives from `expo-network`. Reusing it (instead of subscribing to the
 * network state again) means the banner and the query's paused/active state agree:
 * when this returns `false`, the vehicle query is paused, and vice versa.
 */
export function useIsOnline(): boolean {
  const real = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
  // In dev/preview a Data State override can force offline/online to preview the
  // banners; in production this is always 'live' and returns the real state.
  return overrideIsOnline(real, useDataStateOverride());
}
