import { useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  clearSavedMapsProviderId,
  detectInstalledMapsProviders,
  getSavedMapsProviderIdSnapshot,
  saveMapsProviderId,
  subscribeToMapsProvider,
} from "@/data/maps-preference";
import {
  getMapsProvider,
  resolveMapsProvider,
  type MapsProvider,
  type MapsProviderId,
  type MapsTarget,
  type ResolvedMapsProvider,
} from "@/data/maps-providers";

// A short, user-friendly explanation shown when the phone has none of the
// supported navigation apps, so the disabled "Open in Maps" link still tells
// the user why and what to do.
const NO_APPS_TITLE = "No maps app installed";
const NO_APPS_MESSAGE =
  "Install Apple Maps, Google Maps, or Waze from the App Store to open your vehicle's location for directions.";

/**
 * What a consumer's trigger should be presenting, or `null` for nothing.
 *
 * SwiftUI presents from a binding rather than from a call — `.confirmationDialog`
 * and `.alert` attach to the view that triggered them — so this hook describes
 * the presentation and lets the screen render it, instead of reaching for
 * `ActionSheetIOS` and showing UIKit chrome over a SwiftUI tree.
 */
export type MapsPrompt =
  | { kind: "choice"; options: MapsProvider[]; onPick: (provider: MapsProvider) => void }
  | { kind: "alert"; title: string; message: string };

type UseMapsProvider = {
  /** `null` until the first installation probe resolves. */
  resolved: ResolvedMapsProvider | null;
  /** The currently saved preference, if any. */
  saved: MapsProvider | null;
  /** Forget the saved choice. */
  clear: () => void;
  /**
   * The full "Open in Maps" flow for the map button: explain when nothing is
   * installed, open directly when a provider is resolved, or present the
   * chooser (remembering the pick) when several are installed with no saved
   * choice.
   */
  openInMaps: (target: MapsTarget) => void;
  /** Present the provider chooser (installed apps) and persist the pick. */
  promptChoice: () => void;
  /** Wrap the triggering view in `MapsProviderPrompt` and pass these two. */
  prompt: MapsPrompt | null;
  dismissPrompt: () => void;
};

export function useMapsProvider(): UseMapsProvider {
  const [installedIds, setInstalledIds] = useState<MapsProviderId[] | null>(null);
  const savedId = useSyncExternalStore(
    subscribeToMapsProvider,
    getSavedMapsProviderIdSnapshot,
    getSavedMapsProviderIdSnapshot,
  );

  const probe = useCallback(() => {
    let cancelled = false;
    detectInstalledMapsProviders()
      .then((ids) => {
        if (!cancelled) {
          setInstalledIds(ids);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstalledIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => probe(), [probe]);
  // Installed apps can change while the app is backgrounded (the user installs
  // Waze, deletes Google Maps), so re-probe every time a consumer screen gains
  // focus.
  useFocusEffect(probe);

  const resolved = installedIds === null ? null : resolveMapsProvider(savedId, installedIds);

  // A saved provider that is no longer installed is dropped from storage so the
  // preference genuinely reads "unset" and the user is prompted again.
  useEffect(() => {
    if (resolved?.staleSaved) {
      clearSavedMapsProviderId();
    }
  }, [resolved?.staleSaved]);

  const choose = useCallback((id: MapsProviderId) => {
    saveMapsProviderId(id);
  }, []);

  const clear = useCallback(() => {
    clearSavedMapsProviderId();
  }, []);

  const [prompt, setPrompt] = useState<MapsPrompt | null>(null);

  const dismissPrompt = useCallback(() => setPrompt(null), []);

  const explainNoApps = useCallback(() => {
    setPrompt({ kind: "alert", title: NO_APPS_TITLE, message: NO_APPS_MESSAGE });
  }, []);

  // Keep the latest resolution in a ref so the stable action callbacks below
  // always act on current state without being torn down and rebound each probe.
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  const open = useCallback((provider: MapsProvider, target: MapsTarget) => {
    Linking.openURL(provider.buildDirectionsUrl(target)).catch(() => {
      setPrompt({
        kind: "alert",
        title: `Couldn't open ${provider.name}`,
        message: "The app didn't respond to the location link. It may have just been removed.",
      });
    });
  }, []);

  const promptChoice = useCallback(() => {
    const current = resolvedRef.current;
    if (!current || current.kind === "none") {
      explainNoApps();
      return;
    }
    const options = current.kind === "prompt" ? current.options : installedProviders(installedIds);
    setPrompt({ kind: "choice", options, onPick: (provider) => choose(provider.id) });
  }, [choose, explainNoApps, installedIds]);

  const openInMaps = useCallback(
    (target: MapsTarget) => {
      const current = resolvedRef.current;
      if (!current) {
        return;
      }
      if (current.kind === "none") {
        explainNoApps();
        return;
      }
      if (current.kind === "ready") {
        open(current.provider, target);
        return;
      }
      // Several apps, no saved choice yet: ask, remember, then open.
      setPrompt({
        kind: "choice",
        options: current.options,
        onPick: (provider) => {
          choose(provider.id);
          open(provider, target);
        },
      });
    },
    [choose, explainNoApps, open],
  );

  return {
    resolved,
    saved: savedId === null ? null : getMapsProvider(savedId),
    clear,
    openInMaps,
    promptChoice,
    prompt,
    dismissPrompt,
  };
}

function installedProviders(ids: MapsProviderId[] | null): MapsProvider[] {
  if (!ids) {
    return [];
  }
  return resolveInstalledOrder(ids);
}

// Reuse resolveMapsProvider's canonical ordering without duplicating the list
// filter: a throwaway resolve on an unsaved id yields the ordered options.
function resolveInstalledOrder(ids: MapsProviderId[]): MapsProvider[] {
  const result = resolveMapsProvider(null, ids);
  if (result.kind === "prompt") {
    return result.options;
  }
  if (result.kind === "ready") {
    return [result.provider];
  }
  return [];
}
