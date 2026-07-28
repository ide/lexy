import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";

/**
 * A clean, non-blocking indicator that the device is offline. Rendered inline
 * at the top of a screen's content so it reads as a banner over whatever data
 * (cached or placeholder) sits beneath it, rather than replacing the screen.
 */
export function OfflineBanner({ message }: { message?: string }) {
  const orange = colors.systemOrange as string;
  return (
    <View style={[styles.banner, { backgroundColor: "rgba(255,149,0,0.15)" }]}>
      <Image
        source="sf:wifi.slash"
        tintColor={orange}
        style={styles.icon}
        contentFit="contain"
      />
      <ThemedText type="smallBold" style={{ color: orange }}>
        {message ?? "No internet connection"}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  icon: {
    width: 17,
    height: 17,
  },
});
