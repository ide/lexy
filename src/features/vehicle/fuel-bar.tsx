import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useRedacted } from "@/components/ui/redactable";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { FuelGauge, FuelLevel } from "@/data/fuel";
import type { DistanceUnit } from "@/data/vehicle";

// Readout tint by level: green rewards a full tank, a healthy level stays
// neutral, and the warning colors escalate as it drains.
const FUEL_COLORS: Record<FuelLevel, string> = {
  full: colors.systemGreen,
  high: colors.label,
  medium: colors.systemYellow,
  low: colors.systemOrange,
  critical: colors.systemRed,
};

// The bar (and icon) stay green at any healthy level — only the warning
// tiers recolor them. The neutral tint above is just for the text readout.
const FUEL_BAR_COLORS: Record<FuelLevel, string> = {
  ...FUEL_COLORS,
  high: colors.systemGreen,
};

// The fuel/charge level as a bar divided into quarters, mirroring the car's
// dashboard, with the precise reading and range beside it ("62% · 277 mi",
// "Full" at 100%). Range is the actionable half of the fuel story, so only
// the level takes the gauge color.
export function FuelBar({
  gauge,
  range,
  unit,
}: {
  gauge: FuelGauge;
  range: number;
  unit: DistanceUnit;
}) {
  // The segment fills are plain colored views rather than text or icons, so
  // redaction has to reach them explicitly: filling them with the track color
  // leaves the gauge as its own empty tracks instead of a placeholder screen
  // reporting a confident full tank.
  const isRedacted = useRedacted();
  const barColor = isRedacted ? colors.fill : FUEL_BAR_COLORS[gauge.level];
  const valueColor = FUEL_COLORS[gauge.level];
  const rangeText = `${range.toLocaleString()} ${unit}`;
  return (
    <Card style={styles.fuelCard}>
      <View style={styles.fuelHeader}>
        <View style={styles.fuelLabel}>
          <Icon name={gauge.symbol} size={17} tint={barColor} />
          <ThemedText type="smallBold" themeColor="secondaryLabel">
            {gauge.label}
          </ThemedText>
        </View>
        <View style={styles.fuelValueRow}>
          <ThemedText type="smallBold" style={[styles.tabularNums, { color: valueColor }]}>
            {gauge.valueText}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.tabularNums}>
            {` · ${rangeText}`}
          </ThemedText>
        </View>
      </View>
      <View style={styles.fuelSegments}>
        {gauge.fills.map((fill, i) => (
          <View key={`segment-${i}`} style={styles.fuelSegmentTrack}>
            <View
              style={[
                styles.fuelSegmentFill,
                { width: `${fill * 100}%`, backgroundColor: barColor },
              ]}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fuelCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  fuelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fuelLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  fuelValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fuelSegments: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  fuelSegmentTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  fuelSegmentFill: {
    height: "100%",
    borderRadius: 4,
  },
  tabularNums: {
    fontVariant: ["tabular-nums"],
  },
});
