import { Button, HStack, Host, Image as SFImage, Text } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, font, tint } from "@expo/ui/swift-ui/modifiers";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, type LayoutRectangle } from "react-native";

import { Card } from "@/components/card";
import { VehicleLocationMap } from "@/components/vehicle-location-map";
import { useRedacted } from "@/components/redactable";
import { Spacing, colors } from "@/constants/theme";
import type { Vehicle } from "@/data/vehicle";
import { haptic } from "@/utils/haptics";

const blue = colors.systemBlue;

// MapKit draws its attribution — the Apple logo, "Maps", then a "Legal" link —
// along the bottom edge of the map, and the link opens Apple's map-data notices
// in Safari. The hero map fills the card edge to edge, so the link lands in the
// card's own bottom-left corner: measured at 71–95pt from the left edge and
// 11–18pt up from the bottom. This window is that box with room around it for a
// fingertip, and it is the only part of the hero map that takes touches at all.
// Re-measure if the hero card ever stops being a full-bleed map.
const LEGAL_WINDOW = { left: 56, width: 64, height: 34 };

/**
 * A negative `hitSlop` that shrinks the map's touch rect down to the Legal
 * window, leaving the rest of the card's map inert.
 *
 * Why shrink one view's hit rect instead of covering the rest of the map in
 * transparent blocker views: this card sits in a SwiftUI ScrollView (see
 * `SwiftUIScrollView`), where a React Native view that answers a hit test is a
 * view SwiftUI's scroll gesture has to fight for the touch. Shrinking the rect
 * sidesteps that — outside the window `hitTest` returns nil, so every touch
 * takes exactly the path it took when the map was flatly `pointerEvents="none"`,
 * and only the window is new behavior.
 *
 * That window is also the one place a drag can still pan the map, 64x34pt in a
 * corner. Disabling MapKit's gestures outright would need `mapInteractionModes`
 * plumbed through Expo Maps, which as of `expo-maps@57` it is not:
 * `AppleMapsUISettings` carries only the compass, my-location button, scale bar
 * and pitch toggle.
 */
function legalWindowHitSlop(card: LayoutRectangle) {
  return {
    top: -(card.height - LEGAL_WINDOW.height),
    bottom: 0,
    left: -LEGAL_WINDOW.left,
    right: -(card.width - LEGAL_WINDOW.left - LEGAL_WINDOW.width),
  };
}

// The hero: the parked-location map behind the vehicle render, with the button
// that opens the full map. The map draws in both states — it is the card, and a
// grey rectangle in its place reads as a broken image rather than a loading
// one. Only the car render and the button stand down while redacted.
export function HeroCard({ vehicle }: { vehicle: Vehicle }) {
  const isRedacted = useRedacted();
  // The window is expressed relative to the card's bottom-left, so the hit rect
  // can only be computed once the card has been laid out. Until then the map
  // stays inert, which is what it was before the window existed.
  const [card, setCard] = useState<LayoutRectangle | null>(null);
  return (
    <Card style={styles.hero}>
      {/* Not a flat `pointerEvents="none"`: that made the whole subtree inert,
          MapKit's Legal link included. The hit rect below is that same
          inertness everywhere except the link. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents={card ? "auto" : "none"}
        hitSlop={card ? legalWindowHitSlop(card) : undefined}
        onLayout={(event) => {
          const next = event.nativeEvent.layout;
          // `onLayout` hands back a fresh object every pass; only re-render when
          // the size it implies actually changed.
          setCard((prev) =>
            prev?.width === next.width && prev.height === next.height ? prev : next,
          );
        }}
        style={styles.heroMap}
      >
        <VehicleLocationMap
          latitude={vehicle.location.latitude}
          longitude={vehicle.location.longitude}
          label={vehicle.nickname}
          showMarker={false}
          showPlaces={false}
        />
      </View>
      <View pointerEvents="none" style={styles.heroMapVeil} />
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
      {/* Only this button opens the map — the map behind the car is a
          non-interactive backdrop. */}
      <View style={styles.heroActions}>
        {isRedacted ? (
          // A flat pill, not the redacted glass button: SwiftUI redacts only
          // the label, so the real control left its glass shell and a small
          // grey bar floating inside a much taller frame.
          <View style={[styles.heroAction, styles.heroActionPlaceholder]} />
        ) : (
          // Pinned rather than `matchContents`: a measuring host reports a
          // zero-size box on its first layout pass, which collapsed this row
          // for a frame on the way out of the skeleton — taking the card's
          // height (and the map filling it) with it, and leaving the button
          // without a box to sit in. 147.67x48 measured from the live button;
          // re-measure if the label or control size changes.
          <Host style={styles.heroAction}>
            <Button
              onPress={() => {
                haptic("selection");
                router.push("/status/map");
              }}
              modifiers={[buttonStyle("glass"), tint(blue), controlSize("large")]}
            >
              <HStack spacing={Spacing.one}>
                <SFImage systemName="map.fill" size={15} color={blue} />
                <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" })]}>
                  Last Parked
                </Text>
              </HStack>
            </Button>
          </Host>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  heroMap: {
    position: "absolute",
    inset: 0,
    opacity: 0.48,
  },
  // The card's own surface, not a white literal: in light mode this is the
  // same colour it always was, and in dark mode it mutes the map towards the
  // card instead of washing it white.
  heroMapVeil: {
    position: "absolute",
    inset: 0,
    backgroundColor: colors.card,
    opacity: 0.22,
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
  // so a symmetric scale needs no translation. Frame height (185) + width
  // (110%) are tuned so the whole car stays visible with a little breathing
  // room (~11pt above / ~18pt below) — don't crank them without re-checking the
  // car isn't getting clipped. aspectRatio matches the source (700/631).
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
  // The button's slot, shared by the live button's host and its placeholder.
  heroAction: {
    width: 148,
    height: 48,
    backgroundColor: "transparent",
  },
  heroActionPlaceholder: {
    borderRadius: 24,
    backgroundColor: colors.fill,
  },
  heroActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
