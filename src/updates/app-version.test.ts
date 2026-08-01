import { describe, expect, it } from "vitest";

import { describeAppVersion, shortUpdateId, type AppVersionFacts } from "./app-version";

const RELEASE: AppVersionFacts = {
  version: "1.0.0",
  buildNumber: "24",
  updatesEnabled: true,
  isEmbeddedLaunch: true,
  updateId: null,
  updateCreatedAt: null,
  channel: "preview",
  isEmergencyLaunch: false,
  emergencyLaunchReason: null,
};

describe("describeAppVersion", () => {
  it("pairs the marketing version with the build number a tester reads", () => {
    expect(describeAppVersion(RELEASE).version).toBe("1.0.0 (24)");
  });

  it("says the JavaScript is the one that shipped with the binary", () => {
    const shown = describeAppVersion(RELEASE);
    expect(shown.update).toBe("Embedded in this build");
    expect(shown.published).toBeNull();
    expect(shown.report).toBe("Lexy 1.0.0 (24) · Embedded in this build · preview");
  });

  it("names the running update and when it was published", () => {
    const shown = describeAppVersion({
      ...RELEASE,
      isEmbeddedLaunch: false,
      updateId: "1b108f69-aed0-46af-b6bb-3989341e185e",
      updateCreatedAt: new Date("2026-08-01T22:40:00Z"),
    });
    expect(shown.update).toBe("1b108f69");
    expect(shown.published).toBeTruthy();
    expect(shown.report).toBe("Lexy 1.0.0 (24) · 1b108f69 · preview");
  });

  // A dev build's JavaScript comes from Metro, not from either bundle we could
  // name, so neither "embedded" nor an update ID would be true.
  it("does not call a development build embedded", () => {
    const shown = describeAppVersion({
      ...RELEASE,
      updatesEnabled: false,
      channel: null,
      buildNumber: null,
    });
    expect(shown.update).toBe("Development build");
    expect(shown.report).toBe("Lexy 1.0.0 · Development build");
  });

  it("says nothing about recovery on an ordinary launch", () => {
    expect(describeAppVersion(RELEASE).emergency).toBeNull();
  });

  // The state the section exists for: everything looks normal, but the app is
  // running older code than it downloaded.
  it("explains an emergency launch, and carries the reason into the report", () => {
    const shown = describeAppVersion({
      ...RELEASE,
      isEmergencyLaunch: true,
      emergencyLaunchReason: "Failed to load the update bundle",
    });
    expect(shown.emergency).toBe(
      "Lexy couldn't run its latest update and is using the version built into this app.",
    );
    expect(shown.report).toBe(
      "Lexy 1.0.0 (24) · Embedded in this build · preview · emergency launch: Failed to load the update bundle",
    );
  });

  it("still flags an emergency launch when the runtime gives no reason", () => {
    const shown = describeAppVersion({ ...RELEASE, isEmergencyLaunch: true });
    expect(shown.emergency).toBeTruthy();
    expect(shown.report).toMatch(/· emergency launch$/);
  });

  it("falls back rather than printing an empty version", () => {
    expect(describeAppVersion({ ...RELEASE, version: undefined }).version).toBe("Unknown (24)");
  });

  // expo-updates reports an embedded launch and a null ID separately; a build
  // that somehow has neither should still not render a blank row.
  it("treats a missing update ID as embedded", () => {
    expect(describeAppVersion({ ...RELEASE, isEmbeddedLaunch: false, updateId: null }).update).toBe(
      "Embedded in this build",
    );
  });
});

describe("shortUpdateId", () => {
  it("shortens a UUID to something a person can read back", () => {
    expect(shortUpdateId("1b108f69-aed0-46af-b6bb-3989341e185e")).toBe("1b108f69");
    expect(shortUpdateId(null)).toBeNull();
  });
});
