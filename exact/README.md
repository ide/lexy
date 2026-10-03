# Lexy on Exact

An exploration of Lexy written for [Exact](https://github.com/ccheever/exact2),
iOS only. The app is in [`lexy/`](lexy/). It is separate from the Expo app at the
repo root, and nothing in the Expo app depends on it.

**Contract does the work.** All the screens and every decision the app makes are
written in Contract:

- the sign-in step machine (password → delivery-method choice → code, resend,
  switch method)
- what a status snapshot means (doors, windows, locks, fuel, tires)
- lock reconciliation after a command
- refresh policy, formatting, and navigation

**TypeScript (`app.ts`) only handles I/O**, which Contract can't do:

- HTTP to the Lexus hosts, with the identity host's cookies kept by hand
- the Keychain, and refreshing the session (one `session` source, which
  every read waits on)
- PKCE hashing
- decoding each response into the exact shape Contract declares

**Swift (`modules/apple/Lexy.swift`)** covers what Exact doesn't expose:
- `<lexy-map>`: MapKit centred on the car, plus geocoding and opening a maps app
- haptics after a remote command

| File | What |
|---|---|
| `lexy/app.contract` | Root: routes, resources, mutations, the sign-in and reconcile state machines, timers |
| `lexy/model.contract` | Shapes app.ts answers with, and the `fn`s that were `src/data` / `src/auth` rules |
| `lexy/sign-in.contract` | Sign-in screen |
| `lexy/status.contract` | Status tab: hero, fuel, controls with native confirmations, doors & windows, odometer, tires |
| `lexy/specs.contract` | Specs tab: spec sheet, remote capabilities, connected services |
| `lexy/settings.contract` | Settings tab and the vehicle-name screen |
| `lexy/app.ts` | The I/O layer |
| `lexy/demo.ts` | An in-memory Lexus (identity tree + REST plane) for demo mode |
| `lexy/modules/apple/Lexy.swift` | The native module: SF Symbols, the map, geocoding, haptics |

## Running it

You need these on the Mac:

- **Bun 1.4.2.**
- **Rust 1.97.0** with the `aarch64-apple-ios-sim` target.
- **Xcode** with its Metal toolchain: `xcodebuild -downloadComponent MetalToolchain`.
- **Two checkouts beside this repo:** `~/Developer/exact2` and `~/Developer/ibex`. In ibex, run `./scripts/build-hermes.sh --vanilla` once. In exact2, run `bun install`.
- **exact2 with these patches** (local branch `lexy-main`: exact2's `main`
  with these on top; not upstream yet):
  - `fetch` passes `redirect` through. Without it the OAuth authorize step's
    302 is followed and its code is lost.
  - Simulator builds link simulated entitlements. Without them the Keychain
    fails on the simulator, so the session doesn't survive a relaunch.
  - System symbols are measured in layout, as text is
    (`exact_set_symbol_measure`), so a first layout has their real size.
  - A button's new `UIButton.Configuration` is shown at once (the update
    handler goes in before the configuration).
  - Routes can show UIKit's navigation bar (`navigationTitle`, large or
    inline titles, `navigationTrailing`, `navigationBackButton`).
  - Tabs (`navigationTab`, its title, SF Symbols and control) project into a
    native `UITabBarController`, one container per tab, each keeping its own
    stack. A tab's root route names its container with
    `navigationContainer`: `stack` (default, a `UINavigationController`),
    `screen`, or a view controller the app's own Swift module registers in
    `ExactModule.controllers` (props from `navigationContainerProps`).
    Contract still selects tabs and owns every route; sheets present over
    the whole tab bar controller.
  - Sheets take several heights (`navigationDetent="medium large"`) and
    show UIKit's grabber when resizable.
  - `image "symbol:apple:<name>"` draws any SF Symbol in the host, so
    symbols are on the first frame (no native module needed).
  - Every `button` is a `UIButton` (UIKit's touch, highlight and disabled
    look); `-exact-apple-button-style` (`glass`, `filled`, `gray`,
    `tinted`, `plain`) draws it in a system style from its text and
    symbol. Contract accepts `-exact-…` vendor properties.
  - `-exact-apple-glass-container` groups descendants' Liquid Glass so it
    merges (`UIGlassContainerEffect`).
  - Confirmations: a modal `dialog` is UIKit's centred alert, a
    confirmation popover an action sheet anchored to its button, and
    `dialog open=…` presents one from state.
  - `resource r = source(args) with values`: the call says what the answer
    is, `with` how it is asked (revisions, the time), so a launch paints
    the answers it kept.
  - `host.ios.queriesSchemes` (LSApplicationQueriesSchemes),
    `pointer-events: none` on iOS, stale-while-revalidate for cached
    images, and controls that write UIKit properties only when they change.
  - Navigation retires its native containers when no route is left (a
    signed-out app showing its sign-in).

The app's Cargo paths point at `../../../exact2`, so it expects the sibling
layout. If exact2 lives elsewhere, run `bun exact.mjs update`.

```sh
cd exact/lexy
bun exact.mjs ios --run --sim "iPhone 17 Pro"
```

**Explore the Demo** on the sign-in screen switches to the in-memory Lexus and
walks the real sign-in flow:

- Any email and password are accepted.
- The password `wrong` is refused.
- Any code except `000000` is accepted.

In demo mode the car acts on a command about 4 seconds after accepting it, so
"Unlocking…" resolves the way it does against the real API.

To drive it headlessly, use Exact's agent driver from the exact2 checkout:

```sh
EXACT_APP_DIR=$PWD bun ../../../exact2/scripts/agent.mjs ios \
  "tap try-demo" "clock settle" "tap method-0" "clock settle" \
  "type code 123456" "tap verify-button" "clock settle" tree
```

### Checking the session code

`bun exact/lexy/session.check.ts` drives `app.ts`'s session source against a
fake Lexus token server that rotates refresh tokens. It checks three things:

- two simultaneous refreshes send one request
- a refresh rejected because another had already rotated the token keeps
  the session
- a revoked token signs out

`bun exact/lexy/closures.check.ts` drives the status source over a full
snapshot, then a sparse one (lock-only doors, as after a drive), then a
failed read, over an in-memory `app:/data`. It checks that windows and
openings survive the sparse snapshot, dated "as of" the older one; that a
failed read keeps the last good reading; that an older snapshot doesn't win;
and that the history is UTF-8 JSON on disk and starts over for another car.

### On a phone (ad hoc)

Phone builds install over the Expo app as `app.ide.lexy`, signed with the
ad hoc certificate and profile EAS keeps for it (the team's registered
devices).

1. **Fetch the credentials.** Fetch the ad hoc distribution certificate
   (`.p12` and its password) and the provisioning profile for
   `app.ide.lexy`. Use `eas credentials`, or EAS's GraphQL API
   (`iosAppCredentials` → `iosAppBuildCredentialsList`, `AD_HOC`). Import the
   certificate into a keychain on the build Mac's search list.
2. **Point the app at `app.ide.lexy` for the build.** Set the id in `app.json`
   and `export const appId = 'app.ide.lexy'` in `app.ts`. The simulator keeps
   `app.ide.lexy.exact`, so it doesn't replace the Expo app there.
3. **Build the archive.** Set a version above the installed app's, or iOS
   reports it as already installed:

   ```sh
   EXACT_VERSION=1.0.1 EXACT_BUILD_NUMBER=<n> \
   EXACT_IDENTITY=<distribution certificate SHA-1> \
   EXACT_PROFILE=<adhoc.mobileprovision> \
   bun exact.mjs ios --device --archive Lexy.ipa
   ```

   `exact-version.contract` carries the version Settings shows and the Exact
   commit. Regenerate it with the build number before building.
4. **Serve it over HTTPS.** Serve the `.ipa` next to a `manifest.plist`
   (`bundle-identifier` app.ide.lexy, `bundle-version` the version above).
   The install link is
   `itms-services://?action=download-manifest&url=https://<host>/manifest.plist`.
   Slack doesn't link that scheme, so serve an https URL that redirects to it.

## What carried over

| Lexy (Expo) | Here |
|---|---|
| Sign-in (`src/auth/lexus-auth.ts`, `auth-context.tsx`) | The ForgeRock node is classified in Contract (`stepOf`). app.ts fills the callback Contract names. PKCE uses WebCrypto. Tokens live in the Keychain via `store`. |
| Session refresh (`session-manager.ts`) | A Contract `session` resource refreshes near expiry, or once after a 401. Every read takes its expiry as an argument, so reads wait on it and nothing refreshes in parallel. A rejected refresh signs out. |
| Vehicle mapping (`vehicle-mapping.ts`, `closures.ts`, `closure-display.ts`, `closure-summary.ts`, `fuel.ts`) | `fn`s and derives in `model.contract` / `status.contract`. app.ts only flattens the wire. |
| Remote commands + lock reconcile (`remote-command*.ts`, `lock-reconcile.ts`) | `run` → `send` → `then afterCommand`. A 5 s tick re-reads status until the doors agree, primes once at the 5th poll, and gives up at 10. |
| Engine polling (`engine-status.ts`) | The same tick: 4 re-reads, 20 s apart. |
| Pull to refresh with prime rate limit (`refresh-status.ts`) | `scroll refresh=… refreshing=…` (a native `UIRefreshControl`). Primes at most every 3 min. |
| Specs / connected services | `specs.contract` |
| Rename vehicle | `RenameScreen` + `rename` mutation |
| Confirmation alerts | `popover role="alertdialog"`, which iOS presents as a native action sheet |
| `NativeTabs` with SF Symbols (`tab-config.ts`) | `routes nav` with three `tab`s, each rendered with `navigationTab…` props: Exact's native `UITabBarController`, one navigation stack per tab |
| Icons (`icon-registry.ts`) | `image "symbol:apple:…"` with the same SF Symbol names, drawn by Exact's host |
| Haptics (`utils/haptics.ts`) | `native.call({op: "haptic"})` after a command |
| Last Parked map | An `https://maps.apple.com/?ll=…` link |

**Not ported:**

- the Home Screen widget
- the in-app map and reverse-geocoded address
- climate settings
- the maps-provider picker
- EAS update diagnostics
- the persisted closure store that merges sparse snapshots across reads
- the data-state debug overrides

Most of these need native capability that Exact doesn't expose without a Swift
module (see below).

## Findings

**Contract is expressive enough for the app's logic, but not for its data
boundary.**

- **No JSON, and strict shapes.** A source's reply must match its declared shape
  exactly: a missing field or an extra one fails the answer. There is no `any`,
  map, or JSON parse. So TS can't hand Contract the wire and let Contract map it.
  Each endpoint needs a decoder that renames and flattens, and the decoders
  are most of `app.ts`.
- **A small expression roster.**
  - Missing: `round`, `sort`, `find`, `sum`, string `slice`/`split`/case-folding,
    string→number, and list literals. Common patterns work around them:
    `first(filter(…))` for find, `floor(n + 0.5)` for round, a hand-written
    thousands separator in `grouped`.
  - The sign-in classifier names every casing of "verification code" because
    there is no lowercase.
  - Trip distances stay strings because nothing parses `"272.1 miles"`.
- **No record literals.** Contract can't write an empty `Car`, so `garage`
  answers a `car` field (the first car, or a blank one) alongside `cars`.
- **`fn`s are pleasant.** They are pure, typed, can call each other, and cross files
  with `use`. Nearly all of Lexy's `src/data` rules became one-line `fn`s.
- **Actions read their starting state.** Inside an action, a slot you just
  assigned still reads its old value until the commit. The tick's notice
  timeout initially compared against the previous tick's clock. It now reads
  `time.epochAtZero + now()` directly.
- **`then` chains model multi-step flows well.** Sign-in is five mutations,
  each with a `then` that classifies the answer and sends the next. An action
  can't call another action or send to its own mutation, so a step machine is
  one mutation per step.
- **Tasks are mount-only.** There is no conditional or one-shot timer from an
  action, so polling is a 5 s `every` whose action checks flags. The
  reconcile cadence is coarser than Lexy's 0/5/12/25 s schedule.
- **Reserved words bite.** `refresh` can't be a prop name and `key` can't be a
  shape field; the compiler says so clearly.
- **The compiler is good.** It reports one refusal at a time with an exact
  location and a fix-it hint. Most compile errors took one edit each.

**Native fidelity, iOS:**

- Native: tab bar (`UITabBarController` with per-tab stacks), navigation bars with large titles, sheets, confirmations (`UIAlertController`),
  pull-to-refresh (`UIRefreshControl`), navigation pushes with swipe-back
  (`UINavigationController`), and remote images.
- Custom-drawn: the rest of the UI (cards, buttons) is drawn by Exact. It
  looks right but isn't SwiftUI.
- **Contract's `image "symbol:…"` takes only Exact's 60 portable roles.**
  These are mostly chat icons: no car, unlocked padlock, fuel, tire or engine.
  The SF Symbols here come from the native module, which Exact loads just
  after first paint, so icons appear a frame late at launch.
- **UIKit chrome presses authored controls.** The tab bar, bar buttons and
  the back button press hidden controls named by HTML id (`tab-status`,
  `back`), so the agent driver taps those ids and the patched host activates
  them as UIKit would.
- **Maps need Swift.** MapKit, geocoding and opening Apple Maps, Google
  Maps or Waze are the native module's (`openURL` allows only
  http(s)/mailto/tel). Widgets, Live Activities and background refresh are
  not built.

**I/O layer constraints** (Hermes, `app.ts`):

- No `Date.now()`, `Math.random()`, or `setTimeout`.
  - Time is passed in from Contract: every data source takes an `at`.
  - Correlation IDs use `crypto.randomUUID()`.
- An answer may not await a promise another answer started, so Lexy's shared
  in-flight token refresh can't be ported directly. Lexus rotates refresh
  tokens, so two answers refreshing at once spend the same one twice, and
  the loser's `invalid_grant` signs the user out. That happened. The fix is
  ordering in Contract: one `session` resource refreshes, and every read
  waits on it.
- **Exact's `fetch` keeps no cookie jar**, by design: cookies are ambient
  authority its per-origin grants can't see. Lexus's ForgeRock sign-in pins
  a login to one server with `route` and `amlbcookie` cookies; without them a
  correct SMS code fails with "Login failure". Responses expose `set-cookie`
  and an explicit `Cookie` header is allowed, so `app.ts` keeps the identity
  host's cookies itself.
- `redirect: "manual"` reached Exact's Rust transport only after the patch
  above. With it, the authorize step's 302 `Location` carries the code.
- **Verified against the real Lexus API** on a simulator: the password, the
  SMS code, the code exchange, the session in the Keychain across relaunches,
  and every read (vehicle, status, tires, engine, spec, subscriptions). No
  command has been sent to the real car.
- Apps outside the repo can't import npm packages, and only mounted
  directories are captured. Lexy's own `src/` could be mounted via
  `typescript.sources`, but the Expo app's modules pull in React and
  `expo-*` types, and the brief here was Contract-first anyway.
