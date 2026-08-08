import { Button, Host } from "@expo/ui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/card";
import { useRedacted } from "@/components/ui/redactable";
import { Spacing, colors } from "@/constants/theme";
import type { Vehicle } from "@/data/vehicle";
import { haptic } from "@/utils/haptics";

/**
 * The hero: the vehicle's own render, with the button that opens the parked
 * map. Only the button navigates.
 *
 * **No map backdrop here.** On iOS the parked-location map fills this card edge
 * to edge and the car is drawn over it; Android's Google Maps view needs a Maps
 * SDK API key the project does not have (see `vehicle-location-map.tsx`, which
 * renders a plain notice off iOS rather than an unkeyed grey grid). Drawing a
 * keyless map here would put a "can't load map" tile behind the car, which is
 * worse than the card simply being the car — so the backdrop waits for the key,
 * and the divergence is recorded under the spec's Platform notes.
 */
export function HeroCard({ vehicle }: { vehicle: Vehicle }) {
  const isRedacted = useRedacted();
  return (
    <Card style={styles.hero}>
      {/* The frame keeps its height while redacted so nothing below it moves;
          the car itself is simply absent, the same as a vehicle whose render
          the CDN hasn't given us. */}
      <View pointerEvents="none" style={styles.heroImageFrame}>
        {isRedacted ? null : (
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={styles.heroImage}
            contentFit="contain"
            transition={200}
            // Memory on top of the default disk cache: the render re-mounts on
            // every visit to the tab, and the disk copy keeps the car visible
            // offline once it has loaded a single time.
            cachePolicy="memory-disk"
          />
        )}
      </View>
      <View style={styles.heroActions}>
        {isRedacted ? (
          // A flat pill in the button's slot. The live button is a Material
          // container with a label inside it, and redacting only the label
          // would leave a bar floating in a filled shell that still looks
          // pressable.
          <View style={[styles.heroAction, styles.heroActionPlaceholder]} />
        ) : (
          // Sized rather than measured, so the row keeps its height whichever
          // of the two is in the slot and the Compose host never reports a
          // different box than the placeholder it replaces.
          <Host style={styles.heroAction}>
            <Button
              variant="filled"
              label="Last Parked"
              onPress={() => {
                haptic("selection");
                router.push("/status/map");
              }}
              style={{ width: BUTTON_WIDTH, height: BUTTON_HEIGHT }}
            />
          </Host>
        )}
      </View>
    </Card>
  );
}

/** The button's slot. Material's medium button height, and room for its label. */
const BUTTON_WIDTH = 148;
const BUTTON_HEIGHT = 48;

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  // The Lexus vehicle render (from the telematics CDN) is a 700x631 PNG whose
  // car only occupies the middle ~46% of the height: it ships with ~26%
  // transparent margin on top and ~28% on the bottom. A plain `contentFit:
  // "contain"` faithfully draws all that empty space, so the car floats small
  // in a sea of whitespace (which reads as excess vertical padding in the card).
  //
  // Fix: clip the image in a fixed-height frame (overflow: hidden) and oversize
  // it (width > 100%) so the car fills the frame and the transparent bands get
  // cropped away instead of rendered. The car sits dead-center in the source,
  // so a symmetric scale needs no translation. aspectRatio matches the source.
  heroImageFrame: {
    width: "100%",
    height: 185,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "110%",
    aspectRatio: 700 / 631,
  },
  heroAction: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    backgroundColor: "transparent",
  },
  heroActionPlaceholder: {
    borderRadius: BUTTON_HEIGHT / 2,
    backgroundColor: colors.fill,
  },
  heroActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
