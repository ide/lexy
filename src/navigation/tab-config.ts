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
    name: "updates",
    label: "Updates",
    icon: {
      default: "arrow.trianglehead.2.clockwise.rotate.90",
      selected: "arrow.trianglehead.2.clockwise.rotate.90.circle.fill",
    },
  },
] as const satisfies readonly {
  name: string;
  label: string;
  icon: { default: SFSymbol; selected: SFSymbol };
}[];
