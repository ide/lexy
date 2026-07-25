import { describe, expect, it } from "vitest";

import { createTabStackScreenOptions } from "./tab-stack-options";

describe("tab stack options", () => {
  it("uses native iOS large titles for each tab root", () => {
    const options = createTabStackScreenOptions({
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
});
