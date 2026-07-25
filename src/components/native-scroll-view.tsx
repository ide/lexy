import {
  Host,
  RNHostView,
  ScrollView as SwiftUIScrollView,
} from "@expo/ui/swift-ui";
import { refreshable } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { colors } from "@/constants/theme";

export function NativeScrollView({
  children,
  contentContainerStyle,
  onRefresh,
  showsIndicators = true,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
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
        <RNHostView matchContents>
          <View style={contentContainerStyle}>{children}</View>
        </RNHostView>
      </SwiftUIScrollView>
    </Host>
  );
}
