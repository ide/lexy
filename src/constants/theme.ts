/**
 * Semantic color palette built on the `Color` API from expo-router — a
 * type-safe wrapper over PlatformColor. Colors resolve on-device and adapt
 * to light/dark mode and accessibility settings automatically. The `default`
 * branch serves non-native environments (unit tests, web dev server) with
 * static hex stand-ins; Lexy itself is iOS-only (see AGENTS.md).
 *
 * Every colour the app draws should come from here, and the reason is not
 * tidiness. A `PlatformColor` resolves to the system's own UIColor, which is
 * Display P3 on a display that has it and swaps itself between light and dark.
 * A hex or `rgba()` literal is neither: it is a fixed sRGB triple that stays
 * put when the appearance changes and is clamped to the narrower gamut.
 *
 * For a translucent tint of one of these — a wash behind a banner, an active
 * chip — use `ColorWash` rather than writing the colour out with an alpha
 * channel. It paints the system colour and lets the compositor set the
 * coverage, so the colour keeps both properties.
 */

import { Color } from "expo-router";
import { Platform, type ColorValue } from "react-native";

/** A system color, with a static stand-in for the non-native environments. */
const ios = (color: ColorValue, fallback: string) =>
  Platform.select({ ios: color, default: fallback })!;

const palette = {
  label: ios(Color.ios.label, "#000000"),
  secondaryLabel: ios(Color.ios.secondaryLabel, "#60646C"),
  // The faintest label grey — for a glyph that serves the text beside it and
  // must not compete with it, like a field's clear button.
  tertiaryLabel: ios(Color.ios.tertiaryLabel, "#8A8F98"),
  // Grouped (settings-style) backgrounds: grey screen, elevated cards.
  groupedBackground: ios(Color.ios.systemGroupedBackground, "#F2F2F7"),
  card: ios(Color.ios.secondarySystemGroupedBackground, "#FFFFFF"),
  fill: ios(Color.ios.tertiarySystemFill, "#E0E1E6"),
  // The gentlest system fill — for sub-grouping surfaces inside a card where
  // `fill` would read too heavy.
  subtleFill: ios(Color.ios.quaternarySystemFill, "#F0F0F3"),
  separator: ios(Color.ios.separator, "#C6C6C8"),
  systemBlue: ios(Color.ios.systemBlue, "#007AFF"),
  // The lighter blue in the system palette, for when systemBlue would read as
  // an action rather than a thing.
  systemCyan: ios(Color.ios.systemCyan, "#32ADE6"),
  systemGreen: ios(Color.ios.systemGreen, "#34C759"),
  systemOrange: ios(Color.ios.systemOrange, "#FF9500"),
  systemYellow: ios(Color.ios.systemYellow, "#FFCC00"),
  systemRed: ios(Color.ios.systemRed, "#FF3B30"),
} as const;

export type ThemeColor = keyof typeof palette;

// The Color values are PlatformColor wrappers whose runtime objects every
// consumer (RN styles, @expo/ui props and modifiers) accepts where a plain
// color string is expected. Assert that once here, instead of `as string`
// at every call site.
export const colors = palette as Record<ThemeColor, string>;

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
