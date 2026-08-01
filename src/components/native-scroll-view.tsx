import { Host, RNHostView, ScrollView as SwiftUIScrollView, VStack } from "@expo/ui/swift-ui";
import { frame, refreshable, useScrollGeometryChange } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { collapseProgress } from "@/navigation/header-collapse";

export function NativeScrollView({
  children,
  collapse,
  contentContainerStyle,
  nativeFooter,
  onRefresh,
}: {
  children: ReactNode;
  /**
   * Written with how far the navigation bar is through its large-to-inline
   * title swap, for a screen that renders something alongside the inline title
   * (see navigation/header-collapse.ts). Left undefined by screens that don't.
   */
  collapse?: SharedValue<number>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  nativeFooter?: ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  // Runs on the UI thread, so the fade tracks the scroll frame for frame
  // instead of chasing it a JS round-trip behind.
  const geometry = useScrollGeometryChange((scroll) => {
    "worklet";
    if (collapse) {
      collapse.value = collapseProgress(scroll.contentOffsetY);
    }
  });

  const modifiers = [
    ...(onRefresh ? [refreshable(onRefresh)] : []),
    ...(geometry ? [geometry] : []),
  ];

  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <SwiftUIScrollView showsIndicators modifiers={modifiers.length > 0 ? modifiers : undefined}>
        {/* One hierarchy whether or not a footer is present, so every screen
            (and its skeleton state) lays out through the same SwiftUI tree. */}
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <RNHostView matchContents>
            <View style={contentContainerStyle}>{children}</View>
          </RNHostView>
          {nativeFooter}
        </VStack>
      </SwiftUIScrollView>
    </Host>
  );
}
