import { Text, VStack } from "@expo/ui/swift-ui";
import { background, fixedSize, font, padding } from "@expo/ui/swift-ui/modifiers";

import {
  cardShape,
  fillWidth,
  fillWidthLeading,
  secondaryStyle,
} from "@/components/swift-ui/modifier-presets";
import { Spacing, colors } from "@/constants/theme";

// The SwiftUI siblings of the RN `SectionTitle` and `Card` components: the
// uppercase grouped-section header and the continuous-18pt-corner card used by
// every SwiftUI-rendered settings-style screen.

export function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "semibold" }),
        secondaryStyle,
        padding({ leading: Spacing.three, bottom: Spacing.one }),
        fillWidthLeading,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A grouped-list card.
 *
 * Rows that pad themselves (`SettingsRow`, `InfoRow`) want the default bare
 * card; content that doesn't — a status panel, a run of data rows — passes
 * `padded` and gets the card's own inset instead.
 */
export function GroupCard({
  children,
  spacing = 0,
  padded = false,
  verticalPadding = Spacing.three,
}: {
  children: React.ReactNode;
  spacing?: number;
  padded?: boolean;
  /** Only meaningful with `padded`; the horizontal inset is fixed. */
  verticalPadding?: number;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={spacing}
      modifiers={[
        padded ? fillWidthLeading : fillWidth,
        ...(padded ? [padding({ horizontal: Spacing.three, vertical: verticalPadding })] : []),
        background(colors.card, cardShape),
      ]}
    >
      {children}
    </VStack>
  );
}

/**
 * The muted explanatory footnote under a section's card — what the rows above
 * mean, or what they leave out. Inset to the same leading edge as
 * `SectionHeader`, so a section's header and footer line up over its card.
 */
export function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <Text
      modifiers={[
        font({ textStyle: "footnote", weight: "regular" }),
        secondaryStyle,
        fixedSize({ horizontal: false, vertical: true }),
        fillWidthLeading,
        padding({ top: Spacing.two, horizontal: Spacing.three }),
      ]}
    >
      {children}
    </Text>
  );
}
