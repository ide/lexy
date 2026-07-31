import { StyleSheet, View } from "react-native";

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
import type { Corner } from "@/data/closures";
import { relativeTime, type Closure } from "@/data/vehicle";

// "attention" draws the warning orange, "settled" the reassuring green.
const TONE_COLORS: Record<ClosureTone, string> = {
  attention: colors.systemOrange,
  settled: colors.systemGreen,
};

function StatusLine({ status }: { status: ClosureStatus }) {
  return (
    <View style={styles.statusLine}>
      <Icon name={status.symbol} size={17} tint={TONE_COLORS[status.tone]} />
      <ThemedText type="small">{status.text}</ThemedText>
    </View>
  );
}

function CornerCard({ corner }: { corner: Corner }) {
  const { showDoor, showWindow } = cornerVisibility(corner);
  return (
    <Card style={[styles.cardPadding, styles.cornerCard]}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {corner.title}
      </ThemedText>
      <View style={styles.cornerStates}>
        {showDoor ? <StatusLine status={doorStatus(corner.door!)} /> : null}
        {/* A window with no position reading has nothing to report. */}
        {showWindow ? (
          <StatusLine status={windowStatus(corner.window!, corner.side)} />
        ) : null}
      </View>
    </Card>
  );
}

export function SideGrid({ corners }: { corners: Corner[] }) {
  return (
    <TwoColumnGrid
      left={corners.filter((c) => c.side === "driver")}
      right={corners.filter((c) => c.side === "passenger")}
      keyFor={(c) => c.key}
      renderItem={(c) => <CornerCard corner={c} />}
    />
  );
}

export function OpeningCard({ opening }: { opening: Closure }) {
  return (
    <Card style={[styles.cardPadding, styles.cornerCard]}>
      <StatusLine status={openingStatus(opening)} />
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
  cardPadding: {
    padding: Spacing.three,
  },
  cornerCard: {
    gap: Spacing.one,
  },
  cornerStates: {
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
    marginTop: -Spacing.one,
  },
  staleText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
