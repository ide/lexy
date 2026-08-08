import { describe, expect, it } from "vitest";

import { createTabStackScreenOptions } from "./tab-stack-options";

describe("tab stack options", () => {
  it("uses native iOS large titles for each tab root", () => {
    const options = createTabStackScreenOptions({
      platform: "ios",
      label: "label",
      groupedBackground: "background",
    });

    expect(options).toMatchObject({
      headerLargeTitleEnabled: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerLargeStyle: { backgroundColor: "transparent" },
    });
  });

  it("gives Android an opaque, shadowless Material header", () => {
    const options = createTabStackScreenOptions({
      platform: "android",
      label: "label",
      groupedBackground: "background",
    });

    expect(options).toMatchObject({
      headerTransparent: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "background" },
      contentStyle: { backgroundColor: "background" },
    });
    expect(options).not.toHaveProperty("headerLargeTitleEnabled");
  });
});
