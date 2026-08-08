import { Button, Host } from "@expo/ui";
import { defaultMinSize, fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertHost, type AlertSpec } from "@/components/ui/alert-host";
import { Card } from "@/components/ui/card";
import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";
import { geoUri } from "@/data/maps-providers";
import { observedAt, relativeTime } from "@/data/time";
import { useNow } from "@/hooks/use-now";
import { useParkingAddress } from "@/hooks/use-parking-address";
import { useVehicle } from "@/hooks/use-vehicle";
import { haptic } from "@/utils/haptics";
import { useMarkInteractive } from "@/hooks/use-mark-interactive";

/**
 * The Android Last Parked screen. Same data and structure as the iOS sheet,
 * with the two platform divergences the spec records: the map slot is an
 * empty surface until the project has a Google Maps key (the map view
 * deliberately refuses to draw unkeyed), and the hand-off is a `geo:` intent
 * — Android's own default-app resolution — rather than an in-app provider
 * chooser, so the button is always the neutral "Open in Maps".
 */
export default function VehicleLocationScreen() {
  const { vehicle, dataUpdatedAt } = useVehicle();
  // Its own clock — this screen can sit open for a while, and the screen
  // underneath has stopped ticking while blurred.
  const now = useNow();
  const { data: parkingAddress } = useParkingAddress(vehicle?.location);
  const insets = useSafeAreaInsets();
  const [alert, setAlert] = useState<AlertSpec | null>(null);

  useMarkInteractive();

  if (!vehicle) {
    // Only reachable from the Status screen, which already holds a loaded
    // vehicle — a defensive placeholder rather than a real loading state.
    return (
      <View style={[styles.container, styles.centered]}>
        <ThemedText themeColor="secondaryLabel">Location unavailable</ThemedText>
      </View>
    );
  }

  const { latitude, longitude } = vehicle.location;

  const open = async () => {
    haptic("impact-light");
    try {
      // The system resolves the intent: the user's default navigation app, or
      // Android's own chooser when none is set. No handler rejects.
      await Linking.openURL(geoUri({ latitude, longitude, label: vehicle.nickname }));
    } catch {
      setAlert({
        title: "No maps app installed",
        message:
          "Install a navigation app that can open locations — Google Maps or Waze, for example — to get directions to your vehicle.",
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* The address line always occupies its slot — a blank line while the
          lookup resolves — so the content below doesn't shift when it lands. */}
      <ThemedText style={styles.address}>{parkingAddress ?? " "}</ThemedText>
      <ThemedText type="small" themeColor="secondaryLabel">
        {`Location as of ${relativeTime(observedAt(vehicle.updatedAt, dataUpdatedAt), now)}`}
      </ThemedText>

      {/* The map's slot, kept at the map's size so the screen's shape is
          final. The backdrop returns when the Google Maps key exists. */}
      <Card style={styles.mapSlot}>
        <ThemedText type="small" themeColor="tertiaryLabel">
          Map preview coming to Android
        </ThemedText>
      </Card>

      <View style={{ paddingBottom: insets.bottom + Spacing.three }}>
        <Host style={styles.buttonHost}>
          <Button
            variant="filled"
            label="Open in Maps"
            onPress={open}
            modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 })]}
          />
        </Host>
      </View>
      <AlertHost alert={alert} onDismiss={() => setAlert(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  address: {
    marginTop: Spacing.two,
  },
  mapSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.one,
  },
  // Pinned, not measured: fillMaxWidth inside a wrap-content host has nothing
  // to fill, so the host supplies the bounds (same pattern as the dashboard's
  // Compose slots).
  buttonHost: {
    width: "100%",
    height: 56,
  },
});
