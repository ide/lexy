import { useColorScheme } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Returns the semantic color palette. The colors are PlatformColor-backed and
 * resolve on-device; subscribing to the color scheme here forces a re-render
 * on Android when the theme flips (iOS re-resolves automatically).
 */
export function useTheme() {
  useColorScheme();

  return colors;
}
