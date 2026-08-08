import { StyleSheet, View } from "react-native";

import { ColorWash } from "@/components/ui/color-wash";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon-registry";
import { colors } from "@/constants/theme";

/**
 * The round tinted badge a card's header leads with: a wash of the tint with
 * the glyph at full strength over it, so the glyph stays the loudest thing in
 * the circle rather than competing with a solid fill behind it.
 *
 * Redacted, it draws as a neutral fill circle instead of masking the glyph in
 * place — a green padlock behind a placeholder mask would still be claiming a
 * verdict, and would no longer look like an icon while doing it.
 */
export function Badge({
  symbol,
  tint,
  redacted,
  size = 36,
  glyphSize = 18,
}: {
  symbol: IconName;
  tint: string;
  redacted: boolean;
  size?: number;
  glyphSize?: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        redacted && { backgroundColor: colors.fill },
      ]}
    >
      {redacted ? null : (
        <>
          <ColorWash color={tint} />
          <Icon name={symbol} size={glyphSize} tint={tint} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    // Clips the wash to the circle.
    overflow: "hidden",
  },
});
