import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerLargeTitle: true,
          headerTransparent: process.env.EXPO_OS === 'ios',
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerLargeStyle: { backgroundColor: 'transparent' },
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.systemBlue as string,
          headerTitleStyle: { color: colors.label as string },
          headerLargeTitleStyle: { color: colors.label as string },
          contentStyle: { backgroundColor: colors.groupedBackground },
        }}>
        <Stack.Screen name="index" options={{ title: 'IS 350' }} />
        <Stack.Screen
          name="details"
          options={{ title: 'Vehicle Details', headerLargeTitle: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
