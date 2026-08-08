import {
  Button,
  Divider,
  Group,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  background,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  progressViewStyle,
  refreshable,
  shapes,
  textSelection,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useWindowDimensions } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import {
  fillWidth,
  fillWidthLeading,
  footnoteBold,
  footnoteMedium,
  secondaryStyle,
  tertiaryStyle,
} from "@/components/swift-ui/modifier-presets";
import { iconRegistry } from "@/components/ui/icon-registry";
import { GroupCard, SectionFooter, SectionHeader } from "@/components/swift-ui/section";
import { Section, SettingsScreenScaffold } from "@/components/swift-ui/settings-screen-scaffold";
import { ActivityRow } from "@/screens/update-diagnostics/activity-row";
import { DataRow } from "@/screens/update-diagnostics/data-row";
import { KnownUpdateCard } from "@/screens/update-diagnostics/known-update-card";
import { NativeLogDisclosure } from "@/screens/update-diagnostics/native-log-disclosure";
import { Spacing, colors } from "@/constants/theme";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import {
  buildUpdateEntries,
  describeUpdateStatus,
  formatUpdateDate,
  resolveLastCheck,
  type UpdateStatusTone,
} from "@/updates/update-utils";
import { useUpdateActions } from "@/updates/use-update-actions";
import { MAX_VISIBLE_EVENTS, useUpdateEvents } from "@/updates/use-update-events";

// The headline status tones, mapped from the theme palette.
const TONE_COLORS: Record<UpdateStatusTone, string> = {
  good: colors.systemGreen,
  busy: colors.systemBlue,
  attention: colors.systemOrange,
};

function ActionButton({
  busy,
  disabled,
  icon,
  label,
  onPress,
  primary = false,
}: {
  busy: boolean;
  disabled: boolean;
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle(primary ? "borderedProminent" : "bordered"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        fillWidth,
      ]}
    >
      <HStack alignment="center" spacing={Spacing.two} modifiers={[fillWidthLeading]}>
        {/* The fixed icon frame keeps labels aligned across symbols of different
            intrinsic widths, and holds the button height when the busy
            hourglass swaps in. */}
        <Image
          systemName={busy ? "hourglass" : icon}
          size={17}
          modifiers={[frame({ width: 24, height: 20 })]}
        />
        <Text>{busy ? `${label}…` : label}</Text>
      </HStack>
    </Button>
  );
}

export default function UpdateDiagnostics() {
  const updateState = Updates.useUpdates();
  const { width: windowWidth } = useWindowDimensions();

  useMarkInteractive();

  const status = describeUpdateStatus(Updates.isEnabled, updateState);
  const lastCheck = resolveLastCheck(
    updateState.lastCheckForUpdateTimeSinceRestart,
    Updates.checkAutomatically,
  );
  const updateEntries = buildUpdateEntries({
    running: updateState.currentlyRunning,
    available: updateState.availableUpdate,
    downloaded: updateState.downloadedUpdate,
  });

  const events = useUpdateEvents((message) => setActionError(message));
  const { activeAction, actionMessage, actionError, setActionError, check, download, reload } =
    useUpdateActions({
      isUpdatePending: updateState.isUpdatePending,
      downloadedUpdateId: updateState.downloadedUpdate?.updateId,
      refreshEvents: events.refreshEvents,
    });

  // Pull-to-refresh asks the server for a newer update as well as reloading the
  // local logs. check() runs through the actions hook, so the pull spinner stays
  // up until the server check resolves, and it shares the exclusive gate with
  // the Refresh button.
  const pullToRefresh = () => events.runExclusive(() => check());

  const busy =
    activeAction !== null ||
    updateState.isChecking ||
    updateState.isDownloading ||
    updateState.isRestarting;
  const resultIsError = Boolean(actionError || updateState.checkError || updateState.downloadError);
  const resultText =
    actionError ??
    updateState.checkError?.message ??
    updateState.downloadError?.message ??
    actionMessage;

  return (
    <SettingsScreenScaffold
      scrollModifiers={[refreshable(pullToRefresh)]}
      stackModifiers={[
        // Clamp the content to the window so it cannot end up a fraction of a
        // point wider than the scroll view. Text measurements land on sub-pixel
        // widths, and a stack reporting even one device pixel past the viewport
        // gives a vertical scroll view a horizontal scrolling range — which
        // reads as the screen rubber-banding sideways.
        frame({ maxWidth: windowWidth }),
        // Animate the relayout when a known-update card appears or disappears
        // rather than letting the sections below jump.
        animation(Animation.spring({ duration: 0.35 }), updateEntries.length),
        // Fade the busy-state color changes instead of snapping them.
        animation(Animation.easeInOut({ duration: 0.2 }), busy),
      ]}
    >
      <GroupCard padded spacing={Spacing.three}>
        <HStack alignment="center" spacing={Spacing.three} modifiers={[fillWidthLeading]}>
          <ZStack
            modifiers={[
              frame({ width: 48, height: 48 }),
              background(
                colors.fill,
                shapes.roundedRectangle({ cornerRadius: 15, roundedCornerStyle: "continuous" }),
              ),
            ]}
          >
            <Image systemName={iconRegistry[status.icon].sf} size={24} color={TONE_COLORS[status.tone]} />
          </ZStack>
          <VStack alignment="leading" spacing={Spacing.half} modifiers={[fillWidthLeading]}>
            <Text modifiers={[footnoteBold]}>{status.title}</Text>
            <Text
              modifiers={[
                footnoteMedium,
                secondaryStyle,
                fixedSize({ horizontal: false, vertical: true }),
                // Capped but not reserved — a reserved second line left empty
                // space under short copy like "Running normally".
                lineLimit(4),
              ]}
            >
              {status.detail}
            </Text>
          </VStack>
        </HStack>
        {/* Only while downloading; otherwise it reserves empty space under the
            status text. */}
        {updateState.isDownloading ? (
          <ProgressView
            value={updateState.downloadProgress ?? 0}
            modifiers={[progressViewStyle("linear"), tint(colors.systemBlue), fillWidth]}
          />
        ) : null}
      </GroupCard>

      <Section>
        <SectionHeader>UPDATE SYSTEM</SectionHeader>
        <GroupCard padded verticalPadding={Spacing.two}>
          <DataRow label="Enabled" value={Updates.isEnabled ? "Yes" : "No"} />
          <DataRow label="Channel" value={Updates.channel || "None"} />
          <DataRow label="Runtime" value={Updates.runtimeVersion ?? "Unknown"} />
          <DataRow label="App version" value={Constants.expoConfig?.version ?? "Unknown"} />
          <DataRow label="Automatic checks" value={Updates.checkAutomatically ?? "Unknown"} />
          <DataRow
            label="Launch time"
            value={
              updateState.currentlyRunning.launchDuration === undefined
                ? "Unknown"
                : `${updateState.currentlyRunning.launchDuration} ms`
            }
          />
          <DataRow label="Reloads this launch" value={`${updateState.restartCount}`} />
          <DataRow
            label="Most recent check"
            value={
              "checkedAt" in lastCheck ? formatUpdateDate(lastCheck.checkedAt) : lastCheck.detail
            }
            last
          />
        </GroupCard>
      </Section>

      <Section>
        <SectionHeader>KNOWN UPDATES</SectionHeader>
        <VStack alignment="leading" spacing={Spacing.two} modifiers={[fillWidthLeading]}>
          {updateEntries.map((entry) => (
            <KnownUpdateCard key={`${entry.state}-${entry.id}`} entry={entry} />
          ))}
        </VStack>
        <SectionFooter>
          This is the actionable update state Expo exposes: what is running, what is ready on this
          device, and what the server has offered. Older downloaded updates are managed internally
          and are not enumerable from app code.
        </SectionFooter>
      </Section>

      <Section>
        <SectionHeader>CONTROLS</SectionHeader>
        <VStack spacing={Spacing.two} modifiers={[fillWidth]}>
          <ActionButton
            busy={activeAction === "check" || updateState.isChecking}
            disabled={!Updates.isEnabled || busy}
            icon="arrow.clockwise"
            label="Check Now"
            onPress={check}
            primary
          />
          <ActionButton
            busy={activeAction === "download" || updateState.isDownloading}
            disabled={!Updates.isEnabled || busy || !updateState.isUpdateAvailable}
            icon="arrow.down.circle"
            label="Download Update"
            onPress={download}
          />
          <ActionButton
            busy={activeAction === "reload" || updateState.isRestarting}
            disabled={!Updates.isEnabled || busy}
            icon="arrow.clockwise.circle"
            label={updateState.isUpdatePending ? "Reload Into Update" : "Reload App"}
            onPress={reload}
          />
        </VStack>
      </Section>

      {/* Always rendered with two reserved lines, so a result appearing below
          the controls never shifts the layout. */}
      <GroupCard padded>
        <Text
          modifiers={[
            footnoteMedium,
            resultText
              ? foregroundStyle(resultIsError ? colors.systemOrange : colors.systemGreen)
              : tertiaryStyle,
            textSelection(true),
            fixedSize({ horizontal: false, vertical: true }),
            lineLimit({ min: 2, max: 8 }),
            fillWidthLeading,
          ]}
        >
          {resultText ?? "Results from the controls above will appear here."}
        </Text>
      </GroupCard>

      <Section>
        <HStack
          alignment="firstTextBaseline"
          spacing={Spacing.two}
          modifiers={[fillWidth, padding({ horizontal: Spacing.two, bottom: Spacing.two })]}
        >
          <Text modifiers={[font({ textStyle: "caption", weight: "semibold" }), secondaryStyle]}>
            UPDATE ACTIVITY
          </Text>
          <Spacer />
          <Button
            label="Refresh"
            systemImage="arrow.clockwise"
            onPress={events.refreshEventLists}
            modifiers={[buttonStyle("borderless"), controlSize("small"), tint(colors.systemBlue)]}
          />
        </HStack>
        <GroupCard
          padded
          verticalPadding={events.activity.length === 0 ? Spacing.three : Spacing.two}
        >
          {events.activity.length === 0 ? (
            <Text
              modifiers={[
                footnoteMedium,
                secondaryStyle,
                fixedSize({ horizontal: false, vertical: true }),
              ]}
            >
              Activity tracking starts with this version. The current launch will appear here after
              Refresh.
            </Text>
          ) : (
            events.activity.map((entry, index) => (
              <Group key={entry.id}>
                <ActivityRow entry={entry} />
                {index < events.activity.length - 1 ? <Divider /> : null}
              </Group>
            ))
          )}
        </GroupCard>
        <SectionFooter>
          {`Update checks, downloads, and reloads recorded by Lexy on this device. The ${MAX_VISIBLE_EVENTS} most recent events are shown.`}
        </SectionFooter>
      </Section>

      <Section>
        <SectionHeader>NATIVE UPDATE LOG</SectionHeader>
        <GroupCard padded verticalPadding={events.logs.length === 0 ? Spacing.three : Spacing.two}>
          {events.logs.length === 0 ? (
            <Text
              modifiers={[
                footnoteMedium,
                secondaryStyle,
                fixedSize({ horizontal: false, vertical: true }),
              ]}
            >
              No native Expo Updates entries were recorded in the last 24 hours.
            </Text>
          ) : (
            <VStack spacing={0} modifiers={[fillWidthLeading]}>
              {events.logs.map((entry, index) => (
                <Group key={`${entry.timestamp}-${entry.code}-${entry.message}`}>
                  <NativeLogDisclosure entry={entry} />
                  {index < events.logs.length - 1 ? <Divider /> : null}
                </Group>
              ))}
            </VStack>
          )}
        </GroupCard>
        <SectionFooter>
          {`The ${MAX_VISIBLE_EVENTS} most recent low-level Expo Updates entries from the last 24 hours. Entries are summarized; tap one to inspect its raw message and identifiers.`}
        </SectionFooter>
      </Section>
    </SettingsScreenScaffold>
  );
}
