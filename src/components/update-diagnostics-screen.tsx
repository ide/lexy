import {
  Button as SwiftUIButton,
  DisclosureGroup,
  HStack,
  Host,
  Image as SwiftUIImage,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from "@expo/ui/swift-ui";
import {
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
  padding,
  shapes,
  textSelection,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useObserve } from "expo-observe";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { NativeScrollView } from "@/components/native-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
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

function Icon({
  name,
  size = 20,
  tint = colors.label as string,
}: {
  name: SFSymbol;
  size?: number;
  tint?: string;
}) {
  return (
    <Image
      source={`sf:${name}`}
      tintColor={tint}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText
      type="smallBold"
      themeColor="secondaryLabel"
      style={styles.sectionTitle}
    >
      {children}
    </ThemedText>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      {children}
    </View>
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
  const theme = useTheme();
  return (
    <View
      style={[
        styles.dataRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
      ]}
    >
      <ThemedText type="small" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <ThemedText selectable type="small" style={styles.dataValue}>
        {value}
      </ThemedText>
    </View>
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
      label={busy ? `${label}…` : label}
      systemImage={busy ? "hourglass" : icon}
      onPress={onPress}
      modifiers={[
        buttonStyle(primary ? "borderedProminent" : "bordered"),
        controlSize("large"),
        tint(colors.systemBlue),
        disabledModifier(disabled),
        frame({ maxWidth: Infinity }),
      ]}
    />
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
  const theme = useTheme();
  const copy = describeKnownUpdate(entry.state);
  const isCurrent = entry.state === "Running now";
  const isReady = entry.state === "Downloaded · launches next";
  const accent = isCurrent
    ? (colors.systemGreen as string)
    : isReady
      ? (colors.systemBlue as string)
      : (colors.systemOrange as string);

  return (
    <Card>
      <View style={styles.updateCardHeader}>
        <View style={[styles.updateGlyph, { backgroundColor: theme.fill }]}>
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
        </View>
        <View style={styles.flex}>
          <View style={styles.updateTitleRow}>
            <ThemedText type="smallBold" style={styles.updateTitle}>
              {copy.title}
            </ThemedText>
            <View style={[styles.badge, { backgroundColor: theme.fill }]}>
              <ThemedText type="code" style={{ color: accent }}>
                {copy.badge}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" themeColor="secondaryLabel">
            {copy.detail}
          </ThemedText>
        </View>
      </View>
      <View
        style={[styles.updateMetadata, { borderTopColor: theme.separator }]}
      >
        <View style={styles.compactRow}>
          <ThemedText type="small" themeColor="secondaryLabel">
            Published
          </ThemedText>
          <ThemedText selectable type="small">
            {formatDate(entry.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.compactRow}>
          <ThemedText type="small" themeColor="secondaryLabel">
            Source
          </ThemedText>
          <ThemedText type="small">{entry.source}</ThemedText>
        </View>
        <View style={styles.updateIdRow}>
          <ThemedText type="small" themeColor="secondaryLabel">
            Update ID
          </ThemedText>
          <ThemedText selectable type="code" style={styles.updateId}>
            {entry.id}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

function NativeLogRow({
  entry,
  last,
}: {
  entry: Updates.UpdatesLogEntry;
  last: boolean;
}) {
  const theme = useTheme();
  const description = describeNativeLog(entry);
  const isProblem = entry.level === "error" || entry.level === "fatal";
  const isWarning = entry.level === "warn";
  const tint = isProblem
    ? (colors.systemOrange as string)
    : isWarning
      ? (colors.systemOrange as string)
      : (colors.systemBlue as string);

  return (
    <Host
      matchContents={{ vertical: true }}
      seedColor={colors.systemBlue}
      style={[
        styles.nativeLogRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
      ]}
    >
      <DisclosureGroup
        isExpanded={false}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <DisclosureGroup.Label>
          <VStack
            alignment="leading"
            spacing={6}
            modifiers={[
              frame({ maxWidth: Infinity, alignment: "leading" }),
              contentShape(shapes.rectangle()),
              padding({ vertical: 8 }),
            ]}
          >
            <HStack alignment="center" spacing={8}>
              <SwiftUIImage systemName="circle.fill" size={8} color={tint} />
              <SwiftUIText
                modifiers={[
                  font({ textStyle: "subheadline", weight: "semibold" }),
                  foregroundStyle({
                    type: "hierarchical",
                    style: "primary",
                  }),
                  lineLimit(2),
                  layoutPriority(1),
                ]}
              >
                {description.title}
              </SwiftUIText>
              <Spacer />
              <SwiftUIText
                modifiers={[
                  font({ textStyle: "caption" }),
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
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
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                lineLimit(2),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {description.summary}
            </SwiftUIText>
            <SwiftUIText
              modifiers={[
                font({ textStyle: "caption2", design: "monospaced" }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {entry.level.toUpperCase()}
              {entry.code === "None" ? "" : ` · ${entry.code}`}
            </SwiftUIText>
          </VStack>
        </DisclosureGroup.Label>
        <VStack
          alignment="leading"
          spacing={8}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({ bottom: 8 }),
          ]}
        >
          <SwiftUIText
            modifiers={[
              font({
                textStyle: "caption2",
                design: "monospaced",
                weight: "semibold",
              }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            RAW MESSAGE
          </SwiftUIText>
          <SwiftUIText
            modifiers={[
              font({ textStyle: "caption", design: "monospaced" }),
              textSelection(true),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {entry.message}
          </SwiftUIText>
          {entry.updateId ? (
            <SwiftUIText
              modifiers={[
                font({ textStyle: "caption2", design: "monospaced" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                textSelection(true),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              Update {entry.updateId}
            </SwiftUIText>
          ) : null}
          {entry.assetId ? (
            <SwiftUIText
              modifiers={[
                font({ textStyle: "caption2", design: "monospaced" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                textSelection(true),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              Asset {entry.assetId}
            </SwiftUIText>
          ) : null}
          {entry.stacktrace?.length ? (
            <SwiftUIText
              modifiers={[
                font({ textStyle: "caption2", design: "monospaced" }),
                foregroundStyle({
                  type: "hierarchical",
                  style: "secondary",
                }),
                textSelection(true),
                fixedSize({ horizontal: false, vertical: true }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              {entry.stacktrace.join("\n")}
            </SwiftUIText>
          ) : null}
        </VStack>
      </DisclosureGroup>
    </Host>
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
  const theme = useTheme();
  const updateState = Updates.useUpdates();
  const { markInteractive } = useObserve();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Updates.UpdatesLogEntry[]>([]);
  const [activity, setActivity] = useState<UpdateActivityEvent[]>([]);
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(false);
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
      Updates.readLogEntriesAsync(24 * 60 * 60 * 1_000),
      readUpdateActivity(),
    ]);
    setLogs(sortNewestFirst(nativeEntries).slice(0, 20));
    setActivity(sortNewestFirst(activityEntries).slice(0, 20));
  }, []);

  useEffect(() => {
    refreshEvents().catch((error: unknown) => {
      setActionError(
        error instanceof Error ? error.message : "Could not read update logs.",
      );
    });
  }, [refreshEvents]);

  const refreshEventLists = useCallback(async () => {
    setIsRefreshingEvents(true);
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
      setIsRefreshingEvents(false);
    }
  }, [refreshEvents]);

  const perform = useCallback(
    async (action: Action, operation: () => Promise<string>) => {
      setActiveAction(action);
      setActionMessage(null);
      setActionError(null);
      try {
        const message = await operation();
        setActionMessage(message);
        if (process.env.EXPO_OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "The update operation failed.",
        );
        if (process.env.EXPO_OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      return `No newer compatible update (${result.reason}).`;
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

  return (
    <NativeScrollView contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.statusRow}>
          <View style={[styles.statusIcon, { backgroundColor: theme.fill }]}>
            <Icon name={status.icon} size={24} tint={status.color} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{status.title}</ThemedText>
            <ThemedText type="small" themeColor="secondaryLabel">
              {status.detail}
            </ThemedText>
          </View>
        </View>
        {updateState.isDownloading ? (
          <View style={[styles.progressTrack, { backgroundColor: theme.fill }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.systemBlue,
                  width: `${Math.round((updateState.downloadProgress ?? 0) * 100)}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </Card>

      <View>
        <SectionTitle>UPDATE SYSTEM</SectionTitle>
        <Card>
          <DataRow label="Enabled" value={Updates.isEnabled ? "Yes" : "No"} />
          <DataRow label="Channel" value={Updates.channel ?? "None"} />
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
      </View>

      <View>
        <SectionTitle>KNOWN UPDATES</SectionTitle>
        <View style={styles.cardStack}>
          {updateEntries.map((entry) => (
            <KnownUpdateCard key={`${entry.state}-${entry.id}`} entry={entry} />
          ))}
        </View>
        <ThemedText
          type="small"
          themeColor="secondaryLabel"
          style={styles.note}
        >
          This is the actionable update state Expo exposes: what is running,
          what is ready on this device, and what the server has offered. Older
          cached bundles are managed internally and are not enumerable from app
          code.
        </ThemedText>
      </View>

      <View>
        <SectionTitle>CONTROLS</SectionTitle>
        <Host
          matchContents={{ vertical: true }}
          seedColor={colors.systemBlue}
          style={styles.nativeControlsHost}
        >
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
        </Host>
      </View>

      {actionMessage ||
      actionError ||
      updateState.checkError ||
      updateState.downloadError ? (
        <Card>
          <ThemedText
            selectable
            type="small"
            style={{
              color:
                actionError ||
                updateState.checkError ||
                updateState.downloadError
                  ? (colors.systemOrange as string)
                  : (colors.systemGreen as string),
            }}
          >
            {actionError ??
              updateState.checkError?.message ??
              updateState.downloadError?.message ??
              actionMessage}
          </ThemedText>
        </Card>
      ) : null}

      <View>
        <View style={styles.sectionHeader}>
          <SectionTitle>UPDATE ACTIVITY</SectionTitle>
          <Host matchContents seedColor={colors.systemBlue}>
            <SwiftUIButton
              label={isRefreshingEvents ? "Refreshing…" : "Refresh"}
              systemImage="arrow.clockwise"
              onPress={refreshEventLists}
              modifiers={[
                buttonStyle("borderless"),
                controlSize("small"),
                tint(colors.systemBlue),
                disabledModifier(isRefreshingEvents),
              ]}
            />
          </Host>
        </View>
        <Card>
          {activity.length === 0 ? (
            <ThemedText type="small" themeColor="secondaryLabel">
              Activity tracking starts with this version. The current launch
              will appear here after Refresh.
            </ThemedText>
          ) : (
            activity.map((entry, index) => (
              <View
                key={entry.id}
                style={[
                  styles.logEntry,
                  index < activity.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.separator,
                  },
                ]}
              >
                <View style={styles.betweenRow}>
                  <ThemedText
                    type="smallBold"
                    style={
                      entry.level === "error"
                        ? { color: colors.systemOrange as string }
                        : undefined
                    }
                  >
                    {entry.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="secondaryLabel">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </ThemedText>
                </View>
                <ThemedText selectable type="small">
                  {entry.detail}
                </ThemedText>
                {entry.updateId ? (
                  <ThemedText
                    selectable
                    type="code"
                    themeColor="secondaryLabel"
                  >
                    Update {shortUpdateId(entry.updateId)}
                  </ThemedText>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>NATIVE UPDATE LOG</SectionTitle>
        <Card>
          {logs.length === 0 ? (
            <ThemedText type="small" themeColor="secondaryLabel">
              No native expo-updates entries were recorded in the last 24 hours.
            </ThemedText>
          ) : (
            logs.map((entry, index) => (
              <NativeLogRow
                key={`${entry.timestamp}-${entry.code}-${entry.message}`}
                entry={entry}
                last={index === logs.length - 1}
              />
            ))
          )}
        </Card>
        <ThemedText
          type="small"
          themeColor="secondaryLabel"
          style={styles.note}
        >
          Low-level expo-updates activity from the last 24 hours. Entries are
          summarized; tap one to inspect its raw message and identifiers.
        </ThemedText>
      </View>
    </NativeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  cardStack: {
    gap: Spacing.two,
  },
  sectionTitle: {
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  progressTrack: {
    height: 8,
    borderRadius: 100,
    overflow: "hidden",
    marginTop: Spacing.three,
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dataValue: {
    flex: 1,
    textAlign: "right",
  },
  betweenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  updateCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  updateGlyph: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  updateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  updateTitle: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderRadius: 7,
    borderCurve: "continuous",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    flexShrink: 0,
  },
  updateMetadata: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  updateIdRow: {
    gap: Spacing.one,
  },
  updateId: {
    lineHeight: 18,
  },
  note: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
  nativeControlsHost: {
    width: "100%",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: Spacing.two,
  },
  logEntry: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  nativeLogRow: {
    paddingVertical: Spacing.two,
  },
});
