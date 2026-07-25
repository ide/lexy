import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/constants/theme";
import { appTabs, tabBarMinimizeBehavior } from "@/navigation/tab-config";

export const unstable_settings = {
  initialRouteName: "status",
};

export default function TabLayout() {
  const [status, details, updates] = appTabs;

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      minimizeBehavior={tabBarMinimizeBehavior}
      tintColor={colors.systemBlue}
    >
      <NativeTabs.Trigger name={status.name}>
        <NativeTabs.Trigger.Icon sf={status.icon} />
        <NativeTabs.Trigger.Label>{status.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={details.name}>
        <NativeTabs.Trigger.Icon sf={details.icon} />
        <NativeTabs.Trigger.Label>{details.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={updates.name}>
        <NativeTabs.Trigger.Icon sf={updates.icon} />
        <NativeTabs.Trigger.Label>{updates.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
