import { AppleMaps } from "expo-maps";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { colors } from "@/constants/theme";

// Zoom level for the parked-car map: close enough to read the street the car is
// on without losing the surrounding block for orientation.
const DEFAULT_ZOOM = 16;

/**
 * An Apple Maps view centered on the car's last-parked coordinates with a
 * single car marker. Shared by the map sheet and its peek/pop preview so both
 * show exactly the same map. iOS only — Apple Maps is the only platform Expo
 * Maps supports for `AppleMaps`, and Lexy is an iOS app.
 */
export function CarLocationMap({
  latitude,
  longitude,
  label,
  style,
}: {
  latitude: number;
  longitude: number;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS !== "ios") {
    return (
      <View style={[styles.fallback, style]}>
        <ThemedText themeColor="secondaryLabel">
          Maps are only available on iOS.
        </ThemedText>
      </View>
    );
  }

  return (
    <AppleMaps.View
      style={[styles.map, style]}
      cameraPosition={{
        coordinates: { latitude, longitude },
        zoom: DEFAULT_ZOOM,
      }}
      markers={[
        {
          coordinates: { latitude, longitude },
          title: label,
          systemImage: "car.fill",
          tintColor: colors.systemBlue as string,
        },
      ]}
      uiSettings={{
        // The map is a compact glanceable view, not a full navigation surface;
        // hide the scale bar and pitch toggle to keep it clean.
        scaleBarEnabled: false,
        togglePitchEnabled: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
});
