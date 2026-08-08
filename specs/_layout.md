# Root layout

- **Route:** `/` (root stack) — iOS ✅ · Android —

## Purpose

The app's outermost shell. It installs the providers every screen depends on,
configures performance instrumentation, and hosts the auth boundary: a stack
that shows the signed-in tab section or the sign-in screen, never both.

## Data

- `useAuth().session` from the auth provider — the only value the boundary
  reads. The session is loaded **synchronously** from secure storage during the
  first render, and the persisted query cache is hydrated at module scope before
  React renders, so the first tree the app builds already knows who is signed in
  and already contains the cached vehicle. There is no loading state, no hold,
  and no second render to correct the first.

## Structure

Providers, outermost first:

1. Gesture root — paints the app's grouped background, so the window matches the
   splash screen's background color and no white frame shows through between the
   splash and the first content paint.
2. Auth provider — session, sign-in flow, `runAuthorized`.
3. Vehicle data provider — the query client (hydrated from the persisted cache).
4. Theme provider — follows the system light/dark setting.
5. Two headless recorders that run for the app's lifetime: an update-history
   recorder and an emergency-launch reporter.
6. Debug-override provider — supplies the Data State override used by dev and
   preview builds; a no-op in production.
7. The root navigator.

The root navigator is a stack of three screens, all with their own headers
hidden (each section draws its own chrome):

- `index` — the entry redirect.
- `(tabs)` — rendered only while a session exists.
- `sign-in` — rendered only while there is no session.

The two are mutually exclusive guards on the same stack, so signing in or out
swaps which screen exists rather than pushing a route.

Stack-wide screen options: transparent header with no shadow, minimal back
button, blue tint on header controls, and the grouped background behind content.

## States

Signed in and signed out are the only two, and both are known on the first
frame. A stored session whose token turns out to be dead is discovered behind
the screen: the session manager refreshes in the background, and if the refresh
token is rejected it clears the session and the cached vehicle data, which drops
the user back to sign-in with an explanatory message already set.

## Interactions

None of its own.

## Platform notes

- **No transition animation on the root stack.** The root stack only ever
  switches between auth-boundary screens (`index` → tabs, sign-in ↔ tabs). Those
  should appear in place rather than slide in, so a logged-in launch looks like
  the car screen "just being there". Drill-down animation belongs to the nested
  tab stacks, which keep their defaults. Any platform implementing this layout
  should suppress the root-level transition the same way.
- Observe (performance instrumentation) is configured once at module load with
  the router integration enabled. Debug builds do not dispatch unless
  `EXPO_PUBLIC_OBSERVE_DEV=1` is set when starting the bundler; release builds
  ignore that flag.

| Concern | iOS | Android |
| --- | --- | --- |
| Root background paint | Gesture root painted with the grouped background to match the splash | — |
