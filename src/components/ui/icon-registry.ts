import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

/**
 * The app's icon vocabulary, named for what an icon *means* rather than what
 * either platform calls its glyph. Screens and the shared data modules speak
 * these names; `Icon` resolves one to SF Symbols on iOS and to Material Design
 * Icons on Android, so a platform-neutral tree never has to know which is which.
 *
 * This is deliberately not the whole SF Symbols catalog: an entry exists because
 * something in the app draws it, and adding one means choosing a Material
 * counterpart at the same time. SwiftUI trees (`src/components/swift-ui`, the
 * screens' `Image systemName=` props) are iOS-only by construction and keep
 * naming SF symbols directly — they have no Android form to be neutral about.
 */

/** Every glyph name the bundled MaterialCommunityIcons font ships. */
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export const iconRegistry = {
  // Chrome — the glyphs that belong to the interface rather than the car.
  close: { sf: "xmark", material: "close" },
  "chevron-right": { sf: "chevron.right", material: "chevron-right" },
  history: { sf: "clock.arrow.circlepath", material: "history" },

  // Verdicts. `warning` and `check-circle` are the fallbacks a closure reaches
  // for when it has no identity glyph of its own, so they carry no car in them.
  warning: { sf: "exclamationmark.triangle.fill", material: "alert" },
  "check-circle": { sf: "checkmark.circle.fill", material: "check-circle" },
  "shield-check": { sf: "checkmark.shield.fill", material: "shield-check" },
  "wifi-off": { sf: "wifi.slash", material: "wifi-off" },

  // Lock state, the app's loudest reading: filled on both platforms so the
  // padlock reads at 13pt inside a control chip.
  lock: { sf: "lock.fill", material: "lock" },
  // `lock-open-variant` is the shackle-up padlock, which mirrors `lock` the way
  // `lock.open.fill` mirrors `lock.fill`; plain `lock-open` tilts its shackle
  // and reads as a different object beside the closed one.
  "lock-open": { sf: "lock.open.fill", material: "lock-open-variant" },

  // Sign-in and verification. The two delivery channels appear twice each: the
  // hero draws the filled weight at 44pt, the choice buttons the outline at
  // 17pt, which is the same weight pairing Apple and Material both ship.
  key: { sf: "key.fill", material: "key" },
  "shield-lock": { sf: "lock.shield.fill", material: "shield-lock" },
  // The fallback channel — a method the copy could not classify as mail or
  // message. Half-filled on both platforms so it reads as "some other factor"
  // rather than as a verdict about safety.
  "shield-half": { sf: "shield.lefthalf.filled", material: "shield-half-full" },
  mail: { sf: "envelope", material: "email-outline" },
  "mail-filled": { sf: "envelope.fill", material: "email" },
  message: { sf: "message", material: "message-outline" },
  "message-filled": { sf: "message.fill", material: "message" },
  // The code itself, when nothing says which channel carried it. Both
  // platforms draw the number sign.
  "one-time-code": { sf: "number", material: "pound" },

  // Settings rows: the developer tools, account actions, and the dev
  // data-state options.
  updates: { sf: "square.stack.3d.up.fill", material: "layers-triple" },
  database: { sf: "cylinder.split.1x2.fill", material: "database" },
  "person-key": { sf: "person.badge.key.fill", material: "account-key" },
  cloud: { sf: "cloud.fill", material: "cloud" },
  car: { sf: "car.fill", material: "car" },
  "car-multiple": { sf: "car.2", material: "car-multiple" },
  "sign-out": { sf: "rectangle.portrait.and.arrow.right", material: "logout" },
  "close-circle": { sf: "xmark.circle.fill", material: "close-circle" },
  check: { sf: "checkmark", material: "check" },
  home: { sf: "house.fill", material: "home" },
  observe: { sf: "waveform.path.ecg", material: "pulse" },
  builds: { sf: "hammer.fill", material: "hammer" },
  "updates-sync": {
    sf: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    material: "sync-circle",
  },
  "external-link": { sf: "arrow.up.forward", material: "open-in-new" },

  // Update diagnostics: the status headline, and the controls beneath it.
  refresh: { sf: "arrow.clockwise", material: "refresh" },
  "download-circle": { sf: "arrow.down.circle.fill", material: "download-circle" },
  download: { sf: "arrow.down.circle", material: "download" },
  restart: { sf: "arrow.clockwise.circle", material: "restart" },
  search: { sf: "magnifyingglass", material: "magnify" },
  sparkles: { sf: "sparkles", material: "auto-fix" },
  hourglass: { sf: "hourglass", material: "timer-sand" },

  // The sign-in preview scenarios, and the bar that switches between them.
  "seal-check": { sf: "checkmark.seal.fill", material: "check-decagram" },
  "seal-check-outline": { sf: "checkmark.seal", material: "check-decagram-outline" },
  "octagon-x": { sf: "xmark.octagon.fill", material: "close-octagon" },
  "octagon-x-outline": { sf: "xmark.octagon", material: "close-octagon-outline" },
  wrench: { sf: "wrench.and.screwdriver.fill", material: "wrench" },
  live: { sf: "antenna.radiowaves.left.and.right", material: "access-point" },
  skeleton: { sf: "rectangle.dashed", material: "selection-ellipse" },
  "wifi-alert": { sf: "wifi.exclamationmark", material: "wifi-alert" },
  "alert-octagon": { sf: "exclamationmark.octagon.fill", material: "alert-octagon" },

  // Remote capabilities and controls.
  power: { sf: "power", material: "power" },
  climate: { sf: "thermometer.medium", material: "thermometer" },
  // The extra controls behind the More controls disclosure. Each is one
  // semantic name for a control that swaps direction (hazards) or fires once
  // (headlights, buzzer, horn) — the button's label and tint say which way it
  // goes, so the glyph identifies the system rather than its state.
  hazards: { sf: "car.rear.hazardsign.fill", material: "hazard-lights" },
  // The dipped beam on both platforms: this is a find-my-car flash, not a
  // high-beam, and Material's `car-light-high` reads as the latter.
  headlights: { sf: "headlight.low.beam.fill", material: "car-light-dimmed" },
  buzzer: { sf: "bell.and.waves.left.and.right.fill", material: "bell-ring" },
  horn: { sf: "horn.blast.fill", material: "bullhorn" },
  // The badge on the More controls row — a set of knobs, meaning "the rest of
  // what this car will take", rather than any one of the controls inside.
  controls: { sf: "slider.horizontal.3", material: "tune-variant" },
  "defrost-front": { sf: "windshield.front.and.heat.waves", material: "car-defrost-front" },
  "defrost-rear": { sf: "windshield.rear.and.heat.waves", material: "car-defrost-rear" },
  location: { sf: "location.fill", material: "crosshairs-gps" },
  map: { sf: "map.fill", material: "map" },

  // Instruments.
  fuel: { sf: "fuelpump.fill", material: "gas-station" },
  charge: { sf: "bolt.fill", material: "lightning-bolt" },
  // The needle gauge, for the odometer heading. Material's `gauge` is a dial
  // with no needle and reads as a blank circle at 17pt; `speedometer` is the
  // instrument this labels anyway.
  odometer: { sf: "gauge.with.dots.needle.67percent", material: "speedometer" },

  // Closures. Each names the panel it identifies, since open/closed is carried
  // by the color and the wording beside it rather than by a second glyph.
  // Material has no left/right car-window pair — `car-door` is the nearest
  // "side opening of a car", so both sides draw the same glyph there and the
  // column heading is what distinguishes them.
  "car-window-left": { sf: "car.window.left", material: "car-door" },
  "car-window-right": { sf: "car.window.right", material: "car-door" },
  moonroof: { sf: "moon.fill", material: "moon-waning-crescent" },
  trunk: { sf: "car.side.rear.crop.trunk.partition.fill", material: "car-back" },
  hood: { sf: "engine.combustion.fill", material: "engine" },
} as const satisfies Record<string, { sf: SFSymbol; material: MaterialIconName }>;

/** The semantic names `Icon` accepts — every key of the registry above. */
export type IconName = keyof typeof iconRegistry;
