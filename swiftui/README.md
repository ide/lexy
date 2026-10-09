# Lexy in SwiftUI

Lexy as a SwiftUI app for iOS 26 and newer, based on the Exact app in
[`../exact/lexy`](../exact/lexy). It installs as `app.ide.lexy.swiftui`, beside
the Expo and Exact apps.

| Path | Contents |
|---|---|
| `Lexy/Core/Rules.swift`, `ClosureSummary.swift` | Pure rules: sign-in steps and errors, failures, closures, formatting, fuel, maps |
| `Lexy/Core/LexusClient.swift` | Lexus HTTP calls, the session and its refresh, PKCE, decoding, the closure merge, the answer cache |
| `Lexy/Core/Transport.swift` | `URLSession` without redirects, with the identity host's cookies |
| `Lexy/Core/DemoLexus.swift` | The in-memory demo Lexus and Login Flow's mock tree |
| `Lexy/Core/Storage.swift` | The Keychain and the on-disk answer cache |
| `Lexy/Core/Device.swift` | Haptics, maps apps, the parked address, connectivity |
| `Lexy/Model/SignInMachine.swift` | The ForgeRock sign-in step machine |
| `Lexy/Model/AppModel.swift` | App state: session refresh, reads, command reconciliation, refresh policy, climate, maps, navigation |
| `Lexy/Views/` | The screens |
| `Lexy/Performance/Timings.swift` | Launch and screen timings |

## Running

You need Xcode 26 or newer and [XcodeGen](https://github.com/yonaskolb/XcodeGen)
(`brew install xcodegen`). The project file is generated:

```sh
cd swiftui
xcodegen generate
open Lexy.xcodeproj
```

**Try Demo** on the sign-in screen signs in to an in-memory Lexus:

- Every vehicle call takes a second, and the car acts on a command 3 seconds after accepting it.
- The password `wrong` and the code `000000` are refused.
- Settings → Demo → Simulate Server Errors makes every write fail with a 500.

## On a phone

`scripts/publish-adhoc.sh` builds an ad hoc `.ipa` and publishes it at
https://lexy-exact.tuft.host/swiftui.html. It signs with the Exact app's ad hoc
profile, which covers only `app.ide.lexy`, so the build uses that bundle ID and
replaces Lexy on the phone. The signing files stay outside the repo, in
`LEXY_SIGNING_DIR` (default `~/.config/tuft/secrets/lexy-adhoc`).

## Tests

```sh
xcodebuild test -scheme Lexy -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

`LexyTests` cover the rules, wire decoding, the session refresh, the closure
merge and every Login Flow scenario. `LexyUITests` drive the demo end to end and
check that a refused command restores the lock state.

The launch argument `-lexy-reset` clears the session and the cached answers,
and `-lexy-memory-store` keeps the session in memory instead of the Keychain.

## Behavior

- **Reads** run in order: session, then garage, then the car's data. A launch
  shows the cached answers on its first frame, then re-reads everything.
- **A 5-second tick** refreshes the session ahead of expiry, re-reads status
  after a lock or unlock until the doors agree (priming the car at the 5th poll
  and giving up at the 10th), re-reads engine status after a start or stop (up
  to four times, 20 s apart), and refreshes after a return from the background:
  data under a minute old stays, older data is re-read, and data over fifteen
  minutes old asks the car to report first, at most every three minutes.
- **The parked address** comes from `MKReverseGeocodingRequest`.
- **Maps apps** are checked whenever the map or Settings opens. A saved app
  that is no longer installed is forgotten. A lone installed app opens without
  being saved.
- **Performance** shows process start to `init`, the first frame (TTR), the
  first frame with nothing loading (TTI), and each screen's time from tap to
  first frame, with medians over seven days.
