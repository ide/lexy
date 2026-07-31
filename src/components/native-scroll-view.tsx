import { Host, RNHostView, ScrollView as SwiftUIScrollView, VStack } from "@expo/ui/swift-ui";
import { frame, refreshable } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { colors } from "@/constants/theme";

export function NativeScrollView({
  children,
  contentContainerStyle,
  nativeFooter,
  onRefresh,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  nativeFooter?: ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <SwiftUIScrollView
        showsIndicators
        modifiers={onRefresh ? [refreshable(onRefresh)] : undefined}
      >
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
