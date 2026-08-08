import { describe, expect, it } from "vitest";

import { closuresSummary } from "./closure-summary";
import type { Corner } from "./closures";
import type { Closure } from "./vehicle";

function corner(
  key: string,
  title: string,
  side: Corner["side"],
  door?: Closure,
  window?: Closure,
): Corner {
  return { key, title, side, row: key.startsWith("front") ? "front" : "rear", door, window };
}

const lockedDoor: Closure = { label: "door", state: "Closed", locked: true };
const closedWindow: Closure = { label: "window", state: "Closed" };

function allClearCorners(): Corner[] {
  return [
    corner("frontDriver", "Front driver", "driver", { ...lockedDoor }, { ...closedWindow }),
    corner(
      "frontPassenger",
      "Front passenger",
      "passenger",
      { ...lockedDoor },
      { ...closedWindow },
    ),
    corner("rearDriver", "Rear driver", "driver", { ...lockedDoor }, { ...closedWindow }),
    corner("rearPassenger", "Rear passenger", "passenger", { ...lockedDoor }, { ...closedWindow }),
  ];
}

const closedOpenings: Closure[] = [
  { label: "Moonroof", state: "Closed" },
  { label: "Trunk", state: "Closed" },
  { label: "Hood", state: "Closed" },
];

describe("closuresSummary", () => {
  it("collapses full all-clear data to one secure verdict", () => {
    const summary = closuresSummary(allClearCorners(), closedOpenings);
    expect(summary).toEqual({
      kind: "secure",
      headline: "All secure",
      subline: "Doors locked · Everything else closed",
      symbol: "shield-check",
      exceptions: [],
    });
  });

  it("claims only closed, not secure, without lock readings", () => {
    const corners = allClearCorners().map((c) => ({
      ...c,
      door: { label: "door", state: "Closed" } as Closure,
    }));
    const summary = closuresSummary(corners, []);
    expect(summary.headline).toBe("All closed");
    expect(summary.subline).toBe("Doors closed · Windows closed");
  });

  it("names exactly what was read when data is partial", () => {
    // Doors and trunk only — no window or moonroof readings to vouch for.
    const corners = allClearCorners().map((c) => ({ ...c, window: undefined }));
    const summary = closuresSummary(corners, [{ label: "Trunk", state: "Closed" }]);
    expect(summary.subline).toBe("Doors locked · Trunk closed");
  });

  it("promotes a single exception to the headline", () => {
    const summary = closuresSummary(allClearCorners(), [
      { label: "Moonroof", state: "Closed" },
      { label: "Trunk", state: "Open" },
    ]);
    expect(summary.kind).toBe("attention");
    expect(summary.headline).toBe("Trunk open");
    expect(summary.subline).toBe("Everything else closed and locked");
    expect(summary.exceptions).toEqual([]);
  });

  it("headlines a lone corner exception with its location", () => {
    const corners = allClearCorners();
    corners[3].window = { label: "window", state: "Open" };
    const summary = closuresSummary(corners, closedOpenings);
    expect(summary.headline).toBe("Rear passenger window open");
    expect(summary.symbol).toBe("car-window-left");
  });

  it("counts multiple exceptions and lists each with its location", () => {
    const corners = allClearCorners();
    corners[0].door = { label: "door", state: "Closed", locked: false };
    corners[3].window = { label: "window", state: "Open" };
    const summary = closuresSummary(corners, [
      { label: "Moonroof", state: "Closed" },
      { label: "Trunk", state: "Open" },
    ]);
    expect(summary.kind).toBe("attention");
    expect(summary.headline).toBe("2 open, 1 unlocked");
    expect(summary.exceptions).toEqual([
      {
        key: "door:frontDriver",
        label: "Door unlocked",
        where: "Front driver",
        headline: "Front driver door unlocked",
        symbol: "lock-open",
      },
      {
        key: "window:rearPassenger",
        label: "Window open",
        where: "Rear passenger",
        headline: "Rear passenger window open",
        symbol: "car-window-left",
      },
      {
        key: "opening:Trunk",
        label: "Trunk open",
        where: undefined,
        headline: "Trunk open",
        symbol: "trunk",
      },
    ]);
  });

  it("states plain counts when the exceptions are all of one kind", () => {
    const openTwo = closuresSummary(allClearCorners(), [
      { label: "Moonroof", state: "Open" },
      { label: "Trunk", state: "Open" },
    ]);
    expect(openTwo.headline).toBe("2 open");

    const corners = allClearCorners();
    corners[0].door = { label: "door", state: "Closed", locked: false };
    corners[1].door = { label: "door", state: "Closed", locked: false };
    const unlockedTwo = closuresSummary(corners, []);
    expect(unlockedTwo.headline).toBe("2 doors unlocked");
    expect(unlockedTwo.symbol).toBe("lock-open");
  });

  it("does not promise locked doors in the subline when a door lacks a lock reading", () => {
    const corners = allClearCorners();
    corners[0].door = { label: "door", state: "Closed" };
    corners[3].window = { label: "window", state: "Open" };
    const summary = closuresSummary(corners, []);
    expect(summary.subline).toBe("Everything else closed");
  });

  it("lets an in-flight lock command own the headline", () => {
    const corners = allClearCorners();
    corners[0].door = { label: "door", state: "Closed", locked: true, lockedOptimistic: true };
    const summary = closuresSummary(corners, closedOpenings);
    expect(summary).toMatchObject({
      kind: "busy",
      headline: "Locking…",
      subline: "Everything else closed",
      symbol: "lock",
    });
  });

  it("still surfaces open windows and openings while unlocking", () => {
    const corners = allClearCorners();
    corners[0].door = { label: "door", state: "Closed", locked: false, lockedOptimistic: true };
    corners[1].window = { label: "window", state: "Open" };
    const summary = closuresSummary(corners, [{ label: "Trunk", state: "Open" }]);
    expect(summary.headline).toBe("Unlocking…");
    expect(summary.exceptions.map((e) => e.headline)).toEqual([
      "Front passenger window open",
      "Trunk open",
    ]);
  });

  it("reports nothing to say for empty readings", () => {
    const summary = closuresSummary([], []);
    expect(summary.subline).toBeNull();
  });
});
