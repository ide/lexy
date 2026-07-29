import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * React Native analog of SwiftUI's `.redacted(.placeholder)` for content that
 * lives on the RN side of an `RNHostView` (where the SwiftUI redaction
 * environment cannot reach — verified empirically; see docs/redacted-skeleton.md).
 *
 * Wrap the real, populated component tree in `<Redacted loading>` and feed it
 * placeholder data while loading. Redaction-aware leaves (`ThemedText`, the
 * screens' `Icon`) read `useRedacted()` and draw themselves as neutral bars
 * sized by their normal styles + the placeholder content, so the skeleton is
 * the real layout and cannot drift from it. The wrapper stays mounted in both
 * states so the transition reconciles in place (no remount, no scroll jump),
 * and input is disabled while redacted so placeholder content is inert.
 */

const RedactedContext = createContext(false);

/** Whether this subtree is currently rendering as a redacted placeholder. */
export function useRedacted() {
  return useContext(RedactedContext);
}

export function Redacted({
  loading,
  style,
  children,
}: {
  loading: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (loading) {
      // Same treatment as the previous hand-built skeletons: a shared opacity
      // pulse over the whole placeholder group.
      pulse.value = 0.4;
      pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [loading, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <RedactedContext.Provider value={loading}>
      <Animated.View
        pointerEvents={loading ? "none" : "auto"}
        style={[style, animatedStyle]}
      >
        {children}
      </Animated.View>
    </RedactedContext.Provider>
  );
}
