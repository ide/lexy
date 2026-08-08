# Login flow preview

## Route & implementations

`/(tabs)/settings/login` (`src/app/(tabs)/settings/login.tsx` →
`src/screens/login-preview-screen.tsx`) · iOS ✅ · Android ✅

## Purpose

Walk the entire sign-in flow — every success and every error a user can actually hit — without a
network call, without touching the signed-in session, and without ever completing a real Lexus
login. It runs the *real* sign-in screen and the *real* auth state machine against a mock backend,
so what is being previewed is the shipping flow rather than a copy of it. Reachable only from the
Developer Tools section, so only in development and preview builds.

## Data

- `PREVIEW_SCENARIOS` (`src/auth/preview-lexus-backend.ts`) — the five runs on offer.
- `createPreviewFetch(scenario)` — a request implementation that answers the real authenticate,
  authorize, and token endpoints with canned responses, steering where the flow succeeds or fails.
  It is stateless, threading its step marker through the same field the real backend threads its
  own state through.
- `createPreviewTokenStore()` — an in-memory token store, so nothing reaches the Keychain.
- The screen mounts a second, isolated auth provider wired to those two and renders the production
  sign-in screen inside it. The user's actual session is untouched throughout.

## Structure

- A scenario bar across the top of the screen: a wrench glyph, the label "Preview Scenario", and a
  menu showing the current run. The route has no navigation header, so this bar owns the top of the
  screen and clears the status-bar inset itself.
- Below it, the production sign-in screen, unchanged. Its own behavior — method selection, resend,
  switching methods, error copy — is specified in `specs/sign-in.md`.
- Once the mock sign-in completes, the sign-in screen is replaced by a result panel: a green seal,
  "You're Signed In", an explanation that this ran the real flow against a mock backend and no real
  sign-in happened, and a "Run Again" button.

The scenarios:

| Scenario | What it does |
| --- | --- |
| Success · Email or SMS | Two verification methods offered — the full happy path |
| Success · Single Method | One method only; the flow skips the picker and goes straight to the code |
| Error · Wrong Password | The credentials are rejected: "The email or password you entered is incorrect." |
| Error · Invalid Code | The verification code is rejected: "That verification code is incorrect or has expired." |
| Error · Network Failure | Requests never reach the server, so the failure surfaces exactly where a real outage would |

## States

- No preview session: the sign-in flow. Preview session established: the success panel.
- Switching scenarios and "Run Again" both remount the isolated provider, so every run starts from a
  clean store and a fresh mock backend.

## Interactions

- Picking a scenario from the menu applies it and restarts the run.
- "Run Again" restarts the current scenario.
- Everything inside the sign-in screen behaves exactly as it does in production.
- Leaving is the stack's back gesture; there is no back button, because there is no header.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Getting back to Settings | Edge-swipe back only — the route hides the header so the preview matches the real sign-in screen exactly | The system back button covers this, so the headerless treatment carries over |
| Scenario picker | A native menu anchored to the bar | A Material dialog listing the runs, the current one accented — the same presentation the app's other Android choosers use |
| Scenario bar | SwiftUI, hosted with the rest of the screen | React Native chrome: a `Host` sized to the bar reports no height above the sign-in screen's own full-screen host, so the bar would not paint. The picker it opens is still Compose, hosted zero-height beside it |
