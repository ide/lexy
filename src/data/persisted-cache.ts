import type { PersistedClient } from "@tanstack/react-query-persist-client";

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
 * v4 changed what `Capability.symbol` *means*: it named an SF Symbol
 * ("lock.fill") and now names an icon-registry key ("lock"), which each
 * platform resolves to its own glyph. Old values still look like strings, so
 * only this bump keeps a returning user from hydrating names the registry has
 * never heard of.
 */
export const CACHE_VERSION = "vehicle-v4";

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
 * Drop any persisted query whose data can no longer be trusted.
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
function validatePersistedClient(restored: PersistedClient): PersistedClient {
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
}

/**
 * Turn a raw persisted blob into the state to hydrate, or null when there is
 * nothing usable in it.
 *
 * Split out from the storage read so the decisions — is this JSON, is it this
 * build's cache, does its data still parse — stay testable in plain Node while
 * the SQLite call sits at the edge (see query-client.tsx).
 */
export function readPersistedClient(raw: string | null): PersistedClient | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Truncated or corrupt storage reads as an empty cache, which costs a cold
    // load and nothing else.
    return null;
  }
  const client = parsed as PersistedClient | null;
  if (!client || typeof client !== "object" || !client.clientState) {
    return null;
  }
  // The buster check React Query would have done for us. Without it an old
  // build's cache would hydrate into a shape this one cannot read.
  if (client.buster !== CACHE_VERSION) {
    return null;
  }
  return validatePersistedClient(client);
}
