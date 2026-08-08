# Entry redirect

- **Route:** `/` — iOS ✅ · Android —

## Purpose

Resolve the app's entry path to a real screen. Without it the router shows its
built-in "Unmatched Route" screen on launch. It renders nothing of its own.

## Data

`useAuth().session`, read synchronously — this route always mounts with the
answer already in hand, so there is no loading guard.

## Structure

Two things, in this order:

1. An interactive marker that closes out this route's navigation
   time-to-interactive. A redirect is as interactive as `/` ever gets, and
   without the marker the launch records a time-to-render but never a
   time-to-interactive. **It must come before the redirect** — sibling effects
   run in tree order and the marker only records while the route is still
   focused, so it has to fire before the redirect steals focus.
2. A redirect to `/(tabs)/status` when there is a session, `/sign-in` when there
   is not.

## States

None. The header is hidden so the route name never flashes in the bar on
launch.

## Interactions

None.

## Platform notes

The redirect target renders in place rather than sliding in, because the root
stack disables its animation (see `specs/_layout.md`).
