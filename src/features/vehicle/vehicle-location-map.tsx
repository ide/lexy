import { AppleMaps } from "expo-maps";
import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/ui/themed-text";
import { colors } from "@/constants/theme";

// Zoom level for the parked-car map: close enough to read the street the car is
// on without losing the surrounding block for orientation.
const DEFAULT_ZOOM = 16;

// MapKit draws its first tiles a beat after the view mounts and snaps them in at
// full strength, which reads as a pop — worst on the hero card, where the map is
// the backdrop the rest of the card sits on. Expo Maps exposes no "tiles are
// drawn" callback, so hold the map at zero and fade it in on the first
// `onCameraMove`: SwiftUI fires that once the map has laid out and settled on
// its starting viewport, the closest signal we get to "there is something to
// show". Short enough to read as the map arriving, not as a loading state.
const FADE_IN_MS = 320;
// Backstop in case the camera event never arrives (a mount that never settles, a
// future Expo Maps that drops the initial fire). Better a slightly late fade
// than a map that never appears.
const FADE_IN_FALLBACK_MS = 700;

/**
 * An Apple Maps view centered on the car's last-parked coordinates with a
 * single car marker. Shared by the map sheet and its peek/pop preview so both
 * show exactly the same map. iOS only — Apple Maps is the only platform Expo
 * Maps supports for `AppleMaps`, and Lexy is an iOS app.
 */
export function VehicleLocationMap({
  latitude,
  longitude,
  label,
  showMarker = true,
  showPlaces = true,
  style,
}: {
  latitude: number;
  longitude: number;
  label: string;
  showMarker?: boolean;
  // Apple Maps' built-in points of interest (business/landmark labels). They
  // load a beat after the base map tiles, so they "pop in" separately; the hero
  // map hides them for a calmer backdrop while the full sheet keeps them.
  showPlaces?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0);
  // The fade runs once per mount: `onCameraMove` keeps firing whenever the
  // camera settles, and the fallback timer races it.
  const faded = useRef(false);
  const fadeIn = useCallback(() => {
    if (faded.current) {
      return;
    }
    faded.current = true;
    opacity.value = withTiming(1, { duration: FADE_IN_MS });
  }, [opacity]);

  useEffect(() => {
    const timer = setTimeout(fadeIn, FADE_IN_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [fadeIn]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (Platform.OS !== "ios") {
    return (
      <View style={[styles.fallback, style]}>
        <ThemedText themeColor="secondaryLabel">Maps are only available on iOS.</ThemedText>
      </View>
    );
  }

  return (
    // The fade lives on a wrapper rather than on the map itself: the Slot host
    // below takes a single flattened style, and the wrapper is now also what a
    // caller's sizing style lands on (the map just fills it).
    <Animated.View style={[styles.map, style, fadeStyle]}>
      <AppleMaps.View
        // Flattened because AppleMaps.View renders through a Slot host that
        // rejects array styles (dev-mode "array of styles to a child of <Slot>"
        // render error).
        style={StyleSheet.flatten(styles.map)}
        cameraPosition={{
          coordinates: { latitude, longitude },
          zoom: DEFAULT_ZOOM,
        }}
        // Doubles as the readiness signal for the fade above.
        onCameraMove={fadeIn}
        markers={
          showMarker
            ? [
                {
                  coordinates: { latitude, longitude },
                  title: label,
                  systemImage: "car.fill",
                  tintColor: colors.systemBlue,
                },
              ]
            : []
        }
        properties={{
          // An empty `including` list hides every built-in point of interest (the
          // MapKit place labels) without touching our own car marker above.
          ...(showPlaces ? null : { pointsOfInterest: { including: [] } }),
        }}
        uiSettings={{
          // The map is a compact glanceable view, not a full navigation surface:
          // hide every built-in control so nothing floats over the corners. The
          // my-location button is the one Apple draws in the top-right; the car
          // marker already fixes the frame on the parked spot, so locating the
          // user (which we don't track here) would do nothing useful.
          compassEnabled: false,
          myLocationButtonEnabled: false,
          scaleBarEnabled: false,
          togglePitchEnabled: false,
        }}
      />
    </Animated.View>
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
