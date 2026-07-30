import Storage from "expo-sqlite/kv-store";
import * as Linking from "expo-linking";

import {
  MAPS_PROVIDERS,
  isMapsProviderId,
  type MapsProviderId,
} from "@/data/maps-providers";

// The user's chosen navigation app, persisted in the same SQLite-backed
// key-value store the query cache uses (expo-sqlite/kv-store). Read/written
// synchronously so the Status screen and Settings row can render the right
// label on first paint without a loading flash.
const STORAGE_KEY = "maps-provider";

export function readSavedMapsProviderId(): MapsProviderId | null {
  const value = Storage.getItemSync(STORAGE_KEY);
  return isMapsProviderId(value) ? value : null;
}

export function saveMapsProviderId(id: MapsProviderId): void {
  Storage.setItemSync(STORAGE_KEY, id);
}

export function clearSavedMapsProviderId(): void {
  Storage.removeItemSync(STORAGE_KEY);
}

/**
 * Probe which navigation apps are installed. `Linking.canOpenURL` resolves true
 * only for schemes declared in `LSApplicationQueriesSchemes` (app.json), so
 * every provider's `probeUrl` scheme is listed there. A probe that rejects
 * (rare) is treated as "not installed".
 */
export async function detectInstalledMapsProviders(): Promise<MapsProviderId[]> {
  const results = await Promise.all(
    MAPS_PROVIDERS.map(async (provider) => {
      try {
        return (await Linking.canOpenURL(provider.probeUrl)) ? provider.id : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((id): id is MapsProviderId => id !== null);
}
