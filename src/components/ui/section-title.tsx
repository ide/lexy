import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

import { useRedacted } from "@/components/ui/redactable";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing } from "@/constants/theme";

// While redacted, headers stand in with a short, uniform label so they
// skeletonize as compact bars instead of tracing the full title text.
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
      // A section title is a Text in a default (align-items: stretch) column,
      // so its redacted background fill would otherwise span the full screen
      // width. `alignSelf: flex-start` shrinks the bar to the placeholder
      // text's own width; combined with the short label it reads as a compact
      // header skeleton. Applied only while redacted so the real title is
      // unaffected.
      style={[styles.title, style, redacted && styles.redacted]}
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
  redacted: {
    alignSelf: "flex-start",
  },
});
