import { Host, RNHostView, ScrollView, VStack } from "@expo/ui/swift-ui";
import { frame, refreshable } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { colors } from "@/constants/theme";

/**
 * The screen's scroll view, and the only `Host` a screen should need.
 *
 * Its children are **SwiftUI**, laid out directly in the scroll view's own
 * stack. React Native content goes in an {@link RNSection}, which is the one
 * place the bridge is crossed.
 *
 * That way round matters. A nested `Host` inside the RN content is measured on
 * the RN side, so anything in it that changes size — a disclosure opening, say
 * — has its new height reported back across the bridge a frame before SwiftUI
 * has finished laying the old content out inside it, and everything sharing
 * that host visibly jumps and settles. Content that lays out in *this* stack
 * has no such boundary: SwiftUI reflows the scroll view and animates it, the
 * way it would on a screen with no React Native in it at all.
 */
export function SwiftUIScrollView({
  children,
  nativeFooter,
  onRefresh,
}: {
  /** SwiftUI content. Wrap React Native content in an {@link RNSection}. */
  children: ReactNode;
  nativeFooter?: ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <Host
      seedColor={colors.systemBlue}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <ScrollView showsIndicators modifiers={onRefresh ? [refreshable(onRefresh)] : undefined}>
        {/* One hierarchy whether or not a footer is present, so every screen
            (and its skeleton state) lays out through the same SwiftUI tree. */}
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          {children}
          {nativeFooter}
        </VStack>
      </ScrollView>
    </Host>
  );
}

/**
 * A run of React Native content inside {@link SwiftUIScrollView}.
 *
 * Sized by its own layout (`matchContents`), so it takes exactly the height its
 * RN children need. Use one per contiguous run rather than one per card — every
 * section is a bridge crossing, and the point of the split is to have as few as
 * the screen actually needs.
 */
export function RNSection({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RNHostView matchContents>
      <View style={style}>{children}</View>
    </RNHostView>
  );
}
