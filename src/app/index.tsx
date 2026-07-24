import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Link, Stack } from 'expo-router';
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
      {/* Hero */}
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.hero}>
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={styles.heroImage}
            contentFit="contain"
            transition={200}
          />
          <ThemedText type="subtitle" style={styles.heroName}>
            {vehicle.fullName}
          </ThemedText>
          <ThemedText type="small" themeColor="secondaryLabel">
            {vehicle.color} · {vehicle.model}
          </ThemedText>
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

      {/* Key metrics */}
      <Animated.View entering={FadeInDown.duration(350).delay(50)} style={styles.metricRow}>
        <Metric symbol="fuelpump.fill" value={`${vehicle.fuelPercent}`} unit="%" label="Fuel" accent={green} />
        <Metric symbol="road.lanes" value={`${vehicle.rangeMiles}`} unit="mi" label="Range" />
        <Metric
          symbol="gauge.with.dots.needle.67percent"
          value={vehicle.odometerMiles.toLocaleString()}
          unit="mi"
          label="Odometer"
        />
      </Animated.View>

      {/* Fuel bar */}
      <Animated.View entering={FadeInDown.duration(350).delay(100)}>
        <Card>
          <View style={styles.betweenRow}>
            <ThemedText type="smallBold">Fuel level</ThemedText>
            <ThemedText type="smallBold" style={{ color: green, fontVariant: ['tabular-nums'] }}>
              {vehicle.fuelPercent}%
            </ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.fill }]}>
            <View style={[styles.fill, { width: `${vehicle.fuelPercent}%`, backgroundColor: green }]} />
          </View>
          <ThemedText type="small" themeColor="secondaryLabel" style={{ marginTop: Spacing.two }}>
            Est. {vehicle.rangeMiles} mi of range
          </ThemedText>
        </Card>
      </Animated.View>

      {/* Closures */}
      <Animated.View entering={FadeInDown.duration(350).delay(150)}>
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
                  {c.locked ? 'Closed · Locked' : c.state}
                </ThemedText>
                <Icon name={c.locked ? 'lock.fill' : 'checkmark.circle.fill'} size={15} tint={green} />
              </View>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Climate + Last parked */}
      <Animated.View entering={FadeInDown.duration(350).delay(200)} style={styles.metricRow}>
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
              <ThemedText type="smallBold" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                {vehicle.location.latitude.toFixed(3)}, {vehicle.location.longitude.toFixed(3)}
              </ThemedText>
              <ThemedText type="small" themeColor="secondaryLabel">
                Last parked · Open in Maps
              </ThemedText>
            </Card>
          )}
        </Pressable>
      </Animated.View>

      {/* Subscriptions */}
      <Animated.View entering={FadeInDown.duration(350).delay(250)}>
        <SectionTitle>CONNECTED SERVICES</SectionTitle>
        <Card style={styles.closureCard}>
          {vehicle.subscriptions.map((s, i) => (
            <View
              key={s.name}
              style={[
                styles.closureRow,
                i < vehicle.subscriptions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.separator,
                },
              ]}>
              <View>
                <ThemedText type="small">{s.name}</ThemedText>
                <ThemedText type="small" themeColor="secondaryLabel">
                  Expires {s.expires}
                </ThemedText>
              </View>
              <View style={[styles.pill, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                <ThemedText type="small" style={{ color: green }}>
                  {s.status}
                </ThemedText>
              </View>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Details link */}
      <Animated.View entering={FadeInDown.duration(350).delay(300)}>
        <Link href="/details" asChild>
          <Link.Trigger>
            <Pressable>
              {({ pressed }) => (
                <Card style={[styles.linkRow, pressed && { opacity: 0.7 }]}>
                  <View style={styles.closureState}>
                    <Icon name="info.circle.fill" size={20} tint={blue} />
                    <ThemedText type="smallBold">Vehicle details & capabilities</ThemedText>
                  </View>
                  <Icon name="chevron.right" size={14} tint={colors.secondaryLabel as string} />
                </Card>
              )}
            </Pressable>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              title="Open Last Parked in Maps"
              icon="map"
              onPress={() => openLastParkedInMaps(vehicle)}
            />
          </Link.Menu>
        </Link>
      </Animated.View>

      <ThemedText type="small" themeColor="secondaryLabel" style={styles.footer}>
        Updated {updatedLabel(vehicle.updatedAt)} · via Lexus Connected Services
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
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  heroImage: {
    width: '100%',
    height: 170,
    marginBottom: Spacing.two,
  },
  heroName: {
    textAlign: 'center',
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
  betweenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  track: {
    height: 8,
    borderRadius: 100,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 100,
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
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
