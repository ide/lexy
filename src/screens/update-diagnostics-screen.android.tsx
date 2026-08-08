import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Column,
  OutlinedButton,
  HorizontalDivider,
  Icon,
  LinearProgressIndicator,
  PullToRefreshBox,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { iconDrawables, type DrawableIconName } from "@/components/jetpack-compose/icon-drawables";
import {
  Card,
  DataRow,
  Section,
  SectionFooter,
  SectionHeader,
} from "@/components/jetpack-compose/settings";
import { Spacing, colors } from "@/constants/theme";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";
import { formatEventTime } from "@/screens/update-diagnostics/event-time";
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

/** The badge accents for the three kinds of known update. */
const BADGE_COLORS: Record<UpdateEntry["state"], string> = {
  "Running now": colors.systemGreen,
  "Downloaded · launches next": colors.systemBlue,
  "Available to download": colors.systemOrange,
};

/** One of the three updates Expo can name: running, downloaded, or offered. */
function KnownUpdateCard({ entry }: { entry: UpdateEntry }) {
  const described = describeKnownUpdate(entry.state);
  const accent = BADGE_COLORS[entry.state];

  return (
    <Card spacing={Spacing.two}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: Spacing.two }}
        modifiers={[fillMaxWidth()]}
      >
        <Text style={{ fontSize: 14, fontWeight: "700" }} color={colors.label} modifiers={[weight(1)]}>
          {described.title}
        </Text>
        <Text
          style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}
          color={accent}
          modifiers={[
            clip(Shapes.RoundedCorner(6)),
            background(colors.fill),
            padding(Spacing.two, Spacing.half, Spacing.two, Spacing.half),
          ]}
        >
          {described.badge}
        </Text>
      </Row>
      <Text style={{ fontSize: 13 }} color={colors.secondaryLabel}>
        {described.detail}
      </Text>
      <HorizontalDivider color={colors.separator} />
      <DataRow label="Published" value={formatUpdateDate(entry.createdAt)} />
      <DataRow label="Source" value={entry.source} />
      <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.secondaryLabel}>
        {entry.id}
      </Text>
    </Card>
  );
}

/** One update check, download, or reload that Lexy itself recorded. */
function ActivityRow({ entry }: { entry: UpdateActivityEvent }) {
  return (
    <Column
      verticalArrangement={{ spacedBy: Spacing.half }}
      modifiers={[fillMaxWidth(), padding(0, Spacing.two, 0, Spacing.two)]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: Spacing.two }}
        modifiers={[fillMaxWidth()]}
      >
        <Text
          style={{ fontSize: 14, fontWeight: "700" }}
          color={entry.level === "error" ? colors.systemOrange : colors.label}
          modifiers={[weight(1)]}
        >
          {entry.title}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.secondaryLabel}>
          {formatEventTime(entry.timestamp)}
        </Text>
      </Row>
      <Text style={{ fontSize: 13 }} color={colors.secondaryLabel}>
        {entry.detail}
      </Text>
      {entry.updateId ? (
        <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.tertiaryLabel}>
          {shortUpdateId(entry.updateId)}
        </Text>
      ) : null}
    </Column>
  );
}

/**
 * A native log entry, collapsed to its summary until tapped. Compose has no
 * disclosure primitive, so the row is a clickable column that swaps in the raw
 * detail — the same reveal the iOS `DisclosureGroup` gives.
 */
function NativeLogRow({
  entry,
}: {
  entry: { timestamp: number; code: string; level: string; message: string; updateId?: string; assetId?: string; stacktrace?: string[] };
}) {
  const [expanded, setExpanded] = useState(false);
  const described = describeNativeLog(entry);
  const severe = entry.level !== "info" && entry.level !== "debug" && entry.level !== "trace";

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        clickable(() => setExpanded((open) => !open)),
        padding(0, Spacing.two, 0, Spacing.two),
      ]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: Spacing.two }}
        modifiers={[fillMaxWidth()]}
      >
        <Box
          modifiers={[
            size(8, 8),
            clip(Shapes.Circle),
            background(severe ? colors.systemOrange : colors.systemGreen),
          ]}
        />
        <Text style={{ fontSize: 14, fontWeight: "700" }} color={colors.label} modifiers={[weight(1)]}>
          {described.title}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.secondaryLabel}>
          {formatEventTime(entry.timestamp)}
        </Text>
      </Row>
      <Text
        style={{ fontSize: 13 }}
        color={colors.secondaryLabel}
        modifiers={[padding(0, Spacing.half, 0, 0)]}
      >
        {described.summary}
      </Text>
      {expanded ? (
        <Column
          verticalArrangement={{ spacedBy: Spacing.half }}
          modifiers={[fillMaxWidth(), padding(0, Spacing.two, 0, 0)]}
        >
          <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.secondaryLabel}>
            {`${entry.level.toUpperCase()} · ${entry.code}`}
          </Text>
          <Text style={{ fontSize: 12 }} color={colors.label}>
            {entry.message}
          </Text>
          {entry.updateId ? (
            <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.tertiaryLabel}>
              {`Update ${entry.updateId}`}
            </Text>
          ) : null}
          {entry.assetId ? (
            <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.tertiaryLabel}>
              {`Asset ${entry.assetId}`}
            </Text>
          ) : null}
          {entry.stacktrace?.length ? (
            <Text style={{ fontSize: 11, fontFamily: "monospace" }} color={colors.tertiaryLabel}>
              {entry.stacktrace.join("\n")}
            </Text>
          ) : null}
        </Column>
      ) : null}
    </Column>
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
  icon: DrawableIconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const Control = primary ? Button : OutlinedButton;
  return (
    <Control
      enabled={!disabled}
      onClick={onPress}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 52 })]}
    >
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: Spacing.two }}>
        <Icon source={iconDrawables[busy ? "hourglass" : icon]} size={18} />
        <Text style={{ fontSize: 15 }}>{busy ? `${label}…` : label}</Text>
      </Row>
    </Control>
  );
}

export default function UpdateDiagnostics() {
  const updateState = Updates.useUpdates();

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

  // Compose's PullToRefreshBox is told when to show its indicator, where
  // SwiftUI's refreshable awaited the closure — so the flag is held here.
  const [refreshing, setRefreshing] = useState(false);
  // Pull-to-refresh asks the server for a newer update as well as reloading the
  // local logs, and shares the exclusive gate with the Refresh button.
  const pullToRefresh = () => {
    setRefreshing(true);
    events.runExclusive(() => check()).finally(() => setRefreshing(false));
  };

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
    <Host style={styles.host}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={pullToRefresh}
        modifiers={[fillMaxSize(), background(colors.groupedBackground)]}
      >
        <Column
          verticalArrangement={{ spacedBy: Spacing.four }}
          modifiers={[
            fillMaxSize(),
            verticalScroll(),
            padding(Spacing.three, Spacing.three, Spacing.three, Spacing.six),
          ]}
        >
          <Card spacing={Spacing.three}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: Spacing.three }}
              modifiers={[fillMaxWidth()]}
            >
              <Box
                contentAlignment="center"
                modifiers={[size(48, 48), clip(Shapes.RoundedCorner(15)), background(colors.fill)]}
              >
                <Icon
                  source={iconDrawables[status.icon]}
                  size={24}
                  tint={TONE_COLORS[status.tone]}
                />
              </Box>
              <Column verticalArrangement={{ spacedBy: Spacing.half }} modifiers={[weight(1)]}>
                <Text style={{ fontSize: 14, fontWeight: "700" }} color={colors.label}>
                  {status.title}
                </Text>
                <Text style={{ fontSize: 13 }} color={colors.secondaryLabel}>
                  {status.detail}
                </Text>
              </Column>
            </Row>
            {/* Only while downloading; otherwise it reserves empty space. */}
            {updateState.isDownloading ? (
              <LinearProgressIndicator
                progress={updateState.downloadProgress ?? 0}
                color={colors.systemBlue}
                modifiers={[fillMaxWidth()]}
              />
            ) : null}
          </Card>

          <Section>
            <SectionHeader>UPDATE SYSTEM</SectionHeader>
            <Card>
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
            </Card>
          </Section>

          <Section>
            <SectionHeader>KNOWN UPDATES</SectionHeader>
            <Column verticalArrangement={{ spacedBy: Spacing.two }} modifiers={[fillMaxWidth()]}>
              {updateEntries.map((entry) => (
                <KnownUpdateCard key={`${entry.state}-${entry.id}`} entry={entry} />
              ))}
            </Column>
            <SectionFooter>
              This is the actionable update state Expo exposes: what is running, what is ready on
              this device, and what the server has offered. Older downloaded updates are managed
              internally and are not enumerable from app code.
            </SectionFooter>
          </Section>

          <Section>
            <SectionHeader>CONTROLS</SectionHeader>
            <Column verticalArrangement={{ spacedBy: Spacing.two }} modifiers={[fillMaxWidth()]}>
              <ActionButton
                busy={activeAction === "check" || updateState.isChecking}
                disabled={!Updates.isEnabled || busy}
                icon="refresh"
                label="Check Now"
                onPress={check}
                primary
              />
              <ActionButton
                busy={activeAction === "download" || updateState.isDownloading}
                disabled={!Updates.isEnabled || busy || !updateState.isUpdateAvailable}
                icon="download"
                label="Download Update"
                onPress={download}
              />
              <ActionButton
                busy={activeAction === "reload" || updateState.isRestarting}
                disabled={!Updates.isEnabled || busy}
                icon="restart"
                label={updateState.isUpdatePending ? "Reload Into Update" : "Reload App"}
                onPress={reload}
              />
            </Column>
          </Section>

          {/* Always rendered, so a result appearing below the controls never
              shifts the layout. */}
          <Card>
            <Text
              style={{ fontSize: 13 }}
              color={
                resultText
                  ? resultIsError
                    ? colors.systemOrange
                    : colors.systemGreen
                  : colors.tertiaryLabel
              }
              minLines={2}
            >
              {resultText ?? "Results from the controls above will appear here."}
            </Text>
          </Card>

          <Section>
            <Row
              verticalAlignment="center"
              modifiers={[fillMaxWidth(), padding(Spacing.two, 0, Spacing.two, 0)]}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "500", letterSpacing: 0.5 }}
                color={colors.secondaryLabel}
                modifiers={[weight(1)]}
              >
                UPDATE ACTIVITY
              </Text>
              <TextButton onClick={() => { events.refreshEventLists(); }}>
                <Text style={{ fontSize: 14 }}>Refresh</Text>
              </TextButton>
            </Row>
            <Card spacing={Spacing.two}>
              {events.activity.length === 0 ? (
                <Text style={{ fontSize: 13 }} color={colors.secondaryLabel}>
                  Activity tracking starts with this version. The current launch will appear here
                  after Refresh.
                </Text>
              ) : (
                events.activity.map((entry, index) => (
                  <Column key={entry.id} modifiers={[fillMaxWidth()]}>
                    <ActivityRow entry={entry} />
                    {index < events.activity.length - 1 ? (
                      <HorizontalDivider color={colors.separator} />
                    ) : null}
                  </Column>
                ))
              )}
            </Card>
            <SectionFooter>
              {`Update checks, downloads, and reloads recorded by Lexy on this device. The ${MAX_VISIBLE_EVENTS} most recent events are shown.`}
            </SectionFooter>
          </Section>

          <Section>
            <SectionHeader>NATIVE UPDATE LOG</SectionHeader>
            <Card spacing={Spacing.two}>
              {events.logs.length === 0 ? (
                <Text style={{ fontSize: 13 }} color={colors.secondaryLabel}>
                  No native Expo Updates entries were recorded in the last 24 hours.
                </Text>
              ) : (
                events.logs.map((entry, index) => (
                  <Column
                    key={`${entry.timestamp}-${entry.code}-${entry.message}`}
                    modifiers={[fillMaxWidth()]}
                  >
                    <NativeLogRow entry={entry} />
                    {index < events.logs.length - 1 ? (
                      <HorizontalDivider color={colors.separator} />
                    ) : null}
                  </Column>
                ))
              )}
            </Card>
            <SectionFooter>
              {`The ${MAX_VISIBLE_EVENTS} most recent low-level Expo Updates entries from the last 24 hours. Entries are summarized; tap one to inspect its raw message and identifiers.`}
            </SectionFooter>
          </Section>
        </Column>
      </PullToRefreshBox>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
