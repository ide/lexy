import { router, Stack } from "expo-router";
import { Pressable } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
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

// The sheet's native header dismiss control: the standard grey circular xmark
// Apple uses to close a presented sheet.
function SheetCloseButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={12}
      onPress={() => router.back()}
    >
      <Icon name="xmark.circle.fill" size={26} tint={colors.secondaryLabel as string} />
    </Pressable>
  );
}

export default function StatusLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Status" }} />
      {/* The car-location map, presented as a draggable bottom sheet and opened
          from the "Last parked" button on the Status screen. Uses the native
          stack header (inline title + X) rather than a hand-rolled one so the
          title sizing and position match the system sheet chrome. */}
      <Stack.Screen
        name="map"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: false,
          sheetCornerRadius: 24,
          headerShown: true,
          headerLargeTitleEnabled: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.groupedBackground as string },
          title: "Last Parked",
          headerRight: () => <SheetCloseButton />,
        }}
      />
    </Stack>
  );
}
