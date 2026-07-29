# Lexy

Experimental, iOS-only Lexus remote-control tooling and mobile app.

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

The repo root is an Expo app (Expo Router + `@expo/ui`) with a "Lexy Status" iOS
home screen widget (`expo-widgets`) that shows the vehicle's locked/unlocked
state. It is iOS-only by design — see [`AGENTS.md`](AGENTS.md).

```sh
pnpm install
pnpm ios   # expo-widgets is not supported in Expo Go; a dev build is required
```

No environment configuration is needed. The app talks to the production Lexus
OneApp API directly; the hosts are hard-coded in
[`src/data/lexus-api.ts`](src/data/lexus-api.ts). Never place Lexus OAuth tokens
or private API credentials in `EXPO_PUBLIC_` values.

Sign-in happens first-party on-device: the OAuth flow lives in
[`src/auth/`](src/auth/) and access/refresh tokens are held in the iOS Keychain
via `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), never in the query
cache. Once authenticated, the app discovers the vehicle (VIN + brand +
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
