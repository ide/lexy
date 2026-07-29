import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useObserve } from "expo-observe";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAuth } from "@/auth/auth-context";
import {
  DevSkeletonToggle,
  SHOW_DEV_SKELETON_TOGGLE,
} from "@/components/dev-skeleton-toggle";
import { DetailsSkeleton } from "@/components/details-skeleton";
import { NativeScrollView } from "@/components/native-scroll-view";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemedText } from "@/components/themed-text";
import { VehicleError } from "@/components/vehicle-state";
import { Spacing, colors } from "@/constants/theme";
import { useIsOnline } from "@/hooks/use-is-online";
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

function SignOutButton() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const red = colors.systemRed as string;

  const handleSignOut = () => {
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // signOut clears the stored session; the Stack.Protected guard in the root
    // layout then swaps back to the sign-in screen. No manual navigation.
    signOut().catch(() => {
      // Clearing the Keychain is best-effort; if it fails the user stays
      // signed in and can retry.
    });
  };

  return (
    <Pressable onPress={handleSignOut}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            styles.signOut,
            { backgroundColor: theme.card },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="rectangle.portrait.and.arrow.right" tint={red} />
          <ThemedText type="smallBold" style={{ color: red }}>
            Sign Out
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

export default function CarDetails() {
  const theme = useTheme();
  const { data: vehicle, error, isLoading, refetch } = useVehicle();
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
        <Stack.Screen options={{ title: "Details", headerRight }} />
        <DetailsSkeleton offline={!vehicle && !isOnline} />
      </>
    );
  }

  if (!vehicle) {
    return (
      <>
        <Stack.Screen options={{ title: "Details", headerRight }} />
        <VehicleError
          message={
            error instanceof Error
              ? error.message
              : "The vehicle API did not return data."
          }
          retry={() => refetch()}
        />
      </>
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
    <>
      <Stack.Screen options={{ title: "Details", headerRight }} />
      <NativeScrollView contentContainerStyle={styles.content}>
        {!isOnline ? (
          <OfflineBanner message="No internet connection — showing last saved data" />
        ) : null}
        <View>
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
        </View>

        <View>
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
        </View>

        <View>
          <SectionTitle>TRIPS</SectionTitle>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <InfoRow label="Trip A" value={`${vehicle.tripAMiles} mi`} />
            <InfoRow label="Trip B" value={`${vehicle.tripBMiles} mi`} last />
          </View>
        </View>

        <View>
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
        </View>

        <View>
          <SectionTitle>ACCOUNT</SectionTitle>
          <SignOutButton />
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
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
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
