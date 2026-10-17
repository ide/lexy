# Status stack

- **Route:** `/(tabs)/status` — iOS ✅ · Android —

## Purpose

The Status tab's stack: the dashboard, plus the vehicle-location map presented
over it as a sheet.

## Structure

- `index` — the dashboard. Title "Status" as a stack default; the screen itself
  overrides the title with the vehicle's nickname once it renders.
- `map` — the vehicle-location map, presented as a **draggable bottom sheet**
  over the dashboard rather than pushed. The React Native build offers half and
  full-height detents and opens full height; the Exact build uses a full-height
  detent. Both have rounded top corners and no grabber. It uses the native
  stack header (inline title "Last Parked", plus a close control) rather than a
  hand-rolled one, so the title sizing and position match the system sheet
  chrome.

The stack is anchored to `index`, so the sheet always keeps the Status screen
behind it — including when `/status/map` is deep-linked directly.

Shared stack options come from `src/navigation/tab-stack-options.ts`, which
every tab stack uses identically: large titles enabled, transparent header with
no shadow (large-title shadow included), transparent large-title background, the
label color for both title styles, and the grouped background behind content.
The map screen opts out of the large title and of header transparency, using an
opaque grouped-background header instead.

## Interactions

The sheet's close control dismisses it (goes back). It is a bare "close" glyph
in the label color — the standard "close a presented screen" bar button, with no
circle or background behind it — and it carries an accessible "Close" label.
The presenting Status screen and its tab bar keep their position throughout
the sheet's presentation and dismissal.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Map presentation | Form sheet opening full height; React Native also allows a half-height detent | — |
| Header | Large title, transparent, no shadow | — |
