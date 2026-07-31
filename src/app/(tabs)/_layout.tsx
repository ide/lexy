import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/constants/theme";
import { useVehicleAutoRefresh } from "@/hooks/use-vehicle-auto-refresh";
import { appTabs, tabBarMinimizeBehavior } from "@/navigation/tab-config";

export const unstable_settings = {
  initialRouteName: "status",
};

export default function TabLayout() {
  // The whole signed-in vehicle section, and nothing narrower, is the right
  // scope for "keep this data fresh": it stays mounted across tab switches and
  // pushed routes, so the policy runs once and covers every screen showing
  // vehicle data — including ones that read the query directly, like the
  // location sheet.
  useVehicleAutoRefresh();

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      minimizeBehavior={tabBarMinimizeBehavior}
      tintColor={colors.systemBlue}
    >
      {appTabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.icon} />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
