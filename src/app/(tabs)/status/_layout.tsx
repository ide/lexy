import { Stack } from "expo-router/stack";

import { colors } from "@/constants/theme";
import { createTabStackScreenOptions } from "@/navigation/tab-stack-options";

const tabStackScreenOptions = createTabStackScreenOptions({
  label: colors.label as string,
  groupedBackground: colors.groupedBackground as string,
});

// Anchor the stack to `index` so the map sheet (a formSheet) keeps the Status
// screen behind it, including when the route is deep-linked.
export const unstable_settings = {
  anchor: "index",
};

export default function StatusLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Status" }} />
      {/* The car-location map, presented as a draggable bottom sheet and opened
          by tapping the "Last parked" hero card on the Status screen. */}
      <Stack.Screen
        name="map"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
