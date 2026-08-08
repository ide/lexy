# Details stack

## Route & implementations

`/(tabs)/details` — the Details tab's navigation stack (`src/app/(tabs)/details/_layout.tsx`) ·
iOS ✅ · Android —

## Purpose

Gives the Details tab its own navigation stack, so the tab keeps its own history, and applies the
presentation every tab stack in the app shares. It holds one screen today.

## Structure

- Shared tab-stack presentation, applied to every screen in the stack
  (`src/navigation/tab-stack-options.ts`, prebuilt with the app palette in
  `tab-stack-options-preset.ts`, and used identically by the Settings and Status stacks):
  a large screen title that collapses to an inline title as the content scrolls, a transparent
  header with no shadow or separator line, title text in the primary label color, and screen
  content drawn on the grouped background.
- `index` — title "Specs".

## Interactions

Standard stack navigation only. With a single screen there is nothing to push or pop.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Large title that collapses on scroll | Yes, from the shared options | — |
