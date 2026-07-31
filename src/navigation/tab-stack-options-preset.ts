import { colors } from "@/constants/theme";

import { createTabStackScreenOptions } from "./tab-stack-options";

// Prebuilt with the app palette — every tab stack uses exactly these options.
// The factory stays parameterized so tab-stack-options.test.ts can run without
// importing the native color palette.
export const tabStackScreenOptions = createTabStackScreenOptions({
  label: colors.label,
  groupedBackground: colors.groupedBackground,
});
