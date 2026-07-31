import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/constants/theme";

/**
 * The grouped-list card shape shared by the RN-rendered screens: continuous
 * 18pt corners over the theme's elevated card color. Padding is left to
 * callers — row-based cards pad horizontally and let rows pad vertically,
 * while content cards pad all around.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: colors.card }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
  },
});
