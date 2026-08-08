/**
 * Semantic color palette built on the `Color` API from expo-router — a
 * type-safe wrapper over each platform's own color system. Colors resolve
 * on-device and adapt to light/dark mode and accessibility settings
 * automatically. The `default` branch serves non-native environments (unit
 * tests, web dev server) with static hex stand-ins.
 *
 * Every colour the app draws should come from here, and the reason is not
 * tidiness. A `PlatformColor` resolves to the system's own UIColor, which is
 * Display P3 on a display that has it and swaps itself between light and dark.
 * A hex or `rgba()` literal is neither: it is a fixed sRGB triple that stays
 * put when the appearance changes and is clamped to the narrower gamut.
 *
 * Android's equivalent is Material 3. `Color.android.dynamic.*` names a *role*
 * — `onSurface`, `outlineVariant`, `primary` — and the system fills it from the
 * palette it derived from the user's wallpaper, so naming roles rather than
 * colours inherits the device's own theme. The roles are asymmetric with iOS's
 * in one place worth knowing: Material's surface tiers climb with elevation in
 * both schemes (a raised container is darker in light mode and lighter in dark),
 * where iOS grouped backgrounds invert. The mapping below follows Material.
 *
 * For a translucent tint of one of these — a wash behind a banner, an active
 * chip — use `ColorWash` rather than writing the colour out with an alpha
 * channel. It paints the system colour and lets the compositor set the
 * coverage, so the colour keeps both properties.
 */

import { Color } from "expo-router";
import { Appearance, Platform, type ColorValue } from "react-native";

/**
 * A system color per native platform, with a static stand-in for the
 * non-native environments.
 *
 * The Android branch is a thunk, and that asymmetry is the point. An iOS
 * `PlatformColor` is a live reference the system re-resolves as the
 * appearance changes, but `Color.android.dynamic.*` reads
 * `Appearance.getColorScheme()` and hands back a resolved hex string — so a
 * value captured once would pin the palette to whichever scheme was current
 * when this module first loaded, and a light/dark switch would not repaint
 * until relaunch. Deferring the read to property access means every render
 * that reads a colour reads the current scheme's.
 */
const system = (ios: ColorValue, android: () => ColorValue, fallback: string) =>
  Platform.OS === "android" ? android : Platform.select({ ios, default: fallback })!;

// The status colours have no Material counterpart — Material 3 defines one
// semantic accent, `error`, and leaves success/warning to the app. These are
// fixed mid-tones, picked to hold at least a 3:1 contrast against both a
// near-white and a near-black Material surface so a single value works in
// either scheme. They await a proper Android palette in a later phase.
const androidGreen = "#388E3C";
const androidOrange = "#E65100";
const androidYellow = "#B8860B";
const androidCyan = "#0097A7";

const palette = {
  label: system(Color.ios.label, () => Color.android.dynamic.onSurface, "#000000"),
  secondaryLabel: system(
    Color.ios.secondaryLabel,
    () => Color.android.dynamic.onSurfaceVariant,
    "#60646C",
  ),
  // The faintest label grey — for a glyph that serves the text beside it and
  // must not compete with it, like a field's clear button. Material spends
  // `outline` on exactly that: the lowest-emphasis foreground that still
  // clears contrast, one step back from `onSurfaceVariant`.
  tertiaryLabel: system(Color.ios.tertiaryLabel, () => Color.android.dynamic.outline, "#8A8F98"),
  // Grouped (settings-style) backgrounds: grey screen, elevated cards. On
  // Android that is Material's base `surface` with cards a tier above it.
  groupedBackground: system(
    Color.ios.systemGroupedBackground,
    () => Color.android.dynamic.surface,
    "#F2F2F7",
  ),
  card: system(
    Color.ios.secondarySystemGroupedBackground,
    () => Color.android.dynamic.surfaceContainerLow,
    "#FFFFFF",
  ),
  fill: system(
    Color.ios.tertiarySystemFill,
    () => Color.android.dynamic.surfaceContainerHighest,
    "#E0E1E6",
  ),
  // The gentlest system fill — for sub-grouping surfaces inside a card where
  // `fill` would read too heavy, so it sits one Material tier below it.
  subtleFill: system(
    Color.ios.quaternarySystemFill,
    () => Color.android.dynamic.surfaceContainerHigh,
    "#F0F0F3",
  ),
  separator: system(Color.ios.separator, () => Color.android.dynamic.outlineVariant, "#C6C6C8"),
  // The app's accent, and so Material's `primary` — the one role the user's
  // wallpaper drives most visibly.
  systemBlue: system(Color.ios.systemBlue, () => Color.android.dynamic.primary, "#007AFF"),
  // The lighter blue in the system palette, for when systemBlue would read as
  // an action rather than a thing.
  systemCyan: system(Color.ios.systemCyan, () => androidCyan, "#32ADE6"),
  systemGreen: system(Color.ios.systemGreen, () => androidGreen, "#34C759"),
  systemOrange: system(Color.ios.systemOrange, () => androidOrange, "#FF9500"),
  systemYellow: system(Color.ios.systemYellow, () => androidYellow, "#FFCC00"),
  systemRed: system(Color.ios.systemRed, () => Color.android.dynamic.error, "#FF3B30"),
} as const;

export type ThemeColor = keyof typeof palette;

/**
 * The palette every consumer reads.
 *
 * On iOS the values are PlatformColor wrappers whose runtime objects every
 * consumer (RN styles, `@expo/ui` props and modifiers) accepts where a plain
 * colour string is expected — asserted once here instead of `as string` at
 * every call site. On Android each entry is a getter that resolves its
 * Material role on read, so a component re-rendered for an appearance change
 * paints the new scheme's colour.
 *
 * The one place that still pins a colour is a `StyleSheet.create` at module
 * scope: it runs once at import, so its colours are whatever the launch
 * scheme resolved. Read a colour inline (or through a style array) when it
 * has to follow the appearance.
 */
/**
 * Remember an Android role's colour for as long as the appearance holds.
 *
 * Resolving one is a synchronous call into the native module, and the app
 * reads colours a few hundred times across a render pass, so reading through
 * to the platform every time would put that call on every screen's hot path.
 * The scheme is React Native's own cached value, which makes it a cheap key —
 * when it changes the next read resolves afresh, which is what keeps a
 * light/dark switch repainting.
 */
const perScheme = (read: () => ColorValue) => {
  let scheme: string | null | undefined;
  let value: ColorValue;
  return () => {
    const current = Appearance.getColorScheme();
    if (current !== scheme) {
      scheme = current;
      value = read();
    }
    return value;
  };
};

export const colors = Object.defineProperties(
  {} as Record<ThemeColor, string>,
  Object.fromEntries(
    Object.entries(palette).map(([name, value]) => [
      name,
      typeof value === "function"
        ? { get: perScheme(value as () => ColorValue) as () => string, enumerable: true }
        : { value, enumerable: true },
    ]),
  ),
);

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    mono: "monospace",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
