import { Host, ScrollView, VStack } from "@expo/ui/swift-ui";
import type { ModifierConfig } from "@expo/ui/swift-ui/modifiers";
import { padding } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { fillWidthLeading } from "@/components/swift-ui/modifier-presets";
import { Spacing, colors } from "@/constants/theme";

/**
 * The frame every settings-style SwiftUI screen sits in: one `Host` over the
 * grouped background, a scroll view, and a leading-aligned stack of sections
 * inset the same on all of them.
 *
 * Screens whose content is React Native use `SwiftUIScrollView` instead — this
 * one never crosses the bridge, so it can keep its whole tree in SwiftUI's
 * layout.
 */
export function SettingsScreenScaffold({
  children,
  scrollModifiers,
  stackModifiers,
  spacing = Spacing.four,
}: {
  children: ReactNode;
  /** Extra modifiers for the scroll view (pull-to-refresh, keyboard dismissal). */
  scrollModifiers?: ModifierConfig[];
  /** Extra modifiers for the section stack (width clamps, animations). */
  stackModifiers?: ModifierConfig[];
  spacing?: number;
}) {
  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView modifiers={scrollModifiers}>
        <VStack
          alignment="leading"
          spacing={spacing}
          modifiers={[
            fillWidthLeading,
            padding({ top: Spacing.three, horizontal: Spacing.three, bottom: Spacing.six }),
            ...(stackModifiers ?? []),
          ]}
        >
          {children}
        </VStack>
      </ScrollView>
    </Host>
  );
}

/**
 * One labelled section: a header, its card, and an optional footnote, stacked
 * tight so the section reads as a unit against the scaffold's spacing.
 */
export function Section({ children }: { children: ReactNode }) {
  return (
    <VStack alignment="leading" spacing={0} modifiers={[fillWidthLeading]}>
      {children}
    </VStack>
  );
}
