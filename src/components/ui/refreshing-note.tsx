import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/ui/themed-text";
import { Spacing, colors } from "@/constants/theme";

const FADE_MS = 220;

const LABEL = "Refreshing…";

/**
 * The cue for a refresh the user didn't ask for: a spinner and a word, fading
 * in under the nav bar while the app re-reads the vehicle on its own (see
 * use-vehicle-auto-refresh.ts), and fading out when it lands.
 *
 * It floats over the content rather than sitting in it — the refresh is
 * incidental, so nothing on screen should move to make room for it, and
 * nothing should move back. Deliberately not a capsule, chip, or anything else
 * with an edge: a shape floating over content reads as a control, and this one
 * would be a control that does nothing. Bare secondary text alongside the
 * system spinner reads as status, which is what it is.
 *
 * A pull-to-refresh gets the scroll view's own spinner instead; this is for the
 * refreshes that happen unprompted, where the alternative is data silently
 * changing under the user.
 *
 * Always mounted, animating on `visible`, so it can fade rather than appear and
 * disappear. It never takes touches.
 */
export function RefreshingNote({ visible }: { visible: boolean }) {
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: FADE_MS });
  }, [shown, visible]);

  // The note never takes touches and fades in over content that is already
  // there, so VoiceOver would otherwise never mention it: nothing moves focus,
  // and no gesture can land on it. Announcing is the only way a non-visual user
  // learns that the values they are reading are about to change under them.
  // The view itself stays out of the accessibility tree so the announcement is
  // the single telling, rather than also leaving a stray element to swipe onto.
  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility(LABEL);
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    // Settles down into place, and lifts back out — a few points, so it reads
    // as arriving rather than as a panel sliding in.
    transform: [{ translateY: (shown.value - 1) * 6 }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.row, style]}
    >
      <ActivityIndicator size="small" color={colors.secondaryLabel} />
      <ThemedText type="small" themeColor="secondaryLabel">
        {LABEL}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Pinned across the top of the screen area (below the nav bar) so the row
  // centers on the screen, not on whatever it happens to overlap.
  row: {
    position: "absolute",
    top: Spacing.two,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
});
