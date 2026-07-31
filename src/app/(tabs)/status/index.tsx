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
import { OpeningCard, SideGrid, StaleNote } from "@/components/closures-grid";
import { FuelBar } from "@/components/fuel-bar";
import { HeroCard } from "@/components/hero-card";
import { NativeScrollView } from "@/components/native-scroll-view";
import { OdometerCard } from "@/components/odometer-card";
import { Redactable } from "@/components/redactable";
import { SectionTitle } from "@/components/section-title";
import { TirePressureCard } from "@/components/tire-pressure-card";
import { TwoColumnGrid } from "@/components/two-column-grid";
import { VehicleControls } from "@/components/vehicle-controls";
import { Spacing } from "@/constants/theme";
import { cornerShownAts, oldestStale } from "@/data/closure-display";
import { groupClosures } from "@/data/closures";
import { fuelGauge } from "@/data/fuel";
import { queryClient } from "@/data/query-client";
import { refreshVehicleStatus } from "@/data/refresh-status-sender";
import { absoluteLocalTime, relativeTime } from "@/data/vehicle";
import { CLIMATE_SETTINGS_QUERY_KEY } from "@/hooks/use-climate-settings";
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
  const { query, vehicle, redaction, headerRight, errorScreen, statusBanner } = useVehicleScreen();
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = query;
  const { session, runAuthorized } = useAuth();
  // Set only while a pull-to-refresh is in flight, so its native spinner is the
  // sole indicator during a manual refresh (see autoRefreshing below).
  const [manualRefreshing, setManualRefreshing] = useState(false);

  // Tell a user-initiated pull-to-refresh apart from an automatic (foreground /
  // stale) refetch: pull-to-refresh already shows the native refresh control,
  // so only an *automatic* refetch gets our own "Updating…" cue — no double
  // indicator, and nothing crammed into the nav bar's button slot.
  const autoRefreshing = isFetching && !isLoading && !manualRefreshing;

  const refresh = async () => {
    // Mark this as a manual refresh so the "Updating…" footer stays quiet
    // and only the native pull-to-refresh spinner shows.
    setManualRefreshing(true);
    try {
      // A pull is explicit user intent, so prime a fresh full snapshot
      // from the car first (rate-limited — it wakes the telematics unit).
      // That makes the server-side status current, so the refetch's GET
      // returns complete state instead of the last sparse push. If it's
      // rate-limited or fails, the refetch below still runs.
      //
      // Read the context off `data`, never the placeholder: pulling on
      // the skeleton must not address a VIN that isn't a car.
      if (session && data) {
        // The prime signals auth failures (401/403) so runAuthorized can
        // refresh the token and retry it once; any other failure — including a
        // dead session — still falls through to the plain refetch below, which
        // surfaces the real state.
        await runAuthorized((session) =>
          refreshVehicleStatus(session, {
            vin: data.vin,
            brand: data.brand,
            generation: data.generation,
          }),
        ).catch(() => {});
      }
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
  };

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
              label={`Vehicle last synced with Lexus ${relativeTime(vehicle.updatedAt)}.`}
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

          {corners.length > 0 ? (
            <View>
              <SectionTitle style={styles.sectionTitleSpacing}>DOORS & WINDOWS</SectionTitle>
              <SideGrid corners={corners} />
            </View>
          ) : null}

          {openings.length > 0 ? (
            <TwoColumnGrid
              left={openings.filter((_, i) => i % 2 === 0)}
              right={openings.filter((_, i) => i % 2 === 1)}
              keyFor={(o) => o.label}
              renderItem={(o) => <OpeningCard opening={o} />}
            />
          ) : null}

          {/* A single note for the closures area — some readings weren't in the
              latest snapshot (e.g. windows after a drive). */}
          {closuresStaleAt ? <StaleNote at={closuresStaleAt} /> : null}

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
    </>
  );
}

const styles = StyleSheet.create({
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
