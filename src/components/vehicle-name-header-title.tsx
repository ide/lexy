import { Button, Host, HStack, Image, Text } from "@expo/ui/swift-ui";
import { buttonStyle, font, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { haptic } from "@/utils/haptics";

// The inline title slot is the full width of the bar minus the buttons; the
// SwiftUI host needs a concrete size because a navigation bar gives its title
// view no layout to inherit.
const TITLE_SIZE = { width: 220, height: 34 };

/**
 * The screen's name in the collapsed navigation bar, as a button that opens the
 * rename screen.
 *
 * iOS renders the large title itself and offers no way to replace or tap it —
 * `navigationItem` has a `titleView` (and, on 26, a `subtitleView` and
 * `largeSubtitleView`) but no `largeTitleView`. So the large title stays
 * untouched and this rides in the inline slot instead, which is the one UIKit
 * *does* hand over.
 *
 * The catch is that UIKit hides its own inline title while the large title is
 * expanded but does not extend that courtesy to a custom title view — left
 * alone, this would sit above the large title, showing the name twice. Hence
 * the fade: `collapse` runs 0→1 across the same scroll band as the system's own
 * swap (navigation/header-collapse.ts), so this arrives as the large title
 * leaves.
 */
export function VehicleNameHeaderTitle({
  collapse,
  name,
}: {
  collapse: SharedValue<number>;
  name: string;
}) {
  // `pointerEvents` rides along in the animated style so it flips on the UI
  // thread with the opacity: while the large title is up this control is not
  // just invisible but absent, and a tap there reaches the bar underneath.
  const fade = useAnimatedStyle(() => ({
    opacity: collapse.value,
    pointerEvents: collapse.value > 0.5 ? "auto" : "none",
  }));

  return (
    <Animated.View style={[TITLE_SIZE, fade]}>
      <Host style={TITLE_SIZE}>
        <Button
          onPress={() => {
            haptic("selection");
            router.push("/settings/vehicle-name");
          }}
          modifiers={[buttonStyle("plain")]}
        >
          <HStack spacing={4}>
            <Text
              modifiers={[
                font({ textStyle: "headline", weight: "semibold" }),
                foregroundStyle(colors.label),
              ]}
            >
              {name}
            </Text>
            <Image systemName="chevron.down.circle.fill" size={13} color={colors.secondaryLabel} />
          </HStack>
        </Button>
      </Host>
    </Animated.View>
  );
}
