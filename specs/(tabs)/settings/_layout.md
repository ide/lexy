# Settings stack

## Route & implementations

`/(tabs)/settings` — the Settings tab's navigation stack (`src/app/(tabs)/settings/_layout.tsx`) ·
iOS ✅ · Android —

## Purpose

The Settings tab's navigation stack: the settings root plus the five screens it pushes. It carries
each screen's title and the one deliberate exception to the shared presentation (the headerless
login preview).

## Structure

- Shared tab-stack presentation, applied to every screen in the stack
  (`src/navigation/tab-stack-options.ts`, prebuilt in `tab-stack-options-preset.ts`, identical to
  the Details and Status stacks): a large screen title that collapses to an inline title as the
  content scrolls, a transparent header with no shadow or separator line, title text in the primary
  label color, and screen content drawn on the grouped background.
- Screens and their titles:
  - `index` — "Settings".
  - `updates` — "Updates".
  - `eas` — "EAS". The full "Expo Application Services" is the settings row's job; a title that
    long shrinks itself to fit rather than reading well.
  - `data-state` — "Data State".
  - `vehicle-name` — "Vehicle Name". The screen's own heading carries the label the field no longer
    repeats above itself, so the title names the thing in full.
  - `login` — no header at all, so the preview is identical to the real, headerless sign-in screen.
- Every pushed screen shows only the back chevron, without the "Settings" back title, which is too
  long to sit beside a title.

## Interactions

Standard stack push and pop. The login preview, having no header, offers no back button — see its
own spec.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Back affordance on pushed screens | Chevron only, no back title | — |
| Leaving the headerless login preview | Edge-swipe back is the only way out | — Android's system back covers this |
| Large title that collapses on scroll | Yes, from the shared options | — |
