import { afterEach, describe, expect, it } from "vitest";

import {
  REFRESH_STATUS_MIN_INTERVAL_MS,
  canRefreshStatus,
  recordPrime,
  releasePrime,
  resetRefreshStatusRateLimit,
} from "./refresh-status";

afterEach(() => resetRefreshStatusRateLimit());

describe("refresh-status rate limit", () => {
  it("allows the first prime for a VIN", () => {
    expect(canRefreshStatus("VIN", 0)).toBe(true);
  });

  it("blocks a repeat within the interval and allows it after", () => {
    recordPrime("VIN", 1_000_000);
    expect(canRefreshStatus("VIN", 1_000_000)).toBe(false);
    expect(canRefreshStatus("VIN", 1_000_000 + REFRESH_STATUS_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(canRefreshStatus("VIN", 1_000_000 + REFRESH_STATUS_MIN_INTERVAL_MS)).toBe(true);
  });

  it("tracks each VIN independently", () => {
    recordPrime("VIN_A", 0);
    expect(canRefreshStatus("VIN_A", 0)).toBe(false);
    expect(canRefreshStatus("VIN_B", 0)).toBe(true);
  });

  it("releasePrime reopens the gate (a prime that never landed)", () => {
    recordPrime("VIN", 0);
    expect(canRefreshStatus("VIN", 0)).toBe(false);
    releasePrime("VIN");
    expect(canRefreshStatus("VIN", 0)).toBe(true);
  });
});
