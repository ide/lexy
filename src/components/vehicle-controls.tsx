import {
  Button,
  GlassEffectContainer,
  HStack,
  Host,
  Image as SFImage,
  Namespace,
  Text as SFText,
  Spacer,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  glassEffectId,
  hidden,
  padding,
  redacted,
} from "@expo/ui/swift-ui/modifiers";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useId, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { Icon } from "@/components/icon";
import { PulsingText } from "@/components/pulsing-text";
import { useRedacted } from "@/components/redactable";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/auth/auth-context";
import { Spacing, colors } from "@/constants/theme";
import { ENGINE_POLL_COUNT, ENGINE_POLL_INTERVAL_MS } from "@/data/engine-status";
import type { VehicleContext } from "@/data/lexus-api";
import { refreshVehicleStatus } from "@/data/refresh-status-sender";
import type { RemoteCapability } from "@/data/remote-capabilities";
import { sendRemoteCommand, type RemoteCommand } from "@/data/remote-command";
import { reflectAcceptedCommand } from "@/data/remote-command-effects";
import { vehicleContext, type Vehicle } from "@/data/vehicle";
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
  confirmTitle: "Lock your vehicle?",
  confirmMessage: "This locks all doors.",
  destructive: false,
  actionLabel: "Lock",
};

const UNLOCK: Control = {
  command: "door-unlock",
  label: "Unlock",
  symbol: "lock.open.fill",
  tint: orange,
  confirmTitle: "Unlock your vehicle?",
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

// ---- More Controls ----------------------------------------------------------
// The rest of what this plane can actuate. Kept behind a disclosure because
// none of it is a daily action and two of them make noise, and gated per
// capability so a car is only ever offered what it will accept.

const TRUNK_UNLOCK: Control = {
  command: "trunk-unlock",
  label: "Trunk",
  symbol: "car.side.rear.crop.trunk.partition",
  tint: orange,
  confirmTitle: "Unlock the trunk?",
  confirmMessage: "This unlocks the trunk. Only do this when you're near the vehicle.",
  destructive: true,
  actionLabel: "Unlock trunk",
};

const TRUNK_LOCK: Control = {
  command: "trunk-lock",
  label: "Lock trunk",
  symbol: "car.side.rear.crop.trunk.partition.fill",
  tint: green,
  confirmTitle: "Lock the trunk?",
  confirmMessage: "This locks the trunk.",
  destructive: false,
  actionLabel: "Lock trunk",
};

const HORN: Control = {
  command: "sound-horn",
  label: "Horn",
  symbol: "horn.blast.fill",
  tint: red,
  confirmTitle: "Sound the horn?",
  confirmMessage: "The vehicle will sound its horn. Don't use this to startle anyone.",
  destructive: true,
  actionLabel: "Sound horn",
};

const BUZZER: Control = {
  command: "buzzer-warning",
  label: "Buzzer",
  symbol: "bell.and.waves.left.and.right.fill",
  tint: orange,
  confirmTitle: "Sound the buzzer?",
  confirmMessage: "The vehicle beeps ten times.",
  destructive: false,
  actionLabel: "Sound buzzer",
};

const HAZARDS_ON: Control = {
  command: "hazard-on",
  label: "Hazards",
  symbol: "car.rear.hazardsign.fill",
  tint: orange,
  confirmTitle: "Flash the hazards?",
  confirmMessage: "The hazard lights start flashing until you turn them off.",
  destructive: false,
  actionLabel: "Turn on",
};

const HAZARDS_OFF: Control = {
  command: "hazard-off",
  label: "Hazards off",
  symbol: "car.rear.hazardsign",
  tint: blue,
  confirmTitle: "Turn off the hazards?",
  confirmMessage: "This stops the hazard lights.",
  destructive: false,
  actionLabel: "Turn off",
};

const HEADLIGHTS: Control = {
  command: "headlight-on",
  label: "Lights",
  symbol: "headlight.low.beam.fill",
  tint: blue,
  confirmTitle: "Flash the headlights?",
  confirmMessage: "The headlights come on to help you find the vehicle.",
  destructive: false,
  actionLabel: "Turn on",
};

/**
 * Extra controls in display order, each with the capability that has to be
 * present for it to appear. There is no `headlight-off`: the app's own enum
 * doesn't define one, so the lights are a find-my-car flash rather than a
 * switch, and offering an "off" that can't be sent would be a lie.
 */
const MORE_CONTROLS: { capability: RemoteCapability; control: Control }[] = [
  { capability: "trunk", control: TRUNK_UNLOCK },
  { capability: "trunk", control: TRUNK_LOCK },
  { capability: "horn", control: HORN },
  { capability: "buzzer", control: BUZZER },
  { capability: "hazards", control: HAZARDS_ON },
  { capability: "hazards", control: HAZARDS_OFF },
  { capability: "headlights", control: HEADLIGHTS },
];

/** Buttons per row, matching the three of the main row above. */
const CONTROLS_PER_ROW = 3;
/** The main row's height, which these rows match so the grid reads as one. */
const CONTROL_ROW_HEIGHT = 76;

const EXPAND_TIMING = { duration: 260 } as const;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

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
  // Only what this car says it will accept. Doors and the engine are the two
  // the main row assumes; everything else has to earn its place.
  const extras = MORE_CONTROLS.filter(({ capability }) =>
    vehicle.remoteCapabilities.includes(capability),
  ).map(({ control }) => control);

  // No reading yet means no claim — the indicator stays absent rather than
  // asserting "Stopped" about an engine we haven't asked about. The redacted
  // pass is the exception: the engine read is skipped there, but the run is
  // right-aligned, so an absent second indicator would leave the lock one
  // parked against the margin and slide it left the moment the first reading
  // lands. It draws as a bar either way, so the word only sets the width.
  const engineLabel = pending
    ? pending.command === "engine-start"
      ? "Starting"
      : "Stopping"
    : engine
      ? engine.running
        ? "Started"
        : "Stopped"
      : isRedacted
        ? "Stopped"
        : null;
  const engineColor = engine?.running ? green : colors.secondaryLabel;

  const run = (control: Control) => {
    if (!session) {
      return;
    }
    const context: VehicleContext = vehicleContext(vehicle);
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
        // section title already shows the pending state ("Locking…"). The
        // prime callback is its escalation path when plain re-reads keep
        // returning the pre-command snapshot.
        await reflectAcceptedCommand(context, control.command, () =>
          runAuthorized((session) => refreshVehicleStatus(session, context)),
        );
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
        {/* Lock state before engine state, matching the button order below
            (Lock, Unlock, then Start/Stop). */}
        <View style={styles.status}>
          {/* Mid-command the word pulses instead of trailing an ellipsis —
              the wait has no length to promise, only a state to report. */}
          <View style={styles.statusItem}>
            <Icon name={locked ? "lock.fill" : "lock.open.fill"} size={13} tint={lockColor} />
            <PulsingText pulsing={lockPending}>
              <ThemedText type="smallBold" style={{ color: lockColor }}>
                {lockPending ? (locked ? "Locking" : "Unlocking") : locked ? "Locked" : "Unlocked"}
              </ThemedText>
            </PulsingText>
          </View>
          {engineLabel ? (
            <View style={styles.statusItem}>
              <Icon name="power" size={13} tint={engineColor} />
              <PulsingText pulsing={pending !== null}>
                <ThemedText type="smallBold" style={{ color: engineColor }}>
                  {engineLabel}
                </ThemedText>
              </PulsingText>
            </View>
          ) : null}
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
          shells keep their shape; their contents are hidden rather than
          placeholdered (see below), so what is left is the buttons' own
          outlines at their own size. `disabled` keeps them from actuating a car
          we have no data for. */}
      <ControlRow
        controls={controls}
        enabled={enabled}
        isRedacted={isRedacted}
        namespaceId={namespaceId}
        onPress={confirm}
      />
      {/* Nothing to disclose on a car that reports none of these — and the
          placeholder reports none, so the skeleton never shows a row it might
          have to take away. */}
      {extras.length > 0 ? (
        <MoreControls controls={extras} enabled={enabled} onPress={confirm} />
      ) : null}
    </View>
  );
}

/**
 * One row of glass control buttons. Shared by the main row and each row of the
 * More Controls grid so the two are the same button at the same size, not two
 * things that resemble each other.
 */
function ControlRow({
  controls,
  enabled,
  isRedacted = false,
  namespaceId,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  isRedacted?: boolean;
  namespaceId: string;
  onPress: (control: Control) => void;
}) {
  return (
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
                onPress={() => onPress(control)}
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
                  {/* The real icon and label, drawn or not. `hidden` keeps
                      a view in the layout while suppressing its drawing, so
                      the redacted row is laid out by exactly the content it
                      is standing in for — the shells are the live shells,
                      to the point, with no stand-in geometry to keep in sync
                      and nothing to jump when the data lands. */}
                  <SFImage
                    systemName={control.symbol}
                    size={22}
                    color={control.tint}
                    modifiers={[hidden(isRedacted)]}
                  />
                  {/* A glass button tints its label with the accent color,
                      which turns every label blue. The label is text, not an
                      action color — the icon already carries the action. */}
                  <SFText
                    modifiers={[
                      font({ textStyle: "footnote", weight: "semibold" }),
                      foregroundColor(colors.label),
                      hidden(isRedacted),
                    ]}
                  >
                    {control.label}
                  </SFText>
                </VStack>
              </Button>
            ))}
            {/* A short final row keeps the grid: without these the two buttons
                of a 2-of-3 row would split the width and sit wider than the
                six above them. */}
            {Array.from({ length: CONTROLS_PER_ROW - controls.length }, (_, index) => (
              <Spacer key={`spacer-${index}`} modifiers={[frame({ maxWidth: Infinity })]} />
            ))}
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}

/**
 * The capability-gated extras, behind a disclosure.
 *
 * Same expansion mechanic as the Doors & Windows card: a Reanimated height clip
 * on the UI thread, because a SwiftUI animation cannot span the host boundary
 * (the RN side snaps to the new size instead of growing). The height is
 * computed rather than measured — every row is exactly one `CONTROL_ROW_HEIGHT`
 * — so the first expansion already knows where to land.
 */
function MoreControls({
  controls,
  enabled,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  onPress: (control: Control) => void;
}) {
  const namespaceId = useId();
  const [expanded, setExpanded] = useState(false);
  const rows = chunk(controls, CONTROLS_PER_ROW);
  const openHeight = rows.length * CONTROL_ROW_HEIGHT;

  const height = useSharedValue(0);
  const rotation = useSharedValue(0);
  const clipStyle = useAnimatedStyle(() => ({ height: height.value }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    haptic("selection");
    rotation.value = withTiming(next ? 90 : 0, EXPAND_TIMING);
    height.value = withTiming(next ? openHeight : 0, EXPAND_TIMING);
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Shows the vehicle's other remote controls"
        onPress={toggle}
      >
        {({ pressed }) => (
          <View style={[styles.moreHeader, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.moreLabel}>
              More Controls
            </ThemedText>
            <Animated.View style={chevronStyle}>
              <Icon name="chevron.right" size={12} tint={colors.secondaryLabel} />
            </Animated.View>
          </View>
        )}
      </Pressable>
      <Animated.View style={[styles.moreClip, clipStyle]}>
        {rows.map((row, index) => (
          <ControlRow
            key={index}
            controls={row}
            enabled={enabled}
            namespaceId={`${namespaceId}-${index}`}
            onPress={onPress}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.one,
  },
  // Title on the leading edge, indicators on the trailing one, each inset the
  // same amount (see `status`). The cost is that "Locked" growing into
  // "Locking…" pushes the run leftward instead of only extending it — the
  // right edge is what stays put.
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  // Mirrors the SectionTitle's own margins (bottom Spacing.two, top
  // Spacing.one) so the status indicators line up with the title baseline, and
  // the trailing inset mirrors the title's leading one so the row is inset the
  // same amount on both ends.
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginRight: Spacing.two,
    marginBottom: Spacing.two,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  row: {
    height: CONTROL_ROW_HEIGHT,
    backgroundColor: "transparent",
  },
  // Reads as a quiet continuation of the row above rather than a second
  // section: same small-bold type as the status indicators, not a SectionTitle.
  moreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  moreLabel: {
    color: colors.secondaryLabel,
  },
  pressed: {
    opacity: 0.6,
  },
  // Clips the rows to the animated height; without this they spill out of the
  // collapsed box instead of being hidden by it.
  moreClip: {
    overflow: "hidden",
  },
});
