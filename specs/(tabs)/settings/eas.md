# EAS dashboard links

## Route & implementations

`/(tabs)/settings/eas` (`src/app/(tabs)/settings/eas.tsx` → `src/screens/eas-screen.tsx`) ·
iOS ✅ · Android ✅

## Purpose

Shortcuts from the app in your hand to this project's pages on the EAS dashboard, for whoever is
carrying an internal build and wants the builds, updates, or metrics behind it. Reachable only from
the Developer Tools section, so only in development and preview builds.

## Data

The project's identity, read from the app config the bundle was built with: the owner account, the
slug, and the EAS project id (the linked project in an EAS build, falling back to the copy
`app.json` carries locally). `easProjectUrl()` (`src/data/eas-dashboard.ts`) turns that into
`https://expo.dev/accounts/<owner>/projects/<slug>[/<page>]` — the readable form the CLI prints —
or, when there is no owner/slug pair, the `/projects/<id>` redirect, which survives a rename. It
returns null when the config carries neither, meaning an unlinked project with no dashboard to open.

## Structure

One DASHBOARD section, four rows, each marked with an external-link glyph rather than a push
chevron because they leave the app:

- Project Home — "The project overview and its recent activity." (the project's home page)
- Observe — "Launch, render, and navigation metrics from real devices."
- Builds — "Native builds, their logs, and install links."
- Updates — "Published update groups per channel and branch."

The footer names the account and project the links point at and warns that you must be signed in on
the dashboard to see anything.

## States

- **Unlinked build** — all four rows are disabled and the footer reads "This build isn't linked to
  an EAS project, so there is no dashboard to open."

## Interactions

- Tapping a row opens its URL in the system browser, with a selection haptic. The system browser is
  the deliberate target rather than an in-app one: the session that makes these pages worth opening
  lives in the user's browser cookies.
- If the open fails there is nothing to recover — the row stays put and can be tapped again.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Footer wording | Names Safari by name ("Opens expo.dev in Safari for …") | "Opens expo.dev in your browser for …" — Android's default browser varies, so the copy doesn't name one |
