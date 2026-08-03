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
import { StyleSheet, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { ExpandableCard } from "@/components/expandable-card";
import { Icon } from "@/components/icon";
import { PLACEHOLDER_TEXT, useRedacted } from "@/components/redactable";
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
import { relativeTime } from "@/data/time";
import type { Closure } from "@/data/vehicle";

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

// Point size per symbol, where the default reads wrong. SF Symbols occupy
// different fractions of their point size — at 12pt the hood is 19.3 x 12.0
// while the trunk is 13.3 x 11.0 — so one number cannot serve them all. Each is
// set to land at a similar drawn size within the 22pt slot below; width is the
// binding constraint for the landscape glyphs, which is why those stay small.
// Measured against the iOS 26 SDK — re-measure rather than guess when adding
// a symbol here.
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
  const isRedacted = useRedacted();
  return (
    <HStack spacing={Spacing.one}>
      {/* The glyph is the reading — a closed padlock in green says "locked" on
          its own — so while redacted it gives way to a neutral dot. It is
          exempt from the surrounding redaction because placeholder redaction
          masks an image into a rounded rect in its own color, which would claim
          a verdict in green or orange without looking like an icon. */}
      <Image
        systemName={isRedacted ? "circle.fill" : status.symbol}
        size={isRedacted ? 13 : (SYMBOL_POINT_SIZE[status.symbol] ?? 15)}
        color={isRedacted ? colors.fill : TONE_COLORS[status.tone]}
        // SF Symbols vary in intrinsic width (a lock is narrow, a window
        // wide); a fixed slot keeps stacked lines' text aligned, and is what
        // makes the sizes above safe to change. Nothing here is tall enough to
        // drive the row height — the subheadline's line box is.
        modifiers={[frame({ width: 22 }), ...(isRedacted ? [unredacted()] : [])]}
      />
      {/* Redacts to a bar of its own width and color — hence the placeholder
          closures keeping the shape of real ones, and the lighter tone. */}
      <Text
        modifiers={[
          font({ textStyle: "subheadline" }),
          foregroundStyle(isRedacted ? PLACEHOLDER_TEXT : colors.label),
        ]}
      >
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
 * away. The content is SwiftUI; the expansion is the shared `ExpandableCard`,
 * because a SwiftUI animation cannot span the host boundary. The verdict logic
 * lives in closure-summary.ts.
 */
export function ClosuresCard({ corners, openings }: { corners: Corner[]; openings: Closure[] }) {
  const redacted = useRedacted();

  const summary = closuresSummary(corners, openings);
  const badgeTint = KIND_COLORS[summary.kind];
  const rows = (["front", "rear"] as Row[])
    .map((row) => corners.filter((corner) => corner.row === row))
    .filter((row) => row.length > 0);

  return (
    <ExpandableCard
      accessibilityHint="Shows each door and window"
      disabled={redacted}
      detailStyle={styles.detailContent}
      header={
        <Host matchContents={{ vertical: true }} style={styles.headerHost} pointerEvents="none">
          <HStack
            spacing={Spacing.three - Spacing.one}
            modifiers={[
              // A fixed height regardless of state, so the card never shifts
              // its collapsed size and the skeleton matches it. Two frame
              // calls: expo-ui's frame modifier drops maxWidth when height is
              // set, leaving the row centered.
              frame({ height: 44 }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
              ...(redacted ? [redactedModifier(), disabledModifier(true)] : []),
            ]}
          >
            <ZStack>
              {/* A translucent wash rather than the tint at full strength, so
                  the icon stays the loudest element. Redacted, the badge opts
                  out and draws as a neutral fill circle: placeholder redaction
                  masks an image into a rounded rect in its own color, which
                  squares the circle off and claims a verdict. */}
              <Image
                systemName="circle.fill"
                size={36}
                color={redacted ? colors.fill : badgeTint}
                modifiers={redacted ? [unredacted()] : [opacity(0.15)]}
              />
              {/* No glyph inside it: the symbol is the verdict. */}
              {redacted ? null : <Image systemName={summary.symbol} size={18} color={badgeTint} />}
            </ZStack>
            <VStack alignment="leading" spacing={Spacing.half}>
              <Text
                modifiers={[
                  font({ textStyle: "body", weight: "semibold" }),
                  // Semibold body in the primary color is the heaviest text
                  // on the card, so its placeholder was the heaviest bar.
                  foregroundStyle(redacted ? PLACEHOLDER_TEXT : colors.label),
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
      }
    >
      {/* The detail breathes on the card itself — the corner titles carry the
          grouping, so no surface or border boxes the grid in. */}
      <Host matchContents={{ vertical: true }} pointerEvents="none">
        <VStack
          alignment="leading"
          spacing={Spacing.three}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            // SwiftUI redaction does not cross the host boundary, so a card
            // left open when the data goes away needs its own or it draws
            // every door and window state live against a screen of skeleton
            // bars. This reaches the corner titles and status text; the glyphs
            // opt back out individually (see StatusLine).
            ...(redacted ? [redactedModifier()] : []),
          ]}
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
    </ExpandableCard>
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
  headerHost: {
    flex: 1,
  },
  // The grid wants a little air under the header the controls grid does not.
  detailContent: {
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
