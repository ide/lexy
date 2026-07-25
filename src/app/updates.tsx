import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ThemedText } from '@/components/themed-text';
import { Spacing, colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  readUpdateActivity,
  recordUpdateActivity,
} from '@/updates/update-history';
import {
  buildUpdateEntries,
  describeKnownUpdate,
  describeNativeLog,
  resolveLastCheck,
  shortUpdateId,
  sortNewestFirst,
  type UpdateActivityEvent,
  type UpdateEntry,
} from '@/updates/update-utils';

type Action = 'check' | 'download' | 'reload';

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
    <ThemedText type="smallBold" themeColor="secondaryLabel" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>;
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
      ]}>
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
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary
          ? { backgroundColor: colors.systemBlue }
          : { backgroundColor: colors.fill },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.7 },
      ]}>
      {busy ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : (colors.label as string)} />
      ) : (
        <Icon
          name={icon}
          size={17}
          tint={primary ? '#FFFFFF' : (colors.label as string)}
        />
      )}
      <ThemedText
        type="smallBold"
        style={primary ? { color: '#FFFFFF' } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function formatDate(value: Date | undefined, fallback = 'Not reported'): string {
  return value
    ? value.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : fallback;
}

function KnownUpdateCard({ entry }: { entry: UpdateEntry }) {
  const theme = useTheme();
  const copy = describeKnownUpdate(entry.state);
  const isCurrent = entry.state === 'Running now';
  const isReady = entry.state === 'Downloaded · launches next';
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
                ? 'play.fill'
                : isReady
                  ? 'arrow.down'
                  : 'icloud.and.arrow.down'
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
      <View style={[styles.updateMetadata, { borderTopColor: theme.separator }]}>
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
  const [expanded, setExpanded] = useState(false);
  const description = describeNativeLog(entry);
  const isProblem = entry.level === 'error' || entry.level === 'fatal';
  const isWarning = entry.level === 'warn';
  const tint = isProblem
    ? (colors.systemOrange as string)
    : isWarning
      ? (colors.systemOrange as string)
      : (colors.systemBlue as string);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [
        styles.nativeLogRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
        pressed && { opacity: 0.65 },
      ]}>
      <View style={styles.nativeLogHeader}>
        <View style={styles.logTitleGroup}>
          <View style={[styles.severityDot, { backgroundColor: tint }]} />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.logTitle}>
            {description.title}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="secondaryLabel" style={styles.logTime}>
          {new Date(entry.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </ThemedText>
      </View>
      <ThemedText
        selectable
        numberOfLines={expanded ? undefined : 2}
        type="small"
        themeColor="secondaryLabel">
        {description.summary}
      </ThemedText>
      <View style={styles.logFooter}>
        <ThemedText type="code" themeColor="secondaryLabel">
          {entry.level.toUpperCase()}
          {entry.code === 'None' ? '' : ` · ${entry.code}`}
        </ThemedText>
        <Icon
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={12}
          tint={colors.secondaryLabel as string}
        />
      </View>
      {expanded ? (
        <View style={[styles.rawLog, { backgroundColor: theme.fill }]}>
          <ThemedText type="code" themeColor="secondaryLabel">
            RAW MESSAGE
          </ThemedText>
          <ThemedText selectable type="code">
            {entry.message}
          </ThemedText>
          {entry.updateId ? (
            <ThemedText selectable type="code" themeColor="secondaryLabel">
              Update {entry.updateId}
            </ThemedText>
          ) : null}
          {entry.assetId ? (
            <ThemedText selectable type="code" themeColor="secondaryLabel">
              Asset {entry.assetId}
            </ThemedText>
          ) : null}
          {entry.stacktrace?.length ? (
            <ThemedText selectable type="code" themeColor="secondaryLabel">
              {entry.stacktrace.join('\n')}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
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
      icon: 'exclamationmark.triangle.fill',
      title: 'Updates disabled',
      detail: 'This build is not configured to use expo-updates.',
      color: colors.systemOrange as string,
    };
  }
  if (state.isRestarting) {
    return {
      icon: 'arrow.clockwise',
      title: 'Reloading',
      detail: 'Switching to the newest downloaded update.',
      color: colors.systemBlue as string,
    };
  }
  if (state.isDownloading) {
    return {
      icon: 'arrow.down.circle.fill',
      title: `Downloading ${Math.round((state.downloadProgress ?? 0) * 100)}%`,
      detail: 'The update will be ready to launch when the download completes.',
      color: colors.systemBlue as string,
    };
  }
  if (state.isChecking) {
    return {
      icon: 'magnifyingglass',
      title: 'Checking for updates',
      detail: 'Contacting the update server for this channel and runtime.',
      color: colors.systemBlue as string,
    };
  }
  if (state.isUpdatePending) {
    return {
      icon: 'arrow.down.circle.fill',
      title: 'Update ready',
      detail: 'Downloaded and scheduled for the next reload or cold launch.',
      color: colors.systemGreen as string,
    };
  }
  if (state.isUpdateAvailable) {
    return {
      icon: 'sparkles',
      title: 'Update available',
      detail: 'A compatible update is available but has not been downloaded.',
      color: colors.systemOrange as string,
    };
  }
  return {
    icon: 'checkmark.circle.fill',
    title: 'Running normally',
    detail: state.lastCheckForUpdateTimeSinceRestart
      ? 'No newer compatible update was found at the last check.'
      : 'Use Check Now to ask the update server for the latest version.',
    color: colors.systemGreen as string,
  };
}

export default function UpdateDiagnostics() {
  const theme = useTheme();
  const updateState = Updates.useUpdates();
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
      setActionError(error instanceof Error ? error.message : 'Could not read update logs.');
    });
  }, [refreshEvents]);

  const refreshEventLists = useCallback(async () => {
    setIsRefreshingEvents(true);
    try {
      await refreshEvents();
      if (process.env.EXPO_OS === 'ios') {
        Haptics.selectionAsync();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not read update logs.');
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
        if (process.env.EXPO_OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'The update operation failed.');
        if (process.env.EXPO_OS === 'ios') {
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
    perform('check', async () => {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await recordUpdateActivity([
          {
            id: `available:${result.manifest.id}`,
            timestamp: Date.now(),
            title: 'Update found',
            detail: 'A manual check found a compatible update.',
            updateId: result.manifest.id,
          },
        ]);
        return 'A newer update is available to download.';
      }
      if (result.isRollBackToEmbedded) {
        return 'A rollback to the embedded update is available.';
      }
      await recordUpdateActivity([
        {
          id: `check:${Date.now()}`,
          timestamp: Date.now(),
          title: 'Update check completed',
          detail: `No newer compatible update (${result.reason}).`,
        },
      ]);
      return `No newer compatible update (${result.reason}).`;
    });

  const download = () =>
    perform('download', async () => {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew) {
        await recordUpdateActivity([
          {
            id: `downloaded:${result.manifest.id}`,
            timestamp: Date.now(),
            title: 'Update downloaded',
            detail: 'Ready for the next reload or cold launch.',
            updateId: result.manifest.id,
          },
        ]);
        return 'Update downloaded. Reload now or launch it next time.';
      }
      if (result.isRollBackToEmbedded) {
        return 'Rollback downloaded. Reload now or launch it next time.';
      }
      return 'No new update was downloaded.';
    });

  const reload = () => {
    setActiveAction('reload');
    setActionMessage(null);
    setActionError(null);
    recordUpdateActivity([
      {
        id: `reload:${Date.now()}`,
        timestamp: Date.now(),
        title: 'Reload requested',
        detail: updateState.isUpdatePending
          ? 'Switching to the downloaded update.'
          : 'Restarting the current update.',
        updateId: updateState.downloadedUpdate?.updateId,
      },
    ])
      .catch(() => {})
      .then(() => Updates.reloadAsync())
      .catch((error: unknown) => {
        setActiveAction(null);
        setActionError(error instanceof Error ? error.message : 'The app could not reload.');
      });
  };

  const busy =
    activeAction !== null ||
    updateState.isChecking ||
    updateState.isDownloading ||
    updateState.isRestarting;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
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
          <DataRow label="Enabled" value={Updates.isEnabled ? 'Yes' : 'No'} />
          <DataRow label="Channel" value={Updates.channel ?? 'None'} />
          <DataRow label="Runtime" value={Updates.runtimeVersion ?? 'Unknown'} />
          <DataRow label="App version" value={Constants.expoConfig?.version ?? 'Unknown'} />
          <DataRow
            label="Automatic checks"
            value={Updates.checkAutomatically ?? 'Unknown'}
          />
          <DataRow
            label="Launch time"
            value={
              updateState.currentlyRunning.launchDuration === undefined
                ? 'Unknown'
                : `${updateState.currentlyRunning.launchDuration} ms`
            }
          />
          <DataRow label="Reloads this launch" value={`${updateState.restartCount}`} />
          <DataRow
            label="Most recent check"
            value={
              'checkedAt' in lastCheck
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
        <ThemedText type="small" themeColor="secondaryLabel" style={styles.note}>
          This is the actionable update state Expo exposes: what is running, what is
          ready on this device, and what the server has offered. Older cached bundles
          are managed internally and are not enumerable from app code.
        </ThemedText>
      </View>

      <View>
        <SectionTitle>CONTROLS</SectionTitle>
        <View style={styles.actions}>
          <ActionButton
            busy={activeAction === 'check' || updateState.isChecking}
            disabled={!Updates.isEnabled || busy}
            icon="arrow.clockwise"
            label="Check Now"
            onPress={check}
            primary
          />
          <ActionButton
            busy={activeAction === 'download' || updateState.isDownloading}
            disabled={!Updates.isEnabled || busy || !updateState.isUpdateAvailable}
            icon="arrow.down.circle"
            label="Download Update"
            onPress={download}
          />
          <ActionButton
            busy={activeAction === 'reload' || updateState.isRestarting}
            disabled={!Updates.isEnabled || busy}
            icon="arrow.clockwise.circle"
            label={updateState.isUpdatePending ? 'Reload Into Update' : 'Reload App'}
            onPress={reload}
          />
        </View>
      </View>

      {actionMessage || actionError || updateState.checkError || updateState.downloadError ? (
        <Card>
          <ThemedText
            selectable
            type="small"
            style={{
              color: actionError || updateState.checkError || updateState.downloadError
                ? (colors.systemOrange as string)
                : (colors.systemGreen as string),
            }}>
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
          <Pressable
            accessibilityRole="button"
            disabled={isRefreshingEvents}
            onPress={refreshEventLists}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && { opacity: 0.55 },
            ]}>
            <View style={styles.refreshIcon}>
              {isRefreshingEvents ? (
                <ActivityIndicator size="small" color={colors.systemBlue as string} />
              ) : (
                <Icon
                  name="arrow.clockwise"
                  size={14}
                  tint={colors.systemBlue as string}
                />
              )}
            </View>
            <ThemedText type="smallBold" style={{ color: colors.systemBlue as string }}>
              Refresh
            </ThemedText>
          </Pressable>
        </View>
        <Card>
          {activity.length === 0 ? (
            <ThemedText type="small" themeColor="secondaryLabel">
              Activity tracking starts with this version. The current launch will appear
              here after Refresh.
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
                ]}>
                <View style={styles.betweenRow}>
                  <ThemedText
                    type="smallBold"
                    style={
                      entry.level === 'error'
                        ? { color: colors.systemOrange as string }
                        : undefined
                    }>
                    {entry.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="secondaryLabel">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </ThemedText>
                </View>
                <ThemedText selectable type="small">
                  {entry.detail}
                </ThemedText>
                {entry.updateId ? (
                  <ThemedText selectable type="code" themeColor="secondaryLabel">
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
        <ThemedText type="small" themeColor="secondaryLabel" style={styles.note}>
          Low-level expo-updates activity from the last 24 hours. Entries are summarized;
          tap one to inspect its raw message and identifiers.
        </ThemedText>
      </View>
    </ScrollView>
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
    borderCurve: 'continuous',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  progressTrack: {
    height: 8,
    borderRadius: 100,
    overflow: 'hidden',
    marginTop: Spacing.three,
  },
  progressFill: {
    height: '100%',
    borderRadius: 100,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dataValue: {
    flex: 1,
    textAlign: 'right',
  },
  betweenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  updateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  updateGlyph: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  updateTitle: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderRadius: 7,
    borderCurve: 'continuous',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  actions: {
    gap: Spacing.two,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: Spacing.two,
  },
  refreshButton: {
    minWidth: 84,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  refreshIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logEntry: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  nativeLogRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  nativeLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  logTitle: {
    flex: 1,
    minWidth: 0,
  },
  logTime: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rawLog: {
    borderRadius: 10,
    borderCurve: 'continuous',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
