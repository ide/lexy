import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { is350, updatedLabel } from '@/data/is350';
import { useTheme } from '@/hooks/use-theme';

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
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
  symbol: SymbolViewProps['name'];
  value: string;
  unit?: string;
  label: string;
  accent?: string;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.metric}>
      <SymbolView name={symbol} size={22} tintColor={accent ?? theme.text} type="hierarchical" />
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.metricValue}>{value}</ThemedText>
        {unit ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.metricUnit}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Card>
  );
}

export default function CarDashboard() {
  const theme = useTheme();
  const fuelColor = '#34C759';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      {/* Hero */}
      <Card style={styles.hero}>
        <Image
          source={{ uri: is350.imageUrl }}
          style={styles.heroImage}
          contentFit="contain"
          transition={200}
        />
        <ThemedText type="subtitle" style={styles.heroName}>
          {is350.fullName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {is350.color} · {is350.model}
        </ThemedText>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <SymbolView name="lock.fill" size={13} tintColor="#34C759" />
            <ThemedText type="small" style={{ color: '#34C759' }}>
              Locked
            </ThemedText>
          </View>
          <View style={[styles.pill, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <SymbolView name="checkmark.seal.fill" size={13} tintColor="#34C759" />
            <ThemedText type="small" style={{ color: '#34C759' }}>
              {is350.cautionCount === 0 ? 'No alerts' : `${is350.cautionCount} alerts`}
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* Key metrics */}
      <View style={styles.metricRow}>
        <Metric symbol="fuelpump.fill" value={`${is350.fuelPercent}`} unit="%" label="Fuel" accent={fuelColor} />
        <Metric symbol="road.lanes" value={`${is350.rangeMiles}`} unit="mi" label="Range" />
        <Metric symbol="gauge.with.dots.needle.67percent" value={`${is350.odometerMiles}`} unit="mi" label="Odometer" />
      </View>

      {/* Fuel bar */}
      <Card>
        <View style={styles.betweenRow}>
          <ThemedText type="smallBold">Fuel level</ThemedText>
          <ThemedText type="smallBold" style={{ color: fuelColor }}>
            {is350.fuelPercent}%
          </ThemedText>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${is350.fuelPercent}%`, backgroundColor: fuelColor }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
          Est. {is350.rangeMiles} mi of range
        </ThemedText>
      </Card>

      {/* Closures */}
      <SectionTitle>CLOSURES</SectionTitle>
      <Card style={styles.closureCard}>
        {is350.closures.map((c, i) => (
          <View
            key={c.label}
            style={[
              styles.closureRow,
              i < is350.closures.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.backgroundSelected,
              },
            ]}>
            <ThemedText type="small">{c.label}</ThemedText>
            <View style={styles.closureState}>
              <ThemedText type="small" themeColor="textSecondary">
                {c.locked ? 'Closed · Locked' : c.state}
              </ThemedText>
              <SymbolView
                name={c.locked ? 'lock.fill' : 'checkmark.circle.fill'}
                size={15}
                tintColor="#34C759"
              />
            </View>
          </View>
        ))}
      </Card>

      {/* Climate + Last parked */}
      <View style={styles.metricRow}>
        <Card style={styles.halfCard}>
          <SymbolView name="thermometer.medium" size={22} tintColor="#0A84FF" type="hierarchical" />
          <ThemedText style={styles.metricValue}>{is350.climate.temperatureF}°F</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Climate setpoint
          </ThemedText>
        </Card>
        <Card style={styles.halfCard}>
          <SymbolView name="parkingsign.circle.fill" size={22} tintColor="#0A84FF" type="hierarchical" />
          <ThemedText type="smallBold" numberOfLines={1}>
            {is350.location.latitude.toFixed(3)}, {is350.location.longitude.toFixed(3)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Last parked
          </ThemedText>
        </Card>
      </View>

      {/* Subscriptions */}
      <SectionTitle>CONNECTED SERVICES</SectionTitle>
      <Card style={styles.closureCard}>
        {is350.subscriptions.map((s, i) => (
          <View
            key={s.name}
            style={[
              styles.closureRow,
              i < is350.subscriptions.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.backgroundSelected,
              },
            ]}>
            <View>
              <ThemedText type="small">{s.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Expires {s.expires}
              </ThemedText>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
              <ThemedText type="small" style={{ color: '#34C759' }}>
                {s.status}
              </ThemedText>
            </View>
          </View>
        ))}
      </Card>

      {/* Details link */}
      <Link href="/details" asChild>
        <Pressable>
          <Card style={styles.linkRow}>
            <View style={styles.closureState}>
              <SymbolView name="info.circle.fill" size={20} tintColor="#0A84FF" type="hierarchical" />
              <ThemedText type="smallBold">Vehicle details & capabilities</ThemedText>
            </View>
            <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
          </Card>
        </Pressable>
      </Link>

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Updated {updatedLabel(is350.updatedAt)} · via Lexus Connected Services
      </ThemedText>
    </ScrollView>
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
  },
  metricUnit: {
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: Spacing.one,
    marginLeft: Spacing.two,
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
