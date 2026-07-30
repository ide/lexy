import type { SFSymbol } from "sf-symbols-typescript";

/**
 * The external navigation apps Lexy can hand a location off to. Apple Maps,
 * Google Maps, and Waze each get their own deep-link scheme; the app is present
 * on the phone iff `Linking.canOpenURL(probeUrl)` resolves true (which is why
 * every scheme here is also declared under `LSApplicationQueriesSchemes` in
 * app.json — canOpenURL returns false for any undeclared scheme).
 */
export type MapsProviderId = "apple" | "google" | "waze";

export type MapsProvider = {
  id: MapsProviderId;
  /** Full name for buttons and the settings row ("Apple Maps"). */
  name: string;
  /** SF Symbol shown beside the provider in Settings. */
  icon: SFSymbol;
  /**
   * A minimal URL used only to probe installation via `canOpenURL`. It is never
   * opened — {@link buildDirectionsUrl} produces the URL that actually launches
   * the app at the car's location.
   */
  probeUrl: string;
  /** The deep link that drops a pin / starts navigation at the coordinates. */
  buildDirectionsUrl: (target: MapsTarget) => string;
};

export type MapsTarget = {
  latitude: number;
  longitude: number;
  /** A human label for the pin (the car's nickname). */
  label: string;
};

// Declared order is the order providers appear in the chooser / settings.
export const MAPS_PROVIDERS: readonly MapsProvider[] = [
  {
    id: "apple",
    name: "Apple Maps",
    icon: "map.fill",
    // `maps://` must be declared in LSApplicationQueriesSchemes to be probeable;
    // Apple Maps is a system app but is removable since iOS 14, so we still
    // detect it rather than assuming it is present.
    probeUrl: "maps://",
    buildDirectionsUrl: ({ latitude, longitude, label }) =>
      `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(
        label,
      )}`,
  },
  {
    id: "google",
    name: "Google Maps",
    icon: "map.fill",
    probeUrl: "comgooglemaps://",
    // `q=lat,lng` drops a pin at the coordinates; the label rides along in the
    // parenthetical so the pin reads as the car rather than a bare coordinate.
    buildDirectionsUrl: ({ latitude, longitude, label }) =>
      `comgooglemaps://?q=${latitude},${longitude}(${encodeURIComponent(
        label,
      )})&center=${latitude},${longitude}`,
  },
  {
    id: "waze",
    name: "Waze",
    icon: "location.fill",
    probeUrl: "waze://",
    // Waze has no concept of a named pin; it navigates straight to the point.
    buildDirectionsUrl: ({ latitude, longitude }) =>
      `waze://?ll=${latitude},${longitude}&navigate=yes`,
  },
] as const;

const PROVIDERS_BY_ID: Record<MapsProviderId, MapsProvider> = Object.fromEntries(
  MAPS_PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<MapsProviderId, MapsProvider>;

export function getMapsProvider(id: MapsProviderId): MapsProvider {
  return PROVIDERS_BY_ID[id];
}

export function isMapsProviderId(value: unknown): value is MapsProviderId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PROVIDERS_BY_ID, value)
  );
}

/**
 * The outcome of reconciling the saved preference against what is actually
 * installed, computed by {@link resolveMapsProvider}. Kept a pure data type so
 * the branching (auto-pick single, prompt on many, disable on none, drop a
 * stale saved choice) is unit-testable without Linking or storage.
 *
 * - `none`  — no map apps installed; the link is disabled and explains why.
 * - `ready` — a single provider to open directly. `remembered` is true when it
 *             came from the saved preference (button reads "Open in <app>" and
 *             opens on tap), false when it was auto-picked because it is the
 *             only installed app (also opens directly, no prompt).
 * - `prompt`— several apps installed and no valid saved choice: ask the user,
 *             remember the pick. `options` lists the installed providers.
 * - `staleSaved` is true when a previously saved provider is no longer
 *   installed, so callers know to clear it ("the setting is unset").
 */
export type ResolvedMapsProvider =
  | { kind: "none"; staleSaved: boolean }
  | { kind: "ready"; provider: MapsProvider; remembered: boolean; staleSaved: boolean }
  | { kind: "prompt"; options: MapsProvider[]; staleSaved: boolean };

export function resolveMapsProvider(
  savedId: MapsProviderId | null,
  installedIds: readonly MapsProviderId[],
): ResolvedMapsProvider {
  // Keep the installed list in the canonical MAPS_PROVIDERS order regardless of
  // detection order, and drop anything unrecognized.
  const installed = MAPS_PROVIDERS.filter((provider) =>
    installedIds.includes(provider.id),
  );
  const savedInstalled =
    savedId !== null && installed.some((provider) => provider.id === savedId);
  // A saved choice the phone no longer has: treat as unset and flag it so the
  // caller can clear the stored value and (re)prompt.
  const staleSaved = savedId !== null && !savedInstalled;

  if (installed.length === 0) {
    return { kind: "none", staleSaved };
  }
  if (savedInstalled) {
    return {
      kind: "ready",
      provider: getMapsProvider(savedId as MapsProviderId),
      remembered: true,
      staleSaved: false,
    };
  }
  if (installed.length === 1) {
    // Exactly one app: just use it, don't prompt and don't persist it as a
    // deliberate choice (so installing more later prompts again).
    return { kind: "ready", provider: installed[0], remembered: false, staleSaved };
  }
  return { kind: "prompt", options: installed, staleSaved };
}
