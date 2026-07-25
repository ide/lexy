import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ThemedText } from '@/components/themed-text';
import { VehicleError, VehicleLoading } from '@/components/vehicle-state';
import { Spacing, colors } from '@/constants/theme';
import { updatedLabel, type Vehicle } from '@/data/vehicle';
import { useTheme } from '@/hooks/use-theme';
import { useVehicle } from '@/hooks/use-vehicle';

function Icon({ name, size = 22, tint }: { name: SFSymbol; size?: number; tint?: string }) {
  return (
    <Image
      source={`sf:${name}`}
      tintColor={tint ?? (colors.label as string)}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }, style]}>{children}</View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="secondaryLabel" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

function Metric({
  symbol,
  value,
  unit,
  label,
  accent,
}: {
  symbol: SFSymbol;
  value: string;
  unit?: string;
  label: string;
  accent?: string;
}) {
  return (
    <Card style={styles.metric}>
      <Icon name={symbol} tint={accent} />
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.metricValue}>{value}</ThemedText>
        {unit ? (
          <ThemedText type="small" themeColor="secondaryLabel" style={styles.metricUnit}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="secondaryLabel">
        {label}
      </ThemedText>
    </Card>
  );
}

function openLastParkedInMaps(vehicle: Vehicle) {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  const { latitude, longitude } = vehicle.location;
  const label = encodeURIComponent(vehicle.nickname);
  const url =
    process.env.EXPO_OS === 'android'
      ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
      : `https://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`;
  Linking.openURL(url);
}

const green = colors.systemGreen as string;
const blue = colors.systemBlue as string;

export default function CarDashboard() {
  const theme = useTheme();
  const { data: vehicle, error, isLoading, isRefetching, refetch } = useVehicle();

  if (isLoading && !vehicle) {
    return <VehicleLoading />;
  }

  if (!vehicle) {
    return (
      <VehicleError
        message={error instanceof Error ? error.message : 'The vehicle API did not return data.'}
        retry={() => refetch()}
      />
    );
  }

  const lockStates = vehicle.closures
    .map((closure) => closure.locked)
    .filter((locked): locked is boolean => locked !== undefined);
  const locked = lockStates.length > 0 && lockStates.every(Boolean);
  const lockColor = locked ? green : (colors.systemOrange as string);
  const refreshControl = (
    <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
  );

  return (
    <>
      <Stack.Screen options={{ title: vehicle.nickname }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={refreshControl}
        style={{ backgroundColor: theme.groupedBackground }}
        contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.hero}>
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={styles.heroImage}
            contentFit="contain"
            transition={200}
          />
          <View style={styles.pillRow}>
            <View
              style={[
                styles.pill,
                { backgroundColor: locked ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)' },
              ]}>
              <Icon name={locked ? 'lock.fill' : 'lock.open.fill'} size={13} tint={lockColor} />
              <ThemedText type="small" style={{ color: lockColor }}>
                {locked ? 'Locked' : 'Unlocked'}
              </ThemedText>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
              <Icon name="checkmark.seal.fill" size={13} tint={green} />
              <ThemedText type="small" style={{ color: green }}>
                {vehicle.cautionCount === 0 ? 'No alerts' : `${vehicle.cautionCount} alerts`}
              </ThemedText>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(50)} style={styles.metricRow}>
        <Metric
          symbol="fuelpump.fill"
          value={`${vehicle.fuelPercent}`}
          unit="%"
          label="Fuel"
          accent={green}
        />
        <Metric symbol="road.lanes" value={`${vehicle.rangeMiles}`} unit="mi" label="Range" />
        <Metric
          symbol="gauge.with.dots.needle.67percent"
          value={vehicle.odometerMiles.toLocaleString()}
          unit="mi"
          label="Odometer"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(100)}>
        <SectionTitle>CLOSURES</SectionTitle>
        <Card style={styles.closureCard}>
          {vehicle.closures.map((c, i) => (
            <View
              key={c.label}
              style={[
                styles.closureRow,
                i < vehicle.closures.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.separator,
                },
              ]}>
              <ThemedText type="small">{c.label}</ThemedText>
              <View style={styles.closureState}>
                <ThemedText type="small" themeColor="secondaryLabel">
                  {c.locked ? 'Locked' : c.state}
                </ThemedText>
                <Icon name={c.locked ? 'lock.fill' : 'checkmark.circle.fill'} size={15} tint={green} />
              </View>
            </View>
          ))}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(150)} style={styles.metricRow}>
        <Card style={styles.halfCard}>
          <Icon name="thermometer.medium" tint={blue} />
          <ThemedText style={styles.metricValue}>{vehicle.climate.temperatureF}°F</ThemedText>
          <ThemedText type="small" themeColor="secondaryLabel">
            Climate setpoint
          </ThemedText>
        </Card>
        <Pressable onPress={() => openLastParkedInMaps(vehicle)} style={{ flex: 1 }}>
          {({ pressed }) => (
            <Card style={[styles.halfCard, pressed && { opacity: 0.7 }]}>
              <Icon name="parkingsign.circle.fill" tint={blue} />
              <ThemedText type="smallBold">Last parked</ThemedText>
              <ThemedText type="small" themeColor="secondaryLabel">
                Open in Maps
              </ThemedText>
            </Card>
          )}
        </Pressable>
      </Animated.View>

      <ThemedText type="small" themeColor="secondaryLabel" style={styles.footer}>
        Updated {updatedLabel(vehicle.updatedAt)}
      </ThemedText>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  heroImage: {
    width: '100%',
    height: 170,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 100,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metric: {
    flex: 1,
    gap: Spacing.one,
  },
  halfCard: {
    flex: 1,
    gap: Spacing.one,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: Spacing.one,
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  closureCard: {
    paddingVertical: 0,
  },
  closureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  closureState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
