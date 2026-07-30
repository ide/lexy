import { Button, Host, Image, Text } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, font, frame } from "@expo/ui/swift-ui/modifiers";
import { useObserve } from "expo-observe";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarLocationMap } from "@/components/car-location-map";
import { ThemedText } from "@/components/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { relativeTime } from "@/data/vehicle";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { useParkingAddress } from "@/hooks/use-parking-address";
import { useVehicle } from "@/hooks/use-vehicle";

export default function CarLocationSheet() {
  const { data: vehicle } = useVehicle();
  const { data: parkingAddress } = useParkingAddress(vehicle?.location);
  const { resolved, openInMaps } = useMapsProvider();
  const { markInteractive } = useObserve();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);

  if (!vehicle) {
    // The sheet is only reachable from the Status screen, which already holds a
    // loaded vehicle, so this is a defensive placeholder rather than a real
    // loading state.
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText themeColor="secondaryLabel">Location unavailable</ThemedText>
      </View>
    );
  }

  const { latitude, longitude } = vehicle.location;
  // "Open in <app>" once a provider is resolved; otherwise the neutral "Open in
  // Maps" (which prompts the chooser, or explains when nothing is installed).
  const buttonLabel =
    resolved?.kind === "ready"
      ? `Open in ${resolved.provider.name}`
      : "Open in Maps";
  // No installed apps: the button looks inert but still explains on tap.
  const actionable = resolved?.kind !== "none";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText style={styles.title}>Last Parked</ThemedText>
          {parkingAddress ? (
            <ThemedText style={styles.address}>{parkingAddress}</ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="secondaryLabel">
            {`Location as of ${relativeTime(vehicle.updatedAt)}`}
          </ThemedText>
        </View>
        <Host style={styles.closeHost} matchContents>
          <Button onPress={() => router.back()} modifiers={[buttonStyle("plain")]}>
            <Image
              systemName="xmark.circle.fill"
              size={28}
              color={colors.secondaryLabel as string}
            />
          </Button>
        </Host>
      </View>

      <View style={styles.mapFrame}>
        <CarLocationMap
          latitude={latitude}
          longitude={longitude}
          label={vehicle.nickname}
        />
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}
      >
        <Host style={styles.buttonHost}>
          <Button
            onPress={() => openInMaps({ latitude, longitude, label: vehicle.nickname })}
            modifiers={[
              buttonStyle(actionable ? "borderedProminent" : "bordered"),
              controlSize("large"),
              frame({ maxWidth: Infinity }),
            ]}
          >
            <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>
              {buttonLabel}
            </Text>
          </Button>
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  // Sized to the 28pt SF Symbol so the plain button hugs the glyph in the
  // top-right corner instead of stretching across the row.
  closeHost: {
    width: 28,
    height: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  address: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  // The map is inset from the sheet's rounded corners (title above, button bar
  // below) and clipped so its own square corners never poke past the sheet.
  mapFrame: {
    flex: 1,
    marginHorizontal: Spacing.three,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.fill,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  buttonHost: {
    height: 50,
    backgroundColor: "transparent",
  },
});
