# Tabs layout

- **Route:** `/(tabs)` — iOS ✅ · Android —

## Purpose

The signed-in section: a bottom tab bar over three stacks. It is also where the
app's "keep the vehicle data fresh" policy is mounted.

## Data

The tab set is data, not markup — `src/navigation/tab-config.ts` owns it so both
platforms build the same bar from the same list:

| Route | Label | Icon (default / selected) |
| --- | --- | --- |
| `status` | Status | `car` / `car.fill` |
| `details` | Specs | `list.bullet.rectangle` / `list.bullet.rectangle.fill` |
| `settings` | Settings | `gearshape` / `gearshape.fill` |

`status` is the initial route. The bar is tinted with the app's system blue and
its minimize-on-scroll behavior is `never` (also from `tab-config.ts`).

Icon names are SF Symbols; an Android tree substitutes its own glyph set but
must keep the same three tabs in the same order with the same labels.

## Structure

A native tab bar with one trigger per entry, each carrying an icon and a label.
Each tab hosts its own stack, so drill-downs push inside the selected tab and
the bar stays put.

## States

None of its own — each tab's stack owns its content.

## Interactions

Selecting a tab switches sections. Nothing else.

## Behavior: automatic refresh scope

`useVehicleAutoRefresh()` is mounted **here and nowhere else**, and this scope is
deliberate:

- The whole signed-in vehicle section stays mounted across tab switches and
  pushed routes, so the policy runs exactly once and covers every screen that
  shows vehicle data — including screens that read the vehicle query directly
  rather than through the shared screen hook (the location sheet is one).
- Hanging it off a screen would leave whichever screens forgot to call it
  uncovered, and would re-run the same policy once per mounted screen.
- It reads the queries directly rather than through the screens' hook, so a
  dev-only Data State override — which rewrites what the *screens* see — cannot
  make the app refresh against a previewed state instead of the real one.

The policy itself (`src/hooks/use-vehicle-auto-refresh.ts` +
`src/data/resume-refresh.ts`): whenever the app returns to the foreground, and
whenever the status query's write timestamp changes (which covers mount,
including the launch where the persisted cache restores a moment *after* the
first render), it evaluates the cached status snapshot's age and picks a rung:

- under 1 minute — do nothing;
- 1–15 minutes — plain refetch (cheap, doesn't touch the car);
- over 15 minutes — prime first (wake the telematics unit so every module
  reports), then refetch.

A fetch already in flight is the refresh this would have started, so it bows
out. At most one automatic refresh runs at a time; a second call joins the
running one. It is deliberately *not* keyed on "is fetching", so a failed
refresh does not retry-storm — the cost is that a failure isn't retried until
the next foreground, which the Status screen's "Couldn't refresh" banner already
explains.

`useIsAutoRefreshing()` exposes whether one is running; only *automatic*
refreshes are announced on screen, because a pull-to-refresh already shows its
own spinner and the re-reads that confirm a lock command are not a refresh of
stale data at all.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Tab bar | Native tabs, non-transparent at scroll edge, never minimizes | — |
