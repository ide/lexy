import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ThemedText } from '@/components/themed-text';
import { Spacing, colors } from '@/constants/theme';
import { is350 } from '@/data/is350';
import { useTheme } from '@/hooks/use-theme';

function Icon({ name, size = 20, tint }: { name: SFSymbol; size?: number; tint?: string }) {
  return (
    <Image
      source={`sf:${name}`}
      tintColor={tint ?? (colors.label as string)}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="secondaryLabel" style={styles.sectionTitle}>
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
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
      ]}>
      <ThemedText type="small" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <ThemedText selectable type="small" style={styles.rowValue}>
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
      style={{ backgroundColor: theme.groupedBackground }}
      contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <SectionTitle>SPECIFICATION</SectionTitle>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {spec.map(([label, value], i) => (
            <InfoRow key={label} label={label} value={value} last={i === spec.length - 1} />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(50)}>
        <SectionTitle>REMOTE CAPABILITIES</SectionTitle>
        <View style={[styles.card, styles.grid, { backgroundColor: theme.card }]}>
          {is350.capabilities.map((c) => (
            <View key={c.label} style={styles.capability}>
              <Icon name={c.symbol} tint={colors.systemBlue as string} />
              <ThemedText type="small" style={styles.capabilityLabel}>
                {c.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(100)}>
        <SectionTitle>TRIPS</SectionTitle>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <InfoRow label="Trip A" value={`${is350.tripAMiles} mi`} />
          <InfoRow label="Trip B" value={`${is350.tripBMiles} mi`} last />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(150)}>
        <SectionTitle>HEALTH</SectionTitle>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <InfoRow label="Odometer" value={`${is350.odometerMiles.toLocaleString()} mi`} />
          <InfoRow label="Fuel level" value={`${is350.fuelPercent}%`} />
          <InfoRow
            label="Active warnings"
            value={is350.cautionCount === 0 ? 'None' : `${is350.cautionCount}`}
            last
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  sectionTitle: {
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 18,
    borderCurve: 'continuous',
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
    fontVariant: ['tabular-nums'],
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
