import { StyleSheet, View } from "react-native";

/**
 * A translucent wash of a colour, filling its parent behind the content.
 *
 * The reason this exists rather than an `rgba()` background: a literal is a
 * fixed sRGB triple. It cannot follow the system palette between light and dark
 * (systemBlue is #007AFF in one and #0A84FF in the other), and it cannot render
 * in Display P3 — the wider gamut the palette actually resolves to on device.
 * Painting a *system* colour and letting the compositor apply the alpha keeps
 * both: the colour is still `PlatformColor` underneath, and only its coverage
 * is being set here.
 *
 * `opacity` on the parent would fade the content too, hence a sibling behind it.
 * The parent needs `overflow: "hidden"` if it has a corner radius.
 */
export function ColorWash({ color, amount = 0.15 }: { color: string; amount?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: amount }]}
    />
  );
}
