import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

const oneDay = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: oneDay,
      retry: 2,
      staleTime: 60 * 1000,
    },
  },
});

const persister = createAsyncStoragePersister({
  key: 'lexy-query-cache',
  storage: AsyncStorage,
});

export function VehicleDataProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ buster: 'vehicle-v1', maxAge: oneDay, persister }}>
      {children}
    </PersistQueryClientProvider>
  );
}
