import { Image } from "expo-image";
import { View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { useRedacted } from "@/components/redacted";
import { colors } from "@/constants/theme";

/**
 * An SF Symbol drawn through expo-image, shared by the RN-rendered screens.
 * Inside a `Redacted` subtree it draws as a neutral fill circle of its normal
 * size instead, so icon slots keep their exact geometry while loading.
 */
export function Icon({
  name,
  size = 22,
  tint,
}: {
  name: SFSymbol;
  size?: number;
  tint?: string;
}) {
  const redacted = useRedacted();
  if (redacted) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.fill,
        }}
      />
    );
  }
  return (
    <Image
      source={`sf:${name}`}
      tintColor={tint ?? (colors.label as string)}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}
