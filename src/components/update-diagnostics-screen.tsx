import {
  Button as SwiftUIButton,
  DisclosureGroup,
  Divider,
  Group,
  HStack,
  Host,
  Image as SwiftUIImage,
  ProgressView,
  ScrollView as SwiftUIScrollView,
  Spacer,
  Text as SwiftUIText,
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
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useObserve } from "expo-observe";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { Spacing, colors } from "@/constants/theme";
import {
  readUpdateActivity,
  recordUpdateActivity,
} from "@/updates/update-history";
import {
  buildUpdateEntries,
  describeKnownUpdate,
  describeNativeLog,
  resolveLastCheck,
  shortUpdateId,
  sortNewestFirst,
  type UpdateActivityEvent,
  type UpdateEntry,
} from "@/updates/update-utils";

type Action = "check" | "download" | "reload";

const MAX_VISIBLE_EVENTS = 20;
const NATIVE_LOG_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function Icon({
  name,
  size = 20,
  tint = colors.label as string,
}: {
  name: SFSymbol;
  size?: number;
  tint?: string;
}) {
  return <SwiftUIImage systemName={name} size={size} color={tint} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <SwiftUIText
      modifiers={[
        font({ textStyle: "caption", weight: "semibold" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
        padding({ leading: Spacing.two, bottom: Spacing.two }),
      ]}
    >
      {children}
    </SwiftUIText>
  );
}

function Card({
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
        <SwiftUIText
          modifiers={[
            font({ textStyle: "footnote", weight: "medium" }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}
        >
          {label}
        </SwiftUIText>
        <Spacer />
        <SwiftUIText
          modifiers={[
            font({ textStyle: "footnote", weight: "medium" }),
            textSelection(true),
            multilineTextAlignment("trailing"),
          ]}
        >
          {value}
        </SwiftUIText>
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
    <SwiftUIButton
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
        <SwiftUIImage
          systemName={busy ? "hourglass" : icon}
          size={17}
          modifiers={[frame({ width: 24, height: 20 })]}
        />
        <SwiftUIText>{busy ? `${label}…` : label}</SwiftUIText>
      </HStack>
    </SwiftUIButton>
  );
}

function formatDate(
  value: Date | undefined,
  fallback = "Not reported",
): string {
  return value
    ? value.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : fallback;
}

function KnownUpdateCard({ entry }: { entry: UpdateEntry }) {
  const copy = describeKnownUpdate(entry.state);
  const isCurrent = entry.state === "Running now";
  const isReady = entry.state === "Downloaded · launches next";
  const accent = isCurrent
    ? (colors.systemGreen as string)
    : isReady
      ? (colors.systemBlue as string)
      : (colors.systemOrange as string);

  return (
    <Card spacing={Spacing.three}>
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
          <Icon
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
            <SwiftUIText
              modifiers={[
                font({ textStyle: "footnote", weight: "bold" }),
                lineLimit(2),
                layoutPriority(1),
              ]}
            >
              {copy.title}
            </SwiftUIText>
            <Spacer />
            <SwiftUIText
              modifiers={[
                font({
                  textStyle: "caption2",
                  design: "monospaced",
                  weight: "medium",
                }),
                foregroundStyle(accent),
                fixedSize(),
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
            </SwiftUIText>
          </HStack>
          <SwiftUIText
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              fixedSize({ horizontal: false, vertical: true }),
            ]}
          >
            {copy.detail}
          </SwiftUIText>
        </VStack>
      </HStack>
      <Divider />
      <VStack
        alignment="leading"
        spacing={Spacing.two}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack spacing={Spacing.three}>
          <SwiftUIText
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Published
          </SwiftUIText>
          <Spacer />
          <SwiftUIText
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              textSelection(true),
            ]}
          >
            {formatDate(entry.createdAt)}
          </SwiftUIText>
        </HStack>
        <HStack spacing={Spacing.three}>
          <SwiftUIText
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Source
          </SwiftUIText>
          <Spacer />
          <SwiftUIText
            modifiers={[font({ textStyle: "footnote", weight: "medium" })]}
          >
            {entry.source}
          </SwiftUIText>
        </HStack>
        <VStack
          alignment="leading"
          spacing={Spacing.one}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <SwiftUIText
            modifiers={[
              font({ textStyle: "footnote", weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            Update ID
          </SwiftUIText>
          <SwiftUIText
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
          </SwiftUIText>
        </VStack>
      </VStack>
    </Card>
  );
}

function NativeLogDisclosure({ entry }: { entry: Updates.UpdatesLogEntry }) {
  const description = describeNativeLog(entry);
  const isProblem =
    entry.level === "error" || entry.level === "fatal" || entry.level === "warn";
  const accent = isProblem
    ? (colors.systemOrange as string)
    : (colors.systemBlue as string);
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
            <SwiftUIImage systemName="circle.fill" size={8} color={accent} />
            <SwiftUIText
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
                foregroundStyle(colors.label),
                lineLimit(1),
                layoutPriority(1),
              ]}
            >
              {description.title}
            </SwiftUIText>
            {isProblem ? (
              <SwiftUIText
                modifiers={[
                  font({
                    textStyle: "caption2",
                    design: "monospaced",
                    weight: "semibold",
                  }),
                  foregroundStyle(colors.systemOrange),
                  fixedSize(),
                ]}
              >
                {entry.level.toUpperCase()}
              </SwiftUIText>
            ) : null}
            <Spacer />
            <SwiftUIText
              modifiers={[
                font({ textStyle: "caption" }),
                foregroundStyle(colors.secondaryLabel),
                monospacedDigit(),
                fixedSize(),
              ]}
            >
              {new Date(entry.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </SwiftUIText>
          </HStack>
          <SwiftUIText
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
          </SwiftUIText>
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
        <SwiftUIText
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
        </SwiftUIText>
        <SwiftUIText
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
        </SwiftUIText>
        {detailRows.map((row) => (
          <SwiftUIText
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
          </SwiftUIText>
        ))}
      </VStack>
    </DisclosureGroup>
  );
}

function sameEntries<T>(previous: T[], next: T[]): boolean {
  return (
    previous.length === next.length &&
    previous.every(
      (entry, index) => JSON.stringify(entry) === JSON.stringify(next[index]),
    )
  );
}

function statusFor(state: ReturnType<typeof Updates.useUpdates>): {
  icon: SFSymbol;
  title: string;
  detail: string;
  color: string;
} {
  if (!Updates.isEnabled) {
    return {
      icon: "exclamationmark.triangle.fill",
      title: "Updates disabled",
      detail: "This build is not configured to use expo-updates.",
      color: colors.systemOrange as string,
    };
  }
  if (state.isRestarting) {
    return {
      icon: "arrow.clockwise",
      title: "Reloading",
      detail: "Switching to the newest downloaded update.",
      color: colors.systemBlue as string,
    };
  }
  if (state.isDownloading) {
    return {
      icon: "arrow.down.circle.fill",
      title: `Downloading ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
      detail: "The update will be ready to launch when the download completes.",
      color: colors.systemBlue as string,
    };
  }
  if (state.isChecking) {
    return {
      icon: "magnifyingglass",
      title: "Checking for updates",
      detail: "Contacting the update server for this channel and runtime.",
      color: colors.systemBlue as string,
    };
  }
  if (state.isUpdatePending) {
    return {
      icon: "arrow.down.circle.fill",
      title: "Update ready",
      detail: "Downloaded and scheduled for the next reload or cold launch.",
      color: colors.systemGreen as string,
    };
  }
  if (state.isUpdateAvailable) {
    return {
      icon: "sparkles",
      title: "Update available",
      detail: "A compatible update is available but has not been downloaded.",
      color: colors.systemOrange as string,
    };
  }
  return {
    icon: "checkmark.circle.fill",
    title: "Running normally",
    detail: state.lastCheckForUpdateTimeSinceRestart
      ? "No newer compatible update was found at the last check."
      : "Use Check Now to ask the update server for the latest version.",
    color: colors.systemGreen as string,
  };
}

export default function UpdateDiagnostics() {
  const updateState = Updates.useUpdates();
  const { markInteractive } = useObserve();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Updates.UpdatesLogEntry[]>([]);
  const [activity, setActivity] = useState<UpdateActivityEvent[]>([]);
  const isRefreshingEventsRef = useRef(false);
  const status = statusFor(updateState);
  const lastCheck = resolveLastCheck(
    updateState.lastCheckForUpdateTimeSinceRestart,
    Updates.checkAutomatically,
  );
  const updateEntries = useMemo(
    () =>
      buildUpdateEntries({
        running: updateState.currentlyRunning,
        available: updateState.availableUpdate,
        downloaded: updateState.downloadedUpdate,
      }),
    [
      updateState.availableUpdate,
      updateState.currentlyRunning,
      updateState.downloadedUpdate,
    ],
  );

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  const refreshEvents = useCallback(async () => {
    const [nativeEntries, activityEntries] = await Promise.all([
      Updates.readLogEntriesAsync(NATIVE_LOG_MAX_AGE_MS),
      readUpdateActivity(),
    ]);
    const nextLogs = sortNewestFirst(nativeEntries).slice(0, MAX_VISIBLE_EVENTS);
    const nextActivity = sortNewestFirst(activityEntries).slice(
      0,
      MAX_VISIBLE_EVENTS,
    );
    // Keep the previous arrays when nothing changed so a no-op refresh does
    // not re-render (and visibly flash) the native tree.
    setLogs((previous) => (sameEntries(previous, nextLogs) ? previous : nextLogs));
    setActivity((previous) =>
      sameEntries(previous, nextActivity) ? previous : nextActivity,
    );
  }, []);

  useEffect(() => {
    refreshEvents().catch((error: unknown) => {
      setActionError(
        error instanceof Error ? error.message : "Could not read update logs.",
      );
    });
  }, [refreshEvents]);

  const refreshEventLists = useCallback(async () => {
    if (isRefreshingEventsRef.current) {
      return;
    }
    isRefreshingEventsRef.current = true;
    try {
      await refreshEvents();
      if (process.env.EXPO_OS === "ios") {
        Haptics.selectionAsync();
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not read update logs.",
      );
    } finally {
      isRefreshingEventsRef.current = false;
    }
  }, [refreshEvents]);

  const perform = useCallback(
    async (action: Action, operation: () => Promise<string>) => {
      setActiveAction(action);
      // Leave the previous result visible while the action runs; clearing it
      // here would flip the result card's colors twice per action.
      try {
        const message = await operation();
        setActionMessage(message);
        setActionError(null);
        if (process.env.EXPO_OS === "ios") {
          Haptics.selectionAsync();
        }
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "The update operation failed.",
        );
        setActionMessage(null);
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }
      } finally {
        setActiveAction(null);
        refreshEvents().catch(() => {});
      }
    },
    [refreshEvents],
  );

  const check = () =>
    perform("check", async () => {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await recordUpdateActivity([
          {
            id: `available:${result.manifest.id}`,
            timestamp: Date.now(),
            title: "Update found",
            detail: "A manual check found a compatible update.",
            updateId: result.manifest.id,
          },
        ]);
        return "A newer update is available to download.";
      }
      if (result.isRollBackToEmbedded) {
        return "A rollback to the embedded update is available.";
      }
      await recordUpdateActivity([
        {
          id: `check:${Date.now()}`,
          timestamp: Date.now(),
          title: "Update check completed",
          detail: `No newer compatible update (${result.reason}).`,
        },
      ]);
      // The raw reason code stays in the recorded activity above; the result
      // card keeps to plain language.
      return "You are already running the latest compatible update.";
    });

  const download = () =>
    perform("download", async () => {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await recordUpdateActivity([
          {
            id: `downloaded:${result.manifest.id}`,
            timestamp: Date.now(),
            title: "Update downloaded",
            detail: "Ready for the next reload or cold launch.",
            updateId: result.manifest.id,
          },
        ]);
        return "Update downloaded. Reload now or launch it next time.";
      }
      if (result.isRollBackToEmbedded) {
        return "Rollback downloaded. Reload now or launch it next time.";
      }
      return "No new update was downloaded.";
    });

  const reload = () => {
    setActiveAction("reload");
    setActionMessage(null);
    setActionError(null);
    recordUpdateActivity([
      {
        id: `reload:${Date.now()}`,
        timestamp: Date.now(),
        title: "Reload requested",
        detail: updateState.isUpdatePending
          ? "Switching to the downloaded update."
          : "Restarting the current update.",
        updateId: updateState.downloadedUpdate?.updateId,
      },
    ])
      .catch(() => {})
      .then(() => Updates.reloadAsync())
      .catch((error: unknown) => {
        setActiveAction(null);
        setActionError(
          error instanceof Error ? error.message : "The app could not reload.",
        );
      });
  };

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
      <SwiftUIScrollView modifiers={[refreshable(refreshEventLists)]}>
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
            // Animate the relayout when a known-update card appears or
            // disappears instead of letting the sections below jump.
            animation(Animation.spring({ duration: 0.35 }), updateEntries.length),
            // Fade the busy-state color changes (status tint, disabled
            // buttons, result text) instead of snapping them.
            animation(Animation.easeInOut({ duration: 0.2 }), busy),
          ]}
        >
          <Card spacing={Spacing.three}>
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
                <Icon name={status.icon} size={24} tint={status.color} />
              </ZStack>
              <VStack
                alignment="leading"
                spacing={Spacing.half}
                modifiers={[
                  frame({ maxWidth: Infinity, alignment: "leading" }),
                ]}
              >
                <SwiftUIText
                  modifiers={[font({ textStyle: "footnote", weight: "bold" })]}
                >
                  {status.title}
                </SwiftUIText>
                <SwiftUIText
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
                </SwiftUIText>
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
          </Card>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionTitle>UPDATE SYSTEM</SectionTitle>
            <Card verticalPadding={Spacing.two}>
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
                    ? formatDate(lastCheck.checkedAt)
                    : lastCheck.detail
                }
                last
              />
            </Card>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionTitle>KNOWN UPDATES</SectionTitle>
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
            <SwiftUIText
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
                padding({
                  top: Spacing.two,
                  horizontal: Spacing.two,
                }),
              ]}
            >
              This is the actionable update state Expo exposes: what is running,
              what is ready on this device, and what the server has offered.
              Older cached bundles are managed internally and are not enumerable
              from app code.
            </SwiftUIText>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionTitle>CONTROLS</SectionTitle>
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
          <Card>
            <SwiftUIText
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
            </SwiftUIText>
          </Card>

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
              <SwiftUIText
                modifiers={[
                  font({ textStyle: "caption", weight: "semibold" }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "secondary",
                  }),
                ]}
              >
                UPDATE ACTIVITY
              </SwiftUIText>
              <Spacer />
              <SwiftUIButton
                label="Refresh"
                systemImage="arrow.clockwise"
                onPress={refreshEventLists}
                modifiers={[
                  buttonStyle("borderless"),
                  controlSize("small"),
                  tint(colors.systemBlue),
                ]}
              />
            </HStack>
            <Card
              verticalPadding={
                activity.length === 0 ? Spacing.three : Spacing.two
              }
            >
              {activity.length === 0 ? (
                <SwiftUIText
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
                </SwiftUIText>
              ) : (
                activity.map((entry, index) => (
                  <Group key={entry.id}>
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
                        <SwiftUIText
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
                            layoutPriority(1),
                          ]}
                        >
                          {entry.title}
                        </SwiftUIText>
                        <Spacer />
                        <SwiftUIText
                          modifiers={[
                            font({ textStyle: "caption" }),
                            foregroundStyle({
                              type: "hierarchical",
                              style: "secondary",
                            }),
                            monospacedDigit(),
                            fixedSize(),
                          ]}
                        >
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </SwiftUIText>
                      </HStack>
                      <SwiftUIText
                        modifiers={[
                          font({ textStyle: "footnote", weight: "medium" }),
                          textSelection(true),
                          fixedSize({ horizontal: false, vertical: true }),
                        ]}
                      >
                        {entry.detail}
                      </SwiftUIText>
                      {entry.updateId ? (
                        <SwiftUIText
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
                        </SwiftUIText>
                      ) : null}
                    </VStack>
                    {index < activity.length - 1 ? <Divider /> : null}
                  </Group>
                ))
              )}
            </Card>
            <SwiftUIText
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
                padding({
                  top: Spacing.two,
                  horizontal: Spacing.two,
                }),
              ]}
            >
              {`Update checks, downloads, and reloads recorded by Lexy on this device. The ${MAX_VISIBLE_EVENTS} most recent events are shown.`}
            </SwiftUIText>
          </VStack>

          <VStack
            alignment="leading"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            <SectionTitle>NATIVE UPDATE LOG</SectionTitle>
            <Card
              verticalPadding={logs.length === 0 ? Spacing.three : Spacing.two}
            >
              {logs.length === 0 ? (
                <SwiftUIText
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
                </SwiftUIText>
              ) : (
                <VStack
                  spacing={0}
                  modifiers={[
                    frame({ maxWidth: Infinity, alignment: "leading" }),
                  ]}
                >
                  {logs.map((entry, index) => (
                    <Group
                      key={`${entry.timestamp}-${entry.code}-${entry.message}`}
                    >
                      <NativeLogDisclosure entry={entry} />
                      {index < logs.length - 1 ? <Divider /> : null}
                    </Group>
                  ))}
                </VStack>
              )}
            </Card>
            <SwiftUIText
              modifiers={[
                font({ textStyle: "footnote", weight: "medium" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
                padding({
                  top: Spacing.two,
                  horizontal: Spacing.two,
                }),
              ]}
            >
              {`The ${MAX_VISIBLE_EVENTS} most recent low-level expo-updates entries from the last 24 hours. Entries are summarized; tap one to inspect its raw message and identifiers.`}
            </SwiftUIText>
          </VStack>
        </VStack>
      </SwiftUIScrollView>
    </Host>
  );
}
