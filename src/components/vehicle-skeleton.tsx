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
 * the real dashboard layout (hero, metric row, doors/windows grid, tire grid,
 * climate row) with neutral fill blocks so the shape is visible immediately
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

function MetricCard() {
  return (
    <Card style={styles.metric}>
      <Block width={24} height={24} radius={12} />
      <Block width={44} height={24} />
      <Block width={30} height={12} />
    </Card>
  );
}

function CornerCard() {
  return (
    <Card style={styles.cornerCard}>
      <Block width="55%" height={12} />
      <Block width="80%" height={14} />
      <Block width="65%" height={14} />
    </Card>
  );
}

function TireCard() {
  return (
    <Card style={styles.cornerCard}>
      <Block width="60%" height={12} />
      <Block width={52} height={22} />
    </Card>
  );
}

function HalfCard() {
  return (
    <Card style={styles.halfCard}>
      <Block width={24} height={24} radius={12} />
      <Block width="55%" height={22} />
      <Block width="40%" height={12} />
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
            <Block height={200} radius={16} />
            <Block width={92} height={26} radius={100} />
          </Card>

          <View style={styles.row}>
            <MetricCard />
            <MetricCard />
            <MetricCard />
          </View>

          <View>
            <Block width={140} height={12} style={styles.sectionTitle} />
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
            <Block width={160} height={12} style={styles.sectionTitle} />
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

          <View style={styles.row}>
            <HalfCard />
            <HalfCard />
          </View>
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
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  metric: {
    flex: 1,
    gap: Spacing.one,
    alignItems: "flex-start",
  },
  halfCard: {
    flex: 1,
    gap: Spacing.one,
    alignItems: "flex-start",
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
