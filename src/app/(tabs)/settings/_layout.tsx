import { Stack } from "expo-router/stack";

import { tabStackScreenOptions } from "@/navigation/tab-stack-options-preset";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen
        name="updates"
        options={{
          title: "Expo Updates",
          // "Settings" is a long back-title, so show just the chevron.
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="eas"
        options={{
          // The full "Expo Application Services" is the menu row's job; a large
          // title that long shrinks itself to fit rather than reading well.
          title: "EAS",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="data-state"
        options={{
          title: "Data State",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="vehicle-name"
        options={{
          title: "Name",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      {/* No header so the preview is pixel-identical to the real, headerless
          sign-in screen. Swipe from the left edge to return to the menu. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
