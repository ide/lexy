import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/constants/theme';

export const unstable_settings = {
  initialRouteName: 'status',
};

export default function TabLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.systemBlue}>
      <NativeTabs.Trigger name="status">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'car', selected: 'car.fill' }}
          md="directions_car"
        />
        <NativeTabs.Trigger.Label>Status</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="details">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
          md="list_alt"
        />
        <NativeTabs.Trigger.Label>Details</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
