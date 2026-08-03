import { createContext, useContext } from "react";
import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { useRedacted } from "@/components/ui/redactable";
import { Fonts, ThemeColor, colors } from "@/constants/theme";

export type ThemedTextProps = TextProps & {
  type?: "default" | "title" | "small" | "smallBold" | "subtitle" | "link" | "linkPrimary" | "code";
  themeColor?: ThemeColor;
};

// Whether an enclosing ThemedText has already painted a placeholder bar over
// this text. Nested text is a real pattern here — the tire readings tuck their
// unit inside the value's run so the two share a baseline — and the bar color
// is a translucent system fill, so a nested text painting its own bar over its
// parent's composited the two into a darker patch: a small dark square sitting
// on the lighter rectangle. Only the outermost one draws.
const InsideRedactedText = createContext(false);

export function ThemedText({ style, type = "default", themeColor, ...rest }: ThemedTextProps) {
  const redacted = useRedacted();
  const alreadyBarred = useContext(InsideRedactedText);
  const drawsBar = redacted && !alreadyBarred;

  const text = (
    <Text
      style={[
        { color: colors[themeColor ?? "label"] },
        styles[type],
        style,
        // Inside a `Redactable` subtree the text keeps its exact metrics (font,
        // line height, width from the placeholder string) but draws as a
        // neutral bar: transparent glyphs over a fill background. Placed last
        // so they also win over caller color overrides.
        redacted && styles.redactedGlyphs,
        drawsBar && styles.redactedBar,
      ]}
      {...rest}
    />
  );

  // Nested text still hides its glyphs — the parent's bar is what covers them
  // both, and it is one rect over the whole run rather than two overlapping.
  return drawsBar ? <InsideRedactedText.Provider value>{text}</InsideRedactedText.Provider> : text;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    // The one link style in the app: system blue so it adapts to dark mode
    // and accessibility tints like every other semantic color here.
    color: colors.systemBlue,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  redactedGlyphs: {
    color: "transparent",
  },
  redactedBar: {
    backgroundColor: colors.fill,
    borderRadius: 6,
    overflow: "hidden",
  },
});
