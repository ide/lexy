import { useEffect, type ReactNode } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/**
 * The skeleton's pulse, in one place. `Redactable` fades a whole placeholder
 * tree with these numbers; a status label mid-command uses the same ones on a
 * single word, so "waiting" reads identically wherever it appears.
 */
export const PULSE_MIN_OPACITY = 0.4;
export const PULSE_DURATION_MS = 800;

/**
 * Pulses its children while `pulsing`, and rests at full opacity otherwise.
 *
 * This is what a command in flight looks like: "Locking" breathing rather than
 * "Locking…" sitting still. An ellipsis is a claim about *duration* the app
 * can't make — a remote command is accepted, then confirmed by a status read
 * whenever the car answers — where the pulse just says the app is waiting, and
 * stops the moment it isn't.
 */
export function PulsingText({ pulsing, children }: { pulsing: boolean; children: ReactNode }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      opacity.value = PULSE_MIN_OPACITY;
      opacity.value = withRepeat(withTiming(1, { duration: PULSE_DURATION_MS }), -1, true);
    } else {
      // Settle rather than snap, so a command confirming mid-fade doesn't
      // flash the label back to full.
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [pulsing, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
