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
pnpm expo run:ios   # expo-widgets is not supported in Expo Go; use a dev build
```

## API reference

[`docs/`](docs/) documents the Lexus OneApp API surface used by this tooling —
all 285 REST endpoints by domain, the login/token flow, and the vehicle
status/command model. Start at [`docs/README.md`](docs/README.md).
