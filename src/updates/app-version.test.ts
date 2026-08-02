import { describe, expect, it } from "vitest";

import { describeAppVersion, shortUpdateId, type AppVersionFacts } from "./app-version";

const RELEASE: AppVersionFacts = {
  version: "1.0.0",
  buildNumber: "24",
  updatesEnabled: true,
  isEmbeddedLaunch: true,
  updateId: null,
  channel: "preview",
  isEmergencyLaunch: false,
};

describe("describeAppVersion", () => {
  // One line, both versions: the binary a tester reads off TestFlight, then the
  // JavaScript running inside it, which an update can replace at any time.
  it("names the JavaScript that shipped with the binary", () => {
    expect(describeAppVersion(RELEASE).version).toBe("1.0.0 (24) (embedded)");
  });

  it("names the running update when one replaced it", () => {
    expect(
      describeAppVersion({
        ...RELEASE,
        isEmbeddedLaunch: false,
        updateId: "0226b150-8260-444d-8e19-871e3044f38c",
      }).version,
    ).toBe("1.0.0 (24) (0226b150)");
  });

  // A dev build's JavaScript comes from Metro, not from either bundle we could
  // name, so neither "embedded" nor an update ID would be true.
  it("does not call a development build embedded", () => {
    expect(describeAppVersion({ ...RELEASE, updatesEnabled: false }).version).toBe(
      "1.0.0 (24) (development)",
    );
  });

  it("falls back rather than printing an empty version", () => {
    expect(describeAppVersion({ ...RELEASE, version: undefined }).version).toBe(
      "Unknown (24) (embedded)",
    );
    expect(describeAppVersion({ ...RELEASE, buildNumber: null }).version).toBe("1.0.0 (embedded)");
  });

  // expo-updates reports an embedded launch and a null ID separately; a build
  // that somehow has neither should still not render a blank version.
  it("treats a missing update ID as embedded", () => {
    expect(
      describeAppVersion({ ...RELEASE, isEmbeddedLaunch: false, updateId: null }).version,
    ).toBe("1.0.0 (24) (embedded)");
  });

  it("says nothing about recovery on an ordinary launch", () => {
    expect(describeAppVersion(RELEASE).emergency).toBeNull();
  });

  // The state the section exists for: everything looks normal, but the app is
  // running older code than it downloaded.
  it("explains an emergency launch", () => {
    expect(describeAppVersion({ ...RELEASE, isEmergencyLaunch: true }).emergency).toBe(
      "Lexy couldn't run its latest update and is using the version built into this app.",
    );
  });
});

describe("shortUpdateId", () => {
  it("shortens a UUID to something a person can read back", () => {
    expect(shortUpdateId("0226b150-8260-444d-8e19-871e3044f38c")).toBe("0226b150");
    expect(shortUpdateId(null)).toBeNull();
  });
});
