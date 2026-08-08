import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { useAuth } from "@/auth/auth-context";
import { AlertHost, type AlertSpec } from "@/components/ui/alert-host";
import { Redactable } from "@/components/ui/redactable";
import { RefreshingNote } from "@/components/ui/refreshing-note";
import { SectionTitle } from "@/components/ui/section-title";
import { RNSection, SwiftUIScrollView } from "@/components/ui/swiftui-scroll-view";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing } from "@/constants/theme";
import { ClimateCard } from "@/features/vehicle/climate-card";
import { ClosuresCard, StaleNote } from "@/features/vehicle/closures-summary";
import { FuelBar } from "@/features/vehicle/fuel-bar";
import { HeroCard } from "@/features/vehicle/hero-card";
import { OdometerCard } from "@/features/vehicle/odometer-card";
import { TirePressureCard } from "@/features/vehicle/tire-pressure-card";
import { VehicleControls } from "@/features/vehicle/vehicle-controls";
import { cornerShownAts, oldestStale } from "@/data/closure-display";
import { groupClosures } from "@/data/closures";
import { fuelGauge } from "@/data/fuel";
import { absoluteLocalTime, observedAt, relativeTime } from "@/data/time";
import { refreshVehicleData } from "@/data/vehicle-refresh";
import { useNow } from "@/hooks/use-now";
import { useIsAutoRefreshing } from "@/hooks/use-vehicle-auto-refresh";
import { useVehicleScreen } from "@/hooks/use-vehicle-screen";

/**
 * A footer sync line whose tap reveals the precise local timestamp behind it.
 *
 * iOS anchors that reveal to the sentence in a popover. Android has no popover:
 * its anchored surface is the Material tooltip, which is a long-press
 * affordance rather than a tap one, and a tooltip that only appears on tap is a
 * control nobody would find. So the reveal is a dialog — the same Material
 * dialog the control buttons confirm through — titled with the line's subject
 * and carrying the timestamp as its body. Recorded under the spec's Platform
 * notes.
 */
function FooterTimeRow({ label, onReveal }: { label: string; onReveal: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onReveal}>
      {({ pressed }) => (
        <ThemedText
          type="small"
          themeColor="secondaryLabel"
          style={[styles.footerLine, pressed && styles.footerLinePressed]}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export default function CarDashboard() {
  const { query, vehicle, dataUpdatedAt, redaction, headerRight, errorScreen, statusBanner } =
    useVehicleScreen();
  const { session, runAuthorized } = useAuth();
  // Only refreshes the app started on its own get our own cues — the floating
  // note and the "Updating…" footer line. A pull-to-refresh already shows the
  // scroll view's refresh control, and the re-reads that confirm a lock command
  // aren't a refresh of stale data at all; announcing either would be
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
  // The precise timestamp a footer line was tapped to reveal.
  const [timestampAlert, setTimestampAlert] = useState<AlertSpec | null>(null);
  const reveal = (subject: string, at: string | number) => () =>
    setTimestampAlert({ title: subject, message: absoluteLocalTime(at) });

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
        <Stack.Screen options={{ title: "My Vehicle", headerRight }} />
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
          placeholder's nickname while loading — "My Vehicle", the generic
          fallback, rather than the tab's "Status" label, which reads oddly as a
          large screen title. */}
      <Stack.Screen options={{ title: vehicle.nickname, headerRight }} />
      {/* The scroll view and the floating note share this box so the note
          can hang over the content without displacing any of it. */}
      <View style={styles.screen}>
        <SwiftUIScrollView
          onRefresh={refresh}
          // The sync lines ride in the scroll view's footer slot, below the
          // content rather than inside it. They are React Native here, so they
          // take their own `Redactable` — which draws them as bars and, because
          // a redacted subtree stops taking touches, closes the reveal along
          // with them.
          nativeFooter={
            <Redactable reason={redaction} style={styles.footer}>
              <FooterTimeRow
                label={`Vehicle last synced with Lexus ${relativeTime(syncedAt, now)}.`}
                onReveal={reveal("Vehicle last synced with Lexus", syncedAt)}
              />
              {/* During an automatic (non-pull-to-refresh) refresh, the data
                  freshness line becomes a quiet "Updating…" — the one bit of
                  state we actually have — then returns to the timestamp. */}
              {autoRefreshing ? (
                <ThemedText type="small" themeColor="secondaryLabel" style={styles.footerLine}>
                  Updating…
                </ThemedText>
              ) : (
                <FooterTimeRow
                  label={`Lexy checked for data ${relativeTime(dataUpdatedAt, now)}.`}
                  onReveal={reveal("Lexy checked for data", dataUpdatedAt)}
                />
              )}
            </Redactable>
          }
        >
          <RNSection style={styles.content}>
            {statusBanner}
            {/* Redaction wraps the content, not the scroll view: around the
                scroll view its `pointerEvents="none"` would take the scrolling
                with it, so the skeleton could not be scrolled at all. Every
                interactive thing inside guards itself anyway — the closures and
                More controls headers are disabled while redacted, the hero's
                button is a flat pill, and the climate controls are
                placeholders. */}
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
                  same read as the sync line below it, and measured from the same
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
          </RNSection>
        </SwiftUIScrollView>
        <RefreshingNote visible={autoRefreshing} />
        <AlertHost alert={timestampAlert} onDismiss={() => setTimestampAlert(null)} />
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
    // The footer below the content carries the bottom spacing now, including
    // the room the tab bar needs.
    paddingBottom: 0,
  },
  group: {
    gap: Spacing.three,
  },
  sectionTitleSpacing: {
    marginTop: Spacing.one,
  },
  footer: {
    alignItems: "center",
    gap: Spacing.half,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
  },
  footerLine: {
    textAlign: "center",
  },
  footerLinePressed: {
    opacity: 0.6,
  },
});
