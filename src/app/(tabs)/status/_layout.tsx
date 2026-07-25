import { Stack } from 'expo-router/stack';

import { colors } from '@/constants/theme';

export default function StatusLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: 'transparent' },
        headerTitleStyle: { color: colors.label as string },
        headerLargeTitleStyle: { color: colors.label as string },
        contentStyle: { backgroundColor: colors.groupedBackground },
      }}>
      <Stack.Screen name="index" options={{ title: 'Status' }} />
    </Stack>
  );
}
