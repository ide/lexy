import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { NativeScrollView } from "@/components/native-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { VehicleError, VehicleLoading } from "@/components/vehicle-state";
import { Spacing, colors } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useVehicle } from "@/hooks/use-vehicle";

function Icon({
  name,
  size = 20,
  tint,
}: {
  name: SFSymbol;
  size?: number;
  tint?: string;
}) {
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
    <ThemedText
      type="smallBold"
      themeColor="secondaryLabel"
      style={styles.sectionTitle}
    >
      {children}
    </ThemedText>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
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
  const { data: vehicle, error, isLoading, refetch } = useVehicle();

  if (isLoading && !vehicle) {
    return <VehicleLoading />;
  }

  if (!vehicle) {
    return (
      <VehicleError
        message={
          error instanceof Error
            ? error.message
            : "The vehicle API did not return data."
        }
        retry={() => refetch()}
      />
    );
  }

  const spec: [string, string][] = [
    ["VIN", vehicle.vin],
    ["Model code", vehicle.modelCode],
    ["Exterior", vehicle.color],
    ["Trim", vehicle.trim],
    ["Region", vehicle.region],
    ["Telematics", vehicle.generation],
    ["Head unit", vehicle.headUnit],
    ["Fuel type", vehicle.fuelType],
    ["Transmission", vehicle.transmission],
    ["Drivetrain", vehicle.drivetrain],
    ["Built", vehicle.manufacturedDate],
    ["In service", vehicle.inServiceDate],
  ];

  return (
    <NativeScrollView contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <SectionTitle>VEHICLE</SectionTitle>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {spec.map(([label, value], i) => (
            <InfoRow
              key={label}
              label={label}
              value={value}
              last={i === spec.length - 1}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(50)}>
        <SectionTitle>REMOTE CAPABILITIES</SectionTitle>
        <View
          style={[styles.card, styles.grid, { backgroundColor: theme.card }]}
        >
          {vehicle.capabilities.map((c) => (
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
          <InfoRow label="Trip A" value={`${vehicle.tripAMiles} mi`} />
          <InfoRow label="Trip B" value={`${vehicle.tripBMiles} mi`} last />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(150)}>
        <SectionTitle>CONNECTED SERVICES</SectionTitle>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {vehicle.subscriptions.map((subscription, i) => (
            <View
              key={subscription.name}
              style={[
                styles.serviceRow,
                i < vehicle.subscriptions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.separator,
                },
              ]}
            >
              <View>
                <ThemedText type="small">{subscription.name}</ThemedText>
                <ThemedText type="small" themeColor="secondaryLabel">
                  Expires {subscription.expires}
                </ThemedText>
              </View>
              <ThemedText
                type="smallBold"
                style={{ color: colors.systemGreen }}
              >
                {subscription.status}
              </ThemedText>
            </View>
          ))}
        </View>
      </Animated.View>
    </NativeScrollView>
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
  rowValue: {
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
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
  capabilityLabel: {
    flexShrink: 1,
  },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
});
