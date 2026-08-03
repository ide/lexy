// The modifier combinations the SwiftUI screens reach for repeatedly, named
// once. Modifiers are plain stateless descriptors (`{ $type, ...params }`), so
// sharing one object across call sites is safe — and it keeps the interesting
// modifier in a list visible instead of buried among boilerplate.

import { font, foregroundStyle, frame, layoutPriority, shapes } from "@expo/ui/swift-ui/modifiers";

/** Hierarchical foreground styles — the system's own text de-emphasis. */
export const secondaryStyle = foregroundStyle({ type: "hierarchical", style: "secondary" });
export const tertiaryStyle = foregroundStyle({ type: "hierarchical", style: "tertiary" });
export const primaryStyle = foregroundStyle({ type: "hierarchical", style: "primary" });

/** The body text of a row or panel — a footnote, one step down in weight. */
export const footnoteMedium = font({ textStyle: "footnote", weight: "medium" });
export const footnoteBold = font({ textStyle: "footnote", weight: "bold" });
export const footnoteSemibold = font({ textStyle: "footnote", weight: "semibold" });

/** Identifiers and timestamps: monospaced so digits and hashes line up. */
export const monoCaption = font({ textStyle: "caption", design: "monospaced" });
export const monoCaption2 = font({ textStyle: "caption2", design: "monospaced", weight: "medium" });
export const monoCaption2Semibold = font({
  textStyle: "caption2",
  design: "monospaced",
  weight: "semibold",
});

/**
 * First claim on width, for the trailing badge or timestamp of a row whose
 * title is allowed to truncate around it.
 */
export const layoutPriorityOne = layoutPriority(1);

/** Fill the available width, content on the leading edge. */
export const fillWidthLeading = frame({ maxWidth: Infinity, alignment: "leading" });
export const fillWidth = frame({ maxWidth: Infinity });

/** The grouped-list card shape: continuous 18pt corners. */
export const cardShape = shapes.roundedRectangle({
  cornerRadius: 18,
  roundedCornerStyle: "continuous",
});
