import { Text, VStack } from "@expo/ui/swift-ui";
import {
  background,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import { Spacing, colors } from "@/constants/theme";

// The SwiftUI siblings of the RN `SectionTitle` and `Card` components: the
// uppercase grouped-section header and the continuous-18pt-corner card used by
// every SwiftUI-rendered settings-style screen.

export function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "semibold" }),
        foregroundStyle({ type: "hierarchical", style: "secondary" }),
        padding({ leading: Spacing.three, bottom: Spacing.one }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
      ]}
    >
      {children}
    </Text>
  );
}

export function GroupCard({ children }: { children: React.ReactNode }) {
  return (
    <VStack
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity }),
        background(
          colors.card,
          shapes.roundedRectangle({
            cornerRadius: 18,
            roundedCornerStyle: "continuous",
          }),
        ),
      ]}
    >
      {children}
    </VStack>
  );
}
