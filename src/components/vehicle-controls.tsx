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
import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { Spacing, colors } from "@/constants/theme";
import { queryClient } from "@/data/query-client";
import { applyOptimisticLock, readClosures } from "@/data/closure-state";
import { loadClosureStore, saveClosureStore } from "@/data/closure-state-store";
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
 * On-screen remote controls (lock / unlock / engine start). Gated to dev and
 * preview builds via SHOW_DEV_TOOLS: the command codes are only partially
 * confirmed against Lexus's schema and the buttons actuate a real vehicle, so
 * they stay out of production until verified on a car. Each action confirms
 * first (engine start carries the enclosed-space safety warning).
 *
 * Subscription/entitlement gating is intentionally not wired: the
 * `vehicle-subscriptions` response shape hasn't been captured, so there's no
 * honest way to tell whether Remote Connect is active yet. Add that gate once a
 * real response is available.
 */
export function VehicleControls({ vehicle }: { vehicle: Vehicle }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!SHOW_DEV_TOOLS) {
    return null;
  }

  const enabled = !busy && !!session;

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
      .then(async () => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Acceptance, not completion. For lock/unlock, optimistically fold the
        // predicted lock state into the closure store — flagged optimistic so
        // the screen shows it as pending — and push it into the cache for an
        // instant reflection. (Engine start changes no closure, so there's
        // nothing to predict there.)
        if (control.command === "door-lock" || control.command === "door-unlock") {
          const store = applyOptimisticLock(
            await loadClosureStore(),
            vehicle.vin,
            control.command === "door-lock",
            new Date().toISOString(),
          );
          await saveClosureStore(store);
          const closures = readClosures(store);
          queryClient.setQueryData<Vehicle>(["vehicle"], (old) =>
            old ? { ...old, closures } : old,
          );
        }
        // Reconcile with the server via a non-waking status read: the plain
        // vehicle refetch GETs status without priming the telematics unit, and
        // the fold merges its (possibly partial, possibly stale) payload without
        // clobbering the optimistic value. A second pass a few seconds later
        // catches late propagation.
        queryClient.invalidateQueries({ queryKey: ["vehicle"] });
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
      <SectionTitle style={styles.title}>REMOTE CONTROLS</SectionTitle>
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
