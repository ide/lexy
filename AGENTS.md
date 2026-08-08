# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project scope

Lexy is an exploration of native platform APIs on iOS and Android from one
codebase. iOS is the reference implementation; Android is a native Android app
built to the same per-screen contracts, not a port of the iOS trees. Do not add
web support.

Screens are specified once, in `specs/` — read `specs/README.md` before
touching any screen. The specs tree mirrors `src/app` file-for-file (enforced
by `specs/mirror.test.ts`), a behavior change updates the screen's spec in the
same commit, and a platform divergence that isn't recorded under the spec's
Platform notes is a bug on whichever platform moved.

# Platform seams

- SwiftUI code — anything importing `@expo/ui/swift-ui` or `expo-glass-effect`
  — lives only in `*.ios.tsx` files, `src/components/swift-ui/`, or
  `src/widgets/`. Jetpack Compose code (`@expo/ui/jetpack-compose`) is the
  mirror: `*.android.tsx` files or `src/components/jetpack-compose/` only.
  An oxlint `no-restricted-imports` rule enforces both directions; do not
  weaken it. Universal `@expo/ui` imports are fine anywhere.
- The two component drawers are deliberately parallel: platform-bound building
  blocks live unsuffixed in `src/components/swift-ui/` and
  `src/components/jetpack-compose/` (the directory is the marker), while a
  component both platforms consume through one specifier is a suffixed
  `.ios.tsx`/`.android.tsx` pair with an identical props contract
  (`icon`, `alert-host`, `swiftui-scroll-view`). tsconfig's `moduleSuffixes`
  typechecks callers against the iOS variant, so the pair's contracts cannot
  drift silently.
- Route files under `src/app` stay thin, platform-neutral re-exports from
  `src/screens`. Expo Router loads every route eagerly and does not support
  platform suffixes on route files, so a platform-only import in a route
  crashes the other platform at boot.
- iOS-only components have no `.android` sibling on purpose: an accidental
  Android import fails at bundle time, which is the enforcement. A screen not
  yet built for Android renders `pending-screen.tsx` pointing at its spec.
- Icons are semantic. `src/components/ui/icon-registry.ts` maps app-level
  names to an SF Symbol and a Material icon; shared code and data modules
  speak registry names only. Raw SF Symbol names may appear only inside
  iOS-only trees (SwiftUI `systemName=` props and the widget). Adding an icon
  means naming both platform glyphs at once. Tab icons are the one exception
  (`tab-config.ts` carries an `sf` pair and a Material Symbol side by side —
  the native tab bar draws from the platform catalog, not the registry).
- Colors come from `src/constants/theme.ts` on both platforms: UIKit semantic
  colors on iOS, Material 3 dynamic roles on Android. iOS values are live
  PlatformColors; Android's resolve *when read*, so anything that captures a
  color at module scope — a `StyleSheet.create`, a prebuilt options object —
  pins it to the launch appearance. Read colors during render (the root
  remounts the tree on an appearance change, which is what repaints Android).

# Deployment targets

- **iOS 26 or newer.** Use iOS 26 APIs — Liquid Glass
  (`buttonStyle('glass' | 'glassProminent')`, the `glassEffect` modifier)
  included — directly, without version gates or pre-26 fallbacks. No
  `isLiquidGlassAvailable()` checks, no parallel legacy styling.
- **Android: design for Android 12 or newer.** One Material 3 implementation
  with dynamic color; no pre-Material-You branches. `minSdk` stays at the Expo
  default — Material dynamic roles already fall back to the baseline palette
  on older devices, which is the entire legacy story.

# Interaction controls

- Never import `Pressable`, `TouchableOpacity`, or another JavaScript-thread
  touchable from `react-native`, on either platform.
- iOS: prefer native controls from `@expo/ui`, especially SwiftUI `Button`,
  `List`, `DisclosureGroup`, and `ScrollView`; always use the scrolling
  containers provided by `@expo/ui` — do not import `ScrollView`, `FlatList`,
  or `SectionList` from `react-native` in iOS trees.
- Grouped screens are built from the section primitives in their platform's
  drawer — `src/components/swift-ui/section.tsx` and
  `src/components/jetpack-compose/settings.tsx` — never from a local copy. A
  screen that hand-rolls its own header or card drifts from the app's spacing
  the moment either changes; `Section` owns the gap between a header and what
  it labels (`Spacing.two`, the same gap the RN `SectionTitle` carries), so
  the rhythm is one decision rather than one per screen.
- Android: prefer universal `@expo/ui` components, then
  `@expo/ui/jetpack-compose`. A plain React Native `ScrollView` inside an
  `.android.tsx` file is acceptable where the Compose scroll host doesn't
  exist yet (`swiftui-scroll-view.android.tsx` is the current instance); each
  such use carries a comment and gets replaced, not multiplied.
- When Expo UI cannot express a custom interaction or gesture, use
  `react-native-gesture-handler` instead of a React Native touchable.
- Preserve native pressed, disabled, focus, accessibility, and haptic
  behavior; do not recreate those states with JavaScript opacity changes.
  Haptics funnel through `@/utils/haptics` (native on both platforms).

# Animation

- Never use React Native's JS-thread `Animated` API (`Animated.Value`,
  `Animated.timing`, `Animated.View`, etc.). Use `react-native-reanimated`
  (shared values, `useAnimatedStyle`, `withTiming`/`withRepeat`) so animations
  run on the UI thread.

# Verification

- Verify with local development builds, not Expo Go: iOS on a device or
  simulator, Android on the `lexy` emulator AVD (Pixel 8, API 36). Lexy uses
  native modules and Apple targets that Expo Go does not include.
- **A dev build is not the shipping app.** `expo-updates` is inert in a dev
  client and live in a release build, so a JavaScript error at launch shows as
  a red screen in development and as a hard crash through the updates error
  recovery in production. Anything touching launch — the auth boundary, the
  persisted cache, the root layout — gets a Release build before it goes out.
- **Test the upgrade, not just the install.** Every fresh install starts with
  an empty cache and no keychain session, which is the one state a returning
  user is never in. When a change touches persisted data, run the previous
  build first so the new one launches onto real prior state — that is the only
  way the class of bug `CACHE_VERSION` exists to prevent actually shows up.
- Prefer text and logs when inspecting or verifying behavior.
- If a screenshot is necessary, downsample it to roughly 1x point resolution
  or lower before viewing or sharing it. Device screenshots are normally 2x–3x.
- If higher resolution is truly necessary, crop to the smallest relevant region
  before analyzing it rather than viewing the full-resolution screen.

For example, downsample a 3x phone screenshot with `sips`:

```sh
# 3x device (e.g. iPhone Pro): scale width to 1/3 of the pixel width
sips --resampleWidth 393 screenshot.png
```

# Typed routes

Adding, renaming, or moving a file under `src/app` changes the route union that
Expo Router generates into `.expo/types/router.d.ts`. Only the dev server writes
that file — `expo export`, and so `eas update`, leaves it untouched — so until
Metro has run, `tsc` rejects the new path against a route that plainly exists:

```
error TS2820: Type '"/settings/eas"' is not assignable to type ...
Did you mean '"/settings"'?
```

That error is the stale types file, not the code. Regenerate before trusting a
typecheck, and quit the server once it starts:

```sh
npx expo start
npx tsc --noEmit
```

`.expo/` is gitignored, so this is per-checkout state — a fresh clone or a new
worktree needs its own run, and nothing can be committed to spare it.

# Unit tests

Vitest runs in plain Node, so native modules do not resolve. `expo-sqlite` is
handled globally: `vitest.config.ts` aliases `expo-sqlite/kv-store` to the
in-memory fake in `src/test-support/expo-sqlite-kv-store.ts`, so a module that
imports the store is testable with no `vi.mock`. Call `resetKvStore()` from
`beforeEach` when a test cares about starting empty.

Do not try to fix this by adding `expo-sqlite` web support — its server-runtime
entry is a no-op stub, so tests would silently drop every write instead of
failing loudly.

Other native imports (`expo-linking`, `expo-network`, `react-native`, `@expo/ui`)
still need a per-file `vi.mock`. Prefer keeping native imports at the edge, as
`closure-state.ts` and `update-history-repository.ts` do, so the logic itself
stays importable in Node. Node also resolves neither `.ios.tsx` nor
`.android.tsx` — platform-split components are view-layer edges by definition;
keep testable logic out of them.

# EAS Updates

Publish updates with `--platform ios,android` — never web. The all-platform
default tries to bundle for web, and the `expo-sqlite` web path imports a
`.wasm` module that fails the export.

# Patched dependencies

`patches/expo-location@57.0.7.patch` drops the foreground-permission check from
`geocode` and `reverseGeocode` in expo-location's Android module. Android's
`Geocoder` requires no location permission and iOS never checked for one, so the
check bought nothing and cost the parked address: `app.json` blocks both location
permissions, which made every reverse geocode on Android throw
`LocationUnauthorizedException` and leave the address line permanently blank.
Delete the patch once the upstream fix ships in an SDK 57 patch release.

A patch edits native source, so it moves the fingerprint runtime version. A
patched build is a new build — it cannot reach existing installs over the air.

# What the Android manifest ships

`android.blockedPermissions` in `app.json` is the whole permission story: a
library's manifest is a request, not a decision, and the release APK ships only
what survives that list. Read the merged result rather than the package
manifests — `./gradlew :app:processReleaseMainManifest` then
`app/build/intermediates/merged_manifest/release/…`, since transitive AARs
contribute permissions no `node_modules` manifest mentions.

Most entries are permissions for code paths the app cannot reach, but
`FOREGROUND_SERVICE` is a judgement call worth knowing about. It arrives with
androidx.work, which expo-observe uses to flush metrics, and it is blocked to
keep the Play Console's foreground-service declaration out of review. That is
safe only while expo-observe enqueues plain work: `ObservabilityBackgroundWorker`
overrides `getForegroundInfo()` but never calls `setExpedited()`, so WorkManager
has no reason to start a foreground service. An expo-observe upgrade that adds
`setExpedited` turns the block into a `SecurityException` inside a background
worker — silent, and only in a release build. Re-check that call when bumping it.

Components merge in the same way, and the same audit applies: read the services,
receivers, providers, and activities out of the merged manifest, not out of
`node_modules`. Prefer not linking a module over deleting what it declares —
`plugins/without-location-task-service.js` exists only because expo-location is
genuinely used for reverse geocoding and just its background-location service
has to go. When nothing native is used at all, exclude the module from
autolinking instead and the declarations never appear.

# Home-screen widget

The Lexy status widget is iOS-only. expo-widgets' Android JS API is a no-op
stub in SDK 57, so the widget module and its timeline updates need no platform
guards — they safely do nothing on Android.

Because that stub is plain JavaScript and never calls `requireNativeModule`,
`package.json` excludes expo-widgets from Android autolinking entirely
(`expo.autolinking.android.exclude`). The native module was only pulling in
androidx.glance, whose manifest contributed an exported service, two trampoline
activities, and three receivers for a widget Android cannot render. iOS
autolinking is untouched. Drop the exclusion — not just the platform guards —
when expo-widgets ships its Android (Glance) renderer.

# Git workflow

Commit changes directly to `main`. Do not open pull requests.
