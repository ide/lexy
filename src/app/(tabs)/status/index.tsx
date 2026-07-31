import { Button, Popover, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  padding,
  redacted,
} from "@expo/ui/swift-ui/modifiers";
import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ClimateCard } from "@/components/climate-card";
import { ClosuresCard, StaleNote } from "@/components/closures-summary";
import { FuelBar } from "@/components/fuel-bar";
import { HeroCard } from "@/components/hero-card";
import { NativeScrollView } from "@/components/native-scroll-view";
import { OdometerCard } from "@/components/odometer-card";
import { Redactable } from "@/components/redactable";
import { RefreshingNote } from "@/components/refreshing-note";
import { SectionTitle } from "@/components/section-title";
import { TirePressureCard } from "@/components/tire-pressure-card";
import { VehicleControls } from "@/components/vehicle-controls";
import { Spacing } from "@/constants/theme";
import { cornerShownAts, oldestStale } from "@/data/closure-display";
import { groupClosures } from "@/data/closures";
import { fuelGauge } from "@/data/fuel";
import { absoluteLocalTime, observedAt, relativeTime } from "@/data/vehicle";
import { refreshVehicleData } from "@/data/vehicle-refresh";
import { useNow } from "@/hooks/use-now";
import { useIsAutoRefreshing } from "@/hooks/use-vehicle-auto-refresh";
import { useVehicleScreen } from "@/hooks/use-vehicle-screen";
import { useAuth } from "@/auth/auth-context";

// A non-bold footer line whose tap reveals the precise local timestamp in a
// native SwiftUI popover — a tooltip anchored to the sentence itself.
function FooterTimeRow({ label, timestamp }: { label: string; timestamp: string | number }) {
  const [isPresented, setIsPresented] = useState(false);
  return (
    <Popover isPresented={isPresented} onIsPresentedChange={setIsPresented}>
      <Popover.Trigger>
        <Button onPress={() => setIsPresented(true)} modifiers={[buttonStyle("plain")]}>
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
  const { query, vehicle, dataUpdatedAt, redaction, headerRight, errorScreen, statusBanner } =
    useVehicleScreen();
  const { session, runAuthorized } = useAuth();
  // Only refreshes the app started on its own get our own cues — the floating
  // note and the "Updating…" footer line. A pull-to-refresh already shows the
  // scroll view's native refresh control, and the re-reads that confirm a lock
  // command aren't a refresh of stale data at all; announcing either would be
  // describing something the user is already watching, or something that isn't
  // happening.
  const autoRefreshing = useIsAutoRefreshing();
  // One clock for the whole screen, so the sync lines and the closures' "some
  // readings as of" are measured from the same instant, and all of them stay
  // true while the screen sits open.
  const now = useNow();
  // The car's own stamp, bounded by the read that carried it — the two clocks
  // are not the same one. See observedAt.
  const syncedAt = observedAt(vehicle.updatedAt, dataUpdatedAt);

  const refresh = () =>
    // A pull is explicit user intent, so it primes: refreshVehicleData wakes
    // the car for a fresh full snapshot (rate-limited) before re-reading, so
    // the GET returns complete state instead of the last sparse push.
    //
    // The context comes from the query, never from the rendered vehicle: while
    // redacted that is the placeholder, and pulling on a skeleton must not
    // address a VIN that isn't a car.
    refreshVehicleData({
      trigger: "manual",
      prime: true,
      context: query.context ?? null,
      runAuthorized: session ? runAuthorized : null,
    });

  if (errorScreen) {
    return (
      <>
        <Stack.Screen options={{ title: "My Lexus", headerRight }} />
        {errorScreen}
      </>
    );
  }

  const { corners, openings: allOpenings } = groupClosures(vehicle.closures);
  // Openings (moonroof/trunk/hood) only have a position to report, so a sparse
  // snapshot entry without one has nothing to show.
  const openings = allOpenings.filter((opening) => opening.state);
  // One staleness note for the whole closures area (a sparse snapshot leaves
  // every window/opening stale at the same time, so per-card notes would just
  // repeat). The oldest reading that predates the latest snapshot drives it.
  const closuresStaleAt = oldestStale(vehicle.updatedAt, [
    ...corners.flatMap(cornerShownAts),
    ...openings.map((opening) => opening.stateAt),
  ]);
  const tires = vehicle.tires?.positions ?? [];
  return (
    <>
      {/* The title is native chrome outside the redacted tree, so it reads the
          placeholder's nickname while loading — "My Lexus", the generic
          fallback, rather than the tab's "Status" label, which reads oddly as a
          large screen title. */}
      <Stack.Screen options={{ title: vehicle.nickname, headerRight }} />
      {/* The scroll view and the floating note share this box so the note
          can hang over the content without displacing any of it. */}
      <View style={styles.screen}>
        <NativeScrollView
          onRefresh={refresh}
          contentContainerStyle={styles.content}
          // The sync lines are SwiftUI, so they ride in the scroll view's own
          // footer slot rather than a `Host` of their own inside the RN content
          // — one less SwiftUI island to measure and lay out. Being genuine
          // SwiftUI, they take the real `redacted` modifier while loading, which
          // also spares them from rendering the placeholder's timestamps as
          // readable sentences; `disabled` keeps the popovers shut, the job the
          // redacted wrapper's `pointerEvents` used to do here.
          nativeFooter={
            <VStack
              alignment="center"
              spacing={Spacing.half}
              modifiers={[
                frame({ maxWidth: Infinity }),
                padding({ top: Spacing.four, bottom: Spacing.six }),
                ...(redaction ? [redacted(), disabled(true)] : []),
              ]}
            >
              <FooterTimeRow
                label={`Vehicle last synced with Lexus ${relativeTime(syncedAt, now)}.`}
                timestamp={syncedAt}
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
                  label={`Lexy has data from ${relativeTime(dataUpdatedAt, now)}.`}
                  timestamp={dataUpdatedAt}
                />
              )}
            </VStack>
          }
        >
          {statusBanner}
          <Redactable reason={redaction} style={styles.group}>
            <HeroCard vehicle={vehicle} />

            {/* Summary readouts stay above the REMOTE CONTROLS section title so
              they don't read as controls. Location comes first, then the energy
              and range available to leave that location. */}
            <FuelBar
              gauge={fuelGauge(vehicle.fuelType, vehicle.fuelPercent)}
              range={vehicle.range}
              unit={vehicle.distanceUnit}
            />

            <VehicleControls vehicle={vehicle} />

            <ClimateCard vehicle={vehicle} />

            {corners.length > 0 || openings.length > 0 ? (
              <View>
                <SectionTitle style={styles.sectionTitleSpacing}>DOORS & WINDOWS</SectionTitle>
                <ClosuresCard corners={corners} openings={openings} />
                {/* A single note for the closures area — some readings weren't in
                  the latest snapshot (e.g. windows after a drive). Bounded by the
                  same read as the sync line above it, and measured from the same
                  `now`, so the reading it names always reads as older than the
                  snapshot that didn't refresh it. */}
                {closuresStaleAt ? (
                  <StaleNote at={observedAt(closuresStaleAt, dataUpdatedAt)} now={now} />
                ) : null}
              </View>
            ) : null}

            {/* Mileage bridges immediate access/security state and longer-term
              running condition (tire pressure) without competing with the
              location/fuel summary at the top. */}
            <View>
              <SectionTitle style={styles.sectionTitleSpacing}>ODOMETER</SectionTitle>
              <OdometerCard
                odometer={vehicle.odometer}
                tripA={vehicle.tripA}
                tripB={vehicle.tripB}
                unit={vehicle.distanceUnit}
              />
            </View>

            {tires.length > 0 ? (
              <View>
                <SectionTitle style={styles.sectionTitleSpacing}>TIRE PRESSURE</SectionTitle>
                <TirePressureCard tires={vehicle.tires!} />
              </View>
            ) : null}
          </Redactable>
        </NativeScrollView>
        <RefreshingNote visible={autoRefreshing} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    // The native footer below the RN content carries the bottom spacing now,
    // including the room the floating tab bar needs.
    paddingBottom: 0,
  },
  // The Redactable wrapper groups the sections into one child of the scroll
  // content, so it re-applies the container's section gap inside itself.
  group: {
    gap: Spacing.three,
  },
  sectionTitleSpacing: {
    marginTop: Spacing.one,
  },
});
