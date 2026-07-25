import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import { useColorScheme } from "react-native";

import { colors } from "@/constants/theme";
import { VehicleDataProvider } from "@/data/query-client";
import { UpdateHistoryRecorder } from "@/updates/update-history-recorder";

Observe.configure({
  integrations: { "expo-router": true },
});

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <VehicleDataProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
  );
}

export default ObserveRoot.wrap(RootLayout);
