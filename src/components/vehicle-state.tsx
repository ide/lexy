import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { openLexusApp } from "@/data/lexus-app";

/**
 * The primary action for the empty/error states: a native SwiftUI
 * `borderedProminent` button at the large control size, so it gets the system's
 * tap target, tint, and pressed/haptic behavior. The label is regular weight —
 * these are recovery actions, not shouted calls to action.
 */
function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Host matchContents>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle("borderedProminent"),
          controlSize("large"),
          tint(colors.systemBlue),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: "body" }),
            foregroundStyle("white"),
            padding({ horizontal: Spacing.three }),
          ]}
        >
          {label}
        </Text>
      </Button>
    </Host>
  );
}

export function VehicleError({ retry }: { retry: () => void }) {
  return (
    <View style={styles.container}>
      <Icon
        name="exclamationmark.triangle"
        size={44}
        tint={colors.secondaryLabel as string}
      />
      <ThemedText type="subtitle">Vehicle data unavailable</ThemedText>
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        We couldn&apos;t reach the Lexus vehicle service. Check your connection
        and try again.
      </ThemedText>
      <ActionButton label="Try again" onPress={retry} />
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
        in the{" "}
        <ThemedText
          accessibilityRole="link"
          onPress={() => openLexusApp()}
          style={styles.link}
        >
          Lexus app
        </ThemedText>
        , then check again here.
      </ThemedText>
      <ActionButton label="Check again" onPress={retry} />
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
  link: {
    color: colors.systemBlue as string,
  },
});
