import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { useAuth } from "@/auth/auth-context";
import { AlertHost, type AlertSpec } from "@/components/ui/alert-host";
import { Badge } from "@/components/ui/badge";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon-registry";
import { PulsingText } from "@/components/ui/pulsing-text";
import { useRedacted } from "@/components/ui/redactable";
import { SectionTitle } from "@/components/ui/section-title";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { ENGINE_POLL_COUNT, ENGINE_POLL_INTERVAL_MS } from "@/data/engine-status";
import type { VehicleContext } from "@/data/lexus-api";
import { refreshVehicleStatus } from "@/data/refresh-status-sender";
import { describeExtraControls, type RemoteCapability } from "@/data/remote-capabilities";
import { sendRemoteCommand, type RemoteCommand } from "@/data/remote-command";
import { reflectAcceptedCommand } from "@/data/remote-command-effects";
import { vehicleContext, type Vehicle } from "@/data/vehicle";
import { useEngineStatus } from "@/hooks/use-engine-status";
import { haptic } from "@/utils/haptics";

type Control = {
  command: RemoteCommand;
  label: string;
  symbol: IconName;
  tint: string;
  confirmTitle: string;
  confirmMessage: string;
  destructive: boolean;
  actionLabel: string;
};

const blue = colors.systemBlue;
const cyan = colors.systemCyan;
const green = colors.systemGreen;
const orange = colors.systemOrange;
const red = colors.systemRed;
const yellow = colors.systemYellow;

const LOCK: Control = {
  command: "door-lock",
  label: "Lock",
  symbol: "lock",
  tint: green,
  confirmTitle: "Lock your vehicle?",
  confirmMessage: "This locks all doors.",
  destructive: false,
  actionLabel: "Lock",
};

const UNLOCK: Control = {
  command: "door-unlock",
  label: "Unlock",
  symbol: "lock-open",
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
  actionLabel: "Start Engine",
};

const ENGINE_STOP: Control = {
  command: "engine-stop",
  label: "Stop",
  symbol: "power",
  tint: red,
  confirmTitle: "Stop the engine?",
  confirmMessage: "This ends the remote start.",
  destructive: false,
  actionLabel: "Stop Engine",
};

// ---- More Controls ----------------------------------------------------------
// The rest of what this plane can actuate. Kept behind a disclosure because
// none of it is a daily action and two of them make noise, and gated per
// capability so a car is only ever offered what it will accept.

const TRUNK_LOCK: Control = {
  command: "trunk-lock",
  label: "Lock Trunk",
  symbol: "trunk",
  tint: green,
  confirmTitle: "Lock the trunk?",
  confirmMessage: "This locks the trunk.",
  destructive: false,
  actionLabel: "Lock Trunk",
};

const TRUNK_UNLOCK: Control = {
  command: "trunk-unlock",
  label: "Unlock Trunk",
  symbol: "trunk",
  tint: orange,
  confirmTitle: "Unlock the trunk?",
  confirmMessage: "This unlocks the trunk. Only do this when you're near the vehicle.",
  destructive: true,
  actionLabel: "Unlock Trunk",
};

const HAZARDS_ON: Control = {
  command: "hazard-on",
  label: "Hazard Lights",
  symbol: "hazards",
  tint: red,
  confirmTitle: "Flash the hazards?",
  confirmMessage: "The hazard lights start flashing until you turn them off.",
  destructive: false,
  actionLabel: "Turn On",
};

const HAZARDS_OFF: Control = {
  command: "hazard-off",
  label: "Hazards Off",
  symbol: "hazards",
  tint: blue,
  confirmTitle: "Turn off the hazards?",
  confirmMessage: "This stops the hazard lights.",
  destructive: false,
  actionLabel: "Turn Off",
};

const HEADLIGHTS: Control = {
  command: "headlight-on",
  label: "Flash Lights",
  // A beam, not a button: the lighter blue reads as light where systemBlue
  // reads as the app's action colour.
  symbol: "headlights",
  tint: cyan,
  confirmTitle: "Flash the headlights?",
  confirmMessage: "The headlights come on to help you find the vehicle.",
  destructive: false,
  actionLabel: "Flash",
};

const BUZZER: Control = {
  command: "buzzer-warning",
  label: "Play Beeps",
  symbol: "buzzer",
  tint: yellow,
  confirmTitle: "Sound the buzzer?",
  confirmMessage: "The vehicle beeps ten times.",
  destructive: false,
  actionLabel: "Play Beeps",
};

const HORN: Control = {
  command: "sound-horn",
  label: "Honk Horn",
  symbol: "horn",
  tint: orange,
  confirmTitle: "Sound the horn?",
  confirmMessage: "The vehicle will sound its horn. Be sure not to startle anyone.",
  destructive: true,
  actionLabel: "Honk Horn",
};

/** Buttons per row, matching the three of the main row above. */
const CONTROLS_PER_ROW = 3;

/**
 * The glyph size every control wears. Material icons are drawn to a uniform em
 * box, so unlike the SF Symbols on iOS — which occupy wildly different
 * fractions of their point size — one number serves all of them.
 */
const CONTROL_ICON_SIZE = 22;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

/**
 * The extra controls a car will accept, in display order.
 *
 * Hazards are one button rather than a pair, the way the engine slot is: the
 * label and colour say which way it will go. There is no `headlight-off` — the
 * app's own enum doesn't define one, so the lights are a find-my-car flash
 * rather than a switch, and offering an "off" that can't be sent would be a lie.
 */
function extraControls(capabilities: RemoteCapability[], hazardsOn: boolean): Control[] {
  const has = (capability: RemoteCapability) => capabilities.includes(capability);
  return [
    ...(has("trunk") ? [TRUNK_LOCK, TRUNK_UNLOCK] : []),
    ...(has("hazards") ? [hazardsOn ? HAZARDS_OFF : HAZARDS_ON] : []),
    ...(has("headlights") ? [HEADLIGHTS] : []),
    ...(has("buzzer") ? [BUZZER] : []),
    ...(has("horn") ? [HORN] : []),
  ];
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
 * The buttons are React Native surfaces pressed through
 * react-native-gesture-handler rather than Compose buttons, for one reason: the
 * glyph. The app names its icons semantically and resolves them to a Material
 * *font* on Android (see icon-registry.ts), which a Compose `Icon` — it wants an
 * XML vector drawable — cannot take, and hosting eleven `RNHostView`s inside
 * eleven clickable Compose containers would put a foreign view over each
 * button's own touch area. The surfaces below are Material's tonal button
 * instead: a container tier for the fill, full-height corner rounding, and a
 * press carried by the fill rather than by fading the control out. The dialogs
 * they raise are real Compose `AlertDialog`s (see `AlertHost`).
 *
 * Subscription/entitlement gating is intentionally not wired: the
 * `vehicle-subscriptions` response shape hasn't been captured, so there is no
 * honest way to tell whether Remote Connect is active yet. Add that gate once a
 * real response is available.
 */
export function VehicleControls({ vehicle }: { vehicle: Vehicle }) {
  const { session, runAuthorized } = useAuth();
  const isRedacted = useRedacted();
  const [busy, setBusy] = useState(false);
  // The confirmation a command waits on, or the failure it came back with.
  const [alert, setAlert] = useState<AlertSpec | null>(null);
  // No engine read while standing in for data we don't have — the placeholder
  // VIN isn't a car.
  const engine = useEngineStatus(vehicle, { placeholder: isRedacted });
  // Set the moment an engine command is accepted, so the row reports
  // "Starting…"/"Stopping…" while engine-status is still catching up.
  const [pending, setPending] = useState<{ command: EngineCommand; deadline: number } | null>(null);
  // Which way the hazard button points. Nothing reports hazard state — it is
  // absent from the status snapshot and has no read of its own — so this
  // remembers what we last asked for and nothing reconciles it. A car whose
  // hazards were left on elsewhere opens the app offering to turn them on
  // again, which sends `hazard-on` to a car already flashing: harmless, and
  // preferable to an "off" button that would be equally wrong.
  const [hazardsOn, setHazardsOn] = useState(false);

  const enabled = !busy && !!session && !isRedacted;

  // Doors are the only closures with a lock, so the indicator reads "Locked"
  // only when every known door reports locked.
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
  const extras = extraControls(vehicle.remoteCapabilities, hazardsOn);
  const extrasSubtitle = describeExtraControls(vehicle.remoteCapabilities);

  // No reading yet means no claim — the indicator stays absent rather than
  // asserting "Stopped" about an engine we haven't asked about. Redacted is the
  // exception: the row is right-aligned, so an absent second indicator would
  // shift the lock one the moment the first reading lands. It draws as a bar
  // either way, so the word only sets the width.
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
        if (control.command === "hazard-on" || control.command === "hazard-off") {
          setHazardsOn(control.command === "hazard-on");
        }
        // Acceptance, not completion; the optimistic fold and the reconciling
        // refetches live in remote-command-effects.ts. No success dialog: the
        // section title already shows the pending state ("Locking…"). The
        // prime callback is its escalation path when plain re-reads keep
        // returning the pre-command snapshot.
        await reflectAcceptedCommand(context, control.command, () =>
          runAuthorized((session) => refreshVehicleStatus(session, context)),
        );
      })
      .catch((error: unknown) => {
        haptic("error");
        setAlert({
          title: "Command failed",
          message: error instanceof Error ? error.message : "The command could not be sent.",
        });
      })
      .finally(() => setBusy(false));
  };

  /**
   * A centred Material dialog rather than a menu anchored to the button that
   * raised it, for the reason the spec gives: a confirmation anchored to its
   * control lands somewhere different for each of the eleven, so it is one you
   * have to re-find every time, where a centred dialog is always where the last
   * one was. It suits the content too — there is one alternative here, not a
   * set of them, and the message is a consequence warning that belongs in a
   * dialog's body rather than as a caption over a list of choices.
   */
  const confirm = (control: Control) => {
    setAlert({
      title: control.confirmTitle,
      message: control.confirmMessage,
      action: {
        label: control.actionLabel,
        destructive: control.destructive,
        onConfirm: () => run(control),
      },
    });
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
            <Icon name={locked ? "lock" : "lock-open"} size={13} tint={lockColor} />
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
      <ControlRow controls={controls} enabled={enabled} isRedacted={isRedacted} onPress={confirm} />
      {/* Nothing to disclose on a car that reports none of these. */}
      {extras.length > 0 ? (
        <MoreControls
          controls={extras}
          enabled={enabled}
          isRedacted={isRedacted}
          subtitle={extrasSubtitle}
          onPress={confirm}
        />
      ) : null}
      <AlertHost alert={alert} onDismiss={() => setAlert(null)} />
    </View>
  );
}

/**
 * The extra controls a car will accept, behind a disclosure. Everything but the
 * drawn content is the shared `ExpandableCard`.
 */
function MoreControls({
  controls,
  enabled,
  isRedacted,
  subtitle,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  isRedacted: boolean;
  subtitle: string;
  onPress: (control: Control) => void;
}) {
  const rows = chunk(controls, CONTROLS_PER_ROW);

  return (
    <ExpandableCard
      accessibilityHint="Shows the vehicle's other remote controls"
      disabled={isRedacted}
      style={styles.moreCard}
      header={
        <View style={styles.moreHeader}>
          <Badge symbol="controls" tint={blue} redacted={isRedacted} />
          <View style={styles.moreHeaderText}>
            <ThemedText style={styles.moreTitle}>More controls</ThemedText>
            <ThemedText type="small" themeColor="secondaryLabel">
              {subtitle}
            </ThemedText>
          </View>
        </View>
      }
    >
      <View style={styles.moreRows}>
        {rows.map((row, index) => (
          <ControlRow
            key={index}
            controls={row}
            enabled={enabled}
            isRedacted={isRedacted}
            onCard
            onPress={onPress}
          />
        ))}
      </View>
    </ExpandableCard>
  );
}

/**
 * One row of control buttons, shared by the main row and each row of the More
 * controls grid so the two are the same button at the same size rather than two
 * things that resemble each other.
 */
function ControlRow({
  controls,
  enabled,
  isRedacted,
  onCard = false,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  isRedacted: boolean;
  /**
   * Whether this row sits on a card rather than the screen background. The
   * button's container tier follows: a card's own surface would disappear into
   * the card, so a row on one drops to the tier below it.
   */
  onCard?: boolean;
  onPress: (control: Control) => void;
}) {
  return (
    <View style={styles.row}>
      {controls.map((control, slot) => (
        <Pressable
          // Keyed by slot, not command, so the engine and hazard buttons stay
          // the same element across their swaps rather than being torn down and
          // rebuilt when the label changes.
          key={slot}
          accessibilityRole="button"
          accessibilityLabel={control.label}
          disabled={!enabled}
          onPress={() => onPress(control)}
          style={styles.control}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.controlSurface,
                { backgroundColor: onCard ? colors.subtleFill : colors.card },
                pressed && styles.controlPressed,
                // Dimmed only for a real refusal — a command in flight, or no
                // session. The skeleton is disabled too, but it already has the
                // whole tree's pulse and shouldn't carry a second signal.
                !enabled && !isRedacted && styles.controlDisabled,
              ]}
            >
              {/* The contents are hidden, not removed, while redacted: the row
                  is laid out by exactly the content it stands in for, so
                  nothing jumps when the data lands. The button keeps its live
                  geometry and refuses to actuate (the enclosing `Redactable`
                  takes the touches, and `enabled` is false besides). */}
              <View style={[styles.controlContent, isRedacted && styles.hidden]}>
                <Icon name={control.symbol} size={CONTROL_ICON_SIZE} tint={control.tint} />
                <ThemedText type="small" style={styles.controlLabel} numberOfLines={1}>
                  {control.label}
                </ThemedText>
              </View>
            </View>
          )}
        </Pressable>
      ))}
      {/* A short final row keeps the grid: without these the two buttons of a
          2-of-3 row would split the width and sit wider than the three above
          them. */}
      {Array.from({ length: CONTROLS_PER_ROW - controls.length }, (_, index) => (
        <View key={`spacer-${index}`} style={styles.control} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.one,
  },
  // Title on the leading edge, indicators on the trailing one, each inset the
  // same amount (see `status`).
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
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
    flexDirection: "row",
    gap: Spacing.two,
  },
  control: {
    flex: 1,
  },
  // Material's tonal button, at the size a glyph over a label needs: a
  // container tier for the fill and a corner radius that reads as fully rounded
  // at this height.
  controlSurface: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 20,
    borderCurve: "continuous",
  },
  // The press is the fill going down a tier, which is how a Material container
  // responds — not the whole control fading out.
  controlPressed: {
    backgroundColor: colors.fill,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  controlContent: {
    alignItems: "center",
    gap: Spacing.one,
  },
  // A step below the app's small text: three of these share a phone's width,
  // and "Hazard Lights" has to stay on one line at the narrowest of them. The
  // icon already carries the action, so the label can afford to be quiet.
  controlLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  // Keeps the view in the layout while suppressing its drawing, the way
  // SwiftUI's `hidden` does on the other platform.
  hidden: {
    opacity: 0,
  },
  moreCard: {
    marginTop: Spacing.three,
  },
  moreHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three - Spacing.one,
  },
  moreHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  moreTitle: {
    fontWeight: "600",
  },
  moreRows: {
    gap: Spacing.two,
  },
});
