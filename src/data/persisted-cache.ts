import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

import { parseVehicleProfile, parseVehicleStatus } from "@/data/vehicle";
import { isVehicleProfileKey, isVehicleStatusKey } from "@/data/vehicle-keys";

/**
 * Version stamp for the on-disk query cache. React Query's persister discards a
 * persisted cache whose `buster` no longer matches this string, so bumping it
 * makes returning users fetch fresh instead of hydrating data written by an
 * older, incompatible build.
 *
 * Bump this whenever a persisted shape changes in a way old data can't satisfy:
 * a field added/removed/renamed on `Vehicle`, a field's type changed, or — the
 * important one — a value's *meaning* changed (e.g. a distance that switches
 * from miles to kilometers). That last case is exactly what validation below
 * cannot catch, because the shape still looks valid, so the version bump is the
 * only safety net for it.
 *
 * History: v2 renamed the distance fields and added `distanceUnit`. v3 split
 * the single `['vehicle']` blob into a profile and a VIN-keyed status snapshot.
 */
export const CACHE_VERSION = "vehicle-v3";

type Validator = {
  /** Whether this validator is the one for a given persisted query key. */
  claims: (key: readonly unknown[]) => boolean;
  /** Throws when the persisted data can no longer be trusted. */
  validate: (data: unknown) => void;
};

// Matched against the query key rather than its hash, because the status key
// carries a VIN and so cannot be enumerated ahead of time. A persisted query a
// validator claims is dropped on restore if its data no longer parses; keys no
// validator claims pass through untouched.
const VALIDATORS: Validator[] = [
  {
    claims: isVehicleProfileKey,
    // The profile query caches the request context alongside the profile.
    validate: (data) => {
      parseVehicleProfile((data as { profile?: unknown } | null)?.profile);
    },
  },
  {
    claims: isVehicleStatusKey,
    validate: (data) => {
      parseVehicleStatus(data);
    },
  },
];

/**
 * Wrap a persister so restored queries are re-validated before they hydrate.
 *
 * React Query rehydrates persisted data as-is: it does not re-run the `queryFn`
 * parse path on restore, so without this a vehicle blob written by an older
 * build with an incompatible shape would be handed straight to the UI (a crash
 * or a mis-render, not a refetch). Any blob that fails its validator is dropped
 * here, so the worst case for a shape mismatch the version bump missed is a
 * cold load (skeleton → data) rather than broken UI.
 *
 * This is a second line of defense behind {@link CACHE_VERSION}: the version
 * bump is the intended lever for breaking changes; this catches the ones that
 * slip through (a forgotten bump, or partially corrupted storage).
 */
export function createValidatingPersister(base: Persister): Persister {
  return {
    persistClient: base.persistClient,
    removeClient: base.removeClient,
    async restoreClient() {
      const restored = await base.restoreClient();
      if (!restored) {
        return restored;
      }
      const queries = restored.clientState.queries.filter((query) => {
        const validator = VALIDATORS.find((candidate) => candidate.claims(query.queryKey));
        if (!validator) {
          return true;
        }
        try {
          validator.validate(query.state.data);
          return true;
        } catch {
          return false;
        }
      });
      if (queries.length === restored.clientState.queries.length) {
        return restored;
      }
      return {
        ...restored,
        clientState: { ...restored.clientState, queries },
      } satisfies PersistedClient;
    },
  };
}
