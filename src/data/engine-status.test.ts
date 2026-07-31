import { describe, expect, it } from "vitest";

import { DEFAULT_RUNTIME_MINUTES, parseEngineStatus } from "./engine-status";

const STARTED_AT = "2026-07-30T22:15:04Z";

describe("parseEngineStatus", () => {
  it("reads a running engine from the payload envelope", () => {
    expect(
      parseEngineStatus({
        payload: { vin: "JT000", status: "1", date: STARTED_AT, timer: 10 },
      }),
    ).toEqual({ running: true, startedAt: STARTED_AT, runtimeMinutes: 10 });
  });

  it("accepts a bare payload without the envelope", () => {
    expect(parseEngineStatus({ status: "1", date: STARTED_AT, timer: 10 })?.running).toBe(true);
  });

  // Only "1" is running. The official app's enum also carries "0" (the field's
  // default) and "2", and treats both as not running.
  it.each(["0", "2", "", "true", "01"])("treats status %j as not running", (status) => {
    expect(parseEngineStatus({ status })?.running).toBe(false);
  });

  it("defaults the runtime when the vehicle reports no timer", () => {
    expect(parseEngineStatus({ status: "1" })?.runtimeMinutes).toBe(DEFAULT_RUNTIME_MINUTES);
  });

  // A zero runtime would make a just-started engine read as already expired.
  it("defaults the runtime when the timer is zero", () => {
    expect(parseEngineStatus({ status: "1", timer: 0 })?.runtimeMinutes).toBe(
      DEFAULT_RUNTIME_MINUTES,
    );
  });

  it("keeps a missing start time as null rather than inventing one", () => {
    expect(parseEngineStatus({ status: "1" })?.startedAt).toBeNull();
  });

  // `status` is a string on the wire; a boolean or number means we're looking
  // at something other than an engine-status payload.
  it.each([null, undefined, 42, "payload", { status: 1 }, { status: true }, { payload: {} }])(
    "returns null for the unrecognized shape %j",
    (value) => {
      expect(parseEngineStatus(value)).toBeNull();
    },
  );

  it("keeps the reported start time verbatim for a future runtime countdown", () => {
    expect(parseEngineStatus({ status: "1", date: STARTED_AT })?.startedAt).toBe(STARTED_AT);
  });
});
