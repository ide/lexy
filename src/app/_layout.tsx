import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <VehicleDataProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <UpdateHistoryRecorder />
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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </VehicleDataProvider>
    </GestureHandlerRootView>
  );
}

export default ObserveRoot.wrap(RootLayout);
