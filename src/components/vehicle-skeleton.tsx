import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { NativeScrollView } from "@/components/native-scroll-view";
import { OfflineBanner } from "@/components/offline-banner";
import { Spacing, colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Placeholder shown on the Status screen whenever there is no vehicle to draw
 * yet — the first-load fetch, or offline before anything has cached. It mirrors
 * the real dashboard layout (hero, fuel bar, odometer + trips card,
 * doors/windows grid, tire grid, climate row) with neutral fill blocks so the
 * shape is visible immediately
 * rather than a centered spinner.
 *
 * The real cards are React Native views hosted inside @expo/ui's ScrollView, so
 * SwiftUI's `redacted(.placeholder)` can't reach them — this reproduces that
 * effect with a shared opacity pulse instead. When `offline`, an offline banner
 * sits above the pulse (and does not itself pulse) so the same skeleton doubles
 * as the offline empty state instead of a second, separate treatment.
 */

function Block({
  width = "100%",
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.fill },
        style,
      ]}
    />
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }, style]}>
      {children}
    </View>
  );
}

// Block heights below mirror the real Status cards element-for-element so the
// skeleton doesn't resize when data lands: Icon default size (22), the
// metric/tire value line-heights (30 / 28), and the shared 20pt line-height of
// `small`/`smallBold` text. See the matching styles in the Status screen.

// The fuel card: header line (label left, level + range right) over the
// four-segment gauge. The segment tracks are the real card's empty state
// (colors.fill), so they double as their own placeholder.
function FuelCard() {
  return (
    <Card style={styles.fuelCard}>
      <View style={styles.rowBetween}>
        <Block width={64} height={20} />
        <Block width={120} height={20} />
      </View>
      <View style={styles.fuelSegments}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={`segment-${i}`} style={styles.fuelSegment} />
        ))}
      </View>
    </Card>
  );
}

// The combined odometer card: odometer column, then Trip A/B in their own
// bordered sub-group.
function OdometerCard() {
  return (
    <Card style={styles.odometerCard}>
      <View style={styles.tripCell}>
        <Block width={90} height={20} />
        <Block width={72} height={22} />
      </View>
      <View style={styles.tripsGroup}>
        <View style={styles.tripCell}>
          <Block width={48} height={20} />
          <Block width={64} height={22} />
        </View>
        <View style={styles.tripCell}>
          <Block width={48} height={20} />
          <Block width={64} height={22} />
        </View>
      </View>
    </Card>
  );
}

// Label-left / value-right single-row cards (climate setpoint, last parked).
function InlineCard() {
  return (
    <Card style={styles.rowBetween}>
      <Block width={120} height={20} />
      <Block width={64} height={20} />
    </Card>
  );
}

function CornerCard() {
  return (
    <Card style={styles.cornerCard}>
      <Block width="55%" height={20} />
      <Block width="85%" height={20} />
      <Block width="60%" height={20} />
    </Card>
  );
}

function TireCard() {
  return (
    <Card style={styles.cornerCard}>
      <Block width="60%" height={20} />
      <Block width={52} height={28} />
    </Card>
  );
}

export function VehicleSkeleton({ offline = false }: { offline?: boolean }) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <NativeScrollView showsIndicators={false}>
      <View style={styles.content}>
        {offline ? (
          <OfflineBanner message="No internet connection — connect to load your vehicle" />
        ) : null}
        <Animated.View style={[styles.group, animatedStyle]}>
          <Card style={styles.hero}>
            <Block height={185} radius={16} />
            <Block width={88} height={24} radius={100} />
          </Card>

          <FuelCard />
          <OdometerCard />

          <View>
            <Block width={140} height={16} style={styles.sectionTitle} />
            <View style={styles.grid}>
              <View style={styles.gridColumn}>
                <CornerCard />
                <CornerCard />
              </View>
              <View style={styles.gridColumn}>
                <CornerCard />
                <CornerCard />
              </View>
            </View>
          </View>

          <View>
            <Block width={160} height={16} style={styles.sectionTitle} />
            <View style={styles.grid}>
              <View style={styles.gridColumn}>
                <TireCard />
                <TireCard />
              </View>
              <View style={styles.gridColumn}>
                <TireCard />
                <TireCard />
              </View>
            </View>
          </View>

          <InlineCard />
          <InlineCard />
        </Animated.View>
      </View>
    </NativeScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  group: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: 18,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fuelCard: {
    gap: Spacing.two,
  },
  fuelSegments: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  fuelSegment: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.fill,
  },
  tripCell: {
    flex: 1,
    gap: Spacing.one,
  },
  odometerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  tripsGroup: {
    flex: 2,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  sectionTitle: {
    marginTop: Spacing.one,
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
  },
  grid: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  gridColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  cornerCard: {
    gap: Spacing.one,
  },
});
