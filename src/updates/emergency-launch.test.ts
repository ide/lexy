import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMERGENCY_LAUNCH_EVENT,
  emergencyLaunchKey,
  reportEmergencyLaunch,
  type EmergencyLaunchFacts,
  type LogEvent,
  type SeenStore,
} from "./emergency-launch";

const FELL_BACK: EmergencyLaunchFacts = {
  isEmergencyLaunch: true,
  reason: "Failed to load the update bundle",
  runtimeVersion: "12b236b5db46db73f7e980360bb9ba7247108187",
  channel: "preview",
  buildNumber: "24",
};

function fakeStore(initial: string | null = null): SeenStore & { value: string | null } {
  return {
    value: initial,
    async getItemAsync() {
      return this.value;
    },
    async setItemAsync(_key: string, value: string) {
      this.value = value;
    },
  };
}

describe("reportEmergencyLaunch", () => {
  let storage: ReturnType<typeof fakeStore>;
  let logEvent: ReturnType<typeof vi.fn<LogEvent>>;

  beforeEach(() => {
    storage = fakeStore();
    logEvent = vi.fn<LogEvent>();
  });

  it("says nothing on an ordinary launch", async () => {
    const logged = await reportEmergencyLaunch(
      { ...FELL_BACK, isEmergencyLaunch: false },
      { storage, logEvent },
    );
    expect(logged).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
    // Nothing to remember, so nothing written.
    expect(storage.value).toBeNull();
  });

  it("reports the failure with the context a query needs", async () => {
    expect(await reportEmergencyLaunch(FELL_BACK, { storage, logEvent })).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(EMERGENCY_LAUNCH_EVENT, {
      severity: "error",
      body: "Failed to load the update bundle",
      attributes: {
        recovered: true,
        buildNumber: "24",
        runtimeVersion: "12b236b5db46db73f7e980360bb9ba7247108187",
        channel: "preview",
      },
    });
  });

  // The fallback is a property of the launch, so it recurs on every cold start
  // until a working update replaces the broken one. One incident, one event.
  it("stays quiet on later launches after the same failure", async () => {
    await reportEmergencyLaunch(FELL_BACK, { storage, logEvent });
    const again = await reportEmergencyLaunch(FELL_BACK, { storage, logEvent });
    expect(again).toBe(false);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("reports again when a different update fails", async () => {
    await reportEmergencyLaunch(FELL_BACK, { storage, logEvent });
    const next = await reportEmergencyLaunch(
      { ...FELL_BACK, reason: "Update bundle hash mismatch" },
      { storage, logEvent },
    );
    expect(next).toBe(true);
    expect(logEvent).toHaveBeenCalledTimes(2);
  });

  // A new binary is a new situation even if the runtime reports the same words.
  it("reports again after the app is rebuilt", async () => {
    await reportEmergencyLaunch(FELL_BACK, { storage, logEvent });
    expect(
      await reportEmergencyLaunch({ ...FELL_BACK, buildNumber: "25" }, { storage, logEvent }),
    ).toBe(true);
  });

  it("still reports when the runtime gives no reason", async () => {
    expect(await reportEmergencyLaunch({ ...FELL_BACK, reason: null }, { storage, logEvent })).toBe(
      true,
    );
    expect(logEvent.mock.calls[0][1].body).toBe(
      "An update failed to launch and the embedded bundle was used instead.",
    );
  });

  // Losing the record should cost a duplicate report, never the report itself.
  it("reports through a corrupt record", async () => {
    storage = fakeStore("not json");
    expect(await reportEmergencyLaunch(FELL_BACK, { storage, logEvent })).toBe(true);
  });

  it("forgets the oldest failures rather than growing without bound", async () => {
    for (let i = 0; i < 25; i++) {
      await reportEmergencyLaunch({ ...FELL_BACK, reason: `failure ${i}` }, { storage, logEvent });
    }
    expect(JSON.parse(storage.value!)).toHaveLength(20);
  });
});

describe("emergencyLaunchKey", () => {
  it("treats every missing fact as a named unknown, not a blank", () => {
    expect(
      emergencyLaunchKey({
        isEmergencyLaunch: true,
        reason: null,
        runtimeVersion: null,
        channel: null,
        buildNumber: null,
      }),
    ).toBe("unknown-build|unknown-runtime|no-reason");
  });
});
