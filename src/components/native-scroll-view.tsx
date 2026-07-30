import {
  Host,
  RNHostView,
  ScrollView as SwiftUIScrollView,
  VStack,
} from "@expo/ui/swift-ui";
import { frame, ignoreSafeArea, refreshable } from "@expo/ui/swift-ui/modifiers";
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
      {/* A SwiftUI ScrollView reserves room for the keyboard by default. These
          screens hold no text input — the only keyboard in the app belongs to
          the sign-in screen — so that reservation can only ever show up as
          dead space at the bottom, which is what it did: after signing in, the
          tabs kept a keyboard-sized gap until the app was force quit. */}
      <SwiftUIScrollView
        showsIndicators={showsIndicators}
        modifiers={[
          ignoreSafeArea({ regions: "keyboard", edges: "bottom" }),
          ...(onRefresh ? [refreshable(onRefresh)] : []),
        ]}
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
