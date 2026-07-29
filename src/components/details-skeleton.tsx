import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Spacing, colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Loading placeholder for the Details screen. Rendered as the children of the
 * same `NativeScrollView` the populated screen uses (not its own scroll
 * container), so toggling between skeleton and data reconciles in place and the
 * scroll offset is preserved instead of snapping back to the top.
 *
 * It mirrors the real Details layout — grouped cards of label/value rows plus
 * the capabilities grid — with neutral fill blocks and a shared opacity pulse,
 * matching the Status skeleton's treatment. Row and card metrics track the real
 * styles (16pt padding, 20pt text line-height) so nothing resizes on load.
 */

function Block({
  width = "100%",
  height,
  radius = 8,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
}) {
  return (
    <View
      style={{ width, height, borderRadius: radius, backgroundColor: colors.fill }}
    />
  );
}

function Row({ last }: { last?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
      ]}
    >
      <Block width="30%" height={20} />
      <Block width="42%" height={20} />
    </View>
  );
}

function SectionTitleBar({ width }: { width: number }) {
  return (
    <View style={styles.sectionTitle}>
      <Block width={width} height={16} />
    </View>
  );
}

function Section({
  titleWidth,
  rows,
}: {
  titleWidth: number;
  rows: number;
}) {
  const theme = useTheme();
  return (
    <View>
      <SectionTitleBar width={titleWidth} />
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {Array.from({ length: rows }).map((_, i) => (
          <Row key={i} last={i === rows - 1} />
        ))}
      </View>
    </View>
  );
}

function CapabilitySection() {
  const theme = useTheme();
  return (
    <View>
      <SectionTitleBar width={170} />
      <View style={[styles.card, styles.grid, { backgroundColor: theme.card }]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={styles.capability}>
            <Block width={22} height={22} radius={11} />
            <Block width="60%" height={16} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function DetailsSkeleton() {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[styles.group, animatedStyle]}>
      <Section titleWidth={80} rows={8} />
      <CapabilitySection />
      <Section titleWidth={50} rows={2} />
      <Section titleWidth={160} rows={2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.three,
  },
  // Matches the real screen's `sectionTitle` insets so the placeholder header
  // bar sits where the real "VEHICLE" / "TRIPS" labels do.
  sectionTitle: {
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
  },
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  capability: {
    width: "43%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
});
