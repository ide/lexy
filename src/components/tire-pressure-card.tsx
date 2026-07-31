import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { TirePressure } from "@/data/vehicle";

type TireReading = TirePressure["positions"][number];

function TireCorner({
  tire,
  unit,
  side,
}: {
  tire: TireReading | undefined;
  unit: string;
  side: "left" | "right";
}) {
  if (!tire) {
    return <View style={styles.corner} />;
  }
  return (
    <View style={[styles.corner, side === "right" && styles.cornerRight]}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {tire.label}
      </ThemedText>
      <View style={styles.valueRow}>
        <ThemedText style={[styles.value, tire.low && { color: colors.systemOrange }]}>
          {tire.value}
        </ThemedText>
        <ThemedText type="small" themeColor="secondaryLabel" style={styles.unit}>
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * All four tire readings in one card, laid out like the car itself: front row
 * on top, left and right readings aligned to their edges. One surface instead
 * of four keeps the spatial map while staying quiet next to the odometer card,
 * whose typography the readings share.
 */
export function TirePressureCard({ tires }: { tires: TirePressure }) {
  const corner = (front: boolean, left: boolean) =>
    tires.positions.find((t) => /front/i.test(t.label) === front && /left/i.test(t.label) === left);
  return (
    <Card style={styles.card}>
      {[true, false].map((front) => (
        <View key={front ? "front" : "rear"} style={styles.axle}>
          <TireCorner tire={corner(front, true)} unit={tires.unit} side="left" />
          <TireCorner tire={corner(front, false)} unit={tires.unit} side="right" />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  axle: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  corner: {
    gap: Spacing.one,
  },
  cornerRight: {
    alignItems: "flex-end",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  value: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    marginBottom: 2,
  },
});
