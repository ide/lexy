/**
 * The header chrome every tab stack shares, per platform. iOS gets the large
 * title over a transparent bar — content scrolls under the system blur.
 * Android has no blur material behind a transparent bar, so scrolled content
 * would collide legibly with the title; its header is instead an opaque
 * Material surface in the grouped background color, shadowless so it reads as
 * the same sheet as the screen.
 */
export function createTabStackScreenOptions({
  platform,
  label,
  groupedBackground,
}: {
  platform: "ios" | "android" | string;
  label: string;
  groupedBackground: string;
}) {
  if (platform === "android") {
    return {
      headerTransparent: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: groupedBackground },
      headerTitleStyle: { color: label },
      contentStyle: { backgroundColor: groupedBackground },
    };
  }
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
