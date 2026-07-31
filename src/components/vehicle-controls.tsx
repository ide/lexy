import {
  Button,
  Capsule,
  GlassEffectContainer,
  HStack,
  Host,
  Image as SFImage,
  Namespace,
  RoundedRectangle,
  Text as SFText,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  glassEffectId,
  padding,
  redacted,
  unredacted,
} from "@expo/ui/swift-ui/modifiers";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useId, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { Icon } from "@/components/icon";
import { useRedacted } from "@/components/redactable";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/auth/auth-context";
import { Spacing, colors } from "@/constants/theme";
import { ENGINE_POLL_COUNT, ENGINE_POLL_INTERVAL_MS } from "@/data/engine-status";
import type { VehicleContext } from "@/data/lexus-api";
import { sendRemoteCommand, type RemoteCommand } from "@/data/remote-command";
import { reflectAcceptedCommand } from "@/data/remote-command-effects";
import type { Vehicle } from "@/data/vehicle";
import { useEngineStatus } from "@/hooks/use-engine-status";
import { haptic } from "@/utils/haptics";

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

const blue = colors.systemBlue;
const green = colors.systemGreen;
const orange = colors.systemOrange;
const red = colors.systemRed;

const LOCK: Control = {
  command: "door-lock",
  label: "Lock",
  symbol: "lock.fill",
  tint: green,
  confirmTitle: "Lock your Lexus?",
  confirmMessage: "This locks all doors.",
  destructive: false,
  actionLabel: "Lock",
};

const UNLOCK: Control = {
  command: "door-unlock",
  label: "Unlock",
  symbol: "lock.open.fill",
  tint: orange,
  confirmTitle: "Unlock your Lexus?",
  confirmMessage: "This unlocks the doors. Only do this when you're near the vehicle.",
  destructive: true,
  actionLabel: "Unlock",
};

const ENGINE_START: Control = {
  command: "engine-start",
  label: "Start",
  symbol: "power",
  tint: blue,
  confirmTitle: "Remotely start the engine?",
  confirmMessage:
    "Never remotely start the engine in an enclosed space, or with a child or pet inside the vehicle.",
  destructive: true,
  actionLabel: "Start engine",
};

const ENGINE_STOP: Control = {
  command: "engine-stop",
  label: "Stop",
  symbol: "power",
  tint: red,
  confirmTitle: "Stop the engine?",
  confirmMessage: "This ends the remote start.",
  destructive: false,
  actionLabel: "Stop engine",
};

// The redacted stand-ins for a button's icon and label, sized to the real
// thing. Generously rounded on purpose — the sharp corners are what make a
// default placeholder read as a rectangle rather than as content.
const PLACEHOLDER_ICON = { size: { width: 24, height: 24 }, radius: 9 };
const PLACEHOLDER_LABEL = { width: 42, height: 11 };

/** The window a just-issued engine command has to show up in engine-status. */
const ENGINE_PENDING_MS = ENGINE_POLL_COUNT * ENGINE_POLL_INTERVAL_MS;

type EngineCommand = "engine-start" | "engine-stop";

/**
 * On-screen remote controls (lock / unlock / engine start-stop). Always
 * rendered, including in production. The command codes are confirmed against
 * the official app's own enum, but the buttons actuate a real vehicle, so each
 * action confirms first (engine start carries the enclosed-space safety
 * warning).
 *
 * These are real SwiftUI buttons rather than RN pressables: Liquid Glass gives
 * the row edge definition against the flat cards around it, and the native
 * control brings its own pressed/disabled/accessibility behavior instead of the
 * JS opacity swaps this used to fake. The glass shell is the whole button — no
 * fill behind it, or that fill's corners show around the shell and each button
 * reads as sitting inside a container.
 *
 * Subscription/entitlement gating is intentionally not wired: the
 * `vehicle-subscriptions` response shape hasn't been captured, so there's no
 * honest way to tell whether Remote Connect is active yet. Add that gate once a
 * real response is available.
 */
export function VehicleControls({ vehicle }: { vehicle: Vehicle }) {
  const { session, runAuthorized } = useAuth();
  const isRedacted = useRedacted();
  const [busy, setBusy] = useState(false);
  // No engine read while standing in for data we don't have — the placeholder
  // VIN isn't a car.
  const engine = useEngineStatus(vehicle, { placeholder: isRedacted });
  // Set the moment an engine command is accepted, so the row reports
  // "Starting…"/"Stopping…" while engine-status is still catching up.
  const [pending, setPending] = useState<{ command: EngineCommand; deadline: number } | null>(null);
  // The SwiftUI namespace the glass shells morph within, so the third button's
  // Start→Stop swap animates instead of cutting.
  const namespaceId = useId();

  const enabled = !busy && !!session && !isRedacted;

  // Doors are the only closures with a lock, so the section-title indicator is
  // "Locked" only when every known door reports locked. Mirrors the summary
  // that used to sit on the hero card.
  const lockStates = vehicle.closures
    .map((closure) => closure.locked)
    .filter((value): value is boolean => value !== undefined);
  const locked = lockStates.length > 0 && lockStates.every(Boolean);
  const lockColor = locked ? green : orange;
  // Pending while any door still shows an unconfirmed optimistic prediction
  // from a just-issued lock/unlock command (see closure-state.ts).
  const lockPending = vehicle.closures.some((closure) => closure.lockedOptimistic);

  // Resolve the pending label as soon as engine-status agrees with what we
  // asked for.
  useEffect(() => {
    if (pending && engine && engine.running === (pending.command === "engine-start")) {
      setPending(null);
    }
  }, [pending, engine]);

  // ...and give up on it when the poll window closes, so a command the vehicle
  // silently dropped doesn't leave "Starting…" on screen forever.
  useEffect(() => {
    if (!pending) {
      return;
    }
    const remaining = pending.deadline - Date.now();
    if (remaining <= 0) {
      setPending(null);
      return;
    }
    const timeout = setTimeout(() => setPending(null), remaining);
    return () => clearTimeout(timeout);
  }, [pending]);

  // The engine slot is one button that swaps: Stop while the car reports
  // running, Start otherwise.
  const engineControl = engine?.running ? ENGINE_STOP : ENGINE_START;
  const controls = [LOCK, UNLOCK, engineControl];

  // No reading yet means no claim — the indicator stays absent rather than
  // asserting "Stopped" about an engine we haven't asked about.
  const engineLabel = pending
    ? pending.command === "engine-start"
      ? "Starting…"
      : "Stopping…"
    : engine
      ? engine.running
        ? "Started"
        : "Stopped"
      : null;
  const engineColor = engine?.running ? green : colors.secondaryLabel;

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
    haptic("impact-medium");
    runAuthorized((session) => sendRemoteCommand(session, context, control.command, expoFetch))
      .then(async () => {
        haptic("success");
        if (control.command === "engine-start" || control.command === "engine-stop") {
          setPending({ command: control.command, deadline: Date.now() + ENGINE_PENDING_MS });
        }
        // Acceptance, not completion; the optimistic fold and the reconciling
        // refetches live in remote-command-effects.ts. No success alert: the
        // section title already shows the pending state ("Locking…").
        await reflectAcceptedCommand(vehicle.vin, control.command);
      })
      .catch((error: unknown) => {
        haptic("error");
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
        <View style={styles.status}>
          {engineLabel ? (
            <View style={styles.statusItem}>
              <Icon name="power" size={13} tint={engineColor} />
              <ThemedText type="smallBold" style={{ color: engineColor }}>
                {engineLabel}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.statusItem}>
            <Icon name={locked ? "lock.fill" : "lock.open.fill"} size={13} tint={lockColor} />
            <ThemedText type="smallBold" style={{ color: lockColor }}>
              {lockPending ? (locked ? "Locking…" : "Unlocking…") : locked ? "Locked" : "Unlocked"}
            </ThemedText>
          </View>
        </View>
      </View>
      {/* One Host for the whole row, not one per button: a measuring host
          reports a zero-size box on its first layout pass (see hero-card.tsx),
          and three of those would collapse the row three times over. The height
          is pinned for the same reason — 76pt measured from the live row. */}
      {/* The row is SwiftUI, so it does not inherit the RN `Redactable` tree's
          redaction the way the cards around it do — left alone it renders fully
          live (real icons, real labels, real glass) against a screen of grey
          skeleton bars. `redacted` is SwiftUI's own modifier, so the glass
          shells keep their shape and only their contents become placeholders;
          `disabled` keeps them from actuating a car we have no data for. */}
      <Host
        style={styles.row}
        modifiers={isRedacted ? [redacted("placeholder"), disabledModifier(true)] : undefined}
      >
        <Namespace id={namespaceId}>
          <GlassEffectContainer spacing={Spacing.two}>
            <HStack spacing={Spacing.two}>
              {controls.map((control, slot) => (
                <Button
                  // Keyed by slot, not command: the engine button must stay the
                  // same React element across the Start→Stop swap, or it is
                  // torn down and rebuilt and there is nothing left to morph.
                  key={slot}
                  onPress={() => confirm(control)}
                  modifiers={[
                    // No separate background fill behind this: the glass shell
                    // has its own shape and inset, so painting a rect across the
                    // button's full frame leaves that rect's corners showing
                    // around the shell — the button reads as sitting inside a
                    // container. The shell *is* the button.
                    buttonStyle("glass"),
                    // Identity is per *slot*, not per command, for the same
                    // reason as the key: the engine slot keeps one id across
                    // the Start→Stop swap so the glass morphs in place.
                    glassEffectId(`control-${slot}`, namespaceId),
                    disabledModifier(!enabled),
                  ]}
                >
                  {/* The width lives on the *label*, not the Button: a glass
                      button's shell wraps its label, so sizing the button
                      leaves a content-sized pill floating in an empty frame. */}
                  <VStack
                    spacing={Spacing.one}
                    modifiers={[padding({ vertical: Spacing.two }), frame({ maxWidth: Infinity })]}
                  >
                    {isRedacted ? (
                      // Drawn by hand rather than left to `redacted`, which
                      // placeholders a symbol as a hard-cornered rect in the
                      // symbol's own color — three sharp, faintly tinted specks.
                      // `unredacted` exempts these from the Host's redaction so
                      // they render exactly as specified; the shells above still
                      // redact, which is what keeps the button outlines.
                      <>
                        <RoundedRectangle
                          cornerRadius={PLACEHOLDER_ICON.radius}
                          modifiers={[
                            unredacted(),
                            frame(PLACEHOLDER_ICON.size),
                            foregroundColor(colors.fill),
                          ]}
                        />
                        <Capsule
                          modifiers={[
                            unredacted(),
                            frame(PLACEHOLDER_LABEL),
                            foregroundColor(colors.fill),
                          ]}
                        />
                      </>
                    ) : (
                      <>
                        <SFImage systemName={control.symbol} size={22} color={control.tint} />
                        {/* A glass button tints its label with the accent color,
                            which turns every label blue. The label is text, not
                            an action color — the icon already carries the
                            action. */}
                        <SFText
                          modifiers={[
                            font({ textStyle: "footnote", weight: "semibold" }),
                            foregroundColor(colors.label),
                          ]}
                        >
                          {control.label}
                        </SFText>
                      </>
                    )}
                  </VStack>
                </Button>
              ))}
            </HStack>
          </GlassEffectContainer>
        </Namespace>
      </Host>
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
  // Spacing.one) so the status indicators line up with the title baseline.
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    marginRight: Spacing.two,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  row: {
    height: 76,
    backgroundColor: "transparent",
  },
});
