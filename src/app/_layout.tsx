import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/auth/auth-context";
import { colors } from "@/constants/theme";
import { VehicleDataProvider } from "@/data/query-client";
import { DebugOverrideProvider } from "@/debug/debug-overrides";
import { useLaunchGate } from "@/navigation/use-launch-gate";
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
  // The only thing a launch still waits on is the persisted query cache
  // rehydrating — a local SQLite read. Both network calls that used to sit in
  // front of the first paint are behind it now: the Lexus token refresh (see
  // the restore effect in auth-context) and, when there is a cached car to
  // render, the Keychain read confirming the session (see launch-gate.ts).
  const { hold, signedIn } = useLaunchGate();

  if (hold) {
    return null;
  }

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
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // Paint the root with the app's grouped background so the launch hold
    // (RootNavigator returns null until the launch gate opens) and
    // every screen behind the transparent header share one color — matching
    // the splash screen's backgroundColor, with no white window flashing
    // through between the splash and the first content paint.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
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
