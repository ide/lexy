import { colors } from "@/constants/theme";

export const tabStackScreenOptions = {
  headerLargeTitle: true,
  headerTransparent: true,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerLargeStyle: { backgroundColor: "transparent" },
  headerTitleStyle: { color: colors.label as string },
  headerLargeTitleStyle: { color: colors.label as string },
  contentStyle: { backgroundColor: colors.groupedBackground },
};
