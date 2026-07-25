import {
  Host,
  RNHostView,
  ScrollView as SwiftUIScrollView,
  VStack,
} from "@expo/ui/swift-ui";
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
  showsIndicators = true,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  nativeFooter?: ReactNode;
  onRefresh?: () => Promise<void>;
  showsIndicators?: boolean;
}) {
  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <SwiftUIScrollView
        showsIndicators={showsIndicators}
        modifiers={onRefresh ? [refreshable(onRefresh)] : undefined}
      >
        {nativeFooter ? (
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
        ) : (
          <RNHostView matchContents>
            <View style={contentContainerStyle}>{children}</View>
          </RNHostView>
        )}
      </SwiftUIScrollView>
    </Host>
  );
}
