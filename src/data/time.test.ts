import { describe, expect, it } from "vitest";

import { absoluteLocalTime, observedAt, relativeTime } from "./time";

describe("observedAt", () => {
  const fetchedAt = Date.parse("2026-07-28T12:00:00Z");

  it("passes a stamp older than the read through untouched", () => {
    const at = "2026-07-28T11:30:00Z";
    expect(observedAt(at, fetchedAt)).toBe(Date.parse(at));
  });

  // The bug this exists for. The car's clock ran three minutes ahead of the
  // phone's, so its snapshot claimed to be newer than the fetch that carried
  // it, and the footer contradicted itself: "Lexy checked for data 2 hours 35
  // minutes ago" directly under "Vehicle last synced with Lexus 2 hours 32
  // minutes ago".
  it("never reports a vehicle stamp as newer than the read that carried it", () => {
    const ahead = "2026-07-28T12:03:00Z";
    expect(observedAt(ahead, fetchedAt)).toBe(fetchedAt);
  });

  // The property that matters, stated directly: whatever the two clocks are
  // doing, the car's last word can never read as more recent than our own data.
  it("keeps the sync line no more recent than the data line", () => {
    const now = fetchedAt + 60_000;
    for (const skewMinutes of [-90, -5, 0, 3, 45]) {
      const at = new Date(fetchedAt + skewMinutes * 60_000).toISOString();
      const syncAge = now - observedAt(at, fetchedAt);
      const dataAge = now - fetchedAt;
      expect(syncAge).toBeGreaterThanOrEqual(dataAge);
    }
  });

  it("leaves the stamp alone when there is no read to bound it by", () => {
    const at = "2026-07-28T12:03:00Z";
    expect(observedAt(at, 0)).toBe(Date.parse(at));
  });

  it("returns NaN for a missing or unparseable stamp, which reads as unknown", () => {
    expect(observedAt(undefined, fetchedAt)).toBeNaN();
    expect(observedAt("not a date", fetchedAt)).toBeNaN();
    expect(relativeTime(observedAt("not a date", fetchedAt))).toBe("unknown");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-28T12:00:00Z");
  const ago = (ms: number) => relativeTime(now - ms, now);
  const sec = 1000;
  const min = 60 * sec;
  const hour = 60 * min;
  const day = 24 * hour;

  it('says "just now" for the last few seconds', () => {
    expect(ago(0)).toBe("just now");
    expect(ago(4 * sec)).toBe("just now");
  });

  it("counts seconds", () => {
    expect(ago(5 * sec)).toBe("5 seconds ago");
    expect(ago(59 * sec)).toBe("59 seconds ago");
  });

  it("counts minutes", () => {
    expect(ago(1 * min)).toBe("1 minute ago");
    expect(ago(59 * min + 59 * sec)).toBe("59 minutes ago");
  });

  it("pairs hours with leftover minutes", () => {
    expect(ago(2 * hour)).toBe("2 hours ago");
    expect(ago(1 * hour)).toBe("1 hour ago");
    expect(ago(2 * hour + 5 * min)).toBe("2 hours 5 minutes ago");
    expect(ago(1 * hour + 1 * min)).toBe("1 hour 1 minute ago");
  });

  it("pairs days with leftover hours", () => {
    expect(ago(1 * day)).toBe("1 day ago");
    expect(ago(3 * day + 2 * hour)).toBe("3 days 2 hours ago");
  });

  it('returns "unknown" for unparseable input', () => {
    expect(relativeTime("not a date", now)).toBe("unknown");
  });
});

describe("absoluteLocalTime", () => {
  it("formats a timestamp and rejects garbage", () => {
    expect(absoluteLocalTime(Date.parse("2026-07-28T12:00:00Z"))).toMatch(/2026/);
    expect(absoluteLocalTime("not a date")).toBe("Unknown time");
  });
});
