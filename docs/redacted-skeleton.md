# Single-tree redacted skeletons

Status: **live on Details and Status**. Both hand-built skeleton files are gone
(`details-skeleton.tsx`, `vehicle-skeleton.tsx`); every screen renders one tree
in two modes.

## The problem

Loading skeletons used to be separate component trees maintained in parallel
with the real UI (`details-skeleton.tsx`, `vehicle-skeleton.tsx`). They drifted:
block sizes and section shapes needed manual re-syncing every time the real
layout changed. The goal is one layout with two render modes, so the skeleton
_cannot_ drift.

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
_idea_ on the RN side.

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

Known, accepted approximation: array _counts_ in the placeholder are a guess
(like any skeleton). This vehicle currently reports 4 capabilities and 0
subscriptions; the placeholder uses 4 and 2. Wrong guesses change section
heights when data lands — same limitation the old skeletons had, and the same
one SwiftUI redaction has with placeholder collections.

## Status: the same recipe, plus what a live screen needed

Status followed the Details recipe — `loading` computed the same way, the real
tree fed `PLACEHOLDER_VEHICLE` inside `<Redacted loading style={styles.group}>`,
the early-return branch dropped, the offline banner left outside the wrapper so
it neither pulses nor redacts, and the "My Lexus" fallback title preserved (it
is the placeholder's own nickname, and the nav bar sits outside the redacted
tree anyway).

Four things Details didn't have to deal with:

- **SwiftUI islands don't take RN redaction — and native redaction only covers
  labels.** The hero's "Last parked" glass button, the climate switch and
  slider, and the footer's popover rows are genuine SwiftUI inside `Host`s, so
  `useRedacted()` can't style them. The real `redacted()` modifier does apply
  within a host, and it is enough for the button and the footer (text becomes
  grey bars). It is _not_ enough for controls: a redacted `Toggle` still draws a
  live blue switch and a redacted `Slider` still draws its filled track, so
  those two are swapped for plain RN placeholders in the same slots while
  loading. Redaction also doesn't disable anything — the button takes
  `disabled(true)` alongside it.

  One more wrinkle: placeholder redaction masks a label's _image_ into a solid
  rounded rect in the image's own color, so the button's blue `map.fill` glyph
  came out a blue square. It gets the neutral fill color while redacted.

- **Placeholder data must not address a real API.** The climate settings read is
  vehicle-scoped through its headers, so `useClimateSettings` takes a
  `placeholder` flag that disables the query and returns
  `PLACEHOLDER_CLIMATE_SETTINGS` instead; writes still read from `query.data`,
  so they no-op while redacted. Pull-to-refresh likewise primes the telematics
  unit from `data`, never from the placeholder.
- **A collapsed card is worse than a wrong one.** Without stand-in settings the
  climate card would render its header alone and then grow by ~110pt when the
  real settings landed — the `available` flags decide whether the slider and
  defrost rows exist at all, so the placeholder turns them on.
- **The hero, and anything else drawn in raw color.** The map and car render
  give way to a single `colors.fill` block in the same `heroImageFrame`, since
  `imageUrl` is empty on placeholder data and the map would otherwise animate to
  null island. The fuel gauge needed the same treatment for a different reason:
  its segment fills are plain colored views, not text or icons, so an unmodified
  skeleton reported a confident green full tank. They take the track color while
  redacted, leaving the gauge as its own empty tracks.

The placeholder's closures now carry a moonroof, trunk, and hood alongside the
eight doors and windows, because a real snapshot reports them
(docs/vehicle-status-and-control.md) and they get their own grid below the
corners. Same class of guess as the capability/subscription counts above.
