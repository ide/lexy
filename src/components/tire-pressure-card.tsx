import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import type { TirePressure } from "@/data/vehicle";

type TireReading = TirePressure["positions"][number];

function TireCorner({ tire, unit }: { tire: TireReading | undefined; unit: string }) {
  if (!tire) {
    return <View style={styles.corner} />;
  }
  return (
    <View style={styles.corner}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {tire.label}
      </ThemedText>
      {/* The unit rides inside the value's text run so the two share a
          baseline instead of needing a manually offset row. */}
      <ThemedText style={[styles.value, tire.low && { color: colors.systemOrange }]}>
        {tire.value}
        <ThemedText type="small" themeColor="secondaryLabel">
          {" "}
          {unit}
        </ThemedText>
      </ThemedText>
    </View>
  );
}

/**
 * All four tire readings in one card, laid out like the car itself: front row
 * on top, left readings in the left column. The columns cluster around the
 * card's center line — close enough to compare at a glance — and the readings
 * stay at label scale so the card reads as one quiet instrument.
 */
export function TirePressureCard({ tires }: { tires: TirePressure }) {
  const corner = (front: boolean, left: boolean) =>
    tires.positions.find((t) => /front/i.test(t.label) === front && /left/i.test(t.label) === left);
  return (
    <Card style={styles.card}>
      {[true, false].map((front) => (
        <View key={front ? "front" : "rear"} style={styles.axle}>
          <TireCorner tire={corner(front, true)} unit={tires.unit} />
          <TireCorner tire={corner(front, false)} unit={tires.unit} />
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
    justifyContent: "center",
    gap: Spacing.five,
  },
  // Equal fixed-share columns so the rows align vertically; both columns are
  // left-aligned for scanning, with the shared center gutter carrying the
  // left/right split.
  corner: {
    width: "40%",
    gap: Spacing.half,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
});
