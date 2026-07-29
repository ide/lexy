import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Pressable } from "react-native-gesture-handler";

import { SHOW_DEV_TOOLS } from "@/constants/build-channel";
import { colors } from "@/constants/theme";
import { queryClient } from "@/data/query-client";

// The skeleton toggle rides the shared dev-tools gate: reachable in local dev
// and internal preview builds, never in production.
export const SHOW_DEV_SKELETON_TOGGLE = SHOW_DEV_TOOLS;

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
