import { fetch as expoFetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import type { SFSymbol } from "sf-symbols-typescript";

import { Card } from "@/components/card";
import { Icon } from "@/components/icon";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/auth/auth-context";
import { Spacing, colors } from "@/constants/theme";
import { queryClient } from "@/data/query-client";
import type { VehicleContext } from "@/data/lexus-api";
import { sendRemoteCommand, type RemoteCommand } from "@/data/remote-command";
import type { Vehicle } from "@/data/vehicle";

type Control = {
  command: RemoteCommand;
  label: string;
  symbol: SFSymbol;
  tint: string;
  confirmTitle: string;
  confirmMessage: string;
  destructive: boolean;
  actionLabel: string;
};

const blue = colors.systemBlue as string;
const green = colors.systemGreen as string;
const orange = colors.systemOrange as string;

const CONTROLS: Control[] = [
  {
    command: "door-lock",
    label: "Lock",
    symbol: "lock.fill",
    tint: green,
    confirmTitle: "Lock your Lexus?",
    confirmMessage: "This locks all doors.",
    destructive: false,
    actionLabel: "Lock",
  },
  {
    command: "door-unlock",
    label: "Unlock",
    symbol: "lock.open.fill",
    tint: orange,
    confirmTitle: "Unlock your Lexus?",
    confirmMessage: "This unlocks the doors. Only do this when you're near the vehicle.",
    destructive: true,
    actionLabel: "Unlock",
  },
  {
    command: "engine-start",
    label: "Start",
    symbol: "power",
    tint: blue,
    confirmTitle: "Remotely start the engine?",
    confirmMessage:
      "Never remotely start the engine in an enclosed space, or with a child or pet inside the vehicle.",
    destructive: true,
    actionLabel: "Start engine",
  },
];

function ControlButton({
  control,
  disabled,
  onPress,
}: {
  control: Control;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.buttonWrapper}
    >
      {({ pressed }) => (
        <Card
          style={[
            styles.button,
            pressed && { opacity: 0.7 },
            disabled && { opacity: 0.4 },
          ]}
        >
          <Icon name={control.symbol} size={22} tint={control.tint} />
          <ThemedText type="smallBold">{control.label}</ThemedText>
        </Card>
      )}
    </Pressable>
  );
}

/**
 * On-screen remote controls (lock / unlock / engine start). Always rendered,
 * including in production. Note the command codes are only partially confirmed
 * against Lexus's schema and the buttons actuate a real vehicle, so each action
 * confirms first (engine start carries the enclosed-space safety warning).
 *
 * Subscription/entitlement gating is intentionally not wired: the
 * `vehicle-subscriptions` response shape hasn't been captured, so there's no
 * honest way to tell whether Remote Connect is active yet. Add that gate once a
 * real response is available.
 */
export function VehicleControls({ vehicle }: { vehicle: Vehicle }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);

  const enabled = !busy && !!session;

  // Doors are the only closures with a lock, so the section-title indicator is
  // "Locked" only when every known door reports locked. Mirrors the summary
  // that used to sit on the hero card.
  const lockStates = vehicle.closures
    .map((closure) => closure.locked)
    .filter((value): value is boolean => value !== undefined);
  const locked = lockStates.length > 0 && lockStates.every(Boolean);
  const lockColor = locked ? green : orange;

  const run = (control: Control) => {
    if (!session) {
      return;
    }
    const context: VehicleContext = {
      vin: vehicle.vin,
      brand: vehicle.brand,
      generation: vehicle.generation,
    };
    setBusy(true);
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    sendRemoteCommand(session, context, control.command, expoFetch)
      .then(() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Acceptance, not completion — give the vehicle a moment to actuate,
        // then re-read status so the screen reflects the change.
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["vehicle"] });
        }, 5000);
        Alert.alert(
          "Command sent",
          `Lexy asked your vehicle to ${control.actionLabel.toLowerCase()}. It can take a moment to complete.`,
        );
      })
      .catch((error: unknown) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert(
          "Command failed",
          error instanceof Error ? error.message : "The command could not be sent.",
        );
      })
      .finally(() => setBusy(false));
  };

  const confirm = (control: Control) => {
    Alert.alert(control.confirmTitle, control.confirmMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: control.actionLabel,
        style: control.destructive ? "destructive" : "default",
        onPress: () => run(control),
      },
    ]);
  };

  return (
    <View>
      <View style={styles.titleRow}>
        <SectionTitle style={styles.title}>REMOTE CONTROLS</SectionTitle>
        <View style={styles.lockStatus}>
          <Icon
            name={locked ? "lock.fill" : "lock.open.fill"}
            size={13}
            tint={lockColor}
          />
          <ThemedText type="smallBold" style={{ color: lockColor }}>
            {locked ? "Locked" : "Unlocked"}
          </ThemedText>
        </View>
      </View>
      <View style={styles.row}>
        {CONTROLS.map((control) => (
          <ControlButton
            key={control.command}
            control={control}
            disabled={!enabled}
            onPress={() => confirm(control)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.one,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Mirrors the SectionTitle's own margins (left/bottom Spacing.two, top
  // Spacing.one) so the lock status lines up with the title baseline.
  lockStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    marginRight: Spacing.two,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  buttonWrapper: {
    flex: 1,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
});
