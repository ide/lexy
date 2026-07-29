import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  }),
);

const persister = createAsyncStoragePersister({
  key: 'lexy-query-cache',
  storage: Storage,
});

export function VehicleDataProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ buster: 'vehicle-v1', maxAge: Infinity, persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
