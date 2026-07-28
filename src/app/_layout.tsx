import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import { colors } from "@/constants/theme";
import { VehicleDataProvider } from "@/data/query-client";
import { UpdateHistoryRecorder } from "@/updates/update-history-recorder";

Observe.configure({
  integrations: { "expo-router": true },
  // Debug builds never dispatch unless opted in; set EXPO_PUBLIC_OBSERVE_DEV=1
  // when starting Metro to verify the Observe pipeline from a dev build.
  // Release builds ignore this flag.
  dispatchInDebug: process.env.EXPO_PUBLIC_OBSERVE_DEV === "1",
});

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: colors.systemBlue as string,
        headerTitleStyle: { color: colors.label as string },
        contentStyle: { backgroundColor: colors.groupedBackground },
        // The root stack only switches between the auth-boundary screens
        // (index → tabs, sign-in ↔ tabs). Those should appear in place, not
        // slide in from the right, so the car screen "just is there" on a
        // logged-in launch. Drill-down animations live in the nested tab stacks.
        animation: "none",
      }}
    >
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <VehicleDataProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <UpdateHistoryRecorder />
            <RootNavigator />
          </ThemeProvider>
        </VehicleDataProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default ObserveRoot.wrap(RootLayout);
