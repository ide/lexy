export function createTabStackScreenOptions({
  label,
  groupedBackground,
}: {
  label: string;
  groupedBackground: string;
}) {
  return {
    headerLargeTitleEnabled: true,
    headerTransparent: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerLargeStyle: { backgroundColor: "transparent" },
    headerTitleStyle: { color: label },
    headerLargeTitleStyle: { color: label },
    contentStyle: { backgroundColor: groupedBackground },
  };
}
