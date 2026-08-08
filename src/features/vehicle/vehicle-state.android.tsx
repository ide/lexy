import { Color } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon-registry";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { openLexusApp } from "@/data/lexus-app";

/**
 * The Android half of the vehicle empty/error states — the same two exports,
 * the same retry contract, drawn in React Native instead of SwiftUI. These
 * reach the screen through `useVehicleScreen`, which every vehicle screen
 * shares, so Specs needs them even while the rest of the tab bar is a
 * placeholder.
 *
 * Only the failure takes a glyph. `warning` is a verdict the icon registry
 * already names on both platforms, while "no vehicle found" is not a fault and
 * iOS's `car.2` has no Material counterpart chosen for it yet — that state
 * leads with its headline rather than inventing one.
 */
function StateScreen({
  icon,
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {icon ? <Icon name={icon} size={44} tint={colors.secondaryLabel} /> : null}
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

/**
 * The primary recovery action. Material's filled button: the accent as the
 * fill, its on-color as the label, and a pressed state carried by the fill
 * rather than by fading the whole control out.
 */
function RetryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.button, pressed && styles.buttonPressed]}>
          <ThemedText style={styles.buttonLabel}>{label}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export function VehicleError({ retry, detail }: { retry: () => void; detail?: string }) {
  return (
    <StateScreen icon="warning" title="Vehicle data unavailable">
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        {detail ??
          "We couldn't reach the Lexus vehicle service. Check your connection and try again."}
      </ThemedText>
      <RetryButton label="Try again" onPress={retry} />
    </StateScreen>
  );
}

/**
 * Shown when the account authenticates but has no vehicle enrolled — a distinct
 * empty state from a load failure. Guides the user to add a car in the Lexus
 * app, then retry (discovery re-runs on tap / pull-to-refresh). The pointer to
 * that app is its own tappable line here: the iOS copy carries it as an inline
 * markdown link, which React Native text has no equivalent for.
 */
export function NoVehicleState({ retry }: { retry: () => void }) {
  return (
    <StateScreen title="No vehicle found">
      <ThemedText themeColor="secondaryLabel" style={styles.message}>
        There&rsquo;s no vehicle associated with this Lexus account. Add your vehicle in the Lexus
        app, then check again here.
      </ThemedText>
      <Pressable accessibilityRole="link" onPress={() => openLexusApp()}>
        {({ pressed }) => (
          <ThemedText type="linkPrimary" style={pressed && styles.linkPressed}>
            Open the Lexus app
          </ThemedText>
        )}
      </Pressable>
      <RetryButton label="Check again" onPress={retry} />
    </StateScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  message: {
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.systemBlue,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    // Material's fully rounded button shape.
    borderRadius: 20,
    borderCurve: "continuous",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  // The label that sits *on* the accent. That is a role the shared palette has
  // no name for — the iOS button spends a literal "white" on it — and it isn't
  // one on Android, where `primary` is dark in the light scheme and light in
  // the dark one, so it comes straight from Material.
  buttonLabel: {
    color: Color.android.dynamic.onPrimary as string,
  },
  linkPressed: {
    opacity: 0.6,
  },
});
