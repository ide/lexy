import type { IconName } from "@/components/ui/icon-registry";

/**
 * Material Symbols as Android vector drawables, for glyphs drawn *inside*
 * Compose trees — Compose's `Icon` takes an XML drawable, not the icon font
 * the RN-side `Icon` component uses. Keyed by the same semantic registry
 * names; the file in assets/icons is named after the key, and Metro serves
 * XML assets straight to Compose (see @expo/ui's MaterialSymbolsAssetsTransformer).
 *
 * Deliberately partial: an entry is added when a Compose tree first draws the
 * glyph. `DrawableIconName` narrows consumers to what actually exists, so a
 * missing drawable is a type error rather than an empty slot at runtime.
 */
export const iconDrawables = {
  updates: require("../../../assets/icons/updates.xml"),
  database: require("../../../assets/icons/database.xml"),
  "person-key": require("../../../assets/icons/person-key.xml"),
  cloud: require("../../../assets/icons/cloud.xml"),
  car: require("../../../assets/icons/car.xml"),
  "sign-out": require("../../../assets/icons/sign-out.xml"),
  "chevron-right": require("../../../assets/icons/chevron-right.xml"),
  warning: require("../../../assets/icons/warning.xml"),
  "close-circle": require("../../../assets/icons/close-circle.xml"),
  check: require("../../../assets/icons/check.xml"),
  live: require("../../../assets/icons/live.xml"),
  skeleton: require("../../../assets/icons/skeleton.xml"),
  "wifi-off": require("../../../assets/icons/wifi-off.xml"),
  "wifi-alert": require("../../../assets/icons/wifi-alert.xml"),
  "alert-octagon": require("../../../assets/icons/alert-octagon.xml"),
  "car-multiple": require("../../../assets/icons/car-multiple.xml"),
  home: require("../../../assets/icons/home.xml"),
  observe: require("../../../assets/icons/observe.xml"),
  builds: require("../../../assets/icons/builds.xml"),
  "updates-sync": require("../../../assets/icons/updates-sync.xml"),
  "external-link": require("../../../assets/icons/external-link.xml"),
  refresh: require("../../../assets/icons/refresh.xml"),
  "download-circle": require("../../../assets/icons/download-circle.xml"),
  download: require("../../../assets/icons/download.xml"),
  restart: require("../../../assets/icons/restart.xml"),
  search: require("../../../assets/icons/search.xml"),
  sparkles: require("../../../assets/icons/sparkles.xml"),
  hourglass: require("../../../assets/icons/hourglass.xml"),
  "check-circle": require("../../../assets/icons/check-circle.xml"),
  "seal-check": require("../../../assets/icons/seal-check.xml"),
  "seal-check-outline": require("../../../assets/icons/seal-check-outline.xml"),
  "octagon-x": require("../../../assets/icons/octagon-x.xml"),
  "octagon-x-outline": require("../../../assets/icons/octagon-x-outline.xml"),
  wrench: require("../../../assets/icons/wrench.xml"),
} as const satisfies Partial<Record<IconName, unknown>>;

export type DrawableIconName = keyof typeof iconDrawables;
