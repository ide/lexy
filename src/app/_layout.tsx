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

// Anchor the root stack on the authenticated tabs. Without an anchor there is
// no route matching "/", so on a logged-in cold launch expo-router resolves
// the initial URL by *navigating* to the first available screen — which slides
// the car screen in from the right. Anchoring makes (tabs) the initial route so
// it renders in place. When signed out the guard drops (tabs) and the router
// falls back to the sign-in screen, exactly as it does for a denied route.
export const unstable_settings = {
  anchor: "(tabs)",
};

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
