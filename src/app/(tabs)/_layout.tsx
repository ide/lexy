import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/constants/theme";
import { appTabs, tabBarMinimizeBehavior } from "@/navigation/tab-config";

export const unstable_settings = {
  initialRouteName: "status",
};

export default function TabLayout() {
  const [status, details, settings] = appTabs;

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
      <NativeTabs.Trigger name={settings.name}>
        <NativeTabs.Trigger.Icon sf={settings.icon} />
        <NativeTabs.Trigger.Label>{settings.label}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
