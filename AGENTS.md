# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project scope

For now, Lexy is an iOS-only exploration of Apple platform APIs. Focus product
and implementation work on native Apple experiences, including SwiftUI, Home
Screen widgets, and Live Activities. Do not add Android or web parity unless the
user explicitly asks for it.

# Deployment target

Assume **iOS 26 or newer**. Do not build support for older OS versions.

Use iOS 26 APIs — Liquid Glass (`buttonStyle('glass' | 'glassProminent')`, the
`glassEffect` modifier, `expo-glass-effect`) included — directly, without a
version gate and without a pre-26 fallback path. Do not add
`isLiquidGlassAvailable()` checks, `if (Platform.Version >= 26)` branches, or
parallel legacy styling. A single modern implementation is the whole
implementation.

# Interaction controls

- Never import `Pressable`, `TouchableOpacity`, or another JavaScript-thread
  touchable from `react-native`.
- Prefer native controls from `@expo/ui`, especially SwiftUI `Button`, `List`,
  `DisclosureGroup`, and `ScrollView` for iOS interfaces.
- Always use the scrolling containers provided by `@expo/ui`. Do not import
  `ScrollView`, `FlatList`, or `SectionList` from `react-native`.
- When Expo UI cannot express a custom interaction or gesture, use
  `react-native-gesture-handler` instead of a React Native touchable.
- Preserve native pressed, disabled, focus, accessibility, and haptic behavior;
  do not recreate those states with JavaScript opacity changes.

# Animation

- Never use React Native's JS-thread `Animated` API (`Animated.Value`,
  `Animated.timing`, `Animated.View`, etc.). Use `react-native-reanimated`
  (shared values, `useAnimatedStyle`, `withTiming`/`withRepeat`) so animations
  run on the UI thread.

# Verification

- Verify the app with a local iOS development build, not Expo Go. Lexy uses
  native modules and Apple targets that Expo Go does not include.
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

# EAS Updates

Publish updates for iOS only — pass `--platform ios` to `eas update`. Lexy is
iOS-only, and the default all-platform export fails to bundle for web (the
`expo-sqlite` web path imports a `.wasm` module). The preview and production
channels target iOS anyway.

# Git workflow

Commit changes directly to `main`. Do not open pull requests.
