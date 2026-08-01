import { describe, expect, it } from "vitest";

import { easProjectUrl } from "./eas-dashboard";

const LEXY = {
  owner: "ide",
  slug: "lexy",
  projectId: "50920011-b780-458b-9aaa-e305a424af77",
};

describe("easProjectUrl", () => {
  it("builds the readable account/slug dashboard path", () => {
    expect(easProjectUrl(LEXY)).toBe("https://expo.dev/accounts/ide/projects/lexy");
    expect(easProjectUrl(LEXY, "observe")).toBe(
      "https://expo.dev/accounts/ide/projects/lexy/observe",
    );
    expect(easProjectUrl(LEXY, "builds")).toBe(
      "https://expo.dev/accounts/ide/projects/lexy/builds",
    );
    expect(easProjectUrl(LEXY, "updates")).toBe(
      "https://expo.dev/accounts/ide/projects/lexy/updates",
    );
  });

  // A project ID survives an account or slug rename, so it stands in whenever
  // the config is missing either half of the readable pair.
  it("falls back to the project ID redirect without an owner and slug", () => {
    expect(easProjectUrl({ ...LEXY, owner: undefined }, "builds")).toBe(
      `https://expo.dev/projects/${LEXY.projectId}/builds`,
    );
    expect(easProjectUrl({ ...LEXY, slug: null })).toBe(
      `https://expo.dev/projects/${LEXY.projectId}`,
    );
  });

  // An unlinked project has no dashboard at all; the screen disables its rows
  // rather than opening a 404.
  it("returns null when nothing identifies the project", () => {
    expect(easProjectUrl({})).toBeNull();
    expect(easProjectUrl({ owner: "ide" }, "updates")).toBeNull();
  });

  it("escapes account and project names that need it", () => {
    expect(easProjectUrl({ owner: "my org", slug: "my app" })).toBe(
      "https://expo.dev/accounts/my%20org/projects/my%20app",
    );
  });
});
