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
 * React Native analog of SwiftUI's `.redacted(reason:)` for content that lives
 * on the RN side of an `RNHostView` (where the SwiftUI redaction environment
 * cannot reach — verified empirically; see docs/redacted-skeleton.md).
 *
 * The vocabulary follows SwiftUI's: a subtree is *redactable*, and a redaction
 * *reason* says whether it is redacted right now and why.
 *
 * Wrap the real, populated component tree in `<Redactable>` and feed it
 * placeholder data whenever `reason` is non-null. Redaction-aware leaves
 * (`ThemedText`, the screens' `Icon`) read `useRedacted()` and draw themselves
 * as neutral bars sized by their normal styles + the placeholder content, so
 * the skeleton is the real layout and cannot drift from it. The wrapper stays
 * mounted in every state — hence `Redactable`, not `Redacted` — so the
 * transition reconciles in place (no remount, no scroll jump), and input is
 * disabled while redacted so placeholder content is inert.
 */

/**
 * Why a subtree is standing in for data it doesn't have. `null` is the real,
 * populated content — nothing is redacted.
 *
 * - `loading` — a fetch is in flight; the data is on its way. Pulses.
 * - `unavailable` — nothing is in flight, and nothing will arrive until
 *   something outside the screen changes (offline, where React Query pauses
 *   the fetch). Holds still: a pulse here would promise an arrival that cannot
 *   happen.
 *
 * One value rather than a redact flag plus an animate flag, so "animating but
 * not redacted" is unrepresentable.
 */
export type RedactionReason = "loading" | "unavailable" | null;

const RedactedContext = createContext(false);

/** Whether this subtree is currently rendering as a redacted placeholder. */
export function useRedacted() {
  return useContext(RedactedContext);
}

export function Redactable({
  reason,
  style,
  children,
}: {
  reason: RedactionReason;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const opacity = useSharedValue(1);
  const redacted = reason !== null;

  useEffect(() => {
    if (reason === "loading") {
      // Same treatment as the previous hand-built skeletons: a shared opacity
      // pulse over the whole placeholder group.
      opacity.value = 0.4;
      opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    } else {
      // Covers both settling back to real content and going still mid-pulse
      // (e.g. the network drops during a first load).
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [reason, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <RedactedContext.Provider value={redacted}>
      <Animated.View pointerEvents={redacted ? "none" : "auto"} style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </RedactedContext.Provider>
  );
}
