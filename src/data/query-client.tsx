import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  focusManager,
  hydrate,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { persistQueryClientSubscribe } from "@tanstack/react-query-persist-client";
import * as Network from "expo-network";
import Storage from "expo-sqlite/kv-store";
import { AppState, type AppStateStatus } from "react-native";

import { clearClosureStore } from "@/data/closure-state-store";
import { CACHE_VERSION, readPersistedClient } from "@/data/persisted-cache";

const CACHE_KEY = "lexy-query-cache";

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
    handleFocus(state === "active");
  };
  const subscription = AppState.addEventListener("change", onChange);
  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) => {
  const apply = (state: Network.NetworkState) => {
    setOnline(state.isConnected === true && state.isInternetReachable !== false);
  };
  // `addNetworkStateListener` only fires on change, so seed the current state on
  // subscribe to match the immediate-emit behavior the online manager expects
  // (otherwise an app launched offline would look online until the next change).
  Network.getNetworkStateAsync()
    .then(apply)
    .catch(() => {});
  const subscription = Network.addNetworkStateListener(apply);
  return () => subscription.remove();
});

// Hydrate here, at module scope, from the *synchronous* SQLite read — before
// React renders anything at all.
//
// This was `PersistQueryClientProvider`, whose restore is a promise: the app had
// to render something while it settled and then re-render once it landed. There
// was nothing worth rendering in that window — a skeleton standing in for data
// already on disk — so the tree was held at `null` instead, which is what made
// a launch a blank screen followed by a screen.
//
// Read synchronously and the question stops existing. The cached car is in the
// client before the first render, so the first render has it, and the splash
// hands over to a finished screen rather than an empty one. It is one row of a
// few KB, read before there is a frame to drop.
const persistedClient = readPersistedClient(Storage.getItemSync(CACHE_KEY));
if (persistedClient) {
  hydrate(queryClient, persistedClient.clientState);
}

// Writing back stays asynchronous, because nothing waits on it. The buster is
// stamped on every save so the read above can reject a cache an older,
// incompatible build wrote. Nothing else expires it — freshness is the vehicle
// queries' job, not the persister's.
const persister = createAsyncStoragePersister({ key: CACHE_KEY, storage: Storage });

persistQueryClientSubscribe({ queryClient, persister, buster: CACHE_VERSION });

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
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
