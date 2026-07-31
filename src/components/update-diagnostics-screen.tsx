import {
  Button,
  DisclosureGroup,
  Divider,
  Group,
  HStack,
  Host,
  Image,
  ProgressView,
  ScrollView,
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
  contentShape,
  controlSize,
  disabled as disabledModifier,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
  refreshable,
  shapes,
  textSelection,
  tint,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { useObserve } from "expo-observe";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";
import {
  buildUpdateEntries,
  describeKnownUpdate,
  describeNativeLog,
  describeUpdateStatus,
  formatUpdateDate,
  resolveLastCheck,
  shortUpdateId,
  type UpdateActivityEvent,
  type UpdateEntry,
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

function Glyph({
  name,
  size = 20,
  tint = colors.label,
}: {
  name: SFSymbol;
  size?: number;
  tint?: string;
}) {
  return <Image systemName={name} size={size} color={tint} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "caption", weight: "semibold" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: Spacing.two, bottom: Spacing.two }),
      ]}
    >
      {children}
    </Text>
  );
}

// The muted footnote under a section's card.
function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "medium" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        fixedSize({ horizontal: false, vertical: true }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({
          top: Spacing.two,
          horizontal: Spacing.two,
        }),
      ]}
    >
      {children}
    </Text>
  );
}

function Panel({
  children,
  spacing = 0,
  verticalPadding = Spacing.three,
}: {
  children: React.ReactNode;
  spacing?: number;
  verticalPadding?: number;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={spacing}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ horizontal: Spacing.three, vertical: verticalPadding }),
        background(
          colors.card,
          shapes.roundedRectangle({
            cornerRadius: 18,
            roundedCornerStyle: "continuous",
          }),
        ),
      ]}
    >
      {children}
    </VStack>
  );
}

function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[
          frame({ maxWidth: Infinity }),
          padding({ vertical: Spacing.two }),
        ]}
      >
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "medium" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          {label}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ textStyle: "footnote", weight: "medium" }),
            textSelection(true),
            multilineTextAlignment("trailing"),
          ]}
        >
          {value}
        </Text>
      </HStack>
      {last ? null : <Divider />}
    </VStack>
  );
}

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
        frame({ maxWidth: Infinity }),
      ]}
    >
      <HStack
        alignment="center"
        spacing={Spacing.two}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        {/* The fixed icon frame keeps the labels aligned across buttons whose
            symbols have different intrinsic widths, and keeps the button
            height stable when the busy hourglass swaps in. */}
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

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function KnownUpdateCard({ entry }: { entry: UpdateEntry }) {
  const copy = describeKnownUpdate(entry.state);
  const isCurrent = entry.state === "Running now";
  const isReady = entry.state === "Downloaded · launches next";
  const accent = isCurrent
    ? colors.systemGreen
    : isReady
      ? colors.systemBlue
      : colors.systemOrange;

  return (
    <Panel spacing={Spacing.three}>
      <HStack
        alignment="center"
        spacing={Spacing.three}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <ZStack
          modifiers={[
            frame({ width: 42, height: 42 }),
            background(
              colors.fill,
              shapes.roundedRectangle({
                cornerRadius: 13,
                roundedCornerStyle: "continuous",
              }),
            ),
          ]}
        >
          <Glyph
            name={
              isCurrent
                ? "play.fill"
                : isReady
                  ? "arrow.down"
                  : "icloud.and.arrow.down"
            }
            size={18}
            tint={accent}
          />
        </ZStack>
        <VStack
          alignment="leading"
          spacing={Spacing.half}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <HStack
            spacing={Spacing.two}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            {/* The title yields first: it can wrap, so it is the child that
                should give up width when the two together don't fit. Giving it
                priority over a `fixedSize` badge instead pushed the row wider
                than the screen, which made the whole scroll view pan
                sideways. */}
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "bold" }),
                lineLimit(2),
              ]}
            >
              {copy.title}
            </Text>
            <Spacer />
            <Text
              modifiers={[
                font({
                  textStyle: "caption2",
                  design: "monospaced",
                  weight: "medium",
                }),
                foregroundStyle(accent),
                // One line and first claim on width, but still truncatable —
                // `fixedSize` here could not be compressed at any text size.
                lineLimit(1),
                layoutPriority(1),
                padding({ horizontal: Spacing.two, vertical: Spacing.one }),
                background(
                  colors.fill,
                  shapes.roundedRectangle({
                    cornerRadius: 7,
                    roundedCornerStyle: "continuous",
                  }),
                ),
              ]}
            >
              {copy.badge}
            </Text>
          </HStack>
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {copy.detail}
          </Text>
        </VStack>
      </HStack>
      <Divider />
      <VStack
        alignment="leading"
        spacing={Spacing.two}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack spacing={Spacing.three}>
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Published
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              textSelection(true),
            ]}
          >
            {formatUpdateDate(entry.createdAt)}
          </Text>
        </HStack>
        <HStack spacing={Spacing.three}>
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Source
          </Text>
          <Spacer />
          <Text
            modifiers={[font({ textStyle: "footnote", weight: "medium" })]}
          >
            {entry.source}
          </Text>
        </HStack>
        <VStack
          alignment="leading"
          spacing={Spacing.one}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Update ID
          </Text>
          <Text
            modifiers={[
              font({
                textStyle: "caption2",
                design: "monospaced",
                weight: "medium",
              }),
              textSelection(true),
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {entry.id}
          </Text>
        </VStack>
      </VStack>
    </Panel>
  );
}

function NativeLogDisclosure({ entry }: { entry: Updates.UpdatesLogEntry }) {
  const description = describeNativeLog(entry);
  const isProblem =
    entry.level === "error" || entry.level === "fatal" || entry.level === "warn";
  const accent = isProblem ? colors.systemOrange : colors.systemBlue;
  const detailRows = [
    entry.updateId ? `Update ${entry.updateId}` : null,
    entry.assetId ? `Asset ${entry.assetId}` : null,
    entry.stacktrace?.length ? entry.stacktrace.join("\n") : null,
  ].filter((row): row is string => row !== null);

  return (
    <DisclosureGroup
      isExpanded={false}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <DisclosureGroup.Label>
        <VStack
          alignment="leading"
          spacing={Spacing.one}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            contentShape(shapes.rectangle()),
            padding({ vertical: Spacing.two }),
          ]}
        >
          <HStack
            alignment="firstTextBaseline"
            spacing={Spacing.two}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            <Image systemName="circle.fill" size={8} color={accent} />
            {/* Same ordering as the known-update card: the title truncates so
                the level and time — which cannot wrap — always fit. */}
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                foregroundStyle(colors.label),
                lineLimit(1),
                truncationMode("tail"),
              ]}
            >
              {description.title}
            </Text>
            {isProblem ? (
              <Text
                modifiers={[
                  font({
                    textStyle: "caption2",
                    design: "monospaced",
                    weight: "semibold",
                  }),
                  foregroundStyle(colors.systemOrange),
                  lineLimit(1),
                  layoutPriority(1),
                ]}
              >
                {entry.level.toUpperCase()}
              </Text>
            ) : null}
            <Spacer />
            <Text
              modifiers={[
                font({ textStyle: "caption" }),
                foregroundStyle(colors.secondaryLabel),
                monospacedDigit(),
                lineLimit(1),
                layoutPriority(1),
              ]}
            >
              {formatEventTime(entry.timestamp)}
            </Text>
          </HStack>
          <Text
            modifiers={[
              font({ textStyle: "footnote" }),
              foregroundStyle(colors.secondaryLabel),
              multilineTextAlignment("leading"),
              lineLimit(3),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
              padding({ leading: Spacing.three }),
            ]}
          >
            {description.summary}
          </Text>
        </VStack>
      </DisclosureGroup.Label>
      <VStack
        alignment="leading"
        spacing={Spacing.two}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          padding({ leading: Spacing.three, bottom: Spacing.two }),
        ]}
      >
        <Text
          modifiers={[
            font({
              textStyle: "caption2",
              design: "monospaced",
              weight: "semibold",
            }),
            foregroundStyle(colors.secondaryLabel),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          {entry.level.toUpperCase()}
          {entry.code === "None" ? "" : ` · ${entry.code}`}
        </Text>
        <Text
          modifiers={[
            font({ textStyle: "caption", design: "monospaced" }),
            foregroundStyle(colors.label),
            multilineTextAlignment("leading"),
            textSelection(true),
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          {entry.message}
        </Text>
        {detailRows.map((row) => (
          <Text
            key={row}
            modifiers={[
              font({ textStyle: "caption2", design: "monospaced" }),
              foregroundStyle(colors.secondaryLabel),
              multilineTextAlignment("leading"),
              textSelection(true),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {row}
          </Text>
        ))}
      </VStack>
    </DisclosureGroup>
  );
}

function ActivityRow({ entry }: { entry: UpdateActivityEvent }) {
  return (
    <VStack
      alignment="leading"
      spacing={Spacing.one}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ vertical: Spacing.two }),
      ]}
    >
      <HStack
        alignment="firstTextBaseline"
        spacing={Spacing.two}
        modifiers={[frame({ maxWidth: Infinity })]}
      >
        <Text
          modifiers={[
            font({
              textStyle: "footnote",
              weight: "bold",
            }),
            entry.level === "error"
              ? foregroundStyle(colors.systemOrange)
              : foregroundStyle({
                  type: "hierarchical",
                  style: "primary",
                }),
          ]}
        >
          {entry.title}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ textStyle: "caption" }),
            foregroundStyle({
              type: "hierarchical",
              style: "secondary",
            }),
            monospacedDigit(),
            lineLimit(1),
            layoutPriority(1),
          ]}
        >
          {formatEventTime(entry.timestamp)}
        </Text>
      </HStack>
      <Text
        modifiers={[
          font({ textStyle: "footnote", weight: "medium" }),
          textSelection(true),
          fixedSize({ horizontal: false, vertical: true }),
        ]}
      >
        {entry.detail}
      </Text>
      {entry.updateId ? (
        <Text
          modifiers={[
            font({
              textStyle: "caption2",
              design: "monospaced",
              weight: "medium",
            }),
            foregroundStyle({
              type: "hierarchical",
              style: "secondary",
            }),
            textSelection(true),
          ]}
        >
          Update {shortUpdateId(entry.updateId)}
        </Text>
      ) : null}
    </VStack>
  );
}

export default function UpdateDiagnostics() {
  const updateState = Updates.useUpdates();
  const { width: windowWidth } = useWindowDimensions();
  const { markInteractive } = useObserve();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

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
  const {
    activeAction,
    actionMessage,
    actionError,
    setActionError,
    check,
    download,
    reload,
  } = useUpdateActions({
    isUpdatePending: updateState.isUpdatePending,
    downloadedUpdateId: updateState.downloadedUpdate?.updateId,
    refreshEvents: events.refreshEvents,
  });

  // Pull-to-refresh asks the server for a newer update in addition to
  // reloading the local logs/activity. check() runs through the actions hook,
  // which records the outcome, refreshes the event lists, and fires the
  // success haptic, so the pull spinner stays up until the server check
  // resolves. It shares the exclusive gate with the Refresh button.
  const pullToRefresh = () => events.runExclusive(() => check());

  const busy =
    activeAction !== null ||
    updateState.isChecking ||
    updateState.isDownloading ||
    updateState.isRestarting;
  const resultIsError = Boolean(
    actionError || updateState.checkError || updateState.downloadError,
  );
  const resultText =
    actionError ??
    updateState.checkError?.message ??
    updateState.downloadError?.message ??
    actionMessage;

  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView modifiers={[refreshable(pullToRefresh)]}>
        <VStack
          alignment="leading"
          spacing={Spacing.four}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({
              top: Spacing.three,
              horizontal: Spacing.three,
              bottom: Spacing.six,
            }),
            // Clamp the content to the window so it cannot end up a fraction of
            // a point wider than the scroll view. Text measurements land on
            // sub-pixel widths, and a stack that reports even one device pixel
            // past the viewport gives the vertical scroll view a horizontal
            // scrolling range, which reads as the screen rubber-banding
            // sideways.
            frame({ maxWidth: windowWidth }),
            // Animate the relayout when a known-update card appears or
            // disappears instead of letting the sections below jump.
            animation(Animation.spring({ duration: 0.35 }), updateEntries.length),
            // Fade the busy-state color changes (status tint, disabled
            // buttons, result text) instead of snapping them.
            animation(Animation.easeInOut({ duration: 0.2 }), busy),
          ]}
        >
          <Panel spacing={Spacing.three}>
            <HStack
              alignment="center"
              spacing={Spacing.three}
              modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
            >
              <ZStack
                modifiers={[
                  frame({ width: 48, height: 48 }),
                  background(
                    colors.fill,
                    shapes.roundedRectangle({
                      cornerRadius: 15,
                      roundedCornerStyle: "continuous",
                    }),
                  ),
                ]}
              >
                <Glyph
                  name={status.icon}
                  size={24}
                  tint={TONE_COLORS[status.tone]}
                />
              </ZStack>
              <VStack
                alignment="leading"
                spacing={Spacing.half}
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: "leading" }),
                ]}
              >
                <Text
                  modifiers={[font({ textStyle: "footnote", weight: "bold" })]}
                >
                  {status.title}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: "footnote", weight: "medium" }),
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                    fixedSize({ horizontal: false, vertical: true }),
                    // Cap at four lines but do not reserve a minimum — a
                    // reserved second line left empty space under short status
                    // copy (e.g. "Running normally").
                    lineLimit(4),
                  ]}
                >
                  {status.detail}
                </Text>
              </VStack>
            </HStack>
            {/* Only shown while downloading — otherwise it would reserve empty
                space under the status text. */}
            {updateState.isDownloading ? (
              <ProgressView
                value={updateState.downloadProgress ?? 0}
                modifiers={[
                  progressViewStyle("linear"),
                  tint(colors.systemBlue),
                  frame({ maxWidth: Infinity }),
                ]}
              />
            ) : null}
          </Panel>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionLabel>UPDATE SYSTEM</SectionLabel>
            <Panel verticalPadding={Spacing.two}>
              <DataRow
                label="Enabled"
                value={Updates.isEnabled ? "Yes" : "No"}
              />
              <DataRow label="Channel" value={Updates.channel || "None"} />
              <DataRow
                label="Runtime"
                value={Updates.runtimeVersion ?? "Unknown"}
              />
              <DataRow
                label="App version"
                value={Constants.expoConfig?.version ?? "Unknown"}
              />
              <DataRow
                label="Automatic checks"
                value={Updates.checkAutomatically ?? "Unknown"}
              />
              <DataRow
                label="Launch time"
                value={
                  updateState.currentlyRunning.launchDuration === undefined
                    ? "Unknown"
                    : `${updateState.currentlyRunning.launchDuration} ms`
                }
              />
              <DataRow
                label="Reloads this launch"
                value={`${updateState.restartCount}`}
              />
              <DataRow
                label="Most recent check"
                value={
                  "checkedAt" in lastCheck
                    ? formatUpdateDate(lastCheck.checkedAt)
                    : lastCheck.detail
                }
                last
              />
            </Panel>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionLabel>KNOWN UPDATES</SectionLabel>
            <VStack
              alignment="leading"
              spacing={Spacing.two}
              modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
            >
              {updateEntries.map((entry) => (
                <KnownUpdateCard
                  key={`${entry.state}-${entry.id}`}
                  entry={entry}
                />
              ))}
            </VStack>
            <SectionFooter>
              This is the actionable update state Expo exposes: what is running,
              what is ready on this device, and what the server has offered.
              Older downloaded updates are managed internally and are not enumerable
              from app code.
            </SectionFooter>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionLabel>CONTROLS</SectionLabel>
            <VStack
              spacing={Spacing.two}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
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
                disabled={
                  !Updates.isEnabled || busy || !updateState.isUpdateAvailable
                }
                icon="arrow.down.circle"
                label="Download Update"
                onPress={download}
              />
              <ActionButton
                busy={activeAction === "reload" || updateState.isRestarting}
                disabled={!Updates.isEnabled || busy}
                icon="arrow.clockwise.circle"
                label={
                  updateState.isUpdatePending
                    ? "Reload Into Update"
                    : "Reload App"
                }
                onPress={reload}
              />
            </VStack>
          </VStack>

          {/* Always rendered with two reserved lines so results appearing
              (or changing) below the controls never shift the layout. */}
          <Panel>
            <Text
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                resultText
                  ? foregroundStyle(
                      resultIsError ? colors.systemOrange : colors.systemGreen,
                    )
                  : foregroundStyle({
                      type: "hierarchical",
                      style: "tertiary",
                    }),
                textSelection(true),
                fixedSize({ horizontal: false, vertical: true }),
                lineLimit({ min: 2, max: 8 }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {resultText ??
                "Results from the controls above will appear here."}
            </Text>
          </Panel>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <HStack
              alignment="firstTextBaseline"
              spacing={Spacing.two}
              modifiers={[
                frame({ maxWidth: Infinity }),
                padding({ horizontal: Spacing.two, bottom: Spacing.two }),
              ]}
            >
              <Text
                modifiers={[
                  font({ textStyle: "caption", weight: "semibold" }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                UPDATE ACTIVITY
              </Text>
              <Spacer />
              <Button
                label="Refresh"
                systemImage="arrow.clockwise"
                onPress={events.refreshEventLists}
                modifiers={[
                  buttonStyle("borderless"),
                  controlSize("small"),
                  tint(colors.systemBlue),
                ]}
              />
            </HStack>
            <Panel
              verticalPadding={
                events.activity.length === 0 ? Spacing.three : Spacing.two
              }
            >
              {events.activity.length === 0 ? (
                <Text
                  modifiers={[
                    font({ textStyle: "footnote", weight: "medium" }),
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                    fixedSize({ horizontal: false, vertical: true }),
                  ]}
                >
                  Activity tracking starts with this version. The current launch
                  will appear here after Refresh.
                </Text>
              ) : (
                events.activity.map((entry, index) => (
                  <Group key={entry.id}>
                    <ActivityRow entry={entry} />
                    {index < events.activity.length - 1 ? <Divider /> : null}
                  </Group>
                ))
              )}
            </Panel>
            <SectionFooter>
              {`Update checks, downloads, and reloads recorded by Lexy on this device. The ${MAX_VISIBLE_EVENTS} most recent events are shown.`}
            </SectionFooter>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionLabel>NATIVE UPDATE LOG</SectionLabel>
            <Panel
              verticalPadding={
                events.logs.length === 0 ? Spacing.three : Spacing.two
              }
            >
              {events.logs.length === 0 ? (
                <Text
                  modifiers={[
                    font({ textStyle: "footnote", weight: "medium" }),
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                    fixedSize({ horizontal: false, vertical: true }),
                  ]}
                >
                  No native expo-updates entries were recorded in the last 24
                  hours.
                </Text>
              ) : (
                <VStack
                  spacing={0}
                  modifiers={[
                    frame({ maxWidth: Infinity, alignment: "leading" }),
                  ]}
                >
                  {events.logs.map((entry, index) => (
                    <Group
                      key={`${entry.timestamp}-${entry.code}-${entry.message}`}
                    >
                      <NativeLogDisclosure entry={entry} />
                      {index < events.logs.length - 1 ? <Divider /> : null}
                    </Group>
                  ))}
                </VStack>
              )}
            </Panel>
            <SectionFooter>
              {`The ${MAX_VISIBLE_EVENTS} most recent low-level expo-updates entries from the last 24 hours. Entries are summarized; tap one to inspect its raw message and identifiers.`}
            </SectionFooter>
          </VStack>
        </VStack>
      </ScrollView>
    </Host>
  );
}
