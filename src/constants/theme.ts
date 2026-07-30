/**
 * Semantic color palette built on the `Color` API from expo-router — a
 * type-safe wrapper over PlatformColor. Colors resolve on-device and adapt
 * to light/dark mode and accessibility settings automatically (iOS UIKit
 * colors, Android Material dynamic colors). Web falls back to static hex.
 */

import { Color } from 'expo-router';
import { Platform } from 'react-native';

export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: '#000000',
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: '#60646C',
  })!,
  // Grouped (settings-style) backgrounds: grey screen, elevated cards.
  groupedBackground: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surface,
    default: '#F2F2F7',
  })!,
  card: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: '#FFFFFF',
  })!,
  fill: Platform.select({
    ios: Color.ios.tertiarySystemFill,
    android: Color.android.dynamic.surfaceContainerHighest,
    default: '#E0E1E6',
  })!,
  // The gentlest system fill — for sub-grouping surfaces inside a card where
  // `fill` would read too heavy.
  subtleFill: Platform.select({
    ios: Color.ios.quaternarySystemFill,
    android: Color.android.dynamic.surfaceContainerHigh,
    default: '#F0F0F3',
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: '#C6C6C8',
  })!,
  systemBlue: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: '#007AFF',
  })!,
  systemGreen: Platform.select({
    ios: Color.ios.systemGreen,
    android: '#34C759',
    default: '#34C759',
  })!,
  systemOrange: Platform.select({
    ios: Color.ios.systemOrange,
    android: '#FF9500',
    default: '#FF9500',
  })!,
  systemYellow: Platform.select({
    ios: Color.ios.systemYellow,
    android: '#FFCC00',
    default: '#FFCC00',
  })!,
  systemRed: Platform.select({
    ios: Color.ios.systemRed,
    android: '#FF3B30',
    default: '#FF3B30',
  })!,
} as const;

export type ThemeColor = keyof typeof colors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    mono: 'monospace',
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
