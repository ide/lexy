# Update diagnostics

## Route & implementations

`/(tabs)/settings/updates` (`src/app/(tabs)/settings/updates.tsx` →
`src/screens/update-diagnostics-screen.tsx` and `src/screens/update-diagnostics/*`) ·
iOS ✅ · Android ✅

## Purpose

Everything the app knows about its own over-the-air updates, in one screen: what JavaScript is
running, what is downloaded, what the server is offering, the controls to check, download, and
reload, and two logs of what has actually happened on this device. Reachable only from the Developer
Tools section, so only in development and preview builds.

## Data

- The live update state and the update module's own constants — whether updates are enabled, the
  channel, the runtime version, the automatic-check policy, and the in-flight checking, downloading,
  and restarting flags.
- `describeUpdateStatus()` (`src/updates/update-utils.ts`) — the headline card's icon, title, and
  detail, plus a semantic tone (good, busy, or attention) that the screen maps to green, blue, and
  orange. The module stays theme-free so the mapping is the screen's business.
- `resolveLastCheck()` — the time of the most recent check, or, when there hasn't been one this
  launch, a phrase derived from the automatic-check policy ("At startup", "On error recovery", "Not
  checked yet").
- `buildUpdateEntries()` — the up-to-three updates Expo can name: the running one, the downloaded
  one when it differs, and the available one when it differs from both.
- `useUpdateActions()` (`src/updates/use-update-actions.ts`) — check, download, and reload, with
  their in-flight action, result message, and error.
- `useUpdateEvents()` (`src/updates/use-update-events.ts`) — the two lists: the activity Lexy
  records itself (persisted in a key-value store, `src/updates/update-history.ts`) and the native
  update log for the last 24 hours. Both are sorted newest-first and capped at the 20 most recent.
- `describeNativeLog()` — turns a raw native log line into a readable title and a one-sentence
  summary, recognizing state changes, resets, module initialization, and "no update available".
- Activity is recorded app-wide by a root-mounted recorder, not by this screen: which update
  launched and whether it was the embedded one, an update found, an update downloaded, and check or
  download failures. This screen only reads and adds to that record.

## Structure

1. **Status card** — an icon in a tinted tile, a headline, and a sentence of detail. A linear
   progress bar appears beneath it only while a download is running. The headline is chosen in this
   order: updates disabled → reloading → downloading (the title carries the percentage) → checking →
   update ready → update available → running normally.
2. **UPDATE SYSTEM** — label/value rows, values selectable: Enabled, Channel, Runtime, App version,
   Automatic checks, Launch time (in ms), Reloads this launch, Most recent check. The value is the
   thing someone came to read, so it carries the emphasis and the label is the muted half.
3. **KNOWN UPDATES** — one card per entry from `buildUpdateEntries`, each with a badge and accent
   (CURRENT/green, READY NEXT/blue, AVAILABLE/orange), a title and explanatory line, then Published
   (its creation date), Source ("Embedded in build", "EAS Update", or "Rollback to embedded"), and
   the full update ID, selectable. The footer says why this is the whole list: older downloaded
   updates are managed internally and are not enumerable from app code.
4. **CONTROLS** — three full-width buttons, each swapping its icon for a busy indicator and adding
   an ellipsis to its label while it runs:
   - "Check Now" (primary)
   - "Download Update" — additionally disabled unless an update is available
   - "Reload App", or "Reload Into Update" when one is pending
5. **Result card** — always present, holding at least two lines so a result appearing under the
   controls never shifts the layout. The last action's message in green, an error in orange, or the
   placeholder "Results from the controls above will appear here." Selectable.
6. **UPDATE ACTIVITY** — a header with its own Refresh button, then the recorded events newest
   first: title, wall-clock time to the second, detail, and the short update id where the event has
   one. An event recorded as an error shows its title in orange. Footer notes the 20 most recent are
   shown.
7. **NATIVE UPDATE LOG** — each native entry collapsed to a severity dot, the summarized title, the
   level when it is a warning or worse, the time, and the one-sentence summary. Expanding a row
   reveals the level and code, the raw message, the update and asset ids, and any stack trace — all
   selectable. Footer notes these are from the last 24 hours and that a tap inspects the raw entry.

## States

- **Updates disabled** (a development build, typically) — the status card says so and all three
  controls are disabled.
- **No activity recorded yet** — "Activity tracking starts with this version. The current launch
  will appear here after Refresh."
- **No native entries in the window** — "No native Expo Updates entries were recorded in the last 24
  hours."
- **Any action in flight** — all three controls are disabled until it settles, so they cannot stack.
- Errors reported by the update system itself (a failed check, a failed download) surface in the
  result card alongside errors from the actions, and are recorded to the activity list by the
  root-mounted recorder.
- An emergency launch — an update that failed to start, leaving the app on its embedded bundle — is
  reported once per distinct failure to telemetry from the root (`src/updates/emergency-launch.ts`),
  and is said in words to the user on the Settings root, not here.

## Interactions

- **Pull to refresh** asks the server for a newer update as well as reloading both lists, and the
  spinner stays up until that check resolves. It shares one exclusive gate with the Refresh button,
  so a pull and a tap cannot run at once.
- **Check Now** reports one of: "A newer update is available to download.", "A rollback to the
  embedded update is available.", or "You are already running the latest compatible update." A
  successful check that finds nothing changes no update state, so the recorder would never see it —
  the screen records it explicitly, with the raw reason code, so the log shows that a check ran and
  came back empty. The result card itself keeps to plain language.
- **Download Update** reports "Update downloaded. Reload now or launch it next time.", the rollback
  equivalent, or "No new update was downloaded."
- **Reload** first records a "Reload requested" event, naming whether it is switching to the
  downloaded update or restarting the current one, then restarts the app. A failure to restart
  leaves the message in the result card.
- Every action refreshes both lists when it settles, and the previous result stays visible while the
  next action runs. Success gives a selection haptic, failure a soft impact.
- **Refresh** re-reads both lists with a selection haptic. A refresh that changes nothing leaves the
  lists untouched rather than re-rendering them.
- Tapping a native log row expands or collapses it.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Native log contents | Whatever the platform's update runtime logs; the summarizer recognizes the current message shapes and falls back to the raw code and message for anything else | The same summarizer, unextended so far — no native entries have been observed on Android yet to disagree with it |
| Expanding a native log row | A `DisclosureGroup` | Compose has no disclosure primitive, so the row is a clickable column that swaps in the raw detail; the reveal is the same |
| Pull-to-refresh indicator | SwiftUI's `refreshable` awaits the closure and owns the spinner | Compose's `PullToRefreshBox` is told when to spin, so the screen holds the flag and clears it when the check settles |
| Selectable values | Runtime, update ids, and the result message are selectable for a bug report | Not yet — Compose text isn't selectable through expo/ui (the same gap as the settings Version row) |
