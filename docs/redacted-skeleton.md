# Single-tree redacted skeletons

The Status and Specs (`details`) screens draw their loading skeleton from the
same component tree as their content, in a redacted mode. A skeleton kept as a
separate tree drifts: its block sizes and sections need re-syncing whenever the
real layout changes. When the content and the skeleton are one tree, the
skeleton cannot drift.

## Why not SwiftUI's `redacted`

SwiftUI has the primitive, `.redacted(reason: .placeholder)`, which `@expo/ui`
exposes as the `redacted` modifier. The screens' content, though, is React
Native views hosted inside the SwiftUI `ScrollView` through `RNHostView`, and
the redaction environment stops at that boundary. On an iPhone 17 simulator
(iOS 26.5, `@expo/ui` 57.0.7), a `VStack` with `redacted("placeholder")` holding
a SwiftUI `Text` and an `RNHostView` with React Native text drew the SwiftUI
text as a gray bar and the React Native text as usual.

Native redaction would therefore mean rewriting each screen's presentation as an
`@expo/ui` tree: its custom cards, the `expo-image` hero and the popover footer.
That rewrite risks visual regressions on every screen and ends at the same
result, so Lexy implements the redaction idea on the React Native side instead.
A screen that becomes fully native for other reasons can use `redacted` then.

## How it works

`src/components/ui/redactable.tsx` follows SwiftUI's vocabulary: a subtree is
_redactable_, and a redaction _reason_ says whether it is redacted now and why.

- `<Redactable reason>` provides a context flag, pulses the subtree's opacity
  while a fetch is in flight (the timing is `pulsing-text.ts`'s), and sets
  `pointerEvents: "none"` so placeholder content is inert (Sign Out cannot
  fire, for one). The wrapper stays mounted in every state, which is why it is
  `Redactable` and not `Redacted`; its contents are the real tree whenever
  `reason` is null. The change from loading to data therefore reconciles in
  place, with no remount and no scroll jump.
- `reason` is one value, `"loading" | "unavailable" | null`, so "animating but
  not redacted" cannot be represented:
  - `"loading"`: a fetch is in flight and the data is on its way. It pulses.
  - `"unavailable"`: offline before anything was cached. React Query has paused
    the fetch, so nothing is on its way, and it holds still: a pulse would
    promise an arrival that cannot happen.
  - `null`: the real content.
- Leaves that know about redaction read `useRedacted()`:
  - `ThemedText` draws itself as a neutral bar: transparent glyphs over a
    `colors.fill` background, with rounded corners. Its font, line height and
    width come from its usual styles and the placeholder string, so each bar
    is the size of the text it stands in for.
  - The screens' `Icon` draws a `colors.fill` circle of its usual size.
- The screen always renders its real tree, fed `PLACEHOLDER_VEHICLE`
  (`src/data/placeholder-vehicle.ts`) while loading. The placeholder's string
  lengths set the bars' widths and its arrays set how many rows there are; the
  rest is the real layout, so there is no skeleton file to keep in sync.

On the simulator, with the header's developer toggle, both modes have the same
geometry (bars and text line up row for row), the scroll offset holds when
toggling mid-list, the redacted screen scrolls, and a cold start (a long press
resets the queries) goes from skeleton to data in place.

The placeholder's arrays are a guess, as any skeleton's are: when the car
reports a different number of capabilities, subscriptions or closures, a
section's height changes when the data lands. SwiftUI's redaction has the same
limit with placeholder collections. The placeholder's closures include a
moonroof, trunk and hood beside the doors and windows, because a real snapshot
reports them (docs/vehicle-status-and-control.md) and they have their own grid
below the corners.

## What Status adds

Status computes `redaction` as Specs does and wraps its real tree in
`<Redactable reason={redaction} style={styles.group}>`. The status banner sits
outside the wrapper, so it neither pulses nor redacts. The navigation bar is
outside the redacted tree too, so while loading it shows the placeholder's own
nickname, "My Vehicle", as the title.

- **SwiftUI controls take native redaction only on their labels.** The hero's
  "Last Parked" glass button, the climate switch and slider, and the footer's
  popover rows are SwiftUI inside `Host`s, so `useRedacted()` cannot style them.
  The `redacted()` modifier applies within a host and is enough for the footer,
  whose text becomes gray bars; redaction disables nothing, so the footer also
  takes `disabled(true)`. It is not enough for controls: a redacted glass button
  keeps its glass shell around a small gray bar, a redacted `Toggle` still draws
  a live blue switch, and a redacted `Slider` still draws its filled track. While
  loading, each of them is replaced by a React Native placeholder in the same
  slot, the button by a flat pill.
- **Placeholder data never addresses a real API.** The climate settings read is
  scoped to the vehicle by its headers, so `useClimateSettings` takes a
  `placeholder` flag that disables the query and shows the cached settings, or
  `PLACEHOLDER_CLIMATE_SETTINGS` when there are none. Writes read `query.data`,
  so a write never sends the stand-in settings, and pull-to-refresh primes the
  telematics unit from `data`, never from the placeholder.
- **The climate card keeps its full height.** Its `available` flags decide
  whether the slider and defrost rows exist, and without them the card would
  draw its header alone and then grow by about 110 pt when the settings land,
  so the placeholder settings turn them on.
- **Views drawn in raw color are handled one by one.** The car render is absent
  while redacted, and the map draws in both modes. The loading placeholder has
  an empty `imageUrl`, which draws nothing, and a 0,0 location, which the hero's
  map shows until the data lands. The developer data states that force cached
  data (`data-state.ts`) render `MOCK_VEHICLE`, which carries a real IS 350
  render and parks the car at Apple Park, so they look like the live dashboard.
  The fuel gauge's segment fills are plain colored views, so they take the
  track color while redacted; otherwise the skeleton would show a full green
  tank.
