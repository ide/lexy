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
 * on top, left readings in the left column. The card shrink-wraps the grid —
 * normal padding, no stretched interior — and sits on the screen's left edge
 * like any other left-aligned content.
 */
export function TirePressureCard({ tires }: { tires: TirePressure }) {
  const corner = (front: boolean, left: boolean) =>
    tires.positions.find((t) => /front/i.test(t.label) === front && /left/i.test(t.label) === left);
  return (
    <Card style={styles.card}>
      <View style={styles.columns}>
        {[true, false].map((left) => (
          <View key={left ? "left" : "right"} style={styles.column}>
            <TireCorner tire={corner(true, left)} unit={tires.unit} />
            <TireCorner tire={corner(false, left)} unit={tires.unit} />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    alignSelf: "flex-start",
  },
  columns: {
    flexDirection: "row",
    gap: Spacing.five,
  },
  column: {
    gap: Spacing.three,
  },
  corner: {
    gap: Spacing.half,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
});
