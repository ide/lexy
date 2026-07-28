import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { OfflineBanner } from "@/components/offline-banner";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function VehicleLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.systemBlue as string} />
      <ThemedText themeColor="secondaryLabel">Loading vehicle…</ThemedText>
    </View>
  );
}

export function VehicleError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <View style={styles.container}>
      <ThemedText type="subtitle">Vehicle unavailable</ThemedText>
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        {message}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={styles.button}
      >
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          Try again
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Skeleton({ style }: { style?: object }) {
  const theme = useTheme();
  return <View style={[{ backgroundColor: theme.fill }, style]} />;
}

/**
 * Shown when there is no cached vehicle to display and the device is offline —
 * i.e. we have nothing to render yet but don't want a blank screen or a
 * misleading "unavailable" error. An offline banner sits above grayed-out
 * placeholder cards shaped like the dashboard, so the app reads as "waiting for
 * a connection" rather than broken.
 */
export function VehiclePlaceholder() {
  return (
    <View style={styles.placeholder}>
      <OfflineBanner message="No internet connection — connect to load your vehicle" />
      <Skeleton style={styles.heroSkeleton} />
      <View style={styles.metricRow}>
        <Skeleton style={styles.metricSkeleton} />
        <Skeleton style={styles.metricSkeleton} />
        <Skeleton style={styles.metricSkeleton} />
      </View>
      <View style={styles.metricRow}>
        <Skeleton style={styles.blockSkeleton} />
        <Skeleton style={styles.blockSkeleton} />
      </View>
      <Skeleton style={styles.wideSkeleton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    padding: Spacing.four,
  },
  message: {
    textAlign: "center",
  },
  button: {
    borderRadius: 100,
    backgroundColor: colors.systemBlue,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  buttonLabel: {
    color: "#FFFFFF",
  },
  placeholder: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  metricRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  heroSkeleton: {
    height: 220,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  metricSkeleton: {
    flex: 1,
    height: 96,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  blockSkeleton: {
    flex: 1,
    height: 120,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  wideSkeleton: {
    height: 120,
    borderRadius: 18,
    borderCurve: "continuous",
  },
});
