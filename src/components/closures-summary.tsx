import { HStack, Host, Image, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  redacted as redactedModifier,
  unredacted,
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

// Point size per symbol, where the default reads wrong. SF Symbols differ
// enough in how much of their point size they actually occupy that one number
// cannot serve them all: at 12pt the hood is 19.3pt wide and 12.0pt tall, while
// the trunk — which looks like it should be the wider of the two — is 13.3 by
// 11.0. Sizing them identically is what makes them look mismatched.
//
// So each is set to land at a similar drawn size, subject to the 22pt slot
// below. Width is the binding constraint for the landscape glyphs (the hood at
// 13pt is already 21.7pt wide and would spill into the text), which is why
// those stay small; the compact ones can afford more. Measured against the iOS
// 26 SDK — re-measure rather than guess when adding a symbol here.
const SYMBOL_POINT_SIZE: Partial<Record<SFSymbol, number>> = {
  "car.window.left": 12,
  "car.window.right": 12,
  "engine.combustion.fill": 12,
  // Compact, not wide: 17.3 x 14.0 at this size, which reads level with the
  // moon beside it instead of half its height.
  "car.side.rear.crop.trunk.partition.fill": 15,
  // A filled disc is dense for its size, so it needs less of it: 15.0 square.
  "moon.fill": 13,
};

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <HStack spacing={Spacing.one}>
      <Image
        systemName={status.symbol}
        size={SYMBOL_POINT_SIZE[status.symbol] ?? 15}
        color={TONE_COLORS[status.tone]}
        // SF Symbols vary in intrinsic width (a lock is narrow, a window
        // wide); a fixed slot keeps the texts of stacked lines aligned. It is
        // also what makes the sizes above safe to change: the text starts at
        // the same x whatever the glyph does, as long as the glyph stays
        // inside the slot. Nothing here is tall enough to drive the row's
        // height either — the subheadline's line box is.
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
                      of the same color keeps the icon the loudest element.
                      While redacted the badge is exempted from the redaction
                      it sits under — placeholder redaction masks an image into
                      a rounded rect in its own color, which turned the circle
                      into a tinted square — and drawn as the neutral fill
                      circle the RN `Icon` uses, so the skeleton keeps the
                      badge's shape without claiming a verdict. */}
                  <Image
                    systemName="circle.fill"
                    size={36}
                    color={redacted ? colors.fill : badgeTint}
                    modifiers={redacted ? [unredacted()] : [opacity(0.15)]}
                  />
                  {/* No glyph inside it: the symbol is the verdict. */}
                  {redacted ? null : (
                    <Image systemName={summary.symbol} size={18} color={badgeTint} />
                  )}
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
//
// `at` and `now` arrive already resolved, from the screen's single clock (see
// useNow), so this line and the sync lines in the footer are measured from the
// same instant — the reading named here is genuinely older than the snapshot
// named there, and the numbers have to bear that out rather than drift apart
// because they were computed on different renders.
export function StaleNote({ at, now }: { at: number; now: number }) {
  return (
    <View style={styles.staleNote}>
      <Icon name="clock.arrow.circlepath" size={12} tint={colors.secondaryLabel} />
      <ThemedText type="small" themeColor="secondaryLabel" style={styles.staleText}>
        Some readings as of {relativeTime(at, now)}
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
