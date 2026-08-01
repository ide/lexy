/**
 * The scroll offsets over which iOS trades a screen's large title for the
 * inline one in the navigation bar.
 *
 * UIKit runs that swap itself and exposes no signal for it, so anything a
 * screen wants to fade in alongside the inline title has to be driven from the
 * scroll offset instead. These bounds are the standard 52pt large-title band:
 * the title starts shrinking almost immediately, and the inline title has
 * fully arrived by the time the bar reaches its collapsed height.
 */
export const COLLAPSE_START = 12;
export const COLLAPSE_END = 44;

/**
 * How far through the large-to-inline swap the navigation bar is, from 0
 * (large title, fully expanded) to 1 (inline title, fully collapsed).
 *
 * Clamped at both ends so a rubber-band overscroll above the top — where
 * `contentOffsetY` goes negative — reads as "expanded" rather than wrapping
 * into a partial fade.
 */
export function collapseProgress(contentOffsetY: number): number {
  // Called from the scroll view's UI-thread worklet, which can only reach
  // functions that are workletized themselves. Harmless everywhere else — in
  // Node (and on the JS thread) the directive is an inert string statement.
  "worklet";
  const span = COLLAPSE_END - COLLAPSE_START;
  const progress = (contentOffsetY - COLLAPSE_START) / span;
  return Math.min(1, Math.max(0, progress));
}
