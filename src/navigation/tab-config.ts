import type { SFSymbol } from "sf-symbols-typescript";

export const tabBarMinimizeBehavior = "never" as const;

export const appTabs = [
  {
    name: "status",
    label: "Status",
    icon: { default: "car", selected: "car.fill" },
  },
  {
    name: "details",
    label: "Specs",
    icon: {
      default: "list.bullet.rectangle",
      selected: "list.bullet.rectangle.fill",
    },
  },
  {
    name: "settings",
    label: "Settings",
    icon: { default: "gearshape", selected: "gearshape.fill" },
  },
] as const satisfies readonly {
  name: string;
  label: string;
  icon: { default: SFSymbol; selected: SFSymbol };
}[];
