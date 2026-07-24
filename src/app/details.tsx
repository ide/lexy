import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { is350 } from '@/data/is350';
import { useTheme } from '@/hooks/use-theme';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.backgroundSelected },
      ]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function CarDetails() {
  const theme = useTheme();

  const spec: [string, string][] = [
    ['VIN', is350.vin],
    ['Model code', is350.modelCode],
    ['Trim', is350.trim],
    ['Region', is350.region],
    ['Telematics', is350.generation],
    ['Head unit', is350.headUnit],
    ['Fuel type', is350.fuelType],
    ['Transmission', is350.transmission],
    ['Drivetrain', is350.drivetrain],
    ['Built', is350.manufacturedDate],
    ['In service', is350.inServiceDate],
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      <SectionTitle>SPECIFICATION</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        {spec.map(([label, value], i) => (
          <InfoRow key={label} label={label} value={value} last={i === spec.length - 1} />
        ))}
      </View>

      <SectionTitle>REMOTE CAPABILITIES</SectionTitle>
      <View style={[styles.card, styles.grid, { backgroundColor: theme.backgroundElement }]}>
        {is350.capabilities.map((c) => (
          <View key={c.label} style={styles.capability}>
            <SymbolView name={c.symbol} size={20} tintColor="#0A84FF" type="hierarchical" />
            <ThemedText type="small" style={styles.capabilityLabel}>
              {c.label}
            </ThemedText>
          </View>
        ))}
      </View>

      <SectionTitle>TRIPS</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <InfoRow label="Trip A" value={`${is350.tripAMiles} mi`} />
        <InfoRow label="Trip B" value={`${is350.tripBMiles} mi`} last />
      </View>

      <SectionTitle>HEALTH</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <InfoRow label="Odometer" value={`${is350.odometerMiles} mi`} />
        <InfoRow label="Fuel level" value={`${is350.fuelPercent}%`} />
        <InfoRow
          label="Active warnings"
          value={is350.cautionCount === 0 ? 'None' : `${is350.cautionCount}`}
          last
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    marginLeft: Spacing.two,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  capability: {
    width: '43%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  capabilityLabel: {
    flexShrink: 1,
  },
});
