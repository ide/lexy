import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import { colors } from "@/constants/theme";
import { VehicleDataProvider } from "@/data/query-client";
import { DebugOverrideProvider } from "@/debug/debug-overrides";
import { EmergencyLaunchReporter } from "@/updates/emergency-launch-reporter";
import { UpdateHistoryRecorder } from "@/updates/update-history-recorder";

Observe.configure({
  integrations: { "expo-router": true },
  // Debug builds never dispatch unless opted in; set EXPO_PUBLIC_OBSERVE_DEV=1
  // when starting Metro to verify the Observe pipeline from a dev build.
  // Release builds ignore this flag.
  dispatchInDebug: process.env.EXPO_PUBLIC_OBSERVE_DEV === "1",
});

function RootNavigator() {
  // Nothing to wait for. Both reads the auth boundary depends on — the stored
  // session and the persisted query cache — happen synchronously before the
  // first render (see auth-context.tsx and query-client.tsx), so this renders
  // the right side of the boundary the first time, with the cached car already
  // in it. There is no hold, and so no blank frame to hold *for*.
  const { session } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: colors.systemBlue,
        headerTitleStyle: { color: colors.label },
        contentStyle: { backgroundColor: colors.groupedBackground },
        // The root stack only switches between the auth-boundary screens
        // (index → tabs, sign-in ↔ tabs). Those should appear in place, not
        // slide in from the right, so the car screen "just is there" on a
        // logged-in launch. Drill-down animations live in the nested tab stacks.
        animation: "none",
      }}
    >
      {/* The `/` entry renders nothing (it redirects to tabs or sign-in); hide
          its header so the route name doesn't flash in the bar on launch. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
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
    // Paint the root with the app's grouped background so every screen behind
    // the transparent header shares one color — matching the splash screen's
    // backgroundColor, with no white window flashing through between the splash
    // and the first content paint.
    // Keyed on the appearance so a light/dark switch rebuilds the tree. iOS
    // colours are live PlatformColors that repaint on their own, but Android's
    // Material roles resolve to a value when they are read (see theme.ts), so
    // the read has to happen again — remounting is what makes every screen do
    // that at once, including the native trees the hosts own.
    <GestureHandlerRootView
      key={colorScheme ?? "light"}
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
    >
      <AuthProvider>
        <VehicleDataProvider>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <UpdateHistoryRecorder />
            <EmergencyLaunchReporter />
            <DebugOverrideProvider>
              <RootNavigator />
            </DebugOverrideProvider>
          </ThemeProvider>
        </VehicleDataProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default ObserveRoot.wrap(RootLayout);
