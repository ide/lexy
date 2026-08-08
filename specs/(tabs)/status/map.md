# Last Parked (location sheet)

- **Route:** `/(tabs)/status/map` — iOS ✅ · Android ✅

## Purpose

Where the car is parked, on a map, with a hand-off to a real navigation app.
Presented as a bottom sheet over the Status screen (see
`specs/(tabs)/status/_layout.md` for the presentation and its header).

## Data

- `useVehicle()` — read **directly**, not through the shared screen hook. The
  sheet is only reachable from the Status screen, which already holds a loaded
  vehicle. It needs the location coordinates, the nickname (used as the map
  pin's title and the label handed to the navigation app), the car's own
  `updatedAt`, and the status query's `dataUpdatedAt`.
- `useNow()` — **its own clock**, not the Status screen's: this sheet can sit
  open for a while, and the screen underneath has stopped ticking while blurred.
- `useParkingAddress(location)` — reverse-geocodes the coordinates to a short
  street line, matching what the official Lexus app shows. Coordinates are
  rounded to about a meter for a stable cache key, so a location refresh that
  didn't actually move the car reuses the result; the result never expires and
  failures are not retried.
- `useMapsProvider()` — reconciles the saved navigation-app preference against
  what is actually installed. See Interactions.
- The freshness line uses `observedAt(vehicle.updatedAt, dataUpdatedAt)`, the
  same clamped-to-the-read timestamp the Status footer uses, rendered with the
  same relative-time wording.

## Structure

Top to bottom, inside the sheet (the title "Last Parked" is the stack header,
not part of this content):

1. **Address line** — the reverse-geocoded street line. It always occupies its
   slot, blank while the lookup resolves, so the map and button don't shift down
   when the text lands a beat after the sheet opens.
2. **Freshness line** — "Location as of \<relative time\>".
3. **Map**, filling the remaining height: centered on the car's coordinates at a
   zoom close enough to read the street it is on without losing the surrounding
   block, with a single car-shaped marker titled with the vehicle's nickname.
   It is inset from the sheet's rounded corners and clipped so its own square
   corners never poke past them. Every built-in map control (compass,
   my-location, scale bar, pitch toggle) is hidden: this is a compact glanceable
   view, not a navigation surface, and the marker already fixes the frame on the
   parked spot. Built-in points of interest *are* shown here (unlike the hero
   card's backdrop map, which hides them).
4. **Footer button**, full width above the safe-area inset: **Open in \<app\>**
   once a provider is resolved, otherwise the neutral **Open in Maps**.

## States

- **No vehicle** — a centered "Location unavailable". Defensive only: the sheet
  is reachable only from a screen that already has a loaded vehicle.
- **Address resolving** — the address line is blank but its slot is reserved.
- **No navigation apps installed** — the button renders in its non-prominent
  style so it looks inert, but still explains on tap.
- The map fades in on its first camera settle rather than snapping its tiles in
  at full strength, with a timed fallback in case that signal never arrives.

## Interactions

**Open in Maps** hands the coordinates and the vehicle's nickname to an external
navigation app. The supported providers, in this fixed order, are Apple Maps,
Google Maps, and Waze (`src/data/maps-providers.ts`); each is considered
installed only if the platform reports its URL scheme as openable.

Resolution (`resolveMapsProvider`, pure and unit-tested) produces one of:

- **none** — nothing installed. Tapping shows an alert: "No maps app installed",
  explaining that Apple Maps, Google Maps, or Waze can be installed from the
  store to open the vehicle's location.
- **ready** — one provider to open directly. Either it came from the saved
  preference, or it was auto-picked because it is the only one installed.
  Exactly one installed app is used without prompting *and without being saved
  as a deliberate choice*, so installing a second app later still prompts.
- **prompt** — several installed and no valid saved choice. Tapping presents a
  chooser titled "Open location in" listing the installed providers; the pick is
  remembered and then opened immediately. The chooser supplies its own Cancel.

A saved preference for an app that is no longer installed is treated as unset
and cleared from storage, so the setting genuinely reads unset and the user is
prompted again. Installed apps are re-probed every time a consuming screen gains
focus, since apps can be installed or deleted while the app is backgrounded.

If the launch itself fails, an alert reads "Couldn't open \<app\>" — "The app
didn't respond to the location link. It may have just been removed."

The preference is stored in the same synchronous key-value store the query cache
uses, so this screen and the Settings row can render the right label on first
paint with no loading flash.

## Platform notes

- **The map component currently refuses to render off iOS.** `VehicleLocationMap`
  guards on the platform and renders the text "Maps are only available on iOS."
  everywhere else, because the map view it uses is Apple Maps. This is a
  placeholder, not intended behavior — an Android tree replaces this branch with
  a real map rather than inheriting the message.
- Apple Maps is probed rather than assumed present: it is a system app but has
  been removable since iOS 14.
- The chooser and the failure alert are presented from the button itself rather
  than called imperatively, so both hang off the view that triggered them and
  neither declares its own Cancel/OK (the system supplies those).

| Concern | iOS | Android |
| --- | --- | --- |
| Map renderer | Apple Maps | An empty surface holding the map's slot until the project has a Google Maps key — the map view deliberately refuses to draw unkeyed |
| Provider list | Apple Maps, Google Maps, Waze — probed, remembered, and chosen in-app | None. The hand-off is a `geo:` intent carrying the coordinates and label; Android's own intent resolution routes it to the user's default navigation app or offers the system chooser. The button is always the neutral "Open in Maps", the in-app chooser and saved preference do not exist, and a failed launch (no handler at all) explains itself in a dialog |
| Sheet chrome | The system form sheet carries a native header (inline title + close button) | The form sheet has no header bar — Android sheets don't carry app bars, and the system back gesture/button dismisses |
