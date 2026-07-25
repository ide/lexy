import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { colors } from '@/constants/theme';
import { VehicleDataProvider } from '@/data/query-client';
import { UpdateHistoryRecorder } from '@/updates/update-history-recorder';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <VehicleDataProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <UpdateHistoryRecorder />
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            headerTintColor: colors.systemBlue as string,
            headerTitleStyle: { color: colors.label as string },
            contentStyle: { backgroundColor: colors.groupedBackground },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="updates"
            options={{ title: 'Update Diagnostics', headerLargeTitle: false }}
          />
        </Stack>
      </ThemeProvider>
    </VehicleDataProvider>
  );
}
