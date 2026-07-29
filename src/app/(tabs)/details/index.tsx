import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useObserve } from "expo-observe";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { Card } from "@/components/card";
import {
  DevSkeletonToggle,
  SHOW_DEV_SKELETON_TOGGLE,
} from "@/components/dev-skeleton-toggle";
import { Icon } from "@/components/icon";
import { NativeScrollView } from "@/components/native-scroll-view";
import { OfflineBanner } from "@/components/offline-banner";
import { Redacted } from "@/components/redacted";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { NoVehicleState, VehicleError } from "@/components/vehicle-state";
import { Spacing, colors } from "@/constants/theme";
import { PLACEHOLDER_VEHICLE } from "@/data/placeholder-vehicle";
import { NoVehicleError } from "@/data/vehicle";
import { useIsOnline } from "@/hooks/use-is-online";
import { useTheme } from "@/hooks/use-theme";
import { useVehicle } from "@/hooks/use-vehicle";

// The Lexus OneApp App Store entry (iOS app com.lexus.oneApp). Hard fallback if
// the universal link below can't be opened at all.
const LEXUS_APP_STORE_URL = "https://apps.apple.com/us/app/lexus/id1468484450";
// Universal link on the Lexus app's associated domain. Confirmed from the app's
// apple-app-site-association at ctlexusapp.com, which claims all paths for
// appIDs FEL7N4H72G.com.lexus.oneApp / com.lexus.OneAppEnterprise. Opening it
// launches the installed app directly; ctlexusapp.com is a Branch-hosted domain,
// so when the app isn't installed it redirects to the App Store — one URL covers
// both cases without guessing a custom scheme.
const LEXUS_APP_LINK = "https://ctlexusapp.com/";

// "Manage your subscription in the Lexus app": open the Lexus app if it's
// installed, otherwise (via the Branch domain's redirect) its App Store page.
async function openManageSubscription() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  try {
    await Linking.openURL(LEXUS_APP_LINK);
  } catch {
    await Linking.openURL(LEXUS_APP_STORE_URL);
  }
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
  const { data, error, isLoading, refetch } = useVehicle();
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

  // A single redacted state covers every "no vehicle yet" case: the dev
  // override, the first-load fetch, and offline-before-anything-cached (with a
  // banner). Only a settled, online, data-less result is a real error.
  const loading = forceSkeleton || (!data && (isLoading || !isOnline));

  if (!loading && !data) {
    return (
      <>
        <Stack.Screen options={{ title: "Specs", headerRight }} />
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

  // While loading, the real tree below renders placeholder data redacted into
  // neutral bars (see `Redacted`). One tree, one scroll container: the layout
  // cannot drift from itself, sizes are identical in both states, and toggling
  // reconciles in place so the scroll offset is preserved.
  const vehicle = loading ? PLACEHOLDER_VEHICLE : data!;

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
    <>
      <Stack.Screen options={{ title: "Details", headerRight }} />
      <NativeScrollView contentContainerStyle={styles.content}>
        {!isOnline ? (
          <OfflineBanner
            message={
              data
                ? "No internet connection — showing last saved data"
                : "No internet connection — connect to load your vehicle"
            }
          />
        ) : null}
        <Redacted loading={loading} style={styles.group}>
          <View>
            <SectionTitle>VEHICLE</SectionTitle>
            <Card style={styles.rowCard}>
              {spec.map(([label, value], i) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === spec.length - 1}
                />
              ))}
            </Card>
          </View>

          <View>
            <SectionTitle>REMOTE CAPABILITIES</SectionTitle>
            <Card style={[styles.rowCard, styles.grid]}>
              {vehicle.capabilities.map((c) => (
                <View key={c.label} style={styles.capability}>
                  <Icon name={c.symbol} size={20} tint={colors.systemBlue as string} />
                  <ThemedText type="small" style={styles.capabilityLabel}>
                    {c.label}
                  </ThemedText>
                </View>
              ))}
            </Card>
          </View>

          {/* Connected Services renders only when the vehicle-subscriptions
              read returned rows; an empty list keeps the section hidden. */}
          {vehicle.subscriptions.length > 0 ? (
            <View>
              <SectionTitle>CONNECTED SERVICES</SectionTitle>
              <Card style={styles.rowCard}>
                {vehicle.subscriptions.map((subscription) => {
                  // Trials read "Trial expires …"; a paid/complimentary service
                  // reads "Expires …" only when it has an end date.
                  const detail = subscription.expires
                    ? `${subscription.trial ? "Trial expires" : "Expires"} ${subscription.expires}`
                    : subscription.trial
                      ? "Trial"
                      : null;
                  return (
                    <View
                      key={subscription.name}
                      style={[
                        styles.serviceRow,
                        {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.separator,
                        },
                      ]}
                    >
                      <View style={styles.serviceInfo}>
                        <ThemedText type="small">{subscription.name}</ThemedText>
                        {detail ? (
                          <ThemedText type="small" themeColor="secondaryLabel">
                            {detail}
                          </ThemedText>
                        ) : null}
                      </View>
                      {/* Active = green. Inactive is muted (secondary label),
                          never red — an ended service is not an error. */}
                      <ThemedText
                        type="smallBold"
                        themeColor={subscription.active ? undefined : "secondaryLabel"}
                        style={
                          subscription.active
                            ? { color: colors.systemGreen }
                            : undefined
                        }
                      >
                        {subscription.status}
                      </ThemedText>
                    </View>
                  );
                })}
                <Pressable
                  accessibilityRole="link"
                  onPress={openManageSubscription}
                  style={styles.manageRow}
                >
                  {({ pressed }) => (
                    <ThemedText
                      type="linkPrimary"
                      style={[
                        styles.manageText,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      Manage your subscription in the Lexus app
                    </ThemedText>
                  )}
                </Pressable>
              </Card>
            </View>
          ) : null}
        </Redacted>
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
  // The Redacted wrapper groups the sections into one child of the scroll
  // content, so it re-applies the container's section gap inside itself.
  group: {
    gap: Spacing.three,
  },
  rowCard: {
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
  serviceInfo: {
    flexShrink: 1,
  },
  manageRow: {
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
  manageText: {
    textAlign: "center",
  },
});
