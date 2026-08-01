import {
  Button,
  DisclosureGroup,
  GlassEffectContainer,
  HStack,
  Image as SFImage,
  Namespace,
  Spacer,
  Text as SFText,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  background,
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundColor,
  frame,
  glassEffectId,
  hidden,
  kerning,
  lineLimit,
  minimumScaleFactor,
  multilineTextAlignment,
  opacity,
  padding,
  redacted,
  shapes,
  textCase,
  unredacted,
} from "@expo/ui/swift-ui/modifiers";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useId, useState } from "react";
import { Alert } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { PULSE_DURATION_MS, PULSE_MIN_OPACITY } from "@/components/pulsing-text";
import { useRedacted } from "@/components/redactable";
import { useAuth } from "@/auth/auth-context";
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
  symbol: SFSymbol;
  /**
   * Optical size for this glyph. SF Symbols are drawn to fill their box, so a
   * wide, dense symbol at the same point size reads bigger than a compact one —
   * the horn and the bell most of all. Nudged per symbol so the row looks
   * evenly weighted rather than measuring evenly.
   */
  iconSize?: number;
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
const yellow = colors.systemYellow;

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

const TRUNK_UNLOCK: Control = {
  command: "trunk-unlock",
  label: "Unlock trunk",
  symbol: "car.side.rear.crop.trunk.partition",
  tint: orange,
  confirmTitle: "Unlock the trunk?",
  confirmMessage: "This unlocks the trunk. Only do this when you're near the vehicle.",
  destructive: true,
  actionLabel: "Unlock trunk",
};

const HAZARDS_ON: Control = {
  command: "hazard-on",
  label: "Hazard lights",
  symbol: "car.rear.hazardsign.fill",
  tint: red,
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
  label: "Flash lights",
  symbol: "headlight.low.beam.fill",
  iconSize: 21,
  tint: blue,
  confirmTitle: "Flash the headlights?",
  confirmMessage: "The headlights come on to help you find the vehicle.",
  destructive: false,
  actionLabel: "Flash",
};

const BUZZER: Control = {
  command: "buzzer-warning",
  label: "Play beeps",
  symbol: "bell.and.waves.left.and.right.fill",
  iconSize: 20,
  tint: yellow,
  confirmTitle: "Sound the buzzer?",
  confirmMessage: "The vehicle beeps ten times.",
  destructive: false,
  actionLabel: "Play beeps",
};

const HORN: Control = {
  command: "sound-horn",
  label: "Honk horn",
  symbol: "horn.blast.fill",
  iconSize: 19,
  tint: orange,
  confirmTitle: "Sound the horn?",
  confirmMessage: "The vehicle will sound its horn. Don't use this to startle anyone.",
  destructive: true,
  actionLabel: "Honk horn",
};

/** Buttons per row, matching the three of the main row above. */
const CONTROLS_PER_ROW = 3;
/** The default glyph size; a few symbols override it (see `Control.iconSize`). */
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
  const [expanded, setExpanded] = useState(false);
  // Which way the hazard button points. Nothing reports hazard state — it is
  // absent from the status snapshot and has no read of its own — so this
  // remembers what we last asked for and nothing reconciles it. A car whose
  // hazards were left on elsewhere opens the app offering to turn them on
  // again, which sends `hazard-on` to a car already flashing: harmless, and
  // preferable to an "off" button that would be equally wrong.
  const [hazardsOn, setHazardsOn] = useState(false);
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
  const extras = extraControls(vehicle.remoteCapabilities, hazardsOn);
  const extrasSubtitle = describeExtraControls(vehicle.remoteCapabilities);

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
        if (control.command === "hazard-on" || control.command === "hazard-off") {
          setHazardsOn(control.command === "hazard-on");
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
    <VStack
      alignment="leading"
      spacing={Spacing.three}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ horizontal: Spacing.three }),
        ...(isRedacted ? [disabledModifier(true)] : []),
      ]}
    >
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <SFText
          modifiers={[
            font({ textStyle: "footnote", weight: "semibold" }),
            foregroundColor(colors.secondaryLabel),
            kerning(0.5),
            textCase("uppercase"),
            ...(isRedacted ? [redacted("placeholder")] : []),
          ]}
        >
          Remote Controls
        </SFText>
        <Spacer />
        {/* Lock state before engine state, matching the button order below
            (Lock, Unlock, then Start/Stop). */}
        <StatusIndicator
          symbol={locked ? "lock.fill" : "lock.open.fill"}
          tint={lockColor}
          label={lockPending ? (locked ? "Locking" : "Unlocking") : locked ? "Locked" : "Unlocked"}
          pulsing={lockPending}
          isRedacted={isRedacted}
        />
        {engineLabel ? (
          <StatusIndicator
            symbol="power"
            tint={engineColor}
            label={engineLabel}
            pulsing={pending !== null}
            isRedacted={isRedacted}
          />
        ) : null}
      </HStack>
      {/* No `Host` of its own — these lay out in the scroll view's own SwiftUI
          stack (see swiftui-scroll-view.tsx). A nested host is measured on the
          RN side, so a disclosure opening inside one reports its new height
          across the bridge a frame before SwiftUI has finished laying the old
          content out, and every control sharing that host jumps and settles.
          Here there is no boundary to cross and nothing to re-measure.

          `redacted` is SwiftUI's own modifier, so the glass shells keep their
          shape while their contents are hidden rather than placeholdered (see
          below) — what is left is the buttons' own outlines at their own size.
          `disabled` keeps them from actuating a car we have no data for. */}
      <Namespace id={namespaceId}>
        <GlassEffectContainer spacing={Spacing.two}>
          <ControlRow
            controls={controls}
            enabled={enabled}
            isRedacted={isRedacted}
            namespaceId={namespaceId}
            slotOffset={0}
            onPress={confirm}
          />
        </GlassEffectContainer>
      </Namespace>
      {/* Nothing to disclose on a car that reports none of these. */}
      {extras.length > 0 ? (
        <MoreControls
          controls={extras}
          enabled={enabled}
          expanded={expanded}
          isRedacted={isRedacted}
          subtitle={extrasSubtitle}
          onExpandedChange={setExpanded}
          onPress={confirm}
        />
      ) : null}
    </VStack>
  );
}

/**
 * A lock or engine state, as a glyph and a word.
 *
 * Mid-command the word pulses instead of trailing an ellipsis — the wait has no
 * length to promise, only a state to report. The pulse is SwiftUI's own here
 * rather than the RN `PulsingText`, since these no longer live on the RN side;
 * `repeat` stands in for a `repeatForever` @expo/ui doesn't expose, at a count
 * no one will outlast.
 */
function StatusIndicator({
  symbol,
  tint,
  label,
  pulsing,
  isRedacted,
}: {
  symbol: SFSymbol;
  tint: string;
  label: string;
  pulsing: boolean;
  isRedacted: boolean;
}) {
  return (
    <HStack
      alignment="center"
      spacing={Spacing.one}
      modifiers={[
        opacity(pulsing ? PULSE_MIN_OPACITY : 1),
        animation(
          Animation.easeInOut({ duration: PULSE_DURATION_MS / 1000 }).repeat({
            repeatCount: 100_000,
            autoreverses: true,
          }),
          pulsing,
        ),
        ...(isRedacted ? [redacted("placeholder")] : []),
      ]}
    >
      {/* SwiftUI's placeholder redaction fills each view with its *own* colour,
          so the live green of "Locked" skeletonizes as a green pill. The RN
          text this replaced drew a neutral bar; a neutral tint while redacted
          keeps that. */}
      <SFImage systemName={symbol} size={13} color={isRedacted ? colors.fill : tint} />
      <SFText
        modifiers={[
          font({ textStyle: "footnote", weight: "semibold" }),
          foregroundColor(isRedacted ? colors.fill : tint),
        ]}
      >
        {label}
      </SFText>
    </HStack>
  );
}

/**
 * The extra controls, inside a real SwiftUI `DisclosureGroup`.
 *
 * The buttons are the group's *content*, so opening and closing is SwiftUI's
 * own animation on its own container — not an RN box being resized to a height
 * computed on this side while the SwiftUI content changes underneath it. That
 * split was what made the reveal stutter.
 *
 * The label is built like the Doors & Windows card's header: tinted badge,
 * title, and a subtitle naming what is inside. The chevron is the group's own.
 */
function MoreControls({
  controls,
  enabled,
  expanded,
  isRedacted,
  subtitle,
  onExpandedChange,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  expanded: boolean;
  isRedacted: boolean;
  subtitle: string;
  onExpandedChange: (expanded: boolean) => void;
  onPress: (control: Control) => void;
}) {
  return (
    <DisclosureGroup
      isExpanded={expanded}
      onIsExpandedChange={onExpandedChange}
      modifiers={[
        frame({ maxWidth: Infinity }),
        ...(isRedacted ? [redacted("placeholder"), disabledModifier(true)] : []),
      ]}
    >
      <DisclosureGroup.Label>
        {/* The card is on the row, not on the group — a `DisclosureGroup`'s
            background covers its content too, and that is what boxed the
            buttons in. */}
        <HStack
          spacing={Spacing.three - Spacing.one}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({ horizontal: Spacing.three, vertical: Spacing.two }),
            background(
              colors.card,
              shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: "continuous" }),
            ),
          ]}
        >
          <ZStack>
            {/* Same treatment as the closures badge: a wash of the tint rather
                than the tint itself, so the glyph stays the loudest thing in
                it — and, while redacted, the neutral fill circle the RN `Icon`
                uses, because placeholder redaction masks an image into a
                rounded rect in its own colour and turns the circle square. */}
            <SFImage
              systemName="circle.fill"
              size={36}
              color={isRedacted ? colors.fill : blue}
              modifiers={isRedacted ? [unredacted()] : [opacity(0.15)]}
            />
            {isRedacted ? null : (
              <SFImage systemName="slider.horizontal.3" size={16} color={blue} />
            )}
          </ZStack>
          <VStack alignment="leading" spacing={Spacing.half}>
            <SFText
              modifiers={[
                font({ textStyle: "body", weight: "semibold" }),
                foregroundColor(colors.label),
              ]}
            >
              More Controls
            </SFText>
            {/* The list wraps at this width, and a wrapped line centres itself
                by default — which left "and buzzer" floating under the middle
                of the line above it. */}
            <SFText
              modifiers={[
                font({ textStyle: "footnote", weight: "regular" }),
                foregroundColor(colors.secondaryLabel),
                multilineTextAlignment("leading"),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {subtitle}
            </SFText>
          </VStack>
          <Spacer />
        </HStack>
      </DisclosureGroup.Label>
      {/* No glass container and no namespace around these. The nested
          container drew a second visible box inside the disclosure's own card,
          and the shared namespace was what made each new button fly in from
          whichever existing shell SwiftUI had paired it with. Nothing here
          morphs, so nothing here needs an identity. */}
      {/* No card behind these: glass over a white card renders its material as
          a grey field that merges across the whole grid, which is the rectangle
          that kept appearing around the buttons. Over the screen's own
          background it reads exactly as the main row does — same button, same
          backdrop, so the disclosure looks like more of the row rather than a
          panel of its own. */}
      <VStack spacing={Spacing.three} modifiers={[padding({ top: Spacing.three })]}>
        {chunk(controls, CONTROLS_PER_ROW).map((row, index) => (
          <ControlRow key={index} controls={row} enabled={enabled} onPress={onPress} />
        ))}
      </VStack>
    </DisclosureGroup>
  );
}

/**
 * One row of glass control buttons, shared by the main row and each row of the
 * More Controls grid so the two are the same button at the same size rather
 * than two things that resemble each other. Not a host of its own — see the
 * one that wraps all of them.
 */
function ControlRow({
  controls,
  enabled,
  isRedacted = false,
  namespaceId,
  slotOffset = 0,
  onPress,
}: {
  controls: Control[];
  enabled: boolean;
  isRedacted?: boolean;
  /**
   * The glass namespace this row's shells morph within. Only the main row
   * passes one — it has two slots that swap content in place (Start/Stop, and
   * the hazard toggle). A row without an identity simply appears, which is
   * what the disclosure's rows want.
   */
  namespaceId?: string;
  /** Where this row starts in the run of glass identities. */
  slotOffset?: number;
  onPress: (control: Control) => void;
}) {
  return (
    <HStack spacing={Spacing.two} modifiers={[frame({ maxWidth: Infinity })]}>
      {controls.map((control, slot) => (
        <Button
          // Keyed by slot, not command: the engine and hazard buttons must stay
          // the same React element across their swaps, or they are torn down
          // and rebuilt and there is nothing left to morph.
          key={slot}
          onPress={() => onPress(control)}
          modifiers={[
            // No separate background fill behind this: the glass shell has its
            // own shape and inset, so painting a rect across the button's full
            // frame leaves that rect's corners showing around the shell — the
            // button reads as sitting inside a container. The shell *is* the
            // button.
            buttonStyle("glass"),
            // Identity is per *slot*, not per command, for the same reason as
            // the key: a swapping slot keeps one id so the glass morphs in
            // place.
            ...(namespaceId ? [glassEffectId(`control-${slotOffset + slot}`, namespaceId)] : []),
            disabledModifier(!enabled),
          ]}
        >
          {/* The width lives on the *label*, not the Button: a glass button's
              shell wraps its label, so sizing the button leaves a
              content-sized pill floating in an empty frame. */}
          {/* `unredacted` alongside `hidden`: the contents are already hidden
              while redacted, so the only thing the inherited placeholder
              redaction could still do is change how the text is measured — and
              it does, by a point or two, which left the skeleton's shells
              fractionally taller than the live ones. Opting out makes the two
              states the same layout by construction. */}
          <VStack
            spacing={Spacing.one}
            modifiers={[
              padding({ vertical: Spacing.two }),
              frame({ maxWidth: Infinity }),
              ...(isRedacted ? [unredacted()] : []),
            ]}
          >
            {/* The real icon and label, drawn or not. `hidden` keeps a view in
                the layout while suppressing its drawing, so the redacted row is
                laid out by exactly the content it is standing in for — the
                shells are the live shells, to the point, with no stand-in
                geometry to keep in sync and nothing to jump when the data
                lands. */}
            <SFImage
              systemName={control.symbol}
              size={control.iconSize ?? CONTROL_ICON_SIZE}
              color={control.tint}
              modifiers={[hidden(isRedacted)]}
            />
            {/* A glass button tints its label with the accent color, which
                turns every label blue. The label is text, not an action color —
                the icon already carries the action. Two-word labels shrink to
                fit rather than wrapping, so every button in the grid keeps one
                line of text and one height. */}
            <SFText
              modifiers={[
                font({ textStyle: "footnote", weight: "semibold" }),
                foregroundColor(colors.label),
                lineLimit(1),
                minimumScaleFactor(0.75),
                hidden(isRedacted),
              ]}
            >
              {control.label}
            </SFText>
          </VStack>
        </Button>
      ))}
      {/* A short final row keeps the grid: without these the two buttons of a
          2-of-3 row would split the width and sit wider than the three above
          them. */}
      {Array.from({ length: CONTROLS_PER_ROW - controls.length }, (_, index) => (
        <Spacer key={`spacer-${index}`} modifiers={[frame({ maxWidth: Infinity })]} />
      ))}
    </HStack>
  );
}
