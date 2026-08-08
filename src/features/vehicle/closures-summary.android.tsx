import { StyleSheet, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { Icon } from "@/components/ui/icon";
import { useRedacted } from "@/components/ui/redactable";
import { ThemedText } from "@/components/ui/themed-text";
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

/**
 * The glyph size every closure reading wears. Material draws its icons to a
 * uniform em box, so one number serves the padlocks, the windows, the moon and
 * the engine alike — where iOS has to nudge each SF Symbol individually.
 */
const STATUS_ICON_SIZE = 15;

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <View style={styles.statusLine}>
      {/* The glyph is the reading — a closed padlock in green says "locked" on
          its own — so while redacted it gives way to a neutral dot, which the
          Android `Icon` already does for any glyph inside a redacted tree. The
          fixed slot keeps stacked lines' text aligned whatever the glyph. */}
      <View style={styles.statusGlyph}>
        <Icon name={status.symbol} size={STATUS_ICON_SIZE} tint={TONE_COLORS[status.tone]} />
      </View>
      <ThemedText type="small" style={styles.statusText}>
        {status.text}
      </ThemedText>
    </View>
  );
}

// A corner's readings under its name — one cell of the detail grid.
function CornerCell({ corner }: { corner: Corner }) {
  const { showDoor, showWindow } = cornerVisibility(corner);
  return (
    <View style={styles.cornerCell}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {corner.title}
      </ThemedText>
      {showDoor ? <StatusLine status={doorStatus(corner.door!)} /> : null}
      {showWindow ? <StatusLine status={windowStatus(corner.window!, corner.side)} /> : null}
    </View>
  );
}

/**
 * The Doors & Windows card: a one-line, fixed-height verdict ("All secure",
 * "Trunk open", "2 open, 1 unlocked") with the full per-corner detail one tap
 * away. The expansion is the shared `ExpandableCard`; the verdict logic lives
 * in closure-summary.ts, so both platforms lead with the same sentence.
 */
export function ClosuresCard({ corners, openings }: { corners: Corner[]; openings: Closure[] }) {
  const redacted = useRedacted();

  const summary = closuresSummary(corners, openings);
  const rows = (["front", "rear"] as Row[])
    .map((row) => corners.filter((corner) => corner.row === row))
    .filter((row) => row.length > 0);

  return (
    <ExpandableCard
      accessibilityHint="Shows each door and window"
      disabled={redacted}
      detailStyle={styles.detailContent}
      header={
        // A fixed height regardless of state, so the card never shifts its
        // collapsed size and the skeleton matches it — the subline is optional
        // and the headline is one line either way.
        <View style={styles.header}>
          <Badge symbol={summary.symbol} tint={KIND_COLORS[summary.kind]} redacted={redacted} />
          <View style={styles.headerText}>
            <ThemedText style={styles.headline} numberOfLines={1}>
              {summary.headline}
            </ThemedText>
            {summary.subline ? (
              <ThemedText type="small" themeColor="secondaryLabel" numberOfLines={1}>
                {summary.subline}
              </ThemedText>
            ) : null}
          </View>
        </View>
      }
    >
      {/* The detail breathes on the card itself — the corner titles carry the
          grouping, so no surface or border boxes the grid in. */}
      <View style={styles.detail}>
        {rows.map((rowCorners) => (
          <View key={rowCorners[0].row} style={styles.cornerRow}>
            {rowCorners.map((corner) => (
              <CornerCell key={corner.key} corner={corner} />
            ))}
          </View>
        ))}
        {openings.length > 0 ? (
          <View style={styles.openings}>
            {openings.map((opening) => (
              <StatusLine key={opening.label} status={openingStatus(opening)} />
            ))}
          </View>
        ) : null}
      </View>
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
      <Icon name="history" size={12} tint={colors.secondaryLabel} />
      <ThemedText type="small" themeColor="secondaryLabel" style={styles.staleText}>
        Some readings as of {relativeTime(at, now)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three - Spacing.one,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  headline: {
    fontWeight: "600",
  },
  // The grid wants a little air under the header the controls grid does not.
  detailContent: {
    paddingTop: Spacing.half,
  },
  detail: {
    gap: Spacing.three,
  },
  cornerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.three,
  },
  cornerCell: {
    flex: 1,
    // The same line rhythm as the openings list below the grid.
    gap: Spacing.two,
  },
  openings: {
    gap: Spacing.two,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  // A fixed slot, so stacked lines' text aligns whatever glyph precedes it.
  statusGlyph: {
    width: 22,
    alignItems: "center",
  },
  // Shrinks rather than pushing its column wider: two corner cells share the
  // card's width, and "Rear passenger" over "Window closed" is a tight fit.
  statusText: {
    flexShrink: 1,
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
