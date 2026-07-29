import { Stack } from "expo-router/stack";

import { colors } from "@/constants/theme";
import { createTabStackScreenOptions } from "@/navigation/tab-stack-options";

const tabStackScreenOptions = createTabStackScreenOptions({
  label: colors.label as string,
  groupedBackground: colors.groupedBackground as string,
});

export default function SettingsLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen
        name="updates"
        options={{
          title: "Updates",
          // "Settings" is a long back-title, so show just the chevron.
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      {/* No header so the preview is pixel-identical to the real, headerless
          sign-in screen. Swipe from the left edge to return to the menu. */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
