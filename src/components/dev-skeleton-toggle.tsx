import { Image } from "expo-image";
import { Pressable } from "react-native-gesture-handler";

import { colors } from "@/constants/theme";
import { queryClient } from "@/data/query-client";
import { haptic } from "@/utils/haptics";

const blue = colors.systemBlue;

/**
 * Header button that exercises the real loading skeleton on the real screen —
 * no cloned preview, it drives the same code path production uses. Tap pins the
 * skeleton on so you can inspect it; long-press resets the vehicle query, which
 * clears the cache and refetches — the genuine cold-start path (skeleton →
 * data). Callers render it only when SHOW_DEV_TOOLS is true, so it
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
        haptic("selection");
        onToggle();
      }}
      onLongPress={() => {
        haptic("impact-medium");
        queryClient.resetQueries({ queryKey: ["vehicle"] });
      }}
    >
      <Image
        source="sf:rectangle.dashed"
        tintColor={active ? blue : colors.secondaryLabel}
        style={{ width: 20, height: 20 }}
        contentFit="contain"
      />
    </Pressable>
  );
}
