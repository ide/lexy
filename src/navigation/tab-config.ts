import type { AndroidSymbol } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

export const tabBarMinimizeBehavior = "never" as const;

// Tab icons stay outside the semantic registry (icon-registry.ts): a native tab
// bar draws its glyphs from the platform's own catalog rather than through the
// `Icon` component, and Android's is Material *Symbols* — the `md` prop on
// `NativeTabs.Trigger.Icon` — not the Material Design Icons font the registry
// names. Each tab therefore carries both forms side by side; iOS reads `sf`,
// Android reads `md`.
//
// Only the SF side is an outline/filled pair. Material Symbols express fill as
// a variation axis rather than a separate glyph name, so one name covers both
// tab states there.
export const appTabs = [
  {
    name: "status",
    label: "Status",
    icon: { default: "car", selected: "car.fill" },
    materialIcon: "directions_car",
  },
  {
    name: "details",
    label: "Specs",
    icon: {
      default: "list.bullet.rectangle",
      selected: "list.bullet.rectangle.fill",
    },
    materialIcon: "list_alt",
  },
  {
    name: "settings",
    label: "Settings",
    icon: { default: "gearshape", selected: "gearshape.fill" },
    materialIcon: "settings",
  },
] as const satisfies readonly {
  name: string;
  label: string;
  icon: { default: SFSymbol; selected: SFSymbol };
  materialIcon: AndroidSymbol;
}[];
