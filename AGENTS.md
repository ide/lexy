# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project scope

For now, Lexy is an iOS-only exploration of Apple platform APIs. Focus product
and implementation work on native Apple experiences, including SwiftUI, Home
Screen widgets, and Live Activities. Do not add Android or web parity unless the
user explicitly asks for it.

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

# Screenshots

ALWAYS downsample phone and simulator screenshots before viewing or sharing
them. Device screenshots come out at native pixel resolution (2x–3x the point
size, depending on the source device's DPI); scale them down to roughly 1x
point resolution. Exact scaling doesn't matter — close is fine. For example,
with `sips`:

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
