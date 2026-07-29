import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

import { useRedacted } from "@/components/redacted";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

// While redacted, headers stand in with a short, uniform label so they
// skeletonize as compact bars. The real titles ("REMOTE CAPABILITIES",
// "CONNECTED SERVICES") would otherwise draw full-width bars that trace their
// own length. A header is its own line, so the narrower placeholder changes no
// vertical metrics and the skeleton→real transition still reconciles in place.
const REDACTED_PLACEHOLDER = "SECTION";

/** The uppercase grouped-section header used above cards on the RN screens. */
export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const redacted = useRedacted();
  return (
    <ThemedText
      type="smallBold"
      themeColor="secondaryLabel"
      style={[styles.title, style]}
    >
      {redacted ? REDACTED_PLACEHOLDER : children}
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
