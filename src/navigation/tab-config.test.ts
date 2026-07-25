import { describe, expect, it } from "vitest";

import { appTabs, tabBarMinimizeBehavior } from "./tab-config";

describe("app tab configuration", () => {
  it("keeps the tab bar visible and exposes diagnostics as a first-class tab", () => {
    expect(tabBarMinimizeBehavior).toBe("never");
    expect(appTabs.map(({ name, label }) => ({ name, label }))).toEqual([
      { name: "status", label: "Status" },
      { name: "details", label: "Details" },
      { name: "updates", label: "Updates" },
    ]);
  });
});
