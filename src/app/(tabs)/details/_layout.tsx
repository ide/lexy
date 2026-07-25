import { Stack } from "expo-router/stack";

import { tabStackScreenOptions } from "@/navigation/tab-stack-options";

export default function DetailsLayout() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Details" }} />
    </Stack>
  );
}
