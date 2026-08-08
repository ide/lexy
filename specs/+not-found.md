# Unmatched route

- **Route:** any unmatched path — iOS ✅ · Android —

## Purpose

Recover from a stray deep link or a stale path by redirecting to `/`, which
re-runs the auth redirect. The built-in "Unmatched Route" screen is deliberately
avoided: its sitemap link can crash release builds.

## Structure

Identical in shape to `specs/index.md`: an interactive marker (closing out this
route's navigation time-to-interactive) followed by a redirect to `/`. The
marker must precede the redirect so it fires while the route is still focused.

## Platform notes

None.
