import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Tracks whether the device currently has a usable internet connection.
 *
 * This reads from React Query's `onlineManager`, which `query-client.tsx`
 * already drives from NetInfo. Reusing it (instead of subscribing to NetInfo
 * again) means the banner and the query's paused/active state always agree:
 * when this returns `false`, the vehicle query is paused, and vice versa.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
