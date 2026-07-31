import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Card } from "@/components/card";
import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { TwoColumnGrid } from "@/components/two-column-grid";
import { Spacing, colors } from "@/constants/theme";
import {
  cornerVisibility,
  doorStatus,
  openingStatus,
  windowStatus,
  type ClosureStatus,
  type ClosureTone,
} from "@/data/closure-display";
import { closuresSummary, type ClosuresSummary } from "@/data/closure-summary";
import type { Corner } from "@/data/closures";
import { relativeTime, type Closure } from "@/data/vehicle";
import { haptic } from "@/utils/haptics";

// "attention" draws the warning orange, "settled" the reassuring green.
const TONE_COLORS: Record<ClosureTone, string> = {
  attention: colors.systemOrange,
  settled: colors.systemGreen,
};

// The verdict badge's tint per summary kind; "busy" stays neutral because a
// command in flight is neither reassuring nor alarming.
const KIND_COLORS: Record<ClosuresSummary["kind"], string> = {
  secure: colors.systemGreen,
  attention: colors.systemOrange,
  busy: colors.secondaryLabel,
};

function Badge({ summary }: { summary: ClosuresSummary }) {
  const tint = KIND_COLORS[summary.kind];
  return (
    <View style={styles.badge}>
      {/* The tint at full strength would shout; a translucent wash of the same
          color keeps the icon the loudest element. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.15 }]} />
      <Icon name={summary.symbol} size={20} tint={tint} />
    </View>
  );
}

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <View style={styles.statusLine}>
      <Icon name={status.symbol} size={17} tint={TONE_COLORS[status.tone]} />
      <ThemedText type="small">{status.text}</ThemedText>
    </View>
  );
}

// A corner's tile in the expanded detail: door and window readings under the
// corner's name, on a gentle fill so the grid reads as one card's interior.
function CornerTile({ corner }: { corner: Corner }) {
  const { showDoor, showWindow } = cornerVisibility(corner);
  return (
    <View style={styles.tile}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {corner.title}
      </ThemedText>
      {showDoor ? <StatusLine status={doorStatus(corner.door!)} /> : null}
      {showWindow ? <StatusLine status={windowStatus(corner.window!, corner.side)} /> : null}
    </View>
  );
}

/**
 * The Doors & Windows card: a one-line verdict ("All secure", "Trunk open",
 * "3 need attention") with exceptions as rows, and the full per-corner grid
 * one tap away. The verdict logic lives in closure-summary.ts.
 */
export function ClosuresCard({ corners, openings }: { corners: Corner[]; openings: Closure[] }) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const summary = closuresSummary(corners, openings);
  const toggle = () => {
    haptic("selection");
    rotation.value = withTiming(expanded ? 0 : 90, { duration: 200 });
    setExpanded(!expanded);
  };

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Shows each door and window"
        onPress={toggle}
      >
        {({ pressed }) => (
          <View style={[styles.header, pressed && styles.pressed]}>
            <Badge summary={summary} />
            <View style={styles.headerTexts}>
              <ThemedText style={styles.headline}>{summary.headline}</ThemedText>
              {summary.subline ? (
                <ThemedText type="small" themeColor="secondaryLabel">
                  {summary.subline}
                </ThemedText>
              ) : null}
            </View>
            <Animated.View style={chevronStyle}>
              <Icon name="chevron.right" size={14} tint={colors.secondaryLabel} />
            </Animated.View>
          </View>
        )}
      </Pressable>

      {summary.exceptions.map((exception) => (
        <View key={exception.key} style={styles.exceptionRow}>
          <Icon name={exception.symbol} size={17} tint={colors.systemOrange} />
          <ThemedText type="small">{exception.label}</ThemedText>
          {exception.where ? (
            <ThemedText type="small" themeColor="secondaryLabel" style={styles.exceptionWhere}>
              {exception.where}
            </ThemedText>
          ) : null}
        </View>
      ))}

      {expanded ? (
        <View style={styles.detail}>
          <TwoColumnGrid
            left={corners.filter((c) => c.side === "driver")}
            right={corners.filter((c) => c.side === "passenger")}
            keyFor={(c) => c.key}
            renderItem={(c) => <CornerTile corner={c} />}
          />
          {openings.length > 0 ? (
            // The openings share the corners' two-column rhythm; three tiles
            // across would wrap their labels at phone widths.
            <TwoColumnGrid
              left={openings.filter((_, i) => i % 2 === 0)}
              right={openings.filter((_, i) => i % 2 === 1)}
              keyFor={(o) => o.label}
              renderItem={(o) => (
                <View style={styles.tile}>
                  <StatusLine status={openingStatus(o)} />
                </View>
              )}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// A single muted line shown when some closures are older than the latest
// snapshot (e.g. windows after a drive), so stale state isn't presented as
// current. "Some" because the doors that a lock event refreshed stay current.
export function StaleNote({ at }: { at: string }) {
  return (
    <View style={styles.staleNote}>
      <Icon name="clock.arrow.circlepath" size={12} tint={colors.secondaryLabel} />
      <ThemedText type="small" themeColor="secondaryLabel" style={styles.staleText}>
        Some readings as of {relativeTime(at)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three - Spacing.one,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  headerTexts: {
    flex: 1,
    gap: Spacing.half,
  },
  headline: {
    fontWeight: 600,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  exceptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  exceptionWhere: {
    marginLeft: "auto",
  },
  detail: {
    padding: Spacing.two,
    paddingTop: 0,
    gap: Spacing.two,
  },
  tile: {
    backgroundColor: colors.subtleFill,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: Spacing.two + Spacing.half,
    paddingHorizontal: Spacing.three - Spacing.one,
    gap: Spacing.half,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  staleNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    // Sits inside the section directly under the card, which has no own gap.
    marginTop: Spacing.two,
  },
  staleText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
