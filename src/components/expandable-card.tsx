import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Card } from "@/components/card";
import { Icon } from "@/components/icon";
import { EXPAND_TIMING } from "@/constants/motion";
import { Spacing, colors } from "@/constants/theme";

/**
 * A card whose detail is one tap away: a header row with a turning chevron, and
 * a height clip that grows to reveal what it hides.
 *
 * Everything about the interaction is React Native and Reanimated; the content
 * on either side can be whatever the caller draws, SwiftUI included. Four things
 * make it work, and all four are load-bearing:
 *
 * - The tap is a `Pressable`, so the press dims the header's own content rather
 *   than the card under it. A SwiftUI `DisclosureGroup` presses its whole label.
 * - A SwiftUI header must be `pointerEvents="none"`, or its host swallows the
 *   tap before the Pressable sees it. Callers pass such a host as `header`.
 * - The chevron is RN, rotated by a shared value on the UI thread. A SwiftUI
 *   `rotationEffect` driven from React state does not animate.
 * - The detail is **absolutely positioned** inside the clip, so it keeps its
 *   natural size and is merely revealed. Laid out inside the animating box it
 *   would be squeezed to nothing and re-expanded instead.
 *
 * None of it is driven by React state mid-flight, so an unrelated re-render
 * cannot interrupt the animation.
 */
export function ExpandableCard({
  accessibilityHint,
  disabled = false,
  header,
  children,
  style,
  detailStyle,
}: {
  accessibilityHint: string;
  disabled?: boolean;
  /** The always-visible row, left of the chevron. */
  header: ReactNode;
  /** The detail revealed by the tap. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra insets for the detail, over the shared ones. */
  detailStyle?: StyleProp<ViewStyle>;
}) {
  const [expanded, setExpanded] = useState(false);
  // The animation reads this from a layout callback that must not wait for a
  // re-render, so the flag is mirrored into a ref.
  const expandedRef = useRef(expanded);
  // The detail's natural height, measured from its always-rendered (but
  // clipped) content, so the first expansion already knows where to land.
  const measured = useRef(0);
  const detailHeight = useSharedValue(0);
  const rotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const clipStyle = useAnimatedStyle(() => ({ height: detailHeight.value }));

  const toggle = () => {
    const next = !expanded;
    expandedRef.current = next;
    setExpanded(next);
    rotation.value = withTiming(next ? 90 : 0, EXPAND_TIMING);
    detailHeight.value = withTiming(next ? measured.current : 0, EXPAND_TIMING);
  };

  return (
    <Card style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={accessibilityHint}
        disabled={disabled}
        onPress={toggle}
      >
        {({ pressed }) => (
          <View style={[styles.header, pressed && styles.pressed]}>
            {header}
            <Animated.View style={chevronStyle}>
              <Icon name="chevron.right" size={14} tint={colors.secondaryLabel} />
            </Animated.View>
          </View>
        )}
      </Pressable>

      <Animated.View style={[styles.clip, clipStyle]}>
        <View
          style={[styles.detail, detailStyle]}
          onLayout={(event) => {
            measured.current = event.nativeEvent.layout.height;
            // New data can reflow an open detail; track it unanimated.
            if (expandedRef.current) {
              detailHeight.value = event.nativeEvent.layout.height;
            }
          }}
        >
          {children}
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  clip: {
    overflow: "hidden",
  },
  // Rendered (and measured) at natural size even while the clip is closed —
  // absolute, so the clip's height never lays it out.
  detail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
});
