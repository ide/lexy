import { DisclosureGroup, HStack, Host, Image, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  contentShape,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  opacity,
  padding,
  redacted as redactedModifier,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

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

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <HStack spacing={Spacing.one}>
      <Image systemName={status.symbol} size={15} color={TONE_COLORS[status.tone]} />
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
      spacing={Spacing.half}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text
        modifiers={[
          font({ textStyle: "footnote", weight: "semibold" }),
          foregroundStyle(colors.secondaryLabel),
        ]}
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
 * "Trunk open", "2 open, 1 unlocked") with the full per-corner detail behind a
 * native SwiftUI disclosure, which animates the expansion itself. The verdict
 * logic lives in closure-summary.ts.
 */
export function ClosuresCard({ corners, openings }: { corners: Corner[]; openings: Closure[] }) {
  const redacted = useRedacted();
  const summary = closuresSummary(corners, openings);
  const badgeTint = KIND_COLORS[summary.kind];
  const rows = (["front", "rear"] as Row[])
    .map((row) => corners.filter((corner) => corner.row === row))
    .filter((row) => row.length > 0);

  return (
    <Host matchContents>
      <DisclosureGroup
        isExpanded={false}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          padding({ horizontal: Spacing.three, vertical: Spacing.two + Spacing.one }),
          background(
            colors.card,
            shapes.roundedRectangle({ cornerRadius: 18, roundedCornerStyle: "continuous" }),
          ),
          // The disclosure indicator inherits the accent color otherwise.
          tint(colors.secondaryLabel),
          // While loading, the placeholder skeletonizes at the same fixed
          // height and the disclosure cannot be opened onto placeholder data.
          ...(redacted ? [redactedModifier(), disabledModifier(true)] : []),
        ]}
      >
        <DisclosureGroup.Label>
          <HStack
            spacing={Spacing.three - Spacing.one}
            modifiers={[
              // A fixed height regardless of state, so the card never shifts
              // its collapsed size and the loading skeleton matches exactly.
              frame({ maxWidth: Infinity, height: 44, alignment: "leading" }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <ZStack>
              {/* The tint at full strength would shout; a translucent wash of
                  the same color keeps the icon the loudest element. */}
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
        </DisclosureGroup.Label>

        <VStack
          alignment="leading"
          spacing={Spacing.two}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "leading" }),
            padding({ top: Spacing.one }),
          ]}
        >
          {rows.length > 0 ? (
            // One quiet surface for all four corners, keeping the spatial
            // driver/passenger × front/rear arrangement.
            <VStack
              alignment="leading"
              spacing={Spacing.three}
              modifiers={[
                frame({ maxWidth: Infinity, alignment: "leading" }),
                padding({ all: Spacing.three - Spacing.one }),
                background(
                  colors.subtleFill,
                  shapes.roundedRectangle({ cornerRadius: 12, roundedCornerStyle: "continuous" }),
                ),
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
            </VStack>
          ) : null}
          {openings.map((opening) => (
            <StatusLine key={opening.label} status={openingStatus(opening)} />
          ))}
        </VStack>
      </DisclosureGroup>
    </Host>
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
