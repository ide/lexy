import { Button, Host, Popover, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useObserve } from "expo-observe";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { Card } from "@/components/card";
import {
  DevSkeletonToggle,
  SHOW_DEV_SKELETON_TOGGLE,
} from "@/components/dev-skeleton-toggle";
import { Icon } from "@/components/icon";
import { NativeScrollView } from "@/components/native-scroll-view";
import { OfflineBanner } from "@/components/offline-banner";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { VehicleControls } from "@/components/vehicle-controls";
import { VehicleSkeleton } from "@/components/vehicle-skeleton";
import { NoVehicleState, VehicleError } from "@/components/vehicle-state";
import { Spacing, colors } from "@/constants/theme";
import { groupClosures, type Corner, type Side } from "@/data/closures";
import { fuelGauge, type FuelGauge } from "@/data/fuel";
import {
  absoluteLocalTime,
  NoVehicleError,
  relativeTime,
  type Closure,
  type Vehicle,
} from "@/data/vehicle";
import { useIsOnline } from "@/hooks/use-is-online";
import { useVehicle } from "@/hooks/use-vehicle";

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
    <Card style={[styles.cardPadding, styles.metric]}>
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

/**
 * A gentle opacity pulse used to signal a background refetch. It reuses the
 * loading skeleton's treatment, applied here to the vehicle name so a refresh
 * that runs over already-cached data is visible without a blocking spinner.
 */
function Shimmer({
  active,
  style,
  children,
}: {
  active: boolean;
  style?: object;
  children: React.ReactNode;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [active, pulse]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

// The fuel/charge level as a bar divided into quarters, mirroring the car's
// dashboard. The reading is an estimate, so the bar is the primary display;
// tapping reveals the precise number (and it reads "Full" at 100%).
function FuelBar({ gauge }: { gauge: FuelGauge }) {
  const [showValue, setShowValue] = useState(false);
  const reveal = gauge.full || showValue;
  const fillColor = gauge.low ? orange : green;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.selectionAsync();
        }
        setShowValue((value) => !value);
      }}
    >
      {({ pressed }) => (
        <Card
          style={[styles.cardPadding, styles.fuelCard, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.fuelHeader}>
            <View style={styles.fuelLabel}>
              <Icon name={gauge.symbol} size={17} tint={fillColor} />
              <ThemedText type="smallBold" themeColor="secondaryLabel">
                {gauge.label}
              </ThemedText>
            </View>
            {reveal ? (
              <ThemedText type="smallBold" style={{ color: fillColor }}>
                {gauge.valueText}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="secondaryLabel">
                Tap for level
              </ThemedText>
            )}
          </View>
          <View style={styles.fuelSegments}>
            {gauge.fills.map((fill, i) => (
              <View key={`segment-${i}`} style={styles.fuelSegmentTrack}>
                <View
                  style={[
                    styles.fuelSegmentFill,
                    { width: `${fill * 100}%`, backgroundColor: fillColor },
                  ]}
                />
              </View>
            ))}
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function TripCell({ label, miles }: { label: string; miles: number }) {
  return (
    <Card style={[styles.cardPadding, styles.metric]}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.metricValue}>
          {miles.toLocaleString()}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="secondaryLabel"
          style={styles.metricUnit}
        >
          mi
        </ThemedText>
      </View>
    </Card>
  );
}

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
      <ThemedText type="small">{status.text}</ThemedText>
    </View>
  );
}

function CornerCard({ corner }: { corner: Corner }) {
  return (
    <Card style={[styles.cardPadding, styles.cornerCard]}>
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
  return (
    <Card style={[styles.cardPadding, styles.cornerCard]}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <View style={styles.metricValueRow}>
        <ThemedText style={[styles.tireValue, low && { color: orange }]}>
          {value}
        </ThemedText>
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
    <Card style={[styles.cardPadding, styles.cornerCard]}>
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

// A non-bold footer line whose tap reveals the precise local timestamp in a
// native SwiftUI popover — a tooltip anchored to the sentence itself.
function FooterTimeRow({
  label,
  timestamp,
}: {
  label: string;
  timestamp: string | number;
}) {
  const [isPresented, setIsPresented] = useState(false);
  return (
    <Popover isPresented={isPresented} onIsPresentedChange={setIsPresented}>
      <Popover.Trigger>
        <Button
          onPress={() => setIsPresented(true)}
          modifiers={[buttonStyle("plain")]}
        >
          <Text
            modifiers={[
              font({ textStyle: "footnote", weight: "regular" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            {label}
          </Text>
        </Button>
      </Popover.Trigger>
      <Popover.Content>
        <Text
          modifiers={[
            padding({ all: Spacing.three }),
            font({ textStyle: "callout", weight: "regular" }),
          ]}
        >
          {absoluteLocalTime(timestamp)}
        </Text>
      </Popover.Content>
    </Popover>
  );
}

export default function CarDashboard() {
  const {
    data: vehicle,
    error,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useVehicle();
  const { markInteractive } = useObserve();
  const isOnline = useIsOnline();
  const [forceSkeleton, setForceSkeleton] = useState(false);

  useEffect(() => {
    // TTI marks the UI shell becoming interactive; data readiness is tracked
    // separately by the vehicle.load events.
    markInteractive();
  }, [markInteractive]);

  // Affordance to hold the real loading skeleton on the real screen. Available
  // in dev and preview builds (see SHOW_DEV_SKELETON_TOGGLE); kept out of
  // production.
  const headerRight = SHOW_DEV_SKELETON_TOGGLE
    ? () => (
        <DevSkeletonToggle
          active={forceSkeleton}
          onToggle={() => setForceSkeleton((value) => !value)}
        />
      )
    : undefined;

  // A single skeleton covers every "no vehicle yet" case: the dev override, the
  // first-load fetch, and offline-before-anything-cached (with a banner). Only
  // a settled, online, data-less result is a real error.
  if (forceSkeleton || (!vehicle && (isLoading || !isOnline))) {
    return (
      <>
        {/* No nickname yet, so fall back to a generic title rather than the
            tab's "Status" label, which reads oddly as a large screen title. */}
        <Stack.Screen
          options={{ title: "My Lexus", headerLargeTitleEnabled: false, headerRight }}
        />
        <VehicleSkeleton offline={!vehicle && !isOnline} />
      </>
    );
  }

  if (!vehicle) {
    return (
      <>
        <Stack.Screen
          options={{ title: "My Lexus", headerLargeTitleEnabled: false, headerRight }}
        />
        {error instanceof NoVehicleError ? (
          <NoVehicleState retry={() => refetch()} />
        ) : (
          <VehicleError
            message={
              error instanceof Error
                ? error.message
                : "The vehicle API did not return data."
            }
            retry={() => refetch()}
          />
        )}
      </>
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
      <Stack.Screen
        options={{
          title: vehicle.nickname,
          headerLargeTitleEnabled: false,
          headerRight,
        }}
      />
      <NativeScrollView
        onRefresh={async () => {
          await refetch();
        }}
        contentContainerStyle={styles.content}
      >
        {!isOnline ? (
          <OfflineBanner message="No internet connection — showing last saved data" />
        ) : null}
        {/* The car name lives on-screen (not just in the nav bar) so it can
            shimmer while a background refresh runs over the cached data. */}
        <Shimmer active={isFetching} style={styles.nameRow}>
          <ThemedText style={styles.vehicleName}>{vehicle.nickname}</ThemedText>
        </Shimmer>
        <Card style={[styles.cardPadding, styles.hero]}>
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
            {/* The lock state is derived only from doors — windows and other
                openings have no lock — so the label names doors explicitly. */}
            <ThemedText type="small" style={{ color: lockColor }}>
              {locked ? "Doors locked" : "Doors unlocked"}
            </ThemedText>
          </View>
        </Card>

        <VehicleControls vehicle={vehicle} />

        <FuelBar gauge={fuelGauge(vehicle.fuelType, vehicle.fuelPercent)} />

        <View style={styles.metricRow}>
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

        <View style={styles.metricRow}>
          <TripCell label="Trip A" miles={vehicle.tripAMiles} />
          <TripCell label="Trip B" miles={vehicle.tripBMiles} />
        </View>

        {corners.length > 0 ? (
          <View>
            <SectionTitle style={styles.sectionTitleSpacing}>DOORS & WINDOWS</SectionTitle>
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
            <SectionTitle style={styles.sectionTitleSpacing}>TIRE PRESSURE ({vehicle.tires!.unit})</SectionTitle>
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
          <Card style={[styles.cardPadding, styles.halfCard]}>
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
              <Card
                style={[
                  styles.cardPadding,
                  styles.halfCard,
                  pressed && { opacity: 0.7 },
                ]}
              >
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
          <Host matchContents style={styles.footerHost}>
            <VStack alignment="center" spacing={Spacing.half}>
              <FooterTimeRow
                label={`Vehicle last synced with Lexus ${relativeTime(
                  vehicle.updatedAt,
                )}.`}
                timestamp={vehicle.updatedAt}
              />
              <FooterTimeRow
                label={`Lexy has data from ${relativeTime(dataUpdatedAt)}.`}
                timestamp={dataUpdatedAt}
              />
            </VStack>
          </Host>
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
  cardPadding: {
    padding: Spacing.three,
  },
  nameRow: {
    marginLeft: Spacing.one,
  },
  vehicleName: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  fuelCard: {
    gap: Spacing.two,
  },
  fuelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fuelLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  fuelSegments: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  fuelSegmentTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  fuelSegmentFill: {
    height: "100%",
    borderRadius: 6,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  // The Lexus vehicle render (from the telematics CDN) is a 700x631 PNG whose
  // car only occupies the middle ~46% of the height: it ships with ~26%
  // transparent margin on top and ~28% on the bottom. A plain `contentFit:
  // "contain"` faithfully draws all that empty space, so the car floats small
  // in a sea of whitespace (which reads as excess vertical padding in the card).
  //
  // Fix: clip the image in a fixed-height frame (overflow: hidden) and oversize
  // it (width > 100%) so the car fills the frame and the transparent bands get
  // cropped away instead of rendered. The car sits dead-center in the source,
  // so a symmetric scale needs no translation. Frame height (185) + width
  // (110%) are tuned so the whole car stays visible with a little breathing
  // room (~11pt above / ~18pt below) — don't crank them without re-checking the
  // car isn't getting clipped. aspectRatio matches the source (700/631).
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
  sectionTitleSpacing: {
    marginTop: Spacing.one,
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
  footerHost: {
    backgroundColor: "transparent",
  },
});
