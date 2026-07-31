import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";

/**
 * A clean, non-blocking indicator that the data below it is degraded — the
 * device is offline, or the last refresh failed. Rendered inline at the top of
 * a screen's content so it reads as a banner over whatever data (cached or
 * placeholder) sits beneath it, rather than replacing the screen.
 *
 * `title` states the condition; `detail` explains what it means for the data on
 * screen (e.g. that it's cached, or that reconnecting is needed to load
 * anything). Both conditions are amber, not red: the data is stale, not broken,
 * and the screen is still usable. A failure with nothing to fall back on is not
 * a banner at all — that's the full-screen `VehicleError`.
 */
export function StatusBanner({
  symbol,
  title,
  detail,
}: {
  symbol: SFSymbol;
  title: string;
  detail?: string;
}) {
  const orange = colors.systemOrange;
  return (
    <View style={[styles.banner, { backgroundColor: "rgba(255,149,0,0.15)" }]}>
      <Image source={`sf:${symbol}`} tintColor={orange} style={styles.icon} contentFit="contain" />
      <View style={styles.text}>
        <ThemedText type="smallBold" style={{ color: orange }}>
          {title}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" style={[styles.detail, { color: orange }]}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
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
  // Take the row's remaining width and allow shrinking so long copy wraps
  // inside the banner's horizontal padding instead of overflowing past it.
  text: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  // The condition is stated in the bold title; the helper line reads as
  // supporting detail, so soften it slightly.
  detail: {
    opacity: 0.85,
  },
});
