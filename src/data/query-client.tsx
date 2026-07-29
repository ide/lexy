import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      retry: 2,
      staleTime: 60 * 1000,
    },
  },
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

const persister = createAsyncStoragePersister({
  key: 'lexy-query-cache',
  storage: Storage,
});

/**
 * Wipe every cached query — both the in-memory store and the persisted SQLite
 * blob — so no vehicle or account data survives sign-out. Called from the auth
 * `signOut` so a signed-out (or freshly switched) account never sees the prior
 * user's car data.
 */
export async function clearVehicleCache() {
  queryClient.clear();
  await persister.removeClient();
}

export function VehicleDataProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ buster: 'vehicle-v1', maxAge: Infinity, persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
