import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";

/**
 * How often a visible screen re-reads the clock. Minutes are the finest unit
 * these timestamps show once they are more than a minute old, so this is the
 * slowest tick that still keeps every one of them true — and slow enough that
 * nothing on screen reads as a counter.
 */
const TICK_MS = 60 * 1000;

/**
 * The current time, for "how long ago" text that has to stay true while a
 * screen sits open.
 *
 * Call it once per screen and measure every timestamp on that screen from the
 * value it returns: one instant per screen means two lines about two different
 * moments can never disagree about *when now is*, only about the moments
 * themselves.
 *
 * The clock advances only while the screen is focused and the app is in the
 * foreground. `useFocusEffect` covers navigating away and back; the AppState
 * listener covers backgrounding. Each stops the timer rather than leave it
 * running where nobody can see it, and each re-reads the clock the moment the
 * screen becomes visible again — so a screen revealed after an hour away is
 * right on its first frame rather than at the next tick.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | undefined;
      const read = () => setNow(Date.now());
      const start = () => {
        read();
        // `??=`, so an AppState change that repeats "active" can't stack a
        // second interval on top of the running one.
        timer ??= setInterval(read, TICK_MS);
      };
      const stop = () => {
        clearInterval(timer);
        timer = undefined;
      };

      if (AppState.currentState === "active") {
        start();
      }
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          start();
        } else {
          stop();
        }
      });

      // Runs when the screen loses focus and when it unmounts, which is the
      // other half of "only while visible".
      return () => {
        stop();
        subscription.remove();
      };
    }, []),
  );

  return now;
}
