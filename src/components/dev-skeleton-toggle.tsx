import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Updates from "expo-updates";
import { Pressable } from "react-native-gesture-handler";

import { colors } from "@/constants/theme";
import { queryClient } from "@/data/query-client";

// The skeleton toggle should be reachable in local dev AND in internal preview
// builds (which run as release, so `__DEV__` is false), but never in production.
// `Updates.channel` is set by the EAS build profile — "preview" for preview
// builds, "production" for production — and is null in dev/Expo Go.
export const SHOW_DEV_SKELETON_TOGGLE =
  __DEV__ || Updates.channel === "preview";

const blue = colors.systemBlue as string;

/**
 * Header button that exercises the real loading skeleton on the real screen —
 * no cloned preview, it drives the same code path production uses. Tap pins the
 * skeleton on so you can inspect it; long-press resets the vehicle query, which
 * clears the cache and refetches — the genuine cold-start path (skeleton →
 * data). Callers render it only when SHOW_DEV_SKELETON_TOGGLE is true, so it
 * reaches dev and preview builds but never production.
 */
export function DevSkeletonToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle loading skeleton"
      hitSlop={12}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.selectionAsync();
        }
        onToggle();
      }}
      onLongPress={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        queryClient.resetQueries({ queryKey: ["vehicle"] });
      }}
    >
      <Image
        source="sf:rectangle.dashed"
        tintColor={active ? blue : (colors.secondaryLabel as string)}
        style={{ width: 20, height: 20 }}
        contentFit="contain"
      />
    </Pressable>
  );
}
