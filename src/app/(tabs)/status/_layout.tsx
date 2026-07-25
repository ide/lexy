import { Stack } from "expo-router/stack";

import { colors } from "@/constants/theme";

export default function StatusLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.groupedBackground },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Status" }} />
    </Stack>
  );
}
