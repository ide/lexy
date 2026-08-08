# Settings

## Route & implementations

`/(tabs)/settings` (`src/app/(tabs)/settings/index.tsx` → `src/screens/settings-screen.tsx`) ·
iOS ✅ · Android ✅

## Purpose

The settings root: where the user picks which navigation app the vehicle location hands off to,
renames the car, ends the session, and reads what build they are running. In development and
internal preview builds it also carries the entry points to the developer tools.

## Data

- `SHOW_DEV_TOOLS` (`src/constants/build-channel.ts`) — true in local development and in builds on
  the "preview" update channel, false in production. Gates the entire Developer Tools section.
- `useMapsProvider()` — the resolved and saved navigation app, plus the chooser to present.
  `describeMapsProviderChoice()` turns those into the row's subtitle.
- `useVehicleProfile()` — the vehicle's nickname for the Name row.
- `describeAppVersion()` (`src/updates/app-version.ts`) — fed the marketing version, the binary's
  build number, and the running update's identity. It produces one line naming both the installed
  binary and the JavaScript it is running, e.g. "1.0.0 (24) (0226b150)", with "embedded" in place of
  an update id when the built-in bundle is running and "development" when the build has no update
  runtime at all. It also produces the emergency-launch sentence below.
- `useAuth().signOut`.

## Structure

1. **DEVELOPER TOOLS** — present only when `SHOW_DEV_TOOLS`. Four rows, each pushing a screen:
   - Updates — "Expo Updates status, controls, and activity log."
   - Data State — "Force loading, offline, error, and empty states."
   - Login Flow — "Walk the sign-in screens without signing out."
   - Expo Application Services — "Open this project's EAS dashboard."
2. **MAPS** (iOS only — see Platform notes) — a single "Maps App" row whose subtitle is the current choice: the saved app's name,
   the sole installed app's name when there is nothing saved, "Not set" while more than one is
   installed and none chosen, or "Unavailable" when no supported maps app is installed. The resolved
   provider sits under the title rather than in a trailing column, so long app names and large text
   sizes have the full width. Footer: "The app used to open your vehicle's location for directions."
3. **VEHICLE** — a "Name" row whose subtitle is the vehicle's nickname; it pushes the rename screen.
   The name lives here rather than on the specs screen because it is the one identity field that is
   editable, and editing it writes to the Lexus account, not to the car.
4. **LEXUS ACCOUNT** — a full-width, destructive "Sign Out".
5. **ABOUT** — a "Version" row carrying the combined version string, selectable so a long press
   offers Copy. When the app fell back to its built-in bundle because an update failed to launch, a
   warning line follows the card: "Lexy couldn't run its latest update and is using the version
   built into this app." Nothing else on screen would reveal that — the app looks entirely normal
   running older code than it downloaded.

## States

- **Production build** — no Developer Tools section at all.
- **Vehicle name not yet known** (profile loading, or no vehicle on the account) — the Name row
  shows "…" and does not respond, since the rename screen needs the current name as its starting
  value.
- **No supported maps app installed** — the Maps row reads "Unavailable" and tapping it explains
  what to install instead of offering a chooser.
- **Sign-out failure** — clearing the stored session is best-effort; on failure nothing changes, the
  user stays signed in, and the row can be tapped again.

## Interactions

- **Maps App** — presents the chooser when several supported apps are installed, saving the pick;
  presents an explanatory alert when none are. The chooser is attached to the row that was tapped
  rather than fired from a call.
- **Name** — pushes `/settings/vehicle-name`.
- **Sign Out** — clears the stored session and the query cache; the root layout's auth guard then
  swaps to the sign-in screen. There is no confirmation prompt.
- **Version** — selectable for copy; it is what a bug report needs to quote.
- **Developer Tools rows** — push `/settings/updates`, `/settings/data-state`, `/settings/login`,
  and `/settings/eas` respectively.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Maps section | The full row: probe, remembered choice, anchored SwiftUI chooser | Absent. Android's maps hand-off is a `geo:` intent resolved by the system (see the map screen's Platform notes), so there is no in-app preference to set |
| Build number source | Read from the binary's own Info.plist rather than the update manifest, so an update cannot make the row describe a build the phone doesn't have | `Constants.platform.android.versionCode` — the installed package's own build config, giving the same guarantee |
| Row icons | SF Symbols with a per-row tint | The same semantic registry names drawn as Material glyphs with the same tints |
| Row pressed state | SwiftUI's own highlight | Compose's own ripple (`clickable` indication), not JS opacity |
| Version copy | The value is selectable; a long press offers Copy | Not yet — Compose text spans aren't selectable through expo/ui today, so the row is read-only until a selection container or clipboard affordance exists |
