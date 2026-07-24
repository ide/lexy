# Lexy

Experimental Lexus remote-control tooling.

The tracked tree contains only code and tests. Local APKs, reverse-engineering
output, notes, and unpublished research belong in the gitignored `scratchpad/`
directory.

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

`mobile/` is an Expo SDK 57 app (Expo Router + `expo-widgets`) with a "Lexy
Status" iOS home screen widget showing the vehicle lock state.

```sh
cd mobile
npm install
npx expo run:ios   # expo-widgets is not supported in Expo Go; use a dev build
```
