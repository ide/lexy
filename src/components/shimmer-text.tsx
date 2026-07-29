import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  StyleSheet,
  useColorScheme,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";

// The sweep dims the whole word and runs a brighter band across it — so it
// reads as a shimmer in both light and dark mode (a single highlight color
// can't, since it can't out-brighten white text). Concrete rgba is used rather
// than the PlatformColor palette because gradient stops must be plain colors.
function sweepColors(dark: boolean): { base: string; highlight: string } {
  return dark
    ? { base: "rgba(235,235,245,0.35)", highlight: "rgba(255,255,255,0.95)" }
    : { base: "rgba(60,60,67,0.32)", highlight: "rgba(0,0,0,0.88)" };
}

/**
 * A text label with a diagonal light band that sweeps across the glyphs while
 * `active`, used to signal a background refresh. The sweep is a `MaskedView`
 * (the text glyphs are the mask) over a static dim fill plus a translating
 * `LinearGradient` highlight, animated on the UI thread with Reanimated. When
 * idle it renders as a plain `ThemedText`, so its resting color matches the
 * rest of the UI exactly.
 */
export function ShimmerText({
  active,
  children,
  style,
  textStyle,
}: {
  active: boolean;
  children: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const dark = useColorScheme() === "dark";
  const { base, highlight } = sweepColors(dark);
  const tx = useSharedValue(0);
  const width = size?.width ?? 0;

  useEffect(() => {
    if (active && width > 0) {
      // Sweep the band from fully off the left edge to fully off the right,
      // then loop. `false` = restart (not reverse), so every pass runs L→R.
      tx.value = -width;
      tx.value = withRepeat(
        withTiming(width, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(tx);
      tx.value = 0;
    }
  }, [active, width, tx]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w !== size?.width || h !== size?.height) {
      setSize({ width: w, height: h });
    }
  };

  if (!active) {
    return (
      <View style={style}>
        <ThemedText style={textStyle} onLayout={onLayout}>
          {children}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[style, styles.container]}>
      {/* Invisible copy reserves the exact glyph box; the mask overlays it. */}
      <ThemedText style={[textStyle, styles.hidden]} onLayout={onLayout}>
        {children}
      </ThemedText>
      {size ? (
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={<ThemedText style={textStyle}>{children}</ThemedText>}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />
          <Animated.View style={[StyleSheet.absoluteFill, bandStyle]}>
            <LinearGradient
              colors={["transparent", highlight, "transparent"]}
              locations={[0.2, 0.5, 0.8]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </MaskedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
  },
  hidden: {
    opacity: 0,
  },
});
