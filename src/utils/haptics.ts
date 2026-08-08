import * as Haptics from "expo-haptics";

/**
 * Every haptic in the app funnels through here, so the guard is written once
 * instead of at each call site. expo-haptics is native on both iOS and
 * Android; only web has nothing to vibrate.
 */
export function haptic(
  kind: "selection" | "impact-light" | "impact-medium" | "impact-soft" | "success" | "error",
) {
  if (process.env.EXPO_OS === "web") {
    return;
  }
  switch (kind) {
    case "selection":
      Haptics.selectionAsync();
      break;
    case "impact-light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "impact-medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case "impact-soft":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      break;
    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "error":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
}
