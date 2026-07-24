# Lexy

Experimental Lexus remote-control tooling and mobile app.

The tracked tree contains code, tests, and the API reference under [`docs/`](docs/).
Local APKs, raw analysis output, and unpublished research stay in the gitignored
`scratchpad/` directory.

## Test

```sh
python3 -m unittest -v tests/test_lexusctl.py
```

## Run

```sh
python3 tools/lexusctl.py status
python3 tools/lexusctl.py lock
python3 tools/lexusctl.py unlock
```

Credentials and vehicle metadata are read from macOS Keychain and are never
stored in the repository.

## Mobile app

The repo root is an Expo SDK 57 app (Expo Router + `expo-widgets`) with a
"Lexy Status" iOS home screen widget showing the vehicle lock state.

```sh
pnpm install
cp .env.example .env.local
# Set EXPO_PUBLIC_LEXY_API_URL to the authenticated Lexy backend.
pnpm expo run:ios   # expo-widgets is not supported in Expo Go; use a dev build
```

The app fetches `GET {EXPO_PUBLIC_LEXY_API_URL}/vehicle`, which returns the
normalized vehicle shape defined in [`src/data/vehicle.ts`](src/data/vehicle.ts).
The backend owns the Lexus OAuth session and must not expose refresh tokens or the
upstream API key to the client.

Vehicle state is server state, not an app-owned relational data model. TanStack
Query handles refresh and deduplication, and persists the last successful
snapshot in AsyncStorage for fast startup/offline display. OAuth credentials
belong in backend secret storage (or SecureStore if a future build performs
first-party sign-in on-device), never AsyncStorage. Add SQLite when the app needs
queryable local history, queued commands, or multiple related entities.

## API reference

[`docs/`](docs/) documents the Lexus OneApp API surface used by this tooling —
all 285 REST endpoints by domain, the login/token flow, and the vehicle
status/command model. Start at [`docs/README.md`](docs/README.md).
