import { useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { RefreshControl, ScrollView, View } from "react-native";

import { colors } from "@/constants/theme";

/**
 * The Android half of the screen scroll container, with the same API as the
 * SwiftUI one so a shared screen can name one component and get the right host
 * on each platform.
 *
 * AGENTS.md forbids React Native's `ScrollView` — that is a rule about iOS
 * native controls, where an RN scroller would give up the system's own
 * scrolling, refresh, and inset behavior. Android has no SwiftUI to give up,
 * and the Compose host that will replace this arrives in a later phase; until
 * then RN's scroller *is* the platform scroller here.
 */
export function SwiftUIScrollView({
  children,
  nativeFooter,
  onRefresh,
}: {
  children: ReactNode;
  nativeFooter?: ReactNode;
  onRefresh?: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  // SwiftUI's `refreshable` owns the spinner for as long as the promise is
  // pending; RefreshControl has to be told, so the flag stands in for that and
  // clears however the refresh ends.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      refreshControl={
        onRefresh ? (
          // `colors`, not `tintColor`: the iOS prop names one colour for the
          // whole control, where Android's spinner cycles an array. One entry
          // is a spinner that stays the app's accent.
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.systemBlue]}
          />
        ) : undefined
      }
    >
      {children}
      {/* On iOS the footer slot takes SwiftUI elements, which is why it is a
          slot at all — they belong in the scroll view's own stack rather than
          in a nested host. Here the whole tree is already React Native, so
          whatever the caller puts in the slot renders as ordinary children, in
          the same position the SwiftUI footer occupies. The Status screen's
          sync lines are what fill it on both platforms. */}
      {nativeFooter ? <View>{nativeFooter}</View> : null}
    </ScrollView>
  );
}

/**
 * The React Native passthrough. On iOS this is the one bridge crossing into a
 * SwiftUI scroll view; here the whole tree is already React Native, so the
 * section is just its own box and exists to keep one tree valid on both
 * platforms.
 */
export function RNSection({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}
