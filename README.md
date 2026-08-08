# Lexy

Experimental Lexus remote-control tooling and mobile app, for iOS and Android.

The tracked tree contains code, tests, and the API reference under [`docs/`](docs/).
Local APKs, raw analysis output, and unpublished research stay in the gitignored
`scratchpad/` directory.

## Test

```sh
pnpm test                                   # app (vitest)
python3 -m unittest tools.test_lexusctl     # lexusctl CLI (run from repo root)
```

## lexusctl

`tools/lexusctl.py` is a one-shot desktop client for the Lexus remote API:

```sh
python3 tools/lexusctl.py status
python3 tools/lexusctl.py lock
python3 tools/lexusctl.py unlock
```

Credentials and vehicle metadata are read from the macOS Keychain (account
`Lexus OneApp`) and are never stored in the repository.

## Mobile app

The repo root is an Expo app (Expo Router + `@expo/ui`) that runs on iOS and
Android from one codebase, plus a "Lexy Status" iOS home screen widget
(`expo-widgets`) showing the vehicle's locked/unlocked state.

```sh
pnpm install
pnpm ios       # a dev build is required; expo-widgets is not in Expo Go
pnpm android
```

### One codebase, two native apps

iOS is the reference implementation and Android is a native Android app built
to the same contracts — not a port of the iOS screens. What that means in
practice, with the full rules in [`AGENTS.md`](AGENTS.md):

- **Screens are specified once, in [`specs/`](specs/)**, a tree that mirrors
  `src/app` file-for-file (enforced by a test). A screen's spec is the
  platform-neutral contract; each platform's tree is a rendering of it, and an
  intentional divergence is recorded under the spec's Platform notes. An
  undocumented difference is a bug on whichever platform moved.
- **The seam is Metro's platform suffixes.** SwiftUI trees live in `*.ios.tsx`
  and `src/components/swift-ui/`; Jetpack Compose trees in `*.android.tsx` and
  `src/components/jetpack-compose/`. A lint rule enforces both directions, so
  neither toolkit can leak into the other platform's bundle.
- **Everything below the view layer is shared**: authentication, the Lexus API
  client, the vehicle model, TanStack Query and its persisted cache, update
  handling, and the semantic icon registry that resolves a name to an SF Symbol
  or a Material icon per platform.

Two things are deliberately iOS-only: the home screen widget (`expo-widgets`
has no Android renderer yet) and the in-app maps chooser — Android hands a
`geo:` intent to the system instead, which routes to whatever navigation app
the user prefers. The parked-location map itself awaits a Google Maps API key.

No environment configuration is needed. The app talks to the production Lexus
OneApp API directly; the hosts are hard-coded in
[`src/data/lexus-api.ts`](src/data/lexus-api.ts). Never place Lexus OAuth tokens
or private API credentials in `EXPO_PUBLIC_` values.

Sign-in happens first-party on-device: the OAuth flow lives in
[`src/auth/`](src/auth/) and access/refresh tokens are held in the platform's
own secure storage via `expo-secure-store` — the iOS Keychain
(`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) and the Android Keystore — never in the
query cache. Once authenticated, the app discovers the vehicle (VIN + brand +
telematics generation) and reads its status, climate, spec, and tire endpoints,
mapping the responses into the normalized shape defined in
[`src/data/vehicle.ts`](src/data/vehicle.ts).

Vehicle state is server state, not an app-owned relational data model. TanStack
Query handles refresh and deduplication, and persists the last successful
snapshot through `expo-sqlite/kv-store` for fast startup and offline display
(see [`src/data/query-client.tsx`](src/data/query-client.tsx)). Network state
pauses queries while the device is offline, and the cache is wiped on sign-out
so no data survives an account switch. The key-value layout can grow into
relational tables when the app needs queryable trip history or queued commands.

## API reference

[`docs/`](docs/) documents the Lexus OneApp API surface used by this tooling —
all 285 REST endpoints by domain, the login/token flow, and the vehicle
status/command model. Start at [`docs/README.md`](docs/README.md).
