import { Easing } from "react-native-reanimated";

/**
 * The curve every disclosure on the dashboard opens and closes on — the height
 * clip and the chevron alike, so the two are always the same gesture rather
 * than two things that happen to start together.
 *
 * `inOut(ease)` over 300ms: it leaves and arrives slowly, which reads as the
 * content being uncovered rather than thrown. Shared because it was duplicated
 * in the two cards that use it, and a curve that only matches by coincidence
 * eventually doesn't.
 */
export const EXPAND_TIMING = {
  duration: 300,
  easing: Easing.inOut(Easing.ease),
} as const;
