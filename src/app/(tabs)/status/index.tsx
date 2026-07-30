import { Button, Host, Popover, Slider, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useObserve } from "expo-observe";
import { Link, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { Card } from "@/components/card";
import { CarLocationMap } from "@/components/car-location-map";
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
import { fuelGauge, type FuelGauge, type FuelLevel } from "@/data/fuel";
import {
  absoluteLocalTime,
  NoVehicleError,
  relativeTime,
  type Closure,
  type DistanceUnit,
  type Vehicle,
} from "@/data/vehicle";
import type { AcParameter } from "@/data/climate-settings";
import { queryClient } from "@/data/query-client";
import {
  CLIMATE_SETTINGS_QUERY_KEY,
  useClimateSettings,
} from "@/hooks/use-climate-settings";
import { useIsOnline } from "@/hooks/use-is-online";
import { useVehicle } from "@/hooks/use-vehicle";

const green = colors.systemGreen as string;
const blue = colors.systemBlue as string;
const orange = colors.systemOrange as string;

// Gauge tint by level: green rewards a full tank, a healthy level stays
// neutral, and the warning colors escalate as it drains.
const FUEL_COLORS: Record<FuelLevel, string> = {
  full: green,
  high: colors.label as string,
  medium: colors.systemYellow as string,
  low: orange,
  critical: colors.systemRed as string,
};

// The fuel/charge level as a bar divided into quarters, mirroring the car's
// dashboard, with the precise reading and range beside it ("62% · 277 mi",
// "Full" at 100%). Range is the actionable half of the fuel story, so only
// the level takes the gauge color.
function FuelBar({
  gauge,
  range,
  unit,
}: {
  gauge: FuelGauge;
  range: number;
  unit: DistanceUnit;
}) {
  const fillColor = FUEL_COLORS[gauge.level];
  const rangeText = `${range.toLocaleString()} ${unit}`;
  return (
    <Card style={[styles.cardPadding, styles.fuelCard]}>
      <View style={styles.fuelHeader}>
        <View style={styles.fuelLabel}>
          <Icon name={gauge.symbol} size={17} tint={fillColor} />
          <ThemedText type="smallBold" themeColor="secondaryLabel">
            {gauge.label}
          </ThemedText>
        </View>
        <View style={styles.fuelValueRow}>
          <ThemedText
            type="smallBold"
            style={[styles.tabularNums, { color: fillColor }]}
          >
            {gauge.valueText}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.tabularNums}>
            {` · ${rangeText}`}
          </ThemedText>
        </View>
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
  );
}

function TripCell({
  label,
  distance,
  unit,
}: {
  label: string;
  distance: number;
  unit: DistanceUnit;
}) {
  return (
    <View style={styles.tripCell}>
      <ThemedText type="smallBold" themeColor="secondaryLabel">
        {label}
      </ThemedText>
      <View style={styles.metricValueRow}>
        <ThemedText style={styles.tripValue}>
          {/* Trips arrive with dashboard precision (e.g. 272.1) — keep the
              tenths instead of rounding them away. */}
          {distance.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </ThemedText>
        <ThemedText type="small" themeColor="secondaryLabel">
          {unit}
        </ThemedText>
      </View>
    </View>
  );
}

// Odometer and trip meters are one instrument cluster in the car, so they share
// one card: lifetime total beside the resettable Trip A/B pair.
function OdometerCard({
  odometer,
  tripA,
  tripB,
  unit,
}: {
  odometer: number;
  tripA: number;
  tripB: number;
  unit: DistanceUnit;
}) {
  return (
    <Card style={[styles.cardPadding, styles.odometerCard]}>
      {/* Lifetime total and the two resettable trips share one size; the
          trips sit on a gentle fill so the resettable pair reads as a unit
          apart from the total. */}
      <View style={styles.tripCell}>
        <View style={styles.odometerHeader}>
          <Icon name="gauge.with.dots.needle.67percent" size={17} />
          <ThemedText type="smallBold" themeColor="secondaryLabel">
            Odometer
          </ThemedText>
        </View>
        <View style={styles.metricValueRow}>
          <ThemedText style={styles.tripValue}>
            {odometer.toLocaleString()}
          </ThemedText>
          <ThemedText type="small" themeColor="secondaryLabel">
            {unit}
          </ThemedText>
        </View>
      </View>
      <View style={styles.tripsGroup}>
        <TripCell label="Trip A" distance={tripA} unit={unit} />
        <TripCell label="Trip B" distance={tripB} unit={unit} />
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
  if (door.locked === true) {
    return { text: "Door locked", color: green, symbol: "lock.fill" };
  }
  // Position known (closed) but no lock reading.
  return { text: "Door closed", color: green, symbol: "checkmark.circle.fill" };
}

// Windows carry only a position, so one without a state has nothing to say —
// callers skip it rather than render a guess.
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
        {corner.door && (corner.door.state || corner.door.locked !== undefined) ? (
          <StatusLine status={doorStatus(corner.door)} />
        ) : null}
        {/* A window with no position reading has nothing to report. */}
        {corner.window?.state ? (
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

function DefrostToggle({
  label,
  symbol,
  parameter,
  disabled,
  onToggle,
}: {
  label: string;
  symbol: SFSymbol;
  parameter?: AcParameter;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  if (!parameter) {
    return null;
  }
  const active = parameter.enabled;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.selectionAsync();
        }
        onToggle(!active);
      }}
      style={styles.defrostToggle}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.defrostChip,
            active && styles.defrostChipOn,
            (pressed || disabled) && { opacity: 0.6 },
          ]}
        >
          <Icon
            name={symbol}
            size={17}
            tint={active ? blue : (colors.secondaryLabel as string)}
          />
          <ThemedText
            type="smallBold"
            themeColor={active ? undefined : "secondaryLabel"}
            style={active && { color: blue }}
          >
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

// The remote-start climate configuration: whether climate runs at all, what
// temperature the cabin heads for, and whether the defrosters run. These are
// settings the car applies on the next remote start — not live actuation —
// which is why the card sits with the controls. Writes are optimistic (see
// useClimateSettings), so the controls respond instantly and never lock up
// while a save is in flight.
function ClimateCard({ vehicle }: { vehicle: Vehicle }) {
  const { settings, defrost, setDefrost, setTemperature, setSettingsOn, error } =
    useClimateSettings(vehicle);
  // The setpoint mid-drag, shown in the readout before the PUT commits on
  // release. A ref backs the commit so onEditingChanged never sees a stale
  // value.
  const [draftTemperature, setDraftTemperature] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);

  useEffect(() => {
    if (error) {
      Alert.alert(
        "Couldn't save climate settings",
        error instanceof Error ? error.message : "The vehicle API rejected the change.",
      );
    }
  }, [error]);

  const on = settings?.settingsOn ?? true;
  // Master switch off dims (and disables) the setpoint and defrost rows; the
  // fade is animated so the optimistic flip doesn't pop.
  const dimStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(on ? 1 : 0.4, { duration: 250 }) }),
    [on],
  );
  // The wire reports the setpoint range in the car's configured unit (°F cars:
  // 65–85 in 1° steps; metric cars report their own °C range), so the slider
  // adapts without any conversion.
  const showSlider =
    settings !== undefined &&
    typeof settings.minTemp === "number" &&
    typeof settings.maxTemp === "number";
  const temperature = draftTemperature ?? settings?.temperature ?? vehicle.climate.temperatureF;
  const unit = `°${settings?.temperatureUnit ?? "F"}`;

  return (
    <Card style={[styles.cardPadding, styles.climateCard]}>
      <View style={styles.climateHeader}>
        <View style={styles.inlineRow}>
          <View style={styles.odometerHeader}>
            <Icon name="thermometer.medium" size={17} tint={blue} />
            <ThemedText type="smallBold" themeColor="secondaryLabel">
              Remote Start Climate
            </ThemedText>
          </View>
          {settings ? (
            <Host matchContents style={styles.climateSwitchHost}>
              <Toggle isOn={on} onIsOnChange={(value) => setSettingsOn(value)} />
            </Host>
          ) : (
            <ThemedText type="smallBold" style={styles.tabularNums}>
              {vehicle.climate.temperatureF}
              {unit}
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="secondaryLabel">
          Settings for when you start your car remotely.
        </ThemedText>
      </View>
      {showSlider ? (
        <Animated.View style={[styles.sliderRow, dimStyle]}>
          {/* A SwiftUI Slider has no intrinsic width, so the host gets an
              explicit flex + height instead of matchContents. */}
          <Host style={styles.slider}>
            <Slider
              min={settings.minTemp}
              max={settings.maxTemp}
              step={settings.tempInterval ?? 1}
              value={settings.temperature}
              onValueChange={(value) => {
                draftRef.current = value;
                setDraftTemperature(value);
              }}
              onEditingChanged={(editing) => {
                if (!editing && draftRef.current !== null) {
                  setTemperature(draftRef.current);
                  draftRef.current = null;
                  setDraftTemperature(null);
                }
              }}
              modifiers={[disabled(!on)]}
            />
          </Host>
          <ThemedText type="smallBold" style={[styles.tabularNums, styles.temperatureReadout]}>
            {temperature.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            {unit}
          </ThemedText>
        </Animated.View>
      ) : null}
      {defrost.front || defrost.rear ? (
        <Animated.View style={[styles.defrostRow, dimStyle]}>
          <DefrostToggle
            label="Front defrost"
            symbol="windshield.front.and.heat.waves"
            parameter={defrost.front}
            disabled={!on}
            onToggle={(enabled) => setDefrost("frontDefrost", enabled)}
          />
          <DefrostToggle
            label="Rear defrost"
            symbol="windshield.rear.and.heat.waves"
            parameter={defrost.rear}
            disabled={!on}
            onToggle={(enabled) => setDefrost("rearDefrost", enabled)}
          />
        </Animated.View>
      ) : null}
    </Card>
  );
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
  const { width } = useWindowDimensions();
  const [forceSkeleton, setForceSkeleton] = useState(false);
  // Set only while a pull-to-refresh is in flight, so its native spinner is the
  // sole indicator during a manual refresh (see autoRefreshing below).
  const [manualRefreshing, setManualRefreshing] = useState(false);

  useEffect(() => {
    // TTI marks the UI shell becoming interactive; data readiness is tracked
    // separately by the vehicle.load events.
    markInteractive();
  }, [markInteractive]);

  // A background refresh (foreground/stale refetch over already-cached data)
  // Tell a user-initiated pull-to-refresh apart from an automatic (foreground /
  // stale) refetch: pull-to-refresh already shows the native refresh control,
  // so only an *automatic* refetch gets our own "Updating…" cue — no double
  // indicator, and nothing crammed into the nav bar's button slot.
  const autoRefreshing = isFetching && !isLoading && !manualRefreshing;

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
        <Stack.Screen options={{ title: "My Lexus", headerRight }} />
        <VehicleSkeleton offline={!vehicle && !isOnline} />
      </>
    );
  }

  if (!vehicle) {
    return (
      <>
        <Stack.Screen options={{ title: "My Lexus", headerRight }} />
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
  const { corners, openings: allOpenings } = groupClosures(vehicle.closures);
  // Openings (moonroof/trunk/hood) only have a position to report, so a sparse
  // snapshot entry without one has nothing to show.
  const openings = allOpenings.filter((opening) => opening.state);
  const tires = vehicle.tires?.positions ?? [];
  const leftTires = tires.filter((t) => /left/i.test(t.label));
  const rightTires = tires.filter((t) => /right/i.test(t.label));
  return (
    <>
      <Stack.Screen options={{ title: vehicle.nickname, headerRight }} />
      <NativeScrollView
        onRefresh={async () => {
          // Mark this as a manual refresh so the "Updating…" footer stays quiet
          // and only the native pull-to-refresh spinner shows.
          setManualRefreshing(true);
          try {
            // Climate settings live in their own query and can change out from
            // under us (the official Lexus app edits the same settings), so a
            // manual refresh re-reads them alongside the vehicle.
            await Promise.all([
              refetch(),
              queryClient.refetchQueries({ queryKey: CLIMATE_SETTINGS_QUERY_KEY }),
            ]);
          } finally {
            setManualRefreshing(false);
          }
        }}
        contentContainerStyle={styles.content}
      >
        {!isOnline ? (
          <OfflineBanner detail="Showing the latest data we saved." />
        ) : null}
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

        {/* Status readouts stay above the REMOTE CONTROLS section title so
            they don't read as controls. */}
        <FuelBar
          gauge={fuelGauge(vehicle.fuelType, vehicle.fuelPercent)}
          range={vehicle.range}
          unit={vehicle.distanceUnit}
        />

        <OdometerCard
          odometer={vehicle.odometer}
          tripA={vehicle.tripA}
          tripB={vehicle.tripB}
          unit={vehicle.distanceUnit}
        />

        <VehicleControls vehicle={vehicle} />

        <ClimateCard vehicle={vehicle} />

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
            <SectionTitle style={styles.sectionTitleSpacing}>TIRE PRESSURE</SectionTitle>
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

        {/* Peek & pop: long-press previews the live map; tapping (the card or
            the peek) pops open the map sheet. Link.Trigger (without asChild)
            wraps the card in a native Text, so an inline View won't stretch —
            pin the card to the content width to keep it full-bleed. */}
        <Link href="/status/map">
          <Link.Trigger>
            <Card
              style={[
                styles.cardPadding,
                styles.inlineCard,
                { width: width - Spacing.three * 2 },
              ]}
            >
              <View style={styles.odometerHeader}>
                <Icon name="parkingsign.circle.fill" size={17} tint={blue} />
                <ThemedText type="smallBold" themeColor="secondaryLabel">
                  Last parked
                </ThemedText>
              </View>
              <View style={styles.lastParkedAction}>
                <ThemedText type="smallBold" style={{ color: blue }}>
                  View map
                </ThemedText>
                <Icon name="chevron.right" size={12} tint={blue} />
              </View>
            </Card>
          </Link.Trigger>
          <Link.Preview style={{ width: width - Spacing.three * 2, height: 260 }}>
            <CarLocationMap
              latitude={vehicle.location.latitude}
              longitude={vehicle.location.longitude}
              label={vehicle.nickname}
            />
          </Link.Preview>
        </Link>

        <View style={styles.footer}>
          <Host matchContents style={styles.footerHost}>
            <VStack alignment="center" spacing={Spacing.half}>
              <FooterTimeRow
                label={`Vehicle last synced with Lexus ${relativeTime(
                  vehicle.updatedAt,
                )}.`}
                timestamp={vehicle.updatedAt}
              />
              {/* During an automatic (non-pull-to-refresh) refresh, the data
                  freshness line becomes a quiet "Updating…" — the one bit of
                  state we actually have — then returns to the timestamp. */}
              {autoRefreshing ? (
                <Text
                  modifiers={[
                    font({ textStyle: "footnote", weight: "regular" }),
                    foregroundStyle({ type: "hierarchical", style: "secondary" }),
                  ]}
                >
                  Updating…
                </Text>
              ) : (
                <FooterTimeRow
                  label={`Lexy has data from ${relativeTime(dataUpdatedAt)}.`}
                  timestamp={dataUpdatedAt}
                />
              )}
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
  fuelValueRow: {
    flexDirection: "row",
    alignItems: "center",
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
  // Label-left / value-right single-row cards (climate setpoint, last parked).
  inlineCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Trailing "View map ›" affordance on the Last parked card.
  lastParkedAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half,
  },
  // Same row shape as inlineCard, for rows inside a multi-row card.
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Generous gaps between the header, slider, and defrost rows so each tap
  // target is comfortably distinct.
  climateCard: {
    gap: Spacing.three,
  },
  climateHeader: {
    gap: Spacing.one,
  },
  climateSwitchHost: {
    backgroundColor: "transparent",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  slider: {
    flex: 1,
    height: 28,
    backgroundColor: "transparent",
  },
  // Widest plausible readout ("29.5°C") reserves its slot so the slider
  // doesn't resize as the number changes width.
  temperatureReadout: {
    minWidth: 52,
    textAlign: "right",
  },
  defrostRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  defrostToggle: {
    flex: 1,
  },
  defrostChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.subtleFill,
  },
  defrostChipOn: {
    backgroundColor: "rgba(0,122,255,0.15)",
  },
  odometerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  odometerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  // The resettable pair, set apart from the lifetime total by the gentlest
  // system fill. Flexed wider than the odometer column (2:1) so both trips
  // fit inside the inset.
  tripsGroup: {
    flex: 2,
    flexDirection: "row",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: colors.subtleFill,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  tripRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  tripCell: {
    flex: 1,
    gap: Spacing.one,
  },
  tripValue: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  tabularNums: {
    fontVariant: ["tabular-nums"],
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
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
