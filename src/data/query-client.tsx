import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { AppState, type AppStateStatus } from 'react-native';

import { clearClosureStore } from '@/data/closure-state-store';
import { CACHE_VERSION, createValidatingPersister } from '@/data/persisted-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      retry: 2,
      staleTime: 60 * 1000,
    },
  },
});

// Refetch on foreground: React Query's `refetchOnWindowFocus` is a no-op in
// React Native until the focus manager is wired to AppState. With this in
// place, returning to the app re-runs any query that has gone stale
// (staleTime is 60s) in the background — cached vehicle data stays on screen
// while the refresh runs, so opening the app after a while quietly refreshes.
focusManager.setEventListener((handleFocus) => {
  const onChange = (state: AppStateStatus) => {
    handleFocus(state === 'active');
  };
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) => {
  const apply = (state: Network.NetworkState) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  };
  // `addNetworkStateListener` only fires on change, so seed the current state on
  // subscribe to match the immediate-emit behavior the online manager expects
  // (otherwise an app launched offline would look online until the next change).
  Network.getNetworkStateAsync().then(apply).catch(() => {});
  const subscription = Network.addNetworkStateListener(apply);
  return () => subscription.remove();
});

// Re-validate persisted queries on restore (drop any `['vehicle']` blob an
// older build wrote in an incompatible shape) on top of the raw SQLite-backed
// persister. See persisted-cache.ts.
const persister = createValidatingPersister(
  createAsyncStoragePersister({
    key: 'lexy-query-cache',
    storage: Storage,
  }),
);

/**
 * Wipe every cached query — both the in-memory store and the persisted SQLite
 * blob — so no vehicle or account data survives sign-out. Called from the auth
 * `signOut` so a signed-out (or freshly switched) account never sees the prior
 * user's car data.
 */
export async function clearVehicleCache() {
  queryClient.clear();
  await persister.removeClient();
  // The closure state store lives outside the query cache but is vehicle
  // data all the same.
  await clearClosureStore();
}

export function VehicleDataProvider({ children }: { children: React.ReactNode }) {
  return (
    // The buster (CACHE_VERSION) invalidates persisted entries whenever the
    // cached Vehicle shape changes, so an old cache is refetched rather than
    // rendered with missing fields. See persisted-cache.ts for when to bump it.
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ buster: CACHE_VERSION, maxAge: Infinity, persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
