import { describe, expect, it } from "vitest";

import {
  cornerShownAts,
  cornerVisibility,
  doorStatus,
  oldestStale,
  openingStatus,
  windowStatus,
} from "./closure-display";
import type { Corner } from "./closures";

describe("doorStatus", () => {
  it("flags an open door before considering the lock", () => {
    expect(doorStatus({ label: "Driver Front Door", state: "Open", locked: true })).toEqual({
      text: "Door open",
      tone: "attention",
      symbol: "lock-open",
    });
  });

  it("reads unlocked as attention and locked as settled", () => {
    expect(doorStatus({ label: "d", state: "Closed", locked: false }).text).toBe("Door unlocked");
    expect(doorStatus({ label: "d", state: "Closed", locked: true })).toEqual({
      text: "Door locked",
      tone: "settled",
      symbol: "lock",
    });
  });

  it("shows optimistic lock predictions as pending", () => {
    expect(doorStatus({ label: "d", locked: true, lockedOptimistic: true }).text).toBe("Locking…");
    expect(doorStatus({ label: "d", locked: false, lockedOptimistic: true }).text).toBe(
      "Unlocking…",
    );
  });

  it("falls back to a plain closed reading without a lock", () => {
    expect(doorStatus({ label: "d", state: "Closed" })).toEqual({
      text: "Door closed",
      tone: "settled",
      symbol: "check-circle",
    });
  });
});

describe("windowStatus", () => {
  it("swaps the left/right glyphs to match the driver/passenger columns", () => {
    expect(windowStatus({ label: "w", state: "Closed" }, "driver").symbol).toBe("car-window-right");
    expect(windowStatus({ label: "w", state: "Open" }, "passenger")).toEqual({
      text: "Window open",
      tone: "attention",
      symbol: "car-window-left",
    });
  });
});

describe("openingStatus", () => {
  it("matches known openings to their identity glyphs", () => {
    // One glyph per opening, both positions: the tone and the word carry
    // open/closed, so the icon is only there to say which panel this row is.
    expect(openingStatus({ label: "Moonroof", state: "Open" }).symbol).toBe("moonroof");
    expect(openingStatus({ label: "Moonroof", state: "Closed" }).symbol).toBe("moonroof");
    expect(openingStatus({ label: "Sunroof", state: "Open" }).symbol).toBe("moonroof");
    expect(openingStatus({ label: "Trunk", state: "Closed" }).symbol).toBe("trunk");
    expect(openingStatus({ label: "Hood", state: "Closed" }).symbol).toBe("hood");
  });

  it("falls back to generic glyphs for unrecognized openings", () => {
    expect(openingStatus({ label: "Charge Port", state: "Open" })).toEqual({
      text: "Charge Port open",
      tone: "attention",
      symbol: "warning",
    });
    expect(openingStatus({ label: "Charge Port", state: "Closed" }).symbol).toBe("check-circle");
  });
});

const CORNER: Corner = {
  key: "driver-front",
  title: "Driver · Front",
  side: "driver",
  row: "front",
};

describe("cornerVisibility / cornerShownAts", () => {
  it("shows a door with only a lock reading, and skips a stateless window", () => {
    const corner: Corner = {
      ...CORNER,
      door: { label: "d", locked: true, lockedAt: "2026-01-02T00:00:00Z" },
      window: { label: "w", stateAt: "2026-01-01T00:00:00Z" },
    };
    expect(cornerVisibility(corner)).toEqual({ showDoor: true, showWindow: false });
    expect(cornerShownAts(corner)).toEqual([undefined, "2026-01-02T00:00:00Z", undefined]);
  });

  it("hides a door with neither position nor lock", () => {
    const corner: Corner = { ...CORNER, door: { label: "d" } };
    expect(cornerVisibility(corner)).toEqual({
      showDoor: false,
      showWindow: false,
    });
    expect(cornerShownAts(corner)).toEqual([undefined, undefined, undefined]);
  });

  it("reports shown window timestamps", () => {
    const corner: Corner = {
      ...CORNER,
      window: { label: "w", state: "Closed", stateAt: "2026-01-01T00:00:00Z" },
    };
    expect(cornerShownAts(corner)).toEqual([undefined, undefined, "2026-01-01T00:00:00Z"]);
  });
});

describe("oldestStale", () => {
  const FRESH = "2026-01-10T00:00:00Z";

  it("returns the oldest reading that predates the snapshot", () => {
    expect(
      oldestStale(FRESH, ["2026-01-09T00:00:00Z", "2026-01-05T00:00:00Z", "2026-01-08T00:00:00Z"]),
    ).toBe("2026-01-05T00:00:00Z");
  });

  it("ignores readings as fresh as (or newer than) the snapshot", () => {
    expect(oldestStale(FRESH, [FRESH, "2026-01-11T00:00:00Z", undefined])).toBe(null);
  });

  it("returns null for an unparseable snapshot time", () => {
    expect(oldestStale("not a date", ["2026-01-05T00:00:00Z"])).toBe(null);
  });

  it("skips unparseable readings", () => {
    expect(oldestStale(FRESH, ["garbage", "2026-01-06T00:00:00Z"])).toBe("2026-01-06T00:00:00Z");
  });
});
