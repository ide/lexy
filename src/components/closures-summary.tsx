import { HStack, Host, Image, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  redacted as redactedModifier,
} from "@expo/ui/swift-ui/modifiers";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { Card } from "@/components/card";
import { Icon } from "@/components/icon";
import { useRedacted } from "@/components/redactable";
import { ThemedText } from "@/components/themed-text";
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
import type { Corner, Row } from "@/data/closures";
import { relativeTime, type Closure } from "@/data/vehicle";

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

const EXPAND_TIMING = { duration: 300, easing: Easing.inOut(Easing.ease) };

// Wide, landscape glyphs (window, hood, trunk) drawn at the same point size as
// the portrait lock read much larger; a smaller point size brings their widths
// in line with the lock's.
const WIDE_SYMBOL_SIZE: Partial<Record<SFSymbol, number>> = {
  "car.window.left": 12,
  "car.window.right": 12,
  "engine.combustion.fill": 12,
  "car.side.rear.crop.trunk.partition.fill": 12,
};

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <HStack spacing={Spacing.one}>
      <Image
        systemName={status.symbol}
        size={WIDE_SYMBOL_SIZE[status.symbol] ?? 15}
        color={TONE_COLORS[status.tone]}
        // SF Symbols vary in intrinsic width (a lock is narrow, a window
        // wide); a fixed slot keeps the texts of stacked lines aligned.
        modifiers={[frame({ width: 22 })]}
      />
      <Text modifiers={[font({ textStyle: "subheadline" }), foregroundStyle(colors.label)]}>
        {status.text}
      </Text>
    </HStack>
  );
}

// A corner's readings under its name — one cell of the detail grid.
function CornerCell({ corner }: { corner: Corner }) {
  const { showDoor, showWindow } = cornerVisibility(corner);
  return (
    <VStack
      alignment="leading"
      // The same line rhythm as the openings list below the grid.
      spacing={Spacing.two}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text
        // The RN theme's smallBold heading (14pt bold, secondary), as worn by
        // the odometer and tire cards' headings.
        modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle(colors.secondaryLabel)]}
      >
        {corner.title}
      </Text>
      {showDoor ? <StatusLine status={doorStatus(corner.door!)} /> : null}
      {showWindow ? <StatusLine status={windowStatus(corner.window!, corner.side)} /> : null}
    </VStack>
  );
}

/**
 * The Doors & Windows card: a one-line, fixed-height verdict ("All secure",
 * "Trunk open", "2 open, 1 unlocked") with the full per-corner detail one tap
 * away. The content is SwiftUI; the expansion is a Reanimated height clip,
 * because a SwiftUI animation cannot span the host boundary — the RN side
 * snaps to the new size instead of growing (verified on-device), so the
 * UI-thread clip is what makes the card visibly grow and shrink. The verdict
 * logic lives in closure-summary.ts.
 */
export function ClosuresCard({ corners, openings }: { corners: Corner[]; openings: Closure[] }) {
  const redacted = useRedacted();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  // The detail's natural height, measured from its always-rendered (but
  // clipped) content so the first expansion already knows where to land.
  const measuredDetail = useRef(0);
  const detailHeight = useSharedValue(0);
  const rotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const clipStyle = useAnimatedStyle(() => ({ height: detailHeight.value }));

  const toggle = () => {
    const next = !expanded;
    expandedRef.current = next;
    setExpanded(next);
    rotation.value = withTiming(next ? 90 : 0, EXPAND_TIMING);
    detailHeight.value = withTiming(next ? measuredDetail.current : 0, EXPAND_TIMING);
  };

  const summary = closuresSummary(corners, openings);
  const badgeTint = KIND_COLORS[summary.kind];
  const rows = (["front", "rear"] as Row[])
    .map((row) => corners.filter((corner) => corner.row === row))
    .filter((row) => row.length > 0);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Shows each door and window"
        disabled={redacted}
        onPress={toggle}
      >
        {({ pressed }) => (
          <View style={[styles.header, pressed && styles.pressed]}>
            {/* The SwiftUI host would swallow the tap before the Pressable
                sees it; the header content is purely presentational. */}
            <Host matchContents={{ vertical: true }} style={styles.headerHost} pointerEvents="none">
              <HStack
                spacing={Spacing.three - Spacing.one}
                modifiers={[
                  // A fixed height regardless of state, so the card never
                  // shifts its collapsed size and the skeleton matches it.
                  // Two frame calls: expo-ui's frame modifier drops maxWidth
                  // when height is set, which left the row floating centered.
                  frame({ height: 44 }),
                  frame({ maxWidth: Infinity, alignment: "leading" }),
                  ...(redacted ? [redactedModifier(), disabledModifier(true)] : []),
                ]}
              >
                <ZStack>
                  {/* The tint at full strength would shout; a translucent wash
                      of the same color keeps the icon the loudest element. */}
                  <Image
                    systemName="circle.fill"
                    size={36}
                    color={badgeTint}
                    modifiers={[opacity(0.15)]}
                  />
                  <Image systemName={summary.symbol} size={18} color={badgeTint} />
                </ZStack>
                <VStack alignment="leading" spacing={Spacing.half}>
                  <Text
                    modifiers={[
                      font({ textStyle: "body", weight: "semibold" }),
                      foregroundStyle(colors.label),
                      lineLimit(1),
                    ]}
                  >
                    {summary.headline}
                  </Text>
                  {summary.subline ? (
                    <Text
                      modifiers={[
                        font({ textStyle: "footnote" }),
                        foregroundStyle(colors.secondaryLabel),
                        lineLimit(1),
                      ]}
                    >
                      {summary.subline}
                    </Text>
                  ) : null}
                </VStack>
              </HStack>
            </Host>
            <Animated.View style={chevronStyle}>
              <Icon name="chevron.right" size={14} tint={colors.secondaryLabel} />
            </Animated.View>
          </View>
        )}
      </Pressable>

      <Animated.View style={[styles.detailClip, clipStyle]}>
        <View
          style={styles.detailContent}
          onLayout={(event) => {
            measuredDetail.current = event.nativeEvent.layout.height;
            // A data refresh can reflow the open detail; track it unanimated.
            if (expandedRef.current) {
              detailHeight.value = event.nativeEvent.layout.height;
            }
          }}
        >
          {/* The detail breathes on the card itself — the corner titles carry
              the grouping, so no surface or border boxes the grid in. */}
          <Host matchContents={{ vertical: true }} pointerEvents="none">
            <VStack
              alignment="leading"
              spacing={Spacing.three}
              modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
            >
              {rows.map((rowCorners) => (
                <HStack
                  key={rowCorners[0].row}
                  alignment="top"
                  spacing={Spacing.three}
                  modifiers={[frame({ maxWidth: Infinity })]}
                >
                  {rowCorners.map((corner) => (
                    <CornerCell key={corner.key} corner={corner} />
                  ))}
                </HStack>
              ))}
              {openings.length > 0 ? (
                <VStack alignment="leading" spacing={Spacing.two}>
                  {openings.map((opening) => (
                    <StatusLine key={opening.label} status={openingStatus(opening)} />
                  ))}
                </VStack>
              ) : null}
            </VStack>
          </Host>
        </View>
      </Animated.View>
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  headerHost: {
    flex: 1,
  },
  detailClip: {
    overflow: "hidden",
  },
  // Rendered (and measured) at natural size even while the clip is closed.
  detailContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.half,
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
