import { Fragment, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";

/**
 * The two-column card grid used by the closures and openings sections.
 * Callers decide the split (by side or by parity); this owns the shared
 * column layout so the grids cannot drift.
 */
export function TwoColumnGrid<T>({
  left,
  right,
  keyFor,
  renderItem,
}: {
  left: T[];
  right: T[];
  keyFor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <View style={styles.grid}>
      <View style={styles.gridColumn}>
        {left.map((item) => (
          <Fragment key={keyFor(item)}>{renderItem(item)}</Fragment>
        ))}
      </View>
      <View style={styles.gridColumn}>
        {right.map((item) => (
          <Fragment key={keyFor(item)}>{renderItem(item)}</Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  gridColumn: {
    flex: 1,
    gap: Spacing.two,
  },
});
