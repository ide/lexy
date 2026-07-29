import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";

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

/**
 * Shown when the account authenticates but has no vehicle enrolled — a distinct
 * empty state from a load failure. Guides the user to add a car in the Lexus
 * app, then retry (discovery re-runs on tap / pull-to-refresh).
 */
export function NoVehicleState({ retry }: { retry: () => void }) {
  return (
    <View style={styles.container}>
      <Icon name="car.2" size={44} tint={colors.secondaryLabel as string} />
      <ThemedText type="subtitle">No vehicle found</ThemedText>
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        There&apos;s no vehicle associated with this Lexus account. Add your car
        in the Lexus app, then check again here.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={styles.button}
      >
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          Check again
        </ThemedText>
      </Pressable>
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
});
