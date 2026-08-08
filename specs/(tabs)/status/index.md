# Status (dashboard)

- **Route:** `/(tabs)/status` — iOS ✅ · Android ✅

## Purpose

The car at a glance, and the controls that act on it. One scrolling column of
cards: where it is parked, how much energy and range it has, the remote
controls, remote-start climate settings, doors and windows, odometer, and tire
pressure — closed by two lines saying how fresh all of it is.

## Data

**The shared vehicle scaffolding** — `useVehicleScreen()`
(`src/hooks/use-vehicle-screen.tsx`), which the Specs screen uses too. It
returns the vehicle query, the vehicle to render, the status snapshot's write
timestamp, a redaction reason, a status banner, and (in dev/preview builds only)
a header control that force-holds the skeleton. It also marks the route
interactive for performance instrumentation.

The vehicle itself merges two queries with different lifetimes
(`src/hooks/use-vehicle.ts`): a **profile** (identity, spec sheet, remote
capabilities, subscriptions) that is considered current for a day, and a
**status snapshot** whose freshness is owned by the tab layout's refresh ladder
rather than by the query library. `dataUpdatedAt` is the *status* half's write
time — the freshness a user cares about.

**Derived on this screen:**

- `groupClosures(vehicle.closures)` (`src/data/closures.ts`) splits closures into
  four corners (front/rear × driver/passenger, each pairing a door and a window)
  and a list of other openings, ordered moonroof, trunk, hood, then anything
  unrecognized in its original order. Openings carry only a position, so ones
  without a reading are dropped.
- `fuelGauge(fuelType, fuelPercent)` (`src/data/fuel.ts`) — see the Fuel card.
- `observedAt(vehicle.updatedAt, dataUpdatedAt)` (`src/data/time.ts`) — the
  car's own timestamp, **clamped to the read that carried it**. Car clocks drift
  by minutes; a car running ahead would otherwise produce a snapshot that reads
  as newer than the fetch delivering it, so the two footer lines would
  contradict each other. Display only — the stored value keeps the car's number,
  because the closure fold orders snapshots against each other in the car's
  clock.
- `oldestStale(vehicle.updatedAt, [...shown corner timestamps, ...opening
  timestamps])` (`src/data/closure-display.ts`) — the oldest displayed closure
  reading that predates the latest snapshot, or null when everything shown is as
  fresh as the snapshot.
- `useNow()` — **one clock for the whole screen**, so every "how long ago" on it
  is measured from the same instant and two lines about two different moments
  can never disagree about when *now* is. It ticks once a minute, only while the
  screen is focused and the app is foregrounded, and re-reads immediately on
  becoming visible again so a screen revealed after an hour is right on its
  first frame.
- `useIsAutoRefreshing()` — true only for refreshes the app started on its own.

## Structure

The stack title is the vehicle's nickname (native chrome, outside the redacted
tree — so while loading it reads the placeholder's generic "My Vehicle" rather
than the tab's "Status" label, which reads oddly as a large screen title).

In order down the scroll:

1. **Status banner**, conditionally — see States.
2. **Hero card.** The vehicle's render (from the telematics image CDN) with a
   **Last Parked** button in the bottom-right corner. Behind the render, the
   parked-location map fills the card edge to edge as a muted backdrop — on iOS
   only; see Platform notes. The map is *not* interactive here; only the button
   opens the map.
3. **Fuel bar.** A labeled bar divided into quarters — mirroring the car's own
   dashboard, because the underlying reading is an estimate — with the precise
   readout and range beside it ("62% · 277 mi"). `fuelGauge` supplies the label
   ("Charge" for electric vehicles, "Fuel" otherwise), the glyph, the readout
   ("Full" at 100%), the per-quarter fill fractions (the active quarter fills
   proportionally), and a level tier: full, high (>25%), medium (>15%), low
   (>5%), critical. Full reads green as a reward; high stays neutral in the text
   but green in the bar; medium/low/critical escalate yellow → orange → red in
   both. Only the level takes the gauge color — the range beside it does not,
   because it is the actionable half of the story and shouldn't compete.
4. **Remote controls** — section title "REMOTE CONTROLS" with live state
   indicators on the trailing edge, then the button row, then the "More
   controls" disclosure. See Interactions.
5. **Climate card** — "Remote Start Climate", subtitled "Settings for when you
   start your vehicle remotely." A master switch, a temperature setpoint slider
   with a readout, and front/rear defrost chips. These are settings the car
   applies on the *next* remote start, not live actuation, which is why the card
   sits with the controls.
6. **Doors & windows**, only when there is at least one corner or opening to
   show. Section title "DOORS & WINDOWS", then a card that leads with a one-line
   verdict and hides the per-corner detail behind a tap, then — when some
   readings predate the latest snapshot — a single staleness note.
7. **Odometer.** Section title "ODOMETER", then one card holding the lifetime
   total beside the resettable Trip A / Trip B pair on a gentle fill (they are
   one instrument cluster in the car, so they share one card). Trips keep one
   decimal place, matching dashboard precision; the total is a whole number.
   Mileage sits here because it bridges immediate access/security state above and
   longer-term running condition below, without competing with the location and
   fuel summary at the top.
8. **Tire pressure**, only when there are readings. Section title "TIRE
   PRESSURE", then a card laid out like the car itself — front row on top, left
   readings in the left column — with each corner's label and value. A value the
   car flags as low is drawn in the warning orange. The card shrink-wraps its
   grid rather than stretching across the screen.
9. **Footer** (below the scrolling content, always present): two centered lines,
   "Vehicle last synced with Lexus \<relative time\>." and "Lexy checked for data
   \<relative time\>." The first is the car's own clamped stamp; the second is
   when the app last read. Relative times read down to seconds and pair the two
   largest units ("2 hours 5 minutes ago"); under five seconds is "just now",
   and an unparseable stamp reads "unknown".

The summary readouts (hero, fuel) sit *above* the "REMOTE CONTROLS" title so
they don't read as controls; location comes before the energy and range
available to leave that location.

### Doors & windows card

The collapsed header is a badge glyph, a headline, and an optional subline, at a
fixed height regardless of state. `closuresSummary` (`src/data/closure-summary.ts`)
computes all of it:

- A lock or unlock command in flight owns the headline: "Locking…" / "Unlocking…"
  in a neutral tone, because the doors are in flux and neither verdict is worth
  asserting.
- Otherwise, anything needing attention becomes an exception. One exception *is*
  the headline ("Front driver door unlocked", "Trunk open"). Several become a
  count that states facts rather than a verdict — "2 open", "3 doors unlocked",
  "2 open, 1 unlocked" — because an open window in the garage may be entirely
  intentional. The subline then reads "Everything else closed", or "Everything
  else closed and locked" when the remaining doors genuinely carry lock
  readings.
- All clear reads "All secure" only when every shown door is *confirmed locked*;
  position-only data honestly claims "All closed" instead. The subline names
  what was read ("Doors locked · Windows and trunk closed"), collapsing to
  "Everything else closed" once three or more groups are settled.
- Headlines are sentence case, not the title case the app's labels use — the
  slot holds a status, and most of what lands in it is a phrase.

Expanded, the card shows the corners as a grid (front row above rear, driver
column left) with each corner's title over its door and window lines, then the
other openings as a list below. Per-reading wording comes from
`closure-display.ts`: a door reads "Door open" / "Door unlocked" / "Door locked"
/ "Door closed" (the last when position is known but there is no lock reading),
and shows "Locking…" / "Unlocking…" while an optimistic prediction is
unconfirmed. A window with no position reading is not shown at all. Openings
read "\<label\> open" / "\<label\> closed". Each line is tinted by tone:
attention is warning orange, settled is reassuring green.

### Remote controls

The section title row carries live state on its trailing edge, in the same order
as the buttons below it:

- **Lock state** — "Locked" only when *every* door that reports a lock says
  locked (doors are the only closures with a lock); "Unlocked" otherwise. While
  a lock/unlock prediction is unconfirmed it reads "Locking" / "Unlocking" and
  the word pulses — the wait has no length to promise, only a state to report,
  so it pulses rather than trailing an ellipsis.
- **Engine state** — "Started" / "Stopped" from the engine-status read, or
  "Starting" / "Stopping" (pulsing) while a just-issued engine command is still
  being confirmed. With no reading yet the indicator is **absent** rather than
  claiming "Stopped" about an engine nobody asked about.

The main row is three buttons: **Lock**, **Unlock**, and one engine slot that is
**Stop** while the car reports running and **Start** otherwise.

Below it, a **More controls** disclosure — collapsed by default, subtitled with
a sentence naming exactly what it hides ("Trunk, headlights, hazards, horn, and
buzzer") so the row says what opening it will offer. Its contents are gated per
capability, three per row, from the vehicle's own capability set
(`src/data/remote-capabilities.ts`, read from the discovery record's
`extendedCapabilities` block — absent means unsupported):

| Capability | Buttons |
| --- | --- |
| `trunk` | Lock Trunk, Unlock Trunk |
| `hazards` | one button: Hazard Lights or Hazards Off |
| `headlights` | Flash Lights |
| `buzzer` | Play Beeps |
| `horn` | Honk Horn |

The whole disclosure is omitted when a car reports none of these. Hazards are
one swapping button rather than a pair, the way the engine slot is — the label
and color say which way it will go. There is deliberately no "headlights off":
the command plane defines no such code, so the lights are a find-my-car flash
rather than a switch, and offering an off that can't be sent would be a lie.
Hazard direction is remembered locally from the last command and nothing
reconciles it — nothing reports hazard state — so a car whose hazards were left
on elsewhere opens the app offering to turn them on again, which is harmless and
preferable to an "off" button that would be equally wrong.

Subscription/entitlement gating is intentionally **not** wired: the
subscriptions response shape hasn't been captured, so there is no honest way to
tell whether Remote Connect is active. Every control is offered on every build,
production included.

## States

**Redaction (loading / unavailable).** The screen renders *one* tree in every
state: the real, populated component tree fed placeholder vehicle data and drawn
as neutral bars (`Redactable`, `src/components/ui/redactable.tsx`). The layout
therefore cannot drift from itself, sizes are identical in both states, and
toggling reconciles in place so the scroll offset survives. Two reasons:

- `loading` — a fetch is in flight; the skeleton **pulses**.
- `unavailable` — offline with nothing cached, so the fetch is paused and
  nothing is on its way; the skeleton **holds still**, because a pulse would
  promise an arrival that cannot happen.

Redaction wraps the *content*, not the scroll view — around the scroll view its
inertness took the scrolling with it, so the skeleton couldn't be scrolled at
all. Everything interactive inside guards itself instead: the two disclosure
headers are disabled, the hero's map button is replaced by a flat pill, the
climate switch and slider are replaced by plain placeholders, and the control
buttons keep their live geometry but hide their contents and refuse to actuate.
Redaction-specific details worth carrying to another platform:

- The hero's map, where there is one, still draws while redacted — it *is* the
  card, and a grey rectangle in its place reads as a broken image rather than a
  loading one. Only the car render and the button stand down, and the render's
  frame keeps its height so nothing below moves.
- The fuel bar's segment fills go to the neutral track color, so the gauge reads
  as empty tracks rather than a placeholder confidently reporting a full tank.
- Status glyphs give way to neutral dots rather than being masked in place — a
  masked green padlock would claim a verdict without looking like an icon.
- The heaviest text on a card drops to the secondary color while redacted, so
  its bar isn't the darkest thing on a screen that is claiming nothing.
- The engine indicator, normally absent without a reading, renders as a bar
  while redacted: the row is trailing-aligned, so an absent second indicator
  would shift the lock indicator the moment the first reading landed.
- Neither the engine-status read nor the climate-settings read runs while
  redacted — the placeholder VIN isn't a car. The climate card still prefers a
  *real* cached reading when the persisted cache has one, so it can show its
  true state rather than the stand-in's defaults.
- The footer lines are redacted and their taps disabled, which also spares them
  from rendering the placeholder's timestamps as readable sentences.

**Offline.** A banner reads "You're offline" — detailed "Showing the latest data
we saved." when there is cached data, "Reconnect to see your vehicle."
otherwise. Offline outranks a stale error: the network being down is the more
actionable explanation, and a paused query's last error is stale anyway.

**Failed refresh with cached data.** A banner reads "Couldn't refresh", detailed
with a plain-language reason ("a permission problem", "a server error", …)
followed by "Showing the latest data we saved." The cached dashboard stays on
screen underneath.

**Failed load with nothing cached.** The content tree is replaced entirely by a
centered full-screen state with a **Try again** action that re-runs both halves
of the load: "Vehicle data unavailable" for a fetch failure (carrying the same
plain-language reason), or "No vehicle found" when the account authenticates but
has no vehicle enrolled — a distinct empty state that points at the official
Lexus app for adding a car. The stack title falls back to "My Vehicle" in this
case.

**Stale closure readings.** A sparse snapshot can leave windows and openings
older than the snapshot itself (e.g. windows after a drive). One note for the
whole closures area — not one per card, since they all go stale together — reads
"Some readings as of \<relative time\>", driven by the oldest such reading. It is
clamped by the same read as the footer's sync line and measured from the same
clock, so the reading it names always reads as older than the snapshot named
below it.

**Automatic refresh in flight.** Two quiet cues, and only for refreshes the user
didn't ask for: a floating "Refreshing…" note with a spinner fades in near the
top, over the content rather than in it (nothing on screen moves to make room),
and the footer's second line becomes "Updating…" until it lands. The note is
announced to screen readers, since nothing moves focus and no gesture can land
on it, but stays out of the accessibility tree so the announcement is the single
telling.

## Interactions

- **Pull to refresh.** A pull is explicit intent, so it *primes*: it wakes the
  car for a fresh full snapshot before re-reading, so the read returns complete
  state instead of the last sparse push. It then refetches the status snapshot,
  the climate settings, and — on a manual refresh only — the profile, because a
  pull means "everything on this screen" and some of that (the vehicle's name,
  edited in the official Lexus app) is profile data the car never reports.
  Priming is rate-limited per vehicle and costs the 12V battery; if it is
  declined, fails, or has no session, the plain re-read still runs, so a pull
  always fetches. The scroll view's own spinner is the only indicator — the
  floating note deliberately stays out of it. The vehicle context comes from the
  *query*, never from the rendered vehicle: while redacted that is the
  placeholder, and pulling on a skeleton must not address a VIN that isn't a
  car.
- **Last Parked** — opens `/status/map` as a sheet, with a selection haptic. The
  map behind the car is a non-interactive backdrop; only this button navigates.
- **Tapping either footer line** — reveals the precise local timestamp behind
  it, in the device's time zone (weekday, date, year, and time to the second).
  The surface that carries it is per-platform; see Platform notes.
- **Tapping the Doors & Windows header** — expands or collapses the per-corner
  detail, with a chevron that rotates. Disabled while redacted.
- **Tapping the More controls header** — same, for the extra control grid.
- **Tapping a remote control** — every one of them confirms first, via a
  **centered modal** with a title, a consequence message, one action button, and
  a way to cancel:

  | Control | Title | Message | Action (destructive?) |
  | --- | --- | --- | --- |
  | Lock | Lock your vehicle? | This locks all doors. | Lock |
  | Unlock | Unlock your vehicle? | This unlocks the doors. Only do this when you're near the vehicle. | Unlock (yes) |
  | Start | Remotely start the engine? | Never remotely start the engine in an enclosed space, or with a child or pet inside the vehicle. | Start Engine (yes) |
  | Stop | Stop the engine? | This ends the remote start. | Stop Engine |
  | Lock Trunk | Lock the trunk? | This locks the trunk. | Lock Trunk |
  | Unlock Trunk | Unlock the trunk? | This unlocks the trunk. Only do this when you're near the vehicle. | Unlock Trunk (yes) |
  | Hazard Lights | Flash the hazards? | The hazard lights start flashing until you turn them off. | Turn On |
  | Hazards Off | Turn off the hazards? | This stops the hazard lights. | Turn Off |
  | Flash Lights | Flash the headlights? | The headlights come on to help you find the vehicle. | Flash |
  | Play Beeps | Sound the buzzer? | The vehicle beeps ten times. | Play Beeps |
  | Honk Horn | Sound the horn? | The vehicle will sound its horn. Be sure not to startle anyone. | Honk Horn (yes) |

  Centered rather than anchored to the button it came from, tried both ways on
  device: an anchored confirmation puts the question in a different place for
  every control, so it is one you have to re-find each time; a centered one
  lands in the same spot for all eleven. It also suits the content — one
  alternative, not a set, and a consequence warning that a menu or an action
  sheet would render as small grey text above the choices rather than as the
  thing being said.

- **Confirming a command.** A medium impact haptic fires immediately, the whole
  control row disables while the command is in flight, and the command is POSTed.
  Acceptance (not completion) gives a success haptic; failure gives an error
  haptic and a "Command failed" alert carrying the underlying message. There is
  **no success alert** — the section title's pending state is the feedback.
  After acceptance:

  - **Lock / unlock** — the predicted lock state is folded into the local closure
    store immediately and flagged optimistic, so the indicator and the door rows
    reflect it at once as a pending state. A background reconciliation then
    re-reads status on a schedule spanning about a minute, merging each
    (possibly partial, possibly stale) payload without clobbering the
    prediction; if plain re-reads keep returning the pre-command snapshot it
    escalates to a prime. If the car never confirms, the prediction is quietly
    stood down and the rows return to the last real reading — the pending label
    disappearing is the whole message, since there is nothing to act on that
    pulling to refresh doesn't already cover. A newer command's prediction
    outlives an older one's abandonment.
  - **Engine start / stop** — no closure changes, so nothing is predicted.
    Instead the engine-status read is re-run four times at 20-second intervals
    (the first immediately), matching how the official app confirms. Meanwhile
    the indicator reads "Starting…"/"Stopping…"; it resolves as soon as
    engine-status agrees, and gives up when the poll window closes, so a command
    the vehicle silently dropped doesn't leave "Starting…" on screen forever.
  - **Hazards** — the remembered direction flips.
  - **Anything else** — the status snapshot is invalidated.

- **Climate master switch** — toggles whether climate runs on the next remote
  start. Turning it off dims *and* disables the setpoint and defrost rows. The
  fade belongs to changes the user makes: the first real settings to arrive,
  including the ones replacing the skeleton's stand-in, land without animating,
  so a car whose climate is off never shows enabled controls and then dims them.
- **Temperature slider** — the readout follows the drag; the write commits on
  release. Its range, step, and unit come from the wire in the car's own
  configured unit (a Fahrenheit car reports 65–85 in 1° steps; a metric car
  reports its own Celsius range), so no conversion happens anywhere. The row is
  hidden entirely when the settings carry no range. The readout reserves the
  width of its widest plausible value so the slider doesn't resize as the number
  changes.
- **Defrost chips** — front and rear, each shown only when the car reports that
  parameter, each toggling with a selection haptic and an active tint.
- **Climate writes are optimistic**: the cache takes the change immediately so
  the controls never lock up or snap back mid-save, each write PUTs the exact
  settings object the read returned with one field changed and then re-reads to
  confirm the server stored it, and a rejection rolls back and raises a
  "Couldn't save climate settings" alert. A slow confirm cannot clobber a newer
  optimistic change.
- **Dev and preview builds only:** a header control force-holds the loading
  skeleton on the real screen, for inspecting exactly that state. It is absent
  from production.

## Platform notes

- **The hero has no map backdrop on Android.** The card there is the vehicle's
  render and the Last Parked button on a plain surface. Android's map view wants
  a Google Maps SDK API key the project doesn't have, and `VehicleLocationMap`
  deliberately refuses to draw off iOS rather than showing an unkeyed grid — so
  a backdrop here would be a "can't load map" tile behind the car, which reads
  worse than no backdrop at all. The button still opens `/status/map`, and the
  backdrop returns when the key does.
- **Map attribution is reachable, the rest of the hero map is not.** On the
  platform that draws one, the hero map's touch area is shrunk to a small window
  in the card's bottom-left corner, where the map provider draws its
  legal/attribution link — the link must stay tappable (it opens the provider's
  map-data notices), while the rest of the map must not intercept the scroll
  gesture. Any platform rendering a full-bleed map in this card owes the same:
  attribution reachable, everything else inert.
- **The footer's timestamp reveal is a popover on iOS and a dialog on Android.**
  Android's anchored surface is the Material tooltip, which is a long-press
  affordance — a tooltip that only ever appears on tap is one nobody finds — so
  the tap opens the same Material dialog the controls confirm through, titled
  with the line's subject and carrying the timestamp as its body.
- **The control buttons are drawn differently.** iOS renders them as SwiftUI
  glass buttons; Android draws Material tonal surfaces in React Native, pressed
  through `react-native-gesture-handler`. The reason is the glyph: the app names
  its icons semantically and resolves them to a Material *font* on Android,
  which Compose's `Icon` — it wants an XML vector drawable — cannot take, and
  hosting eleven React Native views inside eleven clickable Compose containers
  would put a foreign view over each button's own touch area. The dialogs those
  buttons raise are real Compose `AlertDialog`s, and so are the climate card's
  switch and slider.
- **Per-glyph optical sizing is an iOS concern.** SF Symbols occupy wildly
  different fractions of their point size, so the closure readings and control
  buttons nudge each symbol individually to look evenly weighted. Material draws
  to a uniform em box, so Android uses one size per context.
- Several hosted native sub-views are given fixed sizes rather than measuring
  their content. On iOS that is a workaround: a measuring host reports a
  zero-size box on its first layout pass and the row collapses for a frame. On
  Android the three Compose slots (the hero button, the climate switch, the
  climate slider) are pinned for a different reason — each is swapped for a
  placeholder while redacted, and a pinned slot is what makes the two the same
  box by construction. Neither is product behavior.
- The map fades in on its first camera settle (with a timed fallback) rather
  than snapping its tiles in at full strength.

| Concern | iOS | Android |
| --- | --- | --- |
| Confirmation UI | Centered alert with system Cancel | Centered Material dialog with an explicit Cancel |
| Destructive action | System `destructive` button role | Confirm label drawn in the error colour |
| Card expansion | Height clip + rotating chevron, driven off the JS thread | Same — the shared `ExpandableCard` |
| Hero backdrop | Apple Maps, full bleed and muted | None — awaits the Google Maps key |
| Attribution hit window | Negative hit-slop on the hero map | — (no hero map to reach into) |
| Footer timestamp reveal | Popover anchored to the line | Material dialog |
| Control buttons | SwiftUI glass buttons in a fixed-height host | Material tonal surfaces in React Native |
