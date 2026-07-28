import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useObserve } from "expo-observe";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import type { SFSymbol } from "sf-symbols-typescript";

import { NativeScrollView } from "@/components/native-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { VehicleError, VehicleLoading } from "@/components/vehicle-state";
import { Spacing, colors } from "@/constants/theme";
import { groupClosures, type Corner, type Side } from "@/data/closures";
import { relativeTime, updatedLabel, type Closure, type Vehicle } from "@/data/vehicle";
import { useTheme } from "@/hooks/use-theme";
import { useVehicle } from "@/hooks/use-vehicle";

function Icon({
  name,
  size = 22,
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

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }, style]}>
      {children}
    </View>
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
          <ThemedText
            type="small"
            themeColor="secondaryLabel"
            style={styles.metricUnit}
          >
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

const green = colors.systemGreen as string;
const blue = colors.systemBlue as string;
const orange = colors.systemOrange as string;

type Status = { text: string; color: string; symbol: SFSymbol };

function doorStatus(door: Closure): Status {
  if (door.state === "Open") {
    return { text: "Door open", color: orange, symbol: "lock.open.fill" };
  }
  if (door.locked === false) {
    return { text: "Door unlocked", color: orange, symbol: "lock.open.fill" };
  }
  return { text: "Door locked", color: green, symbol: "lock.fill" };
}

function windowStatus(window: Closure, side: Side): Status {
  // The `car.window.left`/`right` glyphs read reversed against our driver-left /
  // passenger-right columns, so the sides are intentionally swapped here.
  const symbol: SFSymbol =
    side === "driver" ? "car.window.right" : "car.window.left";
  return window.state === "Open"
    ? { text: "Window open", color: orange, symbol }
    : { text: "Window closed", color: green, symbol };
}

// Non-door/window closures (moonroof, trunk, hood). Each carries its own
// identity glyph; open/closed is conveyed by color + the written word rather
// than a checkmark, keeping them visually consistent with doors and windows.
const OPENING_SYMBOLS: { match: RegExp; open: SFSymbol; closed: SFSymbol }[] = [
  { match: /moonroof|sunroof/i, open: "window.ceiling", closed: "window.ceiling.closed" },
  {
    match: /trunk|hatch|tailgate/i,
    open: "car.side.rear.crop.trunk.partition.fill",
    closed: "car.side.rear.crop.trunk.partition.fill",
  },
  { match: /hood/i, open: "engine.combustion.fill", closed: "engine.combustion.fill" },
];

function openingStatus(opening: Closure): Status {
  const isOpen = opening.state === "Open";
  const match = OPENING_SYMBOLS.find((o) => o.match.test(opening.label));
  const symbol: SFSymbol = match
    ? isOpen
      ? match.open
      : match.closed
    : isOpen
      ? "exclamationmark.triangle.fill"
      : "checkmark.circle.fill";
  return {
    text: `${opening.label} ${isOpen ? "open" : "closed"}`,
    color: isOpen ? orange : green,
    symbol,
  };
}

function StatusLine({ status }: { status: Status }) {
  return (
    <View style={styles.statusLine}>
      <Icon name={status.symbol} size={17} tint={status.color} />
      <ThemedText type="small" style={{ color: status.color }}>
        {status.text}
      </ThemedText>
    </View>
  );
}

function CornerCard({ corner }: { corner: Corner }) {
  return (
    <Card style={styles.cornerCard}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {corner.title}
      </ThemedText>
      <View style={styles.cornerStates}>
        {corner.door ? (
          <StatusLine status={doorStatus(corner.door)} />
        ) : null}
        {corner.window ? (
          <StatusLine status={windowStatus(corner.window, corner.side)} />
        ) : null}
      </View>
    </Card>
  );
}

function SideGrid({ corners }: { corners: Corner[] }) {
  const driver = corners.filter((c) => c.side === "driver");
  const passenger = corners.filter((c) => c.side === "passenger");
  return (
    <View style={styles.grid}>
      <View style={styles.gridColumn}>
        {driver.map((c) => (
          <CornerCard key={c.key} corner={c} />
        ))}
      </View>
      <View style={styles.gridColumn}>
        {passenger.map((c) => (
          <CornerCard key={c.key} corner={c} />
        ))}
      </View>
    </View>
  );
}

function TireCell({
  label,
  value,
  unit,
  low,
}: {
  label: string;
  value: number;
  unit: string;
  low: boolean;
}) {
  const color = low ? orange : green;
  return (
    <Card style={styles.cornerCard}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <View style={styles.metricValueRow}>
        <ThemedText style={[styles.tireValue, { color }]}>{value}</ThemedText>
        <ThemedText
          type="small"
          themeColor="secondaryLabel"
          style={styles.metricUnit}
        >
          {unit}
        </ThemedText>
      </View>
    </Card>
  );
}

function OpeningCard({ opening }: { opening: Closure }) {
  return (
    <Card style={styles.cornerCard}>
      <StatusLine status={openingStatus(opening)} />
    </Card>
  );
}

function openLastParkedInMaps(vehicle: Vehicle) {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  const { latitude, longitude } = vehicle.location;
  const label = encodeURIComponent(vehicle.nickname);
  const url =
    process.env.EXPO_OS === "android"
      ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
      : `https://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`;
  Linking.openURL(url);
}

export default function CarDashboard() {
  const {
    data: vehicle,
    error,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useVehicle();
  const { markInteractive } = useObserve();

  useEffect(() => {
    // TTI marks the UI shell becoming interactive; data readiness is tracked
    // separately by the vehicle.load events.
    markInteractive();
  }, [markInteractive]);

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

  const lockStates = vehicle.closures
    .map((closure) => closure.locked)
    .filter((locked): locked is boolean => locked !== undefined);
  const locked = lockStates.length > 0 && lockStates.every(Boolean);
  const lockColor = locked ? green : orange;
  const { corners, openings } = groupClosures(vehicle.closures);
  const tires = vehicle.tires?.positions ?? [];
  const leftTires = tires.filter((t) => /left/i.test(t.label));
  const rightTires = tires.filter((t) => /right/i.test(t.label));
  return (
    <>
      <Stack.Screen options={{ title: vehicle.nickname }} />
      <NativeScrollView
        onRefresh={async () => {
          await refetch();
        }}
        contentContainerStyle={styles.content}
      >
        <Card style={styles.hero}>
          <View style={styles.heroImageFrame}>
            <Image
              source={{ uri: vehicle.imageUrl }}
              style={styles.heroImage}
              contentFit="contain"
              transition={200}
            />
          </View>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: locked
                  ? "rgba(52,199,89,0.15)"
                  : "rgba(255,149,0,0.15)",
              },
            ]}
          >
            <Icon
              name={locked ? "lock.fill" : "lock.open.fill"}
              size={13}
              tint={lockColor}
            />
            <ThemedText type="small" style={{ color: lockColor }}>
              {locked ? "Locked" : "Unlocked"}
            </ThemedText>
          </View>
        </Card>

        <View style={styles.metricRow}>
          <Metric
            symbol="fuelpump.fill"
            value={`${vehicle.fuelPercent}`}
            unit="%"
            label="Fuel"
            accent={green}
          />
          <Metric
            symbol="road.lanes"
            value={`${vehicle.rangeMiles}`}
            unit="mi"
            label="Range"
          />
          <Metric
            symbol="gauge.with.dots.needle.67percent"
            value={vehicle.odometerMiles.toLocaleString()}
            unit="mi"
            label="Odometer"
          />
        </View>

        {corners.length > 0 ? (
          <View>
            <SectionTitle>DOORS & WINDOWS</SectionTitle>
            <SideGrid corners={corners} />
          </View>
        ) : null}

        {openings.length > 0 ? (
          <View style={styles.grid}>
            <View style={styles.gridColumn}>
              {openings
                .filter((_, i) => i % 2 === 0)
                .map((o) => (
                  <OpeningCard key={o.label} opening={o} />
                ))}
            </View>
            <View style={styles.gridColumn}>
              {openings
                .filter((_, i) => i % 2 === 1)
                .map((o) => (
                  <OpeningCard key={o.label} opening={o} />
                ))}
            </View>
          </View>
        ) : null}

        {tires.length > 0 ? (
          <View>
            <SectionTitle>TIRE PRESSURE ({vehicle.tires!.unit})</SectionTitle>
            <View style={styles.grid}>
              <View style={styles.gridColumn}>
                {leftTires.map((t) => (
                  <TireCell
                    key={t.label}
                    label={t.label}
                    value={t.value}
                    unit={vehicle.tires!.unit}
                    low={t.low}
                  />
                ))}
              </View>
              <View style={styles.gridColumn}>
                {rightTires.map((t) => (
                  <TireCell
                    key={t.label}
                    label={t.label}
                    value={t.value}
                    unit={vehicle.tires!.unit}
                    low={t.low}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.metricRow}>
          <Card style={styles.halfCard}>
            <Icon name="thermometer.medium" tint={blue} />
            <ThemedText style={styles.metricValue}>
              {vehicle.climate.temperatureF}°F
            </ThemedText>
            <ThemedText type="small" themeColor="secondaryLabel">
              Climate setpoint
            </ThemedText>
          </Card>
          <Pressable
            onPress={() => openLastParkedInMaps(vehicle)}
            style={{ flex: 1 }}
          >
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
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" themeColor="secondaryLabel">
            Vehicle reported {relativeTime(vehicle.updatedAt)} ·{" "}
            {updatedLabel(vehicle.updatedAt)}
          </ThemedText>
          <ThemedText type="small" themeColor="secondaryLabel">
            App checked {relativeTime(dataUpdatedAt)}
          </ThemedText>
        </View>
      </NativeScrollView>
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
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  // The Lexus render ships with ~26% transparent margin top and bottom, so a
  // plain `contain` fit floats a small car in a sea of whitespace. Clip the
  // image in a fixed frame and oversize it (width > 100%) so the car fills the
  // frame and the transparent bands are cropped out.
  heroImageFrame: {
    width: "100%",
    height: 185,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "110%",
    aspectRatio: 700 / 631,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 100,
  },
  metricRow: {
    flexDirection: "row",
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
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  metricUnit: {
    marginBottom: 4,
  },
  tireValue: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: {
    marginTop: Spacing.one,
    marginLeft: Spacing.two,
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
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
  cornerStates: {
    gap: Spacing.half,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.two,
    gap: Spacing.half,
  },
});
