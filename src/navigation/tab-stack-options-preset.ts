import { Platform } from "react-native";

import { colors } from "@/constants/theme";

import { createTabStackScreenOptions } from "./tab-stack-options";

/**
 * The app palette applied to the factory — every tab stack uses exactly these
 * options. Built per call rather than once at import: Android's colours
 * resolve when they are read (see theme.ts), so an options object captured at
 * module scope would hold the launch scheme's header colours through an
 * appearance change. The factory itself stays parameterized so
 * tab-stack-options.test.ts can run without the native palette.
 */
export const tabStackScreenOptions = () =>
  createTabStackScreenOptions({
    platform: Platform.OS,
    label: colors.label,
    groupedBackground: colors.groupedBackground,
  });
