import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

/** The uppercase grouped-section header used above cards on the RN screens. */
export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <ThemedText
      type="smallBold"
      themeColor="secondaryLabel"
      style={[styles.title, style]}
    >
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  title: {
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
});
