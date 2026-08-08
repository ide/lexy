# Vehicle specs

## Route & implementations

`/(tabs)/details` (`src/app/(tabs)/details/index.tsx` → `src/screens/details-screen.tsx`) ·
iOS ✅ · Android —

## Purpose

The car's spec sheet: who the vehicle is, which remote actions it will accept, and which connected
services are on the account. Everything here changes on the timescale of ownership rather than
minutes, so unlike Status this screen is read-only — there is nothing to command and nothing to
pull-refresh.

## Data

- `useVehicleScreen()` (`src/hooks/use-vehicle-screen.tsx`) — the scaffolding shared with the Status
  screen: the vehicle (real or placeholder), the redaction reason, the status banner, the
  full-screen error, and the dev-build skeleton toggle. Both screens derive loading, offline, and
  error states from this one place, so they cannot disagree about them.
- `useIsAutoRefreshing()` (`src/hooks/use-vehicle-auto-refresh.ts`) — whether the tab layout's
  refresh policy is currently re-reading vehicle data.
- The identity and spec fields, the capability list, and the subscription list all come from the
  vehicle *profile* half of the vehicle query (`src/data/vehicle.ts`), which loads and refreshes
  separately from — and far less often than — the live status.
- Subscriptions reach the screen already flattened to `{ name, status, active, trial, expires }` by
  `summarizeSubscriptions` (`src/data/subscriptions.ts`), which collapses the paid, trial, and
  complimentary buckets of the Lexus vehicle-subscriptions read into one list. `active` is true only
  when the server reports the status ACTIVE; `expires` is a formatted "Month YYYY" and is absent for
  a service with no end date.

## Structure

1. **Status banner** — the shared offline / couldn't-refresh banner, when either applies.
2. **VEHICLE** — one card of label/value rows, in order: VIN, Model Code, Exterior, Trim, Region,
   Telematics, Head Unit, Fuel Type, Transmission, Drivetrain, Built, In Service. Values are
   selectable and set in tabular figures so they line up.
3. **REMOTE CAPABILITIES** — one icon-and-label cell per capability the vehicle reports, laid out
   two to a row. Display only: this section says what the car can do, it does not do it.
4. **CONNECTED SERVICES** — rendered only when the subscription list is non-empty. One row per
   service: the name, and beneath it "Trial expires <date>" for a trial with an end date, "Expires
   <date>" for a paid or complimentary service with one, plain "Trial" for a trial without one, and
   nothing at all otherwise. The status word sits at the trailing edge, green when the service is
   active and muted otherwise — never red, since an ended service is not an error. The card's last
   row is a centered link, "Manage your subscriptions in the Lexus app".
5. **Refreshing note** — "Refreshing…" with a spinner, floating over the content (displacing
   nothing) while an unprompted refresh runs, and fading out when it lands.

## States

- **First load** — the real content tree renders placeholder data drawn as neutral bars, so the
  skeleton is the actual layout and nothing moves when data arrives. It pulses while a fetch is in
  flight, and holds still when the app is offline with nothing cached, where nothing is on its way.
- **Offline with cached data** — "You're offline / Showing the latest data we saved." above the real
  content.
- **Offline with nothing cached** — the same banner, worded "Reconnect to see your vehicle.", above
  a still-redacted tree; the data can still arrive on its own once the network returns.
- **Refresh failed with cached data** — a "Couldn't refresh" banner naming the failure in plain
  words, above the last data saved.
- **Load failed with nothing cached** — a full-screen error with a Retry that re-reads both halves
  of the vehicle query. An account with no vehicle enrolled gets its own empty state rather than the
  generic error. The header keeps the "Specs" title in both cases.
- **No subscriptions** — the Connected Services section is omitted entirely rather than shown empty.
- There is no pull-to-refresh here; the floating note is the only sign that data is being re-read.

## Interactions

- "Manage your subscriptions in the Lexus app" hands off to the Lexus app's shop tab, or to the
  app's store listing when it isn't installed (`src/data/lexus-app.ts` opens a universal link on the
  Lexus associated domain, which redirects to the store when the app is absent; a direct store URL
  is the fallback if that link can't be opened at all). Fires a light impact haptic.
- Spec values and service names can be long-pressed to copy.
- Dev and internal preview builds only: a header-right control that pins the loading skeleton on
  screen, for inspecting that exact state.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Capability icons | The vehicle data carries SF Symbol names (`Capability.symbol`) | — needs a symbol-to-platform-icon mapping, since the names come from shared data |
| Redacted skeleton | A React Native analog of SwiftUI's `.redacted(reason:)`, because this tree lives on the RN side of a host view | — |
| Lexus app handoff | Universal link, falling back to the iOS App Store listing | — needs the Play Store equivalent |
