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

# Git workflow

Commit changes directly to `main`. Do not open pull requests.
