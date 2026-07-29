# Single-tree redacted skeletons

Status: **prototype live on Details**; Status screen still uses the hand-built
`vehicle-skeleton.tsx` pending sign-off on a full rollout.

## The problem

Loading skeletons used to be separate component trees maintained in parallel
with the real UI (`details-skeleton.tsx`, `vehicle-skeleton.tsx`). They drifted:
block sizes and section shapes needed manual re-syncing every time the real
layout changed. The goal is one layout with two render modes, so the skeleton
*cannot* drift.

## Empirical finding: SwiftUI `redacted` does not cross `RNHostView`

SwiftUI has the ideal primitive (`.redacted(reason: .placeholder)`, exposed by
`@expo/ui` as the `redacted` modifier), but our screen content is React Native
views hosted inside the SwiftUI `ScrollView` via `RNHostView`.

Tested on-device (iPhone 17 simulator, iOS 26.5, `@expo/ui` 57.0.7): a
`VStack` with `redacted("placeholder")` containing both a SwiftUI `Text` and an
`RNHostView` with RN text. The SwiftUI text rendered as a gray placeholder bar;
the RN text rendered normally. The redaction environment stops at the
representable/host boundary, as hypothesized.

Consequence: to use native redaction, a screen's presentation would have to be
rewritten as a SwiftUI (@expo/ui) tree. Instead we replicate the redaction
*idea* on the RN side.

## The chosen design (Option B: RN redaction primitive, single tree)

Options considered:

- **A. Port screens to native @expo/ui trees** and use real `redacted`.
  Rejected for now: it is a full presentation rewrite per screen (custom cards,
  pressables, expo-image hero, popover footer), risks visual regressions
  everywhere, and the end state looks the same as B. Revisit per-screen if a
  screen goes fully native for other reasons.
- **B. RN redaction primitive, single tree** — chosen; described below.
- **C. Shared layout constants, two trees** — strictly worse than B (still two
  trees, still drift), only cheaper. Not needed.

How B works (see `src/components/redacted.tsx`):

- `<Redacted loading>` provides a context flag, pulses opacity while loading
  (same 0.4→1 / 800ms treatment the old skeletons used), and sets
  `pointerEvents: "none"` so placeholder content is inert (e.g. the Sign Out
  button cannot fire). The wrapper stays mounted in both states, so the
  loading↔data transition reconciles in place — no remount, no scroll jump.
- Redaction-aware leaves check `useRedacted()`:
  - `ThemedText` draws itself as a neutral bar: transparent glyphs over a
    `colors.fill` background, rounded corners. Font, line height, and width all
    come from its normal styles plus the placeholder string, so bars are always
    the exact size of real text.
  - The screens' `Icon` draws a `colors.fill` circle of its normal size.
- The screen renders its **real** tree unconditionally, feeding it
  `PLACEHOLDER_VEHICLE` (`src/data/placeholder-vehicle.ts`) while loading. The
  placeholder's string lengths set bar widths and its array sizes set row
  counts; everything else is the real layout. There is no skeleton file to keep
  in sync — that's the anti-drift guarantee, verified by changing the real row
  padding and watching the pinned skeleton change with zero other edits.

Verified on the simulator via the header dev toggle: identical geometry between
states (bars and text line up row-for-row), scroll offset preserved when
toggling while scrolled mid-list, scrolling works while redacted, and the
genuine cold start (long-press = query reset) goes skeleton → data in place.

Known, accepted approximation: array *counts* in the placeholder are a guess
(like any skeleton). This vehicle currently reports 4 capabilities and 0
subscriptions; the placeholder uses 4 and 2. Wrong guesses change section
heights when data lands — same limitation the old skeletons had, and the same
one SwiftUI redaction has with placeholder collections.

## Rolling out to Status (not yet done)

`status/index.tsx` + `vehicle-skeleton.tsx` would follow the same recipe:

1. Compute `loading` as Details does; render the real tree with
   `PLACEHOLDER_VEHICLE` inside `<Redacted loading style={{gap}}>` within the
   existing `NativeScrollView`; drop the early-return skeleton branch and
   delete `vehicle-skeleton.tsx`.
2. Status already uses the shared redaction-aware `Icon`; give the hero
   `expo-image` a redacted variant (a `colors.fill` rounded block in the same
   `heroImageFrame`) since `imageUrl` is empty while loading.
3. The lock pill, tire cells, and status lines are all `ThemedText` + `Icon`,
   so they redact for free; the placeholder's 8 closures / 4 tires produce the
   grid shapes.
4. Keep the "My Lexus" title fallback while `!data`, keep `onRefresh`, and keep
   the native SwiftUI footer out of the redacted RN wrapper — either hide it
   while loading (current skeleton has no footer) or apply the real
   `redacted("placeholder")` modifier to it, which *does* work there since the
   footer is genuine SwiftUI.
5. The offline banner stays outside `<Redacted>` so it never pulses or redacts.

Estimated cost: comparable to the Details change (~1 focused edit of the screen
file plus placeholder tweaks); no new primitives needed.
