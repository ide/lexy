import { Stack } from "expo-router/stack";

import { colors } from "@/constants/theme";
import { createTabStackScreenOptions } from "@/navigation/tab-stack-options";

const tabStackScreenOptions = createTabStackScreenOptions({
  label: colors.label as string,
  groupedBackground: colors.groupedBackground as string,
});

export default function StatusLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Status" }} />
    </Stack>
  );
}
