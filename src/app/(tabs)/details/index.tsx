import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";

import { Card } from "@/components/card";
import { Icon } from "@/components/icon";
import { SwiftUIScrollView, RNSection } from "@/components/swiftui-scroll-view";
import { Redactable } from "@/components/redactable";
import { RefreshingNote } from "@/components/refreshing-note";
import { SectionTitle } from "@/components/section-title";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { openLexusApp } from "@/data/lexus-app";
import { useIsAutoRefreshing } from "@/hooks/use-vehicle-auto-refresh";
import { useVehicleScreen } from "@/hooks/use-vehicle-screen";

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
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
  const { vehicle, redaction, headerRight, errorScreen, statusBanner } = useVehicleScreen();
  const autoRefreshing = useIsAutoRefreshing();

  if (errorScreen) {
    return (
      <>
        <Stack.Screen options={{ title: "Specs", headerRight }} />
        {errorScreen}
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
      <Stack.Screen options={{ title: "Specs", headerRight }} />
      {/* The scroll view and the floating note share this box so the note
          can hang over the content without displacing any of it. */}
      <View style={styles.screen}>
        <SwiftUIScrollView>
          <RNSection style={styles.content}>
            {statusBanner}
            <Redactable reason={redaction} style={styles.group}>
              <View>
                <SectionTitle>VEHICLE</SectionTitle>
                <Card style={styles.rowCard}>
                  {spec.map(([label, value], i) => (
                    <InfoRow key={label} label={label} value={value} last={i === spec.length - 1} />
                  ))}
                </Card>
              </View>

              <View>
                <SectionTitle>REMOTE CAPABILITIES</SectionTitle>
                <Card style={[styles.rowCard, styles.grid]}>
                  {vehicle.capabilities.map((c) => (
                    <View key={c.label} style={styles.capability}>
                      <Icon name={c.symbol} size={20} tint={colors.systemBlue} />
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
                              borderBottomColor: colors.separator,
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
                            style={subscription.active ? { color: colors.systemGreen } : undefined}
                          >
                            {subscription.status}
                          </ThemedText>
                        </View>
                      );
                    })}
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openLexusApp("/shop")}
                      style={styles.manageRow}
                    >
                      {({ pressed }) => (
                        <ThemedText
                          type="linkPrimary"
                          style={[styles.manageText, pressed && { opacity: 0.6 }]}
                        >
                          Manage your subscriptions in the Lexus app
                        </ThemedText>
                      )}
                    </Pressable>
                  </Card>
                </View>
              ) : null}
            </Redactable>
          </RNSection>
        </SwiftUIScrollView>
        {/* This screen has no pull-to-refresh of its own, so the note is the
          only sign that the vehicle data is being re-read. */}
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
    paddingBottom: Spacing.six,
  },
  // The Redactable wrapper groups the sections into one child of the scroll
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
  // Two even columns: each cell takes half the row (grow from an equal basis)
  // so the second column starts at the true midline.
  capability: {
    flexBasis: "40%",
    flexGrow: 1,
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
