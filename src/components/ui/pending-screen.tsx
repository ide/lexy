import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";

/**
 * The Android half of a screen that so far exists only as a SwiftUI tree.
 *
 * A screen built out of `@expo/ui/swift-ui` renders nothing Android can draw,
 * so rather than let it reach the device the route splits at the file name and
 * Android gets this instead. It names the screen and points at the spec, which
 * is the contract the Compose tree will be written against — the screen is not
 * missing, it is unbuilt, and the spec says what building it means.
 */
export function PendingScreen({ title, spec }: { title: string; spec: string }) {
  return (
    <View style={styles.screen}>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="secondaryLabel" style={styles.note}>
        Not built for Android yet — contract: {spec}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.two,
    backgroundColor: colors.groupedBackground,
  },
  title: {
    textAlign: "center",
  },
  note: {
    textAlign: "center",
  },
});
