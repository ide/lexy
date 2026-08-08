# Data state overrides

## Route & implementations

`/(tabs)/settings/data-state` (`src/app/(tabs)/settings/data-state.tsx` →
`src/screens/data-state-screen.tsx`) · iOS ✅ · Android ✅

## Purpose

Force the vehicle screens into each data state on demand, so the loading, offline, error, and empty
designs can be looked at without turning off Wi-Fi, signing into an empty account, or waiting for a
failure to happen on its own. Also the one place to forget the saved navigation-app preference.
Reachable only from the Developer Tools section, so only in development and preview builds.

## Data

- The current override, held in memory by the root-mounted debug provider
  (`src/debug/debug-overrides.tsx`). It is mounted in every build, but reads are gated on
  `SHOW_DEV_TOOLS`, so the override can never affect production even if it were somehow set.
- `DATA_STATE_OPTIONS` — the row list, in display order.
- `useMapsProvider()` — the saved navigation app, for the clear row.

## Structure

1. **DATA STATE** — one selectable row per option, with a checkmark on the active one:
   - Live — "Use the real Lexus data — no override."
   - Loading skeleton — "Hold the first-load skeleton / redacted layout."
   - Offline — cached data — "Show the last-seen dashboard behind the offline banner."
   - Offline — no cache — "Offline before anything was ever loaded."
   - Fetch error — cached data — "Show the last-seen dashboard behind the refresh-failed banner."
   - Fetch error — no cache — forces the full-screen "Vehicle data unavailable" error.
   - No vehicle on account — forces the "No vehicle found" empty state.

   Footer: the override applies to the Status and Details tabs, and resets to Live when the app
   reloads.
2. **PERSISTED STATE** (iOS only — Android has no saved maps provider to clear; its hand-off is a
   `geo:` intent the system resolves, see the map screen's Platform notes) — a destructive "Clear
   Maps provider" row, subtitled "Currently <name>" or
   "No saved provider". Footer: forgetting it makes the next map handoff resolve or ask again.

## States

- Exactly one option is always selected. It is Live at launch and after every reload — the override
  lives in memory only, which is the safe default.
- The clear row is disabled when no provider is saved.

## Interactions

- Tapping an option applies it immediately, with a selection haptic, and it stays applied until the
  app reloads. An override works by rewriting the result of the vehicle query the screens already
  read — only the fields they branch on are swapped — so each forced state drives the same code path
  production does rather than a parallel one. It also forces the connectivity signal to match: the
  offline states force offline, and the error and empty states force online, so the screens reach
  the error branch instead of the offline one (offline outranks an error in the banner).
- The two forced-cached states show a stand-in vehicle rendered unredacted, as if it were genuine
  cached data, parked at a recognizable stand-in location rather than at 0,0.
- "Clear Maps provider" forgets the saved choice immediately, with a medium impact haptic and no
  confirmation.
