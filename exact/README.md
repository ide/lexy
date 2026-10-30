# Lexy on Exact

Lexy's Exact app lives in [`lexy/`](lexy/) with native iOS and browser builds.
It is separate from the Expo app at the repository root.

Contract owns the screens, sign-in flow, vehicle state, commands, and refresh
policy. TypeScript handles HTTP and response decoding; Exact's `@exact/oauth`
keeps the Lexus session.
The Swift module provides MapKit, geocoding, maps-app links, and haptics.

| File | Responsibility |
| --- | --- |
| `lexy/app.contract` | Resources, actions, timers, and navigation |
| `lexy/model.contract` | Data shapes and display rules |
| `lexy/sign-in.contract` | Sign-in screens |
| `lexy/status.contract` | Status dashboard and remote controls |
| `lexy/specs.contract` | Vehicle specifications and connected services |
| `lexy/settings.contract` | Settings and vehicle name |
| `lexy/developer.contract` | Developer tools, Observe metrics and the session log |
| `lexy/map.contract` | Last Parked sheet |
| `lexy/app.ts` | I/O and response decoding |
| `lexy/demo.ts` | Local demo server and sign-in previews |
| `lexy/modules/apple/Lexy.swift` | Native module |

## Build

Use the Bun and Exact revisions in [`ci/pins.sh`](ci/pins.sh), the Rust toolchain
in [`lexy/rust-toolchain.toml`](lexy/rust-toolchain.toml), and Xcode 27.1 release.
Exact and Lexy must be sibling checkouts: the app's Cargo paths point to
`../../../exact2`. Exact's build tools provision the Hermes inputs they need.
Run `bun install --frozen-lockfile` in the Exact checkout first, then in
`exact/lexy`, which copies `@exact/oauth` from that checkout; run it there
again after the Exact checkout changes.

Build a simulator app without installing or launching it:

```sh
cd exact/lexy
DEVELOPER_DIR=/Applications/Xcode-27.1.app/Contents/Developer \
  RUSTC_WRAPPER= bun exact.mjs ios --no-install
```

Use an iPhone Duo simulator with iOS 27.1. Other iPhones use iOS 27.0 or newer;
the 27.1 runtime supports only Duo. `--sim` selects a simulator when running
or driving the app.

The local `exact.mjs` supports `ios`, `mac`, `web`, `web-build`, and `update`.
For other commands, call the pinned checkout's CLI from `exact/lexy`:

```sh
RUSTC_WRAPPER= bun ../../../exact2/scripts/exact.mjs contract build app.contract --json --errors-only
RUSTC_WRAPPER= bun ../../../exact2/scripts/exact.mjs contract types --check app.contract
```

## Demo and inspection

"Explore the Demo" uses a local Lexus server, so no account or remote vehicle
is needed. Vehicle reads take about a second; commands take about three seconds
to appear in the next vehicle report. This exercises loading and reconciliation.
Its access tokens last an hour of the app's clock, after which its gateway
answers 403, as Lexus's does. Token refreshes take about a second, and the server
refuses a refresh token it has already seen spent, as Lexus does, so a lost
rotation signs the demo out.
The Login Flow developer tool also uses local responses.

In the simulated sign-in flow, any email and password are accepted except the
password `wrong`. Any code except `000000` is accepted.

Drive the app with Exact's agent from `exact/lexy`:

```sh
EXACT_APP_DIR="$PWD" RUSTC_WRAPPER= bun ../../../exact2/scripts/agent.mjs ios tree
```

Use `testId` values to target controls. Use platform touch delivery when verifying
native hit testing or gestures; invoking an authored handler alone does not
establish that the native control receives a tap.

## Checks

Run these from the repository root. The checks use a fake network and in-memory
storage; persistence checks execute real SQLite statements:

```sh
bun exact/lexy/auth.check.ts
bun exact/lexy/session.check.ts
bun exact/lexy/session-log.check.ts
bun exact/lexy/data-flow.check.ts
bun exact/lexy/closures.check.ts
bun exact/lexy/maps-preference.check.ts
bun exact/lexy/independent-reads.check.ts
bun exact/lexy/demo.check.ts
```

They cover sign-in and preview isolation, token refresh and sign-out, the session log, demo mode, malformed responses, sparse closure
snapshots, maps preferences, and concurrent reads. Screen specs live in
[`../specs/`](../specs/); `specs/mirror.test.ts` checks their route coverage.

## Runtime rules

- A pending resource retains its last answer. That answer may be displayed.
  An authenticated request goes with the access token it has; one the gateway
  refuses waits for the refresh in flight, or starts it.
- A failed or malformed response preserves the last valid vehicle and telemetry.
  A valid empty vehicle list is a separate result.
- Exact's `@exact/oauth` keeps the Lexus session (Exact LLP 1146 D5, D8, D9).
  Lexy answers the sign-in tree with its own screens and sends the
  authorization request with the tree's SSO token; the package exchanges the
  code with PKCE, checks the ID token, renews the token one refresh at a time
  keeping each rotated refresh token, renews and retries a read the gateway
  refuses (403, or 401), and asks Lexus to revoke the refresh token at
  sign-out, which forgets the session whether or not Lexus answers. By the
  package's rule (D9), a token the gateway refuses right after the renewal
  that issued it is not renewed again until the gateway's `Date` says it has
  expired or, its expiry unknown, that a minute has passed since that
  refusal, and those reads fail with the refusal; a refusal without a `Date`
  renews as any other does. Its events are the session log's.
- A refresh's POST runs to its end when Exact lets its answer go, and its
  reply's turn keeps the store (LLP 1146 D2); on iOS Exact asks for background
  time while it is in flight, which the system may end first. A refresh that
  fails without a reply keeps the session. Lexus refusing the refresh token
  ends it, as do OpenID Connect's sign-in-again errors and a refreshed ID
  token that fails its checks; an end empties the vehicle data.
- A command is confirmed only by a newer vehicle report that agrees with it.
  An older matching reading does not confirm a later command.
- Sparse snapshots retain older window and opening readings with their original
  timestamps. Another VIN starts a separate history.
- Responses must match Contract's declared shapes. Keep decoding at the I/O
  boundary and state decisions in Contract.

## Device builds

The simulator app uses `app.ide.lexy.exact`. Ad hoc device builds use
`app.ide.lexy` and install over the Expo app. Set both `app.json`'s `app.id` and
`app.ts`'s `appId` in the build's checkout, and use a newer build number than the
installed version.
Regenerate `exact-version.contract` so Settings shows the matching version and
Exact revision.

With an ad hoc distribution identity and provisioning profile available:

```sh
EXACT_VERSION=1.0.1 EXACT_BUILD_NUMBER=<build-number> \
  EXACT_IDENTITY=<certificate-sha1> EXACT_PROFILE=<profile-path> \
  bun exact.mjs ios --device --archive Lexy.ipa
```

Serve the IPA and its installation manifest over HTTPS. Fetch signing credentials
through EAS credentials; never put private signing material in the repository.

EAS's `exact` profile runs [`.eas/build/exact.yml`](../.eas/build/exact.yml) through
[`ci/ios.sh`](ci/ios.sh). The manual workflow builds the pinned Exact revision,
provisions Hermes, signs with the ad hoc credentials, and produces the IPA as
its build artifact:

```sh
eas workflow:run .eas/workflows/build-exact.yml
```

For a local CI-style build, run `ci/ios.sh` phases `toolchain`, `deps`, `hermes`,
and `archive` from this directory, supplying `EXACT_IDENTITY` and `EXACT_PROFILE`
for signing. The script lists the remaining phases and their inputs.
