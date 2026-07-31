import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/constants/theme";
import { appTabs, tabBarMinimizeBehavior } from "@/navigation/tab-config";

export const unstable_settings = {
  initialRouteName: "status",
};

export default function TabLayout() {
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
