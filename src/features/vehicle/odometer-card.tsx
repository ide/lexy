import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { DistanceUnit } from "@/data/vehicle";

function TripCell({
  label,
  distance,
  unit,
}: {
  label: string;
  distance: number;
  unit: DistanceUnit;
}) {
  return (
    <View style={styles.tripCell}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.tripValue}>
          {/* Trips arrive with dashboard precision (e.g. 272.1) — keep the
              tenths instead of rounding them away. */}
          {distance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </ThemedText>
        <ThemedText type="small" themeColor="secondaryLabel">
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

// Odometer and trip meters are one instrument cluster in the car, so they share
// one card: lifetime total beside the resettable Trip A/B pair.
export function OdometerCard({
  odometer,
  tripA,
  tripB,
  unit,
}: {
  odometer: number;
  tripA: number;
  tripB: number;
  unit: DistanceUnit;
}) {
  return (
    <Card style={styles.odometerCard}>
      {/* Lifetime total and the two resettable trips share one size; the
          trips sit on a gentle fill so the resettable pair reads as a unit
          apart from the total. */}
      <View style={styles.tripCell}>
        <View style={styles.odometerHeader}>
          <Icon name="odometer" size={17} tint={colors.secondaryLabel} />
          <ThemedText type="smallBold" themeColor="secondaryLabel">
            Total
          </ThemedText>
        </View>
        <View style={styles.metricValueRow}>
          <ThemedText style={styles.tripValue}>{odometer.toLocaleString()}</ThemedText>
          <ThemedText type="small" themeColor="secondaryLabel">
            {unit}
          </ThemedText>
        </View>
      </View>
      <View style={styles.tripsGroup}>
        <TripCell label="Trip A" distance={tripA} unit={unit} />
        <TripCell label="Trip B" distance={tripB} unit={unit} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  odometerCard: {
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  odometerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  // The resettable pair, set apart from the lifetime total by the gentlest
  // system fill. Flexed wider than the odometer column (2:1) so both trips
  // fit inside the inset.
  tripsGroup: {
    flex: 2,
    flexDirection: "row",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: colors.subtleFill,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  tripCell: {
    flex: 1,
    gap: Spacing.one,
  },
  tripValue: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
});
