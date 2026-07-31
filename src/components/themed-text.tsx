import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { useRedacted } from "@/components/redacted";
import { Fonts, ThemeColor, colors } from "@/constants/theme";

export type ThemedTextProps = TextProps & {
  type?: "default" | "title" | "small" | "smallBold" | "subtitle" | "link" | "linkPrimary" | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = "default", themeColor, ...rest }: ThemedTextProps) {
  const redacted = useRedacted();

  return (
    <Text
      style={[
        { color: colors[themeColor ?? "label"] },
        styles[type],
        style,
        // Inside a `Redacted` subtree the text keeps its exact metrics (font,
        // line height, width from the placeholder string) but draws as a
        // neutral bar: transparent glyphs over a fill background. Placed last
        // so it also wins over caller color overrides.
        redacted && styles.redacted,
      ]}
      {...rest}
    />
  );
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
  redacted: {
    color: "transparent",
    backgroundColor: colors.fill,
    borderRadius: 6,
    overflow: "hidden",
  },
});
