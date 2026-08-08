import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";

import { iconRegistry, type IconName } from "@/components/ui/icon-registry";
import { useRedacted } from "@/components/ui/redactable";
import { colors } from "@/constants/theme";

/**
 * The Android half of the icon seam: the same semantic name drawn as a Material
 * Design glyph. `size` is the em box the glyph is laid out in, which is the
 * same contract the iOS side gives expo-image, so a caller's spacing carries
 * over unchanged. Redaction behaves identically — a neutral fill circle of the
 * icon's normal size, so the skeleton keeps the real layout's geometry.
 */
export function Icon({ name, size = 22, tint }: { name: IconName; size?: number; tint?: string }) {
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
    <MaterialCommunityIcons
      name={iconRegistry[name].material}
      size={size}
      color={tint ?? colors.label}
    />
  );
}
