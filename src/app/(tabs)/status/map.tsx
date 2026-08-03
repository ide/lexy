import { Button, Host, Text } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, font, frame } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VehicleLocationMap } from "@/features/vehicle/vehicle-location-map";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { observedAt, relativeTime } from "@/data/time";
import { useMapsProvider } from "@/hooks/use-maps-provider";
import { useNow } from "@/hooks/use-now";
import { useParkingAddress } from "@/hooks/use-parking-address";
import { useVehicle } from "@/hooks/use-vehicle";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

export default function VehicleLocationSheet() {
  const { vehicle, dataUpdatedAt } = useVehicle();
  // This sheet is pushed over the status screen and can sit open for a while,
  // so its own clock — the screen underneath has stopped ticking while blurred.
  const now = useNow();
  const { data: parkingAddress } = useParkingAddress(vehicle?.location);
  const { resolved, openInMaps } = useMapsProvider();
  const insets = useSafeAreaInsets();

  useMarkInteractive();

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
    resolved?.kind === "ready" ? `Open in ${resolved.provider.name}` : "Open in Maps";
  // No installed apps: the button looks inert but still explains on tap.
  const actionable = resolved?.kind !== "none";

  return (
    <View style={styles.container}>
      {/* The screen title ("Last Parked") lives in the native stack header; this
          is the address subtitle and the freshness line beneath it. */}
      <View style={styles.subheader}>
        {/* The address line always occupies its slot — a blank line while
            reverse geocoding resolves — so the map and button don't shift
            down when the text arrives a beat after the sheet opens. */}
        <ThemedText style={styles.address}>{parkingAddress ?? " "}</ThemedText>
        <ThemedText type="small" themeColor="secondaryLabel">
          {`Location as of ${relativeTime(observedAt(vehicle.updatedAt, dataUpdatedAt), now)}`}
        </ThemedText>
      </View>

      <View style={styles.mapFrame}>
        <VehicleLocationMap latitude={latitude} longitude={longitude} label={vehicle.nickname} />
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
        <Host style={styles.buttonHost}>
          <Button
            onPress={() => openInMaps({ latitude, longitude, label: vehicle.nickname })}
            modifiers={[
              buttonStyle(actionable ? "borderedProminent" : "bordered"),
              controlSize("large"),
              frame({ maxWidth: Infinity }),
            ]}
          >
            <Text modifiers={[font({ textStyle: "body", weight: "semibold" })]}>{buttonLabel}</Text>
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
  subheader: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
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
