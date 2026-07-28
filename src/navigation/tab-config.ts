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
    label: "Details",
    icon: {
      default: "list.bullet.rectangle",
      selected: "list.bullet.rectangle.fill",
    },
  },
  {
    name: "development",
    label: "Development",
    icon: { default: "hammer", selected: "hammer.fill" },
  },
] as const satisfies readonly {
  name: string;
  label: string;
  icon: { default: SFSymbol; selected: SFSymbol };
}[];
