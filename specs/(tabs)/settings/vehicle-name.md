# Vehicle name

## Route & implementations

`/(tabs)/settings/vehicle-name` (`src/app/(tabs)/settings/vehicle-name.tsx` →
`src/screens/vehicle-name-screen.tsx`) · iOS ✅ · Android ✅

## Purpose

Rename the car. The name is account data, not vehicle data: it is stored on the Lexus account and is
what every screen, and the Home Screen widget, calls this car.

## Data

- `useVehicleProfile()` — the current nickname, which seeds the field, and the vehicle context the
  write is addressed with.
- `useRenameVehicle(context)` (`src/hooks/use-rename-vehicle.ts`) — `rename`, plus its in-flight and
  error state. The write is a single PUT (`src/data/vehicle-nickname.ts`) carrying the new name, the
  *customer's* GUID, and the VIN. It is deliberately not optimistic: the screen dismisses the moment
  the write lands, so there is no control to keep responsive, and showing the new name before the
  server took it would be a guess the user could not notice was wrong.
- On success the profile query is invalidated rather than patched, because the name every surface
  renders comes from the discovery record — re-reading it is what makes them all agree.

## Structure

- One card holding a single text field, pre-filled with the current name, focused on arrival,
  word-capitalized, autocorrect off, with a "done" submit key. A clear (✕) control appears at the
  trailing edge while the field has text. Footer: "Your car's name, saved to the Lexus app."
- An error notice below the card when a save has failed.
- A full-width primary "Save" button, reading "Saving…" while the write is in flight.

## States

- **Profile still loading** — a spinner alone. There is nothing to draw a skeleton of: one field,
  whose one value is the thing being waited on.
- **Profile failed to load** — "Vehicle Unavailable" / "Your vehicle couldn't be loaded, so there is
  no name to change." No form.
- **Save disabled** unless the trimmed name is non-empty *and* differs from the current one. An
  empty name is refused before any request is made.
- **Save failed** — the failure is shown above the button and the typed name stays in the field, so
  it can be retried without retyping.

## Interactions

- Submitting from the keyboard does the same thing as tapping Save.
- Clear empties the field and returns focus to it — the point of the gesture is to retype.
- Save trims the name and writes it. On success: a success haptic and a pop back to Settings. On
  failure: an error haptic, and the screen stays put with the message.
- Scrolling dismisses the keyboard.

## Platform notes

| Concern | iOS | Android |
| --- | --- | --- |
| Field seeding | The form mounts only once the current name is known, because the native field captures its initial value on first render. The contract either way is "the field opens pre-filled with the current name" | Same late-mount mechanism, seeding a Compose field's observable state |
| Clear control | Imitates the system text-field clear button, including its tap target | The same 32pt target with a ripple, since Compose fields ship no clear affordance of their own |
| Keyboard | Native scroll view keyboard safe area; scrolling dismisses interactively | The activity's `adjustResize` insets the scroll view; a drag dismisses via `keyboardDismissMode` |
