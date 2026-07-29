import { hashKey, type QueryKey } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

import { parseVehicle } from '@/data/vehicle';

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
 * History: v2 renamed the distance fields and added `distanceUnit`.
 */
export const CACHE_VERSION = 'vehicle-v2';

// Per-query validators, keyed by the hash React Query stores next to each
// persisted query (`hashKey`, so the keys track the real query keys). A
// persisted query whose key has a validator is dropped on restore if its data
// no longer parses; keys without one pass through untouched.
const VALIDATORS: Record<string, (data: unknown) => void> = {
  [hashKey(['vehicle'] satisfies QueryKey)]: (data) => {
    parseVehicle(data);
  },
};

/**
 * Wrap a persister so restored queries are re-validated before they hydrate.
 *
 * React Query rehydrates persisted data as-is: it does not re-run the `queryFn`
 * parse path on restore, so without this a `Vehicle` written by an older build
 * with an incompatible shape would be handed straight to the UI (a crash or a
 * mis-render, not a refetch). Any `['vehicle']` blob that fails `parseVehicle`
 * is dropped here, so the worst case for a shape mismatch the version bump
 * missed is a cold load (skeleton → data) rather than broken UI.
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
        const validate = VALIDATORS[query.queryHash];
        if (!validate) {
          return true;
        }
        try {
          validate(query.state.data);
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
